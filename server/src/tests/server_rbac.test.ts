import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import app from '../app';
import { dbClient } from '../db/client';
import { generateAuthToken } from '../security/crypto';
import { UserRole } from '../security/rbac';

async function run() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'beltflow-rbac-'));
  await dbClient.init(dir);
  const server = app.listen(0);
  const address = server.address();
  assert(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}/api/v1`;
  const call = async (method: string, endpoint: string, body?: any, token?: string) => {
    const res = await fetch(base + endpoint, {
      method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    return { status: res.status, data: await res.json() as any };
  };
  try {
    assert.equal((await call('GET', '/auth/setup-status')).data.setupRequired, true);
    const setup = await call('POST', '/auth/setup-admin', {
      fullName: 'Platform Owner', email: 'owner@test.local', password: 'safe-password'
    });
    assert.equal(setup.status, 201);
    const superToken = setup.data.token;
    const org = async (suffix: string) => {
      const result = await call('POST', '/organizations', {
        name: `Academy ${suffix}`, state: 'Selangor', martialArtStyle: 'Silambam',
        masterName: `Admin ${suffix}`, phone: '123', email: `admin${suffix}@test.local`,
        password: 'safe-password', baseMonthlyFee: 75
      }, superToken);
      assert.equal(result.status, 201, JSON.stringify(result.data));
      const login = await call('POST', '/auth/login', { email: `admin${suffix}@test.local`, password: 'safe-password' });
      assert.equal(login.status, 200);
      return { id: result.data.organization.id as string, token: login.data.token as string };
    };
    const a = await org('a');
    const b = await org('b');
    assert.equal((await call('GET', '/students/organization/' + a.id, undefined, superToken)).status, 403);
    assert.equal((await call('GET', '/audit', undefined, superToken)).status, 200);
    assert.equal((await call('GET', '/students/organization/' + a.id, undefined, b.token)).status, 403);
    const createMaster = async (academy: typeof a, email: string) => {
      const result = await call('POST', '/coaches', {
        organizationId: academy.id, fullName: email, email, password: 'safe-password'
      }, academy.token);
      assert.equal(result.status, 201, JSON.stringify(result.data));
      const login = await call('POST', '/auth/login', { email, password: 'safe-password' });
      return { id: result.data.coach.id as string, token: login.data.token as string };
    };
    const master = await createMaster(a, 'mastera@test.local');
    const otherMaster = await createMaster(b, 'masterb@test.local');
    const cls = await call('POST', '/classes', {
      organizationId: a.id, name: 'Class A', schedule: 'Saturday', location: 'Hall', mainMasterId: master.id
    }, a.token);
    assert.equal(cls.status, 201);
    const classId = cls.data.class.id;
    const reg = await call('POST', '/auth/register-student', {
      organizationId: a.id, classId, fullName: 'Student A', email: 'student@test.local', password: 'safe-password'
    });
    assert.equal(reg.status, 201);
    assert.equal(reg.data.user.role, 'STUDENT');
    assert.equal(reg.data.token, undefined);
    const studentId = reg.data.user.studentId;
    assert.equal((await call('POST', '/auth/login', { email: 'student@test.local', password: 'safe-password' })).status, 403);
    const forgedPending = generateAuthToken({ id: reg.data.user.id, email: 'student@test.local', role: UserRole.STUDENT, organizationId: a.id });
    assert.equal((await call('GET', '/students/me', undefined, forgedPending)).status, 403);
    assert.equal((await call('POST', `/auth/student-registrations/${studentId}/approve`, {}, otherMaster.token)).status, 403);
    assert.equal((await call('POST', `/auth/student-registrations/${studentId}/approve`, {}, a.token)).status, 403);
    assert.equal((await call('POST', `/auth/student-registrations/${studentId}/approve`, {}, master.token)).status, 200);
    const studentLogin = await call('POST', '/auth/login', { email: 'student@test.local', password: 'safe-password' });
    assert.equal(studentLogin.status, 200);
    const studentToken = studentLogin.data.token;
    assert.equal((await call('GET', '/students/me', undefined, studentToken)).status, 200);
    const parent = await call('POST', '/auth/register-parent', {
      organizationId: a.id, studentId, fullName: 'Parent A', email: 'parent@test.local', password: 'safe-password'
    });
    assert.equal(parent.status, 201);
    const parentToken = parent.data.token;
    const linkId = parent.data.linkRequest.id;
    const otherStudent = await call('POST', '/students', {
      organizationId: a.id, classId, fullName: 'Other Student', email: 'otherstudent@test.local',
      password: 'safe-password', icNumber: 'TEST-OTHER'
    }, a.token);
    assert.equal(otherStudent.status, 201);
    const otherStudentLogin = await call('POST', '/auth/login', { email: 'otherstudent@test.local', password: 'safe-password' });
    assert.equal(otherStudentLogin.status, 200);
    assert.equal((await call('GET', '/students/' + studentId, undefined, parentToken)).status, 403);
    assert.equal((await call('POST', `/auth/parent-link-requests/${linkId}/approve`, {}, otherMaster.token)).status, 403);
    assert.equal((await call('POST', `/auth/parent-link-requests/${linkId}/approve`, {}, b.token)).status, 403);
    assert.equal((await call('POST', `/auth/parent-link-requests/${linkId}/approve`, {}, otherStudentLogin.data.token)).status, 403);
    assert.equal((await call('POST', `/auth/parent-link-requests/${linkId}/approve`, {}, studentToken)).data.status, 'PENDING_MASTER');
    assert.equal((await call('POST', `/auth/parent-link-requests/${linkId}/approve`, {}, master.token)).data.status, 'PENDING_ADMIN');
    assert.equal((await call('POST', `/auth/parent-link-requests/${linkId}/approve`, {}, a.token)).data.status, 'ACTIVE');
    assert.equal((await call('GET', '/students/' + studentId, undefined, parentToken)).status, 200);
    assert.equal((await call('POST', `/auth/parent-links/${linkId}/revoke`, {}, studentToken)).status, 200);
    assert.equal((await call('GET', '/students/' + studentId, undefined, parentToken)).status, 403);
    const amount = await call('POST', '/billing/submit-payment', { studentId, amount: 75, method: 'Bank transfer', proofNotes: 'transfer reference' }, studentToken);
    assert.equal(amount.status, 201);
    assert.equal((await call('POST', `/billing/${amount.data.payment.id}/approve`, {}, otherMaster.token)).status, 403);
    assert.equal((await call('POST', `/billing/${amount.data.payment.id}/approve`, {}, master.token)).status, 200);
    assert.equal((await call('POST', `/billing/${amount.data.payment.id}/approve`, {}, master.token)).status, 409);
    const grading = await call('POST', '/grading', {
      organizationId: a.id, title: 'Test Grading', eventDate: '2026-09-20', location: 'Hall', fee: 20
    }, a.token);
    assert.equal(grading.status, 201);
    const eventId = grading.data.event.id;
    assert.equal((await call('POST', `/grading/${eventId}/register`, { studentId, targetBelt: 'Yellow Belt' }, a.token)).status, 403);
    assert.equal((await call('POST', `/grading/${eventId}/register`, { studentId, targetBelt: 'Yellow Belt' }, studentToken)).status, 201);
    assert.equal((await call('POST', `/grading/${eventId}/score`, { results: [{ studentId, result: 'Passed', targetBelt: 'Yellow Belt' }] }, otherMaster.token)).status, 403);
    const promotion = await call('POST', `/grading/${eventId}/score`, {
      results: [{ studentId, result: 'Passed', targetBelt: 'Yellow Belt' }]
    }, master.token);
    assert.equal(promotion.status, 200);
    const code = promotion.data.issuedCertificates[0].code;
    assert.equal((await call('POST', '/certificates/verify', { code }, superToken)).status, 403);
    assert.equal((await call('POST', '/certificates/verify', { code }, parentToken)).status, 403);
    assert.equal((await call('POST', '/certificates/verify', { code }, studentToken)).status, 200);
    assert.equal((await call('GET', '/certificates/student/' + studentId, undefined, studentToken)).status, 200);
    assert.equal((await call('GET', '/certificates/student/' + studentId, undefined, parentToken)).status, 403);
    const newMaster = await createMaster(a, 'newmaster@test.local');
    const newClass = await call('POST', '/classes', {
      organizationId: a.id, name: 'Class B', schedule: 'Sunday', location: 'Hall B', mainMasterId: newMaster.id
    }, a.token);
    assert.equal(newClass.status, 201);
    const transfer = await call('POST', `/students/${studentId}/transfer-requests`, {
      newClassId: newClass.data.class.id
    }, studentToken);
    assert.equal(transfer.status, 201);
    const transferId = transfer.data.transfer.id;
    assert.equal((await call('POST', `/students/transfer-requests/${transferId}/approve`, {}, newMaster.token)).status, 403);
    assert.equal((await call('POST', `/students/transfer-requests/${transferId}/approve`, {}, b.token)).status, 403);
    assert.equal((await call('POST', `/students/transfer-requests/${transferId}/approve`, {}, master.token)).data.status, 'PENDING_NEW_MASTER');
    assert.equal((await call('POST', `/students/transfer-requests/${transferId}/approve`, {}, master.token)).status, 403);
    assert.equal((await call('POST', `/students/transfer-requests/${transferId}/approve`, {}, newMaster.token)).data.status, 'APPROVED');
    assert.equal((await call('GET', '/students/' + studentId, undefined, master.token)).status, 403);
    assert.equal((await call('GET', '/students/' + studentId, undefined, newMaster.token)).status, 200);
    await dbClient.close();
    await dbClient.init(dir);
    assert.equal((await call('GET', '/students/me', undefined, studentToken)).status, 200);
    console.log('PASS route RBAC, pending activation, parent approval/revocation, transfer, payment, grading, certificate and restart persistence');
  } finally {
    server.close();
    await dbClient.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

run().catch(error => { console.error(error); process.exitCode = 1; });
