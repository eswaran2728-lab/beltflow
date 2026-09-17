package com.example.beltflow.data.repository

import com.example.beltflow.data.local.*
import com.example.beltflow.data.model.*
import com.example.beltflow.data.rbac.*
import com.example.beltflow.data.remote.*
import com.example.beltflow.data.security.SecurityUtils
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.withContext
import org.json.JSONArray
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import java.util.UUID

class BeltFlowRepository(private val dao: BeltFlowDao) {

    // --- Current Session User State (In-Memory Auth with Room Persistence) ---
    private val _currentUser = MutableStateFlow<AuthUser?>(null)
    val currentUser: StateFlow<AuthUser?> = _currentUser.asStateFlow()

    fun setCurrentUser(user: AuthUser?) {
        _currentUser.value = user
    }

    suspend fun getAuthContext(): AuthContext? {
        val user = _currentUser.value ?: return null
        val assignedClassIds = if (user.role == UserRole.MASTER) {
            dao.getClassesForMasterDirect(user.id).map { it.classId }
        } else {
            emptyList()
        }
        val isMainMasterMap = if (user.role == UserRole.MASTER) {
            dao.getClassesForMasterDirect(user.id).associate { it.classId to it.isMainMaster }
        } else {
            emptyMap()
        }
        val linkedStudentIds = if (user.role == UserRole.PARENT) {
            dao.getApprovedLinksForParentDirect(user.id).map { it.studentId }
        } else if (user.role == UserRole.STUDENT) {
            val studentProfile = dao.getStudentByProfileId(user.id)
            listOfNotNull(studentProfile?.id, user.studentId, user.id)
        } else {
            emptyList()
        }

        return AuthContext(
            userId = user.id,
            role = user.role,
            organizationId = user.organizationId,
            assignedClassIds = assignedClassIds,
            isMainMasterMap = isMainMasterMap,
            linkedStudentIds = linkedStudentIds
        )
    }

    suspend fun checkPermission(
        permission: Permission,
        targetOrganizationId: String? = null,
        targetClassId: String? = null,
        targetStudentId: String? = null
    ) {
        val context = getAuthContext()
            ?: throw SecurityException("Authentication Required: No active user session")
        val result = AuthorizationManager.authorize(
            context = context,
            permission = permission,
            targetOrganizationId = targetOrganizationId,
            targetClassId = targetClassId,
            targetStudentId = targetStudentId
        )
        if (!result.isAllowed) {
            val reason = (result as? AuthorizationResult.Denied)?.reason ?: "Access denied"
            throw SecurityException("Security Policy Violation: $reason (Permission: $permission)")
        }
    }

    // A student may belong to zero, one, or multiple classes (StudentEntity.classIdsJson).
    // A Master is authorized for the student if the operation's class-scoping requirement
    // is met by ANY of the student's classes (or if the student has no class yet, the
    // class-scoping check is skipped and role/permission/targetStudentId checks still apply).
    // This is a client-side, defense-in-depth check only; the backend remains authoritative.
    suspend fun checkPermissionForStudent(
        permission: Permission,
        student: StudentEntity?,
        targetStudentId: String? = null
    ) {
        val studentClassIds = student?.classIdsJson?.let { parseClassIds(it) } ?: emptyList()
        if (studentClassIds.isEmpty()) {
            checkPermission(permission, targetOrganizationId = student?.organizationId, targetClassId = null, targetStudentId = targetStudentId)
            return
        }
        val context = getAuthContext() ?: throw SecurityException("Authentication Required: No active user session")
        val anyClassAllowed = studentClassIds.any { classId ->
            AuthorizationManager.authorize(
                context = context,
                permission = permission,
                targetOrganizationId = student?.organizationId,
                targetClassId = classId,
                targetStudentId = targetStudentId
            ).isAllowed
        }
        if (!anyClassAllowed) {
            throw SecurityException("Security Policy Violation: Not authorized for any of this student's classes (Permission: $permission)")
        }
    }

    suspend fun isFirstRun(): Boolean = withContext(Dispatchers.IO) {
        dao.getProfilesCount() == 0
    }

    suspend fun setupInitialSuperAdmin(
        fullName: String,
        email: String,
        phone: String,
        password: String
    ): Result<AuthUser> = withContext(Dispatchers.IO) {
        val cleanEmail = email.trim().lowercase(Locale.getDefault())
        val cleanPassword = password.trim()
        if (cleanEmail.isBlank() || cleanPassword.isBlank()) {
            return@withContext Result.failure(Exception("Email and password are required."))
        }

        try {
            val remoteResp = BeltFlowApiClient.service.setupInitialSuperAdmin(
                SetupAdminRequest(fullName.trim(), cleanEmail, phone.trim(), cleanPassword)
            )
            if (remoteResp.isSuccessful && remoteResp.body() != null) {
                val authBody = remoteResp.body()!!
                BeltFlowApiClient.setAuthToken(authBody.token)
                val userDto = authBody.user
                val authUser = AuthUser(
                    id = userDto.id,
                    fullName = userDto.fullName,
                    email = userDto.email,
                    role = UserRole.SUPER_ADMIN,
                    status = ProfileStatus.APPROVED,
                    organizationId = null
                )
                _currentUser.value = authUser
                return@withContext Result.success(authUser)
            } else {
                return@withContext Result.failure(Exception("Super Admin setup failed on server: ${remoteResp.errorBody()?.string() ?: "Server rejected request"}"))
            }
        } catch (e: Exception) {
            return@withContext Result.failure(Exception("Cannot setup Super Admin: Shared backend server is unreachable. Disconnected phones cannot create platform administrators. Error: ${e.message}"))
        }
    }

    suspend fun login(email: String, password: String): Result<AuthUser> = withContext(Dispatchers.IO) {
        val cleanEmail = email.trim().lowercase(Locale.getDefault())
        val cleanPassword = password.trim()

        if (cleanEmail.isBlank()) {
            return@withContext Result.failure(Exception("Please enter your email address."))
        }
        if (cleanPassword.isBlank()) {
            return@withContext Result.failure(Exception("Please enter your password."))
        }

        try {
            val remoteResp = BeltFlowApiClient.service.login(LoginRequest(cleanEmail, cleanPassword))
            if (remoteResp.isSuccessful && remoteResp.body() != null) {
                val authBody = remoteResp.body()!!
                BeltFlowApiClient.setAuthToken(authBody.token)
                val userDto = authBody.user
                val roleEnum = try {
                    UserRole.valueOf(userDto.role)
                } catch (e: Exception) {
                    UserRole.MASTER
                }
                val authUser = AuthUser(
                    id = userDto.id,
                    fullName = userDto.fullName,
                    email = userDto.email,
                    role = roleEnum,
                    status = ProfileStatus.APPROVED,
                    organizationId = userDto.organizationId
                )
                _currentUser.value = authUser
                return@withContext Result.success(authUser)
            } else {
                return@withContext Result.failure(Exception("Authentication failed: Invalid credentials or account not registered on server."))
            }
        } catch (e: Exception) {
            return@withContext Result.failure(Exception("Cannot sign in: Shared backend server is unreachable. Error: ${e.message}"))
        }
    }

    fun logout() {
        _currentUser.value = null
    }

    // --- Persatuans & Subscriptions ---
    val allPersatuans: Flow<List<PersatuanEntity>> = dao.getAllPersatuans()

    suspend fun createPersatuan(
        name: String,
        adminEmail: String,
        adminFullName: String,
        adminPassword: String,
        plan: SubscriptionPlan = SubscriptionPlan.GROWTH,
        chargePercent: Double = 8.0
    ): Result<Unit> = withContext(Dispatchers.IO) {
        checkPermission(Permission.PLATFORM_MANAGE_PERSATUAN)
        val cleanEmail = adminEmail.trim().lowercase(Locale.getDefault())
        val cleanPassword = adminPassword.trim()
        if (cleanEmail.isBlank() || cleanPassword.isBlank()) {
            return@withContext Result.failure(Exception("Admin email and password are required."))
        }
        try {
            val resp = BeltFlowApiClient.service.createOrganization(
                CreateOrganizationRequest(
                    name = name.trim(),
                    masterName = adminFullName.trim(),
                    email = cleanEmail,
                    password = cleanPassword,
                    baseMonthlyFee = 120.0,
                    siblingDiscountPercent = 10.0
                )
            )
            if (resp.isSuccessful && resp.body() != null) {
                val org = resp.body()!!.organization
                dao.insertPersatuan(
                    PersatuanEntity(
                        id = org.id,
                        name = org.name,
                        email = cleanEmail,
                        subscriptionPlan = plan,
                        platformChargeRatePercent = chargePercent
                    )
                )
                Result.success(Unit)
            } else {
                Result.failure(Exception("Failed to provision Persatuan: ${resp.errorBody()?.string() ?: "Server rejected request"}"))
            }
        } catch (e: Exception) {
            Result.failure(Exception("Cannot provision Persatuan: Shared backend server is unreachable. Error: ${e.message}"))
        }
    }

    // --- Profiles ---
    val allProfiles: Flow<List<ProfileEntity>> = dao.getAllProfiles()

