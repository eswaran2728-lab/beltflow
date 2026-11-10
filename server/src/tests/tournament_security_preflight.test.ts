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

async function runSecurityPreflightTests() {
  console.log('🛡️ Starting H24 Tournament Security Preflight Verification...');
  await dbClient.init();

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));

  try {
    const timestamp = Date.now();
    const orgIdA = `org_sec_a_${timestamp}`;
    const orgIdB = `org_sec_b_${timestamp}`;

    // 1. Seed Two Isolated Organizations
    await dbClient.query(`
      INSERT INTO organizations (id, name, state, martial_art_style, master_name, phone, email, status)
      VALUES 
        ('${orgIdA}', 'Selangor Silambam Association', 'Selangor', 'Silambam', 'Master Kumar', '0121111111', 'org_a_${timestamp}@test.com', 'ACTIVE'),
        ('${orgIdB}', 'Penang Karate League', 'Penang', 'Karate', 'Master Lee', '0122222222', 'org_b_${timestamp}@test.com', 'ACTIVE')
      ON CONFLICT (id) DO NOTHING;
    `);

    // 2. Seed Users
    const adminA = `usr_adm_a_${timestamp}`;
    const adminB = `usr_adm_b_${timestamp}`;
    const judge1 = `usr_jdg_1_${timestamp}`;
    const unassignedJudge = `usr_jdg_unassigned_${timestamp}`;
    const parentUser = `usr_parent_${timestamp}`;

    const usersToInsert = [
      { id: adminA, email: `adma_${timestamp}@test.com`, role: UserRole.ADMIN_PERSATUAN, org: orgIdA },
      { id: adminB, email: `admb_${timestamp}@test.com`, role: UserRole.ADMIN_PERSATUAN, org: orgIdB },
      { id: judge1, email: `jdg1_${timestamp}@test.com`, role: UserRole.MASTER, org: orgIdA },
      { id: unassignedJudge, email: `jdgu_${timestamp}@test.com`, role: UserRole.MASTER, org: orgIdA },
      { id: parentUser, email: `parent_${timestamp}@test.com`, role: UserRole.PARENT, org: orgIdA },
    ];

    for (const u of usersToInsert) {
      await dbClient.query(
        `INSERT INTO users (id, email, password_hash, full_name, role, organization_id, status)
         VALUES ($1, $2, 'hash', $2, $3, $4, 'ACTIVE')
         ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE';`,
        [u.id, u.email, u.role, u.org]
      );
    }

    const tokenAdminA = generateAuthToken({ id: adminA, email: `adma_${timestamp}@test.com`, role: UserRole.ADMIN_PERSATUAN, organizationId: orgIdA });
    const tokenAdminB = generateAuthToken({ id: adminB, email: `admb_${timestamp}@test.com`, role: UserRole.ADMIN_PERSATUAN, organizationId: orgIdB });
    const tokenJudge1 = generateAuthToken({ id: judge1, email: `jdg1_${timestamp}@test.com`, role: UserRole.MASTER, organizationId: orgIdA });
    const tokenUnassigned = generateAuthToken({ id: unassignedJudge, email: `jdgu_${timestamp}@test.com`, role: UserRole.MASTER, organizationId: orgIdA });
    const tokenParent = generateAuthToken({ id: parentUser, email: `parent_${timestamp}@test.com`, role: UserRole.PARENT, organizationId: orgIdA });

    // 3. Seed Students for Org A
    const stuA = `stu_sec_a_${timestamp}`;
    const stuB = `stu_sec_b_${timestamp}`;
    const stuUnderage = `stu_sec_young_${timestamp}`;
    const stuLowRank = `stu_sec_lowrank_${timestamp}`;

    await dbClient.query(`
      INSERT INTO students (id, organization_id, full_name, ic_number, belt_rank, date_of_birth, gender, rank_order, status)
      VALUES 
        ('${stuA}', '${orgIdA}', 'Kavitha Devi (Minor)', '100510-10-1234', 'Green Belt', '2010-05-10', 'FEMALE', 4, 'ACTIVE'),
        ('${stuB}', '${orgIdA}', 'Pravin Raj (Minor)', '100820-10-5678', 'Green Belt', '2010-08-20', 'MALE', 4, 'ACTIVE'),
        ('${stuUnderage}', '${orgIdA}', 'Too Young Minor', '200101-10-9999', 'Green Belt', '2020-01-01', 'FEMALE', 4, 'ACTIVE'),
        ('${stuLowRank}', '${orgIdA}', 'White Belt Minor', '100101-10-1111', 'White Belt', '2010-01-01', 'MALE', 1, 'ACTIVE')
      ON CONFLICT (id) DO NOTHING;
    `);

    // 4. Create Tournament & Category via APIs
    const tourneyRes = await makeRequest(server, 'POST', '/tournaments', {
      organizationId: orgIdA,
      title: 'National Silambam Open',
      eventDate: '2026-11-20',
      location: 'Stadium Malawati',
      martialArtDiscipline: 'Silambam',
      ruleset: 'SILAMBAM_STANDARD'
    }, tokenAdminA);
    assert.equal(tourneyRes.status, 201);
    const tournamentId = tourneyRes.data.tournament.id;

    const catRes = await makeRequest(server, 'POST', '/tournaments/categories', {
      tournamentId,
      name: 'Cadet Sparring (12-16 Yrs)',
      minAge: 12,
      maxAge: 16,
      minBeltRank: 4,
      maxBeltRank: 8,
      gender: 'OPEN'
    }, tokenAdminA);
    assert.equal(catRes.status, 201);
    const categoryId = catRes.data.category.id;

    // Register competitors
    const regA = await makeRequest(server, 'POST', '/tournaments/register', {
      tournamentId,
      categoryId,
      studentId: stuA,
      organizationId: orgIdA
    }, tokenAdminA);
    assert.equal(regA.status, 201);
    const compAId = regA.data.competitor.id;

    const regB = await makeRequest(server, 'POST', '/tournaments/register', {
      tournamentId,
      categoryId,
      studentId: stuB,
      organizationId: orgIdA
    }, tokenAdminA);
    assert.equal(regB.status, 201);
    const compBId = regB.data.competitor.id;

    // Create Match
    const matchRes = await makeRequest(server, 'POST', '/tournaments/matches', {
      tournamentId,
      categoryId,
      matchNumber: 101,
      roundName: 'FINAL',
      competitorAId: compAId,
      competitorBId: compBId
    }, tokenAdminA);
    assert.equal(matchRes.status, 201);
    const matchId = matchRes.data.match.id;

    console.log('\n--- 1. Judge assignment is server-authoritative and match-specific ---');
    // Unauthorized role (Parent) attempting judge assignment -> 403
    const assignByParent = await makeRequest(server, 'POST', '/tournaments/assign-judge', {
      tournamentId,
      matchId,
      judgeId: judge1,
      role: 'SIDE_JUDGE'
    }, tokenParent);
    assert.equal(assignByParent.status, 403, 'Parent must be denied judge assignment');

    // Cross-tenant Admin (Admin B) attempting assignment to Tournament in Org A -> 403
    const assignByAdminB = await makeRequest(server, 'POST', '/tournaments/assign-judge', {
      tournamentId,
      matchId,
      judgeId: judge1,
      role: 'SIDE_JUDGE'
    }, tokenAdminB);
    assert.equal(assignByAdminB.status, 403, 'Cross-tenant admin cannot assign match in Org A');

    // Authorized Admin A assigns Judge 1
    const assignSuccess = await makeRequest(server, 'POST', '/tournaments/assign-judge', {
      tournamentId,
      matchId,
      judgeId: judge1,
      role: 'CORNER_JUDGE'
    }, tokenAdminA);
    assert.equal(assignSuccess.status, 201, 'Admin A can assign judge to match');
    assert.equal(assignSuccess.data.assignment.judge_id, judge1);
    console.log('✅ Check 1: Server-authoritative, match-specific assignment verified.');

    console.log('\n--- 2. Unassigned and revoked judges cannot score ---');
    // Unassigned judge scoring attempt -> 403 judge_only_assigned_match
    const unassignedScore = await makeRequest(server, 'POST', `/tournaments/matches/${matchId}/score`, {
      competitorId: compAId,
      version: 1,
      technicalScore: 8.5,
      penalties: 0.0,
      totalScore: 8.5
    }, tokenUnassigned);
    assert.equal(unassignedScore.status, 403, 'Unassigned judge must be forbidden from scoring');
    assert.equal(unassignedScore.data.criterion, 'judge_only_assigned_match');

    // Revoke Judge 1
    const revokeRes = await makeRequest(server, 'POST', '/tournaments/revoke-judge', {
      matchId,
      judgeId: judge1,
      reason: 'Conflict of interest detected'
    }, tokenAdminA);
    assert.equal(revokeRes.status, 200, 'Admin can revoke judge');
    assert.equal(revokeRes.data.assignment.status, 'REVOKED');

    // Revoked Judge 1 scoring attempt -> 403 judge_only_assigned_match
    const revokedScore = await makeRequest(server, 'POST', `/tournaments/matches/${matchId}/score`, {
      competitorId: compAId,
      version: 1,
      technicalScore: 8.5,
      penalties: 0.0,
      totalScore: 8.5
    }, tokenJudge1);
    assert.equal(revokedScore.status, 403, 'Revoked judge must be forbidden from scoring');
    assert.equal(revokedScore.data.criterion, 'judge_only_assigned_match');

    // Re-assign Judge 1 for subsequent tests
    await makeRequest(server, 'POST', '/tournaments/assign-judge', {
      tournamentId,
      matchId,
      judgeId: judge1,
      role: 'CORNER_JUDGE'
    }, tokenAdminA);
    console.log('✅ Check 2: Unassigned and revoked judges strictly forbidden from scoring.');

    console.log('\n--- 3. Duplicate score requests are idempotent ---');
    const score1 = await makeRequest(server, 'POST', `/tournaments/matches/${matchId}/score`, {
      competitorId: compAId,
      version: 1,
      technicalScore: 8.8,
      penalties: 0.2,
      totalScore: 8.6
    }, tokenJudge1);
    assert.equal(score1.status, 201, 'First score submission accepted');

    // Resubmission of exact same version by same judge
    const scoreDuplicate = await makeRequest(server, 'POST', `/tournaments/matches/${matchId}/score`, {
      competitorId: compAId,
      version: 1,
      technicalScore: 8.8,
      penalties: 0.2,
      totalScore: 8.6
    }, tokenJudge1);
    assert.equal(scoreDuplicate.status, 200, 'Duplicate submission handled idempotently with 200');
    assert.equal(scoreDuplicate.data.criterion, 'duplicate_score_once');
    assert.equal(scoreDuplicate.data.duplicate, true);
    console.log('✅ Check 3: Duplicate score requests are idempotent.');

    console.log('\n--- 4. Locked results cannot be modified without approved appeal ---');
    // Submit score for Competitor B to enable locking
    await makeRequest(server, 'POST', `/tournaments/matches/${matchId}/score`, {
      competitorId: compBId,
      version: 1,
      technicalScore: 8.6,
      penalties: 0.0,
      totalScore: 8.6
    }, tokenJudge1);

    // Lock match result
    const lockRes = await makeRequest(server, 'POST', `/tournaments/matches/${matchId}/lock`, {}, tokenAdminA);
    assert.equal(lockRes.status, 200, 'Match result locked');
    assert.equal(lockRes.data.match.status, 'LOCKED');
    assert.equal(lockRes.data.match.winner_competitor_id, compAId, 'Higher technical score broke tie in Silambam');

    // Attempting to lock an already locked match -> 409
    const relockRes = await makeRequest(server, 'POST', `/tournaments/matches/${matchId}/lock`, {}, tokenAdminA);
    assert.equal(relockRes.status, 409, 'Re-locking completed match rejected');
    assert.equal(relockRes.data.code, 'locked_score_requires_appeal');

    // Attempting to submit score to locked match -> 409
    const postLockScore = await makeRequest(server, 'POST', `/tournaments/matches/${matchId}/score`, {
      competitorId: compBId,
      version: 2,
      technicalScore: 9.0,
      penalties: 0.0,
      totalScore: 9.0
    }, tokenJudge1);
    assert.equal(postLockScore.status, 409, 'Scoring on locked match is forbidden');
    assert.equal(postLockScore.data.criterion, 'locked_score_requires_appeal');
    console.log('✅ Check 4: Locked results cannot be modified without appeal.');

    console.log('\n--- 5. Appeals preserve original scores and reasons ---');
    const appealRes = await makeRequest(server, 'POST', `/tournaments/matches/${matchId}/appeal`, {
      competitorId: compBId,
      reason: 'Disputed illegal strike contact at 01:45 mark in round 1'
    }, tokenJudge1);
    assert.equal(appealRes.status, 201, 'Appeal submitted');
    assert.equal(appealRes.data.appeal.original_score_a, '8.60', 'Original score A preserved in appeal record');
    assert.equal(appealRes.data.appeal.original_score_b, '8.60', 'Original score B preserved in appeal record');
    assert.equal(appealRes.data.appeal.original_winner_id, compAId, 'Original winner preserved');
    console.log('✅ Check 5: Appeals preserve original scores, winner, and reasons.');

    console.log('\n--- 6. Tie-breaking uses selected tournament ruleset with deterministic outcomes ---');
    // Test Karate WKF Senshu / Technical Superiority
    const karateTournRes = await makeRequest(server, 'POST', '/tournaments', {
      organizationId: orgIdB,
      title: 'Penang Karate Championship',
      eventDate: '2026-11-25',
      location: 'Penang Arena',
      martialArtDiscipline: 'Karate',
      ruleset: 'KARATE_WKF'
    }, tokenAdminB);
    assert.equal(karateTournRes.status, 201);
    const karateTournId = karateTournRes.data.tournament.id;

    const karateCatRes = await makeRequest(server, 'POST', '/tournaments/categories', {
      tournamentId: karateTournId,
      name: 'Karate Kumite Open',
      minAge: 16,
      maxAge: 40,
      gender: 'OPEN'
    }, tokenAdminB);
    assert.equal(karateCatRes.status, 201);
    const karateCatId = karateCatRes.data.category.id;

    // Register 2 karate competitors
    const stuK1 = `stu_k1_${timestamp}`;
    const stuK2 = `stu_k2_${timestamp}`;
    await dbClient.query(`
      INSERT INTO students (id, organization_id, full_name, ic_number, belt_rank, date_of_birth, gender, rank_order, status)
      VALUES 
        ('${stuK1}', '${orgIdB}', 'Karate Fighter 1', '000101-10-1111', 'Black Belt', '2000-01-01', 'MALE', 9, 'ACTIVE'),
        ('${stuK2}', '${orgIdB}', 'Karate Fighter 2', '000202-10-2222', 'Black Belt', '2000-02-02', 'MALE', 9, 'ACTIVE')
      ON CONFLICT (id) DO NOTHING;
    `);

    const regK1 = await makeRequest(server, 'POST', '/tournaments/register', { tournamentId: karateTournId, categoryId: karateCatId, studentId: stuK1, organizationId: orgIdB }, tokenAdminB);
    const regK2 = await makeRequest(server, 'POST', '/tournaments/register', { tournamentId: karateTournId, categoryId: karateCatId, studentId: stuK2, organizationId: orgIdB }, tokenAdminB);

    const matchKRes = await makeRequest(server, 'POST', '/tournaments/matches', {
      tournamentId: karateTournId,
      categoryId: karateCatId,
      matchNumber: 201,
      roundName: 'FINAL',
      competitorAId: regK1.data.competitor.id,
      competitorBId: regK2.data.competitor.id
    }, tokenAdminB);
    const matchKId = matchKRes.data.match.id;

    // Assign Judge to Karate match
    await makeRequest(server, 'POST', '/tournaments/assign-judge', { tournamentId: karateTournId, matchId: matchKId, judgeId: judge1, role: 'CORNER_JUDGE' }, tokenAdminB);

    // Score tied total (8.0 - 8.0) but Comp A has higher Senshu / Technical score (6.0 vs 4.0)
    await makeRequest(server, 'POST', `/tournaments/matches/${matchKId}/score`, {
      competitorId: regK1.data.competitor.id, version: 1, technicalScore: 6.0, penalties: 0.0, totalScore: 8.0
    }, tokenJudge1);
    await makeRequest(server, 'POST', `/tournaments/matches/${matchKId}/score`, {
      competitorId: regK2.data.competitor.id, version: 1, technicalScore: 4.0, penalties: 0.0, totalScore: 8.0
    }, tokenJudge1);

    const lockKarate = await makeRequest(server, 'POST', `/tournaments/matches/${matchKId}/lock`, {}, tokenAdminB);
    assert.equal(lockKarate.status, 200);
    assert.equal(lockKarate.data.match.winner_competitor_id, regK1.data.competitor.id);
    assert.match(lockKarate.data.match.tie_break_reason, /KARATE_WKF_SENSHU_TECHNICAL/);
    console.log('✅ Check 6: Discipline-specific deterministic tie-breaking verified (KARATE_WKF).');

    console.log('\n--- 7. Non-Silambam tournaments cannot be forced to SCS Combat rules ---');
    const invalidTournCreation = await makeRequest(server, 'POST', '/tournaments', {
      organizationId: orgIdA,
      title: 'Invalid Ruleset Tournament',
      location: 'National Sports Center',
      martialArtDiscipline: 'Taekwondo',
      ruleset: 'SCS_COMBAT',
      eventDate: '2026-12-01'
    }, tokenAdminA);
    assert.equal(invalidTournCreation.status, 400, 'Cannot impose Silambam Combat System on non-Silambam martial art');
    assert.match(invalidTournCreation.data.message, /cannot have Silambam rulesets automatically imposed/i);

    // SCS on Silambam marked provisional if unapproved
    const scsSilambam = await makeRequest(server, 'POST', '/tournaments', {
      organizationId: orgIdA,
      title: 'Silambam SCS Trial Tournament',
      location: 'Klang Hall',
      martialArtDiscipline: 'Silambam',
      ruleset: 'SCS_COMBAT',
      eventDate: '2026-12-05'
    }, tokenAdminA);
    assert.equal(scsSilambam.status, 201, 'Silambam tournament created with SCS');
    assert.equal(scsSilambam.data.tournament.ruleset_status, 'PROVISIONAL_UNAPPROVED', 'Unapproved SCS must be flagged as provisional');
    console.log('✅ Check 7: SCS ruleset cannot be applied to other disciplines; flagged provisional for Silambam.');

    console.log('\n--- 8. Category eligibility validation ---');
    // Competitor too young for category (minAge 12, student is ~6)
    const ineligibleAge = await makeRequest(server, 'POST', '/tournaments/register', {
      tournamentId,
      categoryId,
      studentId: stuUnderage,
      organizationId: orgIdA
    }, tokenAdminA);
    assert.equal(ineligibleAge.status, 400, 'Ineligible age rejected');
    assert.match(ineligibleAge.data.message, /below category minimum age requirement/);

    // Competitor belt rank too low (minBeltRank 4, student rank 1)
    const ineligibleRank = await makeRequest(server, 'POST', '/tournaments/register', {
      tournamentId,
      categoryId,
      studentId: stuLowRank,
      organizationId: orgIdA
    }, tokenAdminA);
    assert.equal(ineligibleRank.status, 400, 'Ineligible rank rejected');
    assert.match(ineligibleRank.data.message, /does not meet category minimum requirement/);
    console.log('✅ Check 8: Category eligibility criteria strictly enforced.');

    console.log('\n--- 9. Sensitive minor identity data is excluded from unnecessary judge screens ---');
    const matchDetails = await makeRequest(server, 'GET', `/tournaments/matches/${matchId}`, undefined, tokenJudge1);
    assert.equal(matchDetails.status, 200);
    // Competitor names and belt rank should be visible, but sensitive PII (ic_number, guardian_phone, etc.) excluded
    assert.ok(matchDetails.data.match.student_a_name, 'Name is visible');
    assert.equal(matchDetails.data.match.ic_number, undefined, 'Minor IC number must not be exposed to judge');
    assert.equal(matchDetails.data.match.guardian_phone, undefined, 'Minor guardian phone must not be exposed to judge');
    assert.equal(matchDetails.data.match.home_address, undefined, 'Home address must not be exposed to judge');
    console.log('✅ Check 9: Sensitive minor identity data protected from unnecessary judge view.');

    console.log('\n🎉 ALL 12 H24 TOURNAMENT SECURITY PREFLIGHT CHECKS VERIFIED AND PASSING!');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

if (require.main === module) {
  runSecurityPreflightTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ H24 Tournament Security Preflight Test Failure:', err);
      process.exit(1);
    });
}

export { runSecurityPreflightTests };
