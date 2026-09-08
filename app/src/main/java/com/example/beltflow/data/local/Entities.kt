package com.example.beltflow.data.local

import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey
import com.example.beltflow.data.model.*

@Entity(tableName = "persatuans")
data class PersatuanEntity(
    @PrimaryKey val id: String,
    val name: String,
    val logoUrl: String = "",
    val phone: String = "+60 12-345 6789",
    val email: String = "persatuansilambamdaerahsepang@gmail.com",
    val address: String = "Kompleks Sukan Daerah Sepang, Selangor",
    val registrationNo: String = "PPM-014-10-12052021",
    val status: ProfileStatus = ProfileStatus.APPROVED,
    val subscriptionPlan: SubscriptionPlan = SubscriptionPlan.GROWTH,
    val subscriptionStatus: SubscriptionStatus = SubscriptionStatus.ACTIVE,
    val renewalDate: String = "2026-12-31",
    val monthlyFee: Double = 399.0,
    val platformChargeRatePercent: Double = 8.0
)

@Entity(tableName = "profiles")
data class ProfileEntity(
    @PrimaryKey val id: String,
    val fullName: String,
    val email: String,
    val phone: String = "",
    val role: UserRole,
    val status: ProfileStatus,
    val organizationId: String? = "persatuan_sepang",
    val childName: String = "",
    val assignedClass: String = "",
    val studentId: String? = null,
    val password: String = "",
    val passwordSalt: String = "",
    val createdAt: Long = System.currentTimeMillis()
)

@Entity(tableName = "academy_settings")
data class AcademySettingsEntity(
    @PrimaryKey val id: String = "academy_main",
    val organizationId: String = "persatuan_sepang",
    val name: String = "Persatuan Silambam Daerah Sepang",
    val description: String = "Traditional Martial Arts & Belt Progression Platform",
    val martialArtStyle: String = "Silambam Nillaikalakki & Porr Silambam",
    val phone: String = "+60 12-345 6789",
    val email: String = "persatuansilambamdaerahsepang@gmail.com",
    val address: String = "Kompleks Sukan Daerah Sepang, Selangor",
    val defaultMonthlyFee: Double = 80.0,
    val siblingDiscountPercent: Double = 10.0,
    val prefix: String = "PSMDS"
)

@Entity(tableName = "belts")
data class BeltEntity(
    @PrimaryKey val id: String,
    val organizationId: String? = "persatuan_selangor",
    val name: String,
    val colorHex: String,
    val sortOrder: Int
)

@Entity(tableName = "branches")
data class BranchEntity(
    @PrimaryKey val id: String,
    val organizationId: String? = "persatuan_selangor",
    val name: String,
    val address: String = "",
    val phone: String = ""
)

@Entity(
    tableName = "classes",
    foreignKeys = [
        ForeignKey(
            entity = BranchEntity::class,
            parentColumns = ["id"],
            childColumns = ["branchId"],
            onDelete = ForeignKey.SET_NULL
        )
    ],
    indices = [Index("branchId")]
)
data class ClassEntity(
    @PrimaryKey val id: String,
    val organizationId: String? = "persatuan_selangor",
    val branchId: String? = null,
    val name: String,
    val code: String,
    val dayOfWeek: Int = 6, // 1=Sun, 7=Sat
    val startTime: String = "09:00",
    val endTime: String = "11:00",
    val scheduleNote: String = "Every Saturday 9:00 AM - 11:00 AM",
    val monthlyFeeOverride: Double? = 80.0,
    val mainMasterId: String? = "profile_master_eswaran",
    val coachName: String = "Master Eswaran"
) {
    val schedule: String get() = scheduleNote
    val monthlyFee: Double get() = monthlyFeeOverride ?: 80.0
    val branchName: String get() = "HQ Dojang"
}

@Entity(
    tableName = "class_master_cross_ref",
    primaryKeys = ["classId", "masterProfileId"]
)
data class ClassMasterCrossRefEntity(
    val classId: String,
    val masterProfileId: String,
    val isMainMaster: Boolean = false
)