    /**
     * Register a new user through the shared backend API.
     *
     * - SUPER_ADMIN and ADMIN_PERSATUAN accounts MUST be created server-side by authorized
     *   administrators. Self-registration of these roles is explicitly blocked.
     * - No local Room records are written; the backend is the single source of truth.
     * - An explicit organizationId is required for MASTER and STUDENT roles.
     */
    suspend fun registerUser(
        fullName: String,
        email: String,
        phone: String,
        role: UserRole,
        organizationId: String? = null,
        childName: String = "",
        assignedClass: String = "",
        password: String
    ): Result<Unit> = withContext(Dispatchers.IO) {
        // Security guard: privileged roles cannot be self-registered from the app.
        if (role == UserRole.SUPER_ADMIN || role == UserRole.ADMIN_PERSATUAN) {
            return@withContext Result.failure(
                SecurityException(
                    "Self-registration of ${role.name} accounts is not permitted. " +
                    "This account type must be created by an authorized platform administrator."
                )
            )
        }

        // MASTER and STUDENT registrations require an explicit organization.
        if ((role == UserRole.MASTER || role == UserRole.STUDENT || role == UserRole.PARENT) && organizationId.isNullOrBlank()) {
            return@withContext Result.failure(
                Exception("An organization must be selected to register as ${role.name}.")
            )
        }

        val cleanEmail = email.trim().lowercase(Locale.getDefault())
        val cleanPassword = password.trim()
        if (cleanEmail.isBlank() || cleanPassword.isBlank()) {
            return@withContext Result.failure(Exception("Email and password are required."))
        }

        return@withContext try {
            when (role) {
                UserRole.PARENT -> {
                    // Parent registration with a new child student record.
                    val resp = BeltFlowApiClient.service.registerParent(
                        RegisterParentRequest(
                            organizationId = organizationId!!,
                            fullName = fullName.trim(),
                            email = cleanEmail,
                            phone = phone.trim(),
                            password = cleanPassword,
                            childName = childName.ifBlank { null },
                            classId = assignedClass.ifBlank { null },
                            studentId = null  // New child — no pre-existing student linkage allowed here
                        )
                    )
                    if (resp.isSuccessful && resp.body() != null) {
                        Result.success(Unit)
                    } else {
                        val errMsg = resp.errorBody()?.string() ?: "Server rejected registration."
                        Result.failure(Exception("Registration failed: $errMsg"))
                    }
                }
                UserRole.STUDENT -> {
                    // Students self-register through the dedicated /auth/register-student endpoint,
                    // which creates a STUDENT role user + student profile row (status: PENDING_VERIFICATION).
                    // The account must be approved by an ADMIN_PERSATUAN or MASTER before login is allowed.
                    val resp = BeltFlowApiClient.service.registerStudent(
                        RegisterStudentRequest(
                            organizationId = organizationId!!,
                            fullName = fullName.trim(),
                            email = cleanEmail,
                            phone = phone.trim().ifBlank { null },
                            password = cleanPassword,
                            classId = assignedClass.ifBlank { null },
                            beltRank = null  // Default 'White Belt' applied by server
                        )
                    )
                    if (resp.isSuccessful && resp.body() != null) {
                        // Verify server actually created a STUDENT account, not something else.
                        val serverRole = resp.body()!!.user.role
                        if (serverRole != "STUDENT") {
                            return@withContext Result.failure(
                                SecurityException("Server returned unexpected role '$serverRole' for student registration. Contact support.")
                            )
                        }
                        Result.success(Unit)
                    } else {
                        val errMsg = resp.errorBody()?.string() ?: "Server rejected registration."
                        Result.failure(Exception("Student registration failed: $errMsg"))
                    }
                }
                UserRole.MASTER -> {
                    // Masters must be created by an ADMIN_PERSATUAN via the admin panel (POST /coaches).
                    // Self-registration of the MASTER role from the mobile app is not permitted.
                    return@withContext Result.failure(
                        SecurityException(
                            "Master/Instructor accounts must be created by an authorized academy administrator. " +
                            "Please ask your Persatuan Admin to create your account."
                        )
                    )
                }
                else -> {
                    // Should never reach here due to guard above, but fail safely.
                    Result.failure(SecurityException("Cannot self-register as ${role.name}."))
                }
            }
        } catch (e: Exception) {
            Result.failure(Exception("Cannot register: Shared backend server is unreachable. Error: ${e.message}"))
        }
    }

    suspend fun updateProfileStatus(profileId: String, status: ProfileStatus) = withContext(Dispatchers.IO) {
        val targetProfile = dao.getProfileById(profileId)
        val perm = if (_currentUser.value?.role == UserRole.MASTER) Permission.CLASS_APPROVE_STUDENT_REGISTRATION else Permission.PERSATUAN_MANAGE_STUDENTS
        checkPermission(perm, targetOrganizationId = targetProfile?.organizationId)
        dao.updateProfileStatus(profileId, status)
    }

    // --- Master Class Management (Main Master Controls) ---
    val allClassMasterCrossRefs: Flow<List<ClassMasterCrossRefEntity>> = dao.getAllClassMasterCrossRefs()

    suspend fun addMasterToClass(classId: String, masterProfileId: String, isMainMaster: Boolean = false) = withContext(Dispatchers.IO) {
        val targetClass = dao.getAllClassesDirect().find { it.id == classId }
        val perm = if (_currentUser.value?.role == UserRole.MASTER) Permission.CLASS_MANAGE_MASTERS else Permission.PERSATUAN_MANAGE_MASTERS
        checkPermission(perm, targetOrganizationId = targetClass?.organizationId, targetClassId = classId)
        dao.insertClassMasterCrossRef(ClassMasterCrossRefEntity(classId, masterProfileId, isMainMaster))
    }

    suspend fun removeMasterFromClass(classId: String, masterProfileId: String) = withContext(Dispatchers.IO) {
        val targetClass = dao.getAllClassesDirect().find { it.id == classId }
        val perm = if (_currentUser.value?.role == UserRole.MASTER) Permission.CLASS_MANAGE_MASTERS else Permission.PERSATUAN_MANAGE_MASTERS
        checkPermission(perm, targetOrganizationId = targetClass?.organizationId, targetClassId = classId)
        dao.removeMasterFromClass(classId, masterProfileId)
    }

    suspend fun setMainMasterForClass(classId: String, newMainMasterId: String) = withContext(Dispatchers.IO) {
        val targetClass = dao.getAllClassesDirect().find { it.id == classId }
        val perm = if (_currentUser.value?.role == UserRole.MASTER) Permission.CLASS_MANAGE_MASTERS else Permission.PERSATUAN_MANAGE_MASTERS
        checkPermission(perm, targetOrganizationId = targetClass?.organizationId, targetClassId = classId)
        val crossRefs = dao.getMastersForClass(classId)
        crossRefs.forEach { cr ->
            dao.insertClassMasterCrossRef(cr.copy(isMainMaster = cr.masterProfileId == newMainMasterId))
        }
        val newMasterProfile = dao.getProfileById(newMainMasterId)
        if (targetClass != null && newMasterProfile != null) {
            dao.updateClass(
                targetClass.copy(
                    mainMasterId = newMainMasterId,
                    coachName = newMasterProfile.fullName
                )
            )
        }
    }

    // --- Parent-Child 3-Way Approval Links ---
    val allParentChildLinks: Flow<List<ParentChildLinkEntity>> = dao.getAllParentChildLinks()

    suspend fun requestParentChildLink(parentProfileId: String, studentId: String) = withContext(Dispatchers.IO) {
        val student = dao.getStudentById(studentId)
        checkPermission(Permission.PARENT_REQUEST_CHILD_LINK, targetOrganizationId = student?.organizationId, targetStudentId = studentId)
        val link = ParentChildLinkEntity(
            id = "link_${UUID.randomUUID().toString().take(8)}",
            organizationId = student?.organizationId ?: error("Student organization is required"),
            parentProfileId = parentProfileId,
            studentId = studentId,
            status = LinkApprovalStatus.PENDING_STUDENT,
            studentApproved = false,
            masterApproved = false,
            adminApproved = false
        )
        dao.insertParentChildLink(link)
    }

    suspend fun approveParentChildLinkStep(linkId: String, approverRole: UserRole) = withContext(Dispatchers.IO) {
        val link = dao.getParentChildLinkById(linkId) ?: return@withContext
        val perm = when (approverRole) {
            UserRole.STUDENT -> Permission.STUDENT_APPROVE_PARENT_LINK
            UserRole.MASTER -> Permission.CLASS_APPROVE_PARENT_LINK
            else -> Permission.PERSATUAN_APPROVE_PARENT_LINK
        }
        checkPermission(perm, targetOrganizationId = link.organizationId, targetStudentId = link.studentId)
        var studApp = link.studentApproved
        var mastApp = link.masterApproved
        var admApp = link.adminApproved

        when (approverRole) {
            UserRole.STUDENT -> studApp = true
            UserRole.MASTER -> mastApp = true
            UserRole.ADMIN_PERSATUAN, UserRole.SUPER_ADMIN -> admApp = true
            else -> {}
        }

        val isFullyApproved = studApp && mastApp && admApp
        val newStatus = if (isFullyApproved) LinkApprovalStatus.APPROVED else when {
            !studApp -> LinkApprovalStatus.PENDING_STUDENT
            !mastApp -> LinkApprovalStatus.PENDING_MASTER
            else -> LinkApprovalStatus.PENDING_ADMIN
        }

        dao.updateParentChildLink(
            link.copy(
                studentApproved = studApp,
                masterApproved = mastApp,
                adminApproved = admApp,
                status = newStatus
            )
        )
    }

    suspend fun rejectParentChildLink(linkId: String) = withContext(Dispatchers.IO) {
        val link = dao.getParentChildLinkById(linkId) ?: return@withContext
        val perm = if (_currentUser.value?.role == UserRole.MASTER) Permission.CLASS_APPROVE_PARENT_LINK else Permission.PERSATUAN_APPROVE_PARENT_LINK
        checkPermission(perm, targetOrganizationId = link.organizationId, targetStudentId = link.studentId)
        dao.updateParentChildLink(link.copy(status = LinkApprovalStatus.REJECTED))
    }

    fun getLinkedStudentsForParent(parentProfileId: String): Flow<List<StudentWithDetails>> {
        return combine(
            dao.getApprovedLinksForParent(parentProfileId),
            studentsWithDetails
        ) { links, students ->
            val linkedStudentIds = links.map { it.studentId }.toSet()
            students.filter { linkedStudentIds.contains(it.id) }
        }
    }

