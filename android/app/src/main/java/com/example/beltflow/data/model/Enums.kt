package com.example.beltflow.data.model

import kotlinx.serialization.Serializable

@Serializable
enum class UserRole(val label: String) {
    SUPER_ADMIN("Admin BeltFlow (Super Admin)"),
    ADMIN_PERSATUAN("Admin Persatuan"),
    MASTER("Master"),
    PARENT("Parent / Guardian"),
    STUDENT("Student")
}

@Serializable
enum class ProfileStatus(val label: String) {
    PENDING("Pending Approval"),
    APPROVED("Approved"),
    REJECTED("Rejected"),
    DISABLED("Disabled")
}

@Serializable
enum class Lifecycle(val label: String) {
    TRIAL("Trial"),
    ACTIVE("Active"),
    FROZEN("Frozen"),
    QUIT("Quit")
}

@Serializable
enum class AttendanceStatus(val label: String) {
    PRESENT("Present"),
    ABSENT("Absent"),
    LATE("Late"),
    EXCUSED("Excused")
}

@Serializable
enum class InvoiceStatus(val label: String) {
    UNPAID("Unpaid"),
    PENDING_APPROVAL("Pending Approval"),
    PAID("Paid"),
    WAIVED("Waived"),
    OVERDUE("Overdue"),
    CANCELLED("Cancelled")
}

@Serializable
enum class PaymentMethod(val label: String) {
    CASH("Cash"),
    FPX("FPX Online Banking"),
    TRANSFER("Bank Transfer")
}

@Serializable
enum class GradingResultType(val label: String) {
    REGISTERED("Registered / Pending"),
    PASS("Pass (Promoted)"),
    DOUBLE_PROMOTION("Double Promotion"),
    RETEST("Re-test Needed"),
    FAIL("Fail"),
    ABSENT("Absent")
}

@Serializable
enum class SkillLevel(val label: String, val percentage: Int) {
    NOT_STARTED("Not Started", 0),
    LEARNING("Learning", 33),
    GOOD("Good", 66),
    MASTERED("Mastered", 100)
}

@Serializable
enum class Medal(val label: String, val points: Int, val emoji: String) {
    GOLD("Gold Medal", 10, "🥇"),
    SILVER("Silver Medal", 7, "🥈"),
    BRONZE("Bronze Medal", 5, "🥉"),
    PARTICIPATION("Participation", 2, "🎖️")
}

@Serializable
enum class NoteVisibility(val label: String) {
    STAFF("Staff Only"),
    PARENT_VISIBLE("Parent Visible")
}

@Serializable
enum class CertType(val label: String) {
    GRADING("Belt Promotion"),
    TOURNAMENT("Tournament Achievement"),
    PARTICIPATION("Participation"),
    ACHIEVEMENT("Special Award")
}

@Serializable
enum class LinkApprovalStatus(val label: String) {
    PENDING_STUDENT("Pending Student Approval"),
    PENDING_MASTER("Pending Master Approval"),
    PENDING_ADMIN("Pending Admin Approval"),
    APPROVED("Approved & Linked"),
    REJECTED("Rejected")
}

@Serializable
enum class ClassTransferStatus(val label: String) {
    PENDING_OLD_MASTER("Pending Current Master Approval"),
    PENDING_NEW_MASTER("Pending Target Master Approval"),
    APPROVED("Approved & Transferred"),
    REJECTED("Rejected")
}

@Serializable
enum class AnnouncementStatus(val label: String) {
    PENDING_MASTER_APPROVAL("Pending Master Review"),
    PUBLISHED("Published"),
    REJECTED("Rejected")
}

@Serializable
enum class SubscriptionPlan(val label: String, val monthlyPrice: Double) {
    STARTER("Starter Plan", 149.0),
    GROWTH("Growth Plan", 399.0),
    MULTI_BRANCH("Multi-Branch Plan", 899.0)
}

@Serializable
enum class SubscriptionStatus(val label: String) {
    ACTIVE("Active"),
    UNPAID("Unpaid"),
    OVERDUE("Overdue"),
    SUSPENDED("Suspended")
}
