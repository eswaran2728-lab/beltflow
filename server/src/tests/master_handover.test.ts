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
  extraHeaders?: Record<string, string>
): Promise<{ status: number; body: any; headers: http.IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    const address = server.address() as any;
    const postData = body ? JSON.stringify(body) : '';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData).toString(),
      ...(extraHeaders || {}),
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(
      {
        host: '127.0.0.1',
        port: address.port,
        path: `/api/v1${path}`,
        method,
        headers,
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          let parsed: any;
          try {
            parsed = JSON.parse(raw);
          } catch {
            parsed = raw;
          }
          resolve({ status: res.statusCode || 500, body: parsed, headers: res.headers });
        });
      }
    );

    req.on('error', reject);
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

const ts = Date.now();
const orgSelangor = `org_h07_sel_${ts}`;
const orgPenang = `org_h07_pen_${ts}`;

const superAdmin = {
  id: `usr_h07_super_${ts}`,
  email: `super_${ts}@beltflow.my`,
  role: UserRole.SUPER_ADMIN,
  organizationId: undefined,
};

const adminSelangor = {
  id: `usr_h07_adm_sel_${ts}`,
  email: `admin_sel_${ts}@selangor.my`,
  role: UserRole.ADMIN_PERSATUAN,
  organizationId: orgSelangor,
};

const adminPenang = {
  id: `usr_h07_adm_pen_${ts}`,
  email: `admin_pen_${ts}@penang.my`,
  role: UserRole.ADMIN_PERSATUAN,
  organizationId: orgPenang,
};

const masterOutgoing = {
  id: `usr_h07_out_${ts}`,
  fullName: 'Master Outgoing Kumar',
  email: `out_${ts}@selangor.my`,
  role: UserRole.MASTER,
  organizationId: orgSelangor,
};

const masterIncoming = {
  id: `usr_h07_in_${ts}`,
  fullName: 'Master Incoming Tan',
  email: `in_${ts}@selangor.my`,
  role: UserRole.MASTER,
  organizationId: orgSelangor,
};

const masterSuspended = {
  id: `usr_h07_susp_${ts}`,
  fullName: 'Master Suspended Ali',
  email: `susp_${ts}@selangor.my`,
  role: UserRole.MASTER,
  organizationId: orgSelangor,
};

const masterPenang = {
  id: `usr_h07_pen_${ts}`,
  fullName: 'Master Penang Lee',
  email: `pen_${ts}@penang.my`,
  role: UserRole.MASTER,
  organizationId: orgPenang,
};

const masterSubstitute = {
  id: `usr_h07_sub_${ts}`,
  fullName: 'Master Substitute Raj',
  email: `sub_${ts}@selangor.my`,
  role: UserRole.MASTER,
  organizationId: orgSelangor,
};

const regularStudent = {
  id: `usr_h07_stu_${ts}`,
  email: `stu_${ts}@selangor.my`,
  role: UserRole.STUDENT,
  organizationId: orgSelangor,
};

const tokenSuper = generateAuthToken(superAdmin);
const tokenAdminSel = generateAuthToken(adminSelangor);
const tokenAdminPen = generateAuthToken(adminPenang);
const tokenOutgoing = generateAuthToken(masterOutgoing);
const tokenIncoming = generateAuthToken(masterIncoming);
const tokenSuspended = generateAuthToken(masterSuspended);
const tokenPenangMaster = generateAuthToken(masterPenang);
const tokenSubstitute = generateAuthToken(masterSubstitute);
const tokenStudent = generateAuthToken(regularStudent);

const testClassId = `cls_h07_${ts}`;

