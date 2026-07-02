/* eslint-disable @typescript-eslint/no-explicit-any */
// BeltFlow data layer — all reads/writes go through Supabase with RLS enforced server-side.
import { supabase } from './supabase';
import {
  Student, AttendanceRecord, Payment, GradingEvent, GradingRecord,
  Skill, StudentSkill, InstructorNote, Tournament, TournamentRegistration,
  TournamentResult, AcademySettings, Branch, Class,
  PaymentStatus, SkillProgress, GradingResultType,
} from './types';

type Row = Record<string, any>;

function fail(error: { message: string } | null): never {
  throw new Error(error?.message || 'Database error');
}

// ---------- Mappers (snake_case rows → camelCase app types) ----------
export const mapStudent = (r: Row): Student => ({
  id: r.id, fullName: r.full_name, age: r.age ?? 0, icNumber: r.ic_number ?? '',
  parentName: r.parent_name ?? '', parentPhone: r.parent_phone ?? '',
  emergencyContact: r.emergency_contact ?? undefined, beltRank: r.belt_rank,
  joinDate: r.join_date ?? '', status: r.status, branch: r.branch ?? '',
  classGroup: r.class_group ?? '', classId: r.class_id, missedClasses: r.missed_classes ?? 0,
  notes: r.notes ?? undefined,
});

export const mapAttendance = (r: Row): AttendanceRecord => ({
  id: r.id, studentId: r.student_id, classId: r.class_id, date: r.date,
  present: r.present, notes: r.notes ?? undefined,
});

export const mapPayment = (r: Row): Payment => ({
  id: r.id, studentId: r.student_id, studentName: r.student_name,
  amount: Number(r.amount), month: r.month, status: r.status, method: r.method,
  paidDate: r.paid_date ?? undefined, receiptNumber: r.receipt_number ?? undefined,
  approvedBy: r.approved_by ?? undefined, notes: r.notes ?? undefined,
});

export const mapGradingEvent = (r: Row): GradingEvent => ({
  id: r.id, title: r.title, date: r.date, location: r.location ?? '',
  examiner: r.examiner ?? '', studentIds: r.student_ids ?? [], status: r.status,
});

export const mapGradingRecord = (r: Row): GradingRecord => ({
  id: r.id, eventId: r.event_id, studentId: r.student_id, studentName: r.student_name,
  currentBelt: r.current_belt, targetBelt: r.target_belt, result: r.result,
  examiner: r.examiner ?? '', date: r.date ?? '', notes: r.notes ?? undefined,
});

export const mapSkill = (r: Row): Skill => ({
  id: r.id, name: r.name, category: r.category, description: r.description ?? undefined,
  order: r.sort_order ?? 0,
});

export const mapStudentSkill = (r: Row): StudentSkill => ({
  id: r.id, studentId: r.student_id, skillId: r.skill_id, skillName: r.skill_name,
  progress: r.progress, updatedAt: r.updated_at ?? '', notes: r.notes ?? undefined,
});

export const mapNote = (r: Row): InstructorNote => ({
  id: r.id, studentId: r.student_id, coachId: r.coach_id, coachName: r.coach_name,
  note: r.note, date: r.date, isPrivate: r.is_private,
});

export const mapTournament = (r: Row): Tournament => ({
  id: r.id, name: r.name, organizer: r.organizer ?? '', venue: r.venue ?? '',
  date: r.date ?? '', registrationDeadline: r.registration_deadline ?? '',
  status: r.status, notes: r.notes ?? undefined,
  categories: Array.isArray(r.categories) ? r.categories : [],
});

export const mapRegistration = (r: Row): TournamentRegistration => ({
  id: r.id, tournamentId: r.tournament_id, studentId: r.student_id,
  studentName: r.student_name, ageGroup: r.age_group ?? '', category: r.category,
  branch: r.branch ?? '', coachName: r.coach_name ?? '', status: r.status,
  remarks: r.remarks ?? undefined,
});

