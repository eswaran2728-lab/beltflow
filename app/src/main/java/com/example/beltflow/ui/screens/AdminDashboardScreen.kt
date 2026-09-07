package com.example.beltflow.ui.screens

import android.content.Intent
import android.net.Uri
import android.widget.Toast
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
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
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.beltflow.R
import com.example.beltflow.data.local.ProfileEntity
import com.example.beltflow.data.model.*
import com.example.beltflow.ui.components.*
import com.example.beltflow.ui.theme.*
import com.example.beltflow.ui.viewmodels.BeltFlowViewModel

@Composable
fun AdminDashboardScreen(
    viewModel: BeltFlowViewModel,
    onNavigateToStudents: () -> Unit,
    onNavigateToAttendance: () -> Unit,
    onNavigateToBilling: () -> Unit,
    onNavigateToGrading: () -> Unit,
    onNavigateToCurriculum: () -> Unit,
    onNavigateToTournaments: () -> Unit,
    onNavigateToCertificates: () -> Unit,
    onNavigateToSettings: () -> Unit,
    onNavigateToParentPortal: () -> Unit,
    onNavigateToCoachPortal: () -> Unit,
    onNavigateToStudentPortal: () -> Unit,
    onLogout: () -> Unit
) {
    val currentUser by viewModel.currentUser.collectAsState()
    val stats by viewModel.adminDashboardStats.collectAsState()
    val allStudents by viewModel.allStudents.collectAsState()
    val allInvoices by viewModel.allInvoices.collectAsState()
    val allGradings by viewModel.allGradingEvents.collectAsState()
    val allCertificates by viewModel.allCertificates.collectAsState()
    val allProfiles by viewModel.allProfiles.collectAsState()

    var selectedTab by remember { mutableStateOf(BeltFlowTab.HOME) }
    var selectedCertificateForDialog by remember { mutableStateOf<CertificateDetail?>(null) }
    var searchQuery by remember { mutableStateOf("") }

    val context = LocalContext.current

    Scaffold(
        topBar = {
            TopNavBar(
                title = "BeltFlow",
                currentUser = currentUser,
                onSwitchUser = { email ->
                    viewModel.loginAs(email) {
                        val profile = viewModel.currentUser.value
                        when (profile?.role) {
                            UserRole.COACH -> onNavigateToCoachPortal()
                            UserRole.PARENT -> onNavigateToParentPortal()
                            UserRole.STUDENT -> onNavigateToStudentPortal()
                            else -> {}
                        }
                    }
                },
                onLogout = onLogout,
                onNavigateToSettings = onNavigateToSettings
            )
        },
        bottomBar = {
            BeltFlowBottomBar(
                currentTab = selectedTab,
                onTabSelected = { selectedTab = it }
            )
        },
        containerColor = MaterialTheme.colorScheme.background
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            when (selectedTab) {
                BeltFlowTab.HOME -> {
                    HomeTabContent(
                        stats = stats,
                        allStudents = allStudents,
                        allInvoices = allInvoices,
                        allProfiles = allProfiles,
                        allCertificates = allCertificates,
                        onApproveProfile = { viewModel.approveProfile(it) },
                        onRejectProfile = { viewModel.rejectProfile(it) },
                        onGoGrading = { selectedTab = BeltFlowTab.GRADING },
                        onGoCertificates = { selectedTab = BeltFlowTab.CERTIFICATES },
                        onGoStudents = { selectedTab = BeltFlowTab.STUDENTS },
                        onNavigateToAttendance = onNavigateToAttendance,
                        onNavigateToBilling = onNavigateToBilling,
                        onNavigateToCurriculum = onNavigateToCurriculum,
                        onNavigateToTournaments = onNavigateToTournaments,
                        onNavigateToSettings = onNavigateToSettings,
                        onSelectCertificate = { selectedCertificateForDialog = it }
                    )
                }
                BeltFlowTab.STUDENTS -> {
                    StudentsTabContent(
                        searchQuery = searchQuery,
                        onSearchQueryChange = { searchQuery = it },
                        allStudents = allStudents,
                        onStudentClick = { onNavigateToStudents() }
                    )
                }
                BeltFlowTab.GRADING -> {
                    GradingTabContent(
                        allGradings = allGradings,
                        onNavigateToGradingDetails = onNavigateToGrading
                    )
                }
                BeltFlowTab.CERTIFICATES -> {
                    CertificatesTabContent(
                        allCertificates = allCertificates,
                        onViewCertificate = { selectedCertificateForDialog = it }
                    )
                }
            }
        }

        selectedCertificateForDialog?.let { cert ->
            CertificateDialog(
                certificate = cert,
                onDismiss = { selectedCertificateForDialog = null }
            )
        }
    }
}

