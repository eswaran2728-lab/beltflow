import { Router, Request, Response } from 'express';
import { dbClient } from '../db/client';
import { Permission, UserRole } from '../security/rbac';
import { authenticateJWT, requirePermission } from '../middleware/auth';
import { assignedMasterAccess, primaryMasterAccess } from '../security/access';
import { safeErrorMessage } from '../security/errors';

const router = Router();

function newId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ============================================================================
// 1. INITIATE HANDOVER
// ============================================================================
router.post(
  '/classes/:classId/handover',
  authenticateJWT,
  async (req: Request, res: Response) => {
    try {
      const user = req.user!;
      const { classId } = req.params;
      const { incomingMasterId, reason, effectiveDate } = req.body;

      if (user.role === UserRole.SUPER_ADMIN) {
        return res.status(403).json({ error: 'Super Admin denied operational access.' });
      }

      if (!incomingMasterId) {
        return res.status(400).json({ error: 'incomingMasterId is required.' });
      }

      // Verify class exists
      const classRes = await dbClient.query('SELECT * FROM classes WHERE id = $1', [classId]);
      if (classRes.rowCount === 0) {
        return res.status(404).json({ error: 'Class not found.' });
      }
      const cls = classRes.rows[0];

      // Verify actor authorization: Primary Master OR Persatuan Admin for this class
      let outgoingMasterId = cls.master_id;
      if (user.role === UserRole.MASTER) {
        const isPrimary = await primaryMasterAccess(user, classId);
        if (!isPrimary) {
          return res.status(403).json({ error: 'Only current Primary Master can initiate class handover.' });
        }
        outgoingMasterId = user.id;
      } else if (user.role === UserRole.ADMIN_PERSATUAN) {
        if (user.organizationId !== cls.organization_id) {
          return res.status(403).json({ error: 'Cannot initiate handover for a class outside your Persatuan.' });
        }
      } else {
        return res.status(403).json({ error: 'Unauthorized to initiate handover.' });
      }

      // Prevent self-handover
      if (incomingMasterId === outgoingMasterId) {
        return res.status(400).json({ error: 'Cannot initiate handover to the same outgoing Master.' });
      }

      // Verify incoming Master exists and has role MASTER
      const incomingUserRes = await dbClient.query('SELECT * FROM users WHERE id = $1', [incomingMasterId]);
      if (incomingUserRes.rowCount === 0 || incomingUserRes.rows[0].role !== UserRole.MASTER) {
        return res.status(400).json({ error: 'Incoming candidate must be an existing user with role MASTER.' });
      }

      // Verify incoming Master holds ACTIVE affiliation in the same organization
      const affilRes = await dbClient.query(
        `SELECT status FROM master_affiliations 
         WHERE master_id = $1 AND organization_id = $2 
         ORDER BY created_at DESC LIMIT 1`,
        [incomingMasterId, cls.organization_id]
      );
      if (affilRes.rowCount === 0 || affilRes.rows[0].status !== 'ACTIVE') {
        return res.status(400).json({
          error: 'Incoming Master must have an ACTIVE verified affiliation with this Persatuan.',
        });
      }

      // Prevent simultaneous active handovers on the same class
      const existingRes = await dbClient.query(
        `SELECT id, status FROM class_handover_requests 
         WHERE class_id = $1 AND status IN ('REQUESTED', 'INCOMING_ACCEPTED', 'PERSATUAN_APPROVED')`,
        [classId]
      );
      if (existingRes.rowCount > 0) {
        return res.status(409).json({
          error: 'A pending handover request already exists for this class.',
          existingHandoverId: existingRes.rows[0].id,
        });
      }

      const handoverId = newId('handover');
      const effDate = effectiveDate ? new Date(effectiveDate) : new Date();

      await dbClient.query(
        `INSERT INTO class_handover_requests (
          id, class_id, organization_id, outgoing_master_id, incoming_master_id,
          initiated_by, status, reason, effective_date, version, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, 'REQUESTED', $7, $8, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [handoverId, classId, cls.organization_id, outgoingMasterId, incomingMasterId, user.id, reason || null, effDate]
      );

      // Audit log
      await dbClient.query(
        `INSERT INTO audit_logs (id, action, details, user_role, user_email)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          newId('audit'),
          'Class Leadership Handover Requested',
          `Handover requested for class ${cls.name} (${classId}) from Master ${outgoingMasterId} to Master ${incomingMasterId}`,
          user.role,
          user.email,
        ]
      );

      // Notification outbox
      await dbClient.query(
        `INSERT INTO notification_outbox (id, organization_id, event_type, aggregate_type, aggregate_id, payload, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'PENDING')`,
        [
          newId('notif'),
          cls.organization_id,
          'ClassHandoverRequested',
          'class_handover',
          handoverId,
          JSON.stringify({
            classId,
            className: cls.name,
            outgoingMasterId,
            incomingMasterId,
            initiatedBy: user.id,
          }),
        ]
      );

      const createdRes = await dbClient.query('SELECT * FROM class_handover_requests WHERE id = $1', [handoverId]);
      return res.status(201).json({
        message: 'Class leadership handover requested successfully.',
        handover: createdRes.rows[0],
      });
    } catch (err: any) {
      console.error('[Handover error]', err);
      return res.status(500).json({ error: safeErrorMessage(err, 'Failed to initiate handover.') });
    }
  }
);