export const mapResult = (r: Row): TournamentResult => ({
  id: r.id, tournamentId: r.tournament_id, studentId: r.student_id,
  studentName: r.student_name, category: r.category, medal: r.medal,
  points: r.points ?? 0, position: r.position ?? undefined, notes: r.notes ?? undefined,
});

export const mapSettings = (r: Row): AcademySettings => ({
  id: r.id, name: r.name, description: r.description ?? '',
  martialArtStyle: r.martial_art_style, phone: r.phone ?? '', email: r.email ?? '',
  address: r.address ?? '', monthlyFee: Number(r.monthly_fee),
});

export const mapBranch = (r: Row): Branch => ({
  id: r.id, name: r.name, address: r.address ?? '', phone: r.phone ?? '',
});

export const mapClass = (r: Row): Class => ({
  id: r.id, branchId: r.branch_id, name: r.name, schedule: r.schedule ?? '',
  coachId: r.coach_id,
});

// ---------- Reads ----------
async function selectAll(table: string, order?: { column: string; ascending?: boolean }) {
  let q = supabase.from(table).select('*');
  if (order) q = q.order(order.column, { ascending: order.ascending ?? true });
  const { data, error } = await q;
  if (error) fail(error);
  return data as Row[];
}

export const getStudents = async () =>
  (await selectAll('students', { column: 'full_name' })).map(mapStudent);

export const getStudent = async (id: string) => {
  const { data, error } = await supabase.from('students').select('*').eq('id', id).maybeSingle();
  if (error) fail(error);
  return data ? mapStudent(data) : null;
};

export const getAttendance = async (studentId?: string) => {
  let q = supabase.from('attendance').select('*').order('date', { ascending: false });
  if (studentId) q = q.eq('student_id', studentId);
  const { data, error } = await q;
  if (error) fail(error);
  return (data as Row[]).map(mapAttendance);
};

export const getPayments = async (studentId?: string) => {
  let q = supabase.from('payments').select('*').order('created_at', { ascending: false });
  if (studentId) q = q.eq('student_id', studentId);
  const { data, error } = await q;
  if (error) fail(error);
  return (data as Row[]).map(mapPayment);
};

export const getGradingEvents = async () =>
  (await selectAll('grading_events', { column: 'date', ascending: false })).map(mapGradingEvent);

export const getGradingRecords = async (studentId?: string) => {
  let q = supabase.from('grading_records').select('*').order('date', { ascending: false });
  if (studentId) q = q.eq('student_id', studentId);
  const { data, error } = await q;
  if (error) fail(error);
  return (data as Row[]).map(mapGradingRecord);
};

export const getSkills = async () =>
  (await selectAll('skills', { column: 'sort_order' })).map(mapSkill);

export const getStudentSkills = async (studentId?: string) => {
  let q = supabase.from('student_skills').select('*');
  if (studentId) q = q.eq('student_id', studentId);
  const { data, error } = await q;
  if (error) fail(error);
  return (data as Row[]).map(mapStudentSkill);
};

export const getNotes = async (studentId?: string) => {
  let q = supabase.from('instructor_notes').select('*').order('date', { ascending: false });
  if (studentId) q = q.eq('student_id', studentId);
  const { data, error } = await q;
  if (error) fail(error);
  return (data as Row[]).map(mapNote);
};

export const getTournaments = async () =>
  (await selectAll('tournaments', { column: 'date', ascending: false })).map(mapTournament);

export const getRegistrations = async () =>
  (await selectAll('tournament_registrations', { column: 'created_at' })).map(mapRegistration);

export const getResults = async (studentId?: string) => {
  let q = supabase.from('tournament_results').select('*');
  if (studentId) q = q.eq('student_id', studentId);
  const { data, error } = await q;
  if (error) fail(error);
  return (data as Row[]).map(mapResult);
};

export const getSettings = async () => {
  const { data, error } = await supabase.from('academy_settings').select('*').limit(1).maybeSingle();
  if (error) fail(error);
  return data ? mapSettings(data) : null;
};

export const getBranches = async () =>
  (await selectAll('branches', { column: 'name' })).map(mapBranch);

