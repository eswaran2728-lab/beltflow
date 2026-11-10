/**
 * H26 authorised retrieval.
 *
 * Authorisation happens here, on the server, BEFORE any record is read:
 *   - the actor comes from the authenticated session (authenticateJWT
 *     re-derives Master classes and Parent links from the database on every
 *     request, so revocations apply immediately);
 *   - every query is parameterised and scoped to the actor's own tenant;
 *   - client context (studentId / classId / organizationId) can only narrow
 *     what the actor may already see; anything else is rejected with 403.
 *
 * Only approved material is retrieved: PUBLISHED curricula, lessons and
 * knowledge sources, plus the actor's own authorised operational records.
 * Identity numbers, phone numbers, medical data and private Master notes are
 * never selected.
 */
import { dbClient } from '../db/client';
import { AuthUserContext, UserRole } from '../security/rbac';
import { assignedMasterAccess } from '../security/access';
import { AuthorityCapability, authorize } from '../security/authority';
import { calculateAcademyMetrics } from '../routes/analytics.routes';
import { AssistantContext, AssistantError, CandidateSource } from './types';

const RM = (n: unknown) => `RM${Number(n || 0).toFixed(2)}`;
const today = () => new Date().toISOString().slice(0, 10);

export interface RetrievalScope {
  role: UserRole;
  organizationId: string | null;
  studentIds: string[];
  classIds: string[];
}

/** Validates client context against the actor's real authority. Throws 403 on any widening attempt. */
export async function resolveScope(actor: AuthUserContext, context: AssistantContext): Promise<RetrievalScope> {
  const role = actor.role;
  const orgId = actor.organizationId || null;

  if (role === UserRole.SUPER_ADMIN) {
    if (context.studentId || context.classId) {
      throw new AssistantError(403, 'SUPER_ADMIN_NO_CHILD_DATA', 'Super Admin can only use platform-level information in the assistant.');
    }
    if (context.organizationId) {
      throw new AssistantError(403, 'CROSS_TENANT_DENIED', 'The assistant answers Super Admin questions from platform-level aggregates only.');
    }
    return { role, organizationId: null, studentIds: [], classIds: [] };
  }

  if (!orgId) throw new AssistantError(403, 'NO_ORGANIZATION', 'Your account is not linked to a Persatuan.');
  if (context.organizationId && context.organizationId !== orgId) {
    throw new AssistantError(403, 'CROSS_TENANT_DENIED', 'You can only ask about your own Persatuan.');
  }

  if (role === UserRole.ADMIN_PERSATUAN) {
    if (context.studentId) {
      throw new AssistantError(403, 'CONTEXT_NOT_SUPPORTED', 'The assistant gives Persatuan admins academy-level information only.');
    }
    if (context.classId) {
      const owned = await dbClient.query('SELECT 1 FROM classes WHERE id = $1 AND organization_id = $2', [context.classId, orgId]);
      if (owned.rowCount === 0) throw new AssistantError(403, 'CLASS_NOT_AUTHORIZED', 'That class is not in your Persatuan.');
    }
    return { role, organizationId: orgId, studentIds: [], classIds: [] };
  }

  if (role === UserRole.MASTER) {
    if (context.studentId) {
      throw new AssistantError(403, 'CONTEXT_NOT_SUPPORTED', 'Ask about a class you lead instead of an individual student.');
    }
    const candidates = Array.from(new Set(actor.assignedClassIds || []));
    const authorised: string[] = [];
    for (const classId of candidates) {
      if (await assignedMasterAccess(actor, classId)) authorised.push(classId);
    }
    if (context.classId) {
      if (!authorised.includes(context.classId)) {
        throw new AssistantError(403, 'CLASS_NOT_AUTHORIZED', 'You do not currently lead that class.');
      }
      return { role, organizationId: orgId, studentIds: [], classIds: [context.classId] };
    }
    return { role, organizationId: orgId, studentIds: [], classIds: authorised };
  }

  if (role === UserRole.PARENT || role === UserRole.STUDENT) {
    let ids: string[] = [];
    if (role === UserRole.STUDENT) {
      const own = await dbClient.query('SELECT id FROM students WHERE user_id = $1 AND organization_id = $2', [actor.id, orgId]);
      ids = own.rows.map((r: any) => r.id);
    } else {
      ids = Array.from(new Set(actor.linkedStudentIds || []));
    }
    const verified: string[] = [];
    for (const studentId of ids) {
      const decision = await authorize(actor, AuthorityCapability.STUDENT_OPERATIONAL_ACCESS, { organizationId: orgId, studentId });
      if (decision.allowed) verified.push(studentId);
    }
    if (context.classId) {
      throw new AssistantError(403, 'CONTEXT_NOT_SUPPORTED', 'Ask about a student you are linked to instead of a class.');
    }
    if (context.studentId) {
      if (!verified.includes(context.studentId)) {
        throw new AssistantError(403, 'STUDENT_NOT_AUTHORIZED', 'You are not authorised to view that student.');
      }
      return { role, organizationId: orgId, studentIds: [context.studentId], classIds: [] };
    }
    return { role, organizationId: orgId, studentIds: verified, classIds: [] };
  }

  throw new AssistantError(403, 'ROLE_NOT_SUPPORTED', 'This role cannot use the assistant.');
}

