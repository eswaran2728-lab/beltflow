package com.example.beltflow.data.local

import androidx.room.*
import com.example.beltflow.data.model.*
import kotlinx.coroutines.flow.Flow

@Dao
interface BeltFlowDao {

    // --- Profiles ---
    @Query("SELECT * FROM profiles ORDER BY createdAt DESC")
    fun getAllProfiles(): Flow<List<ProfileEntity>>

    @Query("SELECT * FROM profiles WHERE id = :id LIMIT 1")
    suspend fun getProfileById(id: String): ProfileEntity?

    @Query("SELECT * FROM profiles WHERE email = :email LIMIT 1")
    suspend fun getProfileByEmail(email: String): ProfileEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertProfile(profile: ProfileEntity)

    @Update
    suspend fun updateProfile(profile: ProfileEntity)

    @Query("UPDATE profiles SET status = :status WHERE id = :id")
    suspend fun updateProfileStatus(id: String, status: ProfileStatus)

    @Query("UPDATE profiles SET studentId = :studentId WHERE id = :profileId")
    suspend fun linkProfileToStudent(profileId: String, studentId: String)

    // --- Settings ---
    @Query("SELECT * FROM academy_settings LIMIT 1")
    fun getAcademySettings(): Flow<AcademySettingsEntity?>

    @Query("SELECT * FROM academy_settings LIMIT 1")
    suspend fun getAcademySettingsDirect(): AcademySettingsEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun saveAcademySettings(settings: AcademySettingsEntity)

    // --- Belts ---
    @Query("SELECT * FROM belts ORDER BY sortOrder ASC")
    fun getAllBelts(): Flow<List<BeltEntity>>

    @Query("SELECT * FROM belts ORDER BY sortOrder ASC")
    suspend fun getAllBeltsDirect(): List<BeltEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertBelt(belt: BeltEntity)

    @Delete
    suspend fun deleteBelt(belt: BeltEntity)

    // --- Branches ---
    @Query("SELECT * FROM branches ORDER BY name ASC")
    fun getAllBranches(): Flow<List<BranchEntity>>

    @Query("SELECT * FROM branches ORDER BY name ASC")
    suspend fun getAllBranchesDirect(): List<BranchEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertBranch(branch: BranchEntity)

    @Delete
    suspend fun deleteBranch(branch: BranchEntity)

    // --- Classes ---
    @Query("SELECT * FROM classes ORDER BY name ASC")
    fun getAllClasses(): Flow<List<ClassEntity>>

    @Query("SELECT * FROM classes ORDER BY name ASC")
    suspend fun getAllClassesDirect(): List<ClassEntity>

    @Query("SELECT * FROM classes WHERE code = :code LIMIT 1")
    suspend fun getClassByCode(code: String): ClassEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertClass(classEntity: ClassEntity)

    @Update
    suspend fun updateClass(classEntity: ClassEntity)

    @Delete
    suspend fun deleteClass(classEntity: ClassEntity)

    // --- Students ---
    @Query("SELECT * FROM students ORDER BY fullName ASC")
    fun getAllStudents(): Flow<List<StudentEntity>>

    @Query("SELECT * FROM students ORDER BY fullName ASC")
    suspend fun getAllStudentsDirect(): List<StudentEntity>

    @Query("SELECT * FROM students WHERE id = :id LIMIT 1")
    suspend fun getStudentById(id: String): StudentEntity?

    @Query("SELECT * FROM students WHERE id = :id LIMIT 1")
    fun getStudentFlowById(id: String): Flow<StudentEntity?>

    @Query("SELECT * FROM students WHERE parentProfileId = :parentProfileId OR parentPhone = :phone")
    fun getStudentsForParent(parentProfileId: String, phone: String): Flow<List<StudentEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertStudent(student: StudentEntity)

    @Update
    suspend fun updateStudent(student: StudentEntity)

    @Delete
    suspend fun deleteStudent(student: StudentEntity)

    @Query("UPDATE students SET beltId = :beltId WHERE id = :studentId")
    suspend fun updateStudentBelt(studentId: String, beltId: String)

    // --- Sessions & Attendance ---
    @Query("SELECT * FROM class_sessions WHERE classId = :classId AND sessionDate = :sessionDate LIMIT 1")
    suspend fun getSession(classId: String, sessionDate: String): ClassSessionEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertSession(session: ClassSessionEntity)

    @Query("SELECT * FROM attendance WHERE sessionId = :sessionId")
    fun getAttendanceForSession(sessionId: String): Flow<List<AttendanceEntity>>

    @Query("SELECT * FROM attendance WHERE sessionId = :sessionId")
    suspend fun getAttendanceForSessionDirect(sessionId: String): List<AttendanceEntity>

    @Query("SELECT * FROM attendance WHERE studentId = :studentId ORDER BY sessionDate DESC")
    fun getAttendanceForStudent(studentId: String): Flow<List<AttendanceEntity>>

    @Query("SELECT * FROM attendance ORDER BY sessionDate DESC")
    fun getAllAttendance(): Flow<List<AttendanceEntity>>

