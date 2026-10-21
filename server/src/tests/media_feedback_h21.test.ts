import assert from 'node:assert/strict';
import http from 'node:http';
import app from '../app';
import { dbClient } from '../db/client';
import { generateAuthToken } from '../security/crypto';
import { UserRole } from '../security/rbac';

function makeRequest(
  server: http.Server,
  method: string,
  path: string,
  body?: any,
  token?: string
): Promise<{ status: number; data: any; rawBody: string }> {
  return new Promise((resolve, reject) => {
    const addr = server.address();
    if (!addr || typeof addr === 'string') {
      return reject(new Error('Server not listening'));
    }

    const payload = body ? JSON.stringify(body) : '';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    if (payload) {
      headers['Content-Length'] = Buffer.byteLength(payload).toString();
    }

    const req = http.request(
      {
        host: '127.0.0.1',
        port: addr.port,
        path: `/api/v1${path}`,
        method,
        headers,
      },
      (res) => {
        let resData = '';
        res.on('data', (chunk) => (resData += chunk));
        res.on('end', () => {
          let parsed: any;
          try {
            parsed = JSON.parse(resData);
          } catch {
            parsed = resData;
          }
          resolve({ status: res.statusCode || 500, data: parsed, rawBody: resData });
        });
      }
    );

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runTests() {
  console.log('🥋 Starting Task H21: Private Video Feedback Integration Tests...');
  await dbClient.init();

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));

  try {
    const orgIdA = 'org_media_alpha';
    const orgIdB = 'org_media_beta';
    const timestamp = Date.now();

    // 1. Seed Organizations
    await dbClient.query(
      `INSERT INTO organizations (id, name, state, martial_art_style, master_name, phone, email, status)
       VALUES ($1, 'Persatuan Silat Gayong Media', 'Selangor', 'Silat Seni Gayong', 'Master Halim', '+60123456791', $3, 'ACTIVE'),
              ($2, 'Persatuan Taekwondo Media', 'Perak', 'WT Taekwondo', 'Master Tan', '+60123456792', $4, 'ACTIVE')
       ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE';`,
      [orgIdA, orgIdB, `silat-media-${timestamp}@test.com`, `taekwondo-media-${timestamp}@test.com`]
    );

    // 2. Seed Users
    const superAdminId = `usr_sa_${timestamp}`;
    const adminAId = `usr_adm_a_${timestamp}`;
    const masterAssignedId = `usr_mst_lead_${timestamp}`;
    const masterUnassignedId = `usr_mst_unassigned_${timestamp}`;
    const masterOrgBId = `usr_mst_orgb_${timestamp}`;
    const parentValidId = `usr_par_valid_${timestamp}`;
    const parentUnlinkedId = `usr_par_unlinked_${timestamp}`;
    const studentUserId = `usr_stu_${timestamp}`;

    // Insert user records
    const usersToInsert = [
      { id: superAdminId, email: `sa_${timestamp}@test.com`, role: UserRole.SUPER_ADMIN, org: null },
      { id: adminAId, email: `admin_${timestamp}@test.com`, role: UserRole.ADMIN_PERSATUAN, org: orgIdA },
      { id: masterAssignedId, email: `lead_${timestamp}@test.com`, role: UserRole.MASTER, org: orgIdA },
      { id: masterUnassignedId, email: `unassigned_${timestamp}@test.com`, role: UserRole.MASTER, org: orgIdA },
      { id: masterOrgBId, email: `orgb_${timestamp}@test.com`, role: UserRole.MASTER, org: orgIdB },
      { id: parentValidId, email: `parent_ok_${timestamp}@test.com`, role: UserRole.PARENT, org: orgIdA },
      { id: parentUnlinkedId, email: `parent_unlinked_${timestamp}@test.com`, role: UserRole.PARENT, org: orgIdA },
      { id: studentUserId, email: `student_${timestamp}@test.com`, role: UserRole.STUDENT, org: orgIdA },
    ];

    for (const u of usersToInsert) {
      await dbClient.query(
        `INSERT INTO users (id, email, password_hash, full_name, role, organization_id, status)
         VALUES ($1, $2, 'hash', $2, $3, $4, 'ACTIVE')
         ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE';`,
        [u.id, u.email, u.role, u.org]
      );
    }

    // 3. Seed Class and Student
    const classId = `cls_h21_${timestamp}`;
    await dbClient.query(
      `INSERT INTO classes (id, organization_id, master_id, name, schedule, location, status)
       VALUES ($1, $2, $3, 'Gayong Jurus Remaja', 'Sat 10am', 'Gelanggang Utama', 'ACTIVE')
       ON CONFLICT (id) DO NOTHING;`,
      [classId, orgIdA, masterAssignedId]
    );

    // Assign Master to Class
    await dbClient.query(
      `INSERT INTO coach_class_assignments (coach_id, class_id, is_main_master)
       VALUES ($1, $2, TRUE)
       ON CONFLICT (coach_id, class_id) DO NOTHING;`,
      [masterAssignedId, classId]
    );

    const studentId = `stu_h21_${timestamp}`;
    await dbClient.query(
      `INSERT INTO students (id, organization_id, user_id, class_id, full_name, ic_number, status)
       VALUES ($1, $2, $3, $4, 'Aiman bin Razlan', '091010-10-1234', 'ACTIVE')
       ON CONFLICT (id) DO NOTHING;`,
      [studentId, orgIdA, studentUserId, classId]
    );

    // Link valid guardian in parent_student_links
    await dbClient.query(
      `INSERT INTO parent_student_links (id, parent_id, student_id, status, student_approved, master_approved, admin_approved)
       VALUES ($1, $2, $3, 'ACTIVE', TRUE, TRUE, TRUE)
       ON CONFLICT (parent_id, student_id) DO UPDATE SET status = 'ACTIVE', student_approved = TRUE, master_approved = TRUE, admin_approved = TRUE;`,
      [`psl_${timestamp}`, parentValidId, studentId]
    );

    // Seed initial active media consent
    await dbClient.query(
      `INSERT INTO student_media_consents (id, organization_id, student_id, guardian_id, consent_type, status)
       VALUES ($1, $2, $3, $4, 'VIDEO_FEEDBACK', 'GRANTED')
       ON CONFLICT (student_id, consent_type) DO UPDATE SET status = 'GRANTED';`,
      [`mcon_${timestamp}`, orgIdA, studentId, parentValidId]
    );

    // Auth Tokens
    const tokenStudent = generateAuthToken({ id: studentUserId, email: `student_${timestamp}@test.com`, role: UserRole.STUDENT, organizationId: orgIdA });
    const tokenParentValid = generateAuthToken({ id: parentValidId, email: `parent_ok_${timestamp}@test.com`, role: UserRole.PARENT, organizationId: orgIdA });
    const tokenParentUnlinked = generateAuthToken({ id: parentUnlinkedId, email: `parent_unlinked_${timestamp}@test.com`, role: UserRole.PARENT, organizationId: orgIdA });
    const tokenMasterAssigned = generateAuthToken({ id: masterAssignedId, email: `lead_${timestamp}@test.com`, role: UserRole.MASTER, organizationId: orgIdA });
    const tokenMasterUnassigned = generateAuthToken({ id: masterUnassignedId, email: `unassigned_${timestamp}@test.com`, role: UserRole.MASTER, organizationId: orgIdA });
    const tokenMasterOrgB = generateAuthToken({ id: masterOrgBId, email: `orgb_${timestamp}@test.com`, role: UserRole.MASTER, organizationId: orgIdB });
    const tokenSuperAdmin = generateAuthToken({ id: superAdminId, email: `sa_${timestamp}@test.com`, role: UserRole.SUPER_ADMIN });

    // ========================================================================
    // Acceptance Test 1: oversized_invalid_upload_rejected
    // ========================================================================
    console.log('\n--- 1. Acceptance Test: oversized_invalid_upload_rejected ---');
    // A: File size exceeds 50MB (e.g. 55MB)
    const resOversized = await makeRequest(
      server,
      'POST',
      '/media/upload-request',
      {
        studentId,
        title: 'Langkah Satu Gayong HD',
        fileSize: 55 * 1024 * 1024, // 55 MB
        mimeType: 'video/mp4',
      },
      tokenParentValid
    );
    assert.equal(resOversized.status, 400, 'Expected 400 for oversized video');
    assert.ok(
      resOversized.data.error.includes('oversized_invalid_upload_rejected'),
      'Error message must reference oversized_invalid_upload_rejected'
    );
    console.log('✅ Oversized upload rejected (> 50MB limit enforced).');

    // B: Invalid mimeType (e.g. image/png or text/html)
    const resInvalidMime = await makeRequest(
      server,
      'POST',
      '/media/upload-request',
      {
        studentId,
        title: 'Syllabus PDF masquerading as video',
        fileSize: 5 * 1024 * 1024,
        mimeType: 'application/pdf',
      },
      tokenParentValid
    );
    assert.equal(resInvalidMime.status, 400, 'Expected 400 for invalid video format');
    assert.ok(
      resInvalidMime.data.error.includes('oversized_invalid_upload_rejected'),
      'Error message must reference oversized_invalid_upload_rejected'
    );
    console.log('✅ Acceptance Test 1 Passed: oversized_invalid_upload_rejected verified.');

    // Create a valid upload request for subsequent tests
    const resValidUpload = await makeRequest(
      server,
      'POST',
      '/media/upload-request',
      {
        studentId,
        title: 'Asas Jurus Gayong - Video 1',
        techniqueCategory: 'POOMSAE',
        fileSize: 12 * 1024 * 1024, // 12 MB
        mimeType: 'video/mp4',
        durationSeconds: 45,
      },
      tokenParentValid
    );
    assert.equal(resValidUpload.status, 201);
    const validVideoId = resValidUpload.data.videoId;
    const validToken = resValidUpload.data.presignedToken;
    assert.ok(validVideoId && validToken);

    // ========================================================================
    // Acceptance Test 2: expired_URL_denied
    // ========================================================================
    console.log('\n--- 2. Acceptance Test: expired_URL_denied ---');
    // Artificially expire the token in database
    await dbClient.query(
      `UPDATE video_submissions SET token_expires_at = CURRENT_TIMESTAMP - INTERVAL '1 hour' WHERE id = $1;`,
      [validVideoId]
    );

    // A: Finalize with expired token should be denied
    const resFinalizeExpired = await makeRequest(
      server,
      'POST',
      `/media/videos/${validVideoId}/finalize`,
      { token: validToken },
      tokenParentValid
    );
    assert.equal(resFinalizeExpired.status, 403, 'Expected 403 for expired token');
    assert.ok(
      resFinalizeExpired.data.error.includes('expired_URL_denied'),
      'Error message must reference expired_URL_denied'
    );
    console.log('✅ Finalize upload with expired URL rejected.');

    // B: Playback with expired token should be denied
    const resPlaybackExpired = await makeRequest(
      server,
      'GET',
      `/media/videos/${validVideoId}/playback?token=${validToken}`,
      undefined,
      tokenParentValid
    );
    assert.equal(resPlaybackExpired.status, 403, 'Expected 403 for playback with expired token');
    assert.ok(
      resPlaybackExpired.data.error.includes('expired_URL_denied'),
      'Error message must reference expired_URL_denied'
    );
    console.log('✅ Acceptance Test 2 Passed: expired_URL_denied verified.');

    // Reset token expiry to future for remaining tests and finalize upload
    await dbClient.query(
      `UPDATE video_submissions SET token_expires_at = CURRENT_TIMESTAMP + INTERVAL '1 hour' WHERE id = $1;`,
      [validVideoId]
    );
    const resFinalizeOk = await makeRequest(
      server,
      'POST',
      `/media/videos/${validVideoId}/finalize`,
      { token: validToken },
      tokenParentValid
    );
    assert.equal(resFinalizeOk.status, 200);
    assert.equal(resFinalizeOk.data.status, 'UPLOADED');

    // ========================================================================
    // Acceptance Test 3: wrong_Master_or_guardian_denied
    // ========================================================================
    console.log('\n--- 3. Acceptance Test: wrong_Master_or_guardian_denied ---');
    // A: Master from different Persatuan (Org B) attempting feedback
    const resOrgBMasterFeedback = await makeRequest(
      server,
      'POST',
      `/media/videos/${validVideoId}/feedback`,
      { annotationText: 'Good form', techniqueRating: 8.5 },
      tokenMasterOrgB
    );
    assert.equal(resOrgBMasterFeedback.status, 403);
    assert.ok(resOrgBMasterFeedback.data.error.includes('wrong_Master_or_guardian_denied'));
    console.log('✅ Cross-tenant Master denied video feedback.');

    // B: Unassigned Master from same Persatuan attempting feedback
    const resUnassignedMasterFeedback = await makeRequest(
      server,
      'POST',
      `/media/videos/${validVideoId}/feedback`,
      { annotationText: 'Needs higher kick', techniqueRating: 7.0 },
      tokenMasterUnassigned
    );
    assert.equal(resUnassignedMasterFeedback.status, 403);
    assert.ok(resUnassignedMasterFeedback.data.error.includes('wrong_Master_or_guardian_denied'));
    console.log('✅ Unassigned same-Persatuan Master denied video feedback.');

    // C: Unlinked guardian attempting playback
    const resUnlinkedGuardianPlayback = await makeRequest(
      server,
      'GET',
      `/media/videos/${validVideoId}/playback`,
      undefined,
      tokenParentUnlinked
    );
    assert.equal(resUnlinkedGuardianPlayback.status, 403);
    assert.ok(resUnlinkedGuardianPlayback.data.error.includes('wrong_Master_or_guardian_denied'));
    console.log('✅ Unlinked guardian denied video playback.');

    // D: Super Admin attempting playback (must have ZERO operational access)
    const resSuperAdminPlayback = await makeRequest(
      server,
      'GET',
      `/media/videos/${validVideoId}/playback`,
      undefined,
      tokenSuperAdmin
    );
    assert.equal(resSuperAdminPlayback.status, 403);
    console.log('✅ Super Admin zero operational access to student video enforced.');

    // E: Authorized assigned Lead Master successfully adds feedback
    const resMasterOkFeedback = await makeRequest(
      server,
      'POST',
      `/media/videos/${validVideoId}/feedback`,
      {
        timestampSeconds: 14.5,
        annotationText: 'Siku rapat dan kekuda 45 darjah kemas. Teruskan latihan.',
        techniqueRating: 9.0,
      },
      tokenMasterAssigned
    );
    assert.equal(resMasterOkFeedback.status, 201);
    assert.equal(resMasterOkFeedback.data.status, 'FEEDBACK_PROVIDED');
    console.log('✅ Authorized assigned Master successfully annotated video.');
    console.log('✅ Acceptance Test 3 Passed: wrong_Master_or_guardian_denied verified.');

    // ========================================================================
    // Acceptance Test 4: consent_revocation_blocks_new_access
    // ========================================================================
    console.log('\n--- 4. Acceptance Test: consent_revocation_blocks_new_access ---');
    // A: Guardian revokes media consent
    const resRevokeConsent = await makeRequest(
      server,
      'POST',
      `/media/consents/${studentId}/revoke`,
      { reason: 'Parent requested deletion and revocation of all video records' },
      tokenParentValid
    );
    assert.equal(resRevokeConsent.status, 200);
    assert.equal(resRevokeConsent.data.status, 'REVOKED');
    assert.ok(resRevokeConsent.data.message.includes('consent_revocation_blocks_new_access'));
    console.log('✅ Media consent revoked by guardian and audited.');

    // B: Subsequent upload request for student must be rejected
    const resUploadAfterRevocation = await makeRequest(
      server,
      'POST',
      '/media/upload-request',
      {
        studentId,
        title: 'New Technique Video',
        fileSize: 10 * 1024 * 1024,
        mimeType: 'video/mp4',
      },
      tokenParentValid
    );
    assert.equal(resUploadAfterRevocation.status, 403);
    assert.ok(
      resUploadAfterRevocation.data.error.includes('consent_revocation_blocks_new_access'),
      'Error message must reference consent_revocation_blocks_new_access'
    );
    console.log('✅ New video upload blocked post-revocation.');

    // C: Subsequent playback attempt must be rejected
    const resPlaybackAfterRevocation = await makeRequest(
      server,
      'GET',
      `/media/videos/${validVideoId}/playback`,
      undefined,
      tokenMasterAssigned
    );
    assert.equal(resPlaybackAfterRevocation.status, 403);
    assert.ok(
      resPlaybackAfterRevocation.data.error.includes('consent_revocation_blocks_new_access'),
      'Error message must reference consent_revocation_blocks_new_access'
    );
    console.log('✅ Playback blocked post-revocation.');
    console.log('✅ Acceptance Test 4 Passed: consent_revocation_blocks_new_access verified.');

    // Restore consent to test deletion criterion
    await dbClient.query(
      `UPDATE student_media_consents SET status = 'GRANTED' WHERE student_id = $1;`,
      [studentId]
    );

    // ========================================================================
    // Acceptance Test 5: deleted_media_not_returned_by_API
    // ========================================================================
    console.log('\n--- 5. Acceptance Test: deleted_media_not_returned_by_API ---');
    // Verify video is in list before deletion
    const resListBefore = await makeRequest(
      server,
      'GET',
      `/media/students/${studentId}/videos`,
      undefined,
      tokenParentValid
    );
    assert.equal(resListBefore.status, 200);
    assert.ok(resListBefore.data.some((v: any) => v.id === validVideoId));

    // Delete the video
    const resDelete = await makeRequest(
      server,
      'DELETE',
      `/media/videos/${validVideoId}`,
      undefined,
      tokenParentValid
    );
    assert.equal(resDelete.status, 200);
    assert.ok(resDelete.data.message.includes('deleted_media_not_returned_by_API'));
    console.log('✅ Video soft-deleted.');

    // A: List query strictly omits deleted video
    const resListAfter = await makeRequest(
      server,
      'GET',
      `/media/students/${studentId}/videos`,
      undefined,
      tokenParentValid
    );
    assert.equal(resListAfter.status, 200);
    assert.ok(
      !resListAfter.data.some((v: any) => v.id === validVideoId),
      'Deleted video must NOT be returned in list query'
    );
    console.log('✅ Deleted video omitted from student videos query.');

    // B: Direct playback query returns 404
    const resPlaybackAfterDelete = await makeRequest(
      server,
      'GET',
      `/media/videos/${validVideoId}/playback`,
      undefined,
      tokenParentValid
    );
    assert.equal(resPlaybackAfterDelete.status, 404);
    assert.ok(
      resPlaybackAfterDelete.data.error.includes('deleted_media_not_returned_by_API'),
      'Error message must reference deleted_media_not_returned_by_API'
    );
    console.log('✅ Direct playback query on deleted media returns 404.');
    console.log('✅ Acceptance Test 5 Passed: deleted_media_not_returned_by_API verified.');

    console.log('\n🎉 ALL 5 OFFICIAL TASK H21 ACCEPTANCE TESTS PASSED SUCCESSFULLY!\n');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

if (require.main === module) {
  runTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Task H21 Integration Tests Failed:', err);
      process.exit(1);
    });
}

export { runTests as runH21Tests };