// ---------------------------------------------------------------- sources

async function knowledgeSources(scope: RetrievalScope): Promise<CandidateSource[]> {
  const rows = scope.role === UserRole.SUPER_ADMIN
    ? await dbClient.query(
        `SELECT id, organization_id, title, body FROM ai_knowledge_sources
         WHERE status = 'PUBLISHED' AND organization_id IS NULL AND $1 = ANY(audience_roles)`,
        [scope.role])
    : await dbClient.query(
        `SELECT id, organization_id, title, body FROM ai_knowledge_sources
         WHERE status = 'PUBLISHED' AND (organization_id = $1 OR organization_id IS NULL) AND $2 = ANY(audience_roles)`,
        [scope.organizationId, scope.role]);
  return rows.rows.map((r: any) => ({
    id: `kb:${r.id}`, type: 'knowledge_source', title: r.title, text: r.body, organizationId: r.organization_id || null,
  }));
}

async function curriculumSources(orgId: string): Promise<CandidateSource[]> {
  const rows = await dbClient.query(
    `SELECT r.id, r.name, r.rank_order, r.min_months, r.min_sessions, r.grading_fee, r.description, r.is_dan_rank, r.dan_level,
            c.system_name, c.version
     FROM curriculum_belt_ranks r JOIN persatuan_curriculums c ON c.id = r.curriculum_id
     WHERE c.organization_id = $1 AND c.status = 'PUBLISHED'
     ORDER BY r.rank_order`, [orgId]);
  return rows.rows.map((r: any) => ({
    id: `curriculum_rank:${r.id}`,
    type: 'curriculum_rank',
    title: `Syllabus: ${r.name}`,
    text: `${r.name} is rank ${r.rank_order}${r.is_dan_rank ? ` (Dan ${r.dan_level ?? ''})` : ''} in ${r.system_name} version ${r.version}. ` +
      `Minimum ${r.min_months} months and ${r.min_sessions} sessions before grading. Grading fee ${RM(r.grading_fee)}. ${r.description || ''}`.trim(),
    organizationId: orgId,
    keywords: 'belt rank syllabus grading curriculum requirement level tali pinggang gred sukatan syarat',
  }));
}

async function lessonSources(orgId: string): Promise<CandidateSource[]> {
  const rows = await dbClient.query(
    `SELECT id, title, description, category, content_body FROM learning_lessons
     WHERE organization_id = $1 AND status = 'PUBLISHED' ORDER BY published_at DESC NULLS LAST LIMIT 50`, [orgId]);
  return rows.rows.map((r: any) => ({
    id: `lesson:${r.id}`, type: 'learning_lesson', title: `Lesson: ${r.title}`,
    text: [r.description, r.content_body].filter(Boolean).join(' '),
    organizationId: orgId, keywords: `lesson learning library ${String(r.category || '').toLowerCase()}`,
  }));
}