// ============================================================================
// 2. GET CLASS HANDOVER & LEADERSHIP HISTORY
// ============================================================================
router.get(
  '/classes/:classId/handover',
  authenticateJWT,
  async (req: Request, res: Response) => {
    try {
      const user = req.user!;
      const { classId } = req.params;

      const classRes = await dbClient.query('SELECT * FROM classes WHERE id = $1', [classId]);
      if (classRes.rowCount === 0) return res.status(404).json({ error: 'Class not found.' });
      const cls = classRes.rows[0];

      if (user.role === UserRole.SUPER_ADMIN) {
        return res.status(403).json({ error: 'Super Admin denied operational access.' });
      }

      if (user.role === UserRole.ADMIN_PERSATUAN) {
        if (user.organizationId !== cls.organization_id) {
          return res.status(403).json({ error: 'Cross-Persatuan access denied.' });
        }
      } else if (user.role === UserRole.MASTER) {
        const canAccess = await assignedMasterAccess(user, classId);
        // Also allow incoming master to view
        const isIncoming = await dbClient.query(
          `SELECT 1 FROM class_handover_requests WHERE class_id = $1 AND incoming_master_id = $2`,
          [classId, user.id]
        );
        if (!canAccess && isIncoming.rowCount === 0) {
          return res.status(403).json({ error: 'Operational class access denied.' });
        }
      } else {
        return res.status(403).json({ error: 'Access denied.' });
      }

      const handovers = await dbClient.query(
        `SELECT chr.*, 
                u_out.full_name AS outgoing_master_name,
                u_in.full_name AS incoming_master_name
         FROM class_handover_requests chr
         LEFT JOIN users u_out ON chr.outgoing_master_id = u_out.id
         LEFT JOIN users u_in ON chr.incoming_master_id = u_in.id
         WHERE chr.class_id = $1
         ORDER BY chr.created_at DESC`,
        [classId]
      );

      const activeHandover = handovers.rows.find((h) =>
        ['REQUESTED', 'INCOMING_ACCEPTED', 'PERSATUAN_APPROVED'].includes(h.status)
      ) || null;

      return res.json({
        activeHandover,
        handoverHistory: handovers.rows,
      });
    } catch (err: any) {
      console.error('[Handover error]', err);
      return res.status(500).json({ error: safeErrorMessage(err, 'Failed to fetch handover history.') });
    }
  }
);

// ============================================================================
// 3. INCOMING MASTER INBOX
// ============================================================================
router.get(
  '/handovers/incoming',
  authenticateJWT,
  async (req: Request, res: Response) => {
    try {
      const user = req.user!;
      if (user.role !== UserRole.MASTER) {
        return res.status(403).json({ error: 'Only Masters can view incoming handovers.' });
      }

      const listRes = await dbClient.query(
        `SELECT chr.*, 
                c.name AS class_name, 
                c.location AS class_location,
                u_out.full_name AS outgoing_master_name,
                o.name AS organization_name
         FROM class_handover_requests chr
         JOIN classes c ON chr.class_id = c.id
         JOIN organizations o ON chr.organization_id = o.id
         JOIN users u_out ON chr.outgoing_master_id = u_out.id
         WHERE chr.incoming_master_id = $1 AND chr.status = 'REQUESTED'
         ORDER BY chr.created_at DESC`,
        [user.id]
      );

      return res.json({ incomingHandovers: listRes.rows });
    } catch (err: any) {
      return res.status(500).json({ error: safeErrorMessage(err, 'Failed to fetch incoming handovers.') });
    }
  }
);

