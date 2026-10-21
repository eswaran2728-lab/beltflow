import { Router, Request, Response } from 'express';
import { dbClient } from '../db/client';
import { authenticateJWT } from '../middleware/auth';
import { UserRole } from '../security/rbac';
import crypto from 'crypto';

const router = Router();

// Constant rules for Task H22 Parent-Master Messaging
const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024; // 10 Megabytes limit
const BLOCKED_FILE_EXTENSIONS = [
  '.exe',
  '.bat',
  '.cmd',
  '.sh',
  '.bin',
  '.msi',
  '.dll',
  '.scr',
  '.vbs',
  '.js',
  '.zip',
  '.tar',
  '.gz',
];
const BLOCKED_MIME_TYPES = [
  'application/x-msdownload',
  'application/x-sh',
  'application/x-executable',
  'application/octet-stream',
  'application/zip',
  'application/x-zip-compressed',
  'application/x-tar',
];

// Helper: Check active class leadership for a Master
async function isMasterActivelyLeadingClass(masterId: string, classId: string): Promise<boolean> {
  const leadRes = await dbClient.query(
    `SELECT is_active, leadership_type, effective_from, effective_to
     FROM class_leaderships
     WHERE class_id = $1 AND master_id = $2
     ORDER BY (is_active = TRUE AND (effective_to IS NULL OR effective_to >= CURRENT_TIMESTAMP) AND (effective_from IS NULL OR effective_from <= CURRENT_TIMESTAMP)) DESC,
              created_at DESC
     LIMIT 1;`,
    [classId, masterId]
  );

  if (leadRes.rows.length > 0) {
    const lead = leadRes.rows[0];
    if (lead.is_active) {
      const now = new Date();
      const from = lead.effective_from ? new Date(lead.effective_from) : null;
      const to = lead.effective_to ? new Date(lead.effective_to) : null;
      if ((!from || now >= from) && (!to || now <= to)) {
        return true;
      }
    }
    // Explicit record exists but is inactive, expired, or future
    return false;
  }

  // Fallback to coach_class_assignments
  const coachRes = await dbClient.query(
    `SELECT 1 FROM coach_class_assignments WHERE class_id = $1 AND coach_id = $2 LIMIT 1;`,
    [classId, masterId]
  );
  if (coachRes.rows.length > 0) {
    return true;
  }

  // Fallback to legacy master_id on classes table ONLY if no class_leaderships exist
  const anyLead = await dbClient.query(`SELECT 1 FROM class_leaderships WHERE class_id = $1 LIMIT 1;`, [classId]);
  if (anyLead.rows.length === 0) {
    const clsRes = await dbClient.query(
      `SELECT master_id, main_master_id FROM classes WHERE id = $1 LIMIT 1;`,
      [classId]
    );
    if (clsRes.rows.length > 0) {
      const row = clsRes.rows[0];
      return row.master_id === masterId || row.main_master_id === masterId;
    }
  }

  return false;
}

// Helper: Check active student enrollment in class
async function isStudentEnrolledInClass(studentId: string, classId: string): Promise<boolean> {
  const res = await dbClient.query(
    `SELECT 1 FROM students WHERE id = $1 AND class_id = $2
     UNION
     SELECT 1 FROM class_enrollments WHERE student_id = $1 AND class_id = $2 AND status IN ('ACTIVE', 'ENROLLED')
     LIMIT 1;`,
    [studentId, classId]
  );
  return res.rows.length > 0;
}

// Helper: Check active guardian-student link
async function isGuardianLinkedToStudent(guardianId: string, studentId: string): Promise<boolean> {
  const res = await dbClient.query(
    `SELECT 1 FROM parent_student_links
     WHERE parent_id = $1 AND student_id = $2 AND status = 'ACTIVE'
     LIMIT 1;`,
    [guardianId, studentId]
  );
  return res.rows.length > 0;
}

