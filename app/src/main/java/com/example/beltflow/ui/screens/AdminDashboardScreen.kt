package com.example.beltflow.ui.screens

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.beltflow.data.local.ProfileEntity
import com.example.beltflow.data.model.InvoiceStatus
import com.example.beltflow.data.model.ProfileStatus
import com.example.beltflow.data.model.UserRole
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
    val allProfiles by viewModel.allProfiles.collectAsState()
    val allInvoices by viewModel.allInvoices.collectAsState()

    val pendingProfiles = allProfiles.filter { it.status == ProfileStatus.PENDING }
    val atRiskStudents = allStudents.filter { it.isAtRisk }

    val context = LocalContext.current

    Scaffold(
        topBar = {
            TopNavBar(
                title = "BeltFlow Admin",
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
        containerColor = MaterialTheme.colorScheme.background
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
            contentPadding = PaddingValues(vertical = 16.dp)
        ) {
            // Academy Welcome Banner
            item {
                Card(
                    shape = RoundedCornerShape(20.dp),
                    colors = CardDefaults.cardColors(containerColor = Navy800),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier.padding(20.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = "Persatuan Silambam Malaysia",
                                style = MaterialTheme.typography.labelMedium,
                                color = Gold500,
                                fontWeight = FontWeight.Bold
                            )
                            Spacer(modifier = Modifier.height(2.dp))
                            Text(
                                text = "Daerah Sepang Academy",
                                style = MaterialTheme.typography.titleLarge,
                                color = Color.White,
                                fontWeight = FontWeight.Bold
                            )
                            Spacer(modifier = Modifier.height(6.dp))
                            Text(
                                text = "Overview of active classes, fees, grading readiness, and attendance.",
                                style = MaterialTheme.typography.bodySmall,
                                color = Slate200
                            )
                        }
                        Surface(
                            color = Navy700,
                            shape = CircleShape,
                            modifier = Modifier.size(48.dp)
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Icon(Icons.Default.SportsMartialArts, contentDescription = null, tint = Gold500)
                            }
                        }
                    }
                }
            }

            // Key Metrics
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    StatCard(
                        title = "Active Students",
                        value = "${stats.activeStudents}",
                        subtitle = "of ${stats.totalStudents} enrolled",
                        icon = Icons.Default.Groups,
                        accentColor = Sky600,
                        modifier = Modifier.weight(1f),
                        onClick = onNavigateToStudents
                    )
                    StatCard(
                        title = "Monthly Fees",
                        value = "RM %.0f".format(stats.monthlyRevenue),
                        subtitle = "${stats.pendingInvoicesCount} unpaid/pending",
                        icon = Icons.Default.Payments,
                        accentColor = Emerald600,
                        modifier = Modifier.weight(1f),
                        onClick = onNavigateToBilling
                    )
                }
            }

            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    StatCard(
                        title = "At-Risk Retention",
                        value = "${stats.atRiskStudents}",
                        subtitle = "3+ recent absences",
                        icon = Icons.Default.WarningAmber,
                        accentColor = Crimson600,
                        modifier = Modifier.weight(1f),
                        onClick = onNavigateToAttendance
                    )
                    StatCard(
                        title = "Upcoming Grading",
                        value = "${stats.upcomingGradingCount}",
                        subtitle = "exams scheduled",
                        icon = Icons.Default.MilitaryTech,
                        accentColor = Gold500,
                        modifier = Modifier.weight(1f),
                        onClick = onNavigateToGrading
                    )
                }
            }

            // At-Risk Alert Banner (if any)
            if (atRiskStudents.isNotEmpty()) {
                item {
                    Card(
                        colors = CardDefaults.cardColors(containerColor = Crimson100),
                        shape = RoundedCornerShape(16.dp),
                        modifier = Modifier.fillMaxWidth().testTag("at_risk_alert_card")
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Default.ErrorOutline, contentDescription = null, tint = Crimson600)
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(
                                    text = "Retention Alert: ${atRiskStudents.size} Student(s) At-Risk",
                                    style = MaterialTheme.typography.titleSmall,
                                    fontWeight = FontWeight.Bold,
                                    color = Crimson600
                                )
                            }
                            Spacer(modifier = Modifier.height(8.dp))
                            atRiskStudents.forEach { student ->
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(vertical = 4.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Column {
                                        Text(student.fullName, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Bold)
                                        Text(
                                            "${student.recentAbsenceCount} absences in last sessions • ${student.parentPhone}",
                                            style = MaterialTheme.typography.bodySmall,
                                            color = Slate700
                                        )
                                    }
                                    FilledTonalButton(
                                        onClick = {
                                            val phoneClean = student.parentPhone.replace("[^0-9]".toRegex(), "")
                                            val msg = Uri.encode("Hello ${student.parentName}, this is Master Eswaran from BeltFlow Silambam. We noticed ${student.fullName} missed recent classes. Please let us know if everything is alright!")
                                            val intent = Intent(Intent.ACTION_VIEW, Uri.parse("https://wa.me/$phoneClean?text=$msg"))
                                            try { context.startActivity(intent) } catch (e: Exception) {}
                                        },
                                        colors = ButtonDefaults.filledTonalButtonColors(containerColor = Crimson600, contentColor = Color.White),
                                        contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp),
                                        modifier = Modifier.testTag("whatsapp_remind_button_${student.id}")
                                    ) {
                                        Icon(Icons.Default.Send, contentDescription = null, modifier = Modifier.size(14.dp))
                                        Spacer(modifier = Modifier.width(4.dp))
                                        Text("WhatsApp", style = MaterialTheme.typography.labelSmall)
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // Pending Approvals (if any)
            if (pendingProfiles.isNotEmpty()) {
                item {
                    Card(
                        colors = CardDefaults.cardColors(containerColor = Gold100),
                        shape = RoundedCornerShape(16.dp),
                        modifier = Modifier.fillMaxWidth().testTag("pending_approvals_card")
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Default.PersonAdd, contentDescription = null, tint = Gold600)
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(
                                    text = "Pending Account Approvals (${pendingProfiles.size})",
                                    style = MaterialTheme.typography.titleSmall,
                                    fontWeight = FontWeight.Bold,
                                    color = Gold600
                                )
                            }
                            Spacer(modifier = Modifier.height(8.dp))
                            pendingProfiles.forEach { profile ->
                                PendingProfileRow(
                                    profile = profile,
                                    onApprove = { viewModel.approveProfile(profile.id) },
                                    onReject = { viewModel.rejectProfile(profile.id) }
                                )
                            }
                        }
                    }
                }
            }

            // Module Navigation Hub
            item {
                Text(
                    text = "Academy Management Modules",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onBackground
                )
            }

            item {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        ModuleButton(
                            title = "Students & Bio",
                            subtitle = "${stats.totalStudents} registered",
                            icon = Icons.Default.School,
                            accentColor = Sky600,
                            modifier = Modifier.weight(1f),
                            onClick = onNavigateToStudents
                        )
                        ModuleButton(
                            title = "Attendance Roster",
                            subtitle = "Mark sessions & history",
                            icon = Icons.Default.FactCheck,
                            accentColor = Emerald600,
                            modifier = Modifier.weight(1f),
                            onClick = onNavigateToAttendance
                        )
                    }

                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        ModuleButton(
                            title = "Fee Billing & Cash",
                            subtitle = "Receipts & 10% Sibling",
                            icon = Icons.Default.ReceiptLong,
                            accentColor = Gold500,
                            modifier = Modifier.weight(1f),
                            onClick = onNavigateToBilling
                        )
                        ModuleButton(
                            title = "Belt Gradings",
                            subtitle = "Exams & promotions",
                            icon = Icons.Default.MilitaryTech,
                            accentColor = Purple600,
                            modifier = Modifier.weight(1f),
                            onClick = onNavigateToGrading
                        )
                    }

                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        ModuleButton(
                            title = "Skills Curriculum",
                            subtitle = "Kaaladi & Weaponry",
                            icon = Icons.Default.FitnessCenter,
                            accentColor = Sky600,
                            modifier = Modifier.weight(1f),
                            onClick = onNavigateToCurriculum
                        )
                        ModuleButton(
                            title = "Tournaments",
                            subtitle = "Medal tally & points",
                            icon = Icons.Default.EmojiEvents,
                            accentColor = Gold600,
                            modifier = Modifier.weight(1f),
                            onClick = onNavigateToTournaments
                        )
                    }

                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        ModuleButton(
                            title = "Certificates",
                            subtitle = "Digital certs & verification",
                            icon = Icons.Default.WorkspacePremium,
                            accentColor = Navy800,
                            modifier = Modifier.weight(1f),
                            onClick = onNavigateToCertificates
                        )
                        ModuleButton(
                            title = "Academy Settings",
                            subtitle = "Branches, Belts, Fees",
                            icon = Icons.Default.Settings,
                            accentColor = Slate700,
                            modifier = Modifier.weight(1f),
                            onClick = onNavigateToSettings
                        )
                    }
                }
            }

            // Quick Portal Access Switcher
            item {
                Card(
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(
                            text = "🎭 Switch into Dedicated Role Portals",
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                        Spacer(modifier = Modifier.height(10.dp))
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            OutlinedButton(
                                onClick = {
                                    viewModel.loginAs("ravi.silambam@gmail.com") { onNavigateToCoachPortal() }
                                },
                                modifier = Modifier.weight(1f).testTag("switch_to_coach_button")
                            ) {
                                Text("Coach", style = MaterialTheme.typography.labelSmall)
                            }
                            OutlinedButton(
                                onClick = {
                                    viewModel.loginAs("suresh.parent@gmail.com") { onNavigateToParentPortal() }
                                },
                                modifier = Modifier.weight(1f).testTag("switch_to_parent_button")
                            ) {
                                Text("Parent", style = MaterialTheme.typography.labelSmall)
                            }
                            OutlinedButton(
                                onClick = {
                                    viewModel.loginAs("aryan.suresh@gmail.com") { onNavigateToStudentPortal() }
                                },
                                modifier = Modifier.weight(1f).testTag("switch_to_student_button")
                            ) {
                                Text("Student", style = MaterialTheme.typography.labelSmall)
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ModuleButton(
    title: String,
    subtitle: String,
    icon: ImageVector,
    accentColor: Color,
    modifier: Modifier = Modifier,
    onClick: () -> Unit
) {
    Card(
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
        modifier = modifier
            .clickable { onClick() }
            .testTag("module_button_$title")
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Surface(
                color = accentColor.copy(alpha = 0.15f),
                shape = CircleShape,
                modifier = Modifier.size(40.dp)
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(icon, contentDescription = title, tint = accentColor, modifier = Modifier.size(22.dp))
                }
            }
            Spacer(modifier = Modifier.height(10.dp))
            Text(title, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
            Spacer(modifier = Modifier.height(2.dp))
            Text(subtitle, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
private fun PendingProfileRow(
    profile: ProfileEntity,
    onApprove: () -> Unit,
    onReject: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(profile.fullName, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Bold)
            Text(
                "${profile.role.label} • ${profile.email} ${if (profile.childName.isNotBlank()) "• Child: ${profile.childName}" else ""}",
                style = MaterialTheme.typography.bodySmall,
                color = Slate700
            )
        }
        Row {
            IconButton(onClick = onApprove, modifier = Modifier.size(32.dp).testTag("approve_profile_${profile.id}")) {
                Icon(Icons.Default.CheckCircle, contentDescription = "Approve", tint = Emerald600)
            }
            IconButton(onClick = onReject, modifier = Modifier.size(32.dp).testTag("reject_profile_${profile.id}")) {
                Icon(Icons.Default.Cancel, contentDescription = "Reject", tint = Crimson600)
            }
        }
    }
}
