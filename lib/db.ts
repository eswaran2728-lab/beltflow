/* eslint-disable @typescript-eslint/no-explicit-any */
// BeltFlow v2 data layer — all access via Supabase with RLS enforced server-side.
import { supabase } from './supabase';
import {
  Academy, Belt, Branch, ClassRow, Student, Guardian, ClassSession, AttendanceRow,
  Invoice, Payment, GradingEvent, GradingResult, Skill, StudentSkill, Tournament,
  TournamentResult, StudentNote, AppNotification, Certificate,
  AttendanceStatus, SkillLevel, GradingResultType, InvoiceStatus, PaymentMethod,
  ageFromDob, firstOfMonth,
} from './types';

type Row = Record<string, any>;
function fail(e: { message: string } | null): never { throw new Error(e?.message || 'Database error'); }

// ---------- Mappers ----------
const mapAcademy = (r: Row): Academy => ({
  id: r.id, name: r.name, description: r.description ?? '', logoUrl: r.logo_url ?? undefined,
  monthlyFeeDefault: Number(r.monthly_fee_default),
});
const mapBelt = (r: Row): Belt => ({ id: r.id, name: r.name, colorHex: r.color_hex ?? '#999', sortOrder: r.sort_order });
const mapBranch = (r: Row): Branch => ({ id: r.id, name: r.name, address: r.address ?? '' });

// ---------- Academy / config ----------
export async function getAcademy(): Promise<Academy | null> {
  const { data, error } = await supabase.from('academies').select('*').limit(1).maybeSingle();
  if (error) fail(error);
  return data ? mapAcademy(data) : null;
}
export async function updateAcademy(id: string, patch: Partial<Academy>) {
  const row: Row = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.description !== undefined) row.description = patch.description;
  if (patch.monthlyFeeDefault !== undefined) row.monthly_fee_default = patch.monthlyFeeDefault;
  if (patch.logoUrl !== undefined) row.logo_url = patch.logoUrl;
  const { error } = await supabase.from('academies').update(row).eq('id', id);
  if (error) fail(error);
}

export async function getBelts(): Promise<Belt[]> {
  const { data, error } = await supabase.from('belts').select('*').order('sort_order');
  if (error) fail(error);
  return (data as Row[]).map(mapBelt);
}
export async function addBelt(academyId: string, name: string, colorHex: string, sortOrder: number) {
  const { error } = await supabase.from('belts').insert({ academy_id: academyId, name, color_hex: colorHex, sort_order: sortOrder });
  if (error) fail(error);
}
export async function deleteBelt(id: string) {
  const { error } = await supabase.from('belts').delete().eq('id', id);
  if (error) fail(error);
}

export async function getBranches(): Promise<Branch[]> {
  const { data, error } = await supabase.from('branches').select('*').order('name');
  if (error) fail(error);
  return (data as Row[]).map(mapBranch);
}
export async function addBranch(academyId: string, name: string, address: string) {
  const { error } = await supabase.from('branches').insert({ academy_id: academyId, name, address });
  if (error) fail(error);
}
export async function deleteBranch(id: string) {
  const { error } = await supabase.from('branches').delete().eq('id', id);
  if (error) fail(error);
}