// ============================================================================
// 1. POST /api/v1/messaging/threads (createThread(childId, classId))
// Acceptance test: cross_class_thread_denied
// ============================================================================
router.post('/threads', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    if (user.role === UserRole.SUPER_ADMIN) {
      return res.status(403).json({ error: 'Super Admin has zero operational access to message threads.' });
    }

    if (user.role === UserRole.STUDENT) {
      return res.status(403).json({
        error: 'cross_class_thread_denied: Minor communication policy requires threads to be initiated by guardians or masters.',
      });
    }

    const { childId, studentId: studentIdParam, classId, subject = 'General Inquiry', masterId: targetMasterId } = req.body;
    const studentId = childId || studentIdParam;

    if (!studentId || !classId) {
      return res.status(400).json({ error: 'childId and classId are required.' });
    }

    // Verify student exists and tenant matches
    const stuRes = await dbClient.query(
      `SELECT id, organization_id, user_id, full_name FROM students WHERE id = $1 LIMIT 1;`,
      [studentId]
    );
    if (stuRes.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found.' });
    }
    const student = stuRes.rows[0];

    if (user.organizationId !== student.organization_id) {
      return res.status(403).json({ error: 'Cross-tenant thread creation denied.' });
    }

    // Acceptance test: cross_class_thread_denied (enforce student enrollment in class)
    const enrolled = await isStudentEnrolledInClass(studentId, classId);
    if (!enrolled) {
      return res.status(403).json({
        error: 'cross_class_thread_denied: Student is not actively enrolled in this class.',
      });
    }

    // Enforce role-specific participant resolution
    let parentId: string;
    let assignedMasterId: string;

    if (user.role === UserRole.PARENT) {
      parentId = user.id;
      const isLinked = await isGuardianLinkedToStudent(parentId, studentId);
      if (!isLinked) {
        return res.status(403).json({
          error: 'cross_class_thread_denied: Guardian not linked to this student.',
        });
      }

      // Resolve active Master for this class
      if (targetMasterId) {
        const isMasterValid = await isMasterActivelyLeadingClass(targetMasterId, classId);
        if (!isMasterValid) {
          return res.status(403).json({
            error: 'cross_class_thread_denied: Specified Master is not an active instructor for this class.',
          });
        }
        assignedMasterId = targetMasterId;
      } else {
        // Query active primary or substitute master
        const leadRes = await dbClient.query(
          `SELECT master_id FROM class_leaderships
           WHERE class_id = $1 AND is_active = TRUE
             AND (effective_to IS NULL OR effective_to >= CURRENT_TIMESTAMP)
             AND (effective_from IS NULL OR effective_from <= CURRENT_TIMESTAMP)
           ORDER BY (leadership_type = 'PRIMARY') DESC, created_at DESC
           LIMIT 1;`,
          [classId]
        );
        if (leadRes.rows.length > 0) {
          assignedMasterId = leadRes.rows[0].master_id;
        } else {
          // Fallback to classes.master_id
          const clsRes = await dbClient.query(`SELECT master_id FROM classes WHERE id = $1 LIMIT 1;`, [classId]);
          if (clsRes.rows.length > 0 && clsRes.rows[0].master_id) {
            assignedMasterId = clsRes.rows[0].master_id;
          } else {
            return res.status(400).json({ error: 'No active Master assigned to this class.' });
          }
        }
      }
    } else if (user.role === UserRole.MASTER) {
      assignedMasterId = user.id;
      const isMasterValid = await isMasterActivelyLeadingClass(assignedMasterId, classId);
      if (!isMasterValid) {
        return res.status(403).json({
          error: 'cross_class_thread_denied: Master does not hold active leadership for this class.',
        });
      }

      // Find active guardian for student
      const linkRes = await dbClient.query(
        `SELECT parent_id FROM parent_student_links WHERE student_id = $1 AND status = 'ACTIVE' LIMIT 1;`,
        [studentId]
      );
      if (linkRes.rows.length === 0) {
        return res.status(400).json({
          error: 'Student does not have an active verified guardian for messaging.',
        });
      }
      parentId = linkRes.rows[0].parent_id;
    } else if (user.role === UserRole.ADMIN_PERSATUAN) {
      // Admin Persatuan can resolve parent and master
      const linkRes = await dbClient.query(
        `SELECT parent_id FROM parent_student_links WHERE student_id = $1 AND status = 'ACTIVE' LIMIT 1;`,
        [studentId]
      );
      if (linkRes.rows.length === 0) {
        return res.status(400).json({ error: 'Student does not have an active verified guardian.' });
      }
      parentId = linkRes.rows[0].parent_id;

      const clsRes = await dbClient.query(`SELECT master_id FROM classes WHERE id = $1 LIMIT 1;`, [classId]);
      assignedMasterId = clsRes.rows[0]?.master_id || user.id;
    } else {
      return res.status(403).json({ error: 'Unauthorized role for message threads.' });
    }

    const threadId = `thr_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    const upsertRes = await dbClient.query(
      `INSERT INTO message_threads (
        id, organization_id, class_id, student_id, parent_id, assigned_master_id, subject, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'ACTIVE')
      ON CONFLICT (parent_id, student_id, class_id, assigned_master_id)
      DO UPDATE SET updated_at = CURRENT_TIMESTAMP
      RETURNING *;`,
      [threadId, student.organization_id, classId, studentId, parentId, assignedMasterId, subject]
    );

    const thread = upsertRes.rows[0];

    // Audit log
    await dbClient.query(
      `INSERT INTO audit_logs (id, action, details, user_role, user_email)
       VALUES ($1, $2, $3, $4, $5);`,
      [
        `aud_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
        'MESSAGE_THREAD_CREATED',
        JSON.stringify({ threadId: thread.id, studentId, classId, parentId, assignedMasterId }),
        user.role,
        user.email,
      ]
    );

    return res.status(201).json(thread);
  } catch (err: any) {
    console.error('[createThread error]:', err);
    return res.status(500).json({ error: err.message || 'Internal server error creating thread.' });
  }
});