export const getClasses = async () =>
  (await selectAll('classes', { column: 'name' })).map(mapClass);

// ---------- Writes ----------
export async function addStudent(s: {
  fullName: string; age: number; icNumber: string; parentName: string;
  parentPhone: string; beltRank: string; branch: string; classGroup: string; classId?: string | null;
}) {
  const { error } = await supabase.from('students').insert({
    full_name: s.fullName, age: s.age, ic_number: s.icNumber,
    parent_name: s.parentName, parent_phone: s.parentPhone,
    belt_rank: s.beltRank, branch: s.branch, class_group: s.classGroup,
    class_id: s.classId ?? null,
  });
  if (error) fail(error);
}

export async function updateStudent(id: string, patch: Partial<Student>) {
  const row: Row = {};
  if (patch.fullName !== undefined) row.full_name = patch.fullName;
  if (patch.age !== undefined) row.age = patch.age;
  if (patch.icNumber !== undefined) row.ic_number = patch.icNumber;
  if (patch.parentName !== undefined) row.parent_name = patch.parentName;
  if (patch.parentPhone !== undefined) row.parent_phone = patch.parentPhone;
  if (patch.emergencyContact !== undefined) row.emergency_contact = patch.emergencyContact;
  if (patch.beltRank !== undefined) row.belt_rank = patch.beltRank;
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.branch !== undefined) row.branch = patch.branch;
  if (patch.classGroup !== undefined) row.class_group = patch.classGroup;
  if (patch.classId !== undefined) row.class_id = patch.classId;
  if (patch.missedClasses !== undefined) row.missed_classes = patch.missedClasses;
  if (patch.notes !== undefined) row.notes = patch.notes;
  const { error } = await supabase.from('students').update(row).eq('id', id);
  if (error) fail(error);
}

export async function saveAttendance(records: {
  studentId: string; classId: string | null; date: string; present: boolean;
}[], markedBy: string | null) {
  const { error } = await supabase.from('attendance').upsert(
    records.map(r => ({
      student_id: r.studentId, class_id: r.classId, date: r.date,
      present: r.present, marked_by: markedBy,
    })),
    { onConflict: 'student_id,class_id,date' },
  );
  if (error) fail(error);
}

export async function addPayment(p: {
  studentId: string; studentName: string; amount: number; month: string;
  status: PaymentStatus; method: string; notes?: string;
}) {
  const { error } = await supabase.from('payments').insert({
    student_id: p.studentId, student_name: p.studentName, amount: p.amount,
    month: p.month, status: p.status, method: p.method, notes: p.notes ?? null,
    paid_date: p.status === 'Paid' ? new Date().toISOString().split('T')[0] : null,
    receipt_number: p.status === 'Paid' ? `RCP-${Date.now()}` : null,
  });
  if (error) fail(error);
}

export async function setPaymentStatus(id: string, status: PaymentStatus, approvedBy?: string) {
  const patch: Row = { status };
  if (status === 'Paid') {
    patch.paid_date = new Date().toISOString().split('T')[0];
    patch.receipt_number = `RCP-${Date.now()}`;
    if (approvedBy) patch.approved_by = approvedBy;
  }
  const { error } = await supabase.from('payments').update(patch).eq('id', id);
  if (error) fail(error);
}

export async function addGradingEvent(e: { title: string; date: string; location: string; examiner: string }) {
  const { error } = await supabase.from('grading_events').insert({
    title: e.title, date: e.date, location: e.location, examiner: e.examiner,
  });
  if (error) fail(error);
}

export async function setGradingEventStudents(eventId: string, studentIds: string[]) {
  const { error } = await supabase.from('grading_events').update({ student_ids: studentIds }).eq('id', eventId);
  if (error) fail(error);
}

