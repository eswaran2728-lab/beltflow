package com.example.beltflow.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.beltflow.data.model.*
import com.example.beltflow.ui.components.*
import com.example.beltflow.ui.theme.*
import com.example.beltflow.ui.viewmodels.BeltFlowViewModel
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

enum class MasterHubTab(val label: String, val icon: androidx.compose.ui.graphics.vector.ImageVector) {
    OVERVIEW("Overview", Icons.Default.Dashboard),
    STUDENTS("Students", Icons.Default.People),
    INSTRUCTORS("Instructors", Icons.Default.ManageAccounts),
    FINANCE("Fees & Cash", Icons.Default.Payments),
    GRADING("Grading", Icons.Default.MilitaryTech),
    SKILLS("Skills", Icons.Default.Checklist),
    TOURNAMENTS("Tournaments", Icons.Default.EmojiEvents),
    ANNOUNCEMENTS("Notices", Icons.Default.Campaign)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MasterPortalScreen(
    viewModel: BeltFlowViewModel,
    onNavigateToAttendance: () -> Unit,
    onNavigateToGrading: () -> Unit,
    onNavigateToCurriculum: () -> Unit,
    onNavigateToTournaments: () -> Unit,
    onNavigateToCertificates: () -> Unit,
    onStudentClick: (String) -> Unit,
    onLogout: () -> Unit,
    onSwitchUser: ((String) -> Unit)? = null
) {
    val currentUser by viewModel.currentUser.collectAsState()
    val allClasses by viewModel.allClasses.collectAsState()
    val allStudents by viewModel.allStudents.collectAsState()
    val allInvoices by viewModel.allInvoices.collectAsState()
    val allProfiles by viewModel.allProfiles.collectAsState()
    val allGradingEvents by viewModel.allGradingEvents.collectAsState()
    val allTournaments by viewModel.allTournaments.collectAsState()
    val allSkills by viewModel.allSkills.collectAsState()
    val allAnnouncements by viewModel.allAnnouncements.collectAsState()
    val allClassTransfers by viewModel.allClassTransfers.collectAsState()
    val allParentChildLinks by viewModel.allParentChildLinks.collectAsState()
    val allClassMasterCrossRefs by viewModel.allClassMasterCrossRefs.collectAsState()

    var selectedTab by remember { mutableStateOf(MasterHubTab.OVERVIEW) }
    var selectedClassId by remember { mutableStateOf<String?>(null) }

    // Dialog States
    var showRecordCashDialog by remember { mutableStateOf(false) }
    var showAddMasterDialog by remember { mutableStateOf(false) }
    var showQuickAnnouncementDialog by remember { mutableStateOf(false) }
    var showSkillUpdateDialog by remember { mutableStateOf<StudentWithDetails?>(null) }
    var showReceiptDialog by remember { mutableStateOf<Pair<InvoiceWithStudent, PaymentWithReceipt>?>(null) }

    // Filter assigned classes for the current Master
    val assignedClasses = remember(allClasses, allClassMasterCrossRefs, currentUser) {
        val user = currentUser
        if (user == null) emptyList()
        else {
            val classIdsAssigned = allClassMasterCrossRefs
                .filter { it.masterProfileId == user.id }
                .map { it.classId }
                .toSet()

            allClasses.filter { cls ->
                classIdsAssigned.contains(cls.id) || cls.mainMasterId == user.id || cls.coachName.contains(user.fullName, true)
            }.ifEmpty { allClasses }
        }
    }

    // Active selected class
    val currentClass = remember(assignedClasses, selectedClassId) {
        assignedClasses.find { it.id == selectedClassId } ?: assignedClasses.firstOrNull()
    }

    // Determine if the current Master is the MAIN MASTER for the selected class
    val isMainMaster = remember(currentClass, currentUser, allClassMasterCrossRefs) {
        val user = currentUser
        val cls = currentClass
        if (user == null || cls == null) false
        else {
            val cr = allClassMasterCrossRefs.find { it.classId == cls.id && it.masterProfileId == user.id }
            cr?.isMainMaster == true || cls.mainMasterId == user.id
        }
    }

    // Students in the active class
    val classStudents = remember(allStudents, currentClass) {
        val cls = currentClass
        if (cls == null) allStudents
        else {
            allStudents.filter { st ->
                st.classIds.contains(cls.id) || st.classNames.any { it.equals(cls.name, ignoreCase = true) }
            }
        }
    }

    // Pending student approvals (Self-registered students requiring Master approval)
    val pendingStudentProfiles = remember(allProfiles) {
        allProfiles.filter { it.role == UserRole.STUDENT && it.status == ProfileStatus.PENDING }
    }

    // Pending 3-way parent-child links needing Master approval
    val pendingParentLinks = remember(allParentChildLinks) {
        allParentChildLinks.filter { it.status == LinkApprovalStatus.PENDING_MASTER || (!it.masterApproved && it.studentApproved) }
    }

    // Pending 2-step class transfers
    val pendingClassTransfers = remember(allClassTransfers) {
        allClassTransfers.filter { it.status == ClassTransferStatus.PENDING_OLD_MASTER || it.status == ClassTransferStatus.PENDING_NEW_MASTER }
    }

    // Pending cash invoice approvals
    val pendingCashInvoices = remember(allInvoices) {
        allInvoices.filter { it.status == InvoiceStatus.PENDING_APPROVAL }
    }

    Scaffold(
        topBar = {
            TopNavBar(
                title = "Master Operations Command",
                currentUser = currentUser,
                onSwitchUser = { email ->
                    if (onSwitchUser != null) {
                        onSwitchUser(email)
                    } else {
                        viewModel.loginAs(email) {}
                    }
                },
                onLogout = onLogout
            )
        },
        containerColor = BlueprintBg
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            // Master Header & Class Selector Strip
            Surface(
                color = BrandNavy,
                shadowElevation = 2.dp,
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Surface(
                                shape = CircleShape,
                                color = AccentAmber500,
                                modifier = Modifier.size(46.dp)
                            ) {
                                Box(contentAlignment = Alignment.Center) {
                                    Icon(
                                        imageVector = Icons.Default.SportsMartialArts,
                                        contentDescription = null,
                                        tint = BrandNavyDeep,
                                        modifier = Modifier.size(28.dp)
                                    )
                                }
                            }
                            Spacer(modifier = Modifier.width(12.dp))
                            Column {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Text(
                                        text = currentUser?.fullName ?: "Master",
                                        style = MaterialTheme.typography.titleMedium,
                                        fontWeight = FontWeight.Bold,
                                        color = Color.White
                                    )
                                    Spacer(modifier = Modifier.width(8.dp))
                                    if (isMainMaster) {
                                        Surface(
                                            color = AccentAmber400,
                                            shape = RoundedCornerShape(6.dp)
                                        ) {
                                            Text(
                                                text = "MAIN MASTER",
                                                color = Slate900,
                                                style = MaterialTheme.typography.labelSmall,
                                                fontWeight = FontWeight.ExtraBold,
                                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                            )
                                        }
                                    } else {
                                        Surface(
                                            color = Slate700,
                                            shape = RoundedCornerShape(6.dp)
                                        ) {
                                            Text(
                                                text = "MASTER",
                                                color = Slate200,
                                                style = MaterialTheme.typography.labelSmall,
                                                fontWeight = FontWeight.Bold,
                                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                            )
                                        }
                                    }
                                }
                                Text(
                                    text = "Persatuan Silambam Daerah Sepang • Active Class: ${currentClass?.name ?: "All Classes"}",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = AccentAmber200,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    // Class Selector Pills (if multiple classes assigned)
                    if (assignedClasses.size > 1) {
                        LazyRow(
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            items(assignedClasses) { cls ->
                                val isSelected = currentClass?.id == cls.id
                                FilterChip(
                                    selected = isSelected,
                                    onClick = { selectedClassId = cls.id },
                                    label = { Text(cls.name, fontSize = 12.sp) },
                                    leadingIcon = {
                                        Icon(
                                            Icons.Default.School,
                                            contentDescription = null,
                                            modifier = Modifier.size(14.dp)
                                        )
                                    },
                                    colors = FilterChipDefaults.filterChipColors(
                                        containerColor = Navy700,
                                        labelColor = Color.White,
                                        iconColor = AccentAmber300,
                                        selectedContainerColor = AccentAmber500,
                                        selectedLabelColor = BrandNavyDeep,
                                        selectedLeadingIconColor = BrandNavyDeep
                                    ),
                                    border = null
                                )
                            }
                        }
                    }
                }
            }

            // Master Hub Navigation Tabs (Horizontal Scrollable)
            ScrollableTabRow(
                selectedTabIndex = selectedTab.ordinal,
                containerColor = Color.White,
                contentColor = BrandNavy,
                edgePadding = 12.dp,
                divider = { HorizontalDivider(color = Slate200) }
            ) {
                MasterHubTab.values().forEach { tab ->
                    Tab(
                        selected = selectedTab == tab,
                        onClick = { selectedTab = tab },
                        text = {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(
                                    imageVector = tab.icon,
                                    contentDescription = tab.label,
                                    modifier = Modifier.size(16.dp),
                                    tint = if (selectedTab == tab) BrandNavy else Slate500
                                )
                                Spacer(modifier = Modifier.width(6.dp))
                                Text(
                                    text = tab.label,
                                    fontWeight = if (selectedTab == tab) FontWeight.Bold else FontWeight.Medium,
                                    color = if (selectedTab == tab) BrandNavy else Slate600
                                )
                            }
                        }
                    )
                }
            }

            // Tab Content Body
            Box(modifier = Modifier.weight(1f)) {
                when (selectedTab) {
                    MasterHubTab.OVERVIEW -> {
                        MasterOverviewContent(
                            currentClass = currentClass,
                            isMainMaster = isMainMaster,
                            classStudents = classStudents,
                            pendingStudentProfiles = pendingStudentProfiles,
                            pendingParentLinks = pendingParentLinks,
                            pendingClassTransfers = pendingClassTransfers,
                            pendingCashInvoices = pendingCashInvoices,
                            onNavigateToAttendance = onNavigateToAttendance,
                            onNavigateToGrading = onNavigateToGrading,
                            onNavigateToCurriculum = onNavigateToCurriculum,
                            onRecordCash = { showRecordCashDialog = true },
                            onPostNotice = { showQuickAnnouncementDialog = true },
                            onApproveStudent = { profileId -> viewModel.approveProfile(profileId) },
                            onRejectStudent = { profileId -> viewModel.rejectProfile(profileId) },
                            onApproveParentLink = { linkId -> viewModel.approveParentChildLinkStep(linkId) },
                            onApproveTransfer = { transferId -> viewModel.approveClassTransferStep(transferId, true) },
                            onApprovePayment = { paymentId, invoiceId -> viewModel.approvePayment(paymentId, invoiceId) }
                        )
                    }

                    MasterHubTab.STUDENTS -> {
                        MasterStudentsContent(
                            students = classStudents,
                            pendingProfiles = pendingStudentProfiles,
                            onStudentClick = onStudentClick,
                            onRateSkill = { student -> showSkillUpdateDialog = student },
                            onApproveStudent = { profileId -> viewModel.approveProfile(profileId) },
                            onRejectStudent = { profileId -> viewModel.rejectProfile(profileId) }
                        )
                    }

                    MasterHubTab.INSTRUCTORS -> {
                        MasterInstructorsContent(
                            currentClass = currentClass,
                            isMainMaster = isMainMaster,
                            allProfiles = allProfiles,
                            allClassMasterCrossRefs = allClassMasterCrossRefs,
                            onAddMasterClick = { showAddMasterDialog = true },
                            onRemoveMaster = { masterId ->
                                currentClass?.let { viewModel.removeMasterFromClass(it.id, masterId) }
                            },
                            onSetMainMaster = { masterId ->
                                currentClass?.let { viewModel.setMainMasterForClass(it.id, masterId) }
                            }
                        )
                    }

                    MasterHubTab.FINANCE -> {
                        MasterFinanceContent(
                            currentClass = currentClass,
                            classStudents = classStudents,
                            invoices = allInvoices,
                            onRecordCashClick = { showRecordCashDialog = true },
                            onApprovePayment = { paymentId, invoiceId -> viewModel.approvePayment(paymentId, invoiceId) },
                            onViewReceipt = { inv, pay -> showReceiptDialog = Pair(inv, pay) }
                        )
                    }

                    MasterHubTab.GRADING -> {
                        MasterGradingContent(
                            gradingEvents = allGradingEvents,
                            classStudents = classStudents,
                            onNavigateToGrading = onNavigateToGrading,
                            onRegisterStudent = { eventId, studentId, fromBelt, toBelt ->
                                viewModel.registerForGrading(eventId, studentId, fromBelt, toBelt)
                            }
                        )
                    }

                    MasterHubTab.SKILLS -> {
                        MasterSkillsContent(
                            classStudents = classStudents,
                            skills = allSkills,
                            onUpdateSkill = { studentId, skillId, level, notes ->
                                viewModel.updateStudentSkill(studentId, skillId, level, notes)
                            }
                        )
                    }

                    MasterHubTab.TOURNAMENTS -> {
                        MasterTournamentsContent(
                            tournaments = allTournaments,
                            classStudents = classStudents,
                            onNavigateToTournaments = onNavigateToTournaments,
                            onRecordResult = { tournId, studentId, cat, medal, notes ->
                                viewModel.recordTournamentResult(tournId, studentId, cat, medal, notes)
                            }
                        )
                    }

                    MasterHubTab.ANNOUNCEMENTS -> {
                        MasterAnnouncementsContent(
                            announcements = allAnnouncements,
                            currentClass = currentClass,
                            onPostAnnouncement = { title, content ->
                                viewModel.addAnnouncement(title, content, currentClass?.id)
                            },
                            onApprove = { id -> viewModel.approveAnnouncement(id) },
                            onReject = { id -> viewModel.rejectAnnouncement(id) }
                        )
                    }
                }
            }
        }
    }

    // Dialogs
    if (showRecordCashDialog) {
        RecordCashPaymentDialog(
            students = classStudents,
            invoices = allInvoices,
            onDismiss = { showRecordCashDialog = false },
            onConfirm = { invoiceId, amount, notes ->
                viewModel.recordDirectPayment(
                    invoiceId = invoiceId,
                    amount = amount,
                    method = PaymentMethod.CASH,
                    notes = notes
                ) {
                    showRecordCashDialog = false
                }
            }
        )
    }

    if (showAddMasterDialog && currentClass != null) {
        val masterProfiles = allProfiles.filter { it.role == UserRole.MASTER }
        AddMasterToClassDialog(
            currentClass = currentClass,
            availableMasters = masterProfiles,
            onDismiss = { showAddMasterDialog = false },
            onAdd = { masterId, asMain ->
                viewModel.addMasterToClass(currentClass.id, masterId, asMain)
                showAddMasterDialog = false
            }
        )
    }

    if (showQuickAnnouncementDialog) {
        CreateAnnouncementDialog(
            currentClass = currentClass,
            onDismiss = { showQuickAnnouncementDialog = false },
            onPost = { title, content ->
                viewModel.addAnnouncement(title, content, currentClass?.id)
                showQuickAnnouncementDialog = false
            }
        )
    }

    showSkillUpdateDialog?.let { student ->
        QuickSkillRateDialog(
            student = student,
            skills = allSkills,
            onDismiss = { showSkillUpdateDialog = null },
            onSave = { skillId, level, note ->
                viewModel.updateStudentSkill(student.id, skillId, level, note)
                showSkillUpdateDialog = null
            }
        )
    }

    showReceiptDialog?.let { (invoice, payment) ->
        ReceiptDialog(
            invoice = invoice,
            payment = payment,
            onDismiss = { showReceiptDialog = null }
        )
    }
}

