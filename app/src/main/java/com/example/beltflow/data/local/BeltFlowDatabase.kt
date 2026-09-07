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
    version = 3,
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

    // Clean up any legacy demo data from previous database versions
    try {
        dao.deleteLegacyDemoStudents()
        dao.deleteLegacyDemoProfiles()
    } catch (_: Exception) {}
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

    // 2. Admin Profile (Master Eswaran)
    val adminProfile = ProfileEntity(
        id = "prof_admin_1",
        fullName = "Master Eswaran",
        email = "eswaran2728@gmail.com",
        phone = "+60 12-345 6789",
        role = UserRole.ADMIN,
        status = ProfileStatus.APPROVED,
        password = "Eswaran0321@"
    )
    dao.insertProfile(adminProfile)

    // 3. Official Belt Syllabus
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

    // 4. Academy Branches
    val branchSepang = BranchEntity("br_1", "Sepang Central Dojo", "Kompleks Sukan Daerah Sepang", "+60 3-8706 1122")
    val branchNilai = BranchEntity("br_2", "Nilai Impian Center", "No. 42, Jalan Impian 2, Nilai", "+60 6-799 3344")
    val branchSgPelek = BranchEntity("br_3", "Sungai Pelek Community Hall", "Jalan Besar, Sungai Pelek", "+60 3-3141 8899")
    dao.insertBranch(branchSepang)
    dao.insertBranch(branchNilai)
    dao.insertBranch(branchSgPelek)

    // 5. Training Classes
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
        coachName = "Master Eswaran"
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
        coachName = "Master Eswaran"
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
        coachName = "Master Eswaran"
    )
    dao.insertClass(classJuniorNilai)
    dao.insertClass(classSeniorSepang)
    dao.insertClass(classKidsSgPelek)

    // 6. Skills Curriculum (Silambam & Martial Arts Syllabus)
    val skills = listOf(
        SkillEntity("sk_1", "Kaaladi & Basic Footwork (1 to 8 steps)", "Foundation", "Basic body balance, steps stance, pivot rotations", 1),
        SkillEntity("sk_2", "Sedikuchi (Single Short Stick Swings)", "Weapons", "Single arm rotary motion, head guard, side deflection", 2),
        SkillEntity("sk_3", "Nedunkambu (Long Staff Standard Spin)", "Weapons", "Double hand figure-eight, overhead strike, block", 3),
        SkillEntity("sk_4", "Por Silambam (Sparring Fundamentals)", "Sparring", "Defensive retreat, distance control, counter-thrust", 4),
        SkillEntity("sk_5", "Thanithiramai (Solo Routine Forms 1-3)", "Forms", "Choreographed continuous staff maneuvers with power", 5),
        SkillEntity("sk_6", "Maan Kombu (Deer Horn Weaponry Intro)", "Advanced", "Traditional double-horn deflection and wrist locks", 6)
    )
    skills.forEach { dao.insertSkill(it) }

    // 7. Tournaments Calendar
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
}
