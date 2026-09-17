package com.example.beltflow.ui.viewmodels

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.example.beltflow.data.local.*
import com.example.beltflow.data.model.*
import com.example.beltflow.data.rbac.AuthContext
import com.example.beltflow.data.rbac.AuthorizationManager
import com.example.beltflow.data.rbac.Permission
import com.example.beltflow.data.repository.BeltFlowRepository
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

data class SuperAdminDashboardUiState(
    val totalPersatuans: Int = 0,
    val activePersatuans: Int = 0,
    val totalMonthlySubscriptionRevenue: Double = 0.0,
    val activeSubscriptionsCount: Int = 0,
    val unpaidSubscriptionsCount: Int = 0,
    val overdueSubscriptionsCount: Int = 0
)

data class AdminDashboardUiState(
    val totalStudents: Int = 0,
    val activeStudents: Int = 0,
    val atRiskStudents: Int = 0,
    val monthlyRevenue: Double = 0.0,
    val platformChargesPaid: Double = 0.0,
    val netPersatuanBalance: Double = 0.0,
    val pendingInvoicesCount: Int = 0,
    val pendingApprovalsCount: Int = 0,
    val upcomingGradingCount: Int = 0
)

data class MasterDashboardUiState(
    val assignedClassesCount: Int = 0,
    val totalTraineesCount: Int = 0,
    val todaySessionsCount: Int = 0,
    val atRiskTraineesCount: Int = 0,
    val gradingCandidatesCount: Int = 0
)

class BeltFlowViewModel(private val repository: BeltFlowRepository) : ViewModel() {

    val currentUser = repository.currentUser

    val allProfiles = repository.allProfiles.stateIn(
        viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList()
    )

    val academySettings = repository.academySettings.stateIn(
        viewModelScope, SharingStarted.WhileSubscribed(5000), null
    )

    val allPersatuans = repository.allPersatuans.stateIn(
        viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList()
    )

    val allBelts = repository.allBelts.stateIn(
        viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList()
    )

    val allBranches = repository.allBranches.stateIn(
        viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList()
    )

    val allClasses = repository.allClasses.stateIn(
        viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList()
    )

    val allStudents = repository.studentsWithDetails.stateIn(
        viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList()
    )

    val allInvoices = repository.allInvoicesWithDetails.stateIn(
        viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList()
    )

    val allGradingEvents = repository.allGradingEventsWithRecords.stateIn(
        viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList()
    )

    val allSkills = repository.allSkills.stateIn(
        viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList()
    )

    val allTournaments = repository.allTournaments.stateIn(
        viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList()
    )

    val allCertificates = repository.allCertificatesWithDetails.stateIn(
        viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList()
    )

    val allAuditLogs = repository.allAuditLogs.stateIn(
        viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList()
    )

    val allAnnouncements = repository.allAnnouncements.stateIn(
        viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList()
    )

    val allParentChildLinks = repository.allParentChildLinks.stateIn(
        viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList()
    )

    val allClassMasterCrossRefs = repository.allClassMasterCrossRefs.stateIn(
        viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList()
    )

    val allClassTransfers = repository.allClassTransfers.stateIn(
        viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList()
    )

    val allClassWorkflowRequests = repository.allClassWorkflowRequests.stateIn(
        viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList()
    )

    val allMessages = repository.allMessages.stateIn(
        viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList()
    )