// -------------------------------------------------------------------------------------------------
// TAB 1: MASTER OVERVIEW CONTENT
// -------------------------------------------------------------------------------------------------
@Composable
private fun MasterOverviewContent(
    currentClass: ClassEntity?,
    isMainMaster: Boolean,
    classStudents: List<StudentWithDetails>,
    pendingStudentProfiles: List<ProfileEntity>,
    pendingParentLinks: List<ParentChildLinkEntity>,
    pendingClassTransfers: List<ClassTransferRequestEntity>,
    pendingCashInvoices: List<InvoiceWithStudent>,
    onNavigateToAttendance: () -> Unit,
    onNavigateToGrading: () -> Unit,
    onNavigateToCurriculum: () -> Unit,
    onRecordCash: () -> Unit,
    onPostNotice: () -> Unit,
    onApproveStudent: (String) -> Unit,
    onRejectStudent: (String) -> Unit,
    onApproveParentLink: (String) -> Unit,
    onApproveTransfer: (String) -> Unit,
    onApprovePayment: (String, String) -> Unit
) {
    val atRiskStudents = classStudents.filter { it.isAtRisk }
    val totalStudents = classStudents.size
    val averageAttendance = if (classStudents.isNotEmpty()) classStudents.map { it.attendanceRate }.average().toInt() else 100

    LazyColumn(
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
        modifier = Modifier.fillMaxSize()
    ) {
        // Quick Action Command Buttons
        item {
            Card(
                shape = RoundedCornerShape(14.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                border = BorderStroke(1.dp, Slate200),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(14.dp)) {
                    Text(
                        text = "Master Quick Actions",
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold,
                        color = BrandNavy
                    )
                    Spacer(modifier = Modifier.height(10.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Button(
                            onClick = onNavigateToAttendance,
                            colors = ButtonDefaults.buttonColors(containerColor = BrandNavy),
                            shape = RoundedCornerShape(8.dp),
                            modifier = Modifier.weight(1f)
                        ) {
                            Icon(Icons.Default.FactCheck, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("Attendance", fontSize = 13.sp, fontWeight = FontWeight.Bold)
                        }

                        Button(
                            onClick = onRecordCash,
                            colors = ButtonDefaults.buttonColors(containerColor = Emerald600),
                            shape = RoundedCornerShape(8.dp),
                            modifier = Modifier.weight(1f)
                        ) {
                            Icon(Icons.Default.PointOfSale, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("Collect Cash", fontSize = 13.sp, fontWeight = FontWeight.Bold)
                        }

                        OutlinedButton(
                            onClick = onPostNotice,
                            shape = RoundedCornerShape(8.dp),
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = BrandNavy),
                            border = BorderStroke(1.dp, Slate300),
                            modifier = Modifier.weight(1f)
                        ) {
                            Icon(Icons.Default.Campaign, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("Notice", fontSize = 13.sp)
                        }
                    }
                }
            }
        }

        // Operational KPI Metrics
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                StatCard(
                    title = "Trainees",
                    value = "$totalStudents",
                    subtitle = "${currentClass?.code ?: "All"}",
                    icon = Icons.Default.Groups,
                    accentColor = BrandNavy,
                    modifier = Modifier.weight(1f)
                )

                StatCard(
                    title = "Attendance",
                    value = "$averageAttendance%",
                    subtitle = "${atRiskStudents.size} At-Risk",
                    icon = Icons.Default.FactCheck,
                    accentColor = if (atRiskStudents.isNotEmpty()) Crimson600 else Emerald600,
                    modifier = Modifier.weight(1f)
                )

                StatCard(
                    title = "Pending Approvals",
                    value = "${pendingStudentProfiles.size + pendingParentLinks.size + pendingCashInvoices.size}",
                    subtitle = "Action required",
                    icon = Icons.Default.PendingActions,
                    accentColor = AccentAmber700,
                    modifier = Modifier.weight(1f)
                )
            }
        }

        // Urgent Approvals Queue Section
        if (pendingStudentProfiles.isNotEmpty() || pendingParentLinks.isNotEmpty() || pendingCashInvoices.isNotEmpty() || pendingClassTransfers.isNotEmpty()) {
            item {
                BlueprintCard(
                    backgroundColor = AccentAmber50,
                    borderColor = AccentAmber300,
                    cornerColor = AccentAmber700,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(14.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.NotificationImportant, contentDescription = null, tint = AccentAmber700)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = "Pending Master Approvals Queue",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold,
                                color = BrandNavyDeep
                            )
                        }

                        Spacer(modifier = Modifier.height(10.dp))

                        // 1. Pending Student Registrations
                        pendingStudentProfiles.forEach { profile ->
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 4.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text("New Student: ${profile.fullName}", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.bodyMedium)
                                    Text("Email: ${profile.email} • Self-Registered", style = MaterialTheme.typography.bodySmall, color = Slate600)
                                }
                                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                    Button(
                                        onClick = { onApproveStudent(profile.id) },
                                        colors = ButtonDefaults.buttonColors(containerColor = Emerald600),
                                        contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp),
                                        shape = RoundedCornerShape(6.dp)
                                    ) {
                                        Text("Approve", fontSize = 11.sp)
                                    }
                                    OutlinedButton(
                                        onClick = { onRejectStudent(profile.id) },
                                        contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp),
                                        shape = RoundedCornerShape(6.dp)
                                    ) {
                                        Text("Reject", fontSize = 11.sp, color = Crimson600)
                                    }
                                }
                            }
                            HorizontalDivider(color = AccentAmber200, modifier = Modifier.padding(vertical = 4.dp))
                        }

                        // 2. Pending Cash Payment Receipts
                        pendingCashInvoices.forEach { inv ->
                            val pendingPay = inv.payments.find { it.approvedBy == null }
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 4.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text("Cash Payment: ${inv.studentName}", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.bodyMedium)
                                    Text("RM %.2f • Month ${inv.billingMonth}".format(inv.netAmount), style = MaterialTheme.typography.bodySmall, color = Slate600)
                                }
                                if (pendingPay != null) {
                                    Button(
                                        onClick = { onApprovePayment(pendingPay.id, inv.id) },
                                        colors = ButtonDefaults.buttonColors(containerColor = Emerald600),
                                        contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp),
                                        shape = RoundedCornerShape(6.dp)
                                    ) {
                                        Text("Accept Cash", fontSize = 11.sp)
                                    }
                                }
                            }
                            HorizontalDivider(color = AccentAmber200, modifier = Modifier.padding(vertical = 4.dp))
                        }

                        // 3. Pending Parent-Child Links
                        pendingParentLinks.forEach { link ->
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 4.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text("Parent-Child Link Request", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.bodyMedium)
                                    Text("Student: Aryan Suresh • Parent Verified", style = MaterialTheme.typography.bodySmall, color = Slate600)
                                }
                                Button(
                                    onClick = { onApproveParentLink(link.id) },
                                    colors = ButtonDefaults.buttonColors(containerColor = Emerald600),
                                    contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp),
                                    shape = RoundedCornerShape(6.dp)
                                ) {
                                    Text("Verify Link", fontSize = 11.sp)
                                }
                            }
                        }
                    }
                }
            }
        }

        // At-Risk Trainees Alert Card
        if (atRiskStudents.isNotEmpty()) {
            item {
                Card(
                    colors = CardDefaults.cardColors(containerColor = Crimson100),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(14.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.Warning, contentDescription = null, tint = Crimson600)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = "At-Risk Attendance Alert (${atRiskStudents.size})",
                                style = MaterialTheme.typography.titleSmall,
                                fontWeight = FontWeight.Bold,
                                color = Crimson600
                            )
                        }
                        Spacer(modifier = Modifier.height(6.dp))
                        atRiskStudents.forEach { st ->
                            Text(
                                text = "• ${st.fullName} — ${st.attendanceRate}% Attendance (${st.recentAbsenceCount} recent absences)",
                                style = MaterialTheme.typography.bodySmall,
                                color = Slate800
                            )
                        }
                    }
                }
            }
        }

        // Active Class Details & Schedule Card
        currentClass?.let { cls ->
            item {
                Card(
                    shape = RoundedCornerShape(14.dp),
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    border = BorderStroke(1.dp, Slate200),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = cls.name,
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold,
                                color = BrandNavy
                            )
                            BeltFlowTag(text = cls.code, backgroundColor = Slate100, textColor = Slate700)
                        }
                        Spacer(modifier = Modifier.height(8.dp))
                        Text("Schedule: ${cls.scheduleNote}", style = MaterialTheme.typography.bodySmall, color = Slate600)
                        Text("Branch: ${cls.branchName} • Monthly Fee: RM %.2f".format(cls.monthlyFee), style = MaterialTheme.typography.bodySmall, color = Slate600)
                        Text("Chief Instructor: ${cls.coachName}", style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.SemiBold, color = AccentAmber800)
                    }
                }
            }
        }
    }
}

