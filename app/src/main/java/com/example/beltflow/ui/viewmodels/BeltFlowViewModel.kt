package com.example.beltflow.ui.viewmodels

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.example.beltflow.data.local.*
import com.example.beltflow.data.model.*
import com.example.beltflow.data.repository.BeltFlowRepository
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

data class AdminDashboardUiState(
    val totalStudents: Int = 0,
    val activeStudents: Int = 0,
    val atRiskStudents: Int = 0,
    val monthlyRevenue: Double = 0.0,
    val pendingInvoicesCount: Int = 0,
    val pendingApprovalsCount: Int = 0,
    val upcomingGradingCount: Int = 0
)

class BeltFlowViewModel(private val repository: BeltFlowRepository) : ViewModel() {

    val currentUser = repository.currentUser

    val allProfiles = repository.allProfiles.stateIn(
        viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList()
    )

    val academySettings = repository.academySettings.stateIn(
        viewModelScope, SharingStarted.WhileSubscribed(5000), null
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
        val pendingInvoices = curMonthInvoices.count { it.status == InvoiceStatus.UNPAID || it.status == InvoiceStatus.PENDING_APPROVAL || it.status == InvoiceStatus.OVERDUE }
        val pendingProfiles = profiles.count { it.status == ProfileStatus.PENDING }
        val upcomingGradings = gradings.count { !it.isCompleted }

        AdminDashboardUiState(
            totalStudents = students.size,
            activeStudents = active,
            atRiskStudents = atRisk,
            monthlyRevenue = revenue,
            pendingInvoicesCount = pendingInvoices,
            pendingApprovalsCount = pendingProfiles,
            upcomingGradingCount = upcomingGradings
        )
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), AdminDashboardUiState())

    // --- Authentication Actions ---
    fun login(email: String, password: String, onComplete: (Result<AuthUser>) -> Unit) {
        viewModelScope.launch {
            val result = repository.login(email, password)
            onComplete(result)
        }
    }

    fun loginAs(email: String, onComplete: (Boolean) -> Unit) {
        viewModelScope.launch {
            val success = repository.loginAs(email)
            onComplete(success)
        }
    }

    fun signup(
        fullName: String,
        email: String,
        password: String,
        phone: String,
        role: UserRole,
        childName: String,
        classCode: String,
        onResult: (Result<String>) -> Unit
    ) {
        viewModelScope.launch {
            val result = repository.signupUser(fullName, email, password, phone, role, childName, classCode)
            onResult(result)
        }
    }

    fun logout() {
        repository.setCurrentUser(null)
    }

    // --- Profile Approvals ---
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

    fun linkProfileToStudent(profileId: String, studentId: String) {
        viewModelScope.launch {
            repository.linkProfileToStudent(profileId, studentId)
        }
    }

    // --- Student Management ---
    fun addStudent(
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
        onDone: (String) -> Unit = {}
    ) {
        viewModelScope.launch {
            val id = repository.addStudent(
                fullName, icOrMykid, dateOfBirth, gender, beltId, lifecycle,
                parentName, parentPhone, medicalNotes, classIds
            )
            onDone(id)
        }
    }

    fun registerStudent(
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
        onDone: (String) -> Unit = {}
    ) {
        addStudent(fullName, icOrMykid, dateOfBirth, gender, beltId, lifecycle, parentName, parentPhone, medicalNotes, classIds, onDone)
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
        onDone: () -> Unit
    ) {
        viewModelScope.launch {
            repository.updateStudent(
                id, fullName, icOrMykid, dateOfBirth, gender, beltId, lifecycle,
                parentName, parentPhone, medicalNotes, classIds
            )
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

    // --- Attendance Tracking ---
    fun markAttendance(
        classId: String,
        sessionDate: String,
        records: Map<String, AttendanceStatus>,
        onDone: () -> Unit
    ) {
        viewModelScope.launch {
            repository.markAttendance(classId, sessionDate, records)
            onDone()
        }
    }

    suspend fun getSessionAttendance(classId: String, sessionDate: String): List<AttendanceEntity> {
        return repository.getAttendanceForSession(classId, sessionDate)
    }

    // --- Billing & Invoices ---
    fun generateInvoices(billingMonth: String, onDone: (Int) -> Unit = {}) {
        viewModelScope.launch {
            val count = repository.generateMonthlyInvoices(billingMonth)
            onDone(count)
        }
    }

    fun generateMonthlyInvoices(billingMonth: String, onDone: (Int) -> Unit = {}) {
        generateInvoices(billingMonth, onDone)
    }

    fun submitCashPayment(invoiceId: String, amount: Double, notes: String, onDone: () -> Unit = {}) {
        viewModelScope.launch {
            val user = currentUser.value
            val submitterId = user?.id ?: "parent"
            repository.submitCashPayment(invoiceId, amount, submitterId, notes)
            onDone()
        }
    }

    fun payInvoiceWithFpx(invoiceId: String, onDone: () -> Unit = {}) {
        viewModelScope.launch {
            val user = currentUser.value
            val submitterId = user?.id ?: "parent"
            // FPX payments are instant online bank transfers, approved immediately
            val invoice = allInvoices.value.find { it.id == invoiceId }
            val amount = invoice?.netAmount ?: 0.0
            repository.recordDirectPayment(invoiceId, amount, PaymentMethod.FPX, submitterId, "FPX Online Banking Payment")
            onDone()
        }
    }

    fun approvePayment(paymentId: String, invoiceId: String) {
        viewModelScope.launch {
            val user = currentUser.value
            val approverId = user?.id ?: "staff"
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
            val approverId = user?.id ?: "staff"
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

    // --- Belt Grading ---
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
        onDone: () -> Unit
    ) {
        viewModelScope.launch {
            val author = currentUser.value?.fullName ?: "Instructor"
            repository.addInstructorNote(studentId, author, body, visibility)
            onDone()
        }
    }

    // --- Tournaments ---
    fun addTournament(name: String, eventDate: String, location: String, organizer: String, onDone: () -> Unit) {
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
        onDone: () -> Unit
    ) {
        viewModelScope.launch {
            repository.recordTournamentResult(tournamentId, studentId, eventCategory, medal, notes)
            onDone()
        }
    }

    // --- Verification & Settings ---
    suspend fun verifyCertificate(code: String): CertificateDetail? {
        return repository.verifyCertificate(code)
    }

    fun saveAcademySettings(settings: AcademySettingsEntity, onDone: () -> Unit) {
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