// ============================================================================
// 4. PERSATUAN ADMIN HANDOVERS INBOX
// ============================================================================
router.get(
  '/handovers/admin',
  authenticateJWT,
  async (req: Request, res: Response) => {
    try {
      const user = req.user!;
      if (user.role !== UserRole.ADMIN_PERSATUAN || !user.organizationId) {
        return res.status(403).json({ error: 'Only Persatuan Admins can view approval inbox.' });
      }

      const listRes = await dbClient.query(
        `SELECT chr.*, 
                c.name AS class_name, 
                c.location AS class_location,
                u_out.full_name AS outgoing_master_name,
                u_in.full_name AS incoming_master_name
         FROM class_handover_requests chr
         JOIN classes c ON chr.class_id = c.id
         JOIN users u_out ON chr.outgoing_master_id = u_out.id
         JOIN users u_in ON chr.incoming_master_id = u_in.id
         WHERE chr.organization_id = $1 AND chr.status IN ('REQUESTED', 'INCOMING_ACCEPTED')
         ORDER BY chr.created_at DESC`,
        [user.organizationId]
      );

      return res.json({ pendingHandovers: listRes.rows });
    } catch (err: any) {
      return res.status(500).json({ error: safeErrorMessage(err, 'Failed to fetch admin handovers.') });
    }
  }
);

// ============================================================================
// 5. INCOMING MASTER ACCEPTS HANDOVER
// ============================================================================
router.post(
  '/handovers/:handoverId/accept',
  authenticateJWT,
  async (req: Request, res: Response) => {
    try {
      const user = req.user!;
      const { handoverId } = req.params;

      const handRes = await dbClient.query('SELECT * FROM class_handover_requests WHERE id = $1', [handoverId]);
      if (handRes.rowCount === 0) return res.status(404).json({ error: 'Handover request not found.' });
      const h = handRes.rows[0];

      if (h.incoming_master_id !== user.id) {
        return res.status(403).json({ error: 'Only the designated incoming Master can accept this handover.' });
      }

      if (h.status !== 'REQUESTED') {
        return res.status(400).json({ error: `Cannot accept handover in status ${h.status}.` });
      }

      // Verify incoming Master still holds active affiliation
      const affilRes = await dbClient.query(
        `SELECT status FROM master_affiliations 
         WHERE master_id = $1 AND organization_id = $2 
         ORDER BY created_at DESC LIMIT 1`,
        [user.id, h.organization_id]
      );
      if (affilRes.rowCount === 0 || affilRes.rows[0].status !== 'ACTIVE') {
        return res.status(403).json({ error: 'Incoming Master affiliation is not ACTIVE.' });
      }

      await dbClient.query(
        `UPDATE class_handover_requests 
         SET status = 'INCOMING_ACCEPTED', incoming_accepted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP, version = version + 1
         WHERE id = $1`,
        [handoverId]
      );

      // Audit log
      await dbClient.query(
        `INSERT INTO audit_logs (id, action, details, user_role, user_email)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          newId('audit'),
          'Class Leadership Handover Accepted by Incoming Master',
          `Incoming Master ${user.id} accepted handover for class ${h.class_id}`,
          user.role,
          user.email,
        ]
      );

      return res.json({ message: 'Handover accepted by incoming Master. Awaiting Persatuan Admin approval.' });
    } catch (err: any) {
      return res.status(500).json({ error: safeErrorMessage(err, 'Failed to accept handover.') });
    }
  }
);

// ============================================================================
// 6. REJECT HANDOVER
// ============================================================================
router.post(
  '/handovers/:handoverId/reject',
  authenticateJWT,
  async (req: Request, res: Response) => {
    try {
      const user = req.user!;
      const { handoverId } = req.params;
      const { rejectionReason } = req.body;

      const handRes = await dbClient.query('SELECT * FROM class_handover_requests WHERE id = $1', [handoverId]);
      if (handRes.rowCount === 0) return res.status(404).json({ error: 'Handover request not found.' });
      const h = handRes.rows[0];

      const isIncoming = h.incoming_master_id === user.id;
      const isAdmin = user.role === UserRole.ADMIN_PERSATUAN && user.organizationId === h.organization_id;

      if (!isIncoming && !isAdmin) {
        return res.status(403).json({ error: 'Unauthorized to reject this handover request.' });
      }

      if (['COMPLETED', 'REJECTED', 'CANCELLED'].includes(h.status)) {
        return res.status(400).json({ error: `Cannot reject handover in status ${h.status}.` });
      }

      await dbClient.query(
        `UPDATE class_handover_requests 
         SET status = 'REJECTED', rejection_reason = $1, updated_at = CURRENT_TIMESTAMP, version = version + 1
         WHERE id = $2`,
        [rejectionReason || 'Rejected by participant', handoverId]
      );

      await dbClient.query(
        `INSERT INTO audit_logs (id, action, details, user_role, user_email)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          newId('audit'),
          'Class Leadership Handover Rejected',
          `Handover ${handoverId} for class ${h.class_id} rejected: ${rejectionReason || 'No reason specified'}`,
          user.role,
          user.email,
        ]
      );

      return res.json({ message: 'Handover request rejected.' });
    } catch (err: any) {
      return res.status(500).json({ error: safeErrorMessage(err, 'Failed to reject handover.') });
    }
  }
);