    // Current User Auth Context for RBAC Evaluation with accurate class and parent relationships
    val authContext: StateFlow<AuthContext?> = combine(
        currentUser,
        allClassMasterCrossRefs,
        allParentChildLinks,
        allStudents
    ) { user, crossRefs, links, students ->
        if (user == null) return@combine null

        val assignedClasses = if (user.role == UserRole.MASTER) {
            crossRefs.filter { it.masterProfileId == user.id }.map { it.classId }
        } else {
            emptyList()
        }

        val mainMasterMap = if (user.role == UserRole.MASTER) {
            crossRefs.filter { it.masterProfileId == user.id }.associate { it.classId to it.isMainMaster }
        } else {
            emptyMap()
        }

        val linkedStudents = when (user.role) {
            UserRole.STUDENT -> listOfNotNull(user.studentId ?: students.find { it.profileId == user.id }?.id)
            UserRole.PARENT -> links.filter { it.parentProfileId == user.id && it.status == LinkApprovalStatus.APPROVED }.map { it.studentId }
            else -> emptyList()
        }

        AuthContext(
            userId = user.id,
            role = user.role,
            organizationId = user.organizationId,
            assignedClassIds = assignedClasses,
            isMainMasterMap = mainMasterMap,
            linkedStudentIds = linkedStudents
        )
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), null)

    // Helper to evaluate permissions
    fun checkPermission(permission: Permission, targetOrgId: String? = null, targetClassId: String? = null, targetStudentId: String? = null): Boolean {
        return AuthorizationManager.authorize(
            context = authContext.value,
            permission = permission,
            targetOrganizationId = targetOrgId,
            targetClassId = targetClassId,
            targetStudentId = targetStudentId
        ).isAllowed
    }

    // --- Super Admin Dashboard UI State (Strictly platform-level) ---
    val superAdminDashboardStats: StateFlow<SuperAdminDashboardUiState> = allPersatuans.map { persatuans ->
        val active = persatuans.count { it.status == ProfileStatus.APPROVED }
        val subRev = persatuans.sumOf { it.monthlyFee }
        val activeSubs = persatuans.count { it.subscriptionStatus == SubscriptionStatus.ACTIVE }
        val unpaidSubs = persatuans.count { it.subscriptionStatus == SubscriptionStatus.UNPAID }
        val overdueSubs = persatuans.count { it.subscriptionStatus == SubscriptionStatus.OVERDUE }

        SuperAdminDashboardUiState(
            totalPersatuans = persatuans.size,
            activePersatuans = active,
            totalMonthlySubscriptionRevenue = subRev,
            activeSubscriptionsCount = activeSubs,
            unpaidSubscriptionsCount = unpaidSubs,
            overdueSubscriptionsCount = overdueSubs
        )
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), SuperAdminDashboardUiState())

    // --- Admin Persatuan Dashboard UI State ---
    val adminDashboardStats: StateFlow<AdminDashboardUiState> = combine(
        allStudents,
        allInvoices,
        allProfiles,
        allGradingEvents
    ) { students, invoices, profiles, gradings ->
        val currentMonth = SimpleDateFormat("yyyy-MM", Locale.getDefault()).format(Date())
        val active = students.count { it.lifecycle == Lifecycle.ACTIVE }
        val atRisk = students.count { it.isAtRisk }
        val curMonthInvoices = invoices.filter { it.billingMonth == currentMonth }
        val revenue = curMonthInvoices.filter { it.status == InvoiceStatus.PAID }.sumOf { it.netAmount }
        val platformCharge = revenue * 0.08
        val netBalance = revenue - platformCharge
        val pendingInvoices = curMonthInvoices.count { it.status == InvoiceStatus.UNPAID || it.status == InvoiceStatus.PENDING_APPROVAL || it.status == InvoiceStatus.OVERDUE }
        val pendingProfiles = profiles.count { it.status == ProfileStatus.PENDING }
        val upcomingGradings = gradings.count { !it.isCompleted }

        AdminDashboardUiState(
            totalStudents = students.size,
            activeStudents = active,
            atRiskStudents = atRisk,
            monthlyRevenue = revenue,
            platformChargesPaid = platformCharge,
            netPersatuanBalance = netBalance,
            pendingInvoicesCount = pendingInvoices,
            pendingApprovalsCount = pendingProfiles,
            upcomingGradingCount = upcomingGradings
        )
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), AdminDashboardUiState())

    // --- Master Dashboard UI State ---
    val masterDashboardStats: StateFlow<MasterDashboardUiState> = combine(
        allClasses,
        allStudents,
        authContext
    ) { classes, students, context ->
        val assignedIds = context?.assignedClassIds ?: emptyList()
        val masterClasses = if (assignedIds.isNotEmpty()) classes.filter { assignedIds.contains(it.id) } else classes
        val masterStudents = if (assignedIds.isNotEmpty()) students.filter { st -> st.classIds.any { assignedIds.contains(it) } } else students
        val atRisk = masterStudents.count { it.isAtRisk }

        MasterDashboardUiState(
            assignedClassesCount = masterClasses.size,
            totalTraineesCount = masterStudents.size,
            todaySessionsCount = masterClasses.size,
            atRiskTraineesCount = atRisk,
            gradingCandidatesCount = 8
        )
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), MasterDashboardUiState())

    // --- Auth Actions ---
    fun login(email: String, password: String, onComplete: (Result<AuthUser>) -> Unit) {
        viewModelScope.launch {
            val res = repository.login(email, password)
            onComplete(res)
        }
    }

    fun registerUser(
        fullName: String,
        email: String,
        phone: String,
        role: UserRole,
        organizationId: String,
        childName: String,
        assignedClass: String,
        password: String,
        onComplete: (Result<Unit>) -> Unit
    ) {
        viewModelScope.launch {
            val res = repository.registerUser(
                fullName = fullName,
                email = email,
                phone = phone,
                role = role,
                organizationId = organizationId,
                childName = childName,
                assignedClass = assignedClass,
                password = password
            )
            onComplete(res)
        }
    }



    fun logout() {
        repository.logout()
    }

    // --- Persatuan Management ---
    fun createPersatuan(
        name: String,
        adminEmail: String,
        adminFullName: String,
        adminPassword: String,
        plan: SubscriptionPlan,
        chargePercent: Double
    ) {
        if (!AuthorizationManager.authorize(authContext.value, Permission.PLATFORM_MANAGE_PERSATUAN).isAllowed) return
        viewModelScope.launch {
            repository.createPersatuan(name, adminEmail, adminFullName, adminPassword, plan, chargePercent)
        }
    }

    // --- Approval Actions ---
    fun approveProfile(profileId: String) {
        viewModelScope.launch {
            repository.updateProfileStatus(profileId, ProfileStatus.APPROVED)
        }
    }

    fun rejectProfile(profileId: String) {
        viewModelScope.launch {
            repository.updateProfileStatus(profileId, ProfileStatus.REJECTED)
        }
    }

    // --- Master Class Instructor Management (Main Master Controls) ---

    fun addMasterToClass(classId: String, masterProfileId: String, isMainMaster: Boolean = false) {
        viewModelScope.launch {
            repository.addMasterToClass(classId, masterProfileId, isMainMaster)
        }
    }

    fun removeMasterFromClass(classId: String, masterProfileId: String) {
        viewModelScope.launch {
            repository.removeMasterFromClass(classId, masterProfileId)
        }
    }

    fun setMainMasterForClass(classId: String, newMainMasterId: String) {
        viewModelScope.launch {
            repository.setMainMasterForClass(classId, newMainMasterId)
        }
    }

    // --- Parent Child Links ---
    fun requestParentChildLink(studentId: String) {
        val parentId = currentUser.value?.id ?: return
        viewModelScope.launch {
            repository.requestParentChildLink(parentId, studentId)
        }
    }

    fun approveParentChildLinkStep(linkId: String) {
        val role = currentUser.value?.role ?: return
        viewModelScope.launch {
            repository.approveParentChildLinkStep(linkId, role)
        }
    }

    fun rejectParentChildLink(linkId: String) {
        viewModelScope.launch {
            repository.rejectParentChildLink(linkId)
        }
    }

    // --- Class Transfers ---

    fun requestClassTransfer(studentId: String, oldClassId: String, newClassId: String) {
        viewModelScope.launch {
            repository.requestClassTransfer(studentId, oldClassId, newClassId)
        }
    }

    fun approveClassTransferStep(transferId: String, isNewMaster: Boolean) {
        viewModelScope.launch {
            repository.approveClassTransferStep(transferId, isNewMaster)
        }
    }

    fun rejectClassTransfer(transferId: String) {
        viewModelScope.launch {
            repository.rejectClassTransfer(transferId)
        }
    }

    // --- Class Actions ---
    fun addClass(
        branchId: String?,
        name: String,
        code: String,
        dayOfWeek: Int,
        startTime: String,
        endTime: String,
        monthlyFee: Double,
        coachName: String
    ) {
        if (!AuthorizationManager.authorize(authContext.value, Permission.PERSATUAN_MANAGE_CLASSES).isAllowed) return
        viewModelScope.launch {
            repository.addClass(branchId, name, code, dayOfWeek, startTime, endTime, monthlyFee, coachName)
        }
    }

    fun addClass(classEntity: ClassEntity) {
        viewModelScope.launch {
            repository.addClass(classEntity)
        }
    }

    fun deleteClass(classEntity: ClassEntity) {
        viewModelScope.launch {
            repository.deleteClass(classEntity)
        }
    }

    // --- Settings & Belts & Branches ---
    fun saveAcademySettings(settings: AcademySettingsEntity, onDone: () -> Unit = {}) {
        viewModelScope.launch {
            repository.saveAcademySettings(settings)
            onDone()
        }
    }

    fun addBelt(name: String, colorHex: String, sortOrder: Int) {
        viewModelScope.launch {
            repository.addBelt(name, colorHex, sortOrder)
        }
    }

    fun deleteBelt(belt: BeltEntity) {
        viewModelScope.launch {
            repository.deleteBelt(belt)
        }
    }

    fun addBranch(name: String, address: String, phone: String) {
        viewModelScope.launch {
            repository.addBranch(name, address, phone)
        }
    }

    fun deleteBranch(branch: BranchEntity) {
        viewModelScope.launch {
            repository.deleteBranch(branch)
        }
    }

    // --- Student Actions ---
    fun addStudent(
        fullName: String,
        icOrMykid: String,
        dateOfBirth: String,
        gender: String,
        beltId: String?,
        parentName: String,
        parentPhone: String,
        medicalNotes: String,
        classIds: List<String>
    ) {
        if (!AuthorizationManager.authorize(authContext.value, Permission.PERSATUAN_MANAGE_STUDENTS).isAllowed) return
        viewModelScope.launch {
            repository.addStudent(fullName, icOrMykid, dateOfBirth, gender, beltId, parentName, parentPhone, medicalNotes, classIds)
        }
    }

    fun registerStudent(
        fullName: String,
        icOrMykid: String,
        dateOfBirth: String,
        gender: String,
        beltId: String?,
        parentName: String,
        parentPhone: String,
        medicalNotes: String,
        classIds: List<String>,
        onDone: () -> Unit = {}
    ) {
        viewModelScope.launch {
            repository.registerStudent(fullName, icOrMykid, dateOfBirth, gender, beltId, parentName, parentPhone, medicalNotes, classIds)
            onDone()
        }
    }

    fun updateStudent(
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
        classIds: List<String>,
        onDone: () -> Unit = {}
    ) {
        viewModelScope.launch {
            repository.updateStudent(id, fullName, icOrMykid, dateOfBirth, gender, beltId, lifecycle, parentName, parentPhone, medicalNotes, classIds)
            onDone()
        }
    }

    fun deleteStudent(studentId: String) {
        viewModelScope.launch {
            repository.deleteStudent(studentId)
        }
    }

    fun getStudentDetails(studentId: String) = repository.getStudentDetails(studentId)
    fun getStudentAttendance(studentId: String) = repository.getAttendanceForStudent(studentId)
    fun getStudentSkills(studentId: String) = repository.getStudentSkillProgress(studentId)
    fun getStudentNotes(studentId: String) = repository.getNotesForStudent(studentId)
    fun getStudentCertificates(studentId: String) = repository.getCertificatesForStudent(studentId)

    // --- Attendance Actions ---
    fun markAttendance(
        classId: String,
        sessionDate: String,
        records: Map<String, AttendanceStatus>,
        onDone: () -> Unit = {}
    ) {
        viewModelScope.launch {
            repository.markAttendance(classId, sessionDate, records)
            onDone()
        }
    }

    fun markSessionAttendance(
        classId: String,
        sessionDate: String,
        attendanceList: List<Pair<String, AttendanceStatus>>
    ) {
        if (!AuthorizationManager.authorize(authContext.value, Permission.CLASS_MARK_ATTENDANCE).isAllowed) return
        viewModelScope.launch {
            repository.markSessionAttendance(classId, sessionDate, attendanceList)
        }
    }

    suspend fun getSessionAttendance(classId: String, sessionDate: String): List<AttendanceEntity> {
        return repository.getAttendanceForSessionDirect(classId, sessionDate)
    }

    // --- Invoice & Payment Actions ---
    fun generateInvoices(billingMonth: String, onDone: (Int) -> Unit = {}) {
        viewModelScope.launch {
            val count = repository.generateMonthlyInvoices(billingMonth)
            onDone(count)
        }
    }

    fun generateMonthlyInvoices(billingMonth: String, onDone: (Int) -> Unit = {}) {
        generateInvoices(billingMonth, onDone)
    }

    fun submitPayment(invoiceId: String, amount: Double, method: PaymentMethod, notes: String) {
        viewModelScope.launch {
            repository.submitPayment(invoiceId, amount, method, notes)
        }
    }

    fun submitCashPayment(invoiceId: String, amount: Double, notes: String, onDone: () -> Unit = {}) {
        viewModelScope.launch {
            val user = currentUser.value
            val submitterId = user?.fullName ?: "Parent / Guardian"
            repository.submitCashPayment(invoiceId, amount, submitterId, notes)
            onDone()
        }
    }


    fun approvePayment(paymentId: String, invoiceId: String) {
        viewModelScope.launch {
            val user = currentUser.value
            val approverId = user?.fullName ?: "Master / Admin"
            repository.approvePayment(paymentId, invoiceId, approverId)
        }
    }

    fun recordDirectPayment(
        invoiceId: String,
        amount: Double,
        method: PaymentMethod,
        notes: String,
        onDone: () -> Unit = {}
    ) {
        viewModelScope.launch {
            val user = currentUser.value
            val approverId = user?.fullName ?: "Master / Admin"
            repository.recordDirectPayment(invoiceId, amount, method, approverId, notes)
            onDone()
        }
    }

    fun recordPayment(
        invoiceId: String,
        amount: Double,
        method: PaymentMethod,
        notes: String,
        onDone: () -> Unit = {}
    ) {
        recordDirectPayment(invoiceId, amount, method, notes, onDone)
    }

    fun updateInvoiceStatus(invoiceId: String, status: InvoiceStatus) {
        viewModelScope.launch {
            repository.updateInvoiceStatus(invoiceId, status)
        }
    }

    // --- Grading Actions ---
    fun createGradingEvent(name: String, eventDate: String, location: String, examiner: String, fee: Double) {
        if (!AuthorizationManager.authorize(authContext.value, Permission.PERSATUAN_MANAGE_CLASSES).isAllowed) return
        viewModelScope.launch {
            repository.createGradingEvent(name, eventDate, location, examiner, fee)
        }
    }

    fun addGradingEvent(
        name: String,
        eventDate: String,
        location: String,
        examiner: String,
        fee: Double,
        onDone: () -> Unit = {}
    ) {
        viewModelScope.launch {
            repository.addGradingEvent(name, eventDate, location, examiner, fee)
            onDone()
        }
    }

    fun getGradingCandidates(eventId: String) = repository.getGradingCandidates(eventId)

    fun registerForGrading(
        eventId: String,
        studentId: String,
        fromBeltId: String?,
        toBeltId: String?,
        onDone: () -> Unit = {}
    ) {
        viewModelScope.launch {
            repository.registerForGrading(eventId, studentId, fromBeltId, toBeltId)
            onDone()
        }
    }

    fun recordGradingResult(
        recordId: String,
        eventId: String,
        studentId: String,
        toBeltId: String?,
        result: GradingResultType,
        notes: String,
        onDone: () -> Unit = {}
    ) {
        viewModelScope.launch {
            repository.recordGradingResult(recordId, eventId, studentId, toBeltId, result, notes)
            onDone()
        }
    }

    // --- Skills Curriculum ---
    fun updateStudentSkill(studentId: String, skillId: String, level: SkillLevel, notes: String = "") {
        viewModelScope.launch {
            repository.setSkillLevel(studentId, skillId, level, notes)
        }
    }

    fun addSkill(name: String, category: String, description: String, sortOrder: Int, onDone: () -> Unit = {}) {
        viewModelScope.launch {
            repository.addSkill(name, category, description, sortOrder)
            onDone()
        }
    }

    // --- Instructor Notes ---
    fun addInstructorNote(
        studentId: String,
        body: String,
        visibility: NoteVisibility,
        onDone: () -> Unit = {}
    ) {
        viewModelScope.launch {
            val author = currentUser.value?.fullName ?: "Instructor"
            repository.addInstructorNote(studentId, author, body, visibility)
            onDone()
        }
    }

    // --- Tournaments ---
    fun addTournament(name: String, eventDate: String, location: String, organizer: String, onDone: () -> Unit = {}) {
        viewModelScope.launch {
            repository.addTournament(name, eventDate, location, organizer)
            onDone()
        }
    }

    fun recordTournamentResult(
        tournamentId: String,
        studentId: String,
        eventCategory: String,
        medal: Medal,
        notes: String,
        onDone: () -> Unit = {}
    ) {
        viewModelScope.launch {
            repository.recordTournamentResult(tournamentId, studentId, eventCategory, medal, notes)
            onDone()
        }
    }

    // --- Verification ---
    suspend fun verifyCertificate(code: String): CertificateDetail? {
        return repository.verifyCertificate(code)
    }

    // --- Announcements ---
    fun addAnnouncement(title: String, content: String, classId: String? = null) {
        val user = currentUser.value ?: return
        viewModelScope.launch {
            repository.addAnnouncement(user.id, user.fullName, user.role, title, content, classId)
        }
    }

    fun approveAnnouncement(announcementId: String) {
        viewModelScope.launch {
            repository.approveAnnouncement(announcementId)
        }
    }

    fun rejectAnnouncement(announcementId: String) {
        viewModelScope.launch {
            repository.rejectAnnouncement(announcementId)
        }
    }

    // --- Class Workflow Requests (Creation & Join) ---
    fun requestClassCreation(proposedClassName: String, proposedBranchId: String?, onDone: () -> Unit = {}) {
        val user = currentUser.value ?: return
        viewModelScope.launch {
            repository.requestClassCreation(user.id, proposedClassName, proposedBranchId)
            onDone()
        }
    }

    fun approveClassCreation(requestId: String, code: String, dayOfWeek: Int, startTime: String, endTime: String, monthlyFee: Double, onDone: () -> Unit = {}) {
        viewModelScope.launch {
            repository.approveClassCreation(requestId, code, dayOfWeek, startTime, endTime, monthlyFee)
            onDone()
        }
    }

    fun rejectClassCreation(requestId: String, onDone: () -> Unit = {}) {
        viewModelScope.launch {
            repository.rejectClassCreation(requestId)
            onDone()
        }
    }

    fun requestJoinClass(targetClassId: String, onDone: () -> Unit = {}) {
        val user = currentUser.value ?: return
        viewModelScope.launch {
            repository.requestJoinClass(user.id, targetClassId)
            onDone()
        }
    }

    fun approveJoinClass(requestId: String, onDone: () -> Unit = {}) {
        viewModelScope.launch {
            repository.approveJoinClass(requestId)
            onDone()
        }
    }

    fun rejectJoinClass(requestId: String, onDone: () -> Unit = {}) {
        viewModelScope.launch {
            repository.rejectJoinClass(requestId)
            onDone()
        }
    }

    // --- Student Registration Approvals by Master ---
    fun approveStudentRegistration(profileId: String, onDone: () -> Unit = {}) {
        viewModelScope.launch {
            repository.approveStudentRegistration(profileId)
            onDone()
        }
    }

    fun rejectStudentRegistration(profileId: String, onDone: () -> Unit = {}) {
        viewModelScope.launch {
            repository.rejectStudentRegistration(profileId)
            onDone()
        }
    }

    // --- Parent Child 3-Way Link Workflow ---
    fun requestParentChildLink(parentProfileId: String, studentId: String, onDone: () -> Unit = {}) {
        viewModelScope.launch {
            repository.requestParentChildLink(parentProfileId, studentId)
            onDone()
        }
    }

    fun approveParentChildLinkStep(linkId: String, approverRole: UserRole, onDone: () -> Unit = {}) {
        viewModelScope.launch {
            repository.approveParentChildLinkStep(linkId, approverRole)
            onDone()
        }
    }

    fun rejectParentChildLink(linkId: String, onDone: () -> Unit = {}) {
        viewModelScope.launch {
            repository.rejectParentChildLink(linkId)
            onDone()
        }
    }

    // --- Class Transfer 2-Way Master Workflow ---
    fun requestClassTransfer(studentId: String, oldClassId: String, newClassId: String, onDone: () -> Unit = {}) {
        viewModelScope.launch {
            repository.requestClassTransfer(studentId, oldClassId, newClassId)
            onDone()
        }
    }

    fun approveClassTransferStep(transferId: String, isNewMaster: Boolean, onDone: () -> Unit = {}) {
        viewModelScope.launch {
            repository.approveClassTransferStep(transferId, isNewMaster)
            onDone()
        }
    }

    fun rejectClassTransfer(transferId: String, onDone: () -> Unit = {}) {
        viewModelScope.launch {
            repository.rejectClassTransfer(transferId)
            onDone()
        }
    }

    // --- Messaging with Audit ---
    fun sendMessage(recipientId: String?, classId: String?, content: String, onDone: () -> Unit = {}) {
        val user = currentUser.value ?: return
        viewModelScope.launch {
            repository.sendMessage(user.id, user.fullName, user.role, recipientId, classId, content)
            onDone()
        }
    }

    // --- Certificates ---
    fun createCertificate(studentId: String, type: CertType, title: String, issuedBy: String, onDone: () -> Unit = {}) {
        viewModelScope.launch {
            repository.createCertificate(studentId, type, title, issuedBy)
            onDone()
        }
    }

    fun revokeCertificate(certificateId: String, onDone: () -> Unit = {}) {
        viewModelScope.launch {
            repository.revokeCertificate(certificateId)
            onDone()
        }
    }

    fun deleteCertificate(certificateId: String, onDone: () -> Unit = {}) {
        viewModelScope.launch {
            repository.deleteCertificate(certificateId)
            onDone()
        }
    }

    // --- Audit Logs Deletion for Admin Persatuan ---
    fun deleteAuditLogsForOrganization(orgId: String, onDone: () -> Unit = {}) {
        viewModelScope.launch {
            repository.deleteAuditLogsForOrganization(orgId)
            onDone()
        }
    }

    // --- Account Deactivation ---
    fun deactivateAccount(userId: String, onResult: (Result<Unit>) -> Unit) {
        viewModelScope.launch {
            val res = repository.deactivateAccount(userId)
            onResult(res)
        }
    }

    // --- Data Export & Backup ---
    fun exportAcademyData(onComplete: (String) -> Unit) {
        viewModelScope.launch {
            val jsonString = repository.exportAcademyDataJson()
            onComplete(jsonString)
        }
    }
}

class BeltFlowViewModelFactory(private val repository: BeltFlowRepository) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        if (modelClass.isAssignableFrom(BeltFlowViewModel::class.java)) {
            return BeltFlowViewModel(repository) as T
        }
        throw IllegalArgumentException("Unknown ViewModel class")
    }
}