// ---------- Classes (with coaches) ----------
export async function getClasses(): Promise<ClassRow[]> {
  const { data, error } = await supabase
    .from('classes')
    .select('*, class_coaches(coach_profile_id, profiles(full_name))')
    .order('name');
  if (error) fail(error);
  return (data as Row[]).map(r => ({
    id: r.id, branchId: r.branch_id, name: r.name,
    dayOfWeek: r.day_of_week, startTime: r.start_time, endTime: r.end_time,
    scheduleNote: r.schedule_note ?? '', monthlyFeeOverride: r.monthly_fee_override,
    coachIds: (r.class_coaches ?? []).map((c: Row) => c.coach_profile_id),
    coachNames: (r.class_coaches ?? []).map((c: Row) => c.profiles?.full_name).filter(Boolean),
  }));
}
export async function addClass(academyId: string, c: {
  name: string; branchId: string | null; dayOfWeek: number | null;
  startTime: string | null; endTime: string | null; scheduleNote: string; monthlyFeeOverride: number | null;
}) {
  const { error } = await supabase.from('classes').insert({
    academy_id: academyId, name: c.name, branch_id: c.branchId, day_of_week: c.dayOfWeek,
    start_time: c.startTime, end_time: c.endTime, schedule_note: c.scheduleNote,
    monthly_fee_override: c.monthlyFeeOverride,
  });
  if (error) fail(error);
}
export async function deleteClass(id: string) {
  const { error } = await supabase.from('classes').delete().eq('id', id);
  if (error) fail(error);
}
/** Coach (or admin) sets the monthly fee for a class. Enforced server-side. */
export async function setClassFee(classId: string, fee: number) {
  const { error } = await supabase.rpc('set_class_fee', { p_class_id: classId, p_fee: fee });
  if (error) fail(error);
}
export async function assignCoach(classId: string, coachProfileId: string) {
  const { error } = await supabase.from('class_coaches').insert({ class_id: classId, coach_profile_id: coachProfileId });
  if (error) fail(error);
}
export async function unassignCoach(classId: string, coachProfileId: string) {
  const { error } = await supabase.from('class_coaches').delete()
    .eq('class_id', classId).eq('coach_profile_id', coachProfileId);
  if (error) fail(error);
}

// ---------- Students (with belt + enrollments) ----------
function mapStudent(r: Row, belts: Belt[]): Student {
  const belt = belts.find(b => b.id === r.belt_id);
  const enrollments = (r.enrollments ?? []).filter((e: Row) => !e.ended_at);
  return {
    id: r.id, profileId: r.profile_id, fullName: r.full_name, icOrMykid: r.ic_or_mykid ?? '',
    dateOfBirth: r.date_of_birth, age: ageFromDob(r.date_of_birth), gender: r.gender ?? '',
    beltId: r.belt_id, beltName: belt?.name ?? '—', lifecycle: r.lifecycle,
    joinedAt: r.joined_at, photoUrl: r.photo_url ?? undefined, medicalNotes: r.medical_notes ?? '',
    classIds: enrollments.map((e: Row) => e.class_id),
    classNames: enrollments.map((e: Row) => e.classes?.name).filter(Boolean),
  };
}

export async function getStudents(): Promise<Student[]> {
  const [belts, res] = await Promise.all([
    getBelts(),
    supabase.from('students').select('*, enrollments(class_id, ended_at, classes(name))').order('full_name'),
  ]);
  if (res.error) fail(res.error);
  return (res.data as Row[]).map(r => mapStudent(r, belts));
}

export async function getStudent(id: string): Promise<Student | null> {
  const [belts, res] = await Promise.all([
    getBelts(),
    supabase.from('students').select('*, enrollments(class_id, ended_at, classes(name))').eq('id', id).maybeSingle(),
  ]);
  if (res.error) fail(res.error);
  return res.data ? mapStudent(res.data, belts) : null;
}

export async function addStudent(academyId: string, s: {
  fullName: string; icOrMykid: string; dateOfBirth: string | null; gender: string;
  beltId: string | null; lifecycle: string; classIds: string[]; medicalNotes?: string;
}): Promise<string> {
  const { data, error } = await supabase.from('students').insert({
    academy_id: academyId, full_name: s.fullName, ic_or_mykid: s.icOrMykid,
    date_of_birth: s.dateOfBirth, gender: s.gender, belt_id: s.beltId,
    lifecycle: s.lifecycle, medical_notes: s.medicalNotes ?? null,
  }).select('id').single();
  if (error) fail(error);
  const studentId = (data as Row).id as string;
  if (s.classIds.length) {
    const { error: e2 } = await supabase.from('enrollments').insert(
      s.classIds.map(cid => ({ student_id: studentId, class_id: cid })),
    );
    if (e2) fail(e2);
  }
  return studentId;
}