    // --- Class Transfers (2-Master Approval) ---
    val allClassTransfers: Flow<List<ClassTransferRequestEntity>> = dao.getAllClassTransfers()

    suspend fun requestClassTransfer(studentId: String, oldClassId: String, newClassId: String) = withContext(Dispatchers.IO) {
        val student = dao.getStudentById(studentId)
        checkPermission(Permission.STUDENT_REQUEST_TRANSFER, targetOrganizationId = student?.organizationId, targetClassId = oldClassId, targetStudentId = studentId)
        val transfer = ClassTransferRequestEntity(
            id = "trans_${UUID.randomUUID().toString().take(8)}",
            studentId = studentId,
            oldClassId = oldClassId,
            newClassId = newClassId,
            status = ClassTransferStatus.PENDING_OLD_MASTER
        )
        dao.insertClassTransfer(transfer)
    }

    suspend fun approveClassTransferStep(transferId: String, isNewMaster: Boolean) = withContext(Dispatchers.IO) {
        val transfers = dao.getAllClassTransfers().firstOrNull() ?: emptyList()
        val tr = transfers.find { it.id == transferId } ?: return@withContext
        val targetClassId = if (isNewMaster) tr.newClassId else tr.oldClassId
        val student = dao.getStudentById(tr.studentId)
        checkPermission(Permission.CLASS_APPROVE_TRANSFER, targetOrganizationId = student?.organizationId, targetClassId = targetClassId, targetStudentId = tr.studentId)
        val oldApp = if (!isNewMaster) true else tr.oldMasterApproved
        val newApp = if (isNewMaster) true else tr.newMasterApproved

        if (oldApp && newApp) {
            dao.updateClassTransfer(
                tr.copy(
                    oldMasterApproved = true,
                    newMasterApproved = true,
                    status = ClassTransferStatus.APPROVED
                )
            )
            val student = dao.getStudentById(tr.studentId)
            if (student != null) {
                dao.updateStudent(
                    student.copy(
                        classIdsJson = "[\"${tr.newClassId}\"]"
                    )
                )
                logAction(
                    actorId = _currentUser.value?.id ?: "master",
                    actorName = _currentUser.value?.fullName ?: "Master",
                    actorRole = UserRole.MASTER,
                    action = "CLASS_TRANSFER_COMPLETED",
                    targetEntity = "Student",
                    targetId = student.id,
                    prevVal = tr.oldClassId,
                    newVal = tr.newClassId
                )
            }
        } else {
            dao.updateClassTransfer(
                tr.copy(
                    oldMasterApproved = oldApp,
                    newMasterApproved = newApp,
                    status = if (!oldApp) ClassTransferStatus.PENDING_OLD_MASTER else ClassTransferStatus.PENDING_NEW_MASTER
                )
            )
        }
    }

    suspend fun rejectClassTransfer(transferId: String) = withContext(Dispatchers.IO) {
        val transfers = dao.getAllClassTransfers().firstOrNull() ?: emptyList()
        val tr = transfers.find { it.id == transferId } ?: return@withContext
        val student = dao.getStudentById(tr.studentId)
        checkPermission(Permission.CLASS_APPROVE_TRANSFER, targetOrganizationId = student?.organizationId, targetClassId = tr.oldClassId, targetStudentId = tr.studentId)
        dao.updateClassTransfer(tr.copy(status = ClassTransferStatus.REJECTED))
    }

    // --- Master Class Creation & Join Requests ---
    val allClassWorkflowRequests: Flow<List<ClassWorkflowRequestDetail>> = combine(
        dao.getAllClassWorkflowRequests(),
        dao.getAllProfiles()
    ) { requests, profiles ->
        val profMap = profiles.associateBy { it.id }
        requests.map { r ->
            ClassWorkflowRequestDetail(
                id = r.id,
                masterProfileId = r.masterProfileId,
                masterName = profMap[r.masterProfileId]?.fullName ?: "Master",
                requestType = r.requestType,
                targetClassId = r.targetClassId,
                proposedClassName = r.proposedClassName,
                proposedBranchId = r.proposedBranchId,
                status = r.status,
                createdAt = r.createdAt
            )
        }
    }

    suspend fun requestClassCreation(
        masterProfileId: String,
        proposedClassName: String,
        proposedBranchId: String?
    ) = withContext(Dispatchers.IO) {
        val orgId = _currentUser.value?.organizationId ?: error("Organization context is required")
        checkPermission(Permission.CLASS_REQUEST_CREATE, targetOrganizationId = orgId)
        val request = ClassWorkflowRequestEntity(
            id = "cr_${UUID.randomUUID().toString().take(8)}",
            organizationId = _currentUser.value?.organizationId ?: error("Organization context is required"),
            masterProfileId = masterProfileId,
            requestType = ClassRequestType.CREATE_CLASS,
            proposedClassName = proposedClassName,
            proposedBranchId = proposedBranchId,
            status = ClassRequestStatus.PENDING
        )
        dao.insertClassWorkflowRequest(request)
        logAction(
            actorId = masterProfileId,
            actorName = _currentUser.value?.fullName ?: "Master",
            actorRole = UserRole.MASTER,
            action = "REQUEST_NEW_CLASS",
            targetEntity = "ClassWorkflowRequest",
            targetId = request.id,
            newVal = proposedClassName
        )
    }

    suspend fun approveClassCreation(
        requestId: String,
        code: String = "CLS-${UUID.randomUUID().toString().take(4).uppercase(Locale.getDefault())}",
        dayOfWeek: Int = 6,
        startTime: String = "09:00",
        endTime: String = "11:00",
        monthlyFee: Double = 80.0
    ) = withContext(Dispatchers.IO) {
        val request = dao.getClassWorkflowRequestById(requestId) ?: return@withContext
        checkPermission(Permission.PERSATUAN_MANAGE_CLASSES, targetOrganizationId = request.organizationId)
        val master = dao.getProfileById(request.masterProfileId) ?: return@withContext

        val classId = "cls_${UUID.randomUUID().toString().take(6)}"
        val newClass = ClassEntity(
            id = classId,
            organizationId = request.organizationId,
            branchId = request.proposedBranchId,
            name = request.proposedClassName,
            code = code,
            dayOfWeek = dayOfWeek,
            startTime = startTime,
            endTime = endTime,
            scheduleNote = "Day $dayOfWeek $startTime - $endTime",
            monthlyFeeOverride = monthlyFee,
            mainMasterId = master.id,
            coachName = master.fullName
        )
        dao.insertClass(newClass)
        dao.insertClassMasterCrossRef(ClassMasterCrossRefEntity(classId, master.id, isMainMaster = true))
        dao.updateClassWorkflowRequest(request.copy(status = ClassRequestStatus.APPROVED))

        logAction(
            actorId = _currentUser.value?.id ?: "admin",
            actorName = _currentUser.value?.fullName ?: "Admin Persatuan",
            actorRole = UserRole.ADMIN_PERSATUAN,
            action = "APPROVE_CLASS_CREATION",
            targetEntity = "Class",
            targetId = classId,
            newVal = newClass.name
        )
    }

    suspend fun rejectClassCreation(requestId: String) = withContext(Dispatchers.IO) {
        val request = dao.getClassWorkflowRequestById(requestId) ?: return@withContext
        checkPermission(Permission.PERSATUAN_MANAGE_CLASSES, targetOrganizationId = request.organizationId)
        dao.updateClassWorkflowRequest(request.copy(status = ClassRequestStatus.REJECTED))
    }

    suspend fun requestJoinClass(masterProfileId: String, targetClassId: String) = withContext(Dispatchers.IO) {
        val targetClass = dao.getAllClassesDirect().find { it.id == targetClassId }
        checkPermission(Permission.CLASS_REQUEST_CREATE, targetOrganizationId = targetClass?.organizationId, targetClassId = targetClassId)
        val request = ClassWorkflowRequestEntity(
            id = "cr_${UUID.randomUUID().toString().take(8)}",
            organizationId = _currentUser.value?.organizationId ?: error("Organization context is required"),
            masterProfileId = masterProfileId,
            requestType = ClassRequestType.JOIN_CLASS,
            targetClassId = targetClassId,
            status = ClassRequestStatus.PENDING
        )
        dao.insertClassWorkflowRequest(request)
        logAction(
            actorId = masterProfileId,
            actorName = _currentUser.value?.fullName ?: "Master",
            actorRole = UserRole.MASTER,
            action = "REQUEST_JOIN_CLASS",
            targetEntity = "ClassWorkflowRequest",
            targetId = request.id,
            newVal = targetClassId
        )
    }

    suspend fun approveJoinClass(requestId: String) = withContext(Dispatchers.IO) {
        val request = dao.getClassWorkflowRequestById(requestId) ?: return@withContext
        checkPermission(Permission.CLASS_REQUEST_JOIN_APPROVE, targetOrganizationId = request.organizationId, targetClassId = request.targetClassId)
        if (request.targetClassId != null) {
            dao.insertClassMasterCrossRef(ClassMasterCrossRefEntity(request.targetClassId, request.masterProfileId, isMainMaster = false))
        }
        dao.updateClassWorkflowRequest(request.copy(status = ClassRequestStatus.APPROVED))
        logAction(
            actorId = _currentUser.value?.id ?: "main_master",
            actorName = _currentUser.value?.fullName ?: "Main Master",
            actorRole = UserRole.MASTER,
            action = "APPROVE_JOIN_CLASS",
            targetEntity = "ClassMasterCrossRef",
            targetId = request.targetClassId ?: "",
            newVal = request.masterProfileId
        )
    }

    suspend fun rejectJoinClass(requestId: String) = withContext(Dispatchers.IO) {
        val request = dao.getClassWorkflowRequestById(requestId) ?: return@withContext
        checkPermission(Permission.CLASS_REQUEST_JOIN_APPROVE, targetOrganizationId = request.organizationId, targetClassId = request.targetClassId)
        dao.updateClassWorkflowRequest(request.copy(status = ClassRequestStatus.REJECTED))
    }