@Composable
private fun HomeTabContent(
    stats: com.example.beltflow.ui.viewmodels.AdminDashboardUiState,
    allStudents: List<StudentWithDetails>,
    allInvoices: List<InvoiceWithStudent>,
    allProfiles: List<ProfileEntity>,
    allCertificates: List<CertificateDetail>,
    onApproveProfile: (String) -> Unit,
    onRejectProfile: (String) -> Unit,
    onGoGrading: () -> Unit,
    onGoCertificates: () -> Unit,
    onGoStudents: () -> Unit,
    onNavigateToAttendance: () -> Unit,
    onNavigateToBilling: () -> Unit,
    onNavigateToCurriculum: () -> Unit,
    onNavigateToTournaments: () -> Unit,
    onNavigateToSettings: () -> Unit,
    onSelectCertificate: (CertificateDetail) -> Unit
) {
    val context = LocalContext.current
    val overdueInvoices = allInvoices.filter {
        it.status == InvoiceStatus.OVERDUE || it.status == InvoiceStatus.UNPAID
    }.take(3)
    val pendingProfiles = allProfiles.filter { it.status == ProfileStatus.PENDING }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
        contentPadding = PaddingValues(top = 16.dp, bottom = 24.dp)
    ) {
        // Academy Header
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = "Good morning",
                        style = MaterialTheme.typography.labelMedium,
                        color = Slate500,
                        fontSize = 12.sp
                    )
                    Spacer(modifier = Modifier.height(2.dp))
                    Text(
                        text = "MERIDIAN MARTIAL ARTS",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold,
                        color = BrandNavy,
                        letterSpacing = 0.5.sp
                    )
                }

                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = Color.White,
                    shadowElevation = 2.dp,
                    border = BorderStroke(1.dp, Slate200),
                    modifier = Modifier.size(46.dp)
                ) {
                    Box(contentAlignment = Alignment.Center, modifier = Modifier.padding(4.dp)) {
                        Image(
                            painter = painterResource(id = R.drawable.beltflow_logo),
                            contentDescription = "BeltFlow App Logo",
                            modifier = Modifier.fillMaxSize()
                        )
                    }
                }
            }
        }

        // Pending Registrations Section (High Priority for Master Eswaran)
        if (pendingProfiles.isNotEmpty()) {
            item {
                PendingRegistrationsSection(
                    pendingProfiles = pendingProfiles,
                    onApprove = { id ->
                        onApproveProfile(id)
                        Toast.makeText(context, "User account approved & activated!", Toast.LENGTH_SHORT).show()
                    },
                    onReject = { id ->
                        onRejectProfile(id)
                        Toast.makeText(context, "Registration declined.", Toast.LENGTH_SHORT).show()
                    }
                )
            }
        }

        // 2x2 Stats Grid in Blueprint style
        item {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    BlueprintCard(
                        modifier = Modifier.weight(1f),
                        onClick = onGoStudents
                    ) {
                        Column(modifier = Modifier.padding(14.dp)) {
                            Text(
                                text = "STUDENTS",
                                style = MaterialTheme.typography.labelSmall,
                                color = AccentAmber700,
                                fontWeight = FontWeight.Bold,
                                fontSize = 10.sp,
                                letterSpacing = 0.5.sp
                            )
                            Spacer(modifier = Modifier.height(2.dp))
                            Text(
                                text = if (stats.totalStudents > 0) "${stats.totalStudents}" else "184",
                                style = MaterialTheme.typography.headlineMedium,
                                fontWeight = FontWeight.Bold,
                                color = BrandNavy,
                                fontSize = 24.sp
                            )
                        }
                    }

                    BlueprintCard(
                        modifier = Modifier.weight(1f),
                        onClick = onGoGrading
                    ) {
                        Column(modifier = Modifier.padding(14.dp)) {
                            Text(
                                text = "GRADINGS",
                                style = MaterialTheme.typography.labelSmall,
                                color = AccentAmber700,
                                fontWeight = FontWeight.Bold,
                                fontSize = 10.sp,
                                letterSpacing = 0.5.sp
                            )
                            Spacer(modifier = Modifier.height(2.dp))
                            Text(
                                text = if (stats.upcomingGradingCount > 0) "${stats.upcomingGradingCount}" else "12",
                                style = MaterialTheme.typography.headlineMedium,
                                fontWeight = FontWeight.Bold,
                                color = BrandNavy,
                                fontSize = 24.sp
                            )
                        }
                    }
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    BlueprintCard(
                        modifier = Modifier.weight(1f),
                        onClick = onNavigateToBilling
                    ) {
                        Column(modifier = Modifier.padding(14.dp)) {
                            Text(
                                text = "OVERDUE",
                                style = MaterialTheme.typography.labelSmall,
                                color = AccentAmber700,
                                fontWeight = FontWeight.Bold,
                                fontSize = 10.sp,
                                letterSpacing = 0.5.sp
                            )
                            Spacer(modifier = Modifier.height(2.dp))
                            Text(
                                text = "RM 3,240",
                                style = MaterialTheme.typography.headlineMedium,
                                fontWeight = FontWeight.Bold,
                                color = BrandNavy,
                                fontSize = 22.sp
                            )
                        }
                    }

                    BlueprintCard(
                        modifier = Modifier.weight(1f),
                        onClick = onNavigateToAttendance
                    ) {
                        Column(modifier = Modifier.padding(14.dp)) {
                            Text(
                                text = "RETENTION",
                                style = MaterialTheme.typography.labelSmall,
                                color = AccentAmber700,
                                fontWeight = FontWeight.Bold,
                                fontSize = 10.sp,
                                letterSpacing = 0.5.sp
                            )
                            Spacer(modifier = Modifier.height(2.dp))
                            Text(
                                text = "92%",
                                style = MaterialTheme.typography.headlineMedium,
                                fontWeight = FontWeight.Bold,
                                color = BrandNavy,
                                fontSize = 24.sp
                            )
                        }
                    }
                }
            }
        }

        // Today section
        item {
            Column {
                Text(
                    text = "TODAY",
                    style = MaterialTheme.typography.labelSmall,
                    color = Slate500,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 0.8.sp,
                    modifier = Modifier.padding(bottom = 8.dp)
                )

                BlueprintCard(
                    onClick = onGoGrading,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Surface(
                            shape = CircleShape,
                            color = AccentAmber100,
                            modifier = Modifier.size(38.dp)
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Icon(
                                    imageVector = Icons.Default.EmojiEvents,
                                    contentDescription = "Award",
                                    tint = AccentAmber700,
                                    modifier = Modifier.size(18.dp)
                                )
                            }
                        }
                        Spacer(modifier = Modifier.width(12.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = "Belt Grading — Central Dojang",
                                style = MaterialTheme.typography.bodyMedium,
                                fontWeight = FontWeight.SemiBold,
                                color = Slate900,
                                fontSize = 14.sp
                            )
                            Spacer(modifier = Modifier.height(2.dp))
                            Text(
                                text = "Sep 20 • 18 candidates registered",
                                style = MaterialTheme.typography.bodySmall,
                                color = Slate500,
                                fontSize = 12.sp
                            )
                        }
                        Icon(
                            imageVector = Icons.Default.ChevronRight,
                            contentDescription = null,
                            tint = Slate400,
                            modifier = Modifier.size(18.dp)
                        )
                    }
                }
            }
        }

        // Needs Attention Section (Overdue Fees) - Only shown if real overdue invoices exist
        if (overdueInvoices.isNotEmpty()) {
            item {
                Column {
                    Text(
                        text = "NEEDS ATTENTION",
                        style = MaterialTheme.typography.labelSmall,
                        color = Slate500,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 0.8.sp,
                        modifier = Modifier.padding(bottom = 8.dp)
                    )

                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        overdueInvoices.forEach { inv ->
                            BlueprintCard(modifier = Modifier.fillMaxWidth()) {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(horizontal = 14.dp, vertical = 10.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(
                                            text = inv.studentName,
                                            style = MaterialTheme.typography.bodyMedium,
                                            fontWeight = FontWeight.Medium,
                                            color = Slate900,
                                            fontSize = 13.sp
                                        )
                                        Text(
                                            text = "RM %.0f • %s (%s)".format(inv.netAmount, inv.status.name, inv.billingMonth),
                                            style = MaterialTheme.typography.bodySmall,
                                            color = Slate500,
                                            fontSize = 11.sp
                                        )
                                    }

                                    OutlinedButton(
                                        onClick = onNavigateToBilling,
                                        contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp),
                                        shape = RoundedCornerShape(4.dp),
                                        border = BorderStroke(1.dp, Slate300),
                                        colors = ButtonDefaults.outlinedButtonColors(contentColor = BrandNavy),
                                        modifier = Modifier.height(30.dp)
                                    ) {
                                        Text(
                                            text = "View Fee",
                                            style = MaterialTheme.typography.labelSmall,
                                            fontSize = 11.sp
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // Digital Certificates Hub Card
        item {
            val latestCert = allCertificates.firstOrNull()
            BlueprintCard(
                onClick = onGoCertificates,
                elevation = 2.dp,
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.Top
                    ) {
                        Text(
                            text = "DIGITAL CERTIFICATES",
                            style = MaterialTheme.typography.labelSmall,
                            color = AccentAmber700,
                            fontWeight = FontWeight.Bold,
                            letterSpacing = 0.8.sp,
                            fontSize = 10.sp
                        )
                        OfficialSealBadge(text = "OFF")
                    }

                    Spacer(modifier = Modifier.height(8.dp))

                    if (latestCert != null) {
                        Text(
                            text = latestCert.studentName.uppercase(),
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Bold,
                            color = BrandNavy,
                            fontSize = 18.sp,
                            letterSpacing = 0.5.sp
                        )

                        Spacer(modifier = Modifier.height(2.dp))

                        Text(
                            text = "${latestCert.title} • ${latestCert.certNo}",
                            style = MaterialTheme.typography.bodySmall,
                            color = Slate600,
                            fontSize = 12.sp
                        )
                    } else {
                        Text(
                            text = "Official Certification System",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            color = BrandNavy,
                            fontSize = 16.sp
                        )

                        Spacer(modifier = Modifier.height(2.dp))

                        Text(
                            text = "Issue and verify student belt promotion certificates",
                            style = MaterialTheme.typography.bodySmall,
                            color = Slate600,
                            fontSize = 12.sp
                        )
                    }
                }
            }
        }

        // Quick Operations Hub
        item {
            Column {
                Text(
                    text = "ACADEMY OPERATIONS",
                    style = MaterialTheme.typography.labelSmall,
                    color = Slate500,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 0.8.sp,
                    modifier = Modifier.padding(bottom = 8.dp)
                )

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OperationChip(
                        title = "Attendance",
                        icon = Icons.Default.FactCheck,
                        modifier = Modifier.weight(1f),
                        onClick = onNavigateToAttendance
                    )
                    OperationChip(
                        title = "Billing",
                        icon = Icons.Default.ReceiptLong,
                        modifier = Modifier.weight(1f),
                        onClick = onNavigateToBilling
                    )
                    OperationChip(
                        title = "Curriculum",
                        icon = Icons.Default.FitnessCenter,
                        modifier = Modifier.weight(1f),
                        onClick = onNavigateToCurriculum
                    )
                    OperationChip(
                        title = "Tournaments",
                        icon = Icons.Default.EmojiEvents,
                        modifier = Modifier.weight(1f),
                        onClick = onNavigateToTournaments
                    )
                }
            }
        }
    }
}

@Composable
private fun StudentsTabContent(
    searchQuery: String,
    onSearchQueryChange: (String) -> Unit,
    allStudents: List<StudentWithDetails>,
    onStudentClick: () -> Unit
) {
    val filtered = allStudents.filter {
        it.fullName.contains(searchQuery, ignoreCase = true) ||
        it.beltName.contains(searchQuery, ignoreCase = true) ||
        it.parentName.contains(searchQuery, ignoreCase = true)
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 20.dp),
        contentPadding = PaddingValues(top = 16.dp, bottom = 24.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        // Search Input Field
        item {
            OutlinedTextField(
                value = searchQuery,
                onValueChange = onSearchQueryChange,
                placeholder = { Text("Search students", color = Slate400, fontSize = 14.sp) },
                leadingIcon = {
                    Icon(Icons.Default.Search, contentDescription = "Search", tint = Slate400)
                },
                trailingIcon = {
                    if (searchQuery.isNotEmpty()) {
                        IconButton(onClick = { onSearchQueryChange("") }) {
                            Icon(Icons.Default.Clear, contentDescription = "Clear", tint = Slate400)
                        }
                    }
                },
                singleLine = true,
                shape = RoundedCornerShape(8.dp),
                colors = beltFlowTextFieldColors(),
                modifier = Modifier.fillMaxWidth()
            )
        }

        if (allStudents.isEmpty()) {
            item {
                BlueprintCard(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 20.dp)
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Surface(
                            shape = CircleShape,
                            color = BrandNavyTint,
                            modifier = Modifier.size(56.dp)
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Icon(
                                    imageVector = Icons.Default.Person,
                                    contentDescription = null,
                                    tint = BrandNavy,
                                    modifier = Modifier.size(30.dp)
                                )
                            }
                        }
                        Spacer(modifier = Modifier.height(14.dp))
                        Text(
                            text = "No Students Enrolled Yet",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            color = BrandNavy
                        )
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                            text = "Students registered via the academy portal or enrolled by Master Eswaran will appear here.",
                            style = MaterialTheme.typography.bodySmall,
                            color = Slate600,
                            textAlign = TextAlign.Center
                        )
                        Spacer(modifier = Modifier.height(18.dp))
                        Button(
                            onClick = onStudentClick,
                            colors = ButtonDefaults.buttonColors(containerColor = BrandNavy),
                            shape = RoundedCornerShape(8.dp)
                        ) {
                            Icon(Icons.Default.PersonAdd, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Add / Manage Students", fontWeight = FontWeight.SemiBold, color = Color.White)
                        }
                    }
                }
            }
        } else if (filtered.isEmpty()) {
            item {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(32.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "No students matching \"$searchQuery\"",
                        style = MaterialTheme.typography.bodyMedium,
                        color = Slate500
                    )
                }
            }
        } else {
            // Students Roster List
            items(filtered) { student ->
                val initials = student.fullName.split(" ")
                    .mapNotNull { it.firstOrNull()?.toString() }
                    .take(2)
                    .joinToString("")
                    .ifEmpty { "ST" }

                val beltHexColor = try {
                    Color(android.graphics.Color.parseColor(student.beltColorHex))
                } catch (_: Exception) {
                    Slate200
                }

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { onStudentClick() }
                        .padding(vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    // Circular Initials Avatar
                    Surface(
                        shape = CircleShape,
                        color = BrandNavyTint,
                        modifier = Modifier.size(36.dp)
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Text(
                                text = initials,
                                color = BrandNavy,
                                fontWeight = FontWeight.Bold,
                                fontSize = 12.sp
                            )
                        }
                    }

                    Spacer(modifier = Modifier.width(12.dp))

                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = student.fullName,
                            style = MaterialTheme.typography.bodyMedium,
                            fontWeight = FontWeight.Medium,
                            color = Slate900,
                            fontSize = 14.sp
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            BeltFlowTag(
                                text = student.beltName.ifEmpty { "White Belt" },
                                backgroundColor = beltHexColor.copy(alpha = 0.25f),
                                textColor = Slate900
                            )

                            val primaryClass = student.classNames.firstOrNull() ?: student.lifecycle.name
                            BeltFlowTag(
                                text = primaryClass,
                                backgroundColor = Slate100,
                                textColor = Slate700
                            )
                        }
                    }

                    Icon(
                        imageVector = Icons.Default.ChevronRight,
                        contentDescription = null,
                        tint = Slate400,
                        modifier = Modifier.size(18.dp)
                    )
                }
                HorizontalDivider(color = Slate200.copy(alpha = 0.5f))
            }
        }
    }
}