// ============================================================================
// 7. PERSATUAN ADMIN APPROVES & ATOMICALLY EXECUTES HANDOVER
// ============================================================================
router.post(
  '/handovers/:handoverId/approve',
  authenticateJWT,
  async (req: Request, res: Response) => {
    try {
      const user = req.user!;
      const { handoverId } = req.params;

      if (user.role !== UserRole.ADMIN_PERSATUAN) {
        return res.status(403).json({ error: 'Only Persatuan Admin can approve class handovers.' });
      }

      const handRes = await dbClient.query(
        `SELECT * FROM class_handover_requests WHERE id = $1`,
        [handoverId]
      );
      if (handRes.rowCount === 0) {
        return res.status(404).json({ error: 'Handover request not found.' });
      }
      const h = handRes.rows[0];

      if (user.organizationId !== h.organization_id) {
        return res.status(403).json({ error: 'Cross-Persatuan handover approval rejected.' });
      }

      if (h.status !== 'INCOMING_ACCEPTED') {
        return res.status(400).json({
          error: `Handover cannot be approved while in status ${h.status}. Incoming Master must accept first.`,
        });
      }

      // 1. Re-verify incoming master's active affiliation
      const affilRes = await dbClient.query(
        `SELECT status FROM master_affiliations 
         WHERE master_id = $1 AND organization_id = $2 
         ORDER BY created_at DESC LIMIT 1`,
        [h.incoming_master_id, h.organization_id]
      );
      if (affilRes.rowCount === 0 || affilRes.rows[0].status !== 'ACTIVE') {
        return res.status(400).json({ error: 'Incoming Master does not hold an ACTIVE affiliation.' });
      }

      // Atomic execution using transaction
      await dbClient.transaction(async (tx) => {
        // Lock class row
        const classRes = await tx.query('SELECT * FROM classes WHERE id = $1 FOR UPDATE', [h.class_id]);
        if (classRes.rowCount === 0) {
          throw new Error('Target class not found.');
        }
        const cls = classRes.rows[0];

        // Deactivate outgoing primary leadership
        await tx.query(
          `UPDATE class_leaderships 
           SET is_active = FALSE, effective_to = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
           WHERE class_id = $1 AND is_active = TRUE AND leadership_type = 'PRIMARY'`,
          [h.class_id]
        );

        // Insert incoming primary leadership
        const newLeadId = newId('lead');
        await tx.query(
          `INSERT INTO class_leaderships (
            id, class_id, master_id, organization_id, leadership_type, effective_from,
            is_active, appointed_by, provenance, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, 'PRIMARY', CURRENT_TIMESTAMP, TRUE, $5, 'HANDOVER', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [newLeadId, h.class_id, h.incoming_master_id, h.organization_id, user.id]
        );

        // Update legacy class pointer & increment version
        await tx.query(
          `UPDATE classes 
           SET master_id = $1, version = version + 1
           WHERE id = $2`,
          [h.incoming_master_id, h.class_id]
        );

        // Complete handover request
        await tx.query(
          `UPDATE class_handover_requests 
           SET status = 'COMPLETED', admin_approved_by = $1, admin_approved_at = CURRENT_TIMESTAMP, 
               completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP, version = version + 1
           WHERE id = $2`,
          [user.id, handoverId]
        );

        // Audit log
        await tx.query(
          `INSERT INTO audit_logs (id, action, details, user_role, user_email)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            newId('audit'),
            'Class Leadership Handover Completed',
            `Handover completed for class ${cls.name} (${h.class_id}). Primary leadership transferred from ${h.outgoing_master_id} to ${h.incoming_master_id}.`,
            user.role,
            user.email,
          ]
        );

        // Notification outbox
        await tx.query(
          `INSERT INTO notification_outbox (id, organization_id, event_type, aggregate_type, aggregate_id, payload, status)
           VALUES ($1, $2, $3, $4, $5, $6, 'PENDING')`,
          [
            newId('notif'),
            h.organization_id,
            'ClassHandoverCompleted',
            'class_handover',
            handoverId,
            JSON.stringify({
              classId: h.class_id,
              className: cls.name,
              outgoingMasterId: h.outgoing_master_id,
              incomingMasterId: h.incoming_master_id,
              approvedBy: user.id,
            }),
          ]
        );
      });

      return res.json({
        message: 'Class leadership handover approved and completed successfully.',
        classId: h.class_id,
        newPrimaryMasterId: h.incoming_master_id,
      });
    } catch (err: any) {
      console.error('[Handover approval error]', err);
      return res.status(500).json({ error: safeErrorMessage(err, 'Failed to approve handover.') });
    }
  }
);