export async function updateStudent(id: string, patch: Partial<Student>) {
  const row: Row = {};
  if (patch.fullName !== undefined) row.full_name = patch.fullName;
  if (patch.icOrMykid !== undefined) row.ic_or_mykid = patch.icOrMykid;
  if (patch.dateOfBirth !== undefined) row.date_of_birth = patch.dateOfBirth;
  if (patch.gender !== undefined) row.gender = patch.gender;
  if (patch.beltId !== undefined) row.belt_id = patch.beltId;
  if (patch.lifecycle !== undefined) row.lifecycle = patch.lifecycle;
  if (patch.medicalNotes !== undefined) row.medical_notes = patch.medicalNotes;
  const { error } = await supabase.from('students').update(row).eq('id', id);
  if (error) fail(error);
}

export async function setEnrollments(studentId: string, classIds: string[]) {
  await supabase.from('enrollments').delete().eq('student_id', studentId);
  if (classIds.length) {
    const { error } = await supabase.from('enrollments').insert(
      classIds.map(cid => ({ student_id: studentId, class_id: cid })),
    );
    if (error) fail(error);
  }
}

// ---------- Guardians (parent <-> student) ----------
export async function getGuardiansForStudent(studentId: string): Promise<Guardian[]> {
  const { data, error } = await supabase
    .from('guardian_link')
    .select('*, profiles(full_name, phone)')
    .eq('student_id', studentId);
  if (error) fail(error);
  return (data as Row[]).map(r => ({
    parentProfileId: r.parent_profile_id, parentName: r.profiles?.full_name ?? '',
    parentPhone: r.profiles?.phone ?? '', studentId: r.student_id,
    relationship: r.relationship, isPrimaryPayer: r.is_primary_payer,
  }));
}
export async function linkGuardian(parentProfileId: string, studentId: string, relationship: string, isPrimaryPayer: boolean) {
  const { error } = await supabase.from('guardian_link').upsert({
    parent_profile_id: parentProfileId, student_id: studentId,
    relationship, is_primary_payer: isPrimaryPayer,
  }, { onConflict: 'parent_profile_id,student_id' });
  if (error) fail(error);
}
export async function unlinkGuardian(parentProfileId: string, studentId: string) {
  const { error } = await supabase.from('guardian_link').delete()
    .eq('parent_profile_id', parentProfileId).eq('student_id', studentId);
  if (error) fail(error);
}
/** Students linked to the current parent login. */
export async function getMyChildren(): Promise<Student[]> {
  const belts = await getBelts();
  const { data, error } = await supabase
    .from('students').select('*, enrollments(class_id, ended_at, classes(name)), guardian_link!inner(parent_profile_id)');
  if (error) fail(error);
  return (data as Row[]).map(r => mapStudent(r, belts));
}
/** The student record for the current student login. */
export async function getMyStudentRecord(profileId: string): Promise<Student | null> {
  const belts = await getBelts();
  const { data, error } = await supabase
    .from('students').select('*, enrollments(class_id, ended_at, classes(name))')
    .eq('profile_id', profileId).maybeSingle();
  if (error) fail(error);
  return data ? mapStudent(data, belts) : null;
}

