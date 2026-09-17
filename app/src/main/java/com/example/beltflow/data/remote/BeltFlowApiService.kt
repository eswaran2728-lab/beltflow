package com.example.beltflow.data.remote

import com.example.beltflow.data.model.*
import retrofit2.Response
import retrofit2.http.*

/**
 * Retrofit REST API interface for BeltFlow shared TypeScript + PostgreSQL backend.
 */
interface BeltFlowApiService {

    // --- Authentication ---
    @POST("auth/setup-admin")
    suspend fun setupInitialSuperAdmin(@Body request: SetupAdminRequest): Response<AuthResponse>

    @POST("auth/login")
    suspend fun login(@Body request: LoginRequest): Response<AuthResponse>

    @POST("auth/register-parent")
    suspend fun registerParent(@Body request: RegisterParentRequest): Response<AuthResponse>

    @POST("auth/change-password")
    suspend fun changePassword(@Body request: ChangePasswordRequest): Response<BaseResponse>

    @GET("auth/me")
    suspend fun getCurrentUser(): Response<UserResponse>

    // --- Organizations ---
    @POST("organizations")
    suspend fun createOrganization(@Body request: CreateOrganizationRequest): Response<OrganizationResponse>

    @GET("organizations")
    suspend fun getAllOrganizations(): Response<List<OrganizationDto>>

    @GET("organizations/{orgId}")
    suspend fun getOrganization(@Path("orgId") orgId: String): Response<OrganizationResponse>

    // --- Classes & Masters ---
    @POST("classes")
    suspend fun createClass(@Body request: CreateClassRequest): Response<ClassResponse>

    @GET("classes/organization/{orgId}")
    suspend fun getClassesForOrganization(@Path("orgId") orgId: String): Response<ClassListResponse>

    @POST("classes/assign-master")
    suspend fun assignMasterToClass(@Body request: AssignMasterRequest): Response<BaseResponse>

    // --- Students & Roster ---
    @POST("students")
    suspend fun enrollStudent(@Body request: EnrollStudentRequest): Response<StudentResponse>

    @GET("students/organization/{orgId}")
    suspend fun getStudentsForOrganization(@Path("orgId") orgId: String): Response<StudentListResponse>

    @GET("students/class/{classId}")
    suspend fun getStudentsForClass(@Path("classId") classId: String): Response<StudentListResponse>

    @GET("students/{id}")
    suspend fun getStudentById(@Path("id") id: String): Response<StudentResponse>

    // --- Coaches / Instructors (admin-only; requires ADMIN_PERSATUAN token) ---
    @POST("coaches")
    suspend fun addCoach(@Body request: AddCoachRequest): Response<CoachResponse>

    // --- Student Self-Registration (public; creates STUDENT role, PENDING_VERIFICATION status) ---
    @POST("auth/register-student")
    suspend fun registerStudent(@Body request: RegisterStudentRequest): Response<RegisterStudentResponse>

    @GET("coaches/organization/{orgId}")
    suspend fun getCoachesForOrganization(@Path("orgId") orgId: String): Response<CoachListResponse>

    // --- Tournaments ---
    @POST("tournaments")
    suspend fun createTournament(@Body request: CreateTournamentRequest): Response<TournamentResponse>

    @GET("tournaments/organization/{orgId}")
    suspend fun getTournamentsForOrganization(@Path("orgId") orgId: String): Response<TournamentListResponse>

    @POST("tournaments/{id}/results")
    suspend fun finalizeTournamentResults(
        @Path("id") id: String,
        @Body request: TournamentResultsRequest
    ): Response<TournamentResultsResponse>

    // --- Skills Curriculum & Progress ---
    @POST("skills/progress")
    suspend fun updateSkillProgress(@Body request: SkillProgressRequest): Response<SkillProgressResponse>

    @GET("skills/student/{studentId}")
    suspend fun getSkillProgress(@Path("studentId") studentId: String): Response<SkillProgressListResponse>

    // --- Attendance ---
    @POST("attendance/record")
    suspend fun recordAttendance(@Body request: RecordAttendanceRequest): Response<BaseResponse>

    @GET("attendance/class/{classId}")
    suspend fun getAttendanceForClass(@Path("classId") classId: String): Response<AttendanceListResponse>