// -------------------------------------------------------------------------------------------------
// TAB 2: MASTER STUDENTS CONTENT
// -------------------------------------------------------------------------------------------------
@Composable
private fun MasterStudentsContent(
    students: List<StudentWithDetails>,
    pendingProfiles: List<ProfileEntity>,
    onStudentClick: (String) -> Unit,
    onRateSkill: (StudentWithDetails) -> Unit,
    onApproveStudent: (String) -> Unit,
    onRejectStudent: (String) -> Unit
) {
    var searchQuery by remember { mutableStateOf("") }
    val filtered = remember(students, searchQuery) {
        if (searchQuery.isBlank()) students
        else students.filter { it.fullName.contains(searchQuery, true) || it.icOrMykid.contains(searchQuery) }
    }

    LazyColumn(
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
        modifier = Modifier.fillMaxSize()
    ) {
        item {
            OutlinedTextField(
                value = searchQuery,
                onValueChange = { searchQuery = it },
                placeholder = { Text("Search trainee by name or MyKid...") },
                leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                singleLine = true,
                shape = RoundedCornerShape(10.dp),
                colors = beltFlowTextFieldColors(),
                modifier = Modifier.fillMaxWidth()
            )
        }

        if (pendingProfiles.isNotEmpty()) {
            item {
                Text("Pending Registration Approvals (${pendingProfiles.size})", fontWeight = FontWeight.Bold, color = AccentAmber800)
            }
            items(pendingProfiles) { p ->
                Card(
                    colors = CardDefaults.cardColors(containerColor = AccentAmber50),
                    shape = RoundedCornerShape(10.dp),
                    border = BorderStroke(1.dp, AccentAmber200),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier.padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column {
                            Text(p.fullName, fontWeight = FontWeight.Bold)
                            Text(p.email, style = MaterialTheme.typography.bodySmall, color = Slate600)
                        }
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            Button(
                                onClick = { onApproveStudent(p.id) },
                                colors = ButtonDefaults.buttonColors(containerColor = Emerald600),
                                shape = RoundedCornerShape(6.dp)
                            ) {
                                Text("Approve", fontSize = 12.sp)
                            }
                            OutlinedButton(
                                onClick = { onRejectStudent(p.id) },
                                shape = RoundedCornerShape(6.dp)
                            ) {
                                Text("Reject", fontSize = 12.sp, color = Crimson600)
                            }
                        }
                    }
                }
            }
        }

        item {
            Text("Class Roster (${filtered.size} Trainees)", fontWeight = FontWeight.Bold, color = BrandNavy)
        }

        items(filtered) { st ->
            Card(
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                border = BorderStroke(1.dp, Slate200),
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { onStudentClick(st.id) }
            ) {
                Row(
                    modifier = Modifier.padding(14.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Surface(
                        shape = CircleShape,
                        color = parseHexColor(st.beltColorHex),
                        border = BorderStroke(1.dp, Slate300),
                        modifier = Modifier.size(40.dp)
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Text(
                                text = st.fullName.take(2).uppercase(Locale.getDefault()),
                                fontWeight = FontWeight.Bold,
                                color = if (st.beltColorHex.equals("#FFFFFF", true) || st.beltColorHex.equals("#FACC15", true)) Slate900 else Color.White
                            )
                        }
                    }

                    Spacer(modifier = Modifier.width(12.dp))

                    Column(modifier = Modifier.weight(1f)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(st.fullName, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleSmall)
                            if (st.isAtRisk) {
                                Spacer(modifier = Modifier.width(6.dp))
                                BeltFlowTag(text = "AT RISK", backgroundColor = Crimson100, textColor = Crimson600)
                            }
                        }
                        Text(
                            text = "${st.beltName} • Age ${st.age} • ${st.gender}",
                            style = MaterialTheme.typography.bodySmall,
                            color = Slate600
                        )
                        Text(
                            text = "Attendance: ${st.attendanceRate}% • Parent: ${st.parentName}",
                            style = MaterialTheme.typography.labelSmall,
                            color = Slate500
                        )
                    }

                    IconButton(onClick = { onRateSkill(st) }) {
                        Icon(Icons.Default.RateReview, contentDescription = "Rate Skill", tint = BrandNavy)
                    }
                }
            }
        }
    }
}