async function superAdminSources(): Promise<CandidateSource[]> {
  const orgs = await dbClient.query(`SELECT status, COUNT(*)::int AS n FROM organizations GROUP BY status ORDER BY status`);
  const students = await dbClient.query(`SELECT COUNT(*)::int AS n FROM students WHERE status = 'ACTIVE'`);
  const classes = await dbClient.query(`SELECT COUNT(*)::int AS n FROM classes WHERE status = 'ACTIVE'`);
  const directory = await dbClient.query(`SELECT name, state, status FROM organizations ORDER BY name LIMIT 200`);
  const orgSummary = orgs.rows.map((r: any) => `${r.status}: ${r.n}`).join(', ') || 'none';
  return [
    {
      id: 'platform_metrics:global', type: 'platform_metrics', title: 'Platform totals (aggregate only)', organizationId: null,
      text: `Persatuans by status: ${orgSummary}. Active students across the platform: ${students.rows[0]?.n ?? 0}. ` +
        `Active classes across the platform: ${classes.rows[0]?.n ?? 0}. Individual student records are not available to Super Admin.`,
      keywords: 'platform persatuans persatuan organizations academies students classes statistics totals how many count',
    },
    {
      id: 'platform_directory:persatuans', type: 'platform_directory', title: 'Persatuan directory', organizationId: null,
      text: directory.rows.map((r: any) => `${r.name} (${r.state}) - ${r.status}`).join('; '),
      keywords: 'persatuans persatuan organizations academies directory list names platform',
    },
  ];
}

async function adminSources(orgId: string, classId?: string): Promise<CandidateSource[]> {
  const out: CandidateSource[] = [];
  const org = (await dbClient.query(
    `SELECT name, state, martial_art_style, base_monthly_fee, sibling_discount_percent FROM organizations WHERE id = $1`, [orgId])).rows[0];
  if (org) {
    out.push({
      id: `org_policy:${orgId}`, type: 'org_policy', title: `${org.name} academy settings`, organizationId: orgId,
      text: `${org.name} (${org.state}) teaches ${org.martial_art_style}. Default monthly fee for new classes ${RM(org.base_monthly_fee)}; ` +
        `sibling discount ${Number(org.sibling_discount_percent || 0)}%. Each class Master sets the class monthly fee.`,
      keywords: 'fees fee discount sibling academy settings default monthly',
    });
  }
  const classes = await dbClient.query(
    `SELECT c.id, c.name, c.approval_status, c.operational_status, c.enrollment_availability, c.capacity,
            (SELECT COUNT(*)::int FROM students s WHERE s.class_id = c.id AND s.status = 'ACTIVE') AS active_students
     FROM classes c WHERE c.organization_id = $1 ${classId ? 'AND c.id = $2' : ''} ORDER BY c.name LIMIT 100`,
    classId ? [orgId, classId] : [orgId]);
  if (classes.rowCount > 0) {
    out.push({
      id: `org_class_statistics:${classId || orgId}`, type: 'org_class_statistics', title: 'Class statistics', organizationId: orgId,
      text: classes.rows.map((c: any) =>
        `${c.name}: approval ${c.approval_status}, operation ${c.operational_status}, enrolment ${c.enrollment_availability}, ` +
        `${c.active_students}/${c.capacity} active students`).join('; '),
      keywords: 'class classes statistics capacity approval status enrolment enrollment active students',
    });
  }
  const counts = async (table: string) => (await dbClient.query(
    `SELECT status, COUNT(*)::int AS n FROM ${table} WHERE organization_id = $1 GROUP BY status ORDER BY status`, [orgId])).rows
    .map((r: any) => `${r.status} ${r.n}`).join(', ') || 'none';
  out.push({
    id: `org_approvals:${orgId}`, type: 'org_approvals', title: 'Approval queues (counts only)', organizationId: orgId,
    text: `Master applications: ${await counts('master_applications')}. Class proposals: ${await counts('class_applications')}. ` +
      `Student enrolment applications: ${await counts('enrollment_applications')}.`,
    keywords: 'approval approvals pending applications master masters class proposals enrolment enrollment queue status',
  });
  try {
    const m = await calculateAcademyMetrics(classId ? 'class' : 'organization', orgId, classId);
    out.push({
      id: `org_metrics:${classId || orgId}`, type: 'org_metrics', title: `Growth analytics (${m.metadata.metricVersion})`, organizationId: orgId,
      text: `Active enrolled students ${m.enrollment.activeEnrolledStudents}; pending applicants ${m.enrollment.pendingApplicants}; ` +
        `capacity utilisation ${m.enrollment.capacityUtilizationPercent}%. Trials booked ${m.trialConversion.totalTrialsBooked}, ` +
        `converted ${m.trialConversion.trialsConverted} (${m.trialConversion.conversionRatePercent}%). Retention ${m.retention.retentionRatePercent}%, ` +
        `paused ${m.retention.pausedMemberships}. Collected ${RM(m.ledgerTotals.totalCollected)}, outstanding ${RM(m.ledgerTotals.totalOutstanding)}.`,
      keywords: 'analytics metrics growth retention enrolment enrollment trial conversion collected outstanding revenue utilisation utilization',
    });
  } catch (err) {
    console.error('[Assistant] analytics source unavailable', err instanceof Error ? err.message : err);
  }
  return out;
}