    // --- Student Registration Approval by Master ---
    suspend fun approveStudentRegistration(profileId: String) = withContext(Dispatchers.IO) {
        val profile = dao.getProfileById(profileId) ?: return@withContext
        checkPermission(Permission.CLASS_APPROVE_STUDENT_REGISTRATION, targetOrganizationId = profile.organizationId)
        dao.updateProfileStatus(profileId, ProfileStatus.APPROVED)
        logAction(
            actorId = _currentUser.value?.id ?: "master",
            actorName = _currentUser.value?.fullName ?: "Master",
            actorRole = UserRole.MASTER,
            action = "APPROVE_STUDENT_REGISTRATION",
            targetEntity = "Profile",
            targetId = profileId,
            newVal = ProfileStatus.APPROVED.name
        )
    }

    suspend fun rejectStudentRegistration(profileId: String) = withContext(Dispatchers.IO) {
        val profile = dao.getProfileById(profileId) ?: return@withContext
        checkPermission(Permission.CLASS_APPROVE_STUDENT_REGISTRATION, targetOrganizationId = profile.organizationId)
        dao.updateProfileStatus(profileId, ProfileStatus.REJECTED)
        logAction(
            actorId = _currentUser.value?.id ?: "master",
            actorName = _currentUser.value?.fullName ?: "Master",
            actorRole = UserRole.MASTER,
            action = "REJECT_STUDENT_REGISTRATION",
            targetEntity = "Profile",
            targetId = profileId,
            newVal = ProfileStatus.REJECTED.name
        )
    }

    // --- Messages with Audit ---
    val allMessages: Flow<List<MessageDetail>> = combine(
        dao.getAllMessages(),
        dao.getAllProfiles()
    ) { msgs, profiles ->
        val profMap = profiles.associateBy { it.id }
        msgs.map { m ->
            MessageDetail(
                id = m.id,
                organizationId = m.organizationId,
                senderId = m.senderId,
                senderName = profMap[m.senderId]?.fullName ?: m.senderName,
                senderRole = m.senderRole,
                recipientId = m.recipientId,
                classId = m.classId,
                content = m.content,
                timestamp = m.timestamp,
                isAuditable = m.isAuditable
            )
        }
    }

    suspend fun sendMessage(
        senderId: String,
        senderName: String,
        senderRole: UserRole,
        recipientId: String?,
        classId: String?,
        content: String
    ) = withContext(Dispatchers.IO) {
        val msg = MessageEntity(
            id = "msg_${UUID.randomUUID().toString().take(8)}",
            organizationId = _currentUser.value?.organizationId ?: error("Organization context is required"),
            senderId = senderId,
            senderName = senderName,
            senderRole = senderRole,
            recipientId = recipientId,
            classId = classId,
            content = content,
            timestamp = System.currentTimeMillis(),
            isAuditable = true
        )
        dao.insertMessage(msg)
    }

    // --- Audit Logs & Deletion ---
    val allAuditLogs: Flow<List<AuditLogEntity>> = dao.getAllAuditLogs()

    suspend fun deleteAuditLogsForOrganization(orgId: String) = withContext(Dispatchers.IO) {
        dao.deleteAuditLogsForOrganization(orgId)
    }

    suspend fun logAction(
        actorId: String,
        actorName: String,
        actorRole: UserRole,
        action: String,
        targetEntity: String,
        targetId: String,
        prevVal: String = "",
        newVal: String = ""
    ) = withContext(Dispatchers.IO) {
        dao.insertAuditLog(
            AuditLogEntity(
                id = "log_${UUID.randomUUID().toString().take(8)}",
                organizationId = _currentUser.value?.organizationId ?: error("Organization context is required"),
                actorId = actorId,
                actorName = actorName,
                actorRole = actorRole,
                action = action,
                targetEntity = targetEntity,
                targetId = targetId,
                previousValue = prevVal,
                newValue = newVal
            )
        )
    }

    // --- Announcements ---
    val allAnnouncements: Flow<List<AnnouncementEntity>> = dao.getAllAnnouncements()

    suspend fun addAnnouncement(
        authorId: String,
        authorName: String,
        authorRole: UserRole,
        title: String,
        content: String,
        classId: String? = null
    ) = withContext(Dispatchers.IO) {
        val status = if (authorRole == UserRole.STUDENT || authorRole == UserRole.PARENT) {
            AnnouncementStatus.PENDING_MASTER_APPROVAL
        } else {
            AnnouncementStatus.PUBLISHED
        }
        dao.insertAnnouncement(
            AnnouncementEntity(
                id = "anc_${UUID.randomUUID().toString().take(8)}",
                organizationId = _currentUser.value?.organizationId ?: error("Organization context is required"),
                authorId = authorId,
                authorName = authorName,
                authorRole = authorRole,
                title = title,
                content = content,
                classId = classId,
                status = status
            )
        )
        logAction(
            actorId = authorId,
            actorName = authorName,
            actorRole = authorRole,
            action = "CREATE_ANNOUNCEMENT",
            targetEntity = "Announcement",
            targetId = title,
            newVal = status.name
        )
    }

    suspend fun approveAnnouncement(announcementId: String) = withContext(Dispatchers.IO) {
        val announcements = dao.getAllAnnouncements().firstOrNull() ?: emptyList()
        val anc = announcements.find { it.id == announcementId } ?: return@withContext
        dao.updateAnnouncement(anc.copy(status = AnnouncementStatus.PUBLISHED))
        logAction(
            actorId = _currentUser.value?.id ?: "master",
            actorName = _currentUser.value?.fullName ?: "Master",
            actorRole = UserRole.MASTER,
            action = "APPROVE_ANNOUNCEMENT",
            targetEntity = "Announcement",
            targetId = announcementId,
            newVal = AnnouncementStatus.PUBLISHED.name
        )
    }

    suspend fun rejectAnnouncement(announcementId: String) = withContext(Dispatchers.IO) {
        val announcements = dao.getAllAnnouncements().firstOrNull() ?: emptyList()
        val anc = announcements.find { it.id == announcementId } ?: return@withContext
        dao.updateAnnouncement(anc.copy(status = AnnouncementStatus.REJECTED))
    }

    // --- Settings & Belts & Branches & Classes ---
    val academySettings: Flow<AcademySettingsEntity?> = dao.getAcademySettings()
    val allBelts: Flow<List<BeltEntity>> = dao.getAllBelts()
    val allBranches: Flow<List<BranchEntity>> = dao.getAllBranches()
    val allClasses: Flow<List<ClassEntity>> = dao.getAllClasses()

    suspend fun saveAcademySettings(settings: AcademySettingsEntity) = withContext(Dispatchers.IO) {
        checkPermission(Permission.PERSATUAN_EDIT_PROFILE, targetOrganizationId = settings.organizationId)
        dao.saveAcademySettings(settings)
    }

    suspend fun addBelt(name: String, colorHex: String, sortOrder: Int) = withContext(Dispatchers.IO) {
        val orgId = _currentUser.value?.organizationId ?: error("Organization context is required")
        checkPermission(Permission.PERSATUAN_MANAGE_BELTS, targetOrganizationId = orgId)
        dao.insertBelt(BeltEntity("belt_${UUID.randomUUID().toString().take(6)}", orgId, name, colorHex, sortOrder))
    }

    suspend fun deleteBelt(belt: BeltEntity) = withContext(Dispatchers.IO) {
        checkPermission(Permission.PERSATUAN_MANAGE_BELTS, targetOrganizationId = belt.organizationId)
        dao.deleteBelt(belt)
    }

    suspend fun addBranch(name: String, address: String, phone: String) = withContext(Dispatchers.IO) {
        val orgId = _currentUser.value?.organizationId ?: error("Organization context is required")
        checkPermission(Permission.PERSATUAN_MANAGE_BRANCHES, targetOrganizationId = orgId)
        dao.insertBranch(BranchEntity("br_${UUID.randomUUID().toString().take(6)}", orgId, name, address, phone))
    }

    suspend fun deleteBranch(branch: BranchEntity) = withContext(Dispatchers.IO) {
        checkPermission(Permission.PERSATUAN_MANAGE_BRANCHES, targetOrganizationId = branch.organizationId)
        dao.deleteBranch(branch)
    }

    suspend fun addClass(
        branchId: String?,
        name: String,
        code: String,
        dayOfWeek: Int,
        startTime: String,
        endTime: String,
        monthlyFee: Double,
        coachName: String
    ) = withContext(Dispatchers.IO) {
        val orgId = _currentUser.value?.organizationId ?: error("Organization context is required")
        checkPermission(Permission.PERSATUAN_MANAGE_CLASSES, targetOrganizationId = orgId)
        try {
            val resp = BeltFlowApiClient.service.createClass(
                CreateClassRequest(
                    organizationId = orgId,
                    name = name,
                    schedule = "Day $dayOfWeek $startTime - $endTime",
                    location = coachName,
                    mainMasterId = null
                )
            )
            if (resp.isSuccessful && resp.body() != null) {
                val c = resp.body()!!.`class`
                val newClass = ClassEntity(
                    id = c.id,
                    organizationId = c.organizationId,
                    branchId = branchId,
                    name = c.name,
                    code = code,
                    dayOfWeek = dayOfWeek,
                    startTime = startTime,
                    endTime = endTime,
                    scheduleNote = c.schedule,
                    monthlyFeeOverride = monthlyFee,
                    coachName = coachName
                )
                dao.insertClass(newClass)
            } else {
                throw Exception("Server rejected class creation: ${resp.errorBody()?.string() ?: "Unknown error"}")
            }
        } catch (e: Exception) {
            throw Exception("Failed to create class on shared backend: ${e.message}")
        }
    }