// -------------------------------------------------------------------------------------------------
// TAB 3: MASTER INSTRUCTORS & MAIN MASTER MANAGEMENT
// -------------------------------------------------------------------------------------------------
@Composable
private fun MasterInstructorsContent(
    currentClass: ClassEntity?,
    isMainMaster: Boolean,
    allProfiles: List<ProfileEntity>,
    allClassMasterCrossRefs: List<ClassMasterCrossRefEntity>,
    onAddMasterClick: () -> Unit,
    onRemoveMaster: (String) -> Unit,
    onSetMainMaster: (String) -> Unit
) {
    val assignedCrossRefs = remember(currentClass, allClassMasterCrossRefs) {
        val cls = currentClass ?: return@remember emptyList()
        allClassMasterCrossRefs.filter { it.classId == cls.id }
    }

    LazyColumn(
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
        modifier = Modifier.fillMaxSize()
    ) {
        item {
            Card(
                shape = RoundedCornerShape(14.dp),
                colors = CardDefaults.cardColors(containerColor = BrandNavyDeep),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = "Class Instructor Hierarchy",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                    Spacer(modifier = Modifier.height(6.dp))
                    Text(
                        text = if (isMainMaster)
                            "As MAIN MASTER, you have full authority to assign instructors, add Masters, remove Masters, and designate Main Master responsibility for ${currentClass?.name}."
                        else
                            "You are an assigned Master for this class. Operational permissions are equal, while Main Master holds instructor assignment authority.",
                        style = MaterialTheme.typography.bodySmall,
                        color = Slate200
                    )

                    if (isMainMaster) {
                        Spacer(modifier = Modifier.height(14.dp))
                        Button(
                            onClick = onAddMasterClick,
                            colors = ButtonDefaults.buttonColors(containerColor = AccentAmber500, contentColor = Slate900),
                            shape = RoundedCornerShape(8.dp)
                        ) {
                            Icon(Icons.Default.PersonAdd, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("Add Master to Class", fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }

        item {
            Text("Assigned Instructors (${assignedCrossRefs.size})", fontWeight = FontWeight.Bold, color = BrandNavy)
        }

        items(assignedCrossRefs) { cr ->
            val profile = allProfiles.find { it.id == cr.masterProfileId }
            Card(
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                border = BorderStroke(1.dp, if (cr.isMainMaster) AccentAmber400 else Slate200),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier.padding(14.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(profile?.fullName ?: "Master", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleSmall)
                            Spacer(modifier = Modifier.width(6.dp))
                            if (cr.isMainMaster) {
                                BeltFlowTag(text = "MAIN MASTER", backgroundColor = AccentAmber100, textColor = AccentAmber800)
                            } else {
                                BeltFlowTag(text = "MASTER", backgroundColor = Slate100, textColor = Slate700)
                            }
                        }
                        Text(profile?.email ?: "", style = MaterialTheme.typography.bodySmall, color = Slate600)
                        Text("Phone: ${profile?.phone ?: "+60 12-345 6789"}", style = MaterialTheme.typography.labelSmall, color = Slate500)
                    }

                    if (isMainMaster && !cr.isMainMaster) {
                        Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                            OutlinedButton(
                                onClick = { onSetMainMaster(cr.masterProfileId) },
                                shape = RoundedCornerShape(6.dp),
                                contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp)
                            ) {
                                Text("Make Main", fontSize = 11.sp)
                            }
                            IconButton(onClick = { onRemoveMaster(cr.masterProfileId) }) {
                                Icon(Icons.Default.Delete, contentDescription = "Remove", tint = Crimson600)
                            }
                        }
                    }
                }
            }
        }
    }
}

// -------------------------------------------------------------------------------------------------
// TAB 4: MASTER CLASS FINANCE & CASH RECEIPTS
// -------------------------------------------------------------------------------------------------
@Composable
private fun MasterFinanceContent(
    currentClass: ClassEntity?,
    classStudents: List<StudentWithDetails>,
    invoices: List<InvoiceWithStudent>,
    onRecordCashClick: () -> Unit,
    onApprovePayment: (String, String) -> Unit,
    onViewReceipt: (InvoiceWithStudent, PaymentWithReceipt) -> Unit
) {
    val currentMonth = SimpleDateFormat("yyyy-MM", Locale.getDefault()).format(Date())
    val classStudentIds = classStudents.map { it.id }.toSet()
    val classInvoices = invoices.filter { classStudentIds.contains(it.studentId) || classStudentIds.isEmpty() }

    val paidTotal = classInvoices.filter { it.status == InvoiceStatus.PAID }.sumOf { it.netAmount }
    val unpaidInvoices = classInvoices.filter { it.status == InvoiceStatus.UNPAID || it.status == InvoiceStatus.OVERDUE || it.status == InvoiceStatus.PENDING_APPROVAL }
    val unpaidTotal = unpaidInvoices.sumOf { it.netAmount }

    LazyColumn(
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
        modifier = Modifier.fillMaxSize()
    ) {
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                StatCard(
                    title = "Collected ($currentMonth)",
                    value = "RM %.0f".format(paidTotal),
                    subtitle = "Persatuan Class Income",
                    icon = Icons.Default.CheckCircle,
                    accentColor = Emerald600,
                    modifier = Modifier.weight(1f)
                )

                StatCard(
                    title = "Outstanding",
                    value = "RM %.0f".format(unpaidTotal),
                    subtitle = "${unpaidInvoices.size} Invoices Pending",
                    icon = Icons.Default.HourglassBottom,
                    accentColor = Crimson600,
                    modifier = Modifier.weight(1f)
                )
            }
        }

        item {
            Button(
                onClick = onRecordCashClick,
                colors = ButtonDefaults.buttonColors(containerColor = Emerald600),
                shape = RoundedCornerShape(10.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Icon(Icons.Default.AddCard, contentDescription = null)
                Spacer(modifier = Modifier.width(8.dp))
                Text("Record Student Cash Payment & Print Receipt", fontWeight = FontWeight.Bold)
            }
        }

        item {
            Text("Invoices & Payment Records", fontWeight = FontWeight.Bold, color = BrandNavy)
        }

        items(classInvoices) { inv ->
            Card(
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                border = BorderStroke(1.dp, Slate200),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(14.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text(inv.studentName, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleSmall)
                            Text("Month: ${inv.billingMonth} • Payer: ${inv.parentName}", style = MaterialTheme.typography.bodySmall, color = Slate600)
                        }
                        val statusColor = when (inv.status) {
                            InvoiceStatus.PAID -> Pair(Emerald100, Emerald600)
                            InvoiceStatus.PENDING_APPROVAL -> Pair(Gold100, Gold600)
                            InvoiceStatus.OVERDUE -> Pair(Crimson100, Crimson600)
                            else -> Pair(Slate100, Slate700)
                        }
                        StatusBadge(
                            statusText = inv.status.label,
                            backgroundColor = statusColor.first,
                            textColor = statusColor.second
                        )
                    }

                    Spacer(modifier = Modifier.height(8.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("Amount: RM %.2f".format(inv.netAmount), fontWeight = FontWeight.Bold, color = BrandNavy)

                        val paidRecord = inv.payments.find { it.approvedBy != null }
                        if (paidRecord != null) {
                            OutlinedButton(
                                onClick = { onViewReceipt(inv, paidRecord) },
                                shape = RoundedCornerShape(6.dp),
                                contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp)
                            ) {
                                Icon(Icons.Default.ReceiptLong, contentDescription = null, modifier = Modifier.size(14.dp))
                                Spacer(modifier = Modifier.width(4.dp))
                                Text("Receipt", fontSize = 11.sp)
                            }
                        }
                    }
                }
            }
        }
    }
}