// ---------- Sessions & attendance ----------
export async function getOrCreateSession(classId: string, sessionDate: string): Promise<string> {
  const { data: existing } = await supabase.from('class_sessions')
    .select('id').eq('class_id', classId).eq('session_date', sessionDate).maybeSingle();
  if (existing) return (existing as Row).id;
  const { data, error } = await supabase.from('class_sessions')
    .insert({ class_id: classId, session_date: sessionDate }).select('id').single();
  if (error) fail(error);
  return (data as Row).id;
}
export async function markAttendance(records: { sessionId: string; studentId: string; status: AttendanceStatus }[], markedBy: string | null) {
  const { error } = await supabase.from('attendance').upsert(
    records.map(r => ({ session_id: r.sessionId, student_id: r.studentId, status: r.status, marked_by: markedBy, marked_at: new Date().toISOString() })),
    { onConflict: 'session_id,student_id' },
  );
  if (error) fail(error);
}
export async function getAttendanceForStudent(studentId: string): Promise<AttendanceRow[]> {
  const { data, error } = await supabase
    .from('attendance').select('*, class_sessions(session_date, class_id)')
    .eq('student_id', studentId);
  if (error) fail(error);
  return (data as Row[]).map(r => ({
    id: r.id, sessionId: r.session_id, studentId: r.student_id, status: r.status,
    sessionDate: r.class_sessions?.session_date ?? '', classId: r.class_sessions?.class_id ?? '',
  })).sort((a, b) => b.sessionDate.localeCompare(a.sessionDate));
}
export async function getAttendanceForSession(sessionId: string): Promise<AttendanceRow[]> {
  const { data, error } = await supabase.from('attendance').select('*').eq('session_id', sessionId);
  if (error) fail(error);
  return (data as Row[]).map(r => ({
    id: r.id, sessionId: r.session_id, studentId: r.student_id, status: r.status, sessionDate: '', classId: '',
  }));
}

/** At-risk: 3+ absences in a student's last 6 sessions. Returns studentId -> recent absence count. */
export async function getAtRiskMap(): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from('attendance').select('student_id, status, class_sessions(session_date)')
    .order('marked_at', { ascending: false });
  if (error) fail(error);
  const byStudent: Record<string, { date: string; status: string }[]> = {};
  for (const r of data as Row[]) {
    (byStudent[r.student_id] ??= []).push({ date: r.class_sessions?.session_date ?? '', status: r.status });
  }
  const result: Record<string, number> = {};
  for (const [sid, rows] of Object.entries(byStudent)) {
    const last6 = rows.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
    const absences = last6.filter(x => x.status === 'absent').length;
    if (absences >= 3) result[sid] = absences;
  }
  return result;
}

// ---------- Invoices & payments ----------
const mapInvoice = (r: Row, nameById: Record<string, string>): Invoice => ({
  id: r.id, studentId: r.student_id, studentName: nameById[r.student_id] ?? r.students?.full_name ?? '',
  billingMonth: r.billing_month, amount: Number(r.amount), discount: Number(r.discount ?? 0),
  discountReason: r.discount_reason ?? '', status: r.status,
  net: Number(r.amount) - Number(r.discount ?? 0),
});

export async function getInvoices(): Promise<Invoice[]> {
  const { data, error } = await supabase.from('invoices')
    .select('*, students(full_name)').order('billing_month', { ascending: false });
  if (error) fail(error);
  return (data as Row[]).map(r => mapInvoice(r, {}));
}
export async function getInvoicesForStudent(studentId: string): Promise<Invoice[]> {
  const { data, error } = await supabase.from('invoices')
    .select('*, students(full_name)').eq('student_id', studentId).order('billing_month', { ascending: false });
  if (error) fail(error);
  return (data as Row[]).map(r => mapInvoice(r, {}));
}

export interface GenerateInvoicesResult {
  created: number;
  /** Students skipped because their class has no fee set by the coach yet. */
  skippedNoFee: string[];
}

/**
 * Generate unpaid invoices for all active/trial students for a billing month.
 * Each student's fee comes from their class's coach-set fee — there is no academy
 * default. Students whose class has no fee yet are skipped and reported back so
 * the coach can be asked to set it. Applies the sibling discount.
 */
