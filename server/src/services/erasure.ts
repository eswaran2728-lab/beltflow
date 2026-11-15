import crypto from 'crypto';
import { dbClient } from '../db/client';

/**
 * Carrying out a deletion request.
 *
 * Personal details are removed and access ends. What is kept, without the
 * person's details: the financial ledger (payments, dues, orders), attendance
 * counts and audit entries, which the Persatuan needs for its accounts and
 * which only refer to the now-anonymous record.
 */

/** Removes a student's personal details. The row stays so ledgers still add up. */
export async function eraseStudentProfile(studentId: string): Promise<void> {
  await dbClient.transaction(async (tx) => {
    await tx.query(
      `UPDATE students
       SET full_name = 'Deleted student', ic_number = $2, phone = NULL, email = NULL,
           date_of_birth = NULL, status = 'DELETED'
       WHERE id = $1`,
      [studentId, `DELETED-${crypto.randomBytes(6).toString('hex')}`]
    );
    await tx.query(`DELETE FROM student_safety_profiles WHERE student_id = $1`, [studentId]);
    await tx.query(`UPDATE student_media_consents SET status = 'REVOKED' WHERE student_id = $1`, [studentId]);
    await tx.query(
      `UPDATE video_submissions SET deleted_at = COALESCE(deleted_at, CURRENT_TIMESTAMP), upload_status = 'DELETED' WHERE student_id = $1`,
      [studentId]
    );
    await tx.query(
      `UPDATE enrollment_applications
       SET student_name = 'Deleted student', ic_number = NULL, phone = NULL,
           emergency_contact_name = NULL, emergency_contact_phone = NULL, medical_notes = NULL
       WHERE student_id = $1`,
      [studentId]
    );
    await tx.query(`UPDATE certificates SET student_name = 'Deleted student' WHERE student_id = $1`, [studentId]);
    await tx.query(`UPDATE parent_student_links SET status = 'REVOKED' WHERE student_id = $1`, [studentId]);
  });
}

/** Removes an account's personal details and ends its access. */
export async function eraseUserAccount(userId: string): Promise<void> {
  const own = await dbClient.query(`SELECT id FROM students WHERE user_id = $1`, [userId]);
  await dbClient.transaction(async (tx) => {
    await tx.query(
      `UPDATE users
       SET full_name = 'Deleted user', email = $2, phone = NULL, password_hash = $3, status = 'DELETED',
           password_changed_at = CURRENT_TIMESTAMP, failed_login_count = 0, locked_until = NULL
       WHERE id = $1`,
      // The address cannot receive mail and the hash matches no password.
      [userId, `deleted-${crypto.randomBytes(8).toString('hex')}@deleted.invalid`, `!deleted$${crypto.randomBytes(16).toString('hex')}`]
    );
    await tx.query(`DELETE FROM device_push_tokens WHERE user_id = $1`, [userId]);
    await tx.query(`DELETE FROM user_notifications WHERE user_id = $1`, [userId]);
    await tx.query(`DELETE FROM password_reset_tokens WHERE user_id = $1`, [userId]);
    await tx.query(`UPDATE parent_student_links SET status = 'REVOKED' WHERE parent_id = $1`, [userId]);
  });
  // A student's own account: the student record goes with it.
  for (const row of own.rows) await eraseStudentProfile(row.id);
}