// -------------------------------------------------------------------------------------------------
// TAB 5: MASTER GRADING
// -------------------------------------------------------------------------------------------------
@Composable
private fun MasterGradingContent(
    gradingEvents: List<GradingEventWithRecords>,
    classStudents: List<StudentWithDetails>,
    onNavigateToGrading: () -> Unit,
    onRegisterStudent: (String, String, String?, String?) -> Unit
) {
    LazyColumn(
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
        modifier = Modifier.fillMaxSize()
    ) {
        item {
            Card(
                shape = RoundedCornerShape(14.dp),
                colors = CardDefaults.cardColors(containerColor = BrandNavy),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("Grading Events & Promotion", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = Color.White)
                        Button(
                            onClick = onNavigateToGrading,
                            colors = ButtonDefaults.buttonColors(containerColor = AccentAmber500, contentColor = BrandNavyDeep),
                            shape = RoundedCornerShape(8.dp)
                        ) {
                            Text("Open Scoring Hub", fontWeight = FontWeight.Bold, fontSize = 12.sp)
                        }
                    }
                    Spacer(modifier = Modifier.height(6.dp))
                    Text("Masters can register qualified class students for Persatuan grading sessions, enter test scores, and award promotions.", style = MaterialTheme.typography.bodySmall, color = Slate200)
                }
            }
        }

        item {
            Text("Upcoming & Recent Events (${gradingEvents.size})", fontWeight = FontWeight.Bold, color = BrandNavy)
        }

        items(gradingEvents) { ev ->
            Card(
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                border = BorderStroke(1.dp, Slate200),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(14.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(ev.name, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleSmall)
                        BeltFlowTag(text = if (ev.isCompleted) "COMPLETED" else "OPEN", backgroundColor = if (ev.isCompleted) Slate100 else Emerald100, textColor = if (ev.isCompleted) Slate700 else Emerald800)
                    }
                    Spacer(modifier = Modifier.height(4.dp))
                    Text("Date: ${ev.eventDate} • Location: ${ev.location}", style = MaterialTheme.typography.bodySmall, color = Slate600)
                    Text("Examiner: ${ev.examiner} • Fee: RM %.2f".format(ev.fee), style = MaterialTheme.typography.bodySmall, color = Slate600)
                    Text("Candidates: ${ev.candidateCount} • Promoted: ${ev.passCount}", style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.SemiBold, color = AccentAmber800)
                }
            }
        }
    }
}