export async function generateInvoices(academyId: string, billingMonth: string): Promise<GenerateInvoicesResult> {
  const [students, classes] = await Promise.all([getStudents(), getClasses()]);
  const active = students.filter(s => s.lifecycle === 'active' || s.lifecycle === 'trial');
  // Fee = the fee of the (first) class the student is enrolled in that has a fee set.
  const feeFor = (s: Student): number | null => {
    const cls = classes.find(c => s.classIds.includes(c.id) && c.monthlyFeeOverride != null);
    return cls ? cls.monthlyFeeOverride : null;
  };

  // Sibling discount: 2+ active students sharing a primary payer → 10% off each sibling after the first.
  const { data: links } = await supabase.from('guardian_link').select('parent_profile_id, student_id, is_primary_payer').eq('is_primary_payer', true);
  const payerCount: Record<string, number> = {};
  for (const l of (links ?? []) as Row[]) payerCount[l.parent_profile_id] = (payerCount[l.parent_profile_id] ?? 0) + 1;
  const studentPayer: Record<string, string> = {};
  for (const l of (links ?? []) as Row[]) studentPayer[l.student_id] = l.parent_profile_id;

  const skippedNoFee: string[] = [];
  const rows = active.flatMap(s => {
    const amount = feeFor(s);
    if (amount == null) { skippedNoFee.push(s.fullName); return []; }
    const payer = studentPayer[s.id];
    const siblings = payer ? payerCount[payer] : 1;
    const discount = siblings >= 2 ? Math.round(amount * 0.1 * 100) / 100 : 0;
    return [{
      academy_id: academyId, student_id: s.id, billing_month: billingMonth,
      amount, discount, discount_reason: discount > 0 ? 'Sibling discount (10%)' : null, status: 'unpaid',
    }];
  });
  if (!rows.length) return { created: 0, skippedNoFee };
  const { data, error } = await supabase.from('invoices')
    .upsert(rows, { onConflict: 'student_id,billing_month', ignoreDuplicates: true })
    .select('id');
  if (error) fail(error);
  return { created: (data as Row[])?.length ?? 0, skippedNoFee };
}

export async function setInvoiceStatus(invoiceId: string, status: InvoiceStatus) {
  const { error } = await supabase.from('invoices').update({ status }).eq('id', invoiceId);
  if (error) fail(error);
}

export async function getPaymentsForInvoices(invoiceIds: string[]): Promise<Payment[]> {
  if (!invoiceIds.length) return [];
  const { data, error } = await supabase.from('payments').select('*').in('invoice_id', invoiceIds);
  if (error) fail(error);
  return (data as Row[]).map(r => ({
    id: r.id, invoiceId: r.invoice_id, method: r.method, amount: Number(r.amount),
    submittedBy: r.submitted_by, approvedBy: r.approved_by, approvedAt: r.approved_at,
    receiptNo: r.receipt_no, proofUrl: r.proof_url,
  }));
}

/** Parent submits a cash/transfer claim → invoice goes pending_approval. */
export async function submitPayment(invoiceId: string, amount: number, method: PaymentMethod, submittedBy: string, proofUrl?: string) {
  const { error } = await supabase.from('payments').insert({
    invoice_id: invoiceId, method, amount, submitted_by: submittedBy, proof_url: proofUrl ?? null,
  });
  if (error) fail(error);
  await setInvoiceStatus(invoiceId, 'pending_approval');
}

/** Staff approves a payment → generate sequential receipt, mark invoice paid. */
export async function approvePayment(paymentId: string, invoiceId: string, approverProfileId: string, academyPrefix: string) {
  const { data: seq } = await supabase.rpc('next_receipt_no', { p_prefix: academyPrefix });
  const receiptNo = (seq as string) ?? `RCPT-${Date.now()}`;
  const { error } = await supabase.from('payments').update({
    approved_by: approverProfileId, approved_at: new Date().toISOString(), receipt_no: receiptNo,
  }).eq('id', paymentId);
  if (error) fail(error);
  await setInvoiceStatus(invoiceId, 'paid');
}

/** Staff records a direct paid invoice (e.g. cash collected in person). */
export async function recordDirectPayment(invoiceId: string, amount: number, method: PaymentMethod, approverProfileId: string, academyPrefix: string) {
  const { data: seq } = await supabase.rpc('next_receipt_no', { p_prefix: academyPrefix });
  const receiptNo = (seq as string) ?? `RCPT-${Date.now()}`;
  const { error } = await supabase.from('payments').insert({
    invoice_id: invoiceId, method, amount, submitted_by: approverProfileId,
    approved_by: approverProfileId, approved_at: new Date().toISOString(), receipt_no: receiptNo,
  });
  if (error) fail(error);
  await setInvoiceStatus(invoiceId, 'paid');
}