async function setup() {
  await dbClient.init();

  // Create Organizations
  await dbClient.query(
    `INSERT INTO organizations (id, name, state, martial_art_style, master_name, phone, email, status)
     VALUES ($1, 'Persatuan Silambam Selangor', 'Selangor', 'Silambam', 'Master Guru Selangor', '0123456789', $3, 'ACTIVE'),
            ($2, 'Persatuan Silambam Penang', 'Penang', 'Silambam', 'Master Guru Penang', '0198765432', $4, 'ACTIVE')
     ON CONFLICT (id) DO NOTHING`,
    [orgSelangor, orgPenang, `sel_${ts}@beltflow.my`, `pen_${ts}@beltflow.my`]
  );

  // Create Users
  const allUsers = [
    superAdmin, adminSelangor, adminPenang, masterOutgoing,
    masterIncoming, masterSuspended, masterPenang, masterSubstitute, regularStudent,
  ];
  for (const u of allUsers) {
    await dbClient.query(
      `INSERT INTO users (id, email, password_hash, role, organization_id, full_name, status)
       VALUES ($1, $2, 'hash', $3, $4, $5, 'ACTIVE')
       ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, organization_id = EXCLUDED.organization_id`,
      [u.id, u.email, u.role, (u as any).organizationId || null, (u as any).fullName || u.email]
    );
  }

  // Create Affiliations
  await dbClient.query('DELETE FROM master_affiliations WHERE organization_id IN ($1, $2)', [orgSelangor, orgPenang]);
  await dbClient.query(
    `INSERT INTO master_affiliations (id, master_id, organization_id, status, reviewed_by) VALUES
      ($10, $1, $3, 'ACTIVE', $5),
      ($11, $2, $3, 'ACTIVE', $5),
      ($12, $6, $3, 'SUSPENDED', $5),
      ($13, $7, $4, 'ACTIVE', $8),
      ($14, $9, $3, 'ACTIVE', $5)`,
    [
      masterOutgoing.id, masterIncoming.id, orgSelangor, orgPenang,
      adminSelangor.id, masterSuspended.id, masterPenang.id, adminPenang.id, masterSubstitute.id,
      `aff_out_${ts}`, `aff_in_${ts}`, `aff_susp_${ts}`, `aff_pen_${ts}`, `aff_sub_${ts}`,
    ]
  );

  // Create Target Class
  await dbClient.query('DELETE FROM classes WHERE id = $1', [testClassId]);
  await dbClient.query(
    `INSERT INTO classes (id, organization_id, name, schedule, location, capacity, approval_status, operational_status, enrollment_availability, master_id, version)
     VALUES ($1, $2, 'Silambam Advanced Squad', 'Mon 7PM', 'Shah Alam Complex', 30, 'APPROVED', 'ACTIVE', 'OPEN', $3, 1)`,
    [testClassId, orgSelangor, masterOutgoing.id]
  );

  // Set Primary Leadership for Outgoing Master
  await dbClient.query('DELETE FROM class_leaderships WHERE class_id = $1', [testClassId]);
  await dbClient.query(
    `INSERT INTO class_leaderships (id, class_id, master_id, organization_id, leadership_type, effective_from, is_active, provenance)
     VALUES ($4, $1, $2, $3, 'PRIMARY', CURRENT_TIMESTAMP - INTERVAL '30 days', TRUE, 'DIRECT_ASSIGNMENT')`,
    [testClassId, masterOutgoing.id, orgSelangor, `lead_out_${ts}`]
  );

  // Clean handovers
  await dbClient.query('DELETE FROM class_handover_requests WHERE class_id = $1', [testClassId]);
}