// ============================================================================
// 2. POST /api/v1/messaging/threads/:threadId/messages (sendMessage(threadId, input))
// Acceptance tests: former_master_cannot_send, message_retry_once,
//                   blocked_attachment_rejected, lock_screen_content_minimized
// ============================================================================
router.post('/threads/:threadId/messages', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const { threadId } = req.params;
    const {
      content,
      clientMessageId,
      attachmentUrl,
      attachmentName,
      attachmentMime,
      attachmentSizeBytes,
    } = req.body;

    if (!content || typeof content !== 'string' || content.trim() === '') {
      return res.status(400).json({ error: 'Message content is required.' });
    }

    // Acceptance test: blocked_attachment_rejected
    if (attachmentName || attachmentMime) {
      const fileName = (attachmentName || '').toLowerCase();
      const mime = (attachmentMime || '').toLowerCase();

      const hasBlockedExt = BLOCKED_FILE_EXTENSIONS.some((ext) => fileName.endsWith(ext));
      const hasBlockedMime = BLOCKED_MIME_TYPES.includes(mime);

      if (hasBlockedExt || hasBlockedMime) {
        return res.status(400).json({
          error: 'blocked_attachment_rejected: File attachment type is not permitted by communication policy.',
        });
      }

      if (attachmentSizeBytes && Number(attachmentSizeBytes) > MAX_ATTACHMENT_SIZE_BYTES) {
        return res.status(400).json({
          error: `blocked_attachment_rejected: Attachment exceeds max size of 10MB (${MAX_ATTACHMENT_SIZE_BYTES} bytes).`,
        });
      }
    }

    // Find thread
    const thrRes = await dbClient.query(`SELECT * FROM message_threads WHERE id = $1 LIMIT 1;`, [threadId]);
    if (thrRes.rows.length === 0) {
      return res.status(404).json({ error: 'Message thread not found.' });
    }
    const thread = thrRes.rows[0];

    // Tenant isolation
    if (user.organizationId !== thread.organization_id) {
      return res.status(403).json({ error: 'Cross-tenant messaging denied.' });
    }

    // Participant verification
    if (user.role === UserRole.MASTER) {
      if (thread.assigned_master_id !== user.id) {
        return res.status(403).json({
          error: 'former_master_cannot_send: Master is not the assigned participant on this thread.',
        });
      }

      // Acceptance test: former_master_cannot_send
      const isStillActive = await isMasterActivelyLeadingClass(user.id, thread.class_id);
      if (!isStillActive) {
        return res.status(403).json({
          error: 'former_master_cannot_send: Former or replaced Master cannot send messages in this class thread.',
        });
      }
    } else if (user.role === UserRole.PARENT) {
      if (thread.parent_id !== user.id) {
        return res.status(403).json({ error: 'Guardians can only message in their own child threads.' });
      }
    } else if (user.role !== UserRole.ADMIN_PERSATUAN) {
      return res.status(403).json({ error: 'Unauthorized to send message in this thread.' });
    }

    // Acceptance test: message_retry_once (idempotency key check)
    if (clientMessageId && typeof clientMessageId === 'string') {
      const existMsg = await dbClient.query(
        `SELECT * FROM thread_messages WHERE client_message_id = $1 AND thread_id = $2 LIMIT 1;`,
        [clientMessageId, threadId]
      );
      if (existMsg.rows.length > 0) {
        return res.status(200).json({
          ...existMsg.rows[0],
          idempotentReplay: true,
          message: 'message_retry_once: Message already processed.',
        });
      }
    }

    const messageId = `msg_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    const insMsg = await dbClient.query(
      `INSERT INTO thread_messages (
        id, thread_id, sender_id, sender_role, client_message_id, content,
        attachment_url, attachment_name, attachment_mime, attachment_size_bytes, delivery_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'SENT')
      RETURNING *;`,
      [
        messageId,
        threadId,
        user.id,
        user.role,
        clientMessageId || null,
        content.trim(),
        attachmentUrl || null,
        attachmentName || null,
        attachmentMime || null,
        attachmentSizeBytes || null,
      ]
    );

    // Update last_message_at
    await dbClient.query(`UPDATE message_threads SET last_message_at = CURRENT_TIMESTAMP WHERE id = $1;`, [threadId]);

    // Acceptance test: lock_screen_content_minimized
    // Notification outbox record MUST minimize lock screen preview (no sensitive child/message text)
    const recipientId = user.role === UserRole.PARENT ? thread.assigned_master_id : thread.parent_id;
    const neutralTitle = 'New Message';
    const minimizedBody =
      user.role === UserRole.MASTER
        ? 'New message from instructor'
        : 'New message from parent';

    await dbClient.query(
      `INSERT INTO notification_outbox (
        id, organization_id, event_type, aggregate_type, aggregate_id, payload, status
      ) VALUES ($1, $2, 'ParentMasterMessageReceived', 'message_thread', $3, $4, 'PENDING');`,
      [
        `notif_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
        thread.organization_id,
        thread.id,
        JSON.stringify({
          recipientId,
          threadId: thread.id,
          messageId,
          senderRole: user.role,
          title: neutralTitle,
          body: minimizedBody,
          lockScreenSafe: true,
        }),
      ]
    );

    return res.status(201).json(insMsg.rows[0]);
  } catch (err: any) {
    console.error('[sendMessage error]:', err);
    return res.status(500).json({ error: err.message || 'Internal server error sending message.' });
  }
});