// ---------- Skills ----------
export async function getSkills(): Promise<Skill[]> {
  const { data, error } = await supabase.from('skills').select('*').order('sort_order');
  if (error) fail(error);
  return (data as Row[]).map(r => ({ id: r.id, name: r.name, category: r.category ?? 'Foundation', sortOrder: r.sort_order ?? 0 }));
}
export async function addSkill(academyId: string, name: string, category: string, sortOrder: number) {
  const { error } = await supabase.from('skills').insert({ academy_id: academyId, name, category, sort_order: sortOrder });
  if (error) fail(error);
}
export async function deleteSkill(id: string) {
  const { error } = await supabase.from('skills').delete().eq('id', id);
  if (error) fail(error);
}
export async function getStudentSkills(studentId?: string): Promise<StudentSkill[]> {
  let q = supabase.from('student_skills').select('*');
  if (studentId) q = q.eq('student_id', studentId);
  const { data, error } = await q;
  if (error) fail(error);
  return (data as Row[]).map(r => ({ studentId: r.student_id, skillId: r.skill_id, level: r.level }));
}
export async function setSkillLevel(studentId: string, skillId: string, level: SkillLevel, updatedBy: string) {
  const { error } = await supabase.from('student_skills').upsert({
    student_id: studentId, skill_id: skillId, level, updated_by: updatedBy, updated_at: new Date().toISOString(),
  }, { onConflict: 'student_id,skill_id' });
  if (error) fail(error);
}

// ---------- Grading ----------
export async function getGradingEvents(): Promise<GradingEvent[]> {
  const { data, error } = await supabase.from('grading_events').select('*').order('event_date', { ascending: false });
  if (error) fail(error);
  return (data as Row[]).map(r => ({
    id: r.id, name: r.name, eventDate: r.event_date, location: r.location ?? '',
    examiner: r.examiner ?? '', fee: Number(r.fee ?? 0),
  }));
}
export async function addGradingEvent(academyId: string, e: { name: string; eventDate: string; location: string; examiner: string; fee: number }) {
  const { error } = await supabase.from('grading_events').insert({
    academy_id: academyId, name: e.name, event_date: e.eventDate, location: e.location, examiner: e.examiner, fee: e.fee,
  });
  if (error) fail(error);
}
export async function getGradingResults(eventId?: string): Promise<GradingResult[]> {
  const belts = await getBelts();
  let q = supabase.from('grading_results').select('*, students(full_name)');
  if (eventId) q = q.eq('grading_event_id', eventId);
  const { data, error } = await q;
  if (error) fail(error);
  return (data as Row[]).map(r => ({
    id: r.id, gradingEventId: r.grading_event_id, studentId: r.student_id,
    studentName: r.students?.full_name ?? '',
    fromBeltId: r.from_belt_id, toBeltId: r.to_belt_id,
    fromBeltName: belts.find(b => b.id === r.from_belt_id)?.name ?? '',
    toBeltName: belts.find(b => b.id === r.to_belt_id)?.name ?? '',
    result: r.result,
  }));
}
export async function registerForGrading(eventId: string, studentId: string, fromBeltId: string | null, toBeltId: string | null) {
  const { error } = await supabase.from('grading_results').upsert({
    grading_event_id: eventId, student_id: studentId, from_belt_id: fromBeltId, to_belt_id: toBeltId, result: 'registered',
  }, { onConflict: 'grading_event_id,student_id' });
  if (error) fail(error);
}
export async function setGradingResult(eventId: string, studentId: string, result: GradingResultType, gradedBy: string) {
  // The DB trigger auto-promotes the student's belt on 'pass'.
  const { error } = await supabase.from('grading_results')
    .update({ result, graded_by: gradedBy })
    .eq('grading_event_id', eventId).eq('student_id', studentId);
  if (error) fail(error);
}