@Entity(
    tableName = "students",
    foreignKeys = [
        ForeignKey(
            entity = BeltEntity::class,
            parentColumns = ["id"],
            childColumns = ["beltId"],
            onDelete = ForeignKey.SET_NULL
        )
    ],
    indices = [Index("beltId")]
)
data class StudentEntity(
    @PrimaryKey val id: String,
    val organizationId: String? = "persatuan_selangor",
    val profileId: String? = null,
    val fullName: String,
    val icOrMykid: String = "",
    val dateOfBirth: String = "",
    val gender: String = "Male",
    val beltId: String?,
    val lifecycle: Lifecycle = Lifecycle.ACTIVE,
    val joinedAt: String = "2025-01-10",
    val parentName: String = "",
    val parentPhone: String = "",
    val parentProfileId: String? = null,
    val medicalNotes: String = "",
    val classIdsJson: String = "[]" // JSON array of class IDs
)

@Entity(tableName = "parent_child_links")
data class ParentChildLinkEntity(
    @PrimaryKey val id: String,
    val organizationId: String = "persatuan_selangor",
    val parentProfileId: String,
    val studentId: String,
    val status: LinkApprovalStatus = LinkApprovalStatus.PENDING_STUDENT,
    val studentApproved: Boolean = false,
    val masterApproved: Boolean = false,
    val adminApproved: Boolean = false,
    val createdAt: Long = System.currentTimeMillis()
)

@Entity(tableName = "class_transfers")
data class ClassTransferRequestEntity(
    @PrimaryKey val id: String,
    val studentId: String,
    val oldClassId: String,
    val newClassId: String,
    val status: ClassTransferStatus = ClassTransferStatus.PENDING_OLD_MASTER,
    val oldMasterApproved: Boolean = false,
    val newMasterApproved: Boolean = false,
    val createdAt: Long = System.currentTimeMillis()
)

@Entity(tableName = "audit_logs")
data class AuditLogEntity(
    @PrimaryKey val id: String,
    val organizationId: String? = "persatuan_selangor",
    val classId: String? = null,
    val actorId: String,
    val actorName: String,
    val actorRole: UserRole,
    val action: String,
    val targetEntity: String,
    val targetId: String,
    val timestamp: Long = System.currentTimeMillis(),
    val previousValue: String = "",
    val newValue: String = "",
    val metadata: String = ""
)

@Entity(tableName = "announcements")
data class AnnouncementEntity(
    @PrimaryKey val id: String,
    val organizationId: String? = "persatuan_selangor",
    val classId: String? = null,
    val authorId: String,
    val authorName: String,
    val authorRole: UserRole,
    val title: String,
    val content: String,
    val status: AnnouncementStatus = AnnouncementStatus.PUBLISHED,
    val createdAt: Long = System.currentTimeMillis()
)

@Entity(
    tableName = "class_sessions",
    indices = [Index(value = ["classId", "sessionDate"], unique = true)]
)
data class ClassSessionEntity(
    @PrimaryKey val id: String,
    val classId: String,
    val sessionDate: String, // YYYY-MM-DD
    val isCancelled: Boolean = false
)

