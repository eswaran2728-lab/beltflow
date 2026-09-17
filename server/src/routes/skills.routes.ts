import { Router, Request, Response } from 'express';
import { dbClient } from '../db/client';
import { Permission } from '../security/rbac';
import { authenticateJWT, requirePermission } from '../middleware/auth';
import { studentAccess } from '../security/access';
import { UserRole } from '../security/rbac';
import { safeErrorMessage } from '../security/errors';

const router = Router();

// Record or update student skill progress
router.post('/progress', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { studentId, skillId, skillName, category, level, status, notes } = req.body;
    if (!studentId || !skillId) {
      return res.status(400).json({ error: 'studentId and skillId are required.' });
    }

    const access = await studentAccess(req.user!, studentId);
    if (!access.student) return res.status(404).json({ error: 'Student not found.' });
    if (!access.allowed || req.user!.role !== UserRole.MASTER) return res.status(403).json({ error: 'Assigned Master required.' });
    const orgId = access.student.organization_id;

    // Ensure skill exists
    await dbClient.query(
      `INSERT INTO skills (id, organization_id, name, category, description)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO NOTHING`,
      [skillId, orgId, skillName || skillId, category || 'General', notes || '']
    );

    const effectiveLevel = level || status || 'Proficient';

    // Upsert student_skills
    const upsertRes = await dbClient.query(
      `INSERT INTO student_skills (student_id, skill_id, level, notes, updated_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
       ON CONFLICT (student_id, skill_id) DO UPDATE
       SET level = EXCLUDED.level, notes = EXCLUDED.notes, updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [studentId, skillId, effectiveLevel, notes || '']
    );

    return res.json({ message: 'Skill progress updated in PostgreSQL.', progress: upsertRes.rows[0] });
  } catch (err: any) {
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

// Get skill progress for student
router.get('/student/:studentId', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const access = await studentAccess(req.user!, req.params.studentId);
    if (!access.allowed) return res.status(403).json({ error: 'Access denied.' });
    const listRes = await dbClient.query(
      `SELECT ss.*, ss.level as status, s.name as skill_name, s.category
       FROM student_skills ss
       JOIN skills s ON ss.skill_id = s.id
       WHERE ss.student_id = $1`,
      [req.params.studentId]
    );
    return res.json({ skills: listRes.rows });
  } catch (err: any) {
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

export default router;
