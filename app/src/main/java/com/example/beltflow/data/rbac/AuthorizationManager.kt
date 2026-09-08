package com.example.beltflow.data.rbac

import com.example.beltflow.data.model.UserRole

object AuthorizationManager {

    fun authorize(
        context: AuthContext?,
        permission: Permission,
        targetOrganizationId: String? = null,
        targetClassId: String? = null,
        targetStudentId: String? = null
    ): AuthorizationResult {
        if (context == null) {
            return AuthorizationResult.Denied("User is not authenticated")
        }

        when (context.role) {
            UserRole.SUPER_ADMIN -> {
                return when (permission) {
                    Permission.PLATFORM_MANAGE_PERSATUAN,
                    Permission.PLATFORM_MANAGE_SUBSCRIPTIONS,
                    Permission.PLATFORM_VIEW_ANALYTICS -> AuthorizationResult.Allowed

                    else -> AuthorizationResult.Denied("Super Admin is restricted from accessing Persatuan operational data")
                }
            }

            UserRole.ADMIN_PERSATUAN -> {
                // Cannot perform Super Admin platform operations
                if (permission == Permission.PLATFORM_MANAGE_PERSATUAN ||
                    permission == Permission.PLATFORM_MANAGE_SUBSCRIPTIONS ||
                    permission == Permission.PLATFORM_VIEW_ANALYTICS
                ) {
                    return AuthorizationResult.Denied("Admin Persatuan cannot access Super Admin platform controls")
                }

                // Check organization scoping
                if (targetOrganizationId != null && targetOrganizationId != context.organizationId) {
                    return AuthorizationResult.Denied("Access denied: Data belongs to another Persatuan organization")
                }

                return AuthorizationResult.Allowed
            }

            UserRole.MASTER -> {
                // Master cannot perform platform admin or Persatuan admin management
                if (permission == Permission.PLATFORM_MANAGE_PERSATUAN ||
                    permission == Permission.PLATFORM_MANAGE_SUBSCRIPTIONS ||
                    permission == Permission.PERSATUAN_EDIT_PROFILE ||
                    permission == Permission.PERSATUAN_MANAGE_BRANCHES ||
                    permission == Permission.PERSATUAN_VIEW_AUDIT_LOGS
                ) {
                    return AuthorizationResult.Denied("Action requires Admin Persatuan authorization")
                }

                // Class Scoping
                if (targetClassId != null && !context.assignedClassIds.contains(targetClassId)) {
                    return AuthorizationResult.Denied("Access denied: Master is not assigned to Class ID $targetClassId")
                }

                // Main Master check for managing masters within class
                if (permission == Permission.CLASS_MANAGE_MASTERS) {
                    val isMainMaster = targetClassId?.let { context.isMainMasterMap[it] } ?: false
                    if (!isMainMaster) {
                        return AuthorizationResult.Denied("Only the designated MAIN MASTER can manage instructors for this class")
                    }
                }

                return AuthorizationResult.Allowed
            }

            UserRole.STUDENT -> {
                return when (permission) {
                    Permission.STUDENT_VIEW_SELF,
                    Permission.STUDENT_PAY_FEES,
                    Permission.STUDENT_VIEW_CERTIFICATES -> {
                        if (targetStudentId != null && targetStudentId != context.userId) {
                            AuthorizationResult.Denied("Students can only view their own records")
                        } else {
                            AuthorizationResult.Allowed
                        }
                    }

                    Permission.ANNOUNCEMENT_CREATE,
                    Permission.MESSAGE_SEND -> AuthorizationResult.Allowed

                    else -> AuthorizationResult.Denied("Action is restricted for Student role")
                }
            }

            UserRole.PARENT -> {
                return when (permission) {
                    Permission.PARENT_VIEW_LINKED_CHILDREN,
                    Permission.PARENT_PAY_FEES,
                    Permission.PARENT_SUBMIT_EXCUSE -> {
                        if (targetStudentId != null && !context.linkedStudentIds.contains(targetStudentId)) {
                            AuthorizationResult.Denied("Access denied: Student is not a verified linked child")
                        } else {
                            AuthorizationResult.Allowed
                        }
                    }

                    Permission.PARENT_REQUEST_CHILD_LINK,
                    Permission.ANNOUNCEMENT_CREATE,
                    Permission.MESSAGE_SEND -> AuthorizationResult.Allowed

                    else -> AuthorizationResult.Denied("Action is restricted for Parent role")
                }
            }
        }
    }
}
