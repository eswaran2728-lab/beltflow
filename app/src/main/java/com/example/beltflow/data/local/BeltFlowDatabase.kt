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
    // 1. Ensure Super Admin Account (eswaran2728@gmail.com)
    val superAdmin = dao.getProfileByEmail("eswaran2728@gmail.com")
    val saltSuper = if (superAdmin?.passwordSalt?.isNotBlank() == true) superAdmin.passwordSalt else com.example.beltflow.data.security.SecurityUtils.generateSalt()
    dao.insertProfile(
        ProfileEntity(
            id = superAdmin?.id ?: "prof_super_eswaran",
            fullName = "Master Eswaran (Super Admin)",
            email = "eswaran2728@gmail.com",
            phone = "+60 12-345 6789",
            role = UserRole.SUPER_ADMIN,
            status = ProfileStatus.APPROVED,
            organizationId = null,
            password = com.example.beltflow.data.security.SecurityUtils.hashPassword("Eswaran0321@", saltSuper),
            passwordSalt = saltSuper
        )
    )

    // 2. Ensure Admin Persatuan Account (persatuansilambamdaerahsepang@gmail.com - Mahagurusrisarumugam)
    val adminPersatuan = dao.getProfileByEmail("persatuansilambamdaerahsepang@gmail.com")
    val saltAdmin = if (adminPersatuan?.passwordSalt?.isNotBlank() == true) adminPersatuan.passwordSalt else com.example.beltflow.data.security.SecurityUtils.generateSalt()
    dao.insertProfile(
        ProfileEntity(
            id = adminPersatuan?.id ?: "prof_admin_sepang",
            fullName = "Mahaguru Sri Sarumugam (Admin Persatuan)",
            email = "persatuansilambamdaerahsepang@gmail.com",
            phone = "+60 12-345 6789",
            role = UserRole.ADMIN_PERSATUAN,
            status = ProfileStatus.APPROVED,
            organizationId = "persatuan_sepang",
            password = com.example.beltflow.data.security.SecurityUtils.hashPassword("Mahagurusrisarumugam", saltAdmin),
            passwordSalt = saltAdmin
        )
    )

    // 3. Clean up any leftover demo Master / Coach profile (Real masters will register/login)
    dao.deleteProfile("prof_master_sepang", "master.silambamsepang@gmail.com")
}