// ============================================================================
// 8. TEMPORARY SUBSTITUTION / DELEGATION
// ============================================================================
router.post(
  '/classes/:classId/delegation',
  authenticateJWT,
  async (req: Request, res: Response) => {
    try {
      const user = req.user!;
      const { classId } = req.params;
      const { substituteMasterId, validFrom, validUntil, capabilities, notes, sessionId } = req.body;

      if (user.role === UserRole.SUPER_ADMIN) {
        return res.status(403).json({ error: 'Super Admin denied operational access.' });
      }

      if (!substituteMasterId || !validFrom || !validUntil) {
        return res.status(400).json({ error: 'substituteMasterId, validFrom, and validUntil are required.' });
      }

      const from = new Date(validFrom);
      const to = new Date(validUntil);
      if (isNaN(from.getTime()) || isNaN(to.getTime()) || from >= to) {
        return res.status(400).json({ error: 'validFrom must be a valid date before validUntil.' });
      }

      const classRes = await dbClient.query('SELECT * FROM classes WHERE id = $1', [classId]);
      if (classRes.rowCount === 0) return res.status(404).json({ error: 'Class not found.' });
      const cls = classRes.rows[0];

      // Actor authorization: Primary Master OR Persatuan Admin
      if (user.role === UserRole.MASTER) {
        const isPrimary = await primaryMasterAccess(user, classId);
        if (!isPrimary) {
          return res.status(403).json({ error: 'Only Primary Master can appoint a temporary substitute.' });
        }
      } else if (user.role === UserRole.ADMIN_PERSATUAN) {
        if (user.organizationId !== cls.organization_id) {
          return res.status(403).json({ error: 'Cross-Persatuan substitution rejected.' });
        }
      } else {
        return res.status(403).json({ error: 'Access denied.' });
      }

      // Verify substitute Master has ACTIVE affiliation with same Persatuan
      const affilRes = await dbClient.query(
        `SELECT status FROM master_affiliations 
         WHERE master_id = $1 AND organization_id = $2 
         ORDER BY created_at DESC LIMIT 1`,
        [substituteMasterId, cls.organization_id]
      );
      if (affilRes.rowCount === 0 || affilRes.rows[0].status !== 'ACTIVE') {
        return res.status(400).json({
          error: 'Substitute Master must have an ACTIVE verified affiliation with this Persatuan.',
        });
      }

      const leadId = newId('sub_lead');
      await dbClient.query(
        `INSERT INTO class_leaderships (
          id, class_id, master_id, organization_id, leadership_type, effective_from,
          effective_to, is_active, appointed_by, notes, capabilities, session_id,
          provenance, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, 'SUBSTITUTE', $5, $6, TRUE, $7, $8, $9, $10, 'DELEGATION', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [
          leadId,
          classId,
          substituteMasterId,
          cls.organization_id,
          from,
          to,
          user.id,
          notes || null,
          capabilities || 'ATTENDANCE_ONLY',
          sessionId || null,
        ]
      );

      // Audit log
      await dbClient.query(
        `INSERT INTO audit_logs (id, action, details, user_role, user_email)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          newId('audit'),
          'Temporary Substitute Master Appointed',
          `Substitute Master ${substituteMasterId} delegated for class ${classId} from ${from.toISOString()} to ${to.toISOString()} with capabilities ${capabilities || 'ATTENDANCE_ONLY'}`,
          user.role,
          user.email,
        ]
      );

      return res.status(201).json({
        message: 'Temporary substitute Master assigned successfully.',
        delegationId: leadId,
      });
    } catch (err: any) {
      console.error('[Delegation error]', err);
      return res.status(500).json({ error: safeErrorMessage(err, 'Failed to assign temporary substitute.') });
    }
  }
);

