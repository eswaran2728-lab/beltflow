package com.example.beltflow.data.model

data class AuthUser(
    val id: String,
    val fullName: String,
    val email: String,
    val role: UserRole,
    val status: ProfileStatus,
    val phone: String = "",
    val childName: String = "",
    val assignedClass: String = "",
    val studentId: String? = null
) {
    val linkedStudentId: String? get() = studentId
}

data class StudentWithDetails(
    val id: String,
    val fullName: String,
    val icOrMykid: String,
    val dateOfBirth: String,
    val age: Int,
    val gender: String,
    val beltId: String?,
    val beltName: String,
    val beltColorHex: String,
    val lifecycle: Lifecycle,
    val joinedAt: String,
    val parentName: String,
    val parentPhone: String,
    val medicalNotes: String,
    val classNames: List<String>,
    val classIds: List<String>,
    val attendanceRate: Int = 100,
    val recentAbsenceCount: Int = 0,
    val isAtRisk: Boolean = false
)

data class ClassWithBranch(
    val id: String,
    val branchId: String?,
    val branchName: String,
    val name: String,
    val code: String,
    val dayOfWeek: Int,
    val startTime: String,
    val endTime: String,
    val scheduleNote: String,
    val monthlyFee: Double,
    val coachName: String,
    val enrolledStudentCount: Int = 0
) {
    val schedule: String get() = scheduleNote
}

data class InvoiceWithStudent(
    val id: String,
    val studentId: String,
    val studentName: String,
    val parentName: String,
    val billingMonth: String,
    val amount: Double,
    val discount: Double,
    val discountReason: String,
    val netAmount: Double,
    val status: InvoiceStatus,
    val payments: List<PaymentWithReceipt> = emptyList()
) {
    val discountAmount: Double get() = discount
}

data class PaymentWithReceipt(
    val id: String,
    val invoiceId: String,
    val amount: Double,
    val method: PaymentMethod,
    val submittedBy: String?,
    val approvedBy: String?,
    val approvedAt: Long?,
    val receiptNo: String?,
    val notes: String
)

data class GradingEventWithRecords(
    val id: String,
    val name: String,
    val eventDate: String,
    val location: String,
    val examiner: String,
    val fee: Double,
    val isCompleted: Boolean,
    val candidateCount: Int,
    val passCount: Int
)

data class GradingCandidateDetail(
    val recordId: String,
    val eventId: String,
    val studentId: String,
    val studentName: String,
    val fromBeltName: String,
    val toBeltName: String,
    val fromBeltColorHex: String,
    val toBeltColorHex: String,
    val toBeltId: String?,
    val result: GradingResultType,
    val notes: String
) {
    val examinerNotes: String get() = notes
}

data class StudentSkillProgress(
    val skillId: String,
    val skillName: String,
    val category: String,
    val level: SkillLevel,
    val percentage: Int
)

data class TournamentDetail(
    val id: String,
    val name: String,
    val eventDate: String,
    val location: String,
    val organizer: String,
    val results: List<TournamentResultDetail>
)

data class TournamentResultDetail(
    val id: String,
    val tournamentId: String,
    val studentId: String,
    val studentName: String,
    val eventCategory: String,
    val medal: Medal,
    val points: Int,
    val notes: String
)

data class CertificateDetail(
    val id: String,
    val studentId: String,
    val studentName: String,
    val type: CertType,
    val title: String,
    val certNo: String,
    val verifyCode: String,
    val issuedAt: String,
    val issuedBy: String,
    val academyName: String = "Persatuan Silambam Malaysia Daerah Sepang"
)
