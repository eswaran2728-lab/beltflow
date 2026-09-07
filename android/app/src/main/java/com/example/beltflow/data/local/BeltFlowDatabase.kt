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

@Database(
    entities = [
        PersatuanEntity::class,
        ProfileEntity::class,
        AcademySettingsEntity::class,
        BeltEntity::class,
        BranchEntity::class,
        ClassEntity::class,
        ClassMasterCrossRefEntity::class,
        StudentEntity::class,
        ParentChildLinkEntity::class,
        ClassTransferRequestEntity::class,
        AuditLogEntity::class,
        AnnouncementEntity::class,
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
    version = 4,
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
    // 1. Ensure Super Admin Account (Admin BeltFlow)
    val superAdmin = dao.getProfileByEmail("superadmin@beltflow.my")
    if (superAdmin == null) {
        dao.insertProfile(
            ProfileEntity(
                id = "prof_super_admin",
                fullName = "Admin BeltFlow (Super Admin)",
                email = "superadmin@beltflow.my",
                phone = "+60 12-000 0000",
                role = UserRole.SUPER_ADMIN,
                status = ProfileStatus.APPROVED,
                organizationId = null,
                password = "BeltFlow2026@"
            )
        )
    }

    // 2. Ensure Admin Persatuan Account (Master Eswaran)
    val adminPersatuan = dao.getProfileByEmail("eswaran2728@gmail.com")
    if (adminPersatuan == null) {
        dao.insertProfile(
            ProfileEntity(
                id = "prof_admin_eswaran",
                fullName = "Master Eswaran",
                email = "eswaran2728@gmail.com",
                phone = "+60 12-345 6789",
                role = UserRole.ADMIN_PERSATUAN,
                status = ProfileStatus.APPROVED,
                organizationId = "persatuan_selangor",
                password = "Eswaran0321@"
            )
        )
    } else if (adminPersatuan.role != UserRole.ADMIN_PERSATUAN || adminPersatuan.password != "Eswaran0321@") {
        dao.insertProfile(
            adminPersatuan.copy(
                fullName = "Master Eswaran",
                role = UserRole.ADMIN_PERSATUAN,
                status = ProfileStatus.APPROVED,
                organizationId = "persatuan_selangor",
                password = "Eswaran0321@"
            )
        )
    }
}

suspend fun populateInitialData(dao: BeltFlowDao) {
    // 1. Persatuan Organizations
    val persatuanSelangor = PersatuanEntity(
        id = "persatuan_selangor",
        name = "Persatuan Taekwondo Selangor",
        logoUrl = "beltflow-logo.png",
        phone = "+60 3-8706 1122",
        email = "admin@selangortkd.org",
        address = "Kompleks Sukan Daerah Sepang, Selangor",
        registrationNo = "PPM-014-10-12052021",
        status = ProfileStatus.APPROVED,
        subscriptionPlan = SubscriptionPlan.GROWTH,
        subscriptionStatus = SubscriptionStatus.ACTIVE,
        renewalDate = "2026-12-31",
        monthlyFee = 399.0,
        platformChargeRatePercent = 8.0
    )
    dao.insertPersatuan(persatuanSelangor)

    // 2. Academy Settings
    dao.saveAcademySettings(
        AcademySettingsEntity(
            id = "academy_main",
            organizationId = "persatuan_selangor",
            name = "Persatuan Taekwondo Selangor",
            description = "Martial Arts & Belt Progression Operations",
            martialArtStyle = "Taekwondo & Karate",
            phone = "+60 12-345 6789",
            email = "admin@selangortkd.org",
            address = "Sepang Martial Arts Center, Selangor",
            defaultMonthlyFee = 80.0,
            prefix = "BF"
        )
    )

    // 3. User Profiles for all Roles
    val superAdmin = ProfileEntity(
        id = "prof_super_admin",
        fullName = "Admin BeltFlow (Super Admin)",
        email = "superadmin@beltflow.my",
        phone = "+60 12-000 0000",
        role = UserRole.SUPER_ADMIN,
        status = ProfileStatus.APPROVED,
        organizationId = null,
        password = "BeltFlow2026@"
    )

    val adminPersatuan = ProfileEntity(
        id = "prof_admin_eswaran",
        fullName = "Master Eswaran",
        email = "eswaran2728@gmail.com",
        phone = "+60 12-345 6789",
        role = UserRole.ADMIN_PERSATUAN,
        status = ProfileStatus.APPROVED,
        organizationId = "persatuan_selangor",
        password = "Eswaran0321@"
    )

    val masterRavi = ProfileEntity(
        id = "prof_master_ravi",
        fullName = "Master Ravi",
        email = "master.ravi@selangortkd.org",
        phone = "+60 16-222 3344",
        role = UserRole.MASTER,
        status = ProfileStatus.APPROVED,
        organizationId = "persatuan_selangor",
        assignedClass = "Junior Green Belt Class",
        password = "MasterRavi2026@"
    )

    val parentSuresh = ProfileEntity(
        id = "prof_parent_suresh",
        fullName = "Suresh Kumar",
        email = "suresh.parent@gmail.com",
        phone = "+60 12-888 9900",
        role = UserRole.PARENT,
        status = ProfileStatus.APPROVED,
        organizationId = "persatuan_selangor",
        childName = "Aryan Suresh",
        password = "ParentSuresh2026@"
    )

    val studentAryan = ProfileEntity(
        id = "prof_student_aryan",
        fullName = "Aryan Suresh",
        email = "aryan.student@gmail.com",
        phone = "+60 12-888 9901",
        role = UserRole.STUDENT,
        status = ProfileStatus.APPROVED,
        organizationId = "persatuan_selangor",
        studentId = "stud_aryan_1",
        password = "StudentAryan2026@"
    )

    dao.insertProfile(superAdmin)
    dao.insertProfile(adminPersatuan)
    dao.insertProfile(masterRavi)
    dao.insertProfile(parentSuresh)
    dao.insertProfile(studentAryan)

    // 4. Belt Syllabus
    val belts = listOf(
        BeltEntity("belt_1", "persatuan_selangor", "White Belt", "#E2E8F0", 1),
        BeltEntity("belt_2", "persatuan_selangor", "Yellow Belt", "#FACC15", 2),
        BeltEntity("belt_3", "persatuan_selangor", "Orange Belt", "#FB923C", 3),
        BeltEntity("belt_4", "persatuan_selangor", "Green Belt", "#22C55E", 4),
        BeltEntity("belt_5", "persatuan_selangor", "Blue Belt", "#3B82F6", 5),
        BeltEntity("belt_6", "persatuan_selangor", "Brown Belt", "#854D0E", 6),
        BeltEntity("belt_7", "persatuan_selangor", "Black Belt 1st Dan", "#0F172A", 7)
    )
    belts.forEach { dao.insertBelt(it) }

    // 5. Branches & Classes
    val branchCentral = BranchEntity("br_central", "persatuan_selangor", "Central Dojang", "Shah Alam Sports Complex", "+60 3-5511 2233")
    val branchRiverside = BranchEntity("br_riverside", "persatuan_selangor", "Riverside Branch", "Jalan Riverside 4, Klang", "+60 3-3322 4455")
    dao.insertBranch(branchCentral)
    dao.insertBranch(branchRiverside)

    val classJunior = ClassEntity(
        id = "cls_junior_green",
        organizationId = "persatuan_selangor",
        branchId = "br_central",
        name = "Junior Green Belt Class",
        code = "JGR101",
        dayOfWeek = 6,
        startTime = "18:00",
        endTime = "19:30",
        scheduleNote = "Mon & Wed 6:00 PM - 7:30 PM",
        monthlyFeeOverride = 180.0,
        mainMasterId = "prof_admin_eswaran",
        coachName = "Master Eswaran"
    )
    val classSenior = ClassEntity(
        id = "cls_senior_sparring",
        organizationId = "persatuan_selangor",
        branchId = "br_central",
        name = "Senior Blue & Brown Sparring",
        code = "SSP202",
        dayOfWeek = 7,
        startTime = "19:30",
        endTime = "21:00",
        scheduleNote = "Tue & Thu 7:30 PM - 9:00 PM",
        monthlyFeeOverride = 200.0,
        mainMasterId = "prof_master_ravi",
        coachName = "Master Ravi"
    )
    dao.insertClass(classJunior)
    dao.insertClass(classSenior)

    // Master Class Assignments
    dao.insertClassMasterCrossRef(ClassMasterCrossRefEntity("cls_junior_green", "prof_admin_eswaran", true))
    dao.insertClassMasterCrossRef(ClassMasterCrossRefEntity("cls_junior_green", "prof_master_ravi", false))
    dao.insertClassMasterCrossRef(ClassMasterCrossRefEntity("cls_senior_sparring", "prof_master_ravi", true))

    // 6. Student Records
    val student1 = StudentEntity(
        id = "stud_aryan_1",
        organizationId = "persatuan_selangor",
        profileId = "prof_student_aryan",
        fullName = "Aryan Suresh",
        icOrMykid = "120814-10-5541",
        dateOfBirth = "2012-08-14",
        gender = "Male",
        beltId = "belt_4",
        lifecycle = Lifecycle.ACTIVE,
        joinedAt = "2024-03-01",
        parentName = "Suresh Kumar",
        parentPhone = "+60 12-888 9900",
        parentProfileId = "prof_parent_suresh",
        medicalNotes = "None",
        classIdsJson = "[\"cls_junior_green\"]"
    )
    dao.insertStudent(student1)

    // 7. Parent-Child 3-Way Approved Link
    val link = ParentChildLinkEntity(
        id = "link_suresh_aryan",
        organizationId = "persatuan_selangor",
        parentProfileId = "prof_parent_suresh",
        studentId = "stud_aryan_1",
        status = LinkApprovalStatus.APPROVED,
        studentApproved = true,
        masterApproved = true,
        adminApproved = true
    )
    dao.insertParentChildLink(link)

    // 8. Digital Certificate
    val cert = CertificateEntity(
        id = "cert_green_9821",
        studentId = "stud_aryan_1",
        type = CertType.GRADING,
        title = "Green Belt (4th Gup) Promotion",
        certNo = "BF-GREEN-9821",
        verifyCode = "BF-GREEN-9821",
        issuedAt = "2026-08-14",
        issuedBy = "Master Eswaran (Chief Examiner)"
    )
    dao.insertCertificate(cert)
}
