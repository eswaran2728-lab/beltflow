package com.example.beltflow.data.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.migration.Migration
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
        ClassWorkflowRequestEntity::class,
        MessageEntity::class,
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
    version = 6,
    exportSchema = false
)
abstract class BeltFlowDatabase : RoomDatabase() {

    abstract fun dao(): BeltFlowDao

    companion object {
        @Volatile
        private var INSTANCE: BeltFlowDatabase? = null

        val MIGRATION_4_5 = object : Migration(4, 5) {
            override fun migrate(db: SupportSQLiteDatabase) {
                // 1. Create class_workflow_requests table
                db.execSQL("""
                    CREATE TABLE IF NOT EXISTS `class_workflow_requests` (
                        `id` TEXT NOT NULL,
                        `organizationId` TEXT NOT NULL,
                        `masterProfileId` TEXT NOT NULL,
                        `requestType` TEXT NOT NULL,
                        `targetClassId` TEXT,
                        `proposedClassName` TEXT NOT NULL,
                        `proposedBranchId` TEXT,
                        `status` TEXT NOT NULL,
                        `createdAt` INTEGER NOT NULL,
                        PRIMARY KEY(`id`)
                    )
                """.trimIndent())

                // 2. Create messages table
                db.execSQL("""
                    CREATE TABLE IF NOT EXISTS `messages` (
                        `id` TEXT NOT NULL,
                        `organizationId` TEXT NOT NULL,
                        `senderId` TEXT NOT NULL,
                        `senderName` TEXT NOT NULL,
                        `senderRole` TEXT NOT NULL,
                        `recipientId` TEXT,
                        `classId` TEXT,
                        `content` TEXT NOT NULL,
                        `timestamp` INTEGER NOT NULL,
                        `isAuditable` INTEGER NOT NULL,
                        PRIMARY KEY(`id`)
                    )
                """.trimIndent())

                // 3. Alter invoices table
                db.execSQL("ALTER TABLE `invoices` ADD COLUMN `discountType` TEXT DEFAULT NULL")

                // 4. Alter tournaments table
                db.execSQL("ALTER TABLE `tournaments` ADD COLUMN `fee` REAL NOT NULL DEFAULT 50.0")
                db.execSQL("ALTER TABLE `tournaments` ADD COLUMN `paymentDestination` TEXT NOT NULL DEFAULT ''")
                db.execSQL("ALTER TABLE `tournaments` ADD COLUMN `categoriesJson` TEXT NOT NULL DEFAULT '[]'")

                // 5. Alter certificates table
                db.execSQL("ALTER TABLE `certificates` ADD COLUMN `organizationId` TEXT DEFAULT NULL")
                db.execSQL("UPDATE `certificates` SET `organizationId` = (SELECT `organizationId` FROM `students` WHERE `students`.`id` = `certificates`.`studentId`)")
                db.execSQL("ALTER TABLE `certificates` ADD COLUMN `classId` TEXT DEFAULT NULL")
                db.execSQL("ALTER TABLE `certificates` ADD COLUMN `isRevoked` INTEGER NOT NULL DEFAULT 0")
            }
        }

        // A student may belong to zero, one, or multiple classes. StudentEntity's
        // single `classId` column was replaced by `classIdsJson` (a JSON array),
        // but no migration ever shipped for it. Any device that already has a
        // local database at version 5 would otherwise crash on the next open.
        // This adds the new column and losslessly wraps each existing single
        // classId as a one-element JSON array (or [] if it was null/blank); the
        // old `classId` column is left in place (Room does not require dropping
        // columns that are no longer part of the entity).
        val MIGRATION_5_6 = object : Migration(5, 6) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE `students` ADD COLUMN `classIdsJson` TEXT NOT NULL DEFAULT '[]'")
                db.execSQL(
                    """
                    UPDATE `students`
                    SET `classIdsJson` = CASE
                        WHEN `classId` IS NOT NULL AND `classId` != '' THEN '["' || `classId` || '"]'
                        ELSE '[]'
                    END
                    """.trimIndent()
                )
            }
        }

        fun getDatabase(context: Context): BeltFlowDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    BeltFlowDatabase::class.java,
                    "beltflow_database"
                )
                    .addMigrations(MIGRATION_4_5, MIGRATION_5_6)
                    .build()
                INSTANCE = instance
                instance
            }
        }

        fun getDatabase(context: Context, scope: CoroutineScope): BeltFlowDatabase {
            return getDatabase(context)
        }
    }
}