    @Query("SELECT * FROM attendance ORDER BY sessionDate DESC")
    suspend fun getAllAttendanceDirect(): List<AttendanceEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAttendance(attendance: List<AttendanceEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertSingleAttendance(attendance: AttendanceEntity)

    // --- Invoices & Payments ---
    @Query("SELECT * FROM invoices ORDER BY billingMonth DESC, createdAt DESC")
    fun getAllInvoices(): Flow<List<InvoiceEntity>>

    @Query("SELECT * FROM invoices WHERE studentId = :studentId ORDER BY billingMonth DESC")
    fun getInvoicesForStudent(studentId: String): Flow<List<InvoiceEntity>>

    @Query("SELECT * FROM invoices WHERE id = :invoiceId LIMIT 1")
    suspend fun getInvoiceById(invoiceId: String): InvoiceEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertInvoice(invoice: InvoiceEntity)

    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insertInvoices(invoices: List<InvoiceEntity>)

    @Update
    suspend fun updateInvoice(invoice: InvoiceEntity)

    @Query("UPDATE invoices SET status = :status WHERE id = :invoiceId")
    suspend fun updateInvoiceStatus(invoiceId: String, status: InvoiceStatus)

    @Query("SELECT * FROM payments WHERE invoiceId = :invoiceId ORDER BY createdAt DESC")
    fun getPaymentsForInvoice(invoiceId: String): Flow<List<PaymentEntity>>

    @Query("SELECT * FROM payments ORDER BY createdAt DESC")
    fun getAllPayments(): Flow<List<PaymentEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertPayment(payment: PaymentEntity)

    @Update
    suspend fun updatePayment(payment: PaymentEntity)

    // --- Grading Events & Records ---
    @Query("SELECT * FROM grading_events ORDER BY eventDate DESC")
    fun getAllGradingEvents(): Flow<List<GradingEventEntity>>

    @Query("SELECT * FROM grading_events WHERE id = :id LIMIT 1")
    suspend fun getGradingEventById(id: String): GradingEventEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertGradingEvent(event: GradingEventEntity)

    @Update
    suspend fun updateGradingEvent(event: GradingEventEntity)

    @Query("SELECT * FROM grading_records WHERE gradingEventId = :eventId")
    fun getGradingRecordsForEvent(eventId: String): Flow<List<GradingRecordEntity>>

    @Query("SELECT * FROM grading_records WHERE studentId = :studentId")
    fun getGradingRecordsForStudent(studentId: String): Flow<List<GradingRecordEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertGradingRecord(record: GradingRecordEntity)

    @Update
    suspend fun updateGradingRecord(record: GradingRecordEntity)

    // --- Skills & Progress ---
    @Query("SELECT * FROM skills ORDER BY category, sortOrder ASC")
    fun getAllSkills(): Flow<List<SkillEntity>>

    @Query("SELECT * FROM skills ORDER BY category, sortOrder ASC")
    suspend fun getAllSkillsDirect(): List<SkillEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertSkill(skill: SkillEntity)

    @Delete
    suspend fun deleteSkill(skill: SkillEntity)

    @Query("SELECT * FROM student_skills WHERE studentId = :studentId")
    fun getSkillsForStudent(studentId: String): Flow<List<StudentSkillEntity>>

    @Query("SELECT * FROM student_skills WHERE studentId = :studentId AND skillId = :skillId LIMIT 1")
    suspend fun getStudentSkill(studentId: String, skillId: String): StudentSkillEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun setStudentSkillLevel(studentSkill: StudentSkillEntity)

    // --- Instructor Notes ---
    @Query("SELECT * FROM instructor_notes WHERE studentId = :studentId ORDER BY createdAt DESC")
    fun getNotesForStudent(studentId: String): Flow<List<InstructorNoteEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertNote(note: InstructorNoteEntity)

    @Delete
    suspend fun deleteNote(note: InstructorNoteEntity)

    // --- Tournaments & Results ---
    @Query("SELECT * FROM tournaments ORDER BY eventDate DESC")
    fun getAllTournaments(): Flow<List<TournamentEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertTournament(tournament: TournamentEntity)

    @Query("SELECT * FROM tournament_results WHERE tournamentId = :tournamentId")
    fun getResultsForTournament(tournamentId: String): Flow<List<TournamentResultEntity>>

    @Query("SELECT * FROM tournament_results WHERE studentId = :studentId")
    fun getResultsForStudent(studentId: String): Flow<List<TournamentResultEntity>>

    @Query("SELECT * FROM tournament_results")
    fun getAllTournamentResults(): Flow<List<TournamentResultEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertTournamentResult(result: TournamentResultEntity)

    // --- Certificates ---
    @Query("SELECT * FROM certificates ORDER BY issuedAt DESC")
    fun getAllCertificates(): Flow<List<CertificateEntity>>

    @Query("SELECT * FROM certificates WHERE studentId = :studentId ORDER BY issuedAt DESC")
    fun getCertificatesForStudent(studentId: String): Flow<List<CertificateEntity>>

    @Query("SELECT * FROM certificates WHERE verifyCode = :code LIMIT 1")
    suspend fun getCertificateByVerifyCode(code: String): CertificateEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertCertificate(certificate: CertificateEntity)
}