suspend fun populateInitialData(dao: BeltFlowDao) {
    // 1. Persatuan Organizations
    val persatuanSepang = PersatuanEntity(
        id = "persatuan_sepang",
        name = "Persatuan Silambam Daerah Sepang",
        logoUrl = "beltflow-logo.png",
        phone = "+60 12-345 6789",
        email = "persatuansilambamdaerahsepang@gmail.com",
        address = "Kompleks Sukan Daerah Sepang, Selangor",
        registrationNo = "PPM-014-10-12052021",
        status = ProfileStatus.APPROVED,
        subscriptionPlan = SubscriptionPlan.GROWTH,
        subscriptionStatus = SubscriptionStatus.ACTIVE,
        renewalDate = "2026-12-31",
        monthlyFee = 399.0,
        platformChargeRatePercent = 8.0
    )
    dao.insertPersatuan(persatuanSepang)

    // 2. Academy Settings
    dao.saveAcademySettings(
        AcademySettingsEntity(
            id = "academy_main",
            organizationId = "persatuan_sepang",
            name = "Persatuan Silambam Daerah Sepang",
            description = "Silambam Martial Arts Academy & Belt Progression Operations",
            martialArtStyle = "Silambam Nillaikalakki & Porr Silambam",
            phone = "+60 12-345 6789",
            email = "persatuansilambamdaerahsepang@gmail.com",
            address = "Kompleks Sukan Daerah Sepang, Selangor",
            defaultMonthlyFee = 80.0,
            siblingDiscountPercent = 10.0,
            prefix = "PSMDS"
        )
    )

    // 3. User Profiles for Real Roles (Super Admin, Admin Persatuan)
    val saltSuper = com.example.beltflow.data.security.SecurityUtils.generateSalt()
    val superAdmin = ProfileEntity(
        id = "prof_super_eswaran",
        fullName = "Master Eswaran (Super Admin)",
        email = "eswaran2728@gmail.com",
        phone = "+60 12-345 6789",
        role = UserRole.SUPER_ADMIN,
        status = ProfileStatus.APPROVED,
        organizationId = null,
        password = com.example.beltflow.data.security.SecurityUtils.hashPassword("Eswaran0321@", saltSuper),
        passwordSalt = saltSuper
    )

    val saltAdmin = com.example.beltflow.data.security.SecurityUtils.generateSalt()
    val adminPersatuan = ProfileEntity(
        id = "prof_admin_sepang",
        fullName = "Mahaguru Sri Sarumugam (Admin Persatuan)",
        email = "persatuansilambamdaerahsepang@gmail.com",
        phone = "+60 12-345 6789",
        role = UserRole.ADMIN_PERSATUAN,
        status = ProfileStatus.APPROVED,
        organizationId = "persatuan_sepang",
        password = com.example.beltflow.data.security.SecurityUtils.hashPassword("Mahagurusrisarumugam", saltAdmin),
        passwordSalt = saltAdmin
    )

    dao.insertProfile(superAdmin)
    dao.insertProfile(adminPersatuan)

    // 4. Belt Syllabus
    val belts = listOf(
        BeltEntity("belt_1", "persatuan_sepang", "White Belt", "#E2E8F0", 1),
        BeltEntity("belt_2", "persatuan_sepang", "Yellow Belt", "#FACC15", 2),
        BeltEntity("belt_3", "persatuan_sepang", "Orange Belt", "#FB923C", 3),
        BeltEntity("belt_4", "persatuan_sepang", "Green Belt", "#22C55E", 4),
        BeltEntity("belt_5", "persatuan_sepang", "Blue Belt", "#3B82F6", 5),
        BeltEntity("belt_6", "persatuan_sepang", "Brown Belt", "#854D0E", 6),
        BeltEntity("belt_7", "persatuan_sepang", "Black Belt 1st Dan", "#0F172A", 7)
    )
    belts.forEach { dao.insertBelt(it) }

    // 5. Branches & Classes
    val branchCentral = BranchEntity("br_central", "persatuan_sepang", "Kompleks Sukan Sepang Dojo", "Shah Alam & Sepang Sports Complex", "+60 3-5511 2233")
    val branchRiverside = BranchEntity("br_riverside", "persatuan_sepang", "Cyberjaya Silambam Center", "Jalan Teknokrat 4, Cyberjaya", "+60 3-3322 4455")
    dao.insertBranch(branchCentral)
    dao.insertBranch(branchRiverside)

    val classJunior = ClassEntity(
        id = "cls_junior_green",
        organizationId = "persatuan_sepang",
        branchId = "br_central",
        name = "Junior Silambam Class",
        code = "SIL101",
        dayOfWeek = 6,
        startTime = "18:00",
        endTime = "19:30",
        scheduleNote = "Mon & Wed 6:00 PM - 7:30 PM",
        monthlyFeeOverride = 180.0,
        mainMasterId = "prof_master_sepang",
        coachName = "Master Silambam (Sepang)"
    )
    val classSenior = ClassEntity(
        id = "cls_senior_sparring",
        organizationId = "persatuan_sepang",
        branchId = "br_central",
        name = "Senior Porr Silambam Sparring",
        code = "SSP202",
        dayOfWeek = 7,
        startTime = "19:30",
        endTime = "21:00",
        scheduleNote = "Tue & Thu 7:30 PM - 9:00 PM",
        monthlyFeeOverride = 200.0,
        mainMasterId = "prof_master_sepang",
        coachName = "Master Silambam (Sepang)"
    )
    dao.insertClass(classJunior)
    dao.insertClass(classSenior)

    // Master Class Assignments
    dao.insertClassMasterCrossRef(ClassMasterCrossRefEntity("cls_junior_green", "prof_master_sepang", true))
    dao.insertClassMasterCrossRef(ClassMasterCrossRefEntity("cls_senior_sparring", "prof_master_sepang", true))
    dao.insertClassMasterCrossRef(ClassMasterCrossRefEntity("cls_junior_green", "prof_admin_sepang", false))
    dao.insertClassMasterCrossRef(ClassMasterCrossRefEntity("cls_senior_sparring", "prof_admin_sepang", false))
}
