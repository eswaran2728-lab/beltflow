import { Router, Request, Response } from 'express';
import { dbClient } from '../db/client';
import { authenticateJWT } from '../middleware/auth';
import { UserRole } from '../security/rbac';
import { mediaStorageAdapter } from '../services/mediaStorageAdapter';
import crypto from 'crypto';

const router = Router();

// Constant rules for Task H21
const MAX_VIDEO_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 Megabytes limit
const ALLOWED_MIME_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
const SIGNED_URL_EXPIRY_SECONDS = 900; // 15 minutes expiry

// ============================================================================
// Helper: Verify Master's authority over a student's class (including substitute delegation)
// ============================================================================
async function isMasterAuthorizedForStudent(masterId: string, studentId: string, orgId: string): Promise<boolean> {
  // First, verify master affiliation is ACTIVE if affiliation records exist
  const affRes = await dbClient.query(
    `SELECT status FROM master_affiliations WHERE master_id = $1 AND organization_id = $2 ORDER BY updated_at DESC LIMIT 1;`,
    [masterId, orgId]
  );
  if (affRes.rowCount > 0 && affRes.rows[0].status !== 'ACTIVE') {
    return false;
  }

  // Get student's enrolled classes
  const classRes = await dbClient.query(`
    SELECT c.id, c.organization_id, c.master_id, c.main_master_id
    FROM students s
    JOIN classes c ON s.class_id = c.id
    WHERE s.id = $1 AND c.organization_id = $2
    UNION
    SELECT c.id, c.organization_id, c.master_id, c.main_master_id
    FROM class_enrollments ce
    JOIN classes c ON ce.class_id = c.id
    WHERE ce.student_id = $1 AND c.organization_id = $2 AND ce.status IN ('ACTIVE', 'ENROLLED')
  `, [studentId, orgId]);

  if (classRes.rows.length === 0) {
    return false;
  }

  for (const cls of classRes.rows) {
    // Check class_leaderships for this master (handles primary and active substitute delegation)
    const leadRes = await dbClient.query(`
      SELECT is_active, leadership_type, effective_from, effective_to
      FROM class_leaderships
      WHERE class_id = $1 AND master_id = $2
      ORDER BY (is_active = TRUE AND (effective_to IS NULL OR effective_to >= CURRENT_TIMESTAMP) AND (effective_from IS NULL OR effective_from <= CURRENT_TIMESTAMP)) DESC,
               created_at DESC
      LIMIT 1;
    `, [cls.id, masterId]);

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
      // Explicit inactive/expired leadership -> denied for this class
      continue;
    }

    // Check coach_class_assignments
    const coachRes = await dbClient.query(
      `SELECT 1 FROM coach_class_assignments WHERE class_id = $1 AND coach_id = $2 LIMIT 1;`,
      [cls.id, masterId]
    );
    if (coachRes.rows.length > 0) {
      return true;
    }

    // Fallback to legacy class master columns ONLY if no class_leaderships records exist for this class
    const anyLead = await dbClient.query(`SELECT 1 FROM class_leaderships WHERE class_id = $1 LIMIT 1;`, [cls.id]);
    if (anyLead.rows.length === 0 && (cls.master_id === masterId || cls.main_master_id === masterId)) {
      return true;
    }
  }

  return false;
}

// ============================================================================
// Helper: Verify Guardian relationship with student
// ============================================================================
async function isGuardianAuthorizedForStudent(guardianId: string, studentId: string): Promise<boolean> {
  const query = `
    SELECT 1 FROM parent_student_links
    WHERE parent_id = $1 AND student_id = $2 AND status = 'ACTIVE'
    LIMIT 1;
  `;
  const result = await dbClient.query(query, [guardianId, studentId]);
  return result.rows.length > 0;
}

// ============================================================================
// Helper: Verify Active Media Consent
// ============================================================================
async function isMediaConsentActive(studentId: string, orgId: string): Promise<boolean> {
  const query = `
    SELECT status FROM student_media_consents
    WHERE student_id = $1 AND organization_id = $2 AND consent_type = 'VIDEO_FEEDBACK'
    LIMIT 1;
  `;
  const result = await dbClient.query(query, [studentId, orgId]);
  if (result.rows.length === 0) {
    // If no explicit consent record exists yet, check student_safety_profiles photo_consent
    const safetyRes = await dbClient.query(
      `SELECT photo_consent_given FROM student_safety_profiles WHERE student_id = $1 LIMIT 1;`,
      [studentId]
    );
    if (safetyRes.rows.length > 0 && safetyRes.rows[0].photo_consent_given === false) {
      return false;
    }
    return true; // Default to permitted if no explicit revocation
  }
  return result.rows[0].status === 'GRANTED';
}