    suspend fun addClass(classEntity: ClassEntity) = withContext(Dispatchers.IO) {
        checkPermission(Permission.PERSATUAN_MANAGE_CLASSES, targetOrganizationId = classEntity.organizationId, targetClassId = classEntity.id)
        dao.insertClass(classEntity)
    }

    suspend fun updateClass(classEntity: ClassEntity) = withContext(Dispatchers.IO) {
        checkPermission(Permission.PERSATUAN_MANAGE_CLASSES, targetOrganizationId = classEntity.organizationId, targetClassId = classEntity.id)
        dao.updateClass(classEntity)
    }

    suspend fun deleteClass(classEntity: ClassEntity) = withContext(Dispatchers.IO) {
        checkPermission(Permission.PERSATUAN_MANAGE_CLASSES, targetOrganizationId = classEntity.organizationId, targetClassId = classEntity.id)
        dao.deleteClass(classEntity)
    }

    // --- Students ---
    val studentsWithDetails: Flow<List<StudentWithDetails>> = combine(
        dao.getAllStudents(),
        dao.getAllBelts(),
        dao.getAllClasses(),
        dao.getAllAttendance()
    ) { students, belts, classes, attendance ->
        val beltsMap = belts.associateBy { it.id }
        val classesMap = classes.associateBy { it.id }
        val attendanceByStudent = attendance.groupBy { it.studentId }

        students.map { student ->
            val belt = beltsMap[student.beltId]
            val classIds = parseClassIds(student.classIdsJson)
            val classNames = classIds.mapNotNull { classesMap[it]?.name }
            val studentAtt = attendanceByStudent[student.id] ?: emptyList()
            val total = studentAtt.size
            val present = studentAtt.count { it.status == AttendanceStatus.PRESENT || it.status == AttendanceStatus.LATE }
            val rate = if (total > 0) ((present.toDouble() / total) * 100).toInt() else 100

            val recentAbsences = studentAtt.take(5).count { it.status == AttendanceStatus.ABSENT }
            val isAtRisk = recentAbsences >= 3 || (total >= 5 && rate < 70)

            StudentWithDetails(
                id = student.id,
                organizationId = student.organizationId,
                profileId = student.profileId,
                fullName = student.fullName,
                icOrMykid = student.icOrMykid,
                dateOfBirth = student.dateOfBirth,
                age = calculateAge(student.dateOfBirth),
                gender = student.gender,
                beltId = student.beltId,
                beltName = belt?.name ?: "No Belt Assigned",
                beltColorHex = belt?.colorHex ?: "#94A3B8",
                lifecycle = student.lifecycle,
                joinedAt = student.joinedAt,
                parentName = student.parentName,
                parentPhone = student.parentPhone,
                medicalNotes = student.medicalNotes,
                classNames = classNames,
                classIds = classIds,
                attendanceRate = rate,
                recentAbsenceCount = recentAbsences,
                isAtRisk = isAtRisk
            )
        }
    }

    fun getStudentDetails(studentId: String): Flow<StudentWithDetails?> {
        return studentsWithDetails.map { list -> list.find { it.id == studentId } }
    }

    fun getStudentDetailsFlow(studentId: String): Flow<StudentWithDetails?> {
        return getStudentDetails(studentId)
    }

    suspend fun addStudent(
        fullName: String,
        icOrMykid: String,
        dateOfBirth: String,
        gender: String,
        beltId: String?,
        parentName: String,
        parentPhone: String,
        medicalNotes: String,
        classIds: List<String>
    ): String = withContext(Dispatchers.IO) {
        val orgId = _currentUser.value?.organizationId ?: error("Organization context is required")
        val perm = if (_currentUser.value?.role == UserRole.MASTER) Permission.CLASS_APPROVE_STUDENT_REGISTRATION else Permission.PERSATUAN_MANAGE_STUDENTS
        checkPermission(perm, targetOrganizationId = orgId)
        try {
            val resp = BeltFlowApiClient.service.enrollStudent(
                EnrollStudentRequest(
                    organizationId = orgId,
                    classId = classIds.firstOrNull(),
                    fullName = fullName.trim(),
                    icNumber = icOrMykid.trim().ifBlank { null },
                    phone = parentPhone.trim().ifBlank { null },
                    email = null,
                    beltRank = beltId ?: "White Belt",
                    hasSiblingDiscount = false,
                    parentName = parentName.trim().ifBlank { null },
                    parentPhone = parentPhone.trim().ifBlank { null }
                )
            )
            if (resp.isSuccessful && resp.body() != null) {
                val st = resp.body()!!.student
                val classJson = ClassMembership.toClassIdsJson(classIds)
                val student = StudentEntity(
                    id = st.id,
                    organizationId = st.organizationId,
                    fullName = st.fullName,
                    icOrMykid = icOrMykid,
                    dateOfBirth = dateOfBirth,
                    gender = gender,
                    beltId = beltId,
                    parentName = parentName,
                    parentPhone = parentPhone,
                    medicalNotes = medicalNotes,
                    classIdsJson = classJson
                )
                dao.insertStudent(student)
                st.id
            } else {
                throw Exception("Server rejected student enrollment: ${resp.errorBody()?.string() ?: "Unknown error"}")
            }
        } catch (e: Exception) {
            throw Exception("Failed to enroll student on shared backend: ${e.message}")
        }
    }

    suspend fun registerStudent(
        fullName: String,
        icOrMykid: String,
        dateOfBirth: String,
        gender: String,
        beltId: String?,
        parentName: String,
        parentPhone: String,
        medicalNotes: String,
        classIds: List<String>
    ): String = addStudent(fullName, icOrMykid, dateOfBirth, gender, beltId, parentName, parentPhone, medicalNotes, classIds)

    suspend fun updateStudent(
        id: String,
        fullName: String,
        icOrMykid: String,
        dateOfBirth: String,
        gender: String,
        beltId: String?,
        lifecycle: Lifecycle,
        parentName: String,
        parentPhone: String,
        medicalNotes: String,
        classIds: List<String>
    ) = withContext(Dispatchers.IO) {
        val existing = dao.getStudentById(id)
        val orgId = existing?.organizationId ?: error("Organization context is required")
        val perm = if (_currentUser.value?.role == UserRole.MASTER) Permission.CLASS_APPROVE_STUDENT_REGISTRATION else Permission.PERSATUAN_MANAGE_STUDENTS
        checkPermission(perm, targetOrganizationId = orgId, targetStudentId = id)
        val student = StudentEntity(
            id = id,
            organizationId = orgId,
            fullName = fullName,
            icOrMykid = icOrMykid,
            dateOfBirth = dateOfBirth,
            gender = gender,
            beltId = beltId,
            lifecycle = lifecycle,
            parentName = parentName,
            parentPhone = parentPhone,
            medicalNotes = medicalNotes,
            classIdsJson = ClassMembership.toClassIdsJson(classIds)
        )
        dao.updateStudent(student)
    }

    suspend fun updateStudent(student: StudentEntity) = withContext(Dispatchers.IO) {
        val perm = if (_currentUser.value?.role == UserRole.MASTER) Permission.CLASS_APPROVE_STUDENT_REGISTRATION else Permission.PERSATUAN_MANAGE_STUDENTS
        checkPermission(perm, targetOrganizationId = student.organizationId, targetStudentId = student.id)
        dao.updateStudent(student)
    }

    suspend fun deleteStudent(studentId: String) = withContext(Dispatchers.IO) {
        val student = dao.getStudentById(studentId)
        if (student != null) {
            checkPermission(Permission.PERSATUAN_MANAGE_STUDENTS, targetOrganizationId = student.organizationId, targetStudentId = student.id)
            dao.deleteStudent(student)
        }
    }

    suspend fun updateStudentBelt(studentId: String, beltId: String) = withContext(Dispatchers.IO) {
        val student = dao.getStudentById(studentId)
        checkPermissionForStudent(Permission.CLASS_SCORE_GRADING, student = student, targetStudentId = studentId)
        dao.updateStudentBelt(studentId, beltId)
    }

    // --- Attendance ---
    fun getAttendanceForSession(sessionId: String): Flow<List<AttendanceEntity>> = dao.getAttendanceForSession(sessionId)
    fun getAttendanceForStudent(studentId: String): Flow<List<AttendanceEntity>> = dao.getAttendanceForStudent(studentId)

    suspend fun getAttendanceForSessionDirect(classId: String, sessionDate: String): List<AttendanceEntity> = withContext(Dispatchers.IO) {
        val session = dao.getSession(classId, sessionDate) ?: return@withContext emptyList()
        dao.getAttendanceForSessionDirect(session.id)
    }

    suspend fun markSessionAttendance(
        classId: String,
        sessionDate: String,
        attendanceList: List<Pair<String, AttendanceStatus>>
    ) = withContext(Dispatchers.IO) {
        val targetClass = dao.getAllClassesDirect().find { it.id == classId }
        checkPermission(Permission.CLASS_MARK_ATTENDANCE, targetOrganizationId = targetClass?.organizationId, targetClassId = classId)
        try {
            val recordItems = attendanceList.map { (studentId, status) ->
                AttendanceRecordItem(studentId = studentId, status = status.name)
            }
            val resp = BeltFlowApiClient.service.recordAttendance(
                RecordAttendanceRequest(
                    classId = classId,
                    sessionDate = sessionDate,
                    records = recordItems
                )
            )
            if (resp.isSuccessful) {
                var session = dao.getSession(classId, sessionDate)
                if (session == null) {
                    session = ClassSessionEntity(
                        id = "sess_${classId}_${sessionDate.replace("-", "")}",
                        classId = classId,
                        sessionDate = sessionDate
                    )
                    dao.insertSession(session)
                }
                val entities = attendanceList.map { (studentId, status) ->
                    AttendanceEntity(
                        id = "att_${session.id}_$studentId",
                        sessionId = session.id,
                        studentId = studentId,
                        status = status,
                        sessionDate = sessionDate,
                        classId = classId
                    )
                }
                dao.insertAttendance(entities)
            } else {
                throw Exception("Backend rejected attendance recording: ${resp.errorBody()?.string() ?: "Unknown error"}")
            }
        } catch (e: Exception) {
            throw Exception("Failed to record attendance on shared backend: ${e.message}")
        }
    }