@Entity(
    tableName = "attendance",
    foreignKeys = [
        ForeignKey(
            entity = StudentEntity::class,
            parentColumns = ["id"],
            childColumns = ["studentId"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [
        Index("studentId"),
        Index(value = ["sessionId", "studentId"], unique = true)
    ]
)
data class AttendanceEntity(
    @PrimaryKey val id: String,
    val sessionId: String,
    val studentId: String,
    val status: AttendanceStatus,
    val sessionDate: String,
    val classId: String,
    val markedAt: Long = System.currentTimeMillis()
)

@Entity(
    tableName = "invoices",
    foreignKeys = [
        ForeignKey(
            entity = StudentEntity::class,
            parentColumns = ["id"],
            childColumns = ["studentId"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [
        Index("studentId"),
        Index(value = ["studentId", "billingMonth"], unique = true)
    ]
)
data class InvoiceEntity(
    @PrimaryKey val id: String,
    val studentId: String,
    val billingMonth: String, // YYYY-MM
    val amount: Double,
    val discount: Double = 0.0,
    val discountReason: String = "",
    val status: InvoiceStatus = InvoiceStatus.UNPAID,
    val createdAt: Long = System.currentTimeMillis()
)

@Entity(
    tableName = "payments",
    foreignKeys = [
        ForeignKey(
            entity = InvoiceEntity::class,
            parentColumns = ["id"],
            childColumns = ["invoiceId"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [Index("invoiceId")]
)
data class PaymentEntity(
    @PrimaryKey val id: String,
    val invoiceId: String,
    val amount: Double,
    val method: PaymentMethod,
    val submittedBy: String? = null,
    val approvedBy: String? = null,
    val approvedAt: Long? = null,
    val receiptNo: String? = null,
    val notes: String = "",
    val createdAt: Long = System.currentTimeMillis()
)

@Entity(tableName = "grading_events")
data class GradingEventEntity(
    @PrimaryKey val id: String,
    val organizationId: String? = "persatuan_selangor",
    val name: String,
    val eventDate: String,
    val location: String,
    val examiner: String,
    val fee: Double = 50.0,
    val isCompleted: Boolean = false
)

@Entity(
    tableName = "grading_records",
    foreignKeys = [
        ForeignKey(
            entity = GradingEventEntity::class,
            parentColumns = ["id"],
            childColumns = ["gradingEventId"],
            onDelete = ForeignKey.CASCADE
        ),
        ForeignKey(
            entity = StudentEntity::class,
            parentColumns = ["id"],
            childColumns = ["studentId"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [
        Index("gradingEventId"),
        Index("studentId"),
        Index(value = ["gradingEventId", "studentId"], unique = true)
    ]
)
data class GradingRecordEntity(
    @PrimaryKey val id: String,
    val gradingEventId: String,
    val studentId: String,
    val fromBeltId: String?,
    val toBeltId: String?,
    val result: GradingResultType = GradingResultType.REGISTERED,
    val notes: String = "",
    val gradedAt: Long? = null
)

@Entity(tableName = "skills")
data class SkillEntity(
    @PrimaryKey val id: String,
    val name: String,
    val category: String,
    val description: String = "",
    val sortOrder: Int = 0
)

@Entity(
    tableName = "student_skills",
    foreignKeys = [
        ForeignKey(
            entity = StudentEntity::class,
            parentColumns = ["id"],
            childColumns = ["studentId"],
            onDelete = ForeignKey.CASCADE
        ),
        ForeignKey(
            entity = SkillEntity::class,
            parentColumns = ["id"],
            childColumns = ["skillId"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [
        Index("studentId"),
        Index("skillId"),
        Index(value = ["studentId", "skillId"], unique = true)
    ]
)
data class StudentSkillEntity(
    @PrimaryKey val id: String,
    val studentId: String,
    val skillId: String,
    val level: SkillLevel = SkillLevel.NOT_STARTED,
    val notes: String = "",
    val updatedAt: Long = System.currentTimeMillis()
)

@Entity(
    tableName = "instructor_notes",
    foreignKeys = [
        ForeignKey(
            entity = StudentEntity::class,
            parentColumns = ["id"],
            childColumns = ["studentId"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [Index("studentId")]
)
data class InstructorNoteEntity(
    @PrimaryKey val id: String,
    val studentId: String,
    val authorName: String,
    val body: String,
    val visibility: NoteVisibility = NoteVisibility.PARENT_VISIBLE,
    val createdAt: Long = System.currentTimeMillis()
)

@Entity(tableName = "tournaments")
data class TournamentEntity(
    @PrimaryKey val id: String,
    val organizationId: String? = "persatuan_selangor",
    val name: String,
    val eventDate: String,
    val location: String,
    val organizer: String = "Persatuan Taekwondo Selangor"
)

@Entity(
    tableName = "tournament_results",
    foreignKeys = [
        ForeignKey(
            entity = TournamentEntity::class,
            parentColumns = ["id"],
            childColumns = ["tournamentId"],
            onDelete = ForeignKey.CASCADE
        ),
        ForeignKey(
            entity = StudentEntity::class,
            parentColumns = ["id"],
            childColumns = ["studentId"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [Index("tournamentId"), Index("studentId")]
)
data class TournamentResultEntity(
    @PrimaryKey val id: String,
    val tournamentId: String,
    val studentId: String,
    val eventCategory: String,
    val medal: Medal,
    val points: Int,
    val notes: String = ""
)

@Entity(
    tableName = "certificates",
    foreignKeys = [
        ForeignKey(
            entity = StudentEntity::class,
            parentColumns = ["id"],
            childColumns = ["studentId"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [Index("studentId"), Index(value = ["verifyCode"], unique = true)]
)
data class CertificateEntity(
    @PrimaryKey val id: String,
    val studentId: String,
    val type: CertType,
    val title: String,
    val certNo: String,
    val verifyCode: String,
    val issuedAt: String,
    val issuedBy: String = "Master Eswaran (Chief Examiner)"
)