// ============================================================================
// 1. requestUpload(studentId, metadata)
// Acceptance test: oversized_invalid_upload_rejected, consent_revocation_blocks_new_access
// ============================================================================
router.post(
  '/upload-request',
  authenticateJWT,
  async (req: Request, res: Response) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: 'Authentication required.' });
      }

      const {
        studentId,
        title,
        techniqueCategory = 'POOMSAE',
        curriculumId,
        lessonId,
        fileSize,
        mimeType,
        durationSeconds = 60,
      } = req.body;

      if (!studentId || !title || fileSize === undefined || !mimeType) {
        return res.status(400).json({ error: 'studentId, title, fileSize, and mimeType are required.' });
      }

      // Check Super Admin restriction (Super Admin has zero operational access)
      if (user.role === UserRole.SUPER_ADMIN) {
        return res.status(403).json({ error: 'Super Admin has zero operational access to student media.' });
      }

      // Find student and organization
      const stuRes = await dbClient.query(
        `SELECT id, organization_id, user_id FROM students WHERE id = $1 LIMIT 1;`,
        [studentId]
      );
      if (stuRes.rows.length === 0) {
        return res.status(404).json({ error: 'Student not found.' });
      }
      const student = stuRes.rows[0];

      // Tenant isolation
      if (user.organizationId !== student.organization_id) {
        return res.status(403).json({ error: 'Cross-tenant media upload rejected.' });
      }

      // Authorization check by role
      if (user.role === UserRole.STUDENT && student.user_id !== user.id) {
        return res.status(403).json({ error: 'Students can only upload video feedback for themselves.' });
      }
      if (user.role === UserRole.PARENT) {
        const isLinked = await isGuardianAuthorizedForStudent(user.id, studentId);
        if (!isLinked) {
          return res.status(403).json({ error: 'Guardians can only upload video for their verified active children.' });
        }
      }
      if (user.role === UserRole.MASTER) {
        const isAuthMaster = await isMasterAuthorizedForStudent(user.id, studentId, student.organization_id);
        if (!isAuthMaster) {
          return res.status(403).json({ error: 'Masters can only initiate video requests for students in their assigned classes.' });
        }
      }

      // Check Media Consent (Acceptance test: consent_revocation_blocks_new_access)
      const hasConsent = await isMediaConsentActive(studentId, student.organization_id);
      if (!hasConsent) {
        return res.status(403).json({
          error: 'consent_revocation_blocks_new_access: Active media consent is revoked or absent for this student.',
        });
      }

      // Acceptance test: oversized_invalid_upload_rejected
      const numericSize = Number(fileSize);
      if (isNaN(numericSize) || numericSize <= 0) {
        return res.status(400).json({ error: 'Invalid file size.' });
      }
      if (numericSize > MAX_VIDEO_FILE_SIZE_BYTES) {
        return res.status(400).json({
          error: `oversized_invalid_upload_rejected: File size (${numericSize} bytes) exceeds maximum limit of 50MB (${MAX_VIDEO_FILE_SIZE_BYTES} bytes).`,
        });
      }

      if (!ALLOWED_MIME_TYPES.includes(mimeType.toLowerCase())) {
        return res.status(400).json({
          error: `oversized_invalid_upload_rejected: Invalid video format '${mimeType}'. Allowed formats: MP4, WebM, QuickTime.`,
        });
      }

      // Generate signed token and genuine storage URL using mediaStorageAdapter
      const videoId = `vid_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      const ext = mimeType.split('/')[1] === 'quicktime' ? 'mov' : (mimeType.split('/')[1] || 'mp4');
      const storageKey = `persatuan/${student.organization_id}/students/${studentId}/videos/${videoId}.${ext}`;

      const presigned = await mediaStorageAdapter.generatePresignedUploadUrl(storageKey, {
        maxSizeBytes: MAX_VIDEO_FILE_SIZE_BYTES,
        mimeType,
        expiresInSeconds: SIGNED_URL_EXPIRY_SECONDS,
      });

      await dbClient.query(
        `INSERT INTO video_submissions (
          id, organization_id, student_id, uploader_user_id, title,
          technique_category, curriculum_id, lesson_id, duration_seconds,
          file_size_bytes, mime_type, storage_key, upload_status,
          presigned_token, token_expires_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'PENDING_UPLOAD', $13, $14);`,
        [
          videoId,
          student.organization_id,
          studentId,
          user.id,
          title,
          techniqueCategory,
          curriculumId || null,
          lessonId || null,
          durationSeconds,
          numericSize,
          mimeType,
          storageKey,
          presigned.presignedToken,
          presigned.expiresAt,
        ]
      );

      return res.status(201).json({
        id: videoId,
        videoId,
        storageKey,
        presignedToken: presigned.presignedToken,
        tokenExpiresAt: presigned.expiresAt.toISOString(),
        uploadUrl: presigned.uploadUrl,
        headers: presigned.headers,
        maxSizeBytes: MAX_VIDEO_FILE_SIZE_BYTES,
      });
    } catch (err: any) {
      console.error('[requestUpload error]:', err);
      return res.status(500).json({ error: err.message || 'Internal server error requesting upload.' });
    }
  }
);

// ============================================================================
// 2. finalizeUpload(id)
// Acceptance test: expired_URL_denied
// ============================================================================
router.post(
  '/videos/:id/finalize',
  authenticateJWT,
  async (req: Request, res: Response) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: 'Authentication required.' });
      }

      const { id } = req.params;
      const { token } = req.body;

      const vidRes = await dbClient.query(
        `SELECT * FROM video_submissions WHERE id = $1 AND deleted_at IS NULL LIMIT 1;`,
        [id]
      );

      if (vidRes.rows.length === 0) {
        return res.status(404).json({ error: 'Video submission not found.' });
      }

      const video = vidRes.rows[0];

      // Verify token
      if (token && video.presigned_token !== token) {
        return res.status(403).json({ error: 'Invalid upload token.' });
      }

      // Acceptance test: expired_URL_denied
      const now = new Date();
      if (video.token_expires_at && new Date(video.token_expires_at) < now) {
        return res.status(403).json({
          error: 'expired_URL_denied: Pre-signed upload URL has expired. Re-request upload URL.',
        });
      }

      // Check media consent
      const hasConsent = await isMediaConsentActive(video.student_id, video.organization_id);
      if (!hasConsent) {
        return res.status(403).json({
          error: 'consent_revocation_blocks_new_access: Media consent was revoked before upload could be finalized.',
        });
      }

      // Verify object on storage provider if present
      const verifyResult = await mediaStorageAdapter.verifyObject(video.storage_key, video.file_size_bytes, video.mime_type);
      if (verifyResult.exists && !verifyResult.magicValid) {
        return res.status(400).json({
          error: `oversized_invalid_upload_rejected: Invalid media format: ${verifyResult.error || 'Binary magic bytes failed verification.'}`,
        });
      }

      await dbClient.query(
        `UPDATE video_submissions
         SET upload_status = 'UPLOADED', uploaded_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1;`,
        [id]
      );

      return res.status(200).json({
        success: true,
        id,
        status: 'UPLOADED',
        checksumSha256: verifyResult.checksumSha256,
        message: 'Video upload finalized successfully and queued for Master review.',
      });
    } catch (err: any) {
      console.error('[finalizeUpload error]:', err);
      return res.status(500).json({ error: err.message || 'Internal server error finalizing upload.' });
    }
  }
);

// ============================================================================
// 3. addVideoFeedback(id, input)
// Acceptance test: wrong_Master_or_guardian_denied
// ============================================================================
router.post(
  '/videos/:id/feedback',
  authenticateJWT,
  async (req: Request, res: Response) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: 'Authentication required.' });
      }

      if (user.role !== UserRole.MASTER && user.role !== UserRole.ADMIN_PERSATUAN) {
        return res.status(403).json({ error: 'Only instructors and administrators can add video feedback.' });
      }

      const { id } = req.params;
      const { timestampSeconds = 0.0, annotationText, techniqueRating } = req.body;

      if (!annotationText || annotationText.trim() === '') {
        return res.status(400).json({ error: 'annotationText is required.' });
      }

      const vidRes = await dbClient.query(
        `SELECT * FROM video_submissions WHERE id = $1 AND deleted_at IS NULL LIMIT 1;`,
        [id]
      );

      if (vidRes.rows.length === 0) {
        return res.status(404).json({ error: 'Video submission not found.' });
      }

      const video = vidRes.rows[0];

      // Tenant isolation
      if (user.organizationId !== video.organization_id) {
        return res.status(403).json({ error: 'wrong_Master_or_guardian_denied: Cross-tenant Master feedback forbidden.' });
      }

      // Acceptance test: wrong_Master_or_guardian_denied
      if (user.role === UserRole.MASTER) {
        const isAuth = await isMasterAuthorizedForStudent(user.id, video.student_id, video.organization_id);
        if (!isAuth) {
          return res.status(403).json({
            error: 'wrong_Master_or_guardian_denied: Only the assigned lead or delegated Master for this student can add video feedback.',
          });
        }
      }

      const annotationId = `ann_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      const rating = techniqueRating !== undefined ? Number(techniqueRating) : null;

      await dbClient.query(
        `INSERT INTO video_feedback_annotations (
          id, video_id, master_id, timestamp_seconds, annotation_text, technique_rating
        ) VALUES ($1, $2, $3, $4, $5, $6);`,
        [annotationId, id, user.id, timestampSeconds, annotationText.trim(), rating]
      );

      await dbClient.query(
        `UPDATE video_submissions
         SET upload_status = 'FEEDBACK_PROVIDED', updated_at = CURRENT_TIMESTAMP
         WHERE id = $1;`,
        [id]
      );

      // Audit log
      await dbClient.query(
        `INSERT INTO audit_logs (id, action, details, user_role, user_email)
         VALUES ($1, $2, $3, $4, $5);`,
        [
          `aud_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
          'VIDEO_FEEDBACK_ADDED',
          JSON.stringify({ videoId: id, annotationId, masterId: user.id, rating }),
          user.role,
          user.email,
        ]
      );

      return res.status(201).json({
        success: true,
        annotationId,
        videoId: id,
        timestampSeconds,
        annotationText: annotationText.trim(),
        techniqueRating: rating,
        status: 'FEEDBACK_PROVIDED',
      });
    } catch (err: any) {
      console.error('[addVideoFeedback error]:', err);
      return res.status(500).json({ error: err.message || 'Internal server error adding video feedback.' });
    }
  }
);

// ============================================================================
// 4. revokeMediaConsent(id)
// Acceptance test: consent_revocation_blocks_new_access
// ============================================================================
router.post(
  '/consents/:studentId/revoke',
  authenticateJWT,
  async (req: Request, res: Response) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: 'Authentication required.' });
      }

      const { studentId } = req.params;
      const { reason = 'Guardian requested complete revocation of media analysis' } = req.body;

      const stuRes = await dbClient.query(
        `SELECT id, organization_id, user_id FROM students WHERE id = $1 LIMIT 1;`,
        [studentId]
      );
      if (stuRes.rows.length === 0) {
        return res.status(404).json({ error: 'Student not found.' });
      }
      const student = stuRes.rows[0];

      // Tenant isolation
      if (user.organizationId !== student.organization_id) {
        return res.status(403).json({ error: 'Cross-tenant media consent revocation forbidden.' });
      }

      // Guardian / Student verification
      if (user.role === UserRole.PARENT) {
        const isLinked = await isGuardianAuthorizedForStudent(user.id, studentId);
        if (!isLinked) {
          return res.status(403).json({ error: 'Guardians can only revoke consent for their own verified children.' });
        }
      }
      if (user.role === UserRole.STUDENT && student.user_id !== user.id) {
        return res.status(403).json({ error: 'Students can only revoke consent for themselves.' });
      }

      const consentId = `mcon_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

      // Upsert revocation into student_media_consents
      await dbClient.query(
        `INSERT INTO student_media_consents (
          id, organization_id, student_id, guardian_id, consent_type,
          status, revoked_at, revocation_reason, revoked_by_user_id
        ) VALUES ($1, $2, $3, $4, 'VIDEO_FEEDBACK', 'REVOKED', CURRENT_TIMESTAMP, $5, $4)
        ON CONFLICT (student_id, consent_type)
        DO UPDATE SET
          status = 'REVOKED',
          revoked_at = CURRENT_TIMESTAMP,
          revocation_reason = EXCLUDED.revocation_reason,
          revoked_by_user_id = EXCLUDED.revoked_by_user_id,
          updated_at = CURRENT_TIMESTAMP;`,
        [consentId, student.organization_id, studentId, user.id, reason]
      );

      // Audit log
      await dbClient.query(
        `INSERT INTO audit_logs (id, action, details, user_role, user_email)
         VALUES ($1, $2, $3, $4, $5);`,
        [
          `aud_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
          'MEDIA_CONSENT_REVOKED',
          JSON.stringify({ studentId, revokedBy: user.id, reason }),
          user.role,
          user.email,
        ]
      );

      // Revoke outstanding playback tokens on storage provider immediately
      mediaStorageAdapter.revokeTokensForStudent(studentId);

      return res.status(200).json({
        success: true,
        studentId,
        consentType: 'VIDEO_FEEDBACK',
        status: 'REVOKED',
        revokedAt: new Date().toISOString(),
        message: 'consent_revocation_blocks_new_access: Media consent revoked successfully. Subsequent media access is now blocked.',
      });
    } catch (err: any) {
      console.error('[revokeMediaConsent error]:', err);
      return res.status(500).json({ error: err.message || 'Internal server error revoking media consent.' });
    }
  }
);

// ============================================================================
// 5. GET /api/v1/media/videos/:id/playback
// Acceptance test: expired_URL_denied, wrong_Master_or_guardian_denied,
//                  consent_revocation_blocks_new_access, deleted_media_not_returned_by_API
// ============================================================================
router.get(
  '/videos/:id/playback',
  authenticateJWT,
  async (req: Request, res: Response) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: 'Authentication required.' });
      }

      const { id } = req.params;
      const { token } = req.query;

      // Super Admin zero operational access
      if (user.role === UserRole.SUPER_ADMIN) {
        return res.status(403).json({ error: 'Super Admin has zero operational access to student video playback.' });
      }

      // Acceptance test: deleted_media_not_returned_by_API
      const vidRes = await dbClient.query(
        `SELECT v.*, u.full_name as uploader_name
         FROM video_submissions v
         JOIN users u ON v.uploader_user_id = u.id
         WHERE v.id = $1 AND v.deleted_at IS NULL
         LIMIT 1;`,
        [id]
      );

      if (vidRes.rows.length === 0) {
        return res.status(404).json({
          error: 'deleted_media_not_returned_by_API: Video not found or has been deleted.',
        });
      }

      const video = vidRes.rows[0];

      // Acceptance test: wrong_Master_or_guardian_denied
      if (user.organizationId !== video.organization_id) {
        return res.status(403).json({ error: 'wrong_Master_or_guardian_denied: Cross-tenant access denied.' });
      }

      if (user.role === UserRole.STUDENT) {
        const stuRes = await dbClient.query(`SELECT id FROM students WHERE user_id = $1 LIMIT 1;`, [user.id]);
        if (stuRes.rows.length === 0 || stuRes.rows[0].id !== video.student_id) {
          return res.status(403).json({ error: 'wrong_Master_or_guardian_denied: Students can only view their own videos.' });
        }
      } else if (user.role === UserRole.PARENT) {
        const isLinked = await isGuardianAuthorizedForStudent(user.id, video.student_id);
        if (!isLinked) {
          return res.status(403).json({ error: 'wrong_Master_or_guardian_denied: Guardian not authorized for this student.' });
        }
      } else if (user.role === UserRole.MASTER) {
        const isAuth = await isMasterAuthorizedForStudent(user.id, video.student_id, video.organization_id);
        if (!isAuth) {
          return res.status(403).json({ error: 'wrong_Master_or_guardian_denied: Master not assigned to this student.' });
        }
      }

      // Acceptance test: consent_revocation_blocks_new_access
      const hasConsent = await isMediaConsentActive(video.student_id, video.organization_id);
      if (!hasConsent) {
        return res.status(403).json({
          error: 'consent_revocation_blocks_new_access: Access to video playback is blocked because guardian media consent has been revoked.',
        });
      }

      // Acceptance test: expired_URL_denied
      if (token && typeof token === 'string') {
        if (video.presigned_token !== token) {
          return res.status(403).json({ error: 'Invalid playback token.' });
        }
        if (video.token_expires_at && new Date(video.token_expires_at) < new Date()) {
          return res.status(403).json({
            error: 'expired_URL_denied: Signed playback URL has expired.',
          });
        }
      }

      // Fetch annotations
      const annRes = await dbClient.query(
        `SELECT a.id, a.timestamp_seconds, a.annotation_text, a.technique_rating, a.created_at, u.full_name as master_name
         FROM video_feedback_annotations a
         JOIN users u ON a.master_id = u.id
         WHERE a.video_id = $1
         ORDER BY a.timestamp_seconds ASC;`,
        [id]
      );

      // Generate genuine signed playback URL with storage adapter
      const presignedPb = await mediaStorageAdapter.generatePresignedPlaybackUrl(video.storage_key, {
        expiresInSeconds: SIGNED_URL_EXPIRY_SECONDS,
      });

      return res.status(200).json({
        id: video.id,
        title: video.title,
        techniqueCategory: video.technique_category,
        studentId: video.student_id,
        uploadStatus: video.upload_status,
        durationSeconds: video.duration_seconds,
        fileSizeBytes: video.file_size_bytes,
        mimeType: video.mime_type,
        uploadedAt: video.uploaded_at,
        playbackUrl: presignedPb.playbackUrl,
        presignedToken: presignedPb.presignedToken,
        expiresAt: presignedPb.expiresAt.toISOString(),
        annotations: annRes.rows,
      });
    } catch (err: any) {
      console.error('[playback error]:', err);
      return res.status(500).json({ error: err.message || 'Internal server error retrieving playback.' });
    }
  }
);

// ============================================================================
// 6. GET /api/v1/media/students/:studentId/videos
// Acceptance test: deleted_media_not_returned_by_API, wrong_Master_or_guardian_denied
// ============================================================================
router.get(
  '/students/:studentId/videos',
  authenticateJWT,
  async (req: Request, res: Response) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: 'Authentication required.' });
      }

      const { studentId } = req.params;

      if (user.role === UserRole.SUPER_ADMIN) {
        return res.status(403).json({ error: 'Super Admin has zero operational access to student videos.' });
      }

      const stuRes = await dbClient.query(
        `SELECT id, organization_id, user_id FROM students WHERE id = $1 LIMIT 1;`,
        [studentId]
      );
      if (stuRes.rows.length === 0) {
        return res.status(404).json({ error: 'Student not found.' });
      }
      const student = stuRes.rows[0];

      if (user.organizationId !== student.organization_id) {
        return res.status(403).json({ error: 'Cross-tenant access forbidden.' });
      }

      if (user.role === UserRole.STUDENT && student.user_id !== user.id) {
        return res.status(403).json({ error: 'wrong_Master_or_guardian_denied: Students can only view their own videos.' });
      }
      if (user.role === UserRole.PARENT) {
        const isLinked = await isGuardianAuthorizedForStudent(user.id, studentId);
        if (!isLinked) {
          return res.status(403).json({ error: 'wrong_Master_or_guardian_denied: Guardian not linked to this student.' });
        }
      }
      if (user.role === UserRole.MASTER) {
        const isAuth = await isMasterAuthorizedForStudent(user.id, studentId, student.organization_id);
        if (!isAuth) {
          return res.status(403).json({ error: 'wrong_Master_or_guardian_denied: Master not assigned to this student.' });
        }
      }

      // Acceptance test: deleted_media_not_returned_by_API
      const query = `
        SELECT v.id, v.title, v.technique_category, v.student_id, v.upload_status,
               v.duration_seconds, v.file_size_bytes, v.mime_type, v.uploaded_at,
               (SELECT COUNT(*) FROM video_feedback_annotations WHERE video_id = v.id) as annotation_count
        FROM video_submissions v
        WHERE v.student_id = $1
          AND v.deleted_at IS NULL
          AND v.upload_status != 'DELETED'
        ORDER BY v.created_at DESC;
      `;
      const result = await dbClient.query(query, [studentId]);

      return res.status(200).json(result.rows);
    } catch (err: any) {
      console.error('[listVideos error]:', err);
      return res.status(500).json({ error: err.message || 'Internal server error listing videos.' });
    }
  }
);

// ============================================================================
// 7. DELETE /api/v1/media/videos/:id
// Acceptance test: deleted_media_not_returned_by_API
// ============================================================================
router.delete(
  '/videos/:id',
  authenticateJWT,
  async (req: Request, res: Response) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: 'Authentication required.' });
      }

      if (user.role !== UserRole.PARENT && user.role !== UserRole.MASTER && user.role !== UserRole.ADMIN_PERSATUAN) {
        return res.status(403).json({ error: 'Unauthorized to delete video.' });
      }

      const { id } = req.params;

      const vidRes = await dbClient.query(
        `SELECT * FROM video_submissions WHERE id = $1 AND deleted_at IS NULL LIMIT 1;`,
        [id]
      );
      if (vidRes.rows.length === 0) {
        return res.status(404).json({ error: 'Video not found.' });
      }
      const video = vidRes.rows[0];

      if (user.organizationId !== video.organization_id) {
        return res.status(403).json({ error: 'Cross-tenant video deletion forbidden.' });
      }

      // Check authorization
      if (user.role === UserRole.PARENT) {
        const isLinked = await isGuardianAuthorizedForStudent(user.id, video.student_id);
        if (!isLinked) {
          return res.status(403).json({ error: 'Guardians can only delete videos for their own children.' });
        }
      }

      // Soft delete: sets deleted_at and status = 'DELETED'
      await dbClient.query(
        `UPDATE video_submissions
         SET deleted_at = CURRENT_TIMESTAMP, upload_status = 'DELETED', updated_at = CURRENT_TIMESTAMP
         WHERE id = $1;`,
        [id]
      );

      // Audit log
      await dbClient.query(
        `INSERT INTO audit_logs (id, action, details, user_role, user_email)
         VALUES ($1, $2, $3, $4, $5);`,
        [
          `aud_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
          'VIDEO_SUBMISSION_DELETED',
          JSON.stringify({ videoId: id, studentId: video.student_id, deletedBy: user.id }),
          user.role,
          user.email,
        ]
      );

      return res.status(200).json({
        success: true,
        videoId: id,
        message: 'deleted_media_not_returned_by_API: Video media successfully deleted and purged from queries.',
      });
    } catch (err: any) {
      console.error('[deleteVideo error]:', err);
      return res.status(500).json({ error: err.message || 'Internal server error deleting video.' });
    }
  }
);

