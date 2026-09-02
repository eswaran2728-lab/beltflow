package com.example.beltflow.data.model

import kotlinx.serialization.Serializable

enum class UserRole(val label: String) {
    ADMIN("Admin"),
    COACH("Coach / Master"),
    PARENT("Parent"),
    STUDENT("Student")
}

enum class ProfileStatus(val label: String) {
    PENDING("Pending Approval"),
    APPROVED("Approved"),
    REJECTED("Rejected")
}

enum class Lifecycle(val label: String) {
    TRIAL("Trial"),
    ACTIVE("Active"),
    FROZEN("Frozen"),
    QUIT("Quit")
}

enum class AttendanceStatus(val label: String) {
    PRESENT("Present"),
    ABSENT("Absent"),
    LATE("Late"),
    EXCUSED("Excused")
}

enum class InvoiceStatus(val label: String) {
    UNPAID("Unpaid"),
    PENDING_APPROVAL("Pending Approval"),
    PAID("Paid"),
    WAIVED("Waived"),
    OVERDUE("Overdue")
}

enum class PaymentMethod(val label: String) {
    CASH("Cash"),
    FPX("FPX Online Banking"),
    TRANSFER("Bank Transfer")
}

enum class GradingResultType(val label: String) {
    REGISTERED("Registered / Pending"),
    PASS("Pass (Promoted)"),
    DOUBLE_PROMOTION("Double Promotion"),
    RETEST("Re-test Needed"),
    FAIL("Fail"),
    ABSENT("Absent")
}

enum class SkillLevel(val label: String, val percentage: Int) {
    NOT_STARTED("Not Started", 0),
    LEARNING("Learning", 33),
    GOOD("Good", 66),
    MASTERED("Mastered", 100)
}

enum class Medal(val label: String, val points: Int, val emoji: String) {
    GOLD("Gold Medal", 10, "🥇"),
    SILVER("Silver Medal", 7, "🥈"),
    BRONZE("Bronze Medal", 5, "🥉"),
    PARTICIPATION("Participation", 2, "🎖️")
}

enum class NoteVisibility(val label: String) {
    STAFF("Staff Only"),
    PARENT_VISIBLE("Parent Visible")
}

enum class CertType(val label: String) {
    GRADING("Belt Promotion"),
    TOURNAMENT("Tournament Achievement"),
    PARTICIPATION("Participation"),
    ACHIEVEMENT("Special Award")
}