// ============================================================================
// 9. REVOKE TEMPORARY SUBSTITUTION
// ============================================================================
router.delete(
  '/classes/:classId/delegation/:leadershipId',
  authenticateJWT,
  async (req: Request, res: Response) => {
    try {
      const user = req.user!;
      const { classId, leadershipId } = req.params;

      const classRes = await dbClient.query('SELECT * FROM classes WHERE id = $1', [classId]);
      if (classRes.rowCount === 0) return res.status(404).json({ error: 'Class not found.' });
      const cls = classRes.rows[0];

      if (user.role === UserRole.MASTER) {
        const isPrimary = await primaryMasterAccess(user, classId);
        if (!isPrimary) return res.status(403).json({ error: 'Only Primary Master can revoke substitution.' });
      } else if (user.role === UserRole.ADMIN_PERSATUAN) {
        if (user.organizationId !== cls.organization_id) return res.status(403).json({ error: 'Cross-Persatuan access denied.' });
      } else {
        return res.status(403).json({ error: 'Access denied.' });
      }

      const updateRes = await dbClient.query(
        `UPDATE class_leaderships 
         SET is_active = FALSE, effective_to = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND class_id = $2 AND leadership_type = 'SUBSTITUTE' AND is_active = TRUE`,
        [leadershipId, classId]
      );

      if (updateRes.rowCount === 0) {
        return res.status(404).json({ error: 'Active substitute delegation not found.' });
      }

      await dbClient.query(
        `INSERT INTO audit_logs (id, action, details, user_role, user_email)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          newId('audit'),
          'Temporary Substitute Master Revoked',
          `Substitute delegation ${leadershipId} revoked for class ${classId}`,
          user.role,
          user.email,
        ]
      );

      return res.json({ message: 'Temporary substitute delegation revoked successfully.' });
    } catch (err: any) {
      return res.status(500).json({ error: safeErrorMessage(err, 'Failed to revoke substitute delegation.') });
    }
  }
);

// ============================================================================
// 10. LIST ACTIVE & HISTORIC LEADERSHIPS FOR CLASS
// ============================================================================
router.get(
  '/classes/:classId/leaderships',
  authenticateJWT,
  async (req: Request, res: Response) => {
    try {
      const user = req.user!;
      const { classId } = req.params;

      const classRes = await dbClient.query('SELECT * FROM classes WHERE id = $1', [classId]);
      if (classRes.rowCount === 0) return res.status(404).json({ error: 'Class not found.' });
      const cls = classRes.rows[0];

      if (user.role === UserRole.SUPER_ADMIN) {
        return res.status(403).json({ error: 'Super Admin denied operational access.' });
      }

      if (user.role === UserRole.ADMIN_PERSATUAN) {
        if (user.organizationId !== cls.organization_id) {
          return res.status(403).json({ error: 'Cross-Persatuan access denied.' });
        }
      } else if (user.role === UserRole.MASTER) {
        const canAccess = await assignedMasterAccess(user, classId);
        if (!canAccess) return res.status(403).json({ error: 'Class access denied.' });
      } else {
        return res.status(403).json({ error: 'Access denied.' });
      }

      const listRes = await dbClient.query(
        `SELECT cl.*, u.full_name AS master_name, u.email AS master_email
         FROM class_leaderships cl
         JOIN users u ON cl.master_id = u.id
         WHERE cl.class_id = $1
         ORDER BY (cl.is_active = TRUE) DESC, cl.effective_from DESC`,
        [classId]
      );

      return res.json({ leaderships: listRes.rows });
    } catch (err: any) {
      return res.status(500).json({ error: safeErrorMessage(err, 'Failed to list class leaderships.') });
    }
  }
);

export default router;
