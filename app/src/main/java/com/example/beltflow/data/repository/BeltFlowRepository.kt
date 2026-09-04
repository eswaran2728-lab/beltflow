package com.example.beltflow.data.repository

import com.example.beltflow.data.local.*
import com.example.beltflow.data.model.*
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

    suspend fun login(email: String, password: String): Result<AuthUser> = withContext(Dispatchers.IO) {
        val cleanEmail = email.trim().lowercase(Locale.getDefault())
        val cleanPassword = password.trim()

        if (cleanEmail.isBlank()) {
            return@withContext Result.failure(Exception("Please enter your email address."))
        }
        if (cleanPassword.isBlank()) {
            return@withContext Result.failure(Exception("Please enter your password."))
        }

        // Dedicated Admin account handling for Master Eswaran
        if (cleanEmail == "eswaran2728@gmail.com") {
            if (cleanPassword == "Eswaran0321@") {
                var admin = dao.getProfileByEmail("eswaran2728@gmail.com")
                if (admin == null) {
                    admin = ProfileEntity(
                        id = "prof_admin_1",
                        fullName = "Master Eswaran",
                        email = "eswaran2728@gmail.com",
                        phone = "+60 12-345 6789",
                        role = UserRole.ADMIN,
                        status = ProfileStatus.APPROVED,
                        password = "Eswaran0321@"
                    )
                    dao.insertProfile(admin)
                } else if (admin.role != UserRole.ADMIN || admin.password != "Eswaran0321@") {
                    admin = admin.copy(
                        fullName = "Master Eswaran",
                        role = UserRole.ADMIN,
                        status = ProfileStatus.APPROVED,
                        password = "Eswaran0321@"
                    )
                    dao.insertProfile(admin)
                }
                val authUser = AuthUser(
                    id = admin.id,
                    fullName = admin.fullName,
                    email = admin.email,
                    role = UserRole.ADMIN,
                    status = ProfileStatus.APPROVED
                )
                _currentUser.value = authUser
                return@withContext Result.success(authUser)
            } else {
                return@withContext Result.failure(Exception("Incorrect password for Admin account."))
            }
        }

        // General account lookup
        val profile = dao.getProfileByEmail(email.trim())
            ?: dao.getProfileByEmail(cleanEmail)
            ?: return@withContext Result.failure(Exception("No account found for $email. Please register an account below."))

        if (profile.password.isNotBlank() && profile.password != cleanPassword) {
            return@withContext Result.failure(Exception("Incorrect password. Please try again."))
        }

        if (profile.status == ProfileStatus.PENDING) {
            return@withContext Result.failure(Exception("Your account is awaiting approval from the academy administrator (Master Eswaran)."))
        }

        if (profile.status == ProfileStatus.REJECTED) {
            return@withContext Result.failure(Exception("Your account application was rejected. Please contact the academy."))
        }

        val authUser = AuthUser(
            id = profile.id,
            fullName = profile.fullName,
            email = profile.email,
            role = profile.role,
            status = profile.status,
            childName = profile.childName,
            assignedClass = profile.assignedClass,
            studentId = profile.studentId
        )
        _currentUser.value = authUser
        Result.success(authUser)
    }

    suspend fun loginAs(email: String): Boolean = withContext(Dispatchers.IO) {
        val profile = dao.getProfileByEmail(email) ?: return@withContext false
        _currentUser.value = AuthUser(
            id = profile.id,
            fullName = profile.fullName,
            email = profile.email,
            role = profile.role,
            status = profile.status,
            childName = profile.childName,
            assignedClass = profile.assignedClass,
            studentId = profile.studentId
        )
        true
    }

    suspend fun signupUser(
        fullName: String,
        email: String,
        password: String,
        phone: String,
        role: UserRole,
        childName: String,
        classCode: String
    ): Result<String> = withContext(Dispatchers.IO) {
        val cleanEmail = email.trim().lowercase(Locale.getDefault())
        val existing = dao.getProfileByEmail(email.trim()) ?: dao.getProfileByEmail(cleanEmail)
        if (existing != null) {
            return@withContext Result.failure(Exception("An account with this email already exists."))
        }

        var assignedClassName = ""
        if (classCode.isNotBlank()) {
            val matchedClass = dao.getClassByCode(classCode.trim().uppercase(Locale.getDefault()))
            if (matchedClass != null) {
                assignedClassName = matchedClass.name
            }
        }

        // Default admin email is auto-approved, others are pending approval
        val isAutoApproved = cleanEmail == "eswaran2728@gmail.com"
        val status = if (isAutoApproved) ProfileStatus.APPROVED else ProfileStatus.PENDING
        val userRole = if (isAutoApproved) UserRole.ADMIN else role

        val newProfile = ProfileEntity(
            id = "prof_${UUID.randomUUID().toString().take(8)}",
            fullName = fullName.trim(),
            email = email.trim(),
            password = password.trim(),
            phone = phone.trim(),
            role = userRole,
            status = status,
            childName = childName.trim(),
            assignedClass = assignedClassName
        )
        dao.insertProfile(newProfile)

        // Automatically set as current if approved
        if (status == ProfileStatus.APPROVED) {
            _currentUser.value = AuthUser(
                id = newProfile.id,
                fullName = newProfile.fullName,
                email = newProfile.email,
                role = newProfile.role,
                status = newProfile.status,
                childName = newProfile.childName,
                assignedClass = newProfile.assignedClass
            )
        }
        Result.success(newProfile.id)
    }

    // --- Profiles (Admin Approvals) ---
    val allProfiles: Flow<List<ProfileEntity>> = dao.getAllProfiles()

    suspend fun updateProfileStatus(profileId: String, status: ProfileStatus) = withContext(Dispatchers.IO) {
        dao.updateProfileStatus(profileId, status)
        if (status == ProfileStatus.APPROVED) {
            val profile = dao.getProfileById(profileId)
            if (profile != null) {
                if (profile.role == UserRole.STUDENT && profile.studentId == null) {
                    val defaultBelt = dao.getAllBeltsDirect().firstOrNull()?.id
                    val newStudentId = "std_${UUID.randomUUID().toString().take(8)}"
                    val student = StudentEntity(
                        id = newStudentId,
                        fullName = profile.fullName,
                        icOrMykid = "-",
                        dateOfBirth = "-",
                        gender = "-",
                        beltId = defaultBelt,
                        lifecycle = Lifecycle.ACTIVE,
                        joinedAt = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date()),
                        parentName = profile.fullName,
                        parentPhone = profile.phone,
                        medicalNotes = "Registered online",
                        classIdsJson = "[]"
                    )
                    dao.insertStudent(student)
                    dao.linkProfileToStudent(profileId, newStudentId)
                } else if (profile.role == UserRole.PARENT && profile.childName.isNotBlank() && profile.studentId == null) {
                    val defaultBelt = dao.getAllBeltsDirect().firstOrNull()?.id
                    val newStudentId = "std_${UUID.randomUUID().toString().take(8)}"
                    val student = StudentEntity(
                        id = newStudentId,
                        fullName = profile.childName,
                        icOrMykid = "-",
                        dateOfBirth = "-",
                        gender = "-",
                        beltId = defaultBelt,
                        lifecycle = Lifecycle.ACTIVE,
                        joinedAt = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date()),
                        parentName = profile.fullName,
                        parentPhone = profile.phone,
                        medicalNotes = "Registered by parent",
                        classIdsJson = "[]"
                    )
                    dao.insertStudent(student)
                    dao.linkProfileToStudent(profileId, newStudentId)
                }
            }
        }
    }

    suspend fun linkProfileToStudent(profileId: String, studentId: String) = withContext(Dispatchers.IO) {
        dao.linkProfileToStudent(profileId, studentId)
    }

    // --- Settings, Belts, Branches, Classes ---
    val academySettings: Flow<AcademySettingsEntity?> = dao.getAcademySettings()
    val allBelts: Flow<List<BeltEntity>> = dao.getAllBelts()
    val allBranches: Flow<List<BranchEntity>> = dao.getAllBranches()
    val allClasses: Flow<List<ClassEntity>> = dao.getAllClasses()

    suspend fun saveAcademySettings(settings: AcademySettingsEntity) = withContext(Dispatchers.IO) {
        dao.saveAcademySettings(settings)
    }

    suspend fun addBelt(name: String, colorHex: String, sortOrder: Int) = withContext(Dispatchers.IO) {
        dao.insertBelt(BeltEntity("belt_${UUID.randomUUID().toString().take(6)}", name, colorHex, sortOrder))
    }

    suspend fun deleteBelt(belt: BeltEntity) = withContext(Dispatchers.IO) {
        dao.deleteBelt(belt)
    }

    suspend fun addBranch(name: String, address: String, phone: String) = withContext(Dispatchers.IO) {
        dao.insertBranch(BranchEntity("br_${UUID.randomUUID().toString().take(6)}", name, address, phone))
    }

    suspend fun deleteBranch(branch: BranchEntity) = withContext(Dispatchers.IO) {
        dao.deleteBranch(branch)
    }

    suspend fun addClass(classEntity: ClassEntity) = withContext(Dispatchers.IO) {
        dao.insertClass(classEntity)
    }

    suspend fun updateClass(classEntity: ClassEntity) = withContext(Dispatchers.IO) {
        dao.updateClass(classEntity)
    }

    suspend fun deleteClass(classEntity: ClassEntity) = withContext(Dispatchers.IO) {
        dao.deleteClass(classEntity)
    }

    // --- Students with Detailed Calculations ---
    val studentsWithDetails: Flow<List<StudentWithDetails>> = combine(
        dao.getAllStudents(),
        dao.getAllBelts(),
        dao.getAllClasses(),
        dao.getAllAttendance()
    ) { students, belts, classes, attendanceList ->
        val beltsMap = belts.associateBy { it.id }
        val classesMap = classes.associateBy { it.id }

        val attendanceByStudent = attendanceList.groupBy { it.studentId }

        students.map { student ->
            val belt = student.beltId?.let { beltsMap[it] }
            val classIds = parseClassIds(student.classIdsJson)
            val classNames = classIds.mapNotNull { classesMap[it]?.name }

            val records = attendanceByStudent[student.id] ?: emptyList()
            val totalSessions = records.size
            val presentCount = records.count { it.status == AttendanceStatus.PRESENT || it.status == AttendanceStatus.LATE }
            val attendanceRate = if (totalSessions > 0) (presentCount * 100) / totalSessions else 100

            // At-Risk Rule: 3+ absences in the last 6 sessions
            val sortedRecent = records.sortedByDescending { it.sessionDate }.take(6)
            val recentAbsences = sortedRecent.count { it.status == AttendanceStatus.ABSENT }
            val isAtRisk = recentAbsences >= 3

            val age = calculateAge(student.dateOfBirth)

            StudentWithDetails(
                id = student.id,
                fullName = student.fullName,
                icOrMykid = student.icOrMykid,
                dateOfBirth = student.dateOfBirth,
                age = age,
                gender = student.gender,
                beltId = student.beltId,
                beltName = belt?.name ?: "No Belt",
                beltColorHex = belt?.colorHex ?: "#94A3B8",
                lifecycle = student.lifecycle,
                joinedAt = student.joinedAt,
                parentName = student.parentName,
                parentPhone = student.parentPhone,
                medicalNotes = student.medicalNotes,
                classNames = classNames,
                classIds = classIds,
                attendanceRate = attendanceRate,
                recentAbsenceCount = recentAbsences,
                isAtRisk = isAtRisk
            )
        }
    }

    fun getStudentDetails(studentId: String): Flow<StudentWithDetails?> {
        return studentsWithDetails.map { list -> list.find { it.id == studentId } }
    }

    suspend fun addStudent(
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
    ): String = withContext(Dispatchers.IO) {
        val studentId = "stud_${UUID.randomUUID().toString().take(8)}"
        val student = StudentEntity(
            id = studentId,
            fullName = fullName,
            icOrMykid = icOrMykid,
            dateOfBirth = dateOfBirth,
            gender = gender,
            beltId = beltId,
            lifecycle = lifecycle,
            joinedAt = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date()),
            parentName = parentName,
            parentPhone = parentPhone,
            medicalNotes = medicalNotes,
            classIdsJson = JSONArray(classIds).toString()
        )
        dao.insertStudent(student)
        studentId
    }

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
        val existing = dao.getStudentById(id) ?: return@withContext
        val updated = existing.copy(
            fullName = fullName,
            icOrMykid = icOrMykid,
            dateOfBirth = dateOfBirth,
            gender = gender,
            beltId = beltId,
            lifecycle = lifecycle,
            parentName = parentName,
            parentPhone = parentPhone,
            medicalNotes = medicalNotes,
            classIdsJson = JSONArray(classIds).toString()
        )
        dao.updateStudent(updated)
    }

    suspend fun deleteStudent(studentId: String) = withContext(Dispatchers.IO) {
        val existing = dao.getStudentById(studentId) ?: return@withContext
        dao.deleteStudent(existing)
    }

    // --- Sessions & Attendance ---
    suspend fun markAttendance(
        classId: String,
        sessionDate: String,
        records: Map<String, AttendanceStatus> // studentId -> status
    ) = withContext(Dispatchers.IO) {
        var session = dao.getSession(classId, sessionDate)
        val sessionId = if (session != null) {
            session.id
        } else {
            val newSessionId = "sess_${classId}_${sessionDate.replace("-", "")}"
            dao.insertSession(ClassSessionEntity(newSessionId, classId, sessionDate))
            newSessionId
        }

        val entities = records.map { (studentId, status) ->
            AttendanceEntity(
                id = "att_${sessionId}_$studentId",
                sessionId = sessionId,
                studentId = studentId,
                status = status,
                sessionDate = sessionDate,
                classId = classId,
                markedAt = System.currentTimeMillis()
            )
        }
        dao.insertAttendance(entities)
    }

    fun getAttendanceForStudent(studentId: String): Flow<List<AttendanceEntity>> {
        return dao.getAttendanceForStudent(studentId)
    }

    suspend fun getAttendanceForSession(classId: String, sessionDate: String): List<AttendanceEntity> = withContext(Dispatchers.IO) {
        val session = dao.getSession(classId, sessionDate) ?: return@withContext emptyList()
        dao.getAttendanceForSessionDirect(session.id)
    }

    // --- Billing & Invoices ---
    val allInvoicesWithDetails: Flow<List<InvoiceWithStudent>> = combine(
        dao.getAllInvoices(),
        dao.getAllStudents(),
        dao.getAllPayments()
    ) { invoices, students, payments ->
        val studentsMap = students.associateBy { it.id }
        val paymentsByInvoice = payments.groupBy { it.invoiceId }

        invoices.map { inv ->
            val student = studentsMap[inv.studentId]
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
            InvoiceWithStudent(
                id = inv.id,
                studentId = inv.studentId,
                studentName = student?.fullName ?: "Unknown Student",
                parentName = student?.parentName ?: "—",
                billingMonth = inv.billingMonth,
                amount = inv.amount,
                discount = inv.discount,
                discountReason = inv.discountReason,
                netAmount = inv.amount - inv.discount,
                status = inv.status,
                payments = invPayments
            )
        }
    }

    suspend fun generateMonthlyInvoices(billingMonth: String): Int = withContext(Dispatchers.IO) {
        val students = dao.getAllStudentsDirect().filter { it.lifecycle == Lifecycle.ACTIVE || it.lifecycle == Lifecycle.TRIAL }
        val classes = dao.getAllClassesDirect().associateBy { it.id }
        val settings = dao.getAcademySettingsDirect()
        val defaultFee = settings?.defaultMonthlyFee ?: 80.0

        // Sibling discount: Group active students by parentPhone (or parentName)
        val studentsByPayer = students.groupBy { it.parentPhone.ifBlank { it.parentName } }

        val newInvoices = mutableListOf<InvoiceEntity>()

        studentsByPayer.forEach { (_, payerStudents) ->
            payerStudents.forEachIndexed { index, student ->
                val classIds = parseClassIds(student.classIdsJson)
                val baseFee = classIds.firstNotNullOfOrNull { classes[it]?.monthlyFeeOverride } ?: defaultFee

                // 10% discount on sibling after the first
                val discount = if (index > 0 && payerStudents.size > 1) {
                    Math.round(baseFee * 0.10 * 100.0) / 100.0
                } else 0.0
                val discountReason = if (discount > 0) "Sibling Discount (10%)" else ""

                val invId = "inv_${student.id}_${billingMonth.replace("-", "")}"
                newInvoices.add(
                    InvoiceEntity(
                        id = invId,
                        studentId = student.id,
                        billingMonth = billingMonth,
                        amount = baseFee,
                        discount = discount,
                        discountReason = discountReason,
                        status = InvoiceStatus.UNPAID
                    )
                )
            }
        }

        dao.insertInvoices(newInvoices)
        newInvoices.size
    }

    suspend fun submitCashPayment(invoiceId: String, amount: Double, submittedBy: String, notes: String) = withContext(Dispatchers.IO) {
        val paymentId = "pay_${UUID.randomUUID().toString().take(8)}"
        val payment = PaymentEntity(
            id = paymentId,
            invoiceId = invoiceId,
            amount = amount,
            method = PaymentMethod.CASH,
            submittedBy = submittedBy,
            notes = notes
        )
        dao.insertPayment(payment)
        dao.updateInvoiceStatus(invoiceId, InvoiceStatus.PENDING_APPROVAL)
    }

    suspend fun approvePayment(paymentId: String, invoiceId: String, approverId: String) = withContext(Dispatchers.IO) {
        val settings = dao.getAcademySettingsDirect()
        val prefix = settings?.prefix ?: "BF"
        val receiptNo = "$prefix-${SimpleDateFormat("yyyyMMdd", Locale.getDefault()).format(Date())}-${UUID.randomUUID().toString().take(4).uppercase(Locale.getDefault())}"

        val allPayments = dao.getAllPayments().first()
        val payment = allPayments.find { it.id == paymentId }
        if (payment != null) {
            val updatedPayment = payment.copy(
                approvedBy = approverId,
                approvedAt = System.currentTimeMillis(),
                receiptNo = receiptNo
            )
            dao.updatePayment(updatedPayment)
        }
        dao.updateInvoiceStatus(invoiceId, InvoiceStatus.PAID)
    }

    suspend fun recordDirectPayment(
        invoiceId: String,
        amount: Double,
        method: PaymentMethod,
        approverId: String,
        notes: String
    ) = withContext(Dispatchers.IO) {
        val settings = dao.getAcademySettingsDirect()
        val prefix = settings?.prefix ?: "BF"
        val receiptNo = "$prefix-${SimpleDateFormat("yyyyMMdd", Locale.getDefault()).format(Date())}-${UUID.randomUUID().toString().take(4).uppercase(Locale.getDefault())}"

        val payment = PaymentEntity(
            id = "pay_${UUID.randomUUID().toString().take(8)}",
            invoiceId = invoiceId,
            amount = amount,
            method = method,
            submittedBy = approverId,
            approvedBy = approverId,
            approvedAt = System.currentTimeMillis(),
            receiptNo = receiptNo,
            notes = notes
        )
        dao.insertPayment(payment)
        dao.updateInvoiceStatus(invoiceId, InvoiceStatus.PAID)
    }

    suspend fun updateInvoiceStatus(invoiceId: String, status: InvoiceStatus) = withContext(Dispatchers.IO) {
        dao.updateInvoiceStatus(invoiceId, status)
    }

    // --- Grading System ---
    val allGradingEventsWithRecords: Flow<List<GradingEventWithRecords>> = combine(
        dao.getAllGradingEvents(),
        dao.getAllStudents()
    ) { events, _ ->
        events.map { event ->
            val records = dao.getGradingRecordsForEvent(event.id).first()
            val passCount = records.count { it.result == GradingResultType.PASS }
            GradingEventWithRecords(
                id = event.id,
                name = event.name,
                eventDate = event.eventDate,
                location = event.location,
                examiner = event.examiner,
                fee = event.fee,
                isCompleted = event.isCompleted,
                candidateCount = records.size,
                passCount = passCount
            )
        }
    }

    fun getGradingCandidates(eventId: String): Flow<List<GradingCandidateDetail>> {
        return combine(
            dao.getGradingRecordsForEvent(eventId),
            dao.getAllStudents(),
            dao.getAllBelts()
        ) { records, students, belts ->
            val studentMap = students.associateBy { it.id }
            val beltMap = belts.associateBy { it.id }

            records.map { rec ->
                val stud = studentMap[rec.studentId]
                val fromBelt = rec.fromBeltId?.let { beltMap[it] }
                val toBelt = rec.toBeltId?.let { beltMap[it] }

                GradingCandidateDetail(
                    recordId = rec.id,
                    eventId = rec.gradingEventId,
                    studentId = rec.studentId,
                    studentName = stud?.fullName ?: "Student",
                    fromBeltName = fromBelt?.name ?: "—",
                    toBeltName = toBelt?.name ?: "—",
                    fromBeltColorHex = fromBelt?.colorHex ?: "#94A3B8",
                    toBeltColorHex = toBelt?.colorHex ?: "#3B82F6",
                    toBeltId = rec.toBeltId,
                    result = rec.result,
                    notes = rec.notes
                )
            }
        }
    }

    suspend fun addGradingEvent(
        name: String,
        eventDate: String,
        location: String,
        examiner: String,
        fee: Double
    ) = withContext(Dispatchers.IO) {
        dao.insertGradingEvent(
            GradingEventEntity(
                id = "gr_ev_${UUID.randomUUID().toString().take(8)}",
                name = name,
                eventDate = eventDate,
                location = location,
                examiner = examiner,
                fee = fee,
                isCompleted = false
            )
        )
    }

    suspend fun registerForGrading(
        eventId: String,
        studentId: String,
        fromBeltId: String?,
        toBeltId: String?
    ) = withContext(Dispatchers.IO) {
        dao.insertGradingRecord(
            GradingRecordEntity(
                id = "grec_${UUID.randomUUID().toString().take(8)}",
                gradingEventId = eventId,
                studentId = studentId,
                fromBeltId = fromBeltId,
                toBeltId = toBeltId,
                result = GradingResultType.REGISTERED
            )
        )
    }

    suspend fun recordGradingResult(
        recordId: String,
        eventId: String,
        studentId: String,
        toBeltId: String?,
        result: GradingResultType,
        notes: String
    ) = withContext(Dispatchers.IO) {
        val record = GradingRecordEntity(
            id = recordId,
            gradingEventId = eventId,
            studentId = studentId,
            fromBeltId = null,
            toBeltId = toBeltId,
            result = result,
            notes = notes,
            gradedAt = System.currentTimeMillis()
        )
        dao.updateGradingRecord(record)

        // Automatic belt promotion & digital certificate issuance upon PASS
        if (result == GradingResultType.PASS && toBeltId != null) {
            dao.updateStudentBelt(studentId, toBeltId)

            val student = dao.getStudentById(studentId)
            val belt = dao.getAllBeltsDirect().find { it.id == toBeltId }
            val beltName = belt?.name ?: "Advanced Belt"

            val certCode = "BF-${UUID.randomUUID().toString().take(6).uppercase(Locale.getDefault())}"
            val certNo = "PSMDS-GRAD-${SimpleDateFormat("yyyy", Locale.getDefault()).format(Date())}-${UUID.randomUUID().toString().take(3).uppercase(Locale.getDefault())}"

            dao.insertCertificate(
                CertificateEntity(
                    id = "cert_${UUID.randomUUID().toString().take(8)}",
                    studentId = studentId,
                    type = CertType.GRADING,
                    title = "$beltName Promotion Certificate",
                    certNo = certNo,
                    verifyCode = certCode,
                    issuedAt = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date()),
                    issuedBy = "Examiner Board & Master Ravi"
                )
            )
        }
    }

    // --- Skills Curriculum ---
    val allSkills: Flow<List<SkillEntity>> = dao.getAllSkills()

    fun getStudentSkillProgress(studentId: String): Flow<List<StudentSkillProgress>> {
        return combine(
            dao.getAllSkills(),
            dao.getSkillsForStudent(studentId)
        ) { skills, studentSkills ->
            val userSkillMap = studentSkills.associateBy { it.skillId }
            skills.map { skill ->
                val level = userSkillMap[skill.id]?.level ?: SkillLevel.NOT_STARTED
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

    suspend fun setSkillLevel(
        studentId: String,
        skillId: String,
        level: SkillLevel,
        notes: String = ""
    ) = withContext(Dispatchers.IO) {
        val entity = StudentSkillEntity(
            id = "ssk_${studentId}_$skillId",
            studentId = studentId,
            skillId = skillId,
            level = level,
            notes = notes,
            updatedAt = System.currentTimeMillis()
        )
        dao.setStudentSkillLevel(entity)
    }

    suspend fun addSkill(name: String, category: String, description: String, sortOrder: Int) = withContext(Dispatchers.IO) {
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
        val studentsMap = students.associateBy { it.id }
        val resultsByTournament = results.groupBy { it.tournamentId }

        tournaments.map { t ->
            val resList = (resultsByTournament[t.id] ?: emptyList()).map { r ->
                TournamentResultDetail(
                    id = r.id,
                    tournamentId = r.tournamentId,
                    studentId = r.studentId,
                    studentName = studentsMap[r.studentId]?.fullName ?: "Student",
                    eventCategory = r.eventCategory,
                    medal = r.medal,
                    points = r.points,
                    notes = r.notes
                )
            }
            TournamentDetail(
                id = t.id,
                name = t.name,
                eventDate = t.eventDate,
                location = t.location,
                organizer = t.organizer,
                results = resList
            )
        }
    }

    suspend fun addTournament(name: String, eventDate: String, location: String, organizer: String) = withContext(Dispatchers.IO) {
        dao.insertTournament(
            TournamentEntity(
                id = "tourn_${UUID.randomUUID().toString().take(8)}",
                name = name,
                eventDate = eventDate,
                location = location,
                organizer = organizer
            )
        )
    }

    suspend fun recordTournamentResult(
        tournamentId: String,
        studentId: String,
        eventCategory: String,
        medal: Medal,
        notes: String
    ) = withContext(Dispatchers.IO) {
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

        // If medal won, award tournament certificate
        if (medal != Medal.PARTICIPATION) {
            val certCode = "BF-ACHV-${UUID.randomUUID().toString().take(6).uppercase(Locale.getDefault())}"
            val certNo = "PSMDS-ACHV-${SimpleDateFormat("yyyy", Locale.getDefault()).format(Date())}-${UUID.randomUUID().toString().take(3).uppercase(Locale.getDefault())}"
            dao.insertCertificate(
                CertificateEntity(
                    id = "cert_${UUID.randomUUID().toString().take(8)}",
                    studentId = studentId,
                    type = CertType.TOURNAMENT,
                    title = "${medal.label} - $eventCategory",
                    certNo = certNo,
                    verifyCode = certCode,
                    issuedAt = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date()),
                    issuedBy = "Tournament Organizing Committee"
                )
            )
        }
    }

    // --- Certificates ---
    val allCertificatesWithDetails: Flow<List<CertificateDetail>> = combine(
        dao.getAllCertificates(),
        dao.getAllStudents()
    ) { certificates, students ->
        val studentsMap = students.associateBy { it.id }
        certificates.map { cert ->
            CertificateDetail(
                id = cert.id,
                studentId = cert.studentId,
                studentName = studentsMap[cert.studentId]?.fullName ?: "Student",
                type = cert.type,
                title = cert.title,
                certNo = cert.certNo,
                verifyCode = cert.verifyCode,
                issuedAt = cert.issuedAt,
                issuedBy = cert.issuedBy
            )
        }
    }

    fun getCertificatesForStudent(studentId: String): Flow<List<CertificateDetail>> {
        return allCertificatesWithDetails.map { list -> list.filter { it.studentId == studentId } }
    }

    suspend fun verifyCertificate(code: String): CertificateDetail? = withContext(Dispatchers.IO) {
        val cert = dao.getCertificateByVerifyCode(code.trim().uppercase(Locale.getDefault())) ?: return@withContext null
        val student = dao.getStudentById(cert.studentId)
        CertificateDetail(
            id = cert.id,
            studentId = cert.studentId,
            studentName = student?.fullName ?: "Student",
            type = cert.type,
            title = cert.title,
            certNo = cert.certNo,
            verifyCode = cert.verifyCode,
            issuedAt = cert.issuedAt,
            issuedBy = cert.issuedBy
        )
    }

    // --- Helpers ---
    private fun parseClassIds(json: String): List<String> {
        return try {
            val array = JSONArray(json)
            val list = mutableListOf<String>()
            for (i in 0 until array.length()) {
                list.add(array.getString(i))
            }
            list
        } catch (e: Exception) {
            emptyList()
        }
    }

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
}