    suspend fun markAttendance(
        classId: String,
        sessionDate: String,
        records: Map<String, AttendanceStatus>
    ) = markSessionAttendance(classId, sessionDate, records.toList())

    // --- Invoices & Payments ---
    val allInvoicesWithDetails: Flow<List<InvoiceWithStudent>> = combine(
        dao.getAllInvoices(),
        dao.getAllStudents(),
        dao.getAllPayments()
    ) { invoices, students, payments ->
        val studentMap = students.associateBy { it.id }
        val paymentsByInvoice = payments.groupBy { it.invoiceId }

        invoices.map { inv ->
            val student = studentMap[inv.studentId]
            val invPayments = (paymentsByInvoice[inv.id] ?: emptyList()).map { p ->
                PaymentWithReceipt(
                    id = p.id,
                    invoiceId = p.invoiceId,
                    amount = p.amount,
                    method = p.method,
                    submittedBy = p.submittedBy,
                    approvedBy = p.approvedBy,
                    approvedAt = p.approvedAt,
                    receiptNo = p.receiptNo,
                    notes = p.notes
                )
            }
            val net = (inv.amount - inv.discount).coerceAtLeast(0.0)
            InvoiceWithStudent(
                id = inv.id,
                studentId = inv.studentId,
                studentName = student?.fullName ?: "Student",
                parentName = student?.parentName ?: "Parent",
                billingMonth = inv.billingMonth,
                amount = inv.amount,
                discount = inv.discount,
                discountReason = inv.discountReason,
                netAmount = net,
                status = inv.status,
                payments = invPayments
            )
        }
    }

    suspend fun generateMonthlyInvoices(billingMonth: String): Int = withContext(Dispatchers.IO) {
        val orgId = _currentUser.value?.organizationId ?: error("Organization context is required")
        checkPermission(Permission.CLASS_MANAGE_FEES, targetOrganizationId = orgId)
        val students = dao.getAllStudentsDirect()
        val settings = dao.getAcademySettingsDirect()
        val defaultFee = settings?.defaultMonthlyFee ?: 80.0
        val siblingDiscountPercent = settings?.siblingDiscountPercent ?: 10.0

        val parentGroups = students.groupBy {
            if (it.parentPhone.isNotBlank()) it.parentPhone.trim() else it.parentName.trim().lowercase(Locale.getDefault())
        }

        var count = 0
        val invoicesToInsert = mutableListOf<InvoiceEntity>()
        parentGroups.forEach { (_, siblingList) ->
            siblingList.forEachIndexed { index, student ->
                val invoiceId = "inv_${student.id}_${billingMonth.replace("-", "")}"
                val isSiblingDiscountEligible = index > 0
                val discountAmount = if (isSiblingDiscountEligible) (defaultFee * siblingDiscountPercent / 100.0) else 0.0
                val discountReason = if (isSiblingDiscountEligible) "Sibling Discount (${siblingDiscountPercent.toInt()}%)" else ""

                val inv = InvoiceEntity(
                    id = invoiceId,
                    studentId = student.id,
                    billingMonth = billingMonth,
                    amount = defaultFee,
                    discount = discountAmount,
                    discountReason = discountReason,
                    status = InvoiceStatus.UNPAID
                )
                invoicesToInsert.add(inv)
                count++
            }
        }
        dao.insertInvoices(invoicesToInsert)
        count
    }

    suspend fun submitCashPayment(invoiceId: String, amount: Double, submitterId: String, notes: String) = withContext(Dispatchers.IO) {
        val inv = dao.getInvoiceById(invoiceId)
        val st = inv?.studentId?.let { dao.getStudentById(it) }
        val perm = if (_currentUser.value?.role == UserRole.PARENT) Permission.PARENT_PAY_FEES else Permission.STUDENT_PAY_FEES
        checkPermissionForStudent(perm, student = st, targetStudentId = inv?.studentId)
        try {
            val resp = BeltFlowApiClient.service.submitPaymentNotice(
                SubmitPaymentRequest(
                    studentId = inv?.studentId ?: submitterId,
                    amount = amount,
                    method = "CASH",
                    proofNotes = notes
                )
            )
            if (resp.isSuccessful && resp.body() != null) {
                val p = resp.body()!!.payment
                val payment = PaymentEntity(
                    id = p.id,
                    invoiceId = invoiceId,
                    amount = p.amount,
                    method = PaymentMethod.CASH,
                    submittedBy = submitterId,
                    notes = notes
                )
                dao.insertPayment(payment)
                dao.updateInvoiceStatus(invoiceId, InvoiceStatus.PENDING_APPROVAL)
            } else {
                throw Exception("Backend rejected payment submission: ${resp.errorBody()?.string() ?: "Unknown error"}")
            }
        } catch (e: Exception) {
            throw Exception("Failed to submit payment notice to backend: ${e.message}")
        }
    }

    suspend fun recordDirectPayment(
        invoiceId: String,
        amount: Double,
        method: PaymentMethod,
        approverId: String,
        notes: String
    ) = withContext(Dispatchers.IO) {
        val inv = dao.getInvoiceById(invoiceId)
        val st = inv?.studentId?.let { dao.getStudentById(it) }
        val orgId = st?.organizationId ?: _currentUser.value?.organizationId ?: error("Organization context is required")
        checkPermissionForStudent(Permission.CLASS_RECORD_CASH_PAYMENT, student = st, targetStudentId = inv?.studentId)
        try {
            val resp = BeltFlowApiClient.service.recordCashPayment(
                RecordCashPaymentRequest(
                    organizationId = orgId,
                    studentId = inv?.studentId ?: "unknown",
                    amount = amount,
                    notes = notes
                )
            )
            if (resp.isSuccessful && resp.body() != null) {
                val p = resp.body()!!.payment
                val payment = PaymentEntity(
                    id = p.id,
                    invoiceId = invoiceId,
                    amount = p.amount,
                    method = method,
                    submittedBy = approverId,
                    approvedBy = approverId,
                    approvedAt = System.currentTimeMillis(),
                    receiptNo = p.receiptNo ?: "REC-${System.currentTimeMillis()}",
                    notes = notes
                )
                dao.insertPayment(payment)
                dao.updateInvoiceStatus(invoiceId, InvoiceStatus.PAID)
            } else {
                throw Exception("Backend rejected manual cash receipt: ${resp.errorBody()?.string() ?: "Unknown error"}")
            }
        } catch (e: Exception) {
            throw Exception("Failed to record cash payment on backend: ${e.message}")
        }
    }

    suspend fun approvePayment(paymentId: String, invoiceId: String, approverId: String) = withContext(Dispatchers.IO) {
        val inv = dao.getInvoiceById(invoiceId)
        val st = inv?.studentId?.let { dao.getStudentById(it) }
        val orgId = st?.organizationId ?: _currentUser.value?.organizationId ?: error("Organization context is required")
        checkPermissionForStudent(Permission.CLASS_APPROVE_PAYMENT, student = st, targetStudentId = inv?.studentId)
        try {
            val resp = BeltFlowApiClient.service.approvePayment(
                paymentId = paymentId,
                request = ApprovePaymentRequest(organizationId = orgId)
            )
            if (resp.isSuccessful && resp.body() != null) {
                val p = resp.body()!!.payment
                val payments = dao.getAllPayments().firstOrNull() ?: emptyList()
                val targetPayment = payments.find { it.id == paymentId }
                if (targetPayment != null) {
                    dao.updatePayment(
                        targetPayment.copy(
                            approvedBy = approverId,
                            approvedAt = System.currentTimeMillis(),
                            receiptNo = p.receiptNo ?: "REC-${System.currentTimeMillis()}"
                        )
                    )
                }
                dao.updateInvoiceStatus(invoiceId, InvoiceStatus.PAID)
            } else {
                throw Exception("Backend rejected payment approval: ${resp.errorBody()?.string() ?: "Unknown error"}")
            }
        } catch (e: Exception) {
            throw Exception("Failed to approve payment on shared backend: ${e.message}")
        }
    }

    suspend fun updateInvoiceStatus(invoiceId: String, status: InvoiceStatus) = withContext(Dispatchers.IO) {
        dao.updateInvoiceStatus(invoiceId, status)
    }

    suspend fun submitPayment(invoiceId: String, amount: Double, method: PaymentMethod, notes: String) =
        recordDirectPayment(invoiceId, amount, method, _currentUser.value?.id ?: "staff", notes)

    // --- Grading ---
    val allGradingEventsWithRecords: Flow<List<GradingEventWithRecords>> = combine(
        dao.getAllGradingEvents(),
        dao.getAllStudents()
    ) { events, _ ->
        events.map { ev ->
            val recordsFlow = dao.getGradingRecordsForEvent(ev.id)
            val records = recordsFlow.firstOrNull() ?: emptyList()
            val passes = records.count { it.result == GradingResultType.PASS || it.result == GradingResultType.DOUBLE_PROMOTION }
            GradingEventWithRecords(
                id = ev.id,
                name = ev.name,
                eventDate = ev.eventDate,
                location = ev.location,
                examiner = ev.examiner,
                fee = ev.fee,
                isCompleted = ev.isCompleted,
                candidateCount = records.size,
                passCount = passes
            )
        }
    }