// -------------------------------------------------------------------------------------------------
// TAB 6: MASTER SKILL MATRIX
// -------------------------------------------------------------------------------------------------
@Composable
private fun MasterSkillsContent(
    classStudents: List<StudentWithDetails>,
    skills: List<SkillEntity>,
    onUpdateSkill: (String, String, SkillLevel, String) -> Unit
) {
    var selectedStudent by remember { mutableStateOf(classStudents.firstOrNull()) }

    LazyColumn(
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
        modifier = Modifier.fillMaxSize()
    ) {
        item {
            Text("Silambam Syllabus & Skill Matrix", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = BrandNavy)
            Text("Select trainee to assess individual technique levels.", style = MaterialTheme.typography.bodySmall, color = Slate600)
        }

        // Student Selector Strip
        item {
            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                items(classStudents) { st ->
                    val isSelected = selectedStudent?.id == st.id
                    FilterChip(
                        selected = isSelected,
                        onClick = { selectedStudent = st },
                        label = { Text(st.fullName) },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = BrandNavy,
                            selectedLabelColor = Color.White
                        )
                    )
                }
            }
        }

        selectedStudent?.let { st ->
            item {
                Card(
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    border = BorderStroke(1.dp, Slate200),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(14.dp)) {
                        Text("Assessing ${st.fullName} (${st.beltName})", fontWeight = FontWeight.Bold, color = BrandNavy)
                        Spacer(modifier = Modifier.height(10.dp))
                        skills.forEach { sk ->
                            var currentLevel by remember { mutableStateOf(SkillLevel.GOOD) }
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 6.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(sk.name, fontWeight = FontWeight.SemiBold, style = MaterialTheme.typography.bodyMedium)
                                    Text("Category: ${sk.category}", style = MaterialTheme.typography.bodySmall, color = Slate500)
                                }

                                Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                    listOf(SkillLevel.LEARNING, SkillLevel.GOOD, SkillLevel.MASTERED).forEach { lvl ->
                                        Button(
                                            onClick = {
                                                currentLevel = lvl
                                                onUpdateSkill(st.id, sk.id, lvl, "Assessed by Master")
                                            },
                                            colors = ButtonDefaults.buttonColors(
                                                containerColor = if (currentLevel == lvl) Emerald600 else Slate100,
                                                contentColor = if (currentLevel == lvl) Color.White else Slate700
                                            ),
                                            shape = RoundedCornerShape(6.dp),
                                            contentPadding = PaddingValues(horizontal = 6.dp, vertical = 2.dp)
                                        ) {
                                            Text(lvl.label.take(4), fontSize = 10.sp)
                                        }
                                    }
                                }
                            }
                            HorizontalDivider(color = Slate100)
                        }
                    }
                }
            }
        }
    }
}

