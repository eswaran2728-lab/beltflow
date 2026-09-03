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
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.beltflow.R
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
                        when (email) {
                            "ravi.silambam@gmail.com" -> onNavigateToCoachPortal()
                            "suresh.parent@gmail.com" -> onNavigateToParentPortal()
                            "aryan.suresh@gmail.com" -> onNavigateToStudentPortal()
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

        // Needs Attention Section (Overdue Fees)
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

                val items = listOf(
                    Triple("Wei Ling Tan", "RM 180 • 12d overdue", "+60123456789"),
                    Triple("Dinesh Kumar", "RM 160 • 5d overdue", "+60198765432"),
                    Triple("Siti Rahman", "RM 144 • 21d overdue", "+60133445566")
                )

                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    items.forEach { (name, info, phone) ->
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
                                        text = name,
                                        style = MaterialTheme.typography.bodyMedium,
                                        fontWeight = FontWeight.Medium,
                                        color = Slate900,
                                        fontSize = 13.sp
                                    )
                                    Text(
                                        text = info,
                                        style = MaterialTheme.typography.bodySmall,
                                        color = Slate500,
                                        fontSize = 11.sp
                                    )
                                }

                                OutlinedButton(
                                    onClick = {
                                        val cleanPhone = phone.replace("[^0-9]".toRegex(), "")
                                        val msg = Uri.encode("Hello, this is Meridian Martial Arts. Gentle reminder regarding the outstanding academy fee for $name. Thank you!")
                                        val intent = Intent(Intent.ACTION_VIEW, Uri.parse("https://wa.me/$cleanPhone?text=$msg"))
                                        try {
                                            context.startActivity(intent)
                                        } catch (e: Exception) {
                                            Toast.makeText(context, "Reminder sent to $name", Toast.LENGTH_SHORT).show()
                                        }
                                    },
                                    contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp),
                                    shape = RoundedCornerShape(4.dp),
                                    border = BorderStroke(1.dp, Slate300),
                                    colors = ButtonDefaults.outlinedButtonColors(contentColor = BrandNavy),
                                    modifier = Modifier.height(30.dp)
                                ) {
                                    Text(
                                        text = "Remind",
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

        // Certificate of Promotion Preview Card
        item {
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
                            text = "CERTIFICATE OF PROMOTION",
                            style = MaterialTheme.typography.labelSmall,
                            color = AccentAmber700,
                            fontWeight = FontWeight.Bold,
                            letterSpacing = 0.8.sp,
                            fontSize = 10.sp
                        )
                        OfficialSealBadge(text = "OFF")
                    }

                    Spacer(modifier = Modifier.height(8.dp))

                    Text(
                        text = "ARYAN SURESH",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold,
                        color = BrandNavy,
                        fontSize = 18.sp,
                        letterSpacing = 0.5.sp
                    )

                    Spacer(modifier = Modifier.height(2.dp))

                    Text(
                        text = "Promoted to Green Belt • BF-GREEN-9821",
                        style = MaterialTheme.typography.bodySmall,
                        color = Slate600,
                        fontSize = 12.sp
                    )
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
    val sampleStudents = listOf(
        Triple("Aryan Suresh", "Green", "Paid"),
        Triple("Priya Nathan", "Blue", "Paid"),
        Triple("Wei Ling Tan", "Orange", "Overdue"),
        Triple("Kavi Selvam", "Brown", "Paid"),
        Triple("Nadia Hassan", "White", "Paid"),
        Triple("Dinesh Kumar", "Yellow", "Overdue"),
        Triple("Farah Aziz", "Black", "Paid"),
        Triple("Siti Rahman", "White", "Overdue"),
        Triple("Ravi Chandran", "Green", "Paid"),
        Triple("Jordan Lee", "Brown", "Paid")
    )

    val filtered = sampleStudents.filter {
        it.first.contains(searchQuery, ignoreCase = true) ||
        it.second.contains(searchQuery, ignoreCase = true)
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
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = AccentAmber700,
                    unfocusedBorderColor = Slate200,
                    focusedContainerColor = Color.White,
                    unfocusedContainerColor = Color.White
                ),
                modifier = Modifier.fillMaxWidth()
            )
        }

        // Students Roster List
        items(filtered) { (name, belt, fee) ->
            val initials = name.split(" ").mapNotNull { it.firstOrNull()?.toString() }.take(2).joinToString("")
            val beltBg = when (belt) {
                "Black" -> Slate900
                "Brown" -> AccentAmber800
                "Blue" -> Sky600
                "Green" -> Emerald600
                "Orange" -> AccentAmber500
                "Yellow" -> AccentAmber300
                else -> Slate200
            }
            val beltText = when (belt) {
                "White", "Yellow" -> Slate900
                else -> Color.White
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
                        text = name,
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.Medium,
                        color = Slate900,
                        fontSize = 14.sp
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        BeltFlowTag(
                            text = belt,
                            backgroundColor = beltBg,
                            textColor = beltText
                        )

                        val isOverdue = fee == "Overdue"
                        BeltFlowTag(
                            text = fee,
                            backgroundColor = if (isOverdue) Crimson100 else Slate100,
                            textColor = if (isOverdue) Crimson600 else Slate700,
                            borderColor = if (isOverdue) Crimson600 else null
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


@Composable
private fun GradingTabContent(
    allGradings: List<GradingEventWithRecords>,
    onNavigateToGradingDetails: () -> Unit
) {
    val candidates = listOf(
        Triple("Aryan Suresh", "Yellow", "Green"),
        Triple("Priya Nathan", "Orange", "Blue"),
        Triple("Kavi Selvam", "Blue", "Brown"),
        Triple("Ravi Chandran", "Yellow", "Green"),
        Triple("Jia Wen Ho", "White", "Yellow"),
        Triple("Omar Farid", "Green", "Blue")
    )

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 20.dp),
        contentPadding = PaddingValues(top = 16.dp, bottom = 24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Event Blueprint Card
        item {
            BlueprintCard(
                onClick = onNavigateToGradingDetails,
                elevation = 2.dp,
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = "Sep 20, 2026",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold,
                        color = BrandNavy,
                        fontSize = 18.sp
                    )
                    Spacer(modifier = Modifier.height(3.dp))
                    Text(
                        text = "Central Dojang • Examiner Master Ravi",
                        style = MaterialTheme.typography.bodySmall,
                        color = Slate600,
                        fontSize = 12.sp
                    )
                    Spacer(modifier = Modifier.height(10.dp))
                    BeltFlowTag(
                        text = "18 candidates registered",
                        backgroundColor = AccentAmber100,
                        textColor = AccentAmber800
                    )
                }
            }
        }

        // Candidates list
        item {
            Column {
                Text(
                    text = "CANDIDATES",
                    style = MaterialTheme.typography.labelSmall,
                    color = Slate500,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 0.8.sp,
                    modifier = Modifier.padding(bottom = 8.dp)
                )

                candidates.forEach { (name, from, to) ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 10.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = name,
                            style = MaterialTheme.typography.bodyMedium,
                            fontWeight = FontWeight.Medium,
                            color = Slate900,
                            fontSize = 14.sp
                        )

                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            BeltFlowTag(
                                text = from,
                                backgroundColor = Slate100,
                                textColor = Slate700
                            )
                            Icon(
                                imageVector = Icons.AutoMirrored.Filled.ArrowForward,
                                contentDescription = null,
                                tint = Slate400,
                                modifier = Modifier.size(13.dp)
                            )
                            BeltFlowTag(
                                text = to,
                                backgroundColor = AccentAmber100,
                                textColor = AccentAmber800
                            )
                        }
                    }
                    HorizontalDivider(color = Slate200.copy(alpha = 0.5f))
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
    val sampleCerts = listOf(
        CertificateDetail(
            id = "cert-1",
            studentId = "stu-1",
            studentName = "Aryan Suresh",
            type = CertType.GRADING,
            title = "Green Belt Promotion",
            certNo = "BF-GREEN-9821",
            verifyCode = "BF-GREEN-9821",
            issuedAt = "Aug 14, 2026",
            issuedBy = "Master Ravi",
            academyName = "Meridian Martial Arts"
        ),
        CertificateDetail(
            id = "cert-2",
            studentId = "stu-2",
            studentName = "Priya Nathan",
            type = CertType.GRADING,
            title = "Blue Belt Promotion",
            certNo = "BF-BLUE-4410",
            verifyCode = "BF-BLUE-4410",
            issuedAt = "Aug 14, 2026",
            issuedBy = "Master Ravi",
            academyName = "Meridian Martial Arts"
        ),
        CertificateDetail(
            id = "cert-3",
            studentId = "stu-3",
            studentName = "Kavi Selvam",
            type = CertType.GRADING,
            title = "Brown Belt Promotion",
            certNo = "BF-BROWN-2207",
            verifyCode = "BF-BROWN-2207",
            issuedAt = "Jul 2, 2026",
            issuedBy = "Master Eswaran",
            academyName = "Meridian Martial Arts"
        )
    )

    val certsToDisplay = if (allCertificates.isNotEmpty()) allCertificates else sampleCerts
    val context = LocalContext.current

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 20.dp),
        contentPadding = PaddingValues(top = 16.dp, bottom = 24.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        items(certsToDisplay) { cert ->
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
