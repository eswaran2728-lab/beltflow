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
  token?: string,
  rawBuffer?: Buffer,
  contentType?: string
): Promise<{ status: number; data: any; rawBody: string }> {
  return new Promise((resolve, reject) => {
    const addr = server.address();
    if (!addr || typeof addr === 'string') {
      return reject(new Error('Server not listening'));
    }

    const headers: Record<string, string> = {};
    let payload: Buffer | string = '';

    if (rawBuffer) {
      payload = rawBuffer;
      headers['Content-Type'] = contentType || 'video/mp4';
      headers['Content-Length'] = rawBuffer.length.toString();
    } else if (body) {
      payload = JSON.stringify(body);
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(payload).toString();
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const reqPath = path.startsWith('/api/v1') ? path : `/api/v1${path}`;

    const req = http.request(
      {
        host: '127.0.0.1',
        port: addr.port,
        path: reqPath,
        method,
        headers,
      },
      (res) => {
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          raw += chunk;
        });
        res.on('end', () => {
          let parsed: any = null;
          try {
            parsed = JSON.parse(raw);
          } catch {
            parsed = raw;
          }
          resolve({
            status: res.statusCode || 500,
            data: parsed,
            rawBody: raw,
          });
        });
      }
    );

    req.on('error', reject);
    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

async function runPreflightTests() {
  console.log('🛡️ Starting H21 Video Media Security Pre-Flight Tests...');
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));

  const orgId = 'org_sec_preflight_1';
  const orgBId = 'org_sec_preflight_2';
  const leadMasterId = 'usr_master_lead_pf';
  const formerMasterId = 'usr_master_former_pf';
  const subMasterId = 'usr_master_sub_pf';
  const parentId = 'usr_parent_pf';
  const studentUserId = 'usr_student_pf';
  const studentId = 'stu_pf_001';
  const classId = 'cls_pf_001';

  try {
    // Clean test data
    await dbClient.query('DELETE FROM video_feedback_annotations WHERE video_id LIKE $1', ['vid_pf_%']);
    await dbClient.query('DELETE FROM video_submissions WHERE id LIKE $1', ['vid_pf_%']);
    await dbClient.query('DELETE FROM student_media_consents WHERE student_id = $1', [studentId]);
    await dbClient.query('DELETE FROM parent_student_links WHERE student_id = $1', [studentId]);
    await dbClient.query('DELETE FROM class_leaderships WHERE class_id = $1', [classId]);
    await dbClient.query('DELETE FROM class_enrollments WHERE student_id = $1', [studentId]);
    await dbClient.query('DELETE FROM students WHERE id = $1', [studentId]);
    await dbClient.query('DELETE FROM classes WHERE id = $1', [classId]);
    await dbClient.query('DELETE FROM users WHERE id IN ($1, $2, $3, $4, $5)', [
      leadMasterId,
      formerMasterId,
      subMasterId,
      parentId,
      studentUserId,
    ]);
    await dbClient.query('DELETE FROM organizations WHERE id IN ($1, $2)', [orgId, orgBId]);

    // Insert Orgs
    await dbClient.query(
      `INSERT INTO organizations (id, name, state, martial_art_style, master_name, phone, email, status)
       VALUES ($1, 'Preflight Dojang', 'Selangor', 'Silat Seni Gayong', 'Master Halim', '+60123456791', 'pf1@test.com', 'ACTIVE'),
              ($2, 'Other Dojang', 'Perak', 'WT Taekwondo', 'Master Tan', '+60123456792', 'pf2@test.com', 'ACTIVE')
       ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE';`,
      [orgId, orgBId]
    );

    // Insert Users
    await dbClient.query(
      `INSERT INTO users (id, organization_id, email, full_name, role, password_hash, status)
       VALUES
       ($1, $2, 'lead_master@pf.com', 'Lead Master', 'MASTER', 'hash', 'ACTIVE'),
       ($3, $2, 'former_master@pf.com', 'Former Master', 'MASTER', 'hash', 'ACTIVE'),
       ($4, $2, 'sub_master@pf.com', 'Substitute Master', 'MASTER', 'hash', 'ACTIVE'),
       ($5, $2, 'parent@pf.com', 'Guardian Parent', 'PARENT', 'hash', 'ACTIVE'),
       ($6, $2, 'student@pf.com', 'Student User', 'STUDENT', 'hash', 'ACTIVE');`,
      [leadMasterId, orgId, formerMasterId, subMasterId, parentId, studentUserId]
    );

    // Insert Class
    await dbClient.query(
      `INSERT INTO classes (id, organization_id, master_id, name, schedule, location, status)
       VALUES ($1, $2, $3, 'Advanced Black Belt', '18:00', 'Main Dojang', 'ACTIVE');`,
      [classId, orgId, leadMasterId]
    );

    // Insert Class Leaderships:
    // 1. Lead Master is ACTIVE PRIMARY
    await dbClient.query(
      `INSERT INTO class_leaderships (id, class_id, master_id, organization_id, leadership_type, is_active, effective_from, provenance)
       VALUES ('lead_pf_01', $1, $2, $3, 'PRIMARY', TRUE, CURRENT_TIMESTAMP - INTERVAL '10 days', 'test');`,
      [classId, leadMasterId, orgId]
    );

    // 2. Former Master has INACTIVE leadership record (replaced)
    await dbClient.query(
      `INSERT INTO class_leaderships (id, class_id, master_id, organization_id, leadership_type, is_active, effective_from, effective_to, provenance)
       VALUES ('lead_pf_02', $1, $2, $3, 'PRIMARY', FALSE, CURRENT_TIMESTAMP - INTERVAL '30 days', CURRENT_TIMESTAMP - INTERVAL '10 days', 'test');`,
      [classId, formerMasterId, orgId]
    );

    // 3. Substitute Master has ACTIVE delegation within effective window
    await dbClient.query(
      `INSERT INTO class_leaderships (id, class_id, master_id, organization_id, leadership_type, is_active, effective_from, effective_to, provenance)
       VALUES ('lead_pf_03', $1, $2, $3, 'SUBSTITUTE', TRUE, CURRENT_TIMESTAMP - INTERVAL '1 day', CURRENT_TIMESTAMP + INTERVAL '2 days', 'test');`,
      [classId, subMasterId, orgId]
    );

    // Insert Student
    await dbClient.query(
      `INSERT INTO students (id, organization_id, user_id, class_id, full_name, ic_number, status)
       VALUES ($1, $2, $3, $4, 'Alex Tan', '091010-10-1234', 'ACTIVE');`,
      [studentId, orgId, studentUserId, classId]
    );

    // Insert Class Enrollment
    await dbClient.query(
      `INSERT INTO class_enrollments (id, class_id, student_id, organization_id, status, effective_from)
       VALUES ('enr_pf_01', $1, $2, $3, 'ACTIVE', CURRENT_TIMESTAMP);`,
      [classId, studentId, orgId]
    );

    // Insert Parent-Student Link
    await dbClient.query(
      `INSERT INTO parent_student_links (id, parent_id, student_id, status, student_approved, master_approved, admin_approved)
       VALUES ('link_pf_01', $1, $2, 'ACTIVE', TRUE, TRUE, TRUE);`,
      [parentId, studentId]
    );

    // Insert Initial Granted Media Consent
    await dbClient.query(
      `INSERT INTO student_media_consents (id, organization_id, student_id, guardian_id, consent_type, status)
       VALUES ('mcon_pf_01', $1, $2, $3, 'VIDEO_FEEDBACK', 'GRANTED');`,
      [orgId, studentId, parentId]
    );

    // Tokens
    const leadMasterToken = generateAuthToken({ id: leadMasterId, organizationId: orgId, role: UserRole.MASTER, email: 'lead_master@pf.com' });
    const formerMasterToken = generateAuthToken({ id: formerMasterId, organizationId: orgId, role: UserRole.MASTER, email: 'former_master@pf.com' });
    const subMasterToken = generateAuthToken({ id: subMasterId, organizationId: orgId, role: UserRole.MASTER, email: 'sub_master@pf.com' });
    const parentToken = generateAuthToken({ id: parentId, organizationId: orgId, role: UserRole.PARENT, email: 'parent@pf.com' });
    const studentToken = generateAuthToken({ id: studentUserId, organizationId: orgId, role: UserRole.STUDENT, email: 'student@pf.com' });

    // ------------------------------------------------------------------------
    console.log('--- 1. Upload Request: generates genuine storage presigned URL ---');
    const upReq = await makeRequest(
      server,
      'POST',
      '/media/upload-request',
      {
        studentId,
        title: 'Spin Hook Kick Analysis',
        techniqueCategory: 'SPARRING',
        fileSize: 16,
        mimeType: 'video/mp4',
        durationSeconds: 45,
      },
      studentToken
    );

    assert.strictEqual(upReq.status, 201);
    assert(upReq.data.uploadUrl.includes('/api/v1/media/storage/upload/'));
    assert(upReq.data.presignedToken);
    assert(upReq.data.tokenExpiresAt);
    assert.strictEqual(upReq.data.maxSizeBytes, 50 * 1024 * 1024);
    console.log('✅ Generated genuine presigned upload URL.');

    // ------------------------------------------------------------------------
    console.log('--- 2. Integrated Storage Upload: uploads valid MP4 and finalizes ---');
    const mp4Buffer = Buffer.from([
      0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, // 'ftyp'
      0x6d, 0x70, 0x34, 0x32, 0x00, 0x00, 0x00, 0x00,
    ]);

    const uploadRes = await makeRequest(
      server,
      'PUT',
      upReq.data.uploadUrl,
      undefined,
      undefined,
      mp4Buffer,
      'video/mp4'
    );
    assert.strictEqual(uploadRes.status, 200);
    assert.strictEqual(uploadRes.data.success, true);

    const finRes = await makeRequest(
      server,
      'POST',
      `/media/videos/${upReq.data.videoId}/finalize`,
      { token: upReq.data.presignedToken },
      studentToken
    );
    assert.strictEqual(finRes.status, 200);
    assert.strictEqual(finRes.data.status, 'UPLOADED');
    console.log('✅ Integrated upload and magic byte verification succeeded.');

    // ------------------------------------------------------------------------
    console.log('--- 3. Storage Magic Byte Enforcement: rejects non-video binary ---');
    const fakeUpReq = await makeRequest(
      server,
      'POST',
      '/media/upload-request',
      {
        studentId,
        title: 'Fake Video Test',
        fileSize: 28,
        mimeType: 'video/mp4',
      },
      studentToken
    );
    assert.strictEqual(fakeUpReq.status, 201);

    const fakeBuffer = Buffer.from('NOT_A_REAL_VIDEO_HEADER_DATA');
    await makeRequest(
      server,
      'PUT',
      fakeUpReq.data.uploadUrl,
      undefined,
      undefined,
      fakeBuffer,
      'video/mp4'
    );

    const fakeFinRes = await makeRequest(
      server,
      'POST',
      `/media/videos/${fakeUpReq.data.videoId}/finalize`,
      { token: fakeUpReq.data.presignedToken },
      studentToken
    );
    assert.strictEqual(fakeFinRes.status, 400);
    assert(fakeFinRes.data.error.includes('oversized_invalid_upload_rejected'));
    console.log('✅ Binary magic byte enforcement rejected non-video file.');

    // ------------------------------------------------------------------------
    console.log('--- 4. Class Authority: former replaced Master is strictly denied ---');
    const authVideoId = 'vid_pf_test_auth_01';
    const authStorageKey = `persatuan/${orgId}/students/${studentId}/videos/${authVideoId}.mp4`;
    await dbClient.query(
      `INSERT INTO video_submissions (
        id, organization_id, student_id, uploader_user_id, title,
        file_size_bytes, mime_type, storage_key, upload_status
      ) VALUES ($1, $2, $3, $4, 'Auth Test Video', 16, 'video/mp4', $5, 'UPLOADED');`,
      [authVideoId, orgId, studentId, studentUserId, authStorageKey]
    );

    // Save actual video object on storage
    const { mediaStorageAdapter } = await import('../services/mediaStorageAdapter');
    await mediaStorageAdapter.saveObject(authStorageKey, mp4Buffer, 'video/mp4');

    const formerRes = await makeRequest(
      server,
      'POST',
      `/media/videos/${authVideoId}/feedback`,
      {
        timestampSeconds: 12.5,
        annotationText: 'Your stance was too high.',
        techniqueRating: 3,
      },
      formerMasterToken
    );
    assert.strictEqual(formerRes.status, 403);
    assert(formerRes.data.error.includes('wrong_Master_or_guardian_denied'));
    console.log('✅ Former replaced Master denied feedback access.');

    // ------------------------------------------------------------------------
    console.log('--- 5. Class Authority: active substitute Master is authorized ---');
    const subRes = await makeRequest(
      server,
      'POST',
      `/media/videos/${authVideoId}/feedback`,
      {
        timestampSeconds: 15.0,
        annotationText: 'Clean chamber on the side kick!',
        techniqueRating: 4,
      },
      subMasterToken
    );
    assert.strictEqual(subRes.status, 201);
    assert.strictEqual(subRes.data.status, 'FEEDBACK_PROVIDED');
    console.log('✅ Active substitute Master authorized to annotate video.');

    // ------------------------------------------------------------------------
    console.log('--- 6. Storage Layer Consent Revocation: immediately denies playback ---');
    const pbRes = await makeRequest(
      server,
      'GET',
      `/media/videos/${authVideoId}/playback`,
      undefined,
      studentToken
    );
    assert.strictEqual(pbRes.status, 200);
    const playbackUrl = pbRes.data.playbackUrl;
    assert(playbackUrl.includes('/api/v1/media/storage/playback/'));

    // Verify playback URL works on storage layer before revocation
    const activeStorageRes = await makeRequest(server, 'GET', playbackUrl);
    assert.strictEqual(activeStorageRes.status, 200);
    console.log('✅ Storage layer served video with valid presigned token.');

    // Revoke consent
    const revRes = await makeRequest(
      server,
      'POST',
      `/media/consents/${studentId}/revoke`,
      { reason: 'Privacy protection audit' },
      parentToken
    );
    assert.strictEqual(revRes.status, 200);
    assert.strictEqual(revRes.data.status, 'REVOKED');

    // Direct playback query to storage endpoint using previously valid URL
    const storagePbRes = await makeRequest(
      server,
      'GET',
      playbackUrl,
      undefined,
      undefined
    );
    assert.strictEqual(storagePbRes.status, 403);
    assert(storagePbRes.data.error.includes('consent_revocation_blocks_new_access'));
    console.log('✅ Storage layer revoked playback immediately post-consent revocation.');

    console.log('🎉 ALL H21 VIDEO SECURITY PRE-FLIGHT TESTS PASSED SUCCESSFULLY!');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

if (require.main === module) {
  runPreflightTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Pre-flight tests failed:', err);
      process.exit(1);
    });
}

export { runPreflightTests };