    suspend fun createGradingEvent(name: String, eventDate: String, location: String, examiner: String, fee: Double) = withContext(Dispatchers.IO) {
        val orgId = _currentUser.value?.organizationId ?: error("Organization context is required")
        checkPermission(Permission.PERSATUAN_MANAGE_GRADING_EVENTS, targetOrganizationId = orgId)
        try {
            val resp = BeltFlowApiClient.service.createGradingEvent(
                CreateGradingRequest(
                    organizationId = orgId,
                    eventName = name,
                    gradingDate = eventDate,
                    location = location,
                    eligibleRanks = null,
                    examiners = listOf(examiner)
                )
            )
            if (resp.isSuccessful && resp.body() != null) {
                val ev = resp.body()!!.gradingEvent
                dao.insertGradingEvent(
                    GradingEventEntity(
                        id = ev.id,
                        organizationId = ev.organizationId,
                        name = ev.eventName,
                        eventDate = ev.gradingDate,
                        location = ev.location,
                        examiner = examiner,
                        fee = fee
                    )
                )
            } else {
                throw Exception("Backend rejected grading event creation: ${resp.errorBody()?.string() ?: "Unknown error"}")
            }
        } catch (e: Exception) {
            throw Exception("Failed to create grading event on backend: ${e.message}")
        }
    }

    suspend fun addGradingEvent(name: String, eventDate: String, location: String, examiner: String, fee: Double) =
        createGradingEvent(name, eventDate, location, examiner, fee)

    fun getGradingCandidates(eventId: String): Flow<List<GradingCandidateDetail>> = combine(
        dao.getGradingRecordsForEvent(eventId),
        dao.getAllStudents(),
        dao.getAllBelts()
    ) { records, students, belts ->
        val studentsMap = students.associateBy { it.id }
        val beltsMap = belts.associateBy { it.id }
        records.map { r ->
            val st = studentsMap[r.studentId]
            GradingCandidateDetail(
                recordId = r.id,
                eventId = r.gradingEventId,
                studentId = r.studentId,
                studentName = st?.fullName ?: "Student",
                fromBeltName = r.fromBeltId?.let { beltsMap[it]?.name } ?: "Current Belt",
                toBeltName = r.toBeltId?.let { beltsMap[it]?.name } ?: "Target Belt",
                fromBeltColorHex = r.fromBeltId?.let { beltsMap[it]?.colorHex } ?: "#94A3B8",
                toBeltColorHex = r.toBeltId?.let { beltsMap[it]?.colorHex } ?: "#3B82F6",
                toBeltId = r.toBeltId,
                result = r.result,
                notes = r.notes
            )
        }
    }

    suspend fun registerForGrading(
        eventId: String,
        studentId: String,
        fromBeltId: String?,
        toBeltId: String?
    ) = withContext(Dispatchers.IO) {
        val student = dao.getStudentById(studentId)
        val perm = when (_currentUser.value?.role) {
            UserRole.PARENT -> Permission.PARENT_REGISTER_CHILD_GRADING
            UserRole.MASTER -> Permission.CLASS_REGISTER_GRADING
            else -> Permission.STUDENT_REGISTER_GRADING
        }
        checkPermissionForStudent(perm, student = student, targetStudentId = studentId)
        val record = GradingRecordEntity(
            id = "grec_${eventId}_${studentId}",
            gradingEventId = eventId,
            studentId = studentId,
            fromBeltId = fromBeltId,
            toBeltId = toBeltId,
            result = GradingResultType.REGISTERED
        )
        dao.insertGradingRecord(record)
    }

    suspend fun recordGradingResult(
        recordId: String,
        eventId: String,
        studentId: String,
        toBeltId: String?,
        result: GradingResultType,
        notes: String
    ) = withContext(Dispatchers.IO) {
        val student = dao.getStudentById(studentId)
        checkPermissionForStudent(Permission.CLASS_SCORE_GRADING, student = student, targetStudentId = studentId)
        try {
            val isPass = result == GradingResultType.PASS || result == GradingResultType.DOUBLE_PROMOTION
            val resp = BeltFlowApiClient.service.scoreGradingCandidate(
                id = eventId,
                request = ScoreGradingRequest(
                    candidateId = studentId,
                    examinerScore = if (isPass) 85.0 else 55.0,
                    feedback = notes,
                    result = if (isPass) "PASS" else "FAIL",
                    targetRank = toBeltId ?: "Next Rank",
                    certIssued = isPass
                )
            )
            if (resp.isSuccessful) {
                val existing = dao.getGradingRecordById(recordId)
                val record = GradingRecordEntity(
                    id = recordId,
                    gradingEventId = eventId,
                    studentId = studentId,
                    fromBeltId = existing?.fromBeltId,
                    toBeltId = toBeltId ?: existing?.toBeltId,
                    result = result,
                    notes = notes,
                    gradedAt = System.currentTimeMillis()
                )
                dao.updateGradingRecord(record)
                if (isPass && toBeltId != null) {
                    dao.updateStudentBelt(studentId, toBeltId)
                }
            } else {
                throw Exception("Backend rejected grading scoring: ${resp.errorBody()?.string() ?: "Unknown error"}")
            }
        } catch (e: Exception) {
            throw Exception("Failed to score grading candidate on backend: ${e.message}")
        }
    }

    // --- Skills & Progress ---
    val allSkills: Flow<List<SkillEntity>> = dao.getAllSkills()

    fun getStudentSkillProgress(studentId: String): Flow<List<StudentSkillProgress>> {
        return combine(
            dao.getAllSkills(),
            dao.getSkillsForStudent(studentId)
        ) { skills, studentSkills ->
            val map = studentSkills.associateBy { it.skillId }
            skills.map { skill ->
                val level = map[skill.id]?.level ?: SkillLevel.NOT_STARTED
                StudentSkillProgress(
                    skillId = skill.id,
                    skillName = skill.name,
                    category = skill.category,
                    level = level,
                    percentage = level.percentage
                )
            }
        }
    }

    fun getStudentSkillsProgress(studentId: String): Flow<List<StudentSkillProgress>> = getStudentSkillProgress(studentId)

    suspend fun setSkillLevel(
        studentId: String,
        skillId: String,
        level: SkillLevel,
        notes: String = ""
    ) = withContext(Dispatchers.IO) {
        val student = dao.getStudentById(studentId)
        checkPermissionForStudent(Permission.CLASS_MANAGE_SKILL_PROGRESS, student = student, targetStudentId = studentId)
        try {
            val resp = BeltFlowApiClient.service.updateSkillProgress(
                SkillProgressRequest(
                    studentId = studentId,
                    skillId = skillId,
                    skillName = skillId,
                    status = level.name,
                    verifiedBy = _currentUser.value?.fullName ?: "Instructor"
                )
            )
            if (resp.isSuccessful) {
                val entity = StudentSkillEntity(
                    id = "sskill_${studentId}_$skillId",
                    studentId = studentId,
                    skillId = skillId,
                    level = level,
                    notes = notes,
                    updatedAt = System.currentTimeMillis()
                )
                dao.setStudentSkillLevel(entity)
            } else {
                throw Exception("Backend rejected skill progress update: ${resp.errorBody()?.string() ?: "Unknown error"}")
            }
        } catch (e: Exception) {
            throw Exception("Failed to update skill progress on backend: ${e.message}")
        }
    }

    suspend fun setStudentSkillLevel(studentId: String, skillId: String, level: SkillLevel) =
        setSkillLevel(studentId, skillId, level)

    suspend fun addSkill(
        name: String,
        category: String,
        description: String,
        sortOrder: Int
    ) = withContext(Dispatchers.IO) {
        val orgId = _currentUser.value?.organizationId ?: error("Organization context is required")
        checkPermission(Permission.PERSATUAN_MANAGE_CURRICULUM, targetOrganizationId = orgId)
        dao.insertSkill(
            SkillEntity(
                id = "sk_${UUID.randomUUID().toString().take(8)}",
                name = name,
                category = category,
                description = description,
                sortOrder = sortOrder
            )
        )
    }

    // --- Instructor Notes ---
    fun getNotesForStudent(studentId: String): Flow<List<InstructorNoteEntity>> = dao.getNotesForStudent(studentId)

    suspend fun addInstructorNote(
        studentId: String,
        authorName: String,
        body: String,
        visibility: NoteVisibility
    ) = withContext(Dispatchers.IO) {
        val student = dao.getStudentById(studentId)
        checkPermissionForStudent(Permission.CLASS_MANAGE_SKILL_PROGRESS, student = student, targetStudentId = studentId)
        dao.insertNote(
            InstructorNoteEntity(
                id = "note_${UUID.randomUUID().toString().take(8)}",
                studentId = studentId,
                authorName = authorName,
                body = body,
                visibility = visibility
            )
        )
    }

    // --- Tournaments ---
    val allTournaments: Flow<List<TournamentDetail>> = combine(
        dao.getAllTournaments(),
        dao.getAllTournamentResults(),
        dao.getAllStudents()
    ) { tournaments, results, students ->
        val studentNames = students.associate { it.id to it.fullName }
        val resultsByTournament = results.groupBy { it.tournamentId }
        tournaments.map { t ->
            TournamentDetail(
                id = t.id,
                name = t.name,
                eventDate = t.eventDate,
                location = t.location,
                organizer = t.organizer,
                results = (resultsByTournament[t.id] ?: emptyList()).map { r ->
                    TournamentResultDetail(
                        id = r.id,
                        tournamentId = r.tournamentId,
                        studentId = r.studentId,
                        studentName = studentNames[r.studentId] ?: "Unknown Student",
                        eventCategory = r.eventCategory,
                        medal = r.medal,
                        points = r.points,
                        notes = r.notes
                    )
                }
            )
        }
    }

    fun getTournamentResults(tournamentId: String): Flow<List<TournamentResultEntity>> =
        dao.getResultsForTournament(tournamentId)