// ============================================================================
// 3. GET /api/v1/messaging/threads
// Acceptance test: no_private_thread_auto_handover
// ============================================================================
router.get('/threads', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    if (user.role === UserRole.SUPER_ADMIN) {
      return res.status(403).json({ error: 'Super Admin has zero operational access to message threads.' });
    }

    let query: string;
    let params: any[];

    if (user.role === UserRole.MASTER) {
      // Acceptance test: no_private_thread_auto_handover
      // Query returns ONLY threads where assigned_master_id = user.id (no auto-handover of old private threads)
      query = `
        SELECT t.*, c.name as class_name, s.full_name as student_name, p.full_name as parent_name,
               (SELECT content FROM thread_messages WHERE thread_id = t.id ORDER BY created_at DESC LIMIT 1) as last_message_content,
               (SELECT COUNT(*) FROM thread_messages WHERE thread_id = t.id AND sender_id != $1 AND read_at IS NULL) as unread_count
        FROM message_threads t
        JOIN classes c ON t.class_id = c.id
        JOIN students s ON t.student_id = s.id
        JOIN users p ON t.parent_id = p.id
        WHERE t.assigned_master_id = $1 AND t.organization_id = $2
        ORDER BY t.last_message_at DESC;
      `;
      params = [user.id, user.organizationId];
    } else if (user.role === UserRole.PARENT) {
      query = `
        SELECT t.*, c.name as class_name, s.full_name as student_name, m.full_name as master_name,
               (SELECT content FROM thread_messages WHERE thread_id = t.id ORDER BY created_at DESC LIMIT 1) as last_message_content,
               (SELECT COUNT(*) FROM thread_messages WHERE thread_id = t.id AND sender_id != $1 AND read_at IS NULL) as unread_count
        FROM message_threads t
        JOIN classes c ON t.class_id = c.id
        JOIN students s ON t.student_id = s.id
        JOIN users m ON t.assigned_master_id = m.id
        WHERE t.parent_id = $1 AND t.organization_id = $2
        ORDER BY t.last_message_at DESC;
      `;
      params = [user.id, user.organizationId];
    } else if (user.role === UserRole.ADMIN_PERSATUAN) {
      query = `
        SELECT t.*, c.name as class_name, s.full_name as student_name, p.full_name as parent_name, m.full_name as master_name
        FROM message_threads t
        JOIN classes c ON t.class_id = c.id
        JOIN students s ON t.student_id = s.id
        JOIN users p ON t.parent_id = p.id
        JOIN users m ON t.assigned_master_id = m.id
        WHERE t.organization_id = $1
        ORDER BY t.last_message_at DESC;
      `;
      params = [user.organizationId];
    } else {
      return res.status(403).json({ error: 'Unauthorized to view message threads.' });
    }

    const result = await dbClient.query(query, params);
    return res.status(200).json(result.rows);
  } catch (err: any) {
    console.error('[listThreads error]:', err);
    return res.status(500).json({ error: err.message || 'Internal server error listing threads.' });
  }
});

