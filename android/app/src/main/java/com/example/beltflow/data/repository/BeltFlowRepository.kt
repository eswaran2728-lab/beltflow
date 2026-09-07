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

        // Dedicated Super Admin handling
        if (cleanEmail == "superadmin@beltflow.my") {
            if (cleanPassword == "BeltFlow2026@") {
                var superAdmin = dao.getProfileByEmail("superadmin@beltflow.my")
                if (superAdmin == null) {
                    superAdmin = ProfileEntity(
                        id = "prof_super_admin",
                        fullName = "Admin BeltFlow (Super Admin)",
                        email = "superadmin@beltflow.my",
                        phone = "+60 12-000 0000",
                        role = UserRole.SUPER_ADMIN,
                        status = ProfileStatus.APPROVED,
                        organizationId = null,
                        password = "BeltFlow2026@"
                    )
                    dao.insertProfile(superAdmin)
                }
                val authUser = AuthUser(
                    id = superAdmin.id,
                    fullName = superAdmin.fullName,
                    email = superAdmin.email,
                    role = UserRole.SUPER_ADMIN,
                    status = ProfileStatus.APPROVED,
                    organizationId = null
                )
                _currentUser.value = authUser
                return@withContext Result.success(authUser)
            } else {
                return@withContext Result.failure(Exception("Incorrect password for Super Admin account."))
            }
        }

        // Dedicated Admin Persatuan handling for Master Eswaran
        if (cleanEmail == "eswaran2728@gmail.com") {
            if (cleanPassword == "Eswaran0321@") {
                var admin = dao.getProfileByEmail("eswaran2728@gmail.com")
                if (admin == null) {
                    admin = ProfileEntity(
                        id = "prof_admin_eswaran",
                        fullName = "Master Eswaran",
                        email = "eswaran2728@gmail.com",
                        phone = "+60 12-345 6789",
                        role = UserRole.ADMIN_PERSATUAN,
                        status = ProfileStatus.APPROVED,
                        organizationId = "persatuan_selangor",
                        password = "Eswaran0321@"
                    )
                    dao.insertProfile(admin)
                }
                val authUser = AuthUser(
                    id = admin.id,
                    fullName = admin.fullName,
                    email = admin.email,
                    role = UserRole.ADMIN_PERSATUAN,
                    status = ProfileStatus.APPROVED,
                    organizationId = "persatuan_selangor"
                )
                _currentUser.value = authUser
                return@withContext Result.success(authUser)
            } else {
                return@withContext Result.failure(Exception("Incorrect password for Admin Persatuan account."))
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
            return@withContext Result.failure(Exception("Your account is awaiting approval."))
        }

        if (profile.status == ProfileStatus.REJECTED) {
            return@withContext Result.failure(Exception("Your account application was rejected."))
        }

        val authUser = AuthUser(
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
        _currentUser.value = authUser
        return@withContext Result.success(authUser)
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
        plan: SubscriptionPlan,
        chargePercent: Double
    ) = withContext(Dispatchers.IO) {
        val orgId = "persatuan_${UUID.randomUUID().toString().take(6)}"
        val persatuan = PersatuanEntity(
            id = orgId,
            name = name,
            email = adminEmail,
            subscriptionPlan = plan,
            platformChargeRatePercent = chargePercent
        )
        dao.insertPersatuan(persatuan)

        // Create initial Persatuan Admin profile
        val adminProfile = ProfileEntity(
            id = "prof_admin_${UUID.randomUUID().toString().take(6)}",
            fullName = adminFullName,
            email = adminEmail,
            role = UserRole.ADMIN_PERSATUAN,
            status = ProfileStatus.APPROVED,
            organizationId = orgId,
            password = "Persatuan@2026"
        )
        dao.insertProfile(adminProfile)
    }

    // --- Profiles ---
    val allProfiles: Flow<List<ProfileEntity>> = dao.getAllProfiles()

    suspend fun registerUser(
        fullName: String,
        email: String,
        phone: String,
        role: UserRole,
        childName: String = "",
        assignedClass: String = "",
        password: String
    ): Result<Unit> = withContext(Dispatchers.IO) {
        val cleanEmail = email.trim().lowercase(Locale.getDefault())
        if (dao.getProfileByEmail(cleanEmail) != null) {
            return@withContext Result.failure(Exception("An account with this email already exists."))
        }

        // Students need Master approval, Masters need Admin approval, Parents need Admin approval
        val initialStatus = when (role) {
            UserRole.STUDENT -> ProfileStatus.PENDING
            UserRole.MASTER -> ProfileStatus.PENDING
            UserRole.PARENT -> ProfileStatus.APPROVED
            UserRole.ADMIN_PERSATUAN -> ProfileStatus.APPROVED
            UserRole.SUPER_ADMIN -> ProfileStatus.APPROVED
        }

        val profileId = "prof_${role.name.lowercase()}_${UUID.randomUUID().toString().take(6)}"

        var studentId: String? = null
        if (role == UserRole.STUDENT) {
            studentId = "stud_${UUID.randomUUID().toString().take(8)}"
            val defaultBelt = dao.getAllBeltsDirect().firstOrNull()?.id ?: "belt_1"
            val studentEntity = StudentEntity(
                id = studentId,
                organizationId = "persatuan_selangor",
                profileId = profileId,
                fullName = fullName,
                beltId = defaultBelt,
                parentName = childName,
                parentPhone = phone,
                classIdsJson = if (assignedClass.isNotBlank()) "[\"$assignedClass\"]" else "[]"
            )
            dao.insertStudent(studentEntity)
        }

        val profile = ProfileEntity(
            id = profileId,
            fullName = fullName,
            email = cleanEmail,
            phone = phone,
            role = role,
            status = initialStatus,
            organizationId = "persatuan_selangor",
            childName = childName,
            assignedClass = assignedClass,
            studentId = studentId,
            password = password
        )
        dao.insertProfile(profile)
        return@withContext Result.success(Unit)
    }

    suspend fun updateProfileStatus(profileId: String, status: ProfileStatus) = withContext(Dispatchers.IO) {
        dao.updateProfileStatus(profileId, status)
    }

    // --- Parent-Child 3-Way Approval Links ---
    val allParentChildLinks: Flow<List<ParentChildLinkEntity>> = dao.getAllParentChildLinks()

    suspend fun requestParentChildLink(parentProfileId: String, studentId: String) = withContext(Dispatchers.IO) {
        val link = ParentChildLinkEntity(
            id = "link_${UUID.randomUUID().toString().take(8)}",
            organizationId = "persatuan_selangor",
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
        // Implement transfer approval
    }

    // --- Audit Logs ---
    val allAuditLogs: Flow<List<AuditLogEntity>> = dao.getAllAuditLogs()

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
                organizationId = "persatuan_selangor",
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
                authorId = authorId,
                authorName = authorName,
                authorRole = authorRole,
                title = title,
                content = content,
                classId = classId,
                status = status
            )
        )
    }

    // --- Settings & Belts & Branches & Classes ---
    val academySettings: Flow<AcademySettingsEntity?> = dao.getAcademySettings()
    val allBelts: Flow<List<BeltEntity>> = dao.getAllBelts()
    val allBranches: Flow<List<BranchEntity>> = dao.getAllBranches()
    val allClasses: Flow<List<ClassEntity>> = dao.getAllClasses()

    suspend fun saveAcademySettings(settings: AcademySettingsEntity) = withContext(Dispatchers.IO) {
        dao.saveAcademySettings(settings)
    }

    suspend fun addBranch(name: String, address: String, phone: String) = withContext(Dispatchers.IO) {
        dao.insertBranch(BranchEntity("br_${UUID.randomUUID().toString().take(6)}", "persatuan_selangor", name, address, phone))
    }

    suspend fun deleteBranch(branch: BranchEntity) = withContext(Dispatchers.IO) {
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
        val classId = "cls_${UUID.randomUUID().toString().take(6)}"
        val newClass = ClassEntity(
            id = classId,
            organizationId = "persatuan_selangor",
            branchId = branchId,
            name = name,
            code = code,
            dayOfWeek = dayOfWeek,
            startTime = startTime,
            endTime = endTime,
            scheduleNote = "Day $dayOfWeek $startTime - $endTime",
            monthlyFeeOverride = monthlyFee,
            coachName = coachName
        )
        dao.insertClass(newClass)
    }

    suspend fun deleteClass(classEntity: ClassEntity) = withContext(Dispatchers.IO) {
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

    fun getStudentDetailsFlow(studentId: String): Flow<StudentWithDetails?> {
        return studentsWithDetails.map { list -> list.find { it.id == studentId } }
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
    ) = withContext(Dispatchers.IO) {
        val studentId = "stud_${UUID.randomUUID().toString().take(8)}"
        val classJson = JSONArray(classIds).toString()
        val student = StudentEntity(
            id = studentId,
            organizationId = "persatuan_selangor",
            fullName = fullName,
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
    }

    suspend fun updateStudent(student: StudentEntity) = withContext(Dispatchers.IO) {
        dao.updateStudent(student)
    }

    suspend fun deleteStudent(studentId: String) = withContext(Dispatchers.IO) {
        val student = dao.getStudentById(studentId)
        if (student != null) {
            dao.deleteStudent(student)
        }
    }

    suspend fun updateStudentBelt(studentId: String, beltId: String) = withContext(Dispatchers.IO) {
        dao.updateStudentBelt(studentId, beltId)
    }

    // --- Attendance ---
    fun getAttendanceForSession(sessionId: String): Flow<List<AttendanceEntity>> = dao.getAttendanceForSession(sessionId)
    fun getAttendanceForStudent(studentId: String): Flow<List<AttendanceEntity>> = dao.getAttendanceForStudent(studentId)

    suspend fun markSessionAttendance(
        classId: String,
        sessionDate: String,
        attendanceList: List<Pair<String, AttendanceStatus>>
    ) = withContext(Dispatchers.IO) {
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
    }

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

    suspend fun generateMonthlyInvoicesForClass(classId: String, billingMonth: String) = withContext(Dispatchers.IO) {
        val classObj = dao.getAllClassesDirect().find { it.id == classId } ?: return@withContext
        val allStudents = dao.getAllStudentsDirect()
        val classStudents = allStudents.filter { parseClassIds(it.classIdsJson).contains(classId) }

        val invoicesToInsert = mutableListOf<InvoiceEntity>()
        classStudents.forEach { student ->
            val invoiceId = "inv_${student.id}_${billingMonth.replace("-", "")}"
            val inv = InvoiceEntity(
                id = invoiceId,
                studentId = student.id,
                billingMonth = billingMonth,
                amount = classObj.monthlyFee,
                discount = 0.0,
                status = InvoiceStatus.UNPAID
            )
            invoicesToInsert.add(inv)
        }
        dao.insertInvoices(invoicesToInsert)
    }

    suspend fun submitPayment(invoiceId: String, amount: Double, method: PaymentMethod, notes: String) = withContext(Dispatchers.IO) {
        val receiptNo = "REC-${SimpleDateFormat("yyyyMMdd", Locale.getDefault()).format(Date())}-${UUID.randomUUID().toString().take(4).uppercase(Locale.getDefault())}"
        val payment = PaymentEntity(
            id = "pay_${UUID.randomUUID().toString().take(8)}",
            invoiceId = invoiceId,
            amount = amount,
            method = method,
            submittedBy = _currentUser.value?.fullName ?: "User",
            approvedBy = "Master Eswaran",
            approvedAt = System.currentTimeMillis(),
            receiptNo = receiptNo,
            notes = notes
        )
        dao.insertPayment(payment)
        dao.updateInvoiceStatus(invoiceId, InvoiceStatus.PAID)
    }

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
        dao.insertGradingEvent(
            GradingEventEntity(
                id = "gev_${UUID.randomUUID().toString().take(6)}",
                organizationId = "persatuan_selangor",
                name = name,
                eventDate = eventDate,
                location = location,
                examiner = examiner,
                fee = fee
            )
        )
    }

    suspend fun registerStudentForGrading(eventId: String, studentId: String, targetBeltId: String) = withContext(Dispatchers.IO) {
        val student = dao.getStudentById(studentId) ?: return@withContext
        val record = GradingRecordEntity(
            id = "grec_${eventId}_${studentId}",
            gradingEventId = eventId,
            studentId = studentId,
            fromBeltId = student.beltId,
            toBeltId = targetBeltId,
            result = GradingResultType.REGISTERED
        )
        dao.insertGradingRecord(record)
    }

    suspend fun scoreGradingCandidate(recordId: String, result: GradingResultType, notes: String) = withContext(Dispatchers.IO) {
        // Implement scoring logic
    }

    // --- Skills & Progress ---
    val allSkills: Flow<List<SkillEntity>> = dao.getAllSkills()

    fun getStudentSkillsProgress(studentId: String): Flow<List<StudentSkillProgress>> {
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

    suspend fun setStudentSkillLevel(studentId: String, skillId: String, level: SkillLevel) = withContext(Dispatchers.IO) {
        val entity = StudentSkillEntity(
            id = "sskill_${studentId}_$skillId",
            studentId = studentId,
            skillId = skillId,
            level = level
        )
        dao.setStudentSkillLevel(entity)
    }

    // --- Tournaments ---
    val allTournaments: Flow<List<TournamentEntity>> = dao.getAllTournaments()

    suspend fun addTournament(name: String, eventDate: String, location: String, organizer: String) = withContext(Dispatchers.IO) {
        dao.insertTournament(
            TournamentEntity(
                id = "tourn_${UUID.randomUUID().toString().take(8)}",
                organizationId = "persatuan_selangor",
                name = name,
                eventDate = eventDate,
                location = location,
                organizer = organizer
            )
        )
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
                issuedBy = cert.issuedBy,
                academyName = "Persatuan Taekwondo Selangor"
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
            issuedBy = cert.issuedBy,
            academyName = "Persatuan Taekwondo Selangor"
        )
    }

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
