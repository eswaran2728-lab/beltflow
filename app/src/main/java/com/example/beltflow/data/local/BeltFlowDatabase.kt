package com.example.beltflow.data.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.sqlite.db.SupportSQLiteDatabase
import com.example.beltflow.data.model.*
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.UUID

@Database(
    entities = [
        ProfileEntity::class,
        AcademySettingsEntity::class,
        BeltEntity::class,
        BranchEntity::class,
        ClassEntity::class,
        StudentEntity::class,
        ClassSessionEntity::class,
        AttendanceEntity::class,
        InvoiceEntity::class,
        PaymentEntity::class,
        GradingEventEntity::class,
        GradingRecordEntity::class,
        SkillEntity::class,
        StudentSkillEntity::class,
        InstructorNoteEntity::class,
        TournamentEntity::class,
        TournamentResultEntity::class,
        CertificateEntity::class
    ],
    version = 2,
    exportSchema = false
)
abstract class BeltFlowDatabase : RoomDatabase() {

    abstract fun dao(): BeltFlowDao

    companion object {
        @Volatile
        private var INSTANCE: BeltFlowDatabase? = null

        fun getDatabase(context: Context, scope: CoroutineScope): BeltFlowDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    BeltFlowDatabase::class.java,
                    "beltflow_database"
                )
                    .fallbackToDestructiveMigration()
                    .addCallback(BeltFlowDatabaseCallback(scope))
                    .build()
                INSTANCE = instance
                instance
            }
        }
    }

    private class BeltFlowDatabaseCallback(
        private val scope: CoroutineScope
    ) : RoomDatabase.Callback() {
        override fun onCreate(db: SupportSQLiteDatabase) {
            super.onCreate(db)
            INSTANCE?.let { database ->
                scope.launch(Dispatchers.IO) {
                    populateInitialData(database.dao())
                }
            }
        }

        override fun onOpen(db: SupportSQLiteDatabase) {
            super.onOpen(db)
            INSTANCE?.let { database ->
                scope.launch(Dispatchers.IO) {
                    ensureAdminAccount(database.dao())
                }
            }
        }
    }
}

suspend fun ensureAdminAccount(dao: BeltFlowDao) {
    val existingAdmin = dao.getProfileByEmail("eswaran2728@gmail.com")
    if (existingAdmin == null) {
        dao.insertProfile(
            ProfileEntity(
                id = "prof_admin_1",
                fullName = "Master Eswaran",
                email = "eswaran2728@gmail.com",
                phone = "+60 12-345 6789",
                role = UserRole.ADMIN,
                status = ProfileStatus.APPROVED,
                password = "Eswaran0321@"
            )
        )
    } else if (existingAdmin.role != UserRole.ADMIN || existingAdmin.password != "Eswaran0321@") {
        dao.insertProfile(
            existingAdmin.copy(
                fullName = "Master Eswaran",
                role = UserRole.ADMIN,
                status = ProfileStatus.APPROVED,
                password = "Eswaran0321@"
            )
        )
    }
}

