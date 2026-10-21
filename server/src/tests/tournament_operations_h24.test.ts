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
): Promise<{ status: number; data: any; rawBody: string; headers: http.IncomingHttpHeaders }> {
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
          resolve({ status: res.statusCode || 500, data: parsed, rawBody: resData, headers: res.headers });
        });
      }
    );

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runTests() {
  console.log('🥋 Starting Task H24: Tournament Operations and Judging Acceptance Tests...');
  await dbClient.init();

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));

  try {
    const timestamp = Date.now();
    const orgId = `org_h24_${timestamp}`;

    // 1. Seed Organization
    await dbClient.query(`
      INSERT INTO organizations (id, name, state, martial_art_style, master_name, phone, email, status)
      VALUES ('${orgId}', 'Selangor Silambam Championship H24', 'Selangor', 'Silambam', 'Master Pandian', '0123456789', 'org_${timestamp}@h24.test', 'ACTIVE')
      ON CONFLICT (id) DO NOTHING;
    `);

    // 2. Seed Users
    const adminId = `usr_adm_${timestamp}`;
    const judgeAssignedId = `usr_jdg_assigned_${timestamp}`;
    const judgeUnassignedId = `usr_jdg_unassigned_${timestamp}`;
    const headJudgeId = `usr_head_jdg_${timestamp}`;

    const usersToInsert = [
      { id: adminId, email: `adm_${timestamp}@test.com`, role: UserRole.ADMIN_PERSATUAN },
      { id: judgeAssignedId, email: `jdg_assigned_${timestamp}@test.com`, role: UserRole.MASTER },
      { id: judgeUnassignedId, email: `jdg_unassigned_${timestamp}@test.com`, role: UserRole.MASTER },
      { id: headJudgeId, email: `head_jdg_${timestamp}@test.com`, role: UserRole.MASTER },
    ];

    for (const u of usersToInsert) {
      await dbClient.query(
        `INSERT INTO users (id, email, password_hash, full_name, role, organization_id, status)
         VALUES ($1, $2, 'hash', $2, $3, '${orgId}', 'ACTIVE')
         ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE';`,
        [u.id, u.email, u.role]
      );
    }

    const tokenAdmin = generateAuthToken({ id: adminId, email: `adm_${timestamp}@test.com`, role: UserRole.ADMIN_PERSATUAN, organizationId: orgId });
    const tokenAssignedJudge = generateAuthToken({ id: judgeAssignedId, email: `jdg_assigned_${timestamp}@test.com`, role: UserRole.MASTER, organizationId: orgId });
    const tokenUnassignedJudge = generateAuthToken({ id: judgeUnassignedId, email: `jdg_unassigned_${timestamp}@test.com`, role: UserRole.MASTER, organizationId: orgId });
    const tokenHeadJudge = generateAuthToken({ id: headJudgeId, email: `head_jdg_${timestamp}@test.com`, role: UserRole.MASTER, organizationId: orgId });

    // 3. Seed Students with varying ages and ranks
    const stuEligibleId = `stu_elig_${timestamp}`;
    const stuTooYoungId = `stu_young_${timestamp}`;
    const stuLowRankId = `stu_lowrank_${timestamp}`;
    const stuFemaleId = `stu_female_${timestamp}`;
    const stuOpponentId = `stu_opp_${timestamp}`;

    await dbClient.query(`
      INSERT INTO students (id, organization_id, full_name, ic_number, belt_rank, date_of_birth, gender, rank_order, status)
      VALUES 
        ('${stuEligibleId}', '${orgId}', 'Eligible Male Competitor', '100512-10-1234', 'Green Belt', '2010-05-12', 'MALE', 4, 'ACTIVE'),
        ('${stuTooYoungId}', '${orgId}', 'Underage Student', '180820-10-5678', 'Green Belt', '2018-08-20', 'MALE', 4, 'ACTIVE'),
        ('${stuLowRankId}', '${orgId}', 'White Belt Student', '2010-01-01', 'White Belt', '2010-01-01', 'MALE', 1, 'ACTIVE'),
        ('${stuFemaleId}', '${orgId}', 'Female Student', '2010-02-02', 'Green Belt', '2010-02-02', 'FEMALE', 4, 'ACTIVE'),
        ('${stuOpponentId}', '${orgId}', 'Eligible Opponent', '2010-03-03', 'Green Belt', '2010-03-03', 'MALE', 4, 'ACTIVE')
      ON CONFLICT (id) DO NOTHING;
    `);

    // 4. Create Tournament
    const tourneyRes = await makeRequest(server, 'POST', '/tournaments', {
      organizationId: orgId,
      name: 'Malaysia Silambam Open 2026',
      eventDate: '2026-11-20',
      location: 'National Stadium Bukit Jalil',
      ruleset: 'SILAMBAM_STANDARD'
    }, tokenAdmin);
    assert.strictEqual(tourneyRes.status, 201);
    const tournamentId = tourneyRes.data.tournament.id;

    // 5. Create Category with strict criteria:
    // Boys Junior (Age: 12-16, Belt Rank: 4-6 [Green to Purple], Gender: MALE)
    const catRes = await makeRequest(server, 'POST', '/tournaments/categories', {
      tournamentId,
      name: 'Boys Junior Forms (12-16 Yrs)',
      minAge: 12,
      maxAge: 16,
      minBeltRank: 4,
      maxBeltRank: 6,
      gender: 'MALE'
    }, tokenAdmin);
    assert.strictEqual(catRes.status, 201);
    const categoryId = catRes.data.category.id;

    // =========================================================================
    // Test 1: Official Criterion: category_eligibility_checked
    // =========================================================================
    console.log('\n--- Test 1: category_eligibility_checked ---');

    // Attempt 1A: Student too young (Age ~8 < 12) -> Rejected
    const youngRes = await makeRequest(server, 'POST', '/tournaments/register', {
      tournamentId,
      categoryId,
      studentId: stuTooYoungId,
      organizationId: orgId
    }, tokenAdmin);
    assert.strictEqual(youngRes.status, 400);
    assert.strictEqual(youngRes.data.criterion, 'category_eligibility_checked');
    assert.ok(youngRes.data.message.includes('below category minimum age requirement'));

    // Attempt 1B: Student belt rank too low (Rank 1 White < Rank 4 Green) -> Rejected
    const rankRes = await makeRequest(server, 'POST', '/tournaments/register', {
      tournamentId,
      categoryId,
      studentId: stuLowRankId,
      organizationId: orgId
    }, tokenAdmin);
    assert.strictEqual(rankRes.status, 400);
    assert.strictEqual(rankRes.data.criterion, 'category_eligibility_checked');
    assert.ok(rankRes.data.message.includes('does not meet category minimum requirement'));

    // Attempt 1C: Student gender mismatch (FEMALE in MALE category) -> Rejected
    const genderRes = await makeRequest(server, 'POST', '/tournaments/register', {
      tournamentId,
      categoryId,
      studentId: stuFemaleId,
      organizationId: orgId
    }, tokenAdmin);
    assert.strictEqual(genderRes.status, 400);
    assert.strictEqual(genderRes.data.criterion, 'category_eligibility_checked');
    assert.ok(genderRes.data.message.includes('does not match category requirement'));

    // Attempt 1D: Eligible Male Competitor -> Accepted
    const regEligible = await makeRequest(server, 'POST', '/tournaments/register', {
      tournamentId,
      categoryId,
      studentId: stuEligibleId,
      organizationId: orgId
    }, tokenAdmin);
    assert.strictEqual(regEligible.status, 201);
    const compAId = regEligible.data.competitor.id;

    // Register second eligible competitor for match
    const regOpponent = await makeRequest(server, 'POST', '/tournaments/register', {
      tournamentId,
      categoryId,
      studentId: stuOpponentId,
      organizationId: orgId
    }, tokenAdmin);
    assert.strictEqual(regOpponent.status, 201);
    const compBId = regOpponent.data.competitor.id;

    console.log('✅ Criterion 1 (category_eligibility_checked) PASSED.');

    // 6. Create Match between Competitor A and Competitor B
    const matchRes = await makeRequest(server, 'POST', '/tournaments/matches', {
      tournamentId,
      categoryId,
      matchNumber: 1,
      roundName: 'FINAL',
      competitorAId: compAId,
      competitorBId: compBId
    }, tokenAdmin);
    assert.strictEqual(matchRes.status, 201);
    const matchId = matchRes.data.match.id;

    // Assign Judge 1 (judgeAssignedId) to match
    const assignRes = await makeRequest(server, 'POST', '/tournaments/assign-judge', {
      tournamentId,
      matchId,
      judgeId: judgeAssignedId,
      role: 'CORNER_JUDGE'
    }, tokenAdmin);
    assert.strictEqual(assignRes.status, 201);

    // =========================================================================
    // Test 2: Official Criterion: judge_only_assigned_match
    // =========================================================================
    console.log('\n--- Test 2: judge_only_assigned_match ---');

    // Unassigned judge attempts to submit score -> 403 Forbidden
    const unassignedScoreRes = await makeRequest(server, 'POST', `/tournaments/matches/${matchId}/score`, {
      competitorId: compAId,
      version: 1,
      technicalScore: 8.5,
      penalties: 0.0,
      totalScore: 8.5
    }, tokenUnassignedJudge);
    assert.strictEqual(unassignedScoreRes.status, 403);
    assert.strictEqual(unassignedScoreRes.data.criterion, 'judge_only_assigned_match');
    assert.ok(unassignedScoreRes.data.message.includes('Judge is not assigned to this match'));

    // Assigned judge submits score -> 201 Created
    const assignedScoreRes = await makeRequest(server, 'POST', `/tournaments/matches/${matchId}/score`, {
      competitorId: compAId,
      version: 1,
      technicalScore: 8.8,
      penalties: 0.2,
      totalScore: 8.6
    }, tokenAssignedJudge);
    assert.strictEqual(assignedScoreRes.status, 201);
    assert.strictEqual(assignedScoreRes.data.duplicate, false);

    console.log('✅ Criterion 2 (judge_only_assigned_match) PASSED.');

    // =========================================================================
    // Test 3: Official Criterion: duplicate_score_once
    // =========================================================================
    console.log('\n--- Test 3: duplicate_score_once ---');

    // Resend exact same scorecard submission (version 1)
    const duplicateScoreRes = await makeRequest(server, 'POST', `/tournaments/matches/${matchId}/score`, {
      competitorId: compAId,
      version: 1,
      technicalScore: 8.8,
      penalties: 0.2,
      totalScore: 8.6
    }, tokenAssignedJudge);

    // Must be handled idempotently: status 200 with duplicate flag, no double-counting
    assert.strictEqual(duplicateScoreRes.status, 200);
    assert.strictEqual(duplicateScoreRes.data.criterion, 'duplicate_score_once');
    assert.strictEqual(duplicateScoreRes.data.duplicate, true);
    assert.strictEqual(duplicateScoreRes.data.scorecard.id, assignedScoreRes.data.scorecard.id);

    // Verify row count in database: exactly 1 scorecard for this judge & competitor
    const rowCheck = await dbClient.query(
      'SELECT COUNT(*) as count FROM tournament_scorecards WHERE match_id = $1 AND judge_id = $2 AND competitor_id = $3',
      [matchId, judgeAssignedId, compAId]
    );
    assert.strictEqual(parseInt(rowCheck.rows[0].count, 10), 1, 'Duplicate score must not produce duplicate DB rows');

    console.log('✅ Criterion 3 (duplicate_score_once) PASSED.');

    // =========================================================================
    // Test 4: Official Criterion: tie_rule_deterministic
    // =========================================================================
    console.log('\n--- Test 4: tie_rule_deterministic ---');

    // Submit score for Competitor B with identical total score (8.6), but different technical difficulty
    // Competitor A: Total 8.6 (Tech: 8.8, Pen: 0.2)
    // Competitor B: Total 8.6 (Tech: 8.6, Pen: 0.0)
    const scoreBRes = await makeRequest(server, 'POST', `/tournaments/matches/${matchId}/score`, {
      competitorId: compBId,
      version: 1,
      technicalScore: 8.6,
      penalties: 0.0,
      totalScore: 8.6
    }, tokenAssignedJudge);
    assert.strictEqual(scoreBRes.status, 201);

    // Lock Match Result
    const lockRes = await makeRequest(server, 'POST', `/tournaments/matches/${matchId}/lock`, {}, tokenAdmin);
    assert.strictEqual(lockRes.status, 200);
    assert.strictEqual(lockRes.data.criterion, 'tie_rule_deterministic');
    assert.strictEqual(lockRes.data.match.status, 'LOCKED');
    assert.strictEqual(lockRes.data.match.tie_break_applied, true);
    assert.strictEqual(lockRes.data.match.tie_break_reason, 'DETERMINISTIC_TIE_BREAK: HIGHER_TECHNICAL_SCORE');
    assert.strictEqual(lockRes.data.match.winner_competitor_id, compAId, 'Competitor A with higher technical score must win tie break');

    console.log('✅ Criterion 4 (tie_rule_deterministic) PASSED.');

    // =========================================================================
    // Test 5: Official Criterion: locked_score_requires_appeal
    // =========================================================================
    console.log('\n--- Test 5: locked_score_requires_appeal ---');

    // Attempting to submit / alter score while match is LOCKED -> 409 Conflict
    const lockedAttempt = await makeRequest(server, 'POST', `/tournaments/matches/${matchId}/score`, {
      competitorId: compBId,
      version: 2,
      technicalScore: 9.0,
      penalties: 0.0,
      totalScore: 9.0
    }, tokenAssignedJudge);
    assert.strictEqual(lockedAttempt.status, 409);
    assert.strictEqual(lockedAttempt.data.criterion, 'locked_score_requires_appeal');
    assert.ok(lockedAttempt.data.message.includes('Match result is locked. Modification requires an approved appeal'));

    // Competitor B coach submits an official appeal
    const appealRes = await makeRequest(server, 'POST', `/tournaments/matches/${matchId}/appeal`, {
      competitorId: compBId,
      reason: 'Judges missed extra stick rotation flourish during 2nd form segment.'
    }, tokenHeadJudge);
    assert.strictEqual(appealRes.status, 201);
    const appealId = appealRes.data.appeal.id;

    // Head Judge approves appeal -> Unlocks match for re-evaluation
    const decideRes = await makeRequest(server, 'POST', `/tournaments/appeals/${appealId}/decide`, {
      decision: 'APPROVED',
      decisionNotes: 'Video review confirmed clean stick rotation technique. Re-score permitted.'
    }, tokenAdmin);
    assert.strictEqual(decideRes.status, 200);
    assert.strictEqual(decideRes.data.match.status, 'APPEALED');

    // Now submitting score is permitted
    const revisedScoreRes = await makeRequest(server, 'POST', `/tournaments/matches/${matchId}/score`, {
      competitorId: compBId,
      version: 2,
      technicalScore: 8.9,
      penalties: 0.0,
      totalScore: 8.9
    }, tokenAssignedJudge);
    assert.strictEqual(revisedScoreRes.status, 201);
    assert.strictEqual(revisedScoreRes.data.scorecard.client_version, 2);

    console.log('✅ Criterion 5 (locked_score_requires_appeal) PASSED.');

    console.log('\n🎉 ALL 5 OFFICIAL H24 ACCEPTANCE CRITERIA PASSED WITHOUT REGRESSION!');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

if (require.main === module) {
  runTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ H24 Acceptance Tests Failed:', err);
      process.exit(1);
    });
}

export { runTests as runH24Tests };