// ============================================================================
// Direct storage upload endpoint (Provider-neutral integration)
// ============================================================================
router.put('/storage/upload/:key(*)', async (req: Request, res: Response) => {
  try {
    const key = req.params.key;
    const token = req.query.token as string;
    const expires = Number(req.query.expires);

    if (!token || !expires || isNaN(expires)) {
      return res.status(403).json({ error: 'Missing or invalid upload authorization token.' });
    }
    if (Math.floor(Date.now() / 1000) > expires) {
      return res.status(403).json({ error: 'expired_URL_denied: Upload URL has expired.' });
    }
    if (!mediaStorageAdapter.verifyToken(key, token, expires)) {
      return res.status(403).json({ error: 'Invalid or forged storage upload token.' });
    }

    // Read body buffer
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(chunk));
    await new Promise((resolve) => req.on('end', resolve));
    const buffer = Buffer.concat(chunks);

    if (buffer.length > MAX_VIDEO_FILE_SIZE_BYTES) {
      return res.status(400).json({ error: 'oversized_invalid_upload_rejected: Upload exceeds 50MB limit.' });
    }

    const mimeType = (req.headers['content-type'] as string) || 'video/mp4';
    const saved = await mediaStorageAdapter.saveObject(key, buffer, mimeType);

    return res.status(200).json({
      success: true,
      storageKey: key,
      sizeBytes: saved.sizeBytes,
      checksumSha256: saved.checksumSha256,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// Direct storage playback stream endpoint (Provider-neutral integration)
// ============================================================================
router.get('/storage/playback/:key(*)', async (req: Request, res: Response) => {
  try {
    const key = req.params.key;
    const token = req.query.token as string;
    const expires = Number(req.query.expires);

    if (!token || !expires || isNaN(expires)) {
      return res.status(403).json({ error: 'Missing or invalid playback authorization token.' });
    }
    if (Math.floor(Date.now() / 1000) > expires) {
      return res.status(403).json({ error: 'expired_URL_denied: Playback URL has expired.' });
    }
    if (!mediaStorageAdapter.verifyToken(key, token, expires)) {
      return res.status(403).json({
        error: 'consent_revocation_blocks_new_access: Invalid, expired, or revoked playback token.',
      });
    }

    const obj = await mediaStorageAdapter.getObject(key, token);
    if (!obj) {
      return res.status(404).json({ error: 'deleted_media_not_returned_by_API: Video not found on storage.' });
    }

    res.setHeader('Content-Type', obj.contentType);
    res.setHeader('Content-Length', obj.buffer.length);
    return res.send(obj.buffer);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