suspend fun populateInitialData(dao: BeltFlowDao) {
    // 1. Academy Settings
    dao.saveAcademySettings(
        AcademySettingsEntity(
            id = "academy_main",
            name = "Persatuan Silambam Malaysia Daerah Sepang",
            description = "Traditional Martial Arts, Weaponry, Sparring & Belt Mastery Academy",
            martialArtStyle = "Silambam & Traditional Martial Arts",
            phone = "+60 12-345 6789",
            email = "eswaran2728@gmail.com",
            address = "No. 18, Jalan Nilai Impian, 71800 Nilai / Sepang",
            defaultMonthlyFee = 80.0,
            prefix = "PSMDS"
        )
    )

    // 2. Profiles (Admin, Coach, Parent, Student, Pending Parent)
    val adminProfile = ProfileEntity(
        id = "prof_admin_1",
        fullName = "Master Eswaran",
        email = "eswaran2728@gmail.com",
        phone = "+60 12-345 6789",
        role = UserRole.ADMIN,
        status = ProfileStatus.APPROVED,
        password = "Eswaran0321@"
    )
    val coachProfile = ProfileEntity(
        id = "prof_coach_1",
        fullName = "Master Ravi",
        email = "ravi.silambam@gmail.com",
        phone = "+60 16-888 2345",
        role = UserRole.COACH,
        status = ProfileStatus.APPROVED
    )
    val parentProfile = ProfileEntity(
        id = "prof_parent_1",
        fullName = "Suresh Kumar",
        email = "suresh.parent@gmail.com",
        phone = "+60 19-333 4455",
        role = UserRole.PARENT,
        status = ProfileStatus.APPROVED,
        childName = "Aryan Suresh",
        assignedClass = "Junior Silambam (Nilai)"
    )
    val studentProfile = ProfileEntity(
        id = "prof_student_1",
        fullName = "Aryan Suresh",
        email = "aryan.suresh@gmail.com",
        phone = "+60 19-333 4455",
        role = UserRole.STUDENT,
        status = ProfileStatus.APPROVED,
        studentId = "stud_1"
    )
    val pendingParent = ProfileEntity(
        id = "prof_parent_pending",
        fullName = "Kavitha Devi",
        email = "kavitha.devi@gmail.com",
        phone = "+60 17-555 1234",
        role = UserRole.PARENT,
        status = ProfileStatus.PENDING,
        childName = "Deva Raj",
        assignedClass = "Junior Silambam (Sepang)"
    )
    dao.insertProfile(adminProfile)
    dao.insertProfile(coachProfile)
    dao.insertProfile(parentProfile)
    dao.insertProfile(studentProfile)
    dao.insertProfile(pendingParent)

    // 3. Belts
    val belts = listOf(
        BeltEntity("belt_1", "White Belt", "#E2E8F0", 1),
        BeltEntity("belt_2", "Yellow Belt", "#FACC15", 2),
        BeltEntity("belt_3", "Orange Belt", "#FB923C", 3),
        BeltEntity("belt_4", "Green Belt", "#22C55E", 4),
        BeltEntity("belt_5", "Blue Belt", "#3B82F6", 5),
        BeltEntity("belt_6", "Purple Belt", "#A855F7", 6),
        BeltEntity("belt_7", "Brown Belt", "#854D0E", 7),
        BeltEntity("belt_8", "Black Belt 1st Dan", "#0F172A", 8)
    )
    belts.forEach { dao.insertBelt(it) }

    // 4. Branches
    val branchSepang = BranchEntity("br_1", "Sepang Central Dojo", "Kompleks Sukan Daerah Sepang", "+60 3-8706 1122")
    val branchNilai = BranchEntity("br_2", "Nilai Impian Center", "No. 42, Jalan Impian 2, Nilai", "+60 6-799 3344")
    val branchSgPelek = BranchEntity("br_3", "Sungai Pelek Community Hall", "Jalan Besar, Sungai Pelek", "+60 3-3141 8899")
    dao.insertBranch(branchSepang)
    dao.insertBranch(branchNilai)
    dao.insertBranch(branchSgPelek)

    // 5. Classes
    val classJuniorNilai = ClassEntity(
        id = "cls_1",
        branchId = "br_2",
        name = "Junior Silambam (Nilai)",
        code = "NIL101",
        dayOfWeek = 6,
        startTime = "09:00",
        endTime = "10:30",
        scheduleNote = "Saturday 9:00 AM - 10:30 AM",
        monthlyFeeOverride = 80.0,
        coachName = "Master Ravi"
    )
    val classSeniorSepang = ClassEntity(
        id = "cls_2",
        branchId = "br_1",
        name = "Senior Weaponry & Sparring (Sepang)",
        code = "SEP202",
        dayOfWeek = 7,
        startTime = "10:00",
        endTime = "12:00",
        scheduleNote = "Sunday 10:00 AM - 12:00 PM",
        monthlyFeeOverride = 100.0,
        coachName = "Master Ravi"
    )
    val classKidsSgPelek = ClassEntity(
        id = "cls_3",
        branchId = "br_3",
        name = "Kids Foundation (Sungai Pelek)",
        code = "SGP303",
        dayOfWeek = 6,
        startTime = "16:00",
        endTime = "17:30",
        scheduleNote = "Saturday 4:00 PM - 5:30 PM",
        monthlyFeeOverride = 75.0,
        coachName = "Eswaran"
    )
    dao.insertClass(classJuniorNilai)
    dao.insertClass(classSeniorSepang)
    dao.insertClass(classKidsSgPelek)

    // 6. Students
    val students = listOf(
        StudentEntity(
            id = "stud_1",
            profileId = "prof_student_1",
            fullName = "Aryan Suresh",
            icOrMykid = "120504-10-5543",
            dateOfBirth = "2012-05-04",
            gender = "Male",
            beltId = "belt_3", // Orange Belt
            lifecycle = Lifecycle.ACTIVE,
            joinedAt = "2024-02-15",
            parentName = "Suresh Kumar",
            parentPhone = "+60 19-333 4455",
            parentProfileId = "prof_parent_1",
            medicalNotes = "None. Asthmatic inhaler kept in kit bag as precaution.",
            classIdsJson = "[\"cls_1\"]"
        ),
        StudentEntity(
            id = "stud_2",
            fullName = "Tharun Kumar",
            icOrMykid = "140812-10-8831",
            dateOfBirth = "2014-08-12",
            gender = "Male",
            beltId = "belt_2", // Yellow Belt
            lifecycle = Lifecycle.ACTIVE,
            joinedAt = "2024-06-01",
            parentName = "Suresh Kumar",
            parentPhone = "+60 19-333 4455",
            parentProfileId = "prof_parent_1",
            medicalNotes = "None",
            classIdsJson = "[\"cls_1\"]"
        ),
        StudentEntity(
            id = "stud_3",
            fullName = "Dhivya Letchumi",
            icOrMykid = "110321-14-6102",
            dateOfBirth = "2011-03-21",
            gender = "Female",
            beltId = "belt_5", // Blue Belt
            lifecycle = Lifecycle.ACTIVE,
            joinedAt = "2023-08-10",
            parentName = "Maniam G.",
            parentPhone = "+60 12-998 7766",
            medicalNotes = "None. Tournament team captain.",
            classIdsJson = "[\"cls_1\", \"cls_2\"]"
        ),
        StudentEntity(
            id = "stud_4",
            fullName = "Harish Nair",
            icOrMykid = "130719-10-3321",
            dateOfBirth = "2013-07-19",
            gender = "Male",
            beltId = "belt_2", // Yellow Belt
            lifecycle = Lifecycle.ACTIVE,
            joinedAt = "2024-04-12",
            parentName = "Radha Nair",
            parentPhone = "+60 13-445 6677",
            medicalNotes = "Mild dust allergy.",
            classIdsJson = "[\"cls_1\"]"
        ),
        StudentEntity(
            id = "stud_5",
            fullName = "Kaviarasan Mohan",
            icOrMykid = "100915-10-4499",
            dateOfBirth = "2010-09-15",
            gender = "Male",
            beltId = "belt_6", // Purple Belt
            lifecycle = Lifecycle.ACTIVE,
            joinedAt = "2023-01-20",
            parentName = "Mohan Rao",
            parentPhone = "+60 17-223 9988",
            medicalNotes = "None.",
            classIdsJson = "[\"cls_2\"]"
        ),
        StudentEntity(
            id = "stud_6",
            fullName = "Aiman Hakim",
            icOrMykid = "150110-10-2211",
            dateOfBirth = "2015-01-10",
            gender = "Male",
            beltId = "belt_1", // White Belt
            lifecycle = Lifecycle.TRIAL,
            joinedAt = "2025-02-01",
            parentName = "Farid Yusof",
            parentPhone = "+60 11-234 5678",
            medicalNotes = "First month trial session.",
            classIdsJson = "[\"cls_3\"]"
        )
    )
    students.forEach { dao.insertStudent(it) }

    // 7. Class Sessions & Attendance
    val sessionDates = listOf("2025-02-08", "2025-02-15", "2025-02-22", "2025-03-01")
    sessionDates.forEachIndexed { index, date ->
        val sessionId = "sess_cls1_$index"
        dao.insertSession(ClassSessionEntity(sessionId, "cls_1", date))
        // Attendance records
        dao.insertSingleAttendance(AttendanceEntity("att_${sessionId}_1", sessionId, "stud_1", AttendanceStatus.PRESENT, date, "cls_1"))
        dao.insertSingleAttendance(AttendanceEntity("att_${sessionId}_2", sessionId, "stud_2", AttendanceStatus.PRESENT, date, "cls_1"))
        dao.insertSingleAttendance(AttendanceEntity("att_${sessionId}_3", sessionId, "stud_3", AttendanceStatus.PRESENT, date, "cls_1"))
        // Harish was absent 3 times to demonstrate At-Risk tracker
        val harishStatus = if (index >= 1) AttendanceStatus.ABSENT else AttendanceStatus.PRESENT
        dao.insertSingleAttendance(AttendanceEntity("att_${sessionId}_4", sessionId, "stud_4", harishStatus, date, "cls_1"))
    }

    // 8. Skills Curriculum (Silambam & Martial Arts Syllabus)
    val skills = listOf(
        SkillEntity("sk_1", "Kaaladi & Basic Footwork (1 to 8 steps)", "Foundation", "Basic body balance, steps stance, pivot rotations", 1),
        SkillEntity("sk_2", "Sedikuchi (Single Short Stick Swings)", "Weapons", "Single arm rotary motion, head guard, side deflection", 2),
        SkillEntity("sk_3", "Nedunkambu (Long Staff Standard Spin)", "Weapons", "Double hand figure-eight, overhead strike, block", 3),
        SkillEntity("sk_4", "Por Silambam (Sparring Fundamentals)", "Sparring", "Defensive retreat, distance control, counter-thrust", 4),
        SkillEntity("sk_5", "Thanithiramai (Solo Routine Forms 1-3)", "Forms", "Choreographed continuous staff maneuvers with power", 5),
        SkillEntity("sk_6", "Maan Kombu (Deer Horn Weaponry Intro)", "Advanced", "Traditional double-horn deflection and wrist locks", 6)
    )
    skills.forEach { dao.insertSkill(it) }

    // Student Skill Mastery
    val studentSkills = listOf(
        StudentSkillEntity("ssk_1_1", "stud_1", "sk_1", SkillLevel.MASTERED, "Excellent agility and posture."),
        StudentSkillEntity("ssk_1_2", "stud_1", "sk_2", SkillLevel.GOOD, "Speed improved; focus on left hand grip."),
        StudentSkillEntity("ssk_1_3", "stud_1", "sk_3", SkillLevel.LEARNING, "Practicing figure-8 reverse swings."),
        StudentSkillEntity("ssk_1_4", "stud_1", "sk_4", SkillLevel.LEARNING, "Good reaction time in friendly matches."),
        StudentSkillEntity("ssk_3_1", "stud_3", "sk_1", SkillLevel.MASTERED, "Flawless foundation."),
        StudentSkillEntity("ssk_3_2", "stud_3", "sk_2", SkillLevel.MASTERED, "Sharp precision."),
        StudentSkillEntity("ssk_3_3", "stud_3", "sk_3", SkillLevel.MASTERED, "State team level execution."),
        StudentSkillEntity("ssk_3_5", "stud_3", "sk_5", SkillLevel.MASTERED, "Gold medalist standard routine.")
    )
    studentSkills.forEach { dao.setStudentSkillLevel(it) }

    // 9. Invoices & Payments (Fee Management with Sibling Discount)
    val currentMonth = SimpleDateFormat("yyyy-MM", Locale.getDefault()).format(Date())
    val prevMonth = "2025-02"

    // Sibling 1 (Aryan): RM 80
    val invAryanPrev = InvoiceEntity(
        id = "inv_aryan_prev",
        studentId = "stud_1",
        billingMonth = prevMonth,
        amount = 80.0,
        discount = 0.0,
        discountReason = "",
        status = InvoiceStatus.PAID
    )
    val invAryanCur = InvoiceEntity(
        id = "inv_aryan_cur",
        studentId = "stud_1",
        billingMonth = currentMonth,
        amount = 80.0,
        discount = 0.0,
        discountReason = "",
        status = InvoiceStatus.PENDING_APPROVAL
    )
    // Sibling 2 (Tharun): 10% Sibling discount -> RM 72.00
    val invTharunCur = InvoiceEntity(
        id = "inv_tharun_cur",
        studentId = "stud_2",
        billingMonth = currentMonth,
        amount = 80.0,
        discount = 8.0,
        discountReason = "Sibling Discount (10%)",
        status = InvoiceStatus.UNPAID
    )
    val invDhivyaCur = InvoiceEntity(
        id = "inv_dhivya_cur",
        studentId = "stud_3",
        billingMonth = currentMonth,
        amount = 100.0,
        discount = 0.0,
        discountReason = "",
        status = InvoiceStatus.PAID
    )
    val invHarishCur = InvoiceEntity(
        id = "inv_harish_cur",
        studentId = "stud_4",
        billingMonth = currentMonth,
        amount = 80.0,
        discount = 0.0,
        discountReason = "",
        status = InvoiceStatus.OVERDUE
    )

    dao.insertInvoice(invAryanPrev)
    dao.insertInvoice(invAryanCur)
    dao.insertInvoice(invTharunCur)
    dao.insertInvoice(invDhivyaCur)
    dao.insertInvoice(invHarishCur)

    // Payments
    val p1 = PaymentEntity(
        id = "pay_1",
        invoiceId = "inv_aryan_prev",
        amount = 80.0,
        method = PaymentMethod.FPX,
        submittedBy = "prof_parent_1",
        approvedBy = "prof_admin_1",
        approvedAt = System.currentTimeMillis() - 86400000L * 20,
        receiptNo = "PSMDS-2025-0012",
        notes = "Auto-cleared via FPX Online Banking"
    )
    val p2 = PaymentEntity(
        id = "pay_2",
        invoiceId = "inv_aryan_cur",
        amount = 80.0,
        method = PaymentMethod.CASH,
        submittedBy = "prof_parent_1",
        approvedBy = null,
        approvedAt = null,
        receiptNo = null,
        notes = "Cash passed to Master Ravi during Saturday session"
    )
    val p3 = PaymentEntity(
        id = "pay_3",
        invoiceId = "inv_dhivya_cur",
        amount = 100.0,
        method = PaymentMethod.TRANSFER,
        submittedBy = "prof_admin_1",
        approvedBy = "prof_admin_1",
        approvedAt = System.currentTimeMillis() - 86400000L * 2,
        receiptNo = "PSMDS-2025-0038",
        notes = "Direct instant transfer with receipt verified"
    )
    dao.insertPayment(p1)
    dao.insertPayment(p2)
    dao.insertPayment(p3)

    // 10. Grading Events & Records
    val gradingPast = GradingEventEntity(
        id = "gr_event_1",
        name = "Annual Belt Promotion & Grading 2024",
        eventDate = "2024-11-24",
        location = "Sepang Central Dojo",
        examiner = "Grandmaster K. Subramaniam (7th Dan)",
        fee = 50.0,
        isCompleted = true
    )
    val gradingUpcoming = GradingEventEntity(
        id = "gr_event_2",
        name = "Mid-Year Belt Advancement Exam 2025",
        eventDate = "2025-06-15",
        location = "Kompleks Sukan Nilai",
        examiner = "Master Ravi (5th Dan)",
        fee = 60.0,
        isCompleted = false
    )
    dao.insertGradingEvent(gradingPast)
    dao.insertGradingEvent(gradingUpcoming)

    val grRecord1 = GradingRecordEntity(
        id = "grec_1",
        gradingEventId = "gr_event_1",
        studentId = "stud_1",
        fromBeltId = "belt_2", // Yellow -> Orange
        toBeltId = "belt_3",
        result = GradingResultType.PASS,
        notes = "Excellent power in Kaaladi steps and stick strikes.",
        gradedAt = System.currentTimeMillis() - 86400000L * 90
    )
    val grRecord2 = GradingRecordEntity(
        id = "grec_2",
        gradingEventId = "gr_event_1",
        studentId = "stud_3",
        fromBeltId = "belt_4", // Green -> Blue
        toBeltId = "belt_5",
        result = GradingResultType.PASS,
        notes = "Outstanding Thanithiramai demonstration. Highest score in batch.",
        gradedAt = System.currentTimeMillis() - 86400000L * 90
    )
    val grRecord3 = GradingRecordEntity(
        id = "grec_3",
        gradingEventId = "gr_event_2",
        studentId = "stud_1",
        fromBeltId = "belt_3", // Orange -> Green
        toBeltId = "belt_4",
        result = GradingResultType.REGISTERED,
        notes = "Pre-registered candidate."
    )
    dao.insertGradingRecord(grRecord1)
    dao.insertGradingRecord(grRecord2)
    dao.insertGradingRecord(grRecord3)

    // 11. Instructor Notes
    val note1 = InstructorNoteEntity(
        id = "note_1",
        studentId = "stud_1",
        authorName = "Master Ravi",
        body = "Aryan has shown tremendous improvement in weapon stance and balance. Ready for next belt grading syllabus.",
        visibility = NoteVisibility.PARENT_VISIBLE,
        createdAt = System.currentTimeMillis() - 86400000L * 5
    )
    val note2 = InstructorNoteEntity(
        id = "note_2",
        studentId = "stud_4",
        authorName = "Master Ravi",
        body = "Missed 3 consecutive classes. Parent contacted regarding transportation. Advised to attend make-up session on Sunday.",
        visibility = NoteVisibility.STAFF,
        createdAt = System.currentTimeMillis() - 86400000L * 2
    )
    dao.insertNote(note1)
    dao.insertNote(note2)

    // 12. Tournaments & Results
    val tourney1 = TournamentEntity(
        id = "tourn_1",
        name = "Kejohanan Silambam Remaja Selangor 2024",
        eventDate = "2024-10-12",
        location = "Stadium Tertutup Shah Alam",
        organizer = "Persatuan Silambam Negeri Selangor"
    )
    val tourney2 = TournamentEntity(
        id = "tourn_2",
        name = "National Traditional Martial Arts Championship 2025",
        eventDate = "2025-07-20",
        location = "Axiata Arena, Bukit Jalil",
        organizer = "Kementerian Belia dan Sukan"
    )
    dao.insertTournament(tourney1)
    dao.insertTournament(tourney2)

    val tRes1 = TournamentResultEntity(
        id = "tres_1",
        tournamentId = "tourn_1",
        studentId = "stud_3",
        eventCategory = "Girls Under-15 Solo Staff Routine (Thanithiramai)",
        medal = Medal.GOLD,
        points = 10,
        notes = "Score 9.85 - 1st Place Champion"
    )
    val tRes2 = TournamentResultEntity(
        id = "tres_2",
        tournamentId = "tourn_1",
        studentId = "stud_1",
        eventCategory = "Boys Under-13 Sparring (Por Silambam)",
        medal = Medal.SILVER,
        points = 7,
        notes = "Close final match 14-12 points."
    )
    dao.insertTournamentResult(tRes1)
    dao.insertTournamentResult(tRes2)

    // 13. Digital Certificates
    val cert1 = CertificateEntity(
        id = "cert_1",
        studentId = "stud_1",
        type = CertType.GRADING,
        title = "Orange Belt Advancement Certificate",
        certNo = "PSMDS-GRAD-2024-041",
        verifyCode = "BF-ORANGE-9821",
        issuedAt = "2024-11-24",
        issuedBy = "Grandmaster K. Subramaniam & Master Ravi"
    )
    val cert2 = CertificateEntity(
        id = "cert_2",
        studentId = "stud_3",
        type = CertType.TOURNAMENT,
        title = "Gold Medalist - Selangor State Youth Championship",
        certNo = "PSMDS-ACHV-2024-008",
        verifyCode = "BF-GOLD-5541",
        issuedAt = "2024-10-12",
        issuedBy = "Persatuan Silambam Selangor"
    )
    dao.insertCertificate(cert1)
    dao.insertCertificate(cert2)
}