export async function recordGradingResult(r: {
  eventId: string; studentId: string; studentName: string;
  currentBelt: string; targetBelt: string; result: GradingResultType;
  examiner: string; date: string;
}) {
  const { error } = await supabase.from('grading_records').upsert({
    event_id: r.eventId, student_id: r.studentId, student_name: r.studentName,
    current_belt: r.currentBelt, target_belt: r.targetBelt, result: r.result,
    examiner: r.examiner, date: r.date,
  }, { onConflict: 'event_id,student_id' });
  if (error) fail(error);
  // Auto-promote belt on pass
  if (r.result === 'Pass') {
    await updateStudent(r.studentId, { beltRank: r.targetBelt as Student['beltRank'] });
  }
}

export async function addSkill(s: { name: string; category: string; description?: string; order: number }) {
  const { error } = await supabase.from('skills').insert({
    name: s.name, category: s.category, description: s.description ?? null, sort_order: s.order,
  });
  if (error) fail(error);
}

export async function deleteSkill(id: string) {
  const { error } = await supabase.from('skills').delete().eq('id', id);
  if (error) fail(error);
}

export async function setSkillProgress(studentId: string, skillId: string, skillName: string, progress: SkillProgress) {
  const { error } = await supabase.from('student_skills').upsert({
    student_id: studentId, skill_id: skillId, skill_name: skillName,
    progress, updated_at: new Date().toISOString(),
  }, { onConflict: 'student_id,skill_id' });
  if (error) fail(error);
}

export async function addNote(n: { studentId: string; coachId: string | null; coachName: string; note: string; isPrivate?: boolean }) {
  const { error } = await supabase.from('instructor_notes').insert({
    student_id: n.studentId, coach_id: n.coachId, coach_name: n.coachName,
    note: n.note, is_private: n.isPrivate ?? false,
  });
  if (error) fail(error);
}

export async function addTournament(t: {
  name: string; organizer: string; venue: string; date: string;
  registrationDeadline: string; notes?: string; categories: string[];
}) {
  const { error } = await supabase.from('tournaments').insert({
    name: t.name, organizer: t.organizer, venue: t.venue, date: t.date,
    registration_deadline: t.registrationDeadline, notes: t.notes ?? null,
    categories: t.categories, status: 'Draft',
  });
  if (error) fail(error);
}

export async function setTournamentStatus(id: string, status: string) {
  const { error } = await supabase.from('tournaments').update({ status }).eq('id', id);
  if (error) fail(error);
}

export async function registerForTournament(r: {
  tournamentId: string; studentId: string; studentName: string;
  ageGroup: string; category: string; branch: string; coachName: string; remarks?: string;
}) {
  const { error } = await supabase.from('tournament_registrations').insert({
    tournament_id: r.tournamentId, student_id: r.studentId, student_name: r.studentName,
    age_group: r.ageGroup, category: r.category, branch: r.branch,
    coach_name: r.coachName, remarks: r.remarks ?? null,
  });
  if (error) fail(error);
}

export async function updateSettings(id: string, s: Partial<AcademySettings>) {
  const row: Row = { updated_at: new Date().toISOString() };
  if (s.name !== undefined) row.name = s.name;
  if (s.description !== undefined) row.description = s.description;
  if (s.martialArtStyle !== undefined) row.martial_art_style = s.martialArtStyle;
  if (s.phone !== undefined) row.phone = s.phone;
  if (s.email !== undefined) row.email = s.email;
  if (s.address !== undefined) row.address = s.address;
  if (s.monthlyFee !== undefined) row.monthly_fee = s.monthlyFee;
  const { error } = await supabase.from('academy_settings').update(row).eq('id', id);
  if (error) fail(error);
}

export async function addBranch(b: { name: string; address: string; phone: string }) {
  const { error } = await supabase.from('branches').insert(b);
  if (error) fail(error);
}

export async function deleteBranch(id: string) {
  const { error } = await supabase.from('branches').delete().eq('id', id);
  if (error) fail(error);
}

export async function addClass(c: { name: string; schedule: string; branchId: string | null }) {
  const { error } = await supabase.from('classes').insert({
    name: c.name, schedule: c.schedule, branch_id: c.branchId,
  });
  if (error) fail(error);
}

export async function deleteClass(id: string) {
  const { error } = await supabase.from('classes').delete().eq('id', id);
  if (error) fail(error);
}
