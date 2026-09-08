package com.example.beltflow.data.rbac

enum class Permission {
    // Super Admin Platform Permissions
    PLATFORM_MANAGE_PERSATUAN,
    PLATFORM_MANAGE_SUBSCRIPTIONS,
    PLATFORM_VIEW_ANALYTICS,

    // Admin Persatuan Permissions
    PERSATUAN_EDIT_PROFILE,
    PERSATUAN_MANAGE_BRANCHES,
    PERSATUAN_MANAGE_CLASSES,
    PERSATUAN_MANAGE_MASTERS,
    PERSATUAN_MANAGE_STUDENTS,
    PERSATUAN_VIEW_FINANCE,
    PERSATUAN_VIEW_AUDIT_LOGS,

    // Master / Class Permissions
    CLASS_VIEW_DETAILS,
    CLASS_MANAGE_MASTERS, // Main Master only (add/remove masters, change main master)
    CLASS_MARK_ATTENDANCE,
    CLASS_MANAGE_FEES,
    CLASS_APPROVE_PAYMENT,
    CLASS_MANAGE_SKILL_PROGRESS,
    CLASS_RECOMMEND_GRADING,

    // Student Permissions
    STUDENT_VIEW_SELF,
    STUDENT_PAY_FEES,
    STUDENT_VIEW_CERTIFICATES,

    // Parent Permissions
    PARENT_VIEW_LINKED_CHILDREN,
    PARENT_PAY_FEES,
    PARENT_REQUEST_CHILD_LINK,
    PARENT_SUBMIT_EXCUSE,

    // Common / Shared
    ANNOUNCEMENT_CREATE,
    ANNOUNCEMENT_APPROVE,
    MESSAGE_SEND,
    MESSAGE_AUDIT
}

data class AuthContext(
    val userId: String,
    val role: com.example.beltflow.data.model.UserRole,
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