async function runTests() {
  console.log('🚀 Starting H07 Class Leadership Handover & Delegation Test Suite...');
  await setup();

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));

  try {
    let activeHandoverId = '';

    // --------------------------------------------------------------------------
    // Test 1: Outgoing Primary Master initiates handover to active same-org Master
    // --------------------------------------------------------------------------
    console.log('Test 1: Outgoing Primary Master initiates handover...');
    const res1 = await makeRequest(
      server,
      'POST',
      `/classes/${testClassId}/handover`,
      {
        incomingMasterId: masterIncoming.id,
        reason: 'Relocation to another training centre',
        effectiveDate: new Date().toISOString(),
      },
      tokenOutgoing
    );
    assert.strictEqual(res1.status, 201, `Expected 201, got ${res1.status}: ${JSON.stringify(res1.body)}`);
    assert.strictEqual(res1.body.handover.status, 'REQUESTED');
    assert.strictEqual(res1.body.handover.incoming_master_id, masterIncoming.id);
    activeHandoverId = res1.body.handover.id;

    // --------------------------------------------------------------------------
    // Test 2: Cross-Persatuan incoming Master rejected
    // --------------------------------------------------------------------------
    console.log('Test 2: Cross-Persatuan incoming Master rejected...');
    const res2 = await makeRequest(
      server,
      'POST',
      `/classes/${testClassId}/handover`,
      {
        incomingMasterId: masterPenang.id,
        reason: 'Cross org attempt',
      },
      tokenOutgoing
    );
    assert.strictEqual(res2.status, 400);
    assert.match(res2.body.error, /ACTIVE verified affiliation with this Persatuan/i);

    // --------------------------------------------------------------------------
    // Test 3: Suspended incoming Master rejected
    // --------------------------------------------------------------------------
    console.log('Test 3: Suspended incoming Master rejected...');
    const res3 = await makeRequest(
      server,
      'POST',
      `/classes/${testClassId}/handover`,
      {
        incomingMasterId: masterSuspended.id,
        reason: 'Suspended master attempt',
      },
      tokenOutgoing
    );
    assert.strictEqual(res3.status, 400);
    assert.match(res3.body.error, /ACTIVE verified affiliation/i);

    // --------------------------------------------------------------------------
    // Test 4: Self-handover (same incoming & outgoing Master) rejected
    // --------------------------------------------------------------------------
    console.log('Test 4: Self-handover rejected...');
    const res4 = await makeRequest(
      server,
      'POST',
      `/classes/${testClassId}/handover`,
      {
        incomingMasterId: masterOutgoing.id,
        reason: 'Self handover',
      },
      tokenOutgoing
    );
    assert.strictEqual(res4.status, 400);
    assert.match(res4.body.error, /same outgoing Master/i);

    // --------------------------------------------------------------------------
    // Test 5: Simultaneous active handovers on same class rejected (HTTP 409)
    // --------------------------------------------------------------------------
    console.log('Test 5: Simultaneous active handovers rejected with 409 Conflict...');
    const res5 = await makeRequest(
      server,
      'POST',
      `/classes/${testClassId}/handover`,
      {
        incomingMasterId: masterIncoming.id,
        reason: 'Duplicate handover request',
      },
      tokenOutgoing
    );
    assert.strictEqual(res5.status, 409);
    assert.match(res5.body.error, /pending handover request already exists/i);

    // --------------------------------------------------------------------------
    // Test 6: Super Admin denied operational handover initiation (HTTP 403)
    // --------------------------------------------------------------------------
    console.log('Test 6: Super Admin denied operational handover initiation...');
    const res6 = await makeRequest(
      server,
      'POST',
      `/classes/${testClassId}/handover`,
      {
        incomingMasterId: masterIncoming.id,
      },
      tokenSuper
    );
    assert.strictEqual(res6.status, 403);

    // --------------------------------------------------------------------------
    // Test 7: Incoming Master views incoming handover in /handovers/incoming
    // --------------------------------------------------------------------------
    console.log('Test 7: Incoming Master views pending incoming handovers...');
    const res7 = await makeRequest(server, 'GET', '/handovers/incoming', undefined, tokenIncoming);
    assert.strictEqual(res7.status, 200);
    assert.ok(res7.body.incomingHandovers.length >= 1);
    assert.strictEqual(res7.body.incomingHandovers[0].id, activeHandoverId);

    // --------------------------------------------------------------------------
    // Test 8: Wrong Master cannot accept incoming handover (HTTP 403)
    // --------------------------------------------------------------------------
    console.log('Test 8: Wrong Master cannot accept incoming handover...');
    const res8 = await makeRequest(
      server,
      'POST',
      `/handovers/${activeHandoverId}/accept`,
      {},
      tokenSubstitute
    );
    assert.strictEqual(res8.status, 403);
    assert.match(res8.body.error, /designated incoming Master/i);

    // --------------------------------------------------------------------------
    // Test 9: Incoming Master accepts handover -> status INCOMING_ACCEPTED
    // --------------------------------------------------------------------------
    console.log('Test 9: Incoming Master accepts handover...');
    const res9 = await makeRequest(
      server,
      'POST',
      `/handovers/${activeHandoverId}/accept`,
      {},
      tokenIncoming
    );
    assert.strictEqual(res9.status, 200);

    const check9 = await dbClient.query('SELECT status FROM class_handover_requests WHERE id = $1', [activeHandoverId]);
    assert.strictEqual(check9.rows[0].status, 'INCOMING_ACCEPTED');

    // --------------------------------------------------------------------------
    // Test 10: Persatuan Admin views handover in /handovers/admin
    // --------------------------------------------------------------------------
    console.log('Test 10: Persatuan Admin views approval inbox...');
    const res10 = await makeRequest(server, 'GET', '/handovers/admin', undefined, tokenAdminSel);
    assert.strictEqual(res10.status, 200);
    assert.ok(res10.body.pendingHandovers.some((h: any) => h.id === activeHandoverId));

    // --------------------------------------------------------------------------
    // Test 11: Wrong Persatuan Admin cannot approve handover (HTTP 403)
    // --------------------------------------------------------------------------
    console.log('Test 11: Wrong Persatuan Admin rejected from approval...');
    const res11 = await makeRequest(
      server,
      'POST',
      `/handovers/${activeHandoverId}/approve`,
      {},
      tokenAdminPen
    );
    assert.strictEqual(res11.status, 403);
    assert.match(res11.body.error, /Cross-Persatuan/i);

    // --------------------------------------------------------------------------
    // Test 12: Persatuan Admin approves handover -> ATOMIC switch
    // --------------------------------------------------------------------------
    console.log('Test 12: Persatuan Admin approves handover with atomic execution...');
    const res12 = await makeRequest(
      server,
      'POST',
      `/handovers/${activeHandoverId}/approve`,
      {},
      tokenAdminSel
    );
    assert.strictEqual(res12.status, 200);
    assert.strictEqual(res12.body.newPrimaryMasterId, masterIncoming.id);

    // Verify DB state:
    // Outgoing leadership ended
    const leadOut = await dbClient.query(
      `SELECT * FROM class_leaderships WHERE class_id = $1 AND master_id = $2`,
      [testClassId, masterOutgoing.id]
    );
    assert.strictEqual(leadOut.rows[0].is_active, false);
    assert.ok(leadOut.rows[0].effective_to !== null);

    // Incoming leadership active primary
    const leadIn = await dbClient.query(
      `SELECT * FROM class_leaderships WHERE class_id = $1 AND master_id = $2 AND is_active = TRUE`,
      [testClassId, masterIncoming.id]
    );
    assert.strictEqual(leadIn.rowCount, 1);
    assert.strictEqual(leadIn.rows[0].leadership_type, 'PRIMARY');
    assert.strictEqual(leadIn.rows[0].provenance, 'HANDOVER');

    // Legacy class pointer updated and version incremented
    const clsCheck = await dbClient.query('SELECT master_id, version FROM classes WHERE id = $1', [testClassId]);
    assert.strictEqual(clsCheck.rows[0].master_id, masterIncoming.id);
    assert.strictEqual(clsCheck.rows[0].version, 2);

    // Handover status completed
    const handCheck = await dbClient.query('SELECT status, completed_at FROM class_handover_requests WHERE id = $1', [activeHandoverId]);
    assert.strictEqual(handCheck.rows[0].status, 'COMPLETED');
    assert.ok(handCheck.rows[0].completed_at !== null);

    // Audit log recorded
    const auditRes = await dbClient.query(
      `SELECT * FROM audit_logs WHERE action = 'Class Leadership Handover Completed' AND details LIKE '%${testClassId}%'`
    );
    assert.ok(auditRes.rowCount >= 1);

    // Outbox recorded
    const outboxRes = await dbClient.query(
      `SELECT * FROM notification_outbox WHERE event_type = 'ClassHandoverCompleted' AND aggregate_id = $1`,
      [activeHandoverId]
    );
    assert.ok(outboxRes.rowCount >= 1);

    // --------------------------------------------------------------------------
    // Test 13: Former outgoing Master immediately denied operational workspace
    // --------------------------------------------------------------------------
    console.log('Test 13: Former outgoing Master denied operational workspace access...');
    const res13 = await makeRequest(server, 'GET', `/classes/${testClassId}/workspace`, undefined, tokenOutgoing);
    assert.strictEqual(res13.status, 403);
    assert.match(res13.body.error, /not authorized/i);

    // --------------------------------------------------------------------------
    // Test 14: Incoming Master immediately granted operational workspace access
    // --------------------------------------------------------------------------
    console.log('Test 14: Incoming Master granted operational workspace access...');
    const res14 = await makeRequest(server, 'GET', `/classes/${testClassId}/workspace`, undefined, tokenIncoming);
    assert.strictEqual(res14.status, 200);
    assert.strictEqual(res14.body.class.master_id, masterIncoming.id);

    // --------------------------------------------------------------------------
    // Test 15: Temporary substitute delegation creation
    // --------------------------------------------------------------------------
    console.log('Test 15: Primary Master assigns temporary substitute...');
    const now = new Date();
    const validFrom = new Date(now.getTime() - 1000 * 60).toISOString(); // 1 min ago
    const validUntil = new Date(now.getTime() + 1000 * 60 * 60 * 24).toISOString(); // 24 hours later

    const res15 = await makeRequest(
      server,
      'POST',
      `/classes/${testClassId}/delegation`,
      {
        substituteMasterId: masterSubstitute.id,
        validFrom,
        validUntil,
        capabilities: 'ATTENDANCE_ONLY',
        notes: 'Covering Wednesday training session',
      },
      tokenIncoming // current primary master
    );
    assert.strictEqual(res15.status, 201);
    const delegationId = res15.body.delegationId;

    // --------------------------------------------------------------------------
    // Test 16: Temporary substitute granted operational access within time window
    // --------------------------------------------------------------------------
    console.log('Test 16: Substitute granted operational access within time window...');
    const res16 = await makeRequest(server, 'GET', `/classes/${testClassId}/workspace`, undefined, tokenSubstitute);
    assert.strictEqual(res16.status, 200);

    // --------------------------------------------------------------------------
    // Test 17: Temporary substitute CANNOT initiate permanent handover
    // --------------------------------------------------------------------------
    console.log('Test 17: Substitute Master cannot initiate permanent handover...');
    const res17 = await makeRequest(
      server,
      'POST',
      `/classes/${testClassId}/handover`,
      {
        incomingMasterId: masterOutgoing.id,
        reason: 'Substitute illegal handover',
      },
      tokenSubstitute
    );
    assert.strictEqual(res17.status, 403);
    assert.match(res17.body.error, /Only current Primary Master can initiate class handover/i);

    // --------------------------------------------------------------------------
    // Test 18: Expired substitute delegation denied operational access
    // --------------------------------------------------------------------------
    console.log('Test 18: Expired substitute delegation denied operational access...');
    // Update effective_to to past
    await dbClient.query(
      `UPDATE class_leaderships SET effective_to = CURRENT_TIMESTAMP - INTERVAL '1 hour' WHERE id = $1`,
      [delegationId]
    );
    const res18 = await makeRequest(server, 'GET', `/classes/${testClassId}/workspace`, undefined, tokenSubstitute);
    assert.strictEqual(res18.status, 403);

    // --------------------------------------------------------------------------
    // Test 19: Handover rejection preserves decision history
    // --------------------------------------------------------------------------
    console.log('Test 19: Handover rejection preserves decision history...');
    // Initiate second handover
    const reqNew = await makeRequest(
      server,
      'POST',
      `/classes/${testClassId}/handover`,
      {
        incomingMasterId: masterOutgoing.id,
        reason: 'Return handover',
      },
      tokenIncoming
    );
    assert.strictEqual(reqNew.status, 201);
    const handId2 = reqNew.body.handover.id;

    // Reject by incoming master
    const res19 = await makeRequest(
      server,
      'POST',
      `/handovers/${handId2}/reject`,
      { rejectionReason: 'Cannot take class at this time' },
      tokenOutgoing
    );
    assert.strictEqual(res19.status, 200);

    const check19 = await dbClient.query('SELECT status, rejection_reason FROM class_handover_requests WHERE id = $1', [handId2]);
    assert.strictEqual(check19.rows[0].status, 'REJECTED');
    assert.strictEqual(check19.rows[0].rejection_reason, 'Cannot take class at this time');

    console.log('✅ All H07 Class Leadership Handover & Delegation Tests Passed Successfully!');
    process.exit(0);
  } finally {
    server.close();
  }
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
