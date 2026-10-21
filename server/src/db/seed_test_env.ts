import { dbClient } from './client';
import { hashPasswordServer } from '../security/crypto';
import { UserRole } from '../security/rbac';

export async function seedTestEnvironment(): Promise<void> {
  console.log('🌱 Initializing Safe Non-Production BeltFlow Test Environment...');
  await dbClient.init();

  const testPasswordHash = hashPasswordServer('TestPass2026!');

  // 1. Seed Organizations
  console.log('🏛️ Seeding Organizations...');
  const orgSelangor = 'org_selangor_silambam';
  const orgPenang = 'org_penang_silambam';

  await dbClient.query(
    `INSERT INTO organizations (
      id, name, state, martial_art_style, master_name, phone, email,
      base_monthly_fee, sibling_discount_percent, status
    ) VALUES 
      ($1, 'Persatuan Silambam Negeri Selangor', 'Selangor', 'Silambam Traditional', 'Master Ravi Chandran', '+60123456781', 'contact@selangor.silambam.test', 120.00, 10.00, 'ACTIVE'),
      ($2, 'Persatuan Silambam Pulau Pinang', 'Pulau Pinang', 'Silambam Traditional', 'Master Anand Kumar', '+60123456782', 'contact@penang.silambam.test', 110.00, 15.00, 'ACTIVE')
    ON CONFLICT (id) DO UPDATE SET 
      name = EXCLUDED.name,
      status = 'ACTIVE';`,
    [orgSelangor, orgPenang]
  );

  // 2. Seed Users
  console.log('👥 Seeding Non-Production Test Users...');
  const users = [
    {
      id: 'usr_superadmin_test',
      email: 'superadmin@beltflow.test',
      fullName: 'BeltFlow Super Admin (Test)',
      phone: '+60100000001',
      role: UserRole.SUPER_ADMIN,
      orgId: null,
    },
    {
      id: 'usr_admin_selangor',
      email: 'admin@selangor.silambam.test',
      fullName: 'Pravin Kumar (Selangor Admin)',
      phone: '+60100000002',
      role: UserRole.ADMIN_PERSATUAN,
      orgId: orgSelangor,
    },
    {
      id: 'usr_admin_penang',
      email: 'admin@penang.silambam.test',
      fullName: 'Kavitha Nair (Penang Admin)',
      phone: '+60100000003',
      role: UserRole.ADMIN_PERSATUAN,
      orgId: orgPenang,
    },
    {
      id: 'usr_master_ravi',
      email: 'master.ravi@selangor.silambam.test',
      fullName: 'Master Ravi Chandran',
      phone: '+60100000004',
      role: UserRole.MASTER,
      orgId: orgSelangor,
    },
    {
      id: 'usr_master_anand',
      email: 'master.anand@penang.silambam.test',
      fullName: 'Master Anand Kumar',
      phone: '+60100000005',
      role: UserRole.MASTER,
      orgId: orgPenang,
    },
    {
      id: 'usr_parent_suresh',
      email: 'parent.suresh@family.test',
      fullName: 'Suresh Kumar (Parent)',
      phone: '+60100000006',
      role: UserRole.PARENT,
      orgId: orgSelangor,
    },
    {
      id: 'usr_student_aryan',
      email: 'student.aryan@beltflow.test',
      fullName: 'Aryan Suresh (Student)',
      phone: '+60100000007',
      role: UserRole.STUDENT,
      orgId: orgSelangor,
    },
    {
      id: 'usr_student_dev',
      email: 'student.dev@beltflow.test',
      fullName: 'Dev Suresh (Student)',
      phone: '+60100000008',
      role: UserRole.STUDENT,
      orgId: orgSelangor,
    },
    {
      id: 'usr_student_kiran',
      email: 'student.kiran@beltflow.test',
      fullName: 'Kiran Pillai (Student)',
      phone: '+60100000009',
      role: UserRole.STUDENT,
      orgId: orgPenang,
    },
  ];

  for (const u of users) {
    await dbClient.query(
      `INSERT INTO users (id, email, password_hash, full_name, phone, role, organization_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'ACTIVE')
       ON CONFLICT (id) DO UPDATE SET 
         email = EXCLUDED.email,
         password_hash = EXCLUDED.password_hash,
         full_name = EXCLUDED.full_name,
         role = EXCLUDED.role,
         organization_id = EXCLUDED.organization_id,
         status = 'ACTIVE';`,
      [u.id, u.email, testPasswordHash, u.fullName, u.phone, u.role, u.orgId]
    );
  }

  // 3. Seed Classes
  console.log('🥋 Seeding Classes & Schedules...');
  const clsSelangorJunior = 'cls_selangor_junior';
  const clsSelangorAdvanced = 'cls_selangor_advanced';
  const clsPenangYouth = 'cls_penang_youth';

  await dbClient.query(
    `INSERT INTO classes (id, organization_id, master_id, name, schedule, location, monthly_fee, status)
     VALUES 
       ($1, $2, 'usr_master_ravi', 'Silambam Junior Warriors', 'Saturday 09:00 - 10:30', 'Dewan Silambam Petaling Jaya', 120.00, 'ACTIVE'),
       ($3, $2, 'usr_master_ravi', 'Silambam Elite Weapons & Forms', 'Sunday 10:00 - 11:30', 'Dewan Silambam Petaling Jaya', 140.00, 'ACTIVE'),
       ($4, $5, 'usr_master_anand', 'Penang Youth Traditional Forms', 'Saturday 16:00 - 17:30', 'Gelanggang Silambam George Town', 110.00, 'ACTIVE')
     ON CONFLICT (id) DO UPDATE SET 
       name = EXCLUDED.name,
       schedule = EXCLUDED.schedule,
       location = EXCLUDED.location,
       monthly_fee = EXCLUDED.monthly_fee,
       status = 'ACTIVE';`,
    [clsSelangorJunior, orgSelangor, clsSelangorAdvanced, clsPenangYouth, orgPenang]
  );

  // 4. Seed Coach Assignments & Leadership
  console.log('🎖️ Seeding Coach Assignments & Leadership...');
  await dbClient.query(
    `INSERT INTO coach_class_assignments (coach_id, class_id, is_main_master)
     VALUES 
       ('usr_master_ravi', $1, TRUE),
       ('usr_master_ravi', $2, TRUE),
       ('usr_master_anand', $3, TRUE)
     ON CONFLICT (coach_id, class_id) DO UPDATE SET is_main_master = EXCLUDED.is_main_master;`,
    [clsSelangorJunior, clsSelangorAdvanced, clsPenangYouth]
  );

  await dbClient.query(
    `INSERT INTO class_leaderships (id, organization_id, class_id, master_id, leadership_type, is_active, effective_from)
     VALUES 
       ('lead_ravi_junior', $1, $2, 'usr_master_ravi', 'PRIMARY', TRUE, CURRENT_TIMESTAMP),
       ('lead_ravi_advanced', $1, $3, 'usr_master_ravi', 'PRIMARY', TRUE, CURRENT_TIMESTAMP),
       ('lead_anand_penang', $4, $5, 'usr_master_anand', 'PRIMARY', TRUE, CURRENT_TIMESTAMP)
     ON CONFLICT (id) DO UPDATE SET is_active = TRUE;`,
    [orgSelangor, clsSelangorJunior, clsSelangorAdvanced, orgPenang, clsPenangYouth]
  );

  // 5. Seed Students & Profiles
  console.log('👦 Seeding Fictional Student Roster...');
  const stuAryan = 'stu_aryan_001';
  const stuDev = 'stu_dev_002';
  const stuKiran = 'stu_kiran_003';

  await dbClient.query(
    `INSERT INTO students (id, organization_id, user_id, class_id, full_name, ic_number, belt_rank, monthly_fee, has_sibling_discount, billing_status, status)
     VALUES 
       ($1, $2, 'usr_student_aryan', $3, 'Aryan Suresh', '140515-10-1234', 'Yellow Belt', 108.00, TRUE, 'Paid', 'ACTIVE'),
       ($4, $2, 'usr_student_dev', $3, 'Dev Suresh', '160820-10-5678', 'White Belt', 108.00, TRUE, 'Paid', 'ACTIVE'),
       ($5, $6, 'usr_student_kiran', $7, 'Kiran Pillai', '150310-07-9999', 'White Belt', 110.00, FALSE, 'Paid', 'ACTIVE')
     ON CONFLICT (id) DO UPDATE SET 
       full_name = EXCLUDED.full_name,
       class_id = EXCLUDED.class_id,
       belt_rank = EXCLUDED.belt_rank,
       monthly_fee = EXCLUDED.monthly_fee,
       has_sibling_discount = EXCLUDED.has_sibling_discount,
       status = 'ACTIVE';`,
    [stuAryan, orgSelangor, clsSelangorJunior, stuDev, stuKiran, orgPenang, clsPenangYouth]
  );

  // Class Enrollments (Task H05 canonical table)
  await dbClient.query(
    `INSERT INTO class_enrollments (id, student_id, class_id, organization_id, status, is_primary, provenance)
     VALUES 
       ('enr_aryan_jr', $1, $3, $2, 'ACTIVE', TRUE, 'MASTER_APPROVED'),
       ('enr_dev_jr', $4, $3, $2, 'ACTIVE', TRUE, 'MASTER_APPROVED'),
       ('enr_kiran_penang', $5, $7, $6, 'ACTIVE', TRUE, 'MASTER_APPROVED')
     ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE';`,
    [stuAryan, orgSelangor, clsSelangorJunior, stuDev, stuKiran, orgPenang, clsPenangYouth]
  );

  // 6. Seed Parent Links
  console.log('👨‍👩‍👧 Seeding Parent-Child Links...');
  await dbClient.query(
    `INSERT INTO parent_student_links (parent_id, student_id, status, student_approved, master_approved, admin_approved)
     VALUES 
       ('usr_parent_suresh', $1, 'ACTIVE', TRUE, TRUE, TRUE),
       ('usr_parent_suresh', $2, 'ACTIVE', TRUE, TRUE, TRUE)
     ON CONFLICT (parent_id, student_id) DO UPDATE SET 
       status = 'ACTIVE',
       student_approved = TRUE,
       master_approved = TRUE,
       admin_approved = TRUE;`,
    [stuAryan, stuDev]
  );

  // 7. Seed Curriculum & Ranks (Task H09)
  console.log('🥋 Seeding Persatuan Curriculum & Belt Ranks...');
  const curricSelangor = 'curric_selangor_v1';
  await dbClient.query(
    `INSERT INTO persatuan_curriculums (id, organization_id, system_name, martial_art_style, version, status, created_by, published_at)
     VALUES ($1, $2, 'Syllabus Silambam Malaysia Traditional', 'Silambam Traditional', 1, 'PUBLISHED', 'usr_admin_selangor', CURRENT_TIMESTAMP)
     ON CONFLICT (id) DO NOTHING;`,
    [curricSelangor, orgSelangor]
  );

  const ranks = [
    { id: 'rnk_sel_1', rankOrder: 1, name: 'White Belt', colorHex: '#FFFFFF', months: 3, sessions: 24, fee: 30.00 },
    { id: 'rnk_sel_2', rankOrder: 2, name: 'Yellow Belt', colorHex: '#EAB308', months: 6, sessions: 48, fee: 40.00 },
    { id: 'rnk_sel_3', rankOrder: 3, name: 'Orange Belt', colorHex: '#F97316', months: 6, sessions: 48, fee: 40.00 },
    { id: 'rnk_sel_4', rankOrder: 4, name: 'Green Belt', colorHex: '#22C55E', months: 6, sessions: 48, fee: 50.00 },
    { id: 'rnk_sel_5', rankOrder: 5, name: 'Blue Belt', colorHex: '#3B82F6', months: 9, sessions: 72, fee: 60.00 },
    { id: 'rnk_sel_6', rankOrder: 6, name: 'Brown Belt', colorHex: '#78350F', months: 12, sessions: 96, fee: 70.00 },
    { id: 'rnk_sel_7', rankOrder: 7, name: 'Black Belt (Guru Muda)', colorHex: '#000000', months: 12, sessions: 120, fee: 100.00 },
  ];

  for (const r of ranks) {
    await dbClient.query(
      `INSERT INTO curriculum_belt_ranks (id, curriculum_id, name, rank_order, color_hex, min_months, min_sessions, grading_fee)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO NOTHING;`,
      [r.id, curricSelangor, r.name, r.rankOrder, r.colorHex, r.months, r.sessions, r.fee]
    );
  }

  // 8. Seed Attendance Sessions & Records
  console.log('📋 Seeding Attendance Sessions...');
  const sessionDateStr = new Date().toISOString().slice(0, 10);
  const sessToday = `sess_sel_${sessionDateStr}`;

  await dbClient.query(
    `INSERT INTO attendance_sessions (id, class_id, session_date, status)
     VALUES ($1, $2, $3, 'COMPLETED')
     ON CONFLICT (class_id, session_date) DO NOTHING;`,
    [sessToday, clsSelangorJunior, sessionDateStr]
  );

  await dbClient.query(
    `INSERT INTO attendance_records (id, class_id, session_date, student_id, status)
     VALUES 
       ($1, $2, $3, $4, 'present'),
       ($5, $2, $3, $6, 'present')
     ON CONFLICT (class_id, session_date, student_id) DO NOTHING;`,
    [`rec_ar_${sessionDateStr}`, clsSelangorJunior, sessionDateStr, stuAryan, `rec_dv_${sessionDateStr}`, stuDev]
  );

  // 9. Seed Official Certificate Example
  console.log('📜 Seeding Belt Progression & Certificate Records...');
  const certCode = 'CERT-SEL-SILAMBAM-2026-001';
  await dbClient.query(
    `INSERT INTO certificates (
      id, code, organization_id, organization_name, student_id, student_name, master_name,
      rank_or_title, type, issue_date, status
    ) VALUES (
      'cert_aryan_yellow', $1, $2, 'Persatuan Silambam Negeri Selangor', $3, 'Aryan Suresh',
      'Master Ravi Chandran', 'Yellow Belt', 'Promotion Exam', $4, 'ACTIVE'
    ) ON CONFLICT (code) DO NOTHING;`,
    [certCode, orgSelangor, stuAryan, sessionDateStr]
  );

  // 10. Seed Parent-Master Messaging Thread (Task H22)
  console.log('💬 Seeding Parent-Master Messaging Thread...');
  const threadId = 'thread_suresh_ravi_junior';
  await dbClient.query(
    `INSERT INTO message_threads (
      id, organization_id, class_id, student_id, parent_id, assigned_master_id,
      subject, status, created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, 'usr_parent_suresh', 'usr_master_ravi',
      'Aryan Syllabus & Attendance Inquiries', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    ) ON CONFLICT (id) DO NOTHING;`,
    [threadId, orgSelangor, clsSelangorJunior, stuAryan]
  );

  await dbClient.query(
    `INSERT INTO thread_messages (
      id, thread_id, sender_id, sender_role, content, delivery_status, created_at
    ) VALUES 
      ('msg_001', $1, 'usr_parent_suresh', 'PARENT', 'Vanakkam Master Ravi. Aryan has been practicing his staff spinning at home diligently every evening.', 'SENT', CURRENT_TIMESTAMP - INTERVAL '2 hours'),
      ('msg_002', $1, 'usr_master_ravi', 'MASTER', 'Vanakkam Suresh. Yes, Aryan showed great balance in class today. He is progressing well towards his Orange Belt syllabus requirements.', 'SENT', CURRENT_TIMESTAMP - INTERVAL '1 hour')
    ON CONFLICT (id) DO NOTHING;`,
    [threadId]
  );


  // 11. Seed Safety Notices (Task H11)
  console.log('📢 Seeding Announcements & Safety Notices...');
  await dbClient.query(
    `INSERT INTO notices (
      id, organization_id, class_id, type, message, sender_id, sender_name, requires_acknowledgement
    ) VALUES 
      ('notice_welcome_2026', $1, $2, 'GENERAL', 'Welcome to BeltFlow Academy Testing Environment. All financial and identity data in this environment is simulated and strictly non-production.', 'usr_admin_selangor', 'Pravin Kumar (Selangor Admin)', FALSE),
      ('notice_safety_weapons', $1, $2, 'GENERAL', 'Staff Safety Guidelines & Uniform Regulations: All students must inspect bamboo sticks before sparring and ensure protective headgear is fastened.', 'usr_master_ravi', 'Master Ravi Chandran', TRUE)
    ON CONFLICT (id) DO NOTHING;`,
    [orgSelangor, clsSelangorJunior]
  );

  // 12. Seed Sandbox Merchant Config (Task H13)
  console.log('💳 Seeding Non-Production Sandbox Merchant Configuration...');
  await dbClient.query(
    `INSERT INTO persatuan_merchants (
      id, organization_id, provider, merchant_account_id, merchant_name, settlement_bank_name,
      settlement_account_masked, fpx_enabled, duitnow_enabled, card_enabled, status
    ) VALUES 
      ('merch_selangor', $1, 'SANDBOX', 'SBX-MCH-SEL-001', 'Persatuan Silambam Selangor (Sandbox)', 'Maybank Islamic Berhad', '****-****-5544', TRUE, TRUE, FALSE, 'ACTIVE'),
      ('merch_penang', $2, 'SANDBOX', 'SBX-MCH-PNG-002', 'Persatuan Silambam Penang (Sandbox)', 'CIMB Bank Berhad', '****-****-8811', TRUE, TRUE, FALSE, 'ACTIVE')
    ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE';`,
    [orgSelangor, orgPenang]
  );


  console.log('✅ BeltFlow Safe Non-Production Test Environment Seeding Complete!');
}

if (require.main === module) {
  seedTestEnvironment()
    .then(async () => {
      await dbClient.close();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('❌ Failed to seed test environment:', err);
      await dbClient.close();
      process.exit(1);
    });
}