async function upcomingSessions(orgId: string, classId: string): Promise<string> {
  const rows = await dbClient.query(
    `SELECT session_date, start_time, end_time, location, status FROM training_sessions
     WHERE class_id = $1 AND organization_id = $2 AND session_date >= $3 ORDER BY session_date, start_time LIMIT 8`,
    [classId, orgId, today()]);
  return rows.rows.map((s: any) => `${s.session_date} ${s.start_time}-${s.end_time} at ${s.location} (${s.status})`).join('; ');
}

async function masterSources(orgId: string, classIds: string[]): Promise<CandidateSource[]> {
  const out: CandidateSource[] = [];
  for (const classId of classIds) {
    const c = (await dbClient.query(
      `SELECT id, name, schedule, location, capacity, approval_status, operational_status FROM classes WHERE id = $1 AND organization_id = $2`,
      [classId, orgId])).rows[0];
    if (!c) continue;
    const sessions = await upcomingSessions(orgId, classId);
    out.push({
      id: `class_info:${classId}`, type: 'class_info', title: `Class: ${c.name}`, organizationId: orgId,
      text: `${c.name} meets ${c.schedule} at ${c.location}. Capacity ${c.capacity}. Status: ${c.operational_status}, approval ${c.approval_status}. ` +
        `Upcoming sessions: ${sessions || 'none scheduled'}.`,
      keywords: 'class schedule session sessions timetable upcoming next location venue training kelas jadual sesi latihan seterusnya',
    });
    const roster = await dbClient.query(
      `SELECT full_name, belt_rank FROM students WHERE class_id = $1 AND organization_id = $2 AND status = 'ACTIVE' ORDER BY full_name`,
      [classId, orgId]);
    out.push({
      id: `class_roster:${classId}`, type: 'class_roster', title: `Roster: ${c.name}`, organizationId: orgId,
      text: `Active students (${roster.rowCount}): ${roster.rows.map((r: any) => `${r.full_name} (${r.belt_rank})`).join(', ') || 'none'}.`,
      keywords: 'roster students student list belts members class senarai pelajar',
    });
    const plans = await dbClient.query(
      `SELECT lp.id, lp.title, lp.objectives, lp.covered_material, ts.session_date FROM lesson_plans lp
       JOIN training_sessions ts ON ts.id = lp.session_id
       WHERE lp.class_id = $1 AND lp.organization_id = $2 ORDER BY ts.session_date DESC LIMIT 5`, [classId, orgId]);
    for (const p of plans.rows) {
      out.push({
        id: `lesson_plan:${p.id}`, type: 'lesson_plan', title: `Lesson plan ${p.session_date}: ${p.title}`, organizationId: orgId,
        text: [p.objectives, p.covered_material].filter(Boolean).join(' '),
        keywords: 'lesson plan teaching plan objectives drills',
      });
    }
  }
  return out;
}

