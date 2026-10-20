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

async function runH20Tests() {
  console.log('🥋 Starting Task H20: Learning Library, Performance & Rewards Integration Tests...');
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));

  const ts = Date.now();
  const orgAId = `org_h20_a_${ts}`;
  const orgBId = `org_h20_b_${ts}`;

  try {
    // 1. Seed Organizations
    await dbClient.query(
      `INSERT INTO organizations (id, name, state, martial_art_style, master_name, phone, email) VALUES
       ($1, 'Gayong Learning Academy', 'Selangor', 'Silat Seni Gayong', 'Master Halim', '+60123456791', $3),
       ($2, 'Cross Persatuan Academy', 'Perak', 'Silat Gayung Fatani', 'Master Karim', '+60123456792', $4)`,
      [orgAId, orgBId, `org_h20_a_${ts}@test.com`, `org_h20_b_${ts}@test.com`]
    );

    // 2. Seed Users
    const masterA1Id = `usr_m_h20_${ts}`;
    const student1Id = `usr_s1_h20_${ts}`;
    const parent1Id = `usr_p1_h20_${ts}`;
    const adminA1Id = `usr_adm_h20_${ts}`;
    const masterB1Id = `usr_mb1_h20_${ts}`;

    await dbClient.query(
      `INSERT INTO users (id, organization_id, email, password_hash, full_name, role) VALUES
       ($1, $2, $6, 'hash123', 'Master Halim (Chief)', 'MASTER'),
       ($3, $2, $7, 'hash123', 'Student Danial', 'STUDENT'),
       ($4, $2, $8, 'hash123', 'Parent Razlan', 'PARENT'),
       ($5, $2, $9, 'hash123', 'Admin Persatuan A', 'ADMIN_PERSATUAN'),
       ($10, $11, $12, 'hash123', 'Master Karim Cross', 'MASTER')`,
      [
        masterA1Id,
        orgAId,
        student1Id,
        parent1Id,
        adminA1Id,
        `m_h20_${ts}@test.com`,
        `s1_h20_${ts}@test.com`,
        `p1_h20_${ts}@test.com`,
        `adm_h20_${ts}@test.com`,
        masterB1Id,
        orgBId,
        `mb1_h20_${ts}@test.com`,
      ]
    );

    // 3. Seed Class and Student
    const classAId = `cls_h20_${ts}`;
    await dbClient.query(
      `INSERT INTO classes (id, organization_id, name, schedule, location, capacity, status)
       VALUES ($1, $2, 'Silat Seni Gayong Junior', 'Saturdays 10:00', 'Gelanggang Utama', 30, 'ACTIVE')`,
      [classAId, orgAId]
    );

    const studentRecordId = `stu_h20_${ts}`;
    await dbClient.query(
      `INSERT INTO students (id, user_id, organization_id, class_id, full_name, ic_number, belt_rank, status)
       VALUES ($1, $2, $3, $4, 'Danial bin Razlan', '120505-10-1234', 'Putih', 'ACTIVE')`,
      [studentRecordId, student1Id, orgAId, classAId]
    );

    // Link Parent to Student
    await dbClient.query(
      `INSERT INTO parent_student_links (id, parent_id, student_id, status, student_approved, master_approved, admin_approved)
       VALUES ($1, $2, $3, 'ACTIVE', TRUE, TRUE, TRUE)`,
      [`psl_h20_${ts}`, parent1Id, studentRecordId]
    );

    // Seed Persatuan Curriculum
    const curriculumId = `curr_h20_${ts}`;
    await dbClient.query(
      `INSERT INTO persatuan_curriculums (id, organization_id, system_name, martial_art_style, version, status)
       VALUES ($1, $2, 'Gayong Kurikulum Standard Kebangsaan', 'Silat Seni Gayong', 1, 'PUBLISHED')`,
      [curriculumId, orgAId]
    );

    // Belt Rank Putih & Kuning
    const rankPutihId = `rnk_putih_${ts}`;
    const rankKuningId = `rnk_kuning_${ts}`;
    await dbClient.query(
      `INSERT INTO curriculum_belt_ranks (id, curriculum_id, name, rank_order, color_hex) VALUES
       ($1, $2, 'Putih', 1, '#FFFFFF'),
       ($3, $2, 'Kuning', 2, '#FFD700')`,
      [rankPutihId, curriculumId, rankKuningId]
    );

    // Auth Tokens
    const tokenMaster = generateAuthToken({ id: masterA1Id, email: `m_h20_${ts}@test.com`, role: UserRole.MASTER, organizationId: orgAId });
    const tokenStudent = generateAuthToken({ id: student1Id, email: `s1_h20_${ts}@test.com`, role: UserRole.STUDENT, organizationId: orgAId });
    const tokenParent = generateAuthToken({ id: parent1Id, email: `p1_h20_${ts}@test.com`, role: UserRole.PARENT, organizationId: orgAId });
    const tokenAdmin = generateAuthToken({ id: adminA1Id, email: `adm_h20_${ts}@test.com`, role: UserRole.ADMIN_PERSATUAN, organizationId: orgAId });

    // ========================================================================
    // ACCEPTANCE TEST 1: unpublished_lesson_hidden
    // ========================================================================
    console.log('\n--- 1. Acceptance Test: unpublished_lesson_hidden ---');

    // 1.1 Master publishes a lesson
    const pubLessonRes = await makeRequest(
      server,
      'POST',
      '/learning/lessons',
      {
        title: 'Asas Tapak Empat & Kuda-kuda Gayong',
        category: 'POOMSAE',
        description: 'Pola langkah asas dan imbangan tapak',
        contentBody: 'Langkah 1: Kekuda asas. Langkah 2: Elak tepi. Langkah 3: Hayunan parang asas.',
        mediaUrls: ['https://cdn.beltflow.my/videos/tapak_4.mp4'],
        quizQuestions: [
          {
            question: 'Apakah sudut kekuda yang tepat dalam tapak empat?',
            options: ['45 darjah', '90 darjah', '180 darjah', '15 darjah'],
            correctIndex: 0,
            explanation: 'Sudut 45 darjah memberikan kestabilan optimum.',
          },
        ],
        curriculumId,
        targetRankId: rankPutihId,
        status: 'PUBLISHED',
      },
      tokenMaster
    );
    assert.strictEqual(pubLessonRes.status, 201);
    const publishedLessonId = pubLessonRes.data.lesson.id;

    // 1.2 Master creates a DRAFT lesson
    const draftLessonRes = await makeRequest(
      server,
      'POST',
      '/learning/lessons',
      {
        title: 'Rahsia Jurus Senjata Kerambit (DRAFT - EXCLUSIVE)',
        category: 'SELF_DEFENSE',
        description: 'Advanced master-level bladed technique',
        contentBody: 'Restricted draft content for senior masters only.',
        status: 'DRAFT',
      },
      tokenMaster
    );
    assert.strictEqual(draftLessonRes.status, 201);
    const draftLessonId = draftLessonRes.data.lesson.id;

    // 1.3 Master can view both DRAFT and PUBLISHED
    const masterListRes = await makeRequest(server, 'GET', '/learning/lessons', undefined, tokenMaster);
    assert.strictEqual(masterListRes.status, 200);
    const masterLessonIds = masterListRes.data.lessons.map((l: any) => l.id);
    assert.ok(masterLessonIds.includes(publishedLessonId), 'Master must see published lesson');
    assert.ok(masterLessonIds.includes(draftLessonId), 'Master must see draft lesson');

    // 1.4 Student list request: DRAFT lesson MUST be completely hidden!
    const studentListRes = await makeRequest(server, 'GET', '/learning/lessons', undefined, tokenStudent);
    assert.strictEqual(studentListRes.status, 200);
    const studentLessonIds = studentListRes.data.lessons.map((l: any) => l.id);
    assert.ok(studentLessonIds.includes(publishedLessonId), 'Student must see published lesson');
    assert.ok(!studentLessonIds.includes(draftLessonId), 'CRITICAL: Student MUST NOT see draft lesson in library list');

    // 1.5 Student direct access to draft lesson URL returns 404
    const studentDraftDirectRes = await makeRequest(server, 'GET', `/learning/lessons/${draftLessonId}`, undefined, tokenStudent);
    assert.strictEqual(studentDraftDirectRes.status, 404, 'Direct access by student to draft lesson must return 404');

    // 1.6 Parent direct access to draft lesson URL returns 404
    const parentDraftDirectRes = await makeRequest(server, 'GET', `/learning/lessons/${draftLessonId}`, undefined, tokenParent);
    assert.strictEqual(parentDraftDirectRes.status, 404, 'Direct access by parent to draft lesson must return 404');

    console.log('✅ Acceptance Test 1 Passed: unpublished_lesson_hidden verified.');

    // ========================================================================
    // ACCEPTANCE TEST 2: cross_rubric_scores_not_falsely_compared
    // ========================================================================
    console.log('\n--- 2. Acceptance Test: cross_rubric_scores_not_falsely_compared ---');

    // 2.1 Record assessment under Rubric Schema 1: WT_POOMSAE_V1 (10-point scale)
    const assessV1Res = await makeRequest(
      server,
      'POST',
      '/learning/assessments',
      {
        studentId: studentRecordId,
        curriculumId,
        rubricSchemaId: 'WT_POOMSAE_V1',
        rubricVersion: 1,
        skillCategory: 'BALANCE',
        score: 8.5,
        maxScore: 10.0,
        criteriaBreakdown: { stanceAccuracy: 4.2, transitionSpeed: 4.3 },
        notes: 'Good stability in Ap-Chagi balance hold.',
      },
      tokenMaster
    );
    assert.strictEqual(assessV1Res.status, 201);

    // 2.2 Record assessment under Rubric Schema 2: SILAT_JURUS_V2 (100-point scale)
    const assessV2Res = await makeRequest(
      server,
      'POST',
      '/learning/assessments',
      {
        studentId: studentRecordId,
        curriculumId,
        rubricSchemaId: 'SILAT_JURUS_V2',
        rubricVersion: 2,
        skillCategory: 'POWER',
        score: 84.0,
        maxScore: 100.0,
        criteriaBreakdown: { strikeImpact: 42.0, kimeFocus: 42.0 },
        notes: 'Powerful execution on striking bag.',
      },
      tokenMaster
    );
    assert.strictEqual(assessV2Res.status, 201);

    // 2.3 Fetch student performance with comparative query
    const perfRes = await makeRequest(
      server,
      'GET',
      `/learning/students/${studentRecordId}/performance?compareRubrics=true`,
      undefined,
      tokenStudent
    );
    assert.strictEqual(perfRes.status, 200);

    // Assert that the server partitioned by rubric schema and version
    assert.ok(perfRes.data.partitionedByRubric['WT_POOMSAE_V1_v1'], 'Expected partition for WT_POOMSAE_V1_v1');
    assert.ok(perfRes.data.partitionedByRubric['SILAT_JURUS_V2_v2'], 'Expected partition for SILAT_JURUS_V2_v2');
    assert.strictEqual(perfRes.data.partitionedByRubric['WT_POOMSAE_V1_v1'][0].score, '8.50');
    assert.strictEqual(perfRes.data.partitionedByRubric['SILAT_JURUS_V2_v2'][0].score, '84.00');

    // Assert that cross-rubric naive comparison is flagged as incompatible
    assert.strictEqual(
      perfRes.data.crossRubricIncompatible,
      true,
      'Cross-rubric scores across disparate schemas/versions must be flagged incompatible'
    );
    assert.ok(perfRes.data.comparisonWarning.includes('Cross-rubric version comparison rejected'));

    // Assert Child Privacy safeguard: Global leaderboards are disabled and not returned
    assert.strictEqual(perfRes.data.globalRankingDisabled, true);
    assert.strictEqual(perfRes.data.leaderboardPosition, null);

    console.log('✅ Acceptance Test 2 Passed: cross_rubric_scores_not_falsely_compared verified.');

    // ========================================================================
    // ACCEPTANCE TEST 3: replay_event_one_award
    // ========================================================================
    console.log('\n--- 3. Acceptance Test: replay_event_one_award ---');
    const idempotentEventId = `evt_reward_${ts}_streak_7`;

    // 3.1 Initial award event triggers successful creation
    const awardRes1 = await makeRequest(
      server,
      'POST',
      '/learning/achievements/award',
      {
        eventId: idempotentEventId,
        studentId: studentRecordId,
        badgeCode: 'STRIKE_PRECISION_MASTER',
        badgeTitle: 'Master of Strike Precision',
        badgeDescription: 'Completed 7 consecutive precision strike sessions without deduction.',
        category: 'SKILL',
      },
      tokenMaster
    );
    assert.strictEqual(awardRes1.status, 201, 'First award call should return 201 Created');
    assert.strictEqual(awardRes1.data.created, true);
    assert.strictEqual(awardRes1.data.isDuplicateReplay, false);
    const createdAwardId = awardRes1.data.achievement.id;

    // 3.2 Replay of identical eventId MUST be idempotent
    const awardRes2 = await makeRequest(
      server,
      'POST',
      '/learning/achievements/award',
      {
        eventId: idempotentEventId,
        studentId: studentRecordId,
        badgeCode: 'STRIKE_PRECISION_MASTER',
        badgeTitle: 'Master of Strike Precision (Replay)',
        badgeDescription: 'Duplicate attempt to award.',
        category: 'SKILL',
      },
      tokenMaster
    );
    assert.strictEqual(awardRes2.status, 200, 'Replay award call should return 200 OK');
    assert.strictEqual(awardRes2.data.created, false);
    assert.strictEqual(awardRes2.data.isDuplicateReplay, true);
    assert.strictEqual(awardRes2.data.achievement.id, createdAwardId, 'Replayed event must return existing achievement ID');

    // 3.3 Verify in database directly that only ONE achievement row exists
    const dbCountRes = await dbClient.query(
      'SELECT COUNT(*)::int AS count FROM student_achievements WHERE event_id = $1',
      [idempotentEventId]
    );
    assert.strictEqual(dbCountRes.rows[0].count, 1, 'Database must have exactly 1 record for event_id');

    console.log('✅ Acceptance Test 3 Passed: replay_event_one_award verified.');

    // ========================================================================
    // ACCEPTANCE TEST 4: revoked_award_audited
    // ========================================================================
    console.log('\n--- 4. Acceptance Test: revoked_award_audited ---');
    const revocationReason = 'Disciplinary sanction: Form was invalidated due to unauthorized assistance during assessment.';

    const revokeRes = await makeRequest(
      server,
      'POST',
      `/learning/achievements/${createdAwardId}/revoke`,
      { reason: revocationReason },
      tokenMaster
    );
    assert.strictEqual(revokeRes.status, 200);
    assert.strictEqual(revokeRes.data.achievement.status, 'REVOKED');
    assert.strictEqual(revokeRes.data.achievement.revocation_reason, revocationReason);

    // Verify immutable audit log in database
    const auditRes = await dbClient.query(
      `SELECT * FROM audit_logs
       WHERE action = 'ACHIEVEMENT_REVOKED'
       ORDER BY timestamp DESC
       LIMIT 1`
    );
    assert.ok(auditRes.rowCount! > 0, 'Audit log entry must exist for award revocation');
    const auditEntry = auditRes.rows[0];
    assert.strictEqual(auditEntry.action, 'ACHIEVEMENT_REVOKED');
    const parsedDetails = JSON.parse(auditEntry.details);
    assert.strictEqual(parsedDetails.awardId, createdAwardId);
    assert.strictEqual(parsedDetails.studentId, studentRecordId);
    assert.strictEqual(parsedDetails.reason, revocationReason);
    assert.strictEqual(parsedDetails.revokedByUserId, masterA1Id);

    // Verify revoked award does not appear in active student achievements list
    const studentBadgesRes = await makeRequest(
      server,
      'GET',
      `/learning/students/${studentRecordId}/achievements`,
      undefined,
      tokenStudent
    );
    assert.strictEqual(studentBadgesRes.status, 200);
    const activeBadgeIds = studentBadgesRes.data.achievements.map((a: any) => a.id);
    assert.ok(!activeBadgeIds.includes(createdAwardId), 'Revoked achievement must not appear in active student list');

    console.log('✅ Acceptance Test 4 Passed: revoked_award_audited verified.');

    // ========================================================================
    // ACCEPTANCE TEST 5: learning_completion_not_formal_grading
    // ========================================================================
    console.log('\n--- 5. Acceptance Test: learning_completion_not_formal_grading ---');

    // 5.1 Check initial student rank before completing lesson
    const preStudentRes = await dbClient.query('SELECT belt_rank FROM students WHERE id = $1', [studentRecordId]);
    assert.strictEqual(preStudentRes.rows[0].belt_rank, 'Putih', 'Initial rank must be Putih');

    const preHistoryRes = await dbClient.query('SELECT COUNT(*)::int AS count FROM student_rank_history WHERE student_id = $1', [studentRecordId]);
    const initialHistoryCount = preHistoryRes.rows[0].count;

    // 5.2 Student records 100% quiz completion on published lesson
    const progressRes = await makeRequest(
      server,
      'POST',
      `/learning/lessons/${publishedLessonId}/progress`,
      {
        studentId: studentRecordId,
        quizScore: 100.0,
        quizAnswers: { q0: 0 },
        status: 'COMPLETED',
      },
      tokenStudent
    );
    assert.strictEqual(progressRes.status, 200);
    assert.strictEqual(progressRes.data.success, true);
    assert.strictEqual(progressRes.data.progress.status, 'COMPLETED');
    assert.strictEqual(progressRes.data.progress.quiz_score, '100.00');
    assert.strictEqual(progressRes.data.formalGradingOccurred, false);
    assert.ok(progressRes.data.message.includes('Formal rank promotion requires a registered grading event'));

    // 5.3 Verify in database: belt_rank was NOT updated!
    const postStudentRes = await dbClient.query('SELECT belt_rank FROM students WHERE id = $1', [studentRecordId]);
    assert.strictEqual(
      postStudentRes.rows[0].belt_rank,
      'Putih',
      'CRITICAL INVARIANT: Completing learning library modules must NEVER promote belt rank or alter students.belt_rank'
    );

    // 5.4 Verify in database: student_rank_history has ZERO new entries!
    const postHistoryRes = await dbClient.query('SELECT COUNT(*)::int AS count FROM student_rank_history WHERE student_id = $1', [studentRecordId]);
    assert.strictEqual(
      postHistoryRes.rows[0].count,
      initialHistoryCount,
      'CRITICAL INVARIANT: Zero rank history records created from learning module completion'
    );

    console.log('✅ Acceptance Test 5 Passed: learning_completion_not_formal_grading verified.');

    console.log('\n🎉 ALL 5 OFFICIAL TASK H20 ACCEPTANCE TESTS PASSED SUCCESSFULLY!');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

if (require.main === module) {
  runH20Tests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Task H20 Test Suite Failed:', err);
      process.exit(1);
    });
}

export { runH20Tests };