// -------------------------------------------------------------------------------------------------
// TAB 7: MASTER TOURNAMENTS
// -------------------------------------------------------------------------------------------------
@Composable
private fun MasterTournamentsContent(
    tournaments: List<TournamentDetail>,
    classStudents: List<StudentWithDetails>,
    onNavigateToTournaments: () -> Unit,
    onRecordResult: (String, String, String, Medal, String) -> Unit
) {
    LazyColumn(
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
        modifier = Modifier.fillMaxSize()
    ) {
        item {
            Card(
                shape = RoundedCornerShape(14.dp),
                colors = CardDefaults.cardColors(containerColor = BrandNavyDeep),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("Silambam Tournaments", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = Color.White)
                        Button(
                            onClick = onNavigateToTournaments,
                            colors = ButtonDefaults.buttonColors(containerColor = AccentAmber500, contentColor = BrandNavyDeep),
                            shape = RoundedCornerShape(8.dp)
                        ) {
                            Text("Full Portal", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                    Spacer(modifier = Modifier.height(4.dp))
                    Text("Register trainees for Porr Silambam / Thanithiramai categories and record medal accomplishments.", style = MaterialTheme.typography.bodySmall, color = Slate200)
                }
            }
        }

        items(tournaments) { t ->
            Card(
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                border = BorderStroke(1.dp, Slate200),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(14.dp)) {
                    Text(t.name, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleSmall, color = BrandNavy)
                    Text("Date: ${t.eventDate} • ${t.location}", style = MaterialTheme.typography.bodySmall, color = Slate600)
                    Text("Organizer: ${t.organizer}", style = MaterialTheme.typography.labelSmall, color = Slate500)
                    if (t.results.isNotEmpty()) {
                        Spacer(modifier = Modifier.height(8.dp))
                        t.results.forEach { r ->
                            Text("${r.medal.emoji} ${r.studentName} — ${r.medal.label} (${r.eventCategory})", style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.SemiBold, color = AccentAmber800)
                        }
                    }
                }
            }
        }
    }
}

// -------------------------------------------------------------------------------------------------
// TAB 8: MASTER ANNOUNCEMENTS & MODERATION
// -------------------------------------------------------------------------------------------------
@Composable
private fun MasterAnnouncementsContent(
    announcements: List<AnnouncementEntity>,
    currentClass: ClassEntity?,
    onPostAnnouncement: (String, String) -> Unit,
    onApprove: (String) -> Unit,
    onReject: (String) -> Unit
) {
    var title by remember { mutableStateOf("") }
    var content by remember { mutableStateOf("") }

    LazyColumn(
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
        modifier = Modifier.fillMaxSize()
    ) {
        item {
            Card(
                shape = RoundedCornerShape(14.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                border = BorderStroke(1.dp, Slate200),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text("Broadcast Announcement to Class", fontWeight = FontWeight.Bold, color = BrandNavy)
                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedTextField(
                        value = title,
                        onValueChange = { title = it },
                        label = { Text("Title") },
                        placeholder = { Text("e.g. Next Training Schedule Change") },
                        singleLine = true,
                        colors = beltFlowTextFieldColors(),
                        modifier = Modifier.fillMaxWidth()
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedTextField(
                        value = content,
                        onValueChange = { content = it },
                        label = { Text("Message Content") },
                        placeholder = { Text("Please bring safety sparring gear...") },
                        minLines = 3,
                        colors = beltFlowTextFieldColors(),
                        modifier = Modifier.fillMaxWidth()
                    )
                    Spacer(modifier = Modifier.height(10.dp))
                    Button(
                        onClick = {
                            if (title.isNotBlank() && content.isNotBlank()) {
                                onPostAnnouncement(title, content)
                                title = ""
                                content = ""
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = BrandNavy),
                        shape = RoundedCornerShape(8.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("Post Class Announcement")
                    }
                }
            }
        }

        item {
            Text("Announcements Feed & Submissions", fontWeight = FontWeight.Bold, color = BrandNavy)
        }

        items(announcements) { anc ->
            Card(
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                border = BorderStroke(1.dp, if (anc.status == AnnouncementStatus.PENDING_MASTER_APPROVAL) AccentAmber400 else Slate200),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(14.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(anc.title, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleSmall)
                        val badgeBg = if (anc.status == AnnouncementStatus.PUBLISHED) Emerald100 else AccentAmber100
                        val badgeText = if (anc.status == AnnouncementStatus.PUBLISHED) Emerald800 else AccentAmber800
                        BeltFlowTag(text = anc.status.label, backgroundColor = badgeBg, textColor = badgeText)
                    }
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(anc.content, style = MaterialTheme.typography.bodyMedium, color = Slate800)
                    Spacer(modifier = Modifier.height(6.dp))
                    Text("By: ${anc.authorName} (${anc.authorRole.label})", style = MaterialTheme.typography.labelSmall, color = Slate500)

                    if (anc.status == AnnouncementStatus.PENDING_MASTER_APPROVAL) {
                        Spacer(modifier = Modifier.height(8.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            Button(
                                onClick = { onApprove(anc.id) },
                                colors = ButtonDefaults.buttonColors(containerColor = Emerald600),
                                shape = RoundedCornerShape(6.dp)
                            ) {
                                Text("Approve & Publish", fontSize = 11.sp)
                            }
                            OutlinedButton(
                                onClick = { onReject(anc.id) },
                                shape = RoundedCornerShape(6.dp)
                            ) {
                                Text("Reject", fontSize = 11.sp, color = Crimson600)
                            }
                        }
                    }
                }
            }
        }
    }
}

// -------------------------------------------------------------------------------------------------
// DIALOGS
// -------------------------------------------------------------------------------------------------
@Composable
private fun RecordCashPaymentDialog(
    students: List<StudentWithDetails>,
    invoices: List<InvoiceWithStudent>,
    onDismiss: () -> Unit,
    onConfirm: (invoiceId: String, amount: Double, notes: String) -> Unit
) {
    var selectedStudentId by remember { mutableStateOf(students.firstOrNull()?.id ?: "") }
    val studentInvoices = invoices.filter { it.studentId == selectedStudentId && it.status != InvoiceStatus.PAID }
    var selectedInvoiceId by remember { mutableStateOf(studentInvoices.firstOrNull()?.id ?: "") }
    var amountText by remember { mutableStateOf(studentInvoices.firstOrNull()?.netAmount?.toString() ?: "80.0") }
    var notes by remember { mutableStateOf("Collected cash at dojo") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Record Cash Payment", fontWeight = FontWeight.Bold, color = BrandNavy) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("Select Trainee:", style = MaterialTheme.typography.labelMedium)
                LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    items(students) { st ->
                        FilterChip(
                            selected = selectedStudentId == st.id,
                            onClick = {
                                selectedStudentId = st.id
                                val firstInv = invoices.find { it.studentId == st.id && it.status != InvoiceStatus.PAID }
                                selectedInvoiceId = firstInv?.id ?: ""
                                amountText = firstInv?.netAmount?.toString() ?: "80.0"
                            },
                            label = { Text(st.fullName, fontSize = 12.sp) }
                        )
                    }
                }

                OutlinedTextField(
                    value = amountText,
                    onValueChange = { amountText = it },
                    label = { Text("Amount Paid (RM)") },
                    singleLine = true,
                    colors = beltFlowTextFieldColors(),
                    modifier = Modifier.fillMaxWidth()
                )

                OutlinedTextField(
                    value = notes,
                    onValueChange = { notes = it },
                    label = { Text("Receipt Notes") },
                    singleLine = true,
                    colors = beltFlowTextFieldColors(),
                    modifier = Modifier.fillMaxWidth()
                )
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    val amt = amountText.toDoubleOrNull() ?: 80.0
                    val invId = if (selectedInvoiceId.isNotBlank()) selectedInvoiceId else "inv_${selectedStudentId}_${SimpleDateFormat("yyyyMM", Locale.getDefault()).format(Date())}"
                    onConfirm(invId, amt, notes)
                },
                colors = ButtonDefaults.buttonColors(containerColor = Emerald600)
            ) {
                Text("Record & Generate Receipt")
            }
        },
        dismissButton = {
            OutlinedButton(onClick = onDismiss) { Text("Cancel") }
        }
    )
}

