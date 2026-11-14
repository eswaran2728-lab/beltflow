import { dbClient } from '../db/client';

type Runner = { query: (sql: string, params?: any[]) => Promise<{ rows: any[]; rowCount: number }> };

/**
 * Keeps students.billing_status in line with the monthly-dues ledger, which
 * is the source of truth: 'Paid' only when no billed month is still owed,
 * otherwise 'Unpaid'. Used by the Master's overdue follow-up and shown to
 * parents. A student with no dues ledger (legacy) gets `whenNoLedger` if
 * given (payments keep the old "a payment marks Paid" behaviour), otherwise
 * is left unchanged.
 */
export async function syncStudentBillingStatus(studentId: string, whenNoLedger: 'Paid' | null = null, runner: Runner = dbClient): Promise<void> {
  const dues = await runner.query(
    `SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE amount_paid < fee_amount)::int AS owing
     FROM monthly_dues WHERE student_id = $1`, [studentId]);
  const { total, owing } = dues.rows[0] || { total: 0, owing: 0 };
  let status: string | null;
  if (Number(total) === 0) status = whenNoLedger;
  else status = Number(owing) > 0 ? 'Unpaid' : 'Paid';
  if (status) {
    await runner.query(`UPDATE students SET billing_status = $1 WHERE id = $2`, [status, studentId]);
  }
}