    @GET("attendance/student/{studentId}")
    suspend fun getAttendanceForStudent(@Path("studentId") studentId: String): Response<AttendanceListResponse>

    // --- Invoices & Payments ---
    @POST("billing/submit-payment")
    suspend fun submitPaymentNotice(@Body request: SubmitPaymentRequest): Response<PaymentResponse>

    @POST("billing/{paymentId}/approve")
    suspend fun approvePayment(
        @Path("paymentId") paymentId: String,
        @Body request: ApprovePaymentRequest
    ): Response<PaymentResponse>

    @POST("billing/record-cash-payment")
    suspend fun recordCashPayment(@Body request: RecordCashPaymentRequest): Response<PaymentResponse>

    @GET("billing/organization/{orgId}")
    suspend fun getPaymentsForOrganization(@Path("orgId") orgId: String): Response<PaymentListResponse>

    @GET("billing/student/{studentId}")
    suspend fun getPaymentsForStudent(@Path("studentId") studentId: String): Response<PaymentListResponse>

    // --- Grading Events & Scoring ---
    @POST("grading")
    suspend fun createGradingEvent(@Body request: CreateGradingRequest): Response<GradingResponse>

    @GET("grading/organization/{orgId}")
    suspend fun getGradingEventsForOrganization(@Path("orgId") orgId: String): Response<GradingListResponse>

    @POST("grading/{id}/score")
    suspend fun scoreGradingCandidate(
        @Path("id") id: String,
        @Body request: ScoreGradingRequest
    ): Response<ScoreGradingResponse>

    // --- Certificates ---
    @POST("certificates/verify")
    suspend fun verifyCertificate(@Body request: VerifyCertificateRequest): Response<VerifyCertificateResponse>

    @GET("certificates/code/{code}")
    suspend fun getCertificateByCode(@Path("code") code: String): Response<VerifyCertificateResponse>
}

// Data Transfer Objects (DTOs)
data class SetupAdminRequest(val fullName: String, val email: String, val phone: String?, val password: String)
data class LoginRequest(val email: String, val password: String)
data class RegisterParentRequest(
    val organizationId: String,
    val fullName: String,
    val email: String,
    val phone: String,
    val password: String,
    val childName: String?,
    val classId: String?,
    val studentId: String?
)
data class ChangePasswordRequest(val currentPassword: String, val newPassword: String)
data class AuthResponse(val message: String, val token: String, val user: UserDto)
data class UserResponse(val user: UserDto)
data class UserDto(val id: String, val fullName: String, val email: String, val role: String, val organizationId: String?)

data class CreateOrganizationRequest(
    val name: String,
    val masterName: String,
    val email: String,
    val password: String,
    val baseMonthlyFee: Double,
    val siblingDiscountPercent: Double,
    val state: String = "Selangor",
    val martialArtStyle: String = "Silambam"
)
data class OrganizationResponse(val message: String? = null, val organization: OrganizationDto)
data class OrganizationDto(
    val id: String,
    val name: String,
    val state: String,
    val martialArtStyle: String,
    val masterName: String,
    val baseMonthlyFee: Double,
    val siblingDiscountPercent: Double
)

data class CreateClassRequest(val organizationId: String, val name: String, val schedule: String, val location: String, val mainMasterId: String?)
data class AssignMasterRequest(val classId: String, val masterId: String, val isMainMaster: Boolean)
data class ClassResponse(val message: String? = null, val `class`: ClassDto)
data class ClassListResponse(val classes: List<ClassDto>)
data class ClassDto(val id: String, val organizationId: String, val name: String, val schedule: String, val location: String, val mainMasterId: String?)

data class EnrollStudentRequest(
    val organizationId: String,
    val classId: String?,
    val fullName: String,
    val icNumber: String?,
    val phone: String?,
    val email: String?,
    val beltRank: String,
    val hasSiblingDiscount: Boolean,
    val parentName: String? = null,
    val parentPhone: String? = null
)
data class StudentResponse(val message: String? = null, val student: StudentDto)
data class StudentListResponse(val students: List<StudentDto>)
data class StudentDto(
    val id: String,
    val organizationId: String,
    val classId: String?,
    val fullName: String,
    val beltRank: String,
    val monthlyFee: Double,
    val hasSiblingDiscount: Boolean,
    val billingStatus: String
)