async function studentSources(orgId: string, studentId: string, includeDues: boolean): Promise<CandidateSource[]> {
  const s = (await dbClient.query(
    `SELECT s.id, s.full_name, s.belt_rank, s.status, s.class_id, s.group_id, c.name AS class_name, c.schedule, c.location
     FROM students s LEFT JOIN classes c ON c.id = s.class_id WHERE s.id = $1 AND s.organization_id = $2`, [studentId, orgId])).rows[0];
  if (!s) return [];
  const out: CandidateSource[] = [{
    id: `student_profile:${studentId}`, type: 'student_profile', title: `Progress: ${s.full_name}`, organizationId: orgId,
    text: `${s.full_name}: current belt ${s.belt_rank}. Class ${s.class_name || 'not assigned'}${s.schedule ? ` (${s.schedule} at ${s.location})` : ''}. Membership ${s.status}.`,
    keywords: 'belt rank progress level class profile grading tali pinggang kemajuan gred',
  }];

  const since = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
  const att = await dbClient.query(
    `SELECT sa.status, COUNT(*)::int AS n FROM session_attendance sa JOIN training_sessions ts ON ts.id = sa.session_id
     WHERE sa.student_id = $1 AND ts.organization_id = $2 AND ts.session_date >= $3 GROUP BY sa.status ORDER BY sa.status`,
    [studentId, orgId, since]);
  out.push({
    id: `student_attendance:${studentId}`, type: 'student_attendance', title: `Attendance: ${s.full_name}`, organizationId: orgId,
    text: `Attendance in the last 90 days: ${att.rows.map((r: any) => `${r.status} ${r.n}`).join(', ') || 'no sessions recorded'}.`,
    keywords: 'attendance present absent late excused sessions attended kehadiran hadir',
  });

  if (s.class_id) {
    const sessions = await upcomingSessions(orgId, s.class_id);
    out.push({
      id: `student_schedule:${studentId}`, type: 'student_schedule', title: `Schedule: ${s.full_name}`, organizationId: orgId,
      text: `Upcoming sessions for ${s.class_name}: ${sessions || 'none scheduled'}.`,
      keywords: 'schedule session sessions class next upcoming timetable training kelas jadual sesi latihan seterusnya',
    });
    const notices = await dbClient.query(
      `SELECT type, message, created_at FROM notices WHERE class_id = $1 AND organization_id = $2
         AND (group_id IS NULL OR group_id = $3) ORDER BY created_at DESC LIMIT 5`, [s.class_id, orgId, s.group_id]);
    if (notices.rowCount > 0) {
      out.push({
        id: `student_notices:${studentId}`, type: 'student_notices', title: `Notices: ${s.class_name}`, organizationId: orgId,
        // One notice per line, so a flagged notice is neutralised alone, not the whole list.
        text: notices.rows.map((n: any) => `${new Date(n.created_at).toISOString().slice(0, 10)} [${n.type}] ${String(n.message).replace(/\s*\n\s*/g, ' ')}`).join('\n'),
        keywords: 'notice notices announcement announcements cancelled change schedule notis pengumuman',
      });
    }
  }

  const ach = await dbClient.query(
    `SELECT badge_title, awarded_at FROM student_achievements WHERE student_id = $1 AND organization_id = $2 AND status = 'ACTIVE'
     ORDER BY awarded_at DESC LIMIT 10`, [studentId, orgId]);
  if (ach.rowCount > 0) {
    out.push({
      id: `student_achievements:${studentId}`, type: 'student_achievements', title: `Achievements: ${s.full_name}`, organizationId: orgId,
      text: ach.rows.map((a: any) => `${a.badge_title} (${new Date(a.awarded_at).toISOString().slice(0, 10)})`).join(', '),
      keywords: 'achievement achievements badge badges reward rewards award pencapaian lencana',
    });
  }

  if (includeDues) {
    const dues = await dbClient.query(
      `SELECT billing_month, fee_amount, amount_paid, status FROM monthly_dues WHERE student_id = $1 AND organization_id = $2
       ORDER BY billing_month DESC LIMIT 6`, [studentId, orgId]);
    const outstanding = dues.rows.reduce((sum: number, d: any) => sum + Math.max(0, Number(d.fee_amount) - Number(d.amount_paid)), 0);
    out.push({
      id: `student_dues:${studentId}`, type: 'student_dues', title: `Fees: ${s.full_name}`, organizationId: orgId,
      text: `Outstanding monthly dues ${RM(outstanding)}. Recent months: ` +
        (dues.rows.map((d: any) => `${d.billing_month} fee ${RM(d.fee_amount)}, received ${RM(d.amount_paid)}, ${d.status}`).join('; ') || 'none generated') + '.',
      keywords: 'fees fee payment payments dues outstanding owe balance monthly yuran bayaran tertunggak',
    });
  }
  return out;
}

/** Gathers every source the actor may see. Called only after resolveScope succeeded. */
export async function gatherAuthorizedSources(scope: RetrievalScope, context: AssistantContext): Promise<CandidateSource[]> {
  if (scope.role === UserRole.SUPER_ADMIN) {
    return [...(await superAdminSources()), ...(await knowledgeSources(scope))];
  }
  const orgId = scope.organizationId!;
  const shared = [...(await knowledgeSources(scope)), ...(await curriculumSources(orgId)), ...(await lessonSources(orgId))];
  if (scope.role === UserRole.ADMIN_PERSATUAN) return [...(await adminSources(orgId, context.classId)), ...shared];
  if (scope.role === UserRole.MASTER) return [...(await masterSources(orgId, scope.classIds)), ...shared];
  const perStudent: CandidateSource[] = [];
  for (const studentId of scope.studentIds) {
    perStudent.push(...(await studentSources(orgId, studentId, scope.role === UserRole.PARENT)));
  }
  return [...perStudent, ...shared];
}

