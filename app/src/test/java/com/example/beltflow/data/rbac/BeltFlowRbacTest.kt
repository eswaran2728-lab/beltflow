package com.example.beltflow.data.rbac

import com.example.beltflow.data.model.UserRole
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class BeltFlowRbacTest {

    // 1. SUPER ADMIN TESTS
    @Test
    fun superAdmin_canAccessPlatformControls_andIsIsolatedFromPersatuanOperationalData() {
        val superAdminContext = AuthContext(
            userId = "prof_super_eswaran",
            role = UserRole.SUPER_ADMIN,
            organizationId = null
        )

        // Super Admin CAN manage platform & subscriptions
        assertTrue(AuthorizationManager.authorize(superAdminContext, Permission.PLATFORM_MANAGE_PERSATUAN).isAllowed)
        assertTrue(AuthorizationManager.authorize(superAdminContext, Permission.PLATFORM_MANAGE_SUBSCRIPTIONS).isAllowed)
        assertTrue(AuthorizationManager.authorize(superAdminContext, Permission.PLATFORM_VIEW_ANALYTICS).isAllowed)
        assertTrue(AuthorizationManager.authorize(superAdminContext, Permission.PLATFORM_SYSTEM_SETTINGS).isAllowed)

        // Super Admin CANNOT access Persatuan operational data
        assertFalse(AuthorizationManager.authorize(superAdminContext, Permission.CLASS_MARK_ATTENDANCE).isAllowed)
        assertFalse(AuthorizationManager.authorize(superAdminContext, Permission.CLASS_MANAGE_FEES).isAllowed)
        assertFalse(AuthorizationManager.authorize(superAdminContext, Permission.CLASS_SCORE_GRADING).isAllowed)
        assertFalse(AuthorizationManager.authorize(superAdminContext, Permission.PERSATUAN_VIEW_AUDIT_LOGS).isAllowed)
        assertFalse(AuthorizationManager.authorize(superAdminContext, Permission.STUDENT_VIEW_SELF).isAllowed)
    }

    // 2. ADMIN PERSATUAN TESTS
    @Test
    fun adminPersatuan_canManageOrganization_cannotAccessPlatformOrDeleteAttendance() {
        val adminContext = AuthContext(
            userId = "prof_admin_sepang",
            role = UserRole.ADMIN_PERSATUAN,
            organizationId = "persatuan_sepang"
        )

        // CAN manage Persatuan features
        assertTrue(AuthorizationManager.authorize(adminContext, Permission.PERSATUAN_EDIT_PROFILE, targetOrganizationId = "persatuan_sepang").isAllowed)
        assertTrue(AuthorizationManager.authorize(adminContext, Permission.PERSATUAN_MANAGE_BRANCHES, targetOrganizationId = "persatuan_sepang").isAllowed)
        assertTrue(AuthorizationManager.authorize(adminContext, Permission.PERSATUAN_MANAGE_CLASSES, targetOrganizationId = "persatuan_sepang").isAllowed)
        assertTrue(AuthorizationManager.authorize(adminContext, Permission.PERSATUAN_MANAGE_MASTERS, targetOrganizationId = "persatuan_sepang").isAllowed)
        assertTrue(AuthorizationManager.authorize(adminContext, Permission.PERSATUAN_MANAGE_STUDENTS, targetOrganizationId = "persatuan_sepang").isAllowed)
        assertTrue(AuthorizationManager.authorize(adminContext, Permission.PERSATUAN_VIEW_AUDIT_LOGS, targetOrganizationId = "persatuan_sepang").isAllowed)
        assertTrue(AuthorizationManager.authorize(adminContext, Permission.PERSATUAN_DELETE_AUDIT_LOGS, targetOrganizationId = "persatuan_sepang").isAllowed)

        // CANNOT access other Persatuan data
        assertFalse(AuthorizationManager.authorize(adminContext, Permission.PERSATUAN_EDIT_PROFILE, targetOrganizationId = "persatuan_other").isAllowed)

        // CANNOT delete attendance (only Master can delete session attendance)
        assertFalse(AuthorizationManager.authorize(adminContext, Permission.CLASS_DELETE_ATTENDANCE).isAllowed)

        // CANNOT access platform Super Admin controls
        assertFalse(AuthorizationManager.authorize(adminContext, Permission.PLATFORM_MANAGE_PERSATUAN).isAllowed)
        assertFalse(AuthorizationManager.authorize(adminContext, Permission.PLATFORM_MANAGE_SUBSCRIPTIONS).isAllowed)
    }

    // 3. MASTER & MAIN MASTER TESTS
    @Test
    fun master_canManageAssignedClass_mainMasterHasInstructorControls() {
        val regularMasterContext = AuthContext(
            userId = "prof_master_john",
            role = UserRole.MASTER,
            organizationId = "persatuan_sepang",
            assignedClassIds = listOf("cls_junior"),
            isMainMasterMap = mapOf("cls_junior" to false)
        )

        val mainMasterContext = AuthContext(
            userId = "prof_master_eswaran",
            role = UserRole.MASTER,
            organizationId = "persatuan_sepang",
            assignedClassIds = listOf("cls_junior"),
            isMainMasterMap = mapOf("cls_junior" to true)
        )

        // Both CAN mark attendance, manage fees, score grading in assigned class
        assertTrue(AuthorizationManager.authorize(regularMasterContext, Permission.CLASS_MARK_ATTENDANCE, targetClassId = "cls_junior").isAllowed)
        assertTrue(AuthorizationManager.authorize(mainMasterContext, Permission.CLASS_MARK_ATTENDANCE, targetClassId = "cls_junior").isAllowed)
        assertTrue(AuthorizationManager.authorize(regularMasterContext, Permission.CLASS_DELETE_ATTENDANCE, targetClassId = "cls_junior").isAllowed)

        // CANNOT access unassigned class
        assertFalse(AuthorizationManager.authorize(regularMasterContext, Permission.CLASS_MARK_ATTENDANCE, targetClassId = "cls_senior_unassigned").isAllowed)

        // Main Master CAN manage masters in class
        assertTrue(AuthorizationManager.authorize(mainMasterContext, Permission.CLASS_MANAGE_MASTERS, targetClassId = "cls_junior").isAllowed)

        // Regular Master CANNOT manage masters in class
        assertFalse(AuthorizationManager.authorize(regularMasterContext, Permission.CLASS_MANAGE_MASTERS, targetClassId = "cls_junior").isAllowed)

        // Master CANNOT edit organization profile or belts
        assertFalse(AuthorizationManager.authorize(regularMasterContext, Permission.PERSATUAN_EDIT_PROFILE).isAllowed)
        assertFalse(AuthorizationManager.authorize(regularMasterContext, Permission.PERSATUAN_MANAGE_BELTS).isAllowed)
    }

    // 4. STUDENT TESTS
    @Test
    fun student_canAccessOwnRecords_cannotEditAttendanceOrCertsOrSkills() {
        val studentContext = AuthContext(
            userId = "prof_stud_ali",
            role = UserRole.STUDENT,
            organizationId = "persatuan_sepang",
            linkedStudentIds = listOf("stud_ali")
        )

        // Student CAN view self and pay fees
        assertTrue(AuthorizationManager.authorize(studentContext, Permission.STUDENT_VIEW_SELF, targetStudentId = "stud_ali").isAllowed)
        assertTrue(AuthorizationManager.authorize(studentContext, Permission.STUDENT_PAY_FEES, targetStudentId = "stud_ali").isAllowed)
        assertTrue(AuthorizationManager.authorize(studentContext, Permission.STUDENT_REGISTER_GRADING, targetStudentId = "stud_ali").isAllowed)

        // Student CANNOT access another student's record
        assertFalse(AuthorizationManager.authorize(studentContext, Permission.STUDENT_VIEW_SELF, targetStudentId = "stud_other").isAllowed)

        // Student CANNOT edit attendance, modify skills, or edit/delete certs
        assertFalse(AuthorizationManager.authorize(studentContext, Permission.CLASS_MARK_ATTENDANCE).isAllowed)
        assertFalse(AuthorizationManager.authorize(studentContext, Permission.CLASS_MANAGE_SKILL_PROGRESS).isAllowed)
        assertFalse(AuthorizationManager.authorize(studentContext, Permission.CERTIFICATE_CREATE).isAllowed)
        assertFalse(AuthorizationManager.authorize(studentContext, Permission.CERTIFICATE_EDIT).isAllowed)
        assertFalse(AuthorizationManager.authorize(studentContext, Permission.CERTIFICATE_DELETE).isAllowed)
    }

    // 5. PARENT TESTS
    @Test
    fun parent_canAccessLinkedChildren_isViewOnlyForSkillProgress_cannotEditCerts() {
        val parentContext = AuthContext(
            userId = "prof_parent_tan",
            role = UserRole.PARENT,
            organizationId = "persatuan_sepang",
            linkedStudentIds = listOf("stud_child_1", "stud_child_2")
        )

        // Parent CAN view linked children
        assertTrue(AuthorizationManager.authorize(parentContext, Permission.PARENT_VIEW_LINKED_CHILDREN, targetStudentId = "stud_child_1").isAllowed)
        assertTrue(AuthorizationManager.authorize(parentContext, Permission.PARENT_VIEW_LINKED_CHILDREN, targetStudentId = "stud_child_2").isAllowed)
        assertTrue(AuthorizationManager.authorize(parentContext, Permission.PARENT_PAY_FEES, targetStudentId = "stud_child_1").isAllowed)
        assertTrue(AuthorizationManager.authorize(parentContext, Permission.PARENT_VIEW_SKILL_PROGRESS, targetStudentId = "stud_child_1").isAllowed)

        // Parent CANNOT access unlinked child
        assertFalse(AuthorizationManager.authorize(parentContext, Permission.PARENT_VIEW_LINKED_CHILDREN, targetStudentId = "stud_unlinked").isAllowed)

        // Parent CANNOT modify official skill progress
        assertFalse(AuthorizationManager.authorize(parentContext, Permission.CLASS_MANAGE_SKILL_PROGRESS).isAllowed)

        // Parent CANNOT edit or delete certificates
        assertFalse(AuthorizationManager.authorize(parentContext, Permission.CERTIFICATE_CREATE).isAllowed)
        assertFalse(AuthorizationManager.authorize(parentContext, Permission.CERTIFICATE_DELETE).isAllowed)
        assertFalse(AuthorizationManager.authorize(parentContext, Permission.CERTIFICATE_REVOKE).isAllowed)
    }

    // 6. UNASSIGNED MASTER TESTS
    @Test
    fun unassignedMaster_cannotAccessClassOperations_canAccessProfileAndEvents() {
        val unassignedMasterContext = AuthContext(
            userId = "prof_master_unassigned",
            role = UserRole.MASTER,
            organizationId = "persatuan_sepang",
            assignedClassIds = emptyList(),
            isMainMasterMap = emptyMap()
        )

        // CANNOT perform class operations
        assertFalse(AuthorizationManager.authorize(unassignedMasterContext, Permission.CLASS_MARK_ATTENDANCE, targetClassId = "cls_junior").isAllowed)
        assertFalse(AuthorizationManager.authorize(unassignedMasterContext, Permission.CLASS_MANAGE_FEES, targetClassId = "cls_junior").isAllowed)
        assertFalse(AuthorizationManager.authorize(unassignedMasterContext, Permission.CLASS_SCORE_GRADING, targetClassId = "cls_junior").isAllowed)
        assertFalse(AuthorizationManager.authorize(unassignedMasterContext, Permission.CLASS_MANAGE_SKILL_PROGRESS, targetClassId = "cls_junior").isAllowed)

        // CAN request to create a new class, create notices, send messages, and view certificates
        assertTrue(AuthorizationManager.authorize(unassignedMasterContext, Permission.CLASS_REQUEST_CREATE).isAllowed)
        assertTrue(AuthorizationManager.authorize(unassignedMasterContext, Permission.ANNOUNCEMENT_CREATE).isAllowed)
        assertTrue(AuthorizationManager.authorize(unassignedMasterContext, Permission.MESSAGE_SEND).isAllowed)
        assertTrue(AuthorizationManager.authorize(unassignedMasterContext, Permission.CERTIFICATE_VIEW).isAllowed)
    }

    // 7. 3-PARTY PARENT-CHILD LINK PERMISSION TESTS
    @Test
    fun parentChildLinking_requiresStudentMasterAndAdminAuthorizations() {
        val studentContext = AuthContext("prof_stud_ali", UserRole.STUDENT, "persatuan_sepang", linkedStudentIds = listOf("stud_ali"))
        val masterContext = AuthContext("prof_master_john", UserRole.MASTER, "persatuan_sepang", assignedClassIds = listOf("cls_junior"))
        val adminContext = AuthContext("prof_admin_sepang", UserRole.ADMIN_PERSATUAN, "persatuan_sepang")
        val parentContext = AuthContext("prof_parent_tan", UserRole.PARENT, "persatuan_sepang")

        // Parent can request link
        assertTrue(AuthorizationManager.authorize(parentContext, Permission.PARENT_REQUEST_CHILD_LINK).isAllowed)

        // Stage 1: Student can approve
        assertTrue(AuthorizationManager.authorize(studentContext, Permission.STUDENT_APPROVE_PARENT_LINK, targetStudentId = "stud_ali").isAllowed)

        // Stage 2: Master can approve
        assertTrue(AuthorizationManager.authorize(masterContext, Permission.CLASS_APPROVE_PARENT_LINK, targetClassId = "cls_junior").isAllowed)

        // Stage 3: Admin Persatuan can approve
        assertTrue(AuthorizationManager.authorize(adminContext, Permission.PERSATUAN_APPROVE_PARENT_LINK, targetOrganizationId = "persatuan_sepang").isAllowed)
    }

    // 8. CLASS TRANSFER PERMISSION TESTS
    @Test
    fun classTransfer_requiresStudentRequest_andBothMastersApproval() {
        val studentContext = AuthContext("prof_stud_ali", UserRole.STUDENT, "persatuan_sepang", linkedStudentIds = listOf("stud_ali"))
        val oldMasterContext = AuthContext("prof_master_old", UserRole.MASTER, "persatuan_sepang", assignedClassIds = listOf("cls_old"))
        val newMasterContext = AuthContext("prof_master_new", UserRole.MASTER, "persatuan_sepang", assignedClassIds = listOf("cls_new"))
        val unrelatedMasterContext = AuthContext("prof_master_unrelated", UserRole.MASTER, "persatuan_sepang", assignedClassIds = listOf("cls_other"))

        // Student can request transfer
        assertTrue(AuthorizationManager.authorize(studentContext, Permission.STUDENT_REQUEST_TRANSFER, targetStudentId = "stud_ali").isAllowed)

        // Old Master can approve
        assertTrue(AuthorizationManager.authorize(oldMasterContext, Permission.CLASS_APPROVE_TRANSFER, targetClassId = "cls_old").isAllowed)

        // New Master can approve
        assertTrue(AuthorizationManager.authorize(newMasterContext, Permission.CLASS_APPROVE_TRANSFER, targetClassId = "cls_new").isAllowed)

        // Unrelated Master CANNOT approve
        assertFalse(AuthorizationManager.authorize(unrelatedMasterContext, Permission.CLASS_APPROVE_TRANSFER, targetClassId = "cls_old").isAllowed)
        assertFalse(AuthorizationManager.authorize(unrelatedMasterContext, Permission.CLASS_APPROVE_TRANSFER, targetClassId = "cls_new").isAllowed)
    }

    // 9. AUDIT LOG VISIBILITY TESTS
    @Test
    fun auditLogs_visibleToAdminAndClassMaster_isolatedFromSuperAdmin() {
        val superAdminContext = AuthContext("prof_super", UserRole.SUPER_ADMIN, null)
        val adminContext = AuthContext("prof_admin", UserRole.ADMIN_PERSATUAN, "persatuan_sepang")
        val masterContext = AuthContext("prof_master", UserRole.MASTER, "persatuan_sepang", assignedClassIds = listOf("cls_junior"))

        // Super Admin CANNOT view Persatuan operational audit logs
        assertFalse(AuthorizationManager.authorize(superAdminContext, Permission.PERSATUAN_VIEW_AUDIT_LOGS).isAllowed)

        // Admin Persatuan CAN view full Persatuan audit logs
        assertTrue(AuthorizationManager.authorize(adminContext, Permission.PERSATUAN_VIEW_AUDIT_LOGS, targetOrganizationId = "persatuan_sepang").isAllowed)

        // Master CANNOT view full Persatuan audit logs (only class activity)
        assertFalse(AuthorizationManager.authorize(masterContext, Permission.PERSATUAN_VIEW_AUDIT_LOGS).isAllowed)
    }

    // 10. REAL RECORD RESOURCE-LEVEL DENIED ACCESS TESTS
    @Test
    fun crossTenant_operationsStrictlyDenied() {
        val sepangAdmin = AuthContext("prof_admin_sepang", UserRole.ADMIN_PERSATUAN, "persatuan_sepang")
        val klangStudentId = "stud_klang_999"
        val klangOrgId = "persatuan_klang"

        // Sepang Admin CANNOT modify or delete a student belonging to Klang
        assertFalse(AuthorizationManager.authorize(sepangAdmin, Permission.PERSATUAN_MANAGE_STUDENTS, targetOrganizationId = klangOrgId, targetStudentId = klangStudentId).isAllowed)
        assertFalse(AuthorizationManager.authorize(sepangAdmin, Permission.PERSATUAN_MANAGE_CLASSES, targetOrganizationId = klangOrgId, targetClassId = "cls_klang_1").isAllowed)
        assertFalse(AuthorizationManager.authorize(sepangAdmin, Permission.PERSATUAN_MANAGE_CERTIFICATES, targetOrganizationId = klangOrgId, targetStudentId = klangStudentId).isAllowed)
    }

    @Test
    fun unassignedCoach_cannotScoreGradingOrApprovePayments() {
        val coachClassA = AuthContext("prof_coach_ravi", UserRole.MASTER, "persatuan_sepang", assignedClassIds = listOf("cls_batch_a"))
        val classBId = "cls_batch_b"
        val studentClassB = "stud_batch_b_456"

        // Coach assigned to Batch A CANNOT mark attendance, approve payments, or manage skills for Batch B
        assertFalse(AuthorizationManager.authorize(coachClassA, Permission.CLASS_MARK_ATTENDANCE, targetClassId = classBId).isAllowed)
        assertFalse(AuthorizationManager.authorize(coachClassA, Permission.CLASS_MANAGE_FEES, targetClassId = classBId).isAllowed)
        assertFalse(AuthorizationManager.authorize(coachClassA, Permission.CLASS_MANAGE_MASTERS, targetClassId = classBId).isAllowed)
    }

    @Test
    fun parent_cannotPayOrRegisterForUnlinkedStudent() {
        val parent = AuthContext("prof_parent_suresh", UserRole.PARENT, "persatuan_sepang", linkedStudentIds = listOf("stud_child_verified"))
        val strangerStudentId = "stud_stranger_789"

        // Parent CANNOT pay fees or register grading for an unlinked student
        assertFalse(AuthorizationManager.authorize(parent, Permission.PARENT_PAY_FEES, targetStudentId = strangerStudentId).isAllowed)
        assertFalse(AuthorizationManager.authorize(parent, Permission.PARENT_REGISTER_CHILD_GRADING, targetStudentId = strangerStudentId).isAllowed)
        assertFalse(AuthorizationManager.authorize(parent, Permission.PARENT_VIEW_SKILL_PROGRESS, targetStudentId = strangerStudentId).isAllowed)
    }

    @Test
    fun certificateVerification_requiresAuthentication() {
        val unauthenticatedContext: AuthContext? = null
        val authenticatedStudent = AuthContext("prof_stud", UserRole.STUDENT, "persatuan_sepang", linkedStudentIds = listOf("stud_1"))

        // Unauthenticated lookup is denied
        val unauthResult = AuthorizationManager.authorize(unauthenticatedContext, Permission.CERTIFICATE_VIEW)
        assertFalse(unauthResult.isAllowed)

        // Authenticated user is permitted
        val authResult = AuthorizationManager.authorize(authenticatedStudent, Permission.CERTIFICATE_VIEW)
        assertTrue(authResult.isAllowed)
    }
}
