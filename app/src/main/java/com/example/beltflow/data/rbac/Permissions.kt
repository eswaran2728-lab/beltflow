package com.example.beltflow.data.rbac

import com.example.beltflow.data.model.UserRole

enum class Permission {
    // Super Admin Platform Permissions
    PLATFORM_MANAGE_PERSATUAN,
    PLATFORM_MANAGE_SUBSCRIPTIONS,
    PLATFORM_VIEW_ANALYTICS,
    PLATFORM_SYSTEM_SETTINGS,

    // Admin Persatuan Permissions
    PERSATUAN_EDIT_PROFILE,
    PERSATUAN_MANAGE_BRANCHES,
    PERSATUAN_MANAGE_CLASSES,
    PERSATUAN_MANAGE_MASTERS,
    PERSATUAN_MANAGE_STUDENTS,
    PERSATUAN_MANAGE_BELTS,
    PERSATUAN_MANAGE_CURRICULUM,
    PERSATUAN_MANAGE_GRADING_EVENTS,
    PERSATUAN_MANAGE_TOURNAMENTS,
    PERSATUAN_MANAGE_CERTIFICATES,
    PERSATUAN_VIEW_FINANCE,
    PERSATUAN_VIEW_AUDIT_LOGS,
    PERSATUAN_DELETE_AUDIT_LOGS,
    PERSATUAN_APPROVE_PARENT_LINK,

    // Master / Class Permissions
    CLASS_VIEW_DETAILS,
    CLASS_MANAGE_MASTERS, // Main Master only (add/remove masters, change main master)
    CLASS_REQUEST_CREATE,
    CLASS_REQUEST_JOIN_APPROVE,
    CLASS_MARK_ATTENDANCE,
    CLASS_EDIT_ATTENDANCE,
    CLASS_DELETE_ATTENDANCE, // Master only (Admin cannot delete)
    CLASS_MANAGE_FEES,
    CLASS_RECORD_CASH_PAYMENT,
    CLASS_APPROVE_PAYMENT,
    CLASS_MANAGE_SKILL_PROGRESS, // Master only (Student/Parent cannot modify)
    CLASS_REGISTER_GRADING,
    CLASS_SCORE_GRADING,
    CLASS_REGISTER_TOURNAMENT,
    CLASS_SCORE_TOURNAMENT,
    CLASS_APPROVE_STUDENT_REGISTRATION,
    CLASS_APPROVE_TRANSFER,
    CLASS_APPROVE_PARENT_LINK,

    // Student Permissions
    STUDENT_VIEW_SELF,
    STUDENT_EDIT_SELF,
    STUDENT_PAY_FEES,
    STUDENT_VIEW_CERTIFICATES,
    STUDENT_REGISTER_GRADING,
    STUDENT_REGISTER_TOURNAMENT,
    STUDENT_REQUEST_TRANSFER,
    STUDENT_APPROVE_PARENT_LINK,

    // Parent Permissions
    PARENT_VIEW_LINKED_CHILDREN,
    PARENT_PAY_FEES,
    PARENT_REQUEST_CHILD_LINK,
    PARENT_SUBMIT_EXCUSE,
    PARENT_REGISTER_CHILD_GRADING,
    PARENT_REGISTER_CHILD_TOURNAMENT,
    PARENT_VIEW_SKILL_PROGRESS,

    // Certificates
    CERTIFICATE_CREATE,
    CERTIFICATE_EDIT,
    CERTIFICATE_DELETE,
    CERTIFICATE_REVOKE,
    CERTIFICATE_VIEW,

    // Common / Shared
    ANNOUNCEMENT_CREATE,
    ANNOUNCEMENT_APPROVE,
    MESSAGE_SEND,
    MESSAGE_AUDIT
}

data class AuthContext(
    val userId: String,
    val role: UserRole,
    val organizationId: String?,
    val assignedClassIds: List<String> = emptyList(),
    val isMainMasterMap: Map<String, Boolean> = emptyMap(),
    val linkedStudentIds: List<String> = emptyList()
)

sealed class AuthorizationResult {
    object Allowed : AuthorizationResult()
    data class Denied(val reason: String) : AuthorizationResult()

    val isAllowed: Boolean get() = this is Allowed
}