// ============================================================================
// 4. GET /api/v1/messaging/threads/:threadId/messages
// Acceptance test: no_private_thread_auto_handover
// ============================================================================
router.get('/threads/:threadId/messages', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const { threadId } = req.params;

    const thrRes = await dbClient.query(`SELECT * FROM message_threads WHERE id = $1 LIMIT 1;`, [threadId]);
    if (thrRes.rows.length === 0) {
      return res.status(404).json({ error: 'Message thread not found.' });
    }
    const thread = thrRes.rows[0];

    // Tenant isolation
    if (user.organizationId !== thread.organization_id) {
      return res.status(403).json({ error: 'Cross-tenant thread access denied.' });
    }

    // Acceptance test: no_private_thread_auto_handover
    // Only assigned_master_id or parent_id (or Admin Persatuan) can read messages
    if (user.role === UserRole.MASTER && thread.assigned_master_id !== user.id) {
      return res.status(403).json({
        error: 'no_private_thread_auto_handover: Incoming or unassigned Master cannot access another instructor private thread.',
      });
    }
    if (user.role === UserRole.PARENT && thread.parent_id !== user.id) {
      return res.status(403).json({ error: 'Guardian unauthorized to view this thread.' });
    }

    // Fetch messages
    const msgRes = await dbClient.query(
      `SELECT m.*, u.full_name as sender_name
       FROM thread_messages m
       JOIN users u ON m.sender_id = u.id
       WHERE m.thread_id = $1
       ORDER BY m.created_at ASC;`,
      [threadId]
    );

    // Mark unread messages as read
    await dbClient.query(
      `UPDATE thread_messages
       SET delivery_status = 'READ', read_at = CURRENT_TIMESTAMP
       WHERE thread_id = $1 AND sender_id != $2 AND read_at IS NULL;`,
      [threadId, user.id]
    );

    return res.status(200).json({
      thread,
      messages: msgRes.rows,
    });
  } catch (err: any) {
    console.error('[getThreadMessages error]:', err);
    return res.status(500).json({ error: err.message || 'Internal server error retrieving messages.' });
  }
});