@Composable
private fun AddMasterToClassDialog(
    currentClass: ClassEntity,
    availableMasters: List<ProfileEntity>,
    onDismiss: () -> Unit,
    onAdd: (masterId: String, asMain: Boolean) -> Unit
) {
    var selectedMasterId by remember { mutableStateOf(availableMasters.firstOrNull()?.id ?: "") }
    var makeMain by remember { mutableStateOf(false) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Add Master to ${currentClass.name}", fontWeight = FontWeight.Bold, color = BrandNavy) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("Select Master to assign:", style = MaterialTheme.typography.labelMedium)
                availableMasters.forEach { m ->
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { selectedMasterId = m.id }
                            .padding(vertical = 4.dp)
                    ) {
                        RadioButton(selected = selectedMasterId == m.id, onClick = { selectedMasterId = m.id })
                        Spacer(modifier = Modifier.width(6.dp))
                        Column {
                            Text(m.fullName, fontWeight = FontWeight.SemiBold)
                            Text(m.email, style = MaterialTheme.typography.bodySmall, color = Slate600)
                        }
                    }
                }

                Row(verticalAlignment = Alignment.CenterVertically) {
                    Checkbox(checked = makeMain, onCheckedChange = { makeMain = it })
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Designate as MAIN MASTER for this class", style = MaterialTheme.typography.bodyMedium)
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    if (selectedMasterId.isNotBlank()) {
                        onAdd(selectedMasterId, makeMain)
                    }
                },
                colors = ButtonDefaults.buttonColors(containerColor = BrandNavy)
            ) {
                Text("Assign Master")
            }
        },
        dismissButton = {
            OutlinedButton(onClick = onDismiss) { Text("Cancel") }
        }
    )
}

@Composable
private fun CreateAnnouncementDialog(
    currentClass: ClassEntity?,
    onDismiss: () -> Unit,
    onPost: (title: String, content: String) -> Unit
) {
    var title by remember { mutableStateOf("") }
    var content by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Post Class Notice", fontWeight = FontWeight.Bold, color = BrandNavy) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("Target: ${currentClass?.name ?: "All Classes"}", style = MaterialTheme.typography.bodySmall, color = Slate600)
                OutlinedTextField(
                    value = title,
                    onValueChange = { title = it },
                    label = { Text("Title") },
                    singleLine = true,
                    colors = beltFlowTextFieldColors(),
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = content,
                    onValueChange = { content = it },
                    label = { Text("Content") },
                    minLines = 3,
                    colors = beltFlowTextFieldColors(),
                    modifier = Modifier.fillMaxWidth()
                )
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    if (title.isNotBlank() && content.isNotBlank()) {
                        onPost(title, content)
                    }
                },
                colors = ButtonDefaults.buttonColors(containerColor = BrandNavy)
            ) {
                Text("Publish")
            }
        },
        dismissButton = {
            OutlinedButton(onClick = onDismiss) { Text("Cancel") }
        }
    )
}

@Composable
private fun QuickSkillRateDialog(
    student: StudentWithDetails,
    skills: List<SkillEntity>,
    onDismiss: () -> Unit,
    onSave: (skillId: String, level: SkillLevel, note: String) -> Unit
) {
    var selectedSkillId by remember { mutableStateOf(skills.firstOrNull()?.id ?: "") }
    var selectedLevel by remember { mutableStateOf(SkillLevel.GOOD) }
    var note by remember { mutableStateOf("Good form and balance") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Assess ${student.fullName}", fontWeight = FontWeight.Bold, color = BrandNavy) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("Select Technique / Skill:", style = MaterialTheme.typography.labelMedium)
                LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    items(skills) { sk ->
                        FilterChip(
                            selected = selectedSkillId == sk.id,
                            onClick = { selectedSkillId = sk.id },
                            label = { Text(sk.name, fontSize = 12.sp) }
                        )
                    }
                }

                Text("Proficiency Level:", style = MaterialTheme.typography.labelMedium)
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    listOf(SkillLevel.LEARNING, SkillLevel.GOOD, SkillLevel.MASTERED).forEach { lvl ->
                        FilterChip(
                            selected = selectedLevel == lvl,
                            onClick = { selectedLevel = lvl },
                            label = { Text(lvl.label, fontSize = 11.sp) }
                        )
                    }
                }

                OutlinedTextField(
                    value = note,
                    onValueChange = { note = it },
                    label = { Text("Instructor Note") },
                    singleLine = true,
                    colors = beltFlowTextFieldColors(),
                    modifier = Modifier.fillMaxWidth()
                )
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    if (selectedSkillId.isNotBlank()) {
                        onSave(selectedSkillId, selectedLevel, note)
                    }
                },
                colors = ButtonDefaults.buttonColors(containerColor = BrandNavy)
            ) {
                Text("Save Progress")
            }
        },
        dismissButton = {
            OutlinedButton(onClick = onDismiss) { Text("Cancel") }
        }
    )
}