// ---------- Tournaments ----------
export async function getTournaments(): Promise<Tournament[]> {
  const { data, error } = await supabase.from('tournaments').select('*').order('date', { ascending: false });
  if (error) fail(error);
  return (data as Row[]).map(r => ({ id: r.id, name: r.name, eventDate: r.date ?? '', location: r.venue ?? '' }));
}
export async function getTournamentResults(studentId?: string): Promise<TournamentResult[]> {
  let q = supabase.from('tournament_results').select('*, students(full_name)');
  if (studentId) q = q.eq('student_id', studentId);
  const { data, error } = await q;
  if (error) fail(error);
  return (data as Row[]).map(r => ({
    id: r.id, tournamentId: r.tournament_id, studentId: r.student_id,
    studentName: r.students?.full_name ?? '', eventCategory: r.event_category ?? '',
    medal: r.medal, points: r.points ?? 0,
  }));
}

// ---------- Notes ----------
export async function getNotes(studentId: string): Promise<StudentNote[]> {
  const { data, error } = await supabase.from('student_notes')
    .select('*, profiles(full_name)').eq('student_id', studentId).order('created_at', { ascending: false });
  if (error) fail(error);
  return (data as Row[]).map(r => ({
    id: r.id, studentId: r.student_id, authorId: r.author_id, authorName: r.profiles?.full_name ?? 'Staff',
    body: r.body, visibility: r.visibility, createdAt: r.created_at,
  }));
}
export async function addNote(studentId: string, authorId: string, body: string, visibility: 'staff' | 'parent_visible') {
  const { error } = await supabase.from('student_notes').insert({
    student_id: studentId, author_id: authorId, body, visibility,
  });
  if (error) fail(error);
}

// ---------- Notifications ----------
export async function getNotifications(): Promise<AppNotification[]> {
  const { data, error } = await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(30);
  if (error) fail(error);
  return (data as Row[]).map(r => ({
    id: r.id, title: r.title, body: r.body ?? '', linkPath: r.link_path, readAt: r.read_at, createdAt: r.created_at,
  }));
}
export async function markNotificationRead(id: string) {
  const { error } = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id);
  if (error) fail(error);
}

// ---------- Certificates ----------
export async function getCertificates(studentId?: string): Promise<Certificate[]> {
  let q = supabase.from('certificates').select('*');
  if (studentId) q = q.eq('student_id', studentId);
  const { data, error } = await q.order('issued_at', { ascending: false });
  if (error) fail(error);
  return (data as Row[]).map(r => ({
    id: r.id, studentId: r.student_id, type: r.type, title: r.title,
    certNo: r.cert_no, verifyCode: r.verify_code, issuedAt: r.issued_at, pdfUrl: r.pdf_url,
  }));
}

// ---------- Pending signups (admin approvals) ----------
export interface PendingProfile {
  id: string; fullName: string; email: string; phone: string | null;
  role: string; status: string; childName: string | null; assignedClass: string | null; createdAt: string;
}
export async function getProfiles(): Promise<PendingProfile[]> {
  const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
  if (error) fail(error);
  return (data as Row[]).map(r => ({
    id: r.id, fullName: r.full_name, email: r.email, phone: r.phone,
    role: r.role, status: r.status, childName: r.child_name, assignedClass: r.assigned_class, createdAt: r.created_at,
  }));
}
export async function setProfileStatus(id: string, status: 'approved' | 'rejected') {
  const { error } = await supabase.from('profiles').update({ status }).eq('id', id);
  if (error) fail(error);
}
export async function linkStudentProfile(studentId: string, profileId: string) {
  const { error } = await supabase.from('students').update({ profile_id: profileId }).eq('id', studentId);
  if (error) fail(error);
}
export async function getCoachProfiles(): Promise<{ id: string; fullName: string }[]> {
  const { data, error } = await supabase.from('profiles').select('id, full_name').eq('role', 'coach').eq('status', 'approved');
  if (error) fail(error);
  return (data as Row[]).map(r => ({ id: r.id, fullName: r.full_name }));
}