// ---------------------------------------------------------------- ranking

const STOPWORDS = new Set((
  'a an the and or but of to in on at for from by with about into is are was were be been am do does did have has had can could will would ' +
  'should may might i me my mine we our you your he she they them their it its this that these those what which who whom whose when where why how ' +
  'show tell give list explain please pls any some all much many more most there here than then so if not no yes also just only very get ' +
  'policy policies rule rules guide information info detail details record records thing things know want need help ' +
  'child children kid kids son daughter anak saya apa bila bagaimana berapa yang dan atau untuk dengan ini itu ada tak tidak sila tolong ' +
  'now today currently current'
).split(/\s+/));

const SYNONYMS: string[][] = [
  ['attendance', 'present', 'absent', 'hadir', 'kehadiran', 'attend', 'attended'],
  ['fee', 'fees', 'payment', 'payments', 'dues', 'outstanding', 'owe', 'yuran', 'bayar', 'bayaran', 'balance'],
  ['belt', 'rank', 'grading', 'tali', 'pinggang', 'syllabus', 'promotion', 'progress', 'level', 'gred'],
  ['schedule', 'session', 'class', 'jadual', 'kelas', 'timetable', 'next', 'upcoming', 'training', 'latihan', 'seterusnya'],
  ['notice', 'announcement', 'pengumuman', 'notis'],
  ['roster', 'student', 'pelajar', 'murid'],
  ['achievement', 'badge', 'reward', 'award', 'pencapaian'],
  ['persatuan', 'organization', 'organisation', 'academy', 'akademi'],
];

function stem(token: string): string {
  if (token.length > 5 && token.endsWith('ing')) return token.slice(0, -3);
  if (token.length > 5 && token.endsWith('ed')) return token.slice(0, -2);
  if (token.length > 4 && token.endsWith('ies')) return `${token.slice(0, -3)}y`;
  if (token.length > 3 && token.endsWith('s') && !token.endsWith('ss')) return token.slice(0, -1);
  return token;
}

export function tokenize(text: string): string[] {
  const raw = text.toLowerCase().normalize('NFKC').match(/[\p{L}\p{M}\p{N}]+/gu) || [];
  return raw.filter(t => t.length > 1 && !STOPWORDS.has(t)).map(stem);
}

function synonymGroup(token: string): string[] | undefined {
  return SYNONYMS.find(group => group.map(stem).includes(token))?.map(stem);
}

/**
 * Simple lexical relevance with rarity weighting (IDF): a query word found
 * in only a few sources ("attend") counts more than one found in almost
 * every source ("class"). Title matches get a small bonus; a synonym match
 * (for example a Malay word matching an English record) counts half.
 * A source needs at least one match to qualify as evidence; when nothing
 * qualifies, the assistant admits the gap.
 */
export function rankSources(query: string, sources: CandidateSource[], limit: number): CandidateSource[] {
  const terms = Array.from(new Set(tokenize(query)));
  if (terms.length === 0 || sources.length === 0) return [];
  const bodies = sources.map(src => new Set(tokenize(`${src.title} ${src.text} ${src.keywords || ''}`)));
  const titles = sources.map(src => new Set(tokenize(src.title)));
  const idf = (matches: (body: Set<string>) => boolean) => {
    const df = bodies.filter(matches).length;
    return Math.log(1 + sources.length / (1 + df));
  };
  const weights = terms.map(term => ({
    term,
    direct: idf(body => body.has(term)),
    synonyms: synonymGroup(term) || [],
  }));
  const scored = sources.map((src, index) => {
    const body = bodies[index];
    let hits = 0;
    let score = 0;
    for (const w of weights) {
      if (body.has(w.term)) {
        hits += 1;
        score += w.direct * (titles[index].has(w.term) ? 1.25 : 1);
      } else if (w.synonyms.some(syn => body.has(syn))) {
        hits += 1;
        score += 0.5 * idf(b => w.synonyms.some(syn => b.has(syn)));
      }
    }
    return { src, score, hits, index };
  });
  return scored
    .filter(s => s.hits > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map(s => s.src);
}