    suspend fun createTournament(name: String, eventDate: String, location: String, categories: String) = withContext(Dispatchers.IO) {
        val orgId = _currentUser.value?.organizationId ?: error("Organization context is required")
        checkPermission(Permission.PERSATUAN_MANAGE_TOURNAMENTS, targetOrganizationId = orgId)
        try {
            val catList = categories.split(",").map { it.trim() }.filter { it.isNotBlank() }
            val resp = BeltFlowApiClient.service.createTournament(
                CreateTournamentRequest(
                    organizationId = orgId,
                    name = name,
                    tournamentDate = eventDate,
                    location = location,
                    categories = catList,
                    description = "Tournament"
                )
            )
            if (resp.isSuccessful && resp.body() != null) {
                val t = resp.body()!!.tournament
                dao.insertTournament(
                    TournamentEntity(
                        id = t.id,
                        organizationId = t.organizationId,
                        name = t.name,
                        eventDate = t.tournamentDate,
                        location = t.location,
                        categoriesJson = JSONArray(catList).toString()
                    )
                )
            } else {
                throw Exception("Backend rejected tournament creation: ${resp.errorBody()?.string() ?: "Unknown error"}")
            }
        } catch (e: Exception) {
            throw Exception("Failed to create tournament on backend: ${e.message}")
        }
    }

    suspend fun addTournament(name: String, eventDate: String, location: String, categories: String) =
        createTournament(name, eventDate, location, categories)

    suspend fun recordTournamentResult(
        tournamentId: String,
        studentId: String,
        eventCategory: String,
        medal: Medal,
        notes: String
    ) = withContext(Dispatchers.IO) {
        val student = dao.getStudentById(studentId)
        checkPermissionForStudent(Permission.CLASS_SCORE_TOURNAMENT, student = student, targetStudentId = studentId)
        try {
            val resp = BeltFlowApiClient.service.finalizeTournamentResults(
                id = tournamentId,
                request = TournamentResultsRequest(
                    results = listOf(
                        TournamentParticipantResult(
                            studentId = studentId,
                            studentName = student?.fullName ?: "Participant",
                            category = eventCategory,
                            medal = medal.name,
                            notes = notes
                        )
                    )
                )
            )
            if (resp.isSuccessful) {
                dao.insertTournamentResult(
                    TournamentResultEntity(
                        id = "tres_${UUID.randomUUID().toString().take(8)}",
                        tournamentId = tournamentId,
                        studentId = studentId,
                        eventCategory = eventCategory,
                        medal = medal,
                        points = medal.points,
                        notes = notes
                    )
                )
            } else {
                throw Exception("Backend rejected tournament results finalization: ${resp.errorBody()?.string() ?: "Unknown error"}")
            }
        } catch (e: Exception) {
            throw Exception("Failed to finalize tournament results on backend: ${e.message}")
        }
    }

    // --- Certificates ---
    val allCertificatesWithDetails: Flow<List<CertificateDetail>> = combine(
        dao.getAllCertificates(),
        dao.getAllStudents()
    ) { certificates, students ->
        val studentsMap = students.associateBy { it.id }
        certificates.filter { !it.isRevoked }.map { cert ->
            CertificateDetail(
                id = cert.id,
                studentId = cert.studentId,
                studentName = studentsMap[cert.studentId]?.fullName ?: "Student",
                type = cert.type,
                title = cert.title,
                certNo = cert.certNo,
                verifyCode = cert.verifyCode,
                issuedAt = cert.issuedAt,
                issuedBy = cert.issuedBy,
                academyName = "Persatuan Silambam Daerah Sepang"
            )
        }
    }

    fun getCertificatesForStudent(studentId: String): Flow<List<CertificateDetail>> {
        return allCertificatesWithDetails.map { list -> list.filter { it.studentId == studentId } }
    }

    suspend fun createCertificate(
        studentId: String,
        type: CertType,
        title: String,
        issuedBy: String
    ) = withContext(Dispatchers.IO) {
        val student = dao.getStudentById(studentId)
        val orgId = student?.organizationId ?: _currentUser.value?.organizationId ?: error("Organization context is required")
        checkPermission(Permission.CERTIFICATE_CREATE, targetOrganizationId = orgId, targetStudentId = studentId)
        val certNo = "PSMDS-${type.name.take(3)}-${SimpleDateFormat("yyyy", Locale.getDefault()).format(Date())}-${UUID.randomUUID().toString().take(4).uppercase(Locale.getDefault())}"
        val verifyCode = "BF-${type.name.take(3)}-${UUID.randomUUID().toString().take(6).uppercase(Locale.getDefault())}"
        val cert = CertificateEntity(
            id = "cert_${UUID.randomUUID().toString().take(8)}",
            organizationId = orgId,
            studentId = studentId,
            type = type,
            title = title,
            certNo = certNo,
            verifyCode = verifyCode,
            issuedAt = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date()),
            issuedBy = issuedBy,
            isRevoked = false
        )
        dao.insertCertificate(cert)
        logAction(
            actorId = _currentUser.value?.id ?: "staff",
            actorName = _currentUser.value?.fullName ?: "Staff",
            actorRole = _currentUser.value?.role ?: UserRole.MASTER,
            action = "CREATE_CERTIFICATE",
            targetEntity = "Certificate",
            targetId = cert.id,
            newVal = cert.title
        )
    }

    suspend fun revokeCertificate(certificateId: String) = withContext(Dispatchers.IO) {
        val cert = dao.getCertificateById(certificateId) ?: return@withContext
        checkPermission(Permission.CERTIFICATE_REVOKE, targetOrganizationId = cert.organizationId, targetStudentId = cert.studentId)
        dao.updateCertificate(cert.copy(isRevoked = true))
        logAction(
            actorId = _currentUser.value?.id ?: "staff",
            actorName = _currentUser.value?.fullName ?: "Staff",
            actorRole = _currentUser.value?.role ?: UserRole.MASTER,
            action = "REVOKE_CERTIFICATE",
            targetEntity = "Certificate",
            targetId = certificateId,
            newVal = "REVOKED"
        )
    }

    suspend fun deleteCertificate(certificateId: String) = withContext(Dispatchers.IO) {
        val cert = dao.getCertificateById(certificateId) ?: return@withContext
        checkPermission(Permission.CERTIFICATE_DELETE, targetOrganizationId = cert.organizationId, targetStudentId = cert.studentId)
        dao.deleteCertificate(cert)
        logAction(
            actorId = _currentUser.value?.id ?: "staff",
            actorName = _currentUser.value?.fullName ?: "Staff",
            actorRole = _currentUser.value?.role ?: UserRole.ADMIN_PERSATUAN,
            action = "DELETE_CERTIFICATE",
            targetEntity = "Certificate",
            targetId = certificateId
        )
    }

    suspend fun verifyCertificate(code: String): CertificateDetail? = withContext(Dispatchers.IO) {
        checkPermission(Permission.CERTIFICATE_VIEW)
        try {
            val cleanCode = code.trim().uppercase(Locale.getDefault())
            val resp = BeltFlowApiClient.service.verifyCertificate(VerifyCertificateRequest(cleanCode))
            if (resp.isSuccessful && resp.body()?.verified == true && resp.body()?.certificate != null) {
                val cert = resp.body()!!.certificate!!
                CertificateDetail(
                    id = cert.code,
                    studentId = cert.studentName,
                    studentName = cert.studentName,
                    type = CertType.GRADING,
                    title = cert.rankOrTitle,
                    certNo = cert.code,
                    verifyCode = cert.code,
                    issuedAt = cert.issueDate,
                    issuedBy = cert.masterName,
                    academyName = cert.organizationName
                )
            } else {
                null
            }
        } catch (e: Exception) {
            null
        }
    }

    suspend fun deactivateAccount(userId: String): Result<Unit> = withContext(Dispatchers.IO) {
        val profile = dao.getProfileById(userId) ?: return@withContext Result.failure(Exception("Profile not found"))
        if (profile.role == UserRole.STUDENT) {
            return@withContext Result.failure(Exception("Students cannot self-deactivate their account. Please contact Persatuan Admin."))
        }
        dao.updateProfileStatus(userId, ProfileStatus.DISABLED)
        logAction(
            actorId = userId,
            actorName = profile.fullName,
            actorRole = profile.role,
            action = "DEACTIVATE_ACCOUNT",
            targetEntity = "Profile",
            targetId = userId,
            newVal = ProfileStatus.DISABLED.name
        )
        if (_currentUser.value?.id == userId) {
            logout()
        }
        Result.success(Unit)
    }

    private fun parseClassIds(json: String): List<String> = ClassMembership.parseClassIds(json)

    private fun calculateAge(dob: String): Int {
        if (dob.isBlank()) return 0
        return try {
            val sdf = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
            val birthDate = sdf.parse(dob) ?: return 0
            val dobCal = Calendar.getInstance().apply { time = birthDate }
            val today = Calendar.getInstance()
            var age = today.get(Calendar.YEAR) - dobCal.get(Calendar.YEAR)
            if (today.get(Calendar.DAY_OF_YEAR) < dobCal.get(Calendar.DAY_OF_YEAR)) {
                age--
            }
            if (age < 0) 0 else age
        } catch (e: Exception) {
            0
        }
    }

    suspend fun exportAcademyDataJson(): String = withContext(Dispatchers.IO) {
        val json = org.json.JSONObject()
        val students = dao.getAllStudentsDirect()
        val belts = dao.getAllBeltsDirect()
        val classes = dao.getAllClassesDirect()

        val studentsArray = org.json.JSONArray()
        for (s in students) {
            val obj = org.json.JSONObject().apply {
                put("id", s.id)
                put("fullName", s.fullName)
                put("icOrMykid", s.icOrMykid)
                put("dateOfBirth", s.dateOfBirth)
                put("gender", s.gender)
                put("beltId", s.beltId)
                put("lifecycle", s.lifecycle.name)
                put("parentName", s.parentName)
                put("parentPhone", s.parentPhone)
            }
            studentsArray.put(obj)
        }
        json.put("exportedAt", System.currentTimeMillis())
        json.put("studentsCount", students.size)
        json.put("students", studentsArray)
        json.put("beltsCount", belts.size)
        json.put("classesCount", classes.size)
        json.toString(2)
    }
}

