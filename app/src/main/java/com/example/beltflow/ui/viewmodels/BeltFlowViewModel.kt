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
    val totalPlatformChargesCollected: Double = 0.0,
    val totalPlatformStudents: Int = 0
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

    // Current User Auth Context for RBAC Evaluation
    val authContext: StateFlow<AuthContext?> = currentUser.map { user ->
        user?.let {
            AuthContext(
                userId = it.id,
                role = it.role,
                organizationId = it.organizationId,
                assignedClassIds = emptyList(),
                linkedStudentIds = listOfNotNull(it.studentId)
            )
        }
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), null)

    // --- Super Admin Dashboard UI State ---
    val superAdminDashboardStats: StateFlow<SuperAdminDashboardUiState> = combine(
        allPersatuans,
        allStudents
    ) { persatuans, students ->
        val active = persatuans.count { it.status == ProfileStatus.APPROVED }
        val subRev = persatuans.sumOf { it.monthlyFee }
        val chargeRev = persatuans.sumOf { (it.monthlyFee * it.platformChargeRatePercent) / 100.0 }

        SuperAdminDashboardUiState(
            totalPersatuans = persatuans.size,
            activePersatuans = active,
            totalMonthlySubscriptionRevenue = subRev,
            totalPlatformChargesCollected = chargeRev,
            totalPlatformStudents = students.size
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
        allStudents
    ) { classes, students ->
        val atRisk = students.count { it.isAtRisk }
        MasterDashboardUiState(
            assignedClassesCount = classes.size,
            totalTraineesCount = students.size,
            todaySessionsCount = 2,
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
                childName = childName,
                assignedClass = assignedClass,
                password = password
            )
            onComplete(res)
        }
    }

    fun loginAs(target: String, onComplete: () -> Unit = {}) {
        viewModelScope.launch {
            val profile = when (target.lowercase(Locale.getDefault())) {
                "super_admin", "superadmin" -> daoGetProfileByEmail("eswaran2728@gmail.com")
                "admin", "admin_persatuan" -> daoGetProfileByEmail("persatuansilambamdaerahsepang@gmail.com")
                "coach", "master" -> daoGetProfileByEmail("master.silambamsepang@gmail.com")
                else -> daoGetProfileByEmail(target)
            }
            if (profile != null) {
                repository.setCurrentUser(
                    AuthUser(
                        id = profile.id,
                        fullName = profile.fullName,
                        email = profile.email,
                        role = profile.role,
                        status = profile.status,
                        organizationId = profile.organizationId,
                        childName = profile.childName,
                        assignedClass = profile.assignedClass,
                        studentId = profile.studentId
                    )
                )
            }
            onComplete()
        }
    }

    private suspend fun daoGetProfileByEmail(email: String): ProfileEntity? {
        return allProfiles.value.find { it.email.equals(email, ignoreCase = true) }
    }

    fun logout() {
        repository.logout()
    }

    // --- Persatuan Management ---
    fun createPersatuan(
        name: String,
        adminEmail: String,
        adminFullName: String,
        plan: SubscriptionPlan,
        chargePercent: Double
    ) {
        if (!AuthorizationManager.authorize(authContext.value, Permission.PLATFORM_MANAGE_PERSATUAN).isAllowed) return
        viewModelScope.launch {
            repository.createPersatuan(name, adminEmail, adminFullName, plan, chargePercent)
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
    val allClassMasterCrossRefs = repository.allClassMasterCrossRefs.stateIn(
        viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList()
    )

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
    val allClassTransfers = repository.allClassTransfers.stateIn(
        viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList()
    )

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

    fun payInvoiceWithFpx(invoiceId: String, onDone: () -> Unit = {}) {
        viewModelScope.launch {
            val user = currentUser.value
            val submitterId = user?.fullName ?: "Online User"
            val invoice = allInvoices.value.find { it.id == invoiceId }
            val amount = invoice?.netAmount ?: 0.0
            repository.recordDirectPayment(invoiceId, amount, PaymentMethod.FPX, submitterId, "FPX Online Banking Payment")
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