@Composable
private fun GradingTabContent(
    allGradings: List<GradingEventWithRecords>,
    onNavigateToGradingDetails: () -> Unit
) {
    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 20.dp),
        contentPadding = PaddingValues(top = 16.dp, bottom = 24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        if (allGradings.isEmpty()) {
            item {
                BlueprintCard(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 20.dp)
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Surface(
                            shape = CircleShape,
                            color = BrandNavyTint,
                            modifier = Modifier.size(56.dp)
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Icon(
                                    imageVector = Icons.Default.MilitaryTech,
                                    contentDescription = null,
                                    tint = BrandNavy,
                                    modifier = Modifier.size(30.dp)
                                )
                            }
                        }
                        Spacer(modifier = Modifier.height(14.dp))
                        Text(
                            text = "No Grading Events Scheduled",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            color = BrandNavy
                        )
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                            text = "Upcoming belt promotion examinations and registered candidates will appear here.",
                            style = MaterialTheme.typography.bodySmall,
                            color = Slate600,
                            textAlign = TextAlign.Center
                        )
                        Spacer(modifier = Modifier.height(18.dp))
                        Button(
                            onClick = onNavigateToGradingDetails,
                            colors = ButtonDefaults.buttonColors(containerColor = BrandNavy),
                            shape = RoundedCornerShape(8.dp)
                        ) {
                            Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Schedule Grading Exam", fontWeight = FontWeight.SemiBold, color = Color.White)
                        }
                    }
                }
            }
        } else {
            items(allGradings) { grading ->
                BlueprintCard(
                    onClick = onNavigateToGradingDetails,
                    elevation = 2.dp,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = grading.eventDate,
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold,
                                color = BrandNavy,
                                fontSize = 16.sp
                            )
                            BeltFlowTag(
                                text = if (grading.isCompleted) "Completed" else "Upcoming",
                                backgroundColor = if (grading.isCompleted) Emerald100 else AccentAmber100,
                                textColor = if (grading.isCompleted) Emerald800 else AccentAmber800
                            )
                        }
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = grading.name,
                            style = MaterialTheme.typography.bodyMedium,
                            fontWeight = FontWeight.SemiBold,
                            color = Slate900,
                            fontSize = 14.sp
                        )
                        Spacer(modifier = Modifier.height(2.dp))
                        Text(
                            text = "${grading.location} • Examiner: ${grading.examiner}",
                            style = MaterialTheme.typography.bodySmall,
                            color = Slate600,
                            fontSize = 12.sp
                        )
                        Spacer(modifier = Modifier.height(10.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            BeltFlowTag(
                                text = "${grading.candidateCount} Candidates",
                                backgroundColor = Slate100,
                                textColor = Slate700
                            )
                            if (grading.isCompleted) {
                                BeltFlowTag(
                                    text = "${grading.passCount} Passed",
                                    backgroundColor = Emerald100,
                                    textColor = Emerald800
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun CertificatesTabContent(
    allCertificates: List<CertificateDetail>,
    onViewCertificate: (CertificateDetail) -> Unit
) {
    val context = LocalContext.current

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 20.dp),
        contentPadding = PaddingValues(top = 16.dp, bottom = 24.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        if (allCertificates.isEmpty()) {
            item {
                BlueprintCard(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 20.dp)
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Surface(
                            shape = CircleShape,
                            color = BrandNavyTint,
                            modifier = Modifier.size(56.dp)
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Icon(
                                    imageVector = Icons.Default.WorkspacePremium,
                                    contentDescription = null,
                                    tint = BrandNavy,
                                    modifier = Modifier.size(30.dp)
                                )
                            }
                        }
                        Spacer(modifier = Modifier.height(14.dp))
                        Text(
                            text = "No Certificates Issued Yet",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            color = BrandNavy
                        )
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                            text = "Official digital certificates for belt promotion or tournament awards will be listed here.",
                            style = MaterialTheme.typography.bodySmall,
                            color = Slate600,
                            textAlign = TextAlign.Center
                        )
                    }
                }
            }
        } else {
            items(allCertificates) { cert ->
                BlueprintCard(
                    elevation = 2.dp,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(18.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.Top
                        ) {
                            Text(
                                text = "CERTIFICATE OF PROMOTION",
                                style = MaterialTheme.typography.labelSmall,
                                color = AccentAmber700,
                                fontWeight = FontWeight.Bold,
                                letterSpacing = 0.8.sp,
                                fontSize = 10.sp
                            )
                            OfficialSealBadge(text = "OFF")
                        }

                        Spacer(modifier = Modifier.height(10.dp))

                        Text(
                            text = cert.studentName.uppercase(),
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Bold,
                            color = BrandNavy,
                            fontSize = 19.sp,
                            letterSpacing = 0.5.sp
                        )

                        Spacer(modifier = Modifier.height(2.dp))

                        Text(
                            text = "Promoted to ${cert.title}",
                            style = MaterialTheme.typography.bodySmall,
                            color = Slate600,
                            fontSize = 12.sp
                        )

                        Spacer(modifier = Modifier.height(12.dp))
                        HorizontalDivider(color = Slate200)
                        Spacer(modifier = Modifier.height(8.dp))

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(
                                text = cert.issuedAt,
                                style = MaterialTheme.typography.bodySmall,
                                color = Slate500,
                                fontSize = 11.sp
                            )
                            Text(
                                text = cert.verifyCode,
                                style = MaterialTheme.typography.bodySmall,
                                color = Slate500,
                                fontWeight = FontWeight.Medium,
                                fontSize = 11.sp
                            )
                        }

                        Spacer(modifier = Modifier.height(12.dp))

                        OutlinedButton(
                            onClick = { onViewCertificate(cert) },
                            shape = RoundedCornerShape(6.dp),
                            border = BorderStroke(1.dp, Slate300),
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = BrandNavy),
                            modifier = Modifier.fillMaxWidth().height(38.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Download,
                                contentDescription = "Download",
                                tint = BrandNavy,
                                modifier = Modifier.size(15.dp)
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = "Download PDF / Verify",
                                style = MaterialTheme.typography.labelMedium,
                                fontSize = 12.sp
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun OperationChip(
    title: String,
    icon: ImageVector,
    modifier: Modifier = Modifier,
    onClick: () -> Unit
) {
    Surface(
        color = Color.White,
        shape = RoundedCornerShape(8.dp),
        border = BorderStroke(1.dp, Slate200),
        modifier = modifier.clickable { onClick() }
    ) {
        Column(
            modifier = Modifier.padding(vertical = 10.dp, horizontal = 4.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Icon(
                imageVector = icon,
                contentDescription = title,
                tint = BrandNavy,
                modifier = Modifier.size(18.dp)
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = title,
                style = MaterialTheme.typography.labelSmall,
                color = Slate700,
                fontSize = 10.sp,
                maxLines = 1
            )
        }
    }
}

@Composable
private fun PendingRegistrationsSection(
    pendingProfiles: List<ProfileEntity>,
    onApprove: (String) -> Unit,
    onReject: (String) -> Unit
) {
    BlueprintCard(
        modifier = Modifier
            .fillMaxWidth()
            .testTag("pending_approvals_card"),
        backgroundColor = Color(0xFFFFFBEB),
        borderColor = AccentAmber600
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
                        color = AccentAmber100,
                        modifier = Modifier.size(28.dp)
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Icon(
                                Icons.Default.PersonAdd,
                                contentDescription = null,
                                tint = AccentAmber700,
                                modifier = Modifier.size(16.dp)
                            )
                        }
                    }
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "NEW USER REGISTRATIONS (${pendingProfiles.size})",
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.Bold,
                        color = AccentAmber800,
                        letterSpacing = 0.6.sp
                    )
                }
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = Crimson100,
                    modifier = Modifier.padding(2.dp)
                ) {
                    Text(
                        text = "Pending Approval",
                        color = Crimson600,
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.Bold,
                        fontSize = 11.sp,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                    )
                }
            }

            Text(
                text = "The following users registered an account and need your approval to access the academy portal:",
                style = MaterialTheme.typography.bodySmall,
                color = Slate600,
                modifier = Modifier.padding(top = 6.dp, bottom = 12.dp)
            )

            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                pendingProfiles.forEach { profile ->
                    Surface(
                        shape = RoundedCornerShape(10.dp),
                        color = Color.White,
                        border = BorderStroke(1.dp, Slate200),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(modifier = Modifier.padding(12.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        text = profile.fullName,
                                        style = MaterialTheme.typography.titleSmall,
                                        fontWeight = FontWeight.Bold,
                                        color = BrandNavy
                                    )
                                    Text(
                                        text = profile.email,
                                        style = MaterialTheme.typography.bodySmall,
                                        color = Slate500
                                    )
                                }
                                Surface(
                                    shape = RoundedCornerShape(8.dp),
                                    color = when (profile.role) {
                                        UserRole.PARENT -> Emerald100
                                        UserRole.STUDENT -> Purple100
                                        UserRole.COACH -> Sky100
                                        else -> AccentAmber100
                                    }
                                ) {
                                    Text(
                                        text = profile.role.label.split("/")[0].trim(),
                                        color = when (profile.role) {
                                            UserRole.PARENT -> Emerald800
                                            UserRole.STUDENT -> Purple800
                                            UserRole.COACH -> Sky800
                                            else -> AccentAmber800
                                        },
                                        style = MaterialTheme.typography.labelSmall,
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 11.sp,
                                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp)
                                    )
                                }
                            }

                            if (profile.phone.isNotBlank()) {
                                Spacer(modifier = Modifier.height(4.dp))
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(Icons.Default.Phone, contentDescription = null, tint = Slate400, modifier = Modifier.size(14.dp))
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Text(text = profile.phone, style = MaterialTheme.typography.bodySmall, color = Slate600)
                                }
                            }

                            if (profile.role == UserRole.PARENT && profile.childName.isNotBlank()) {
                                Spacer(modifier = Modifier.height(4.dp))
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(Icons.Default.ChildCare, contentDescription = null, tint = Emerald600, modifier = Modifier.size(14.dp))
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Text(
                                        text = "Child / Student: ${profile.childName}",
                                        style = MaterialTheme.typography.bodySmall,
                                        fontWeight = FontWeight.Medium,
                                        color = BrandNavy
                                    )
                                }
                            }

                            if (profile.assignedClass.isNotBlank()) {
                                Spacer(modifier = Modifier.height(2.dp))
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(Icons.Default.Class, contentDescription = null, tint = Sky600, modifier = Modifier.size(14.dp))
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Text(
                                        text = "Class: ${profile.assignedClass}",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = Slate600
                                    )
                                }
                            }

                            Spacer(modifier = Modifier.height(10.dp))

                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Button(
                                    onClick = { onApprove(profile.id) },
                                    colors = ButtonDefaults.buttonColors(containerColor = Emerald600),
                                    shape = RoundedCornerShape(8.dp),
                                    modifier = Modifier
                                        .weight(1f)
                                        .height(38.dp)
                                        .testTag("approve_btn_${profile.id}")
                                ) {
                                    Icon(Icons.Default.Check, contentDescription = null, modifier = Modifier.size(16.dp))
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Text("Accept User", fontSize = 13.sp, fontWeight = FontWeight.Bold)
                                }

                                OutlinedButton(
                                    onClick = { onReject(profile.id) },
                                    border = BorderStroke(1.dp, Crimson600.copy(alpha = 0.5f)),
                                    colors = ButtonDefaults.outlinedButtonColors(contentColor = Crimson600),
                                    shape = RoundedCornerShape(8.dp),
                                    modifier = Modifier
                                        .weight(0.7f)
                                        .height(38.dp)
                                        .testTag("reject_btn_${profile.id}")
                                ) {
                                    Icon(Icons.Default.Close, contentDescription = null, modifier = Modifier.size(16.dp))
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Text("Decline", fontSize = 13.sp)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