// ============================================================================
// 5. POST /api/v1/messaging/messages/:id/report (reportMessage(id))
// ============================================================================
router.post('/messages/:id/report', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const { id } = req.params;
    const { reason = 'Inappropriate content' } = req.body;

    const msgRes = await dbClient.query(
      `SELECT m.*, t.organization_id, t.parent_id, t.assigned_master_id
       FROM thread_messages m
       JOIN message_threads t ON m.thread_id = t.id
       WHERE m.id = $1 LIMIT 1;`,
      [id]
    );

    if (msgRes.rows.length === 0) {
      return res.status(404).json({ error: 'Message not found.' });
    }

    const msg = msgRes.rows[0];

    // Tenant check
    if (user.organizationId !== msg.organization_id) {
      return res.status(403).json({ error: 'Cross-tenant message report denied.' });
    }

    // Must be participant or Admin Persatuan
    if (user.id !== msg.parent_id && user.id !== msg.assigned_master_id && user.role !== UserRole.ADMIN_PERSATUAN) {
      return res.status(403).json({ error: 'Only thread participants can report messages.' });
    }

    const reportId = `rep_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    await dbClient.query(
      `INSERT INTO message_reports (
        id, message_id, thread_id, organization_id, reported_by, reason, status
      ) VALUES ($1, $2, $3, $4, $5, $6, 'PENDING_REVIEW');`,
      [reportId, id, msg.thread_id, msg.organization_id, user.id, reason]
    );

    await dbClient.query(`UPDATE thread_messages SET is_reported = TRUE WHERE id = $1;`, [id]);

    // Audit log
    await dbClient.query(
      `INSERT INTO audit_logs (id, action, details, user_role, user_email)
       VALUES ($1, $2, $3, $4, $5);`,
      [
        `aud_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
        'MESSAGE_REPORTED',
        JSON.stringify({ messageId: id, reportedBy: user.id, reason }),
        user.role,
        user.email,
      ]
    );

    return res.status(200).json({
      success: true,
      reportId,
      messageId: id,
      status: 'PENDING_REVIEW',
      message: 'Message reported successfully for administrator review.',
    });
  } catch (err: any) {
    console.error('[reportMessage error]:', err);
    return res.status(500).json({ error: err.message || 'Internal server error reporting message.' });
  }
});

// ============================================================================
// 6. GET /api/v1/messaging/reports (Admin Persatuan Moderation)
// ============================================================================
router.get('/reports', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user || user.role !== UserRole.ADMIN_PERSATUAN) {
      return res.status(403).json({ error: 'Only Persatuan administrators can access message reports.' });
    }

    const resReports = await dbClient.query(
      `SELECT r.*, m.content as message_content, u.full_name as reported_by_name
       FROM message_reports r
       JOIN thread_messages m ON r.message_id = m.id
       JOIN users u ON r.reported_by = u.id
       WHERE r.organization_id = $1
       ORDER BY r.created_at DESC;`,
      [user.organizationId]
    );

    return res.status(200).json(resReports.rows);
  } catch (err: any) {
    console.error('[getReports error]:', err);
    return res.status(500).json({ error: err.message || 'Internal server error retrieving reports.' });
  }
});

export default router;