data class AddCoachRequest(
    val organizationId: String,
    val fullName: String,
    val email: String,
    val phone: String,
    val isMainMaster: Boolean,
    val assignedClassId: String?,
    val password: String
)
data class RegisterStudentRequest(
    val organizationId: String,
    val fullName: String,
    val email: String,
    val phone: String?,
    val password: String,
    val classId: String? = null,
    val beltRank: String? = null,
    val icNumber: String? = null
)
data class RegisterStudentResponse(
    val message: String,
    val token: String?,
    val user: UserDto
)
data class CoachResponse(val message: String? = null, val coach: CoachDto)
data class CoachListResponse(val coaches: List<CoachDto>)
data class CoachDto(
    val id: String,
    val organizationId: String,
    val fullName: String,
    val email: String,
    val phone: String,
    val role: String,
    val isMainMaster: Boolean,
    val assignedClassId: String?
)

data class CreateTournamentRequest(
    val organizationId: String,
    val name: String,
    val tournamentDate: String,
    val location: String,
    val categories: List<String>?,
    val description: String?
)
data class TournamentResponse(val message: String? = null, val tournament: TournamentDto)
data class TournamentListResponse(val tournaments: List<TournamentDto>)
data class TournamentDto(
    val id: String,
    val organizationId: String,
    val name: String,
    val tournamentDate: String,
    val location: String,
    val description: String?
)
data class TournamentResultsRequest(val results: List<TournamentParticipantResult>)
data class TournamentParticipantResult(
    val studentId: String?,
    val studentName: String,
    val category: String,
    val medal: String,
    val notes: String?
)
data class TournamentResultsResponse(val message: String, val count: Int, val certificates: List<CertificateDto>?)

data class SkillProgressRequest(
    val studentId: String,
    val skillId: String,
    val skillName: String,
    val status: String,
    val verifiedBy: String?
)
data class SkillProgressResponse(val message: String, val progress: SkillProgressDto)
data class SkillProgressListResponse(val skills: List<SkillProgressDto>)
data class SkillProgressDto(
    val id: String,
    val studentId: String,
    val skillId: String,
    val skillName: String,
    val status: String,
    val verifiedBy: String?,
    val updatedAt: String?
)

data class RecordAttendanceRequest(val classId: String, val sessionDate: String, val records: List<AttendanceRecordItem>)
data class AttendanceRecordItem(val studentId: String, val status: String)
data class AttendanceListResponse(val attendance: List<AttendanceRecordDto>)
data class AttendanceRecordDto(val classId: String, val sessionDate: String, val studentId: String, val status: String)

data class SubmitPaymentRequest(val studentId: String, val amount: Double, val method: String?, val proofNotes: String?)
data class ApprovePaymentRequest(val organizationId: String)
data class RecordCashPaymentRequest(val organizationId: String, val studentId: String, val amount: Double, val notes: String?)
data class PaymentResponse(val message: String? = null, val payment: PaymentDto)
data class PaymentListResponse(val payments: List<PaymentDto>)
data class PaymentDto(val id: String, val studentId: String, val amount: Double, val status: String, val receiptNo: String?)

data class CreateGradingRequest(
    val organizationId: String,
    val eventName: String,
    val gradingDate: String,
    val location: String,
    val eligibleRanks: List<String>?,
    val examiners: List<String>?
)
data class GradingResponse(val message: String? = null, val gradingEvent: GradingDto)
data class GradingListResponse(val gradingEvents: List<GradingDto>)
data class GradingDto(
    val id: String,
    val organizationId: String,
    val eventName: String,
    val gradingDate: String,
    val location: String
)
data class ScoreGradingRequest(
    val candidateId: String,
    val examinerScore: Double,
    val feedback: String?,
    val result: String,
    val targetRank: String,
    val certIssued: Boolean
)
data class ScoreGradingResponse(val message: String, val candidate: Any?)

data class VerifyCertificateRequest(val code: String)
data class VerifyCertificateResponse(val verified: Boolean, val certificate: CertificateDto?)
data class CertificateDto(
    val code: String,
    val studentName: String,
    val rankOrTitle: String,
    val organizationName: String,
    val masterName: String,
    val issueDate: String
)
data class BaseResponse(val message: String)
