package com.example.beltflow.ui.screens

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
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.example.beltflow.data.model.InvoiceStatus
import com.example.beltflow.data.model.StudentWithDetails
import com.example.beltflow.ui.components.*
import com.example.beltflow.ui.theme.*
import com.example.beltflow.ui.viewmodels.BeltFlowViewModel

@Composable
fun CoachPortalScreen(
    viewModel: BeltFlowViewModel,
    onNavigateToAttendance: () -> Unit,
    onNavigateToGrading: () -> Unit,
    onNavigateToCurriculum: () -> Unit,
    onStudentClick: (String) -> Unit,
    onLogout: () -> Unit
) {
    val currentUser by viewModel.currentUser.collectAsState()
    val allClasses by viewModel.allClasses.collectAsState()
    val allStudents by viewModel.allStudents.collectAsState()
    val allInvoices by viewModel.allInvoices.collectAsState()

    val pendingCashInvoices = allInvoices.filter { it.status == InvoiceStatus.PENDING_APPROVAL }

    Scaffold(
        topBar = {
            TopNavBar(
                title = "Coach Portal",
                currentUser = currentUser,
                onSwitchUser = { email -> viewModel.loginAs(email) {} },
                onLogout = onLogout
            )
        },
        containerColor = MaterialTheme.colorScheme.background
    ) { padding ->
        LazyColumn(
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
            modifier = Modifier.fillMaxSize().padding(padding)
        ) {
            // Coach Header
            item {
                Card(
                    shape = RoundedCornerShape(20.dp),
                    colors = CardDefaults.cardColors(containerColor = Navy800),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Surface(color = Navy700, shape = CircleShape, modifier = Modifier.size(48.dp)) {
                                Box(contentAlignment = Alignment.Center) {
                                    Icon(Icons.Default.SportsMartialArts, contentDescription = null, tint = Gold500)
                                }
                            }
                            Spacer(modifier = Modifier.width(12.dp))
                            Column {
                                Text(currentUser?.fullName ?: "Coach Ravi", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = Color.White)
                                Text("Head Coach • Sepang Silambam Dojo", style = MaterialTheme.typography.bodySmall, color = Slate200)
                            }
                        }

                        Spacer(modifier = Modifier.height(14.dp))

                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Button(
                                onClick = onNavigateToAttendance,
                                colors = ButtonDefaults.buttonColors(containerColor = Gold500, contentColor = Navy900),
                                shape = RoundedCornerShape(10.dp),
                                modifier = Modifier.weight(1f).testTag("coach_take_attendance_btn")
                            ) {
                                Icon(Icons.Default.FactCheck, contentDescription = null)
                                Spacer(modifier = Modifier.width(6.dp))
                                Text("Take Attendance", fontWeight = FontWeight.Bold)
                            }
                            OutlinedButton(
                                onClick = onNavigateToGrading,
                                colors = ButtonDefaults.outlinedButtonColors(contentColor = Color.White),
                                shape = RoundedCornerShape(10.dp),
                                modifier = Modifier.weight(1f)
                            ) {
                                Text("Grading")
                            }
                        }
                    }
                }
            }

            // Pending Cash Approvals (if any)
            if (pendingCashInvoices.isNotEmpty()) {
                item {
                    Card(
                        colors = CardDefaults.cardColors(containerColor = Gold100),
                        shape = RoundedCornerShape(16.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Default.Payments, contentDescription = null, tint = Gold600)
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(
                                    text = "Pending Cash Approvals (${pendingCashInvoices.size})",
                                    style = MaterialTheme.typography.titleSmall,
                                    fontWeight = FontWeight.Bold,
                                    color = Gold600
                                )
                            }
                            Spacer(modifier = Modifier.height(8.dp))
                            pendingCashInvoices.forEach { inv ->
                                val pendingPayment = inv.payments.find { it.approvedBy == null }
                                Row(
                                    modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Column {
                                        Text(inv.studentName, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Bold)
                                        Text("RM %.2f • ${inv.billingMonth}".format(inv.netAmount), style = MaterialTheme.typography.bodySmall, color = Slate700)
                                    }
                                    if (pendingPayment != null) {
                                        Button(
                                            onClick = { viewModel.approvePayment(pendingPayment.id, inv.id) },
                                            colors = ButtonDefaults.buttonColors(containerColor = Emerald600),
                                            shape = RoundedCornerShape(8.dp),
                                            contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp)
                                        ) {
                                            Text("Approve", style = MaterialTheme.typography.labelSmall)
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // Active Classes List
            item {
                Text("Assigned Martial Arts Classes", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            }
            items(allClasses) { cls ->
                Card(
                    shape = RoundedCornerShape(14.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(14.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(cls.name, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                            Surface(color = Slate100, shape = RoundedCornerShape(6.dp)) {
                                Text(cls.code, style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp))
                            }
                        }
                        Spacer(modifier = Modifier.height(4.dp))
                        Text("Schedule: ${cls.scheduleNote} • Branch: ${cls.branchName}", style = MaterialTheme.typography.bodySmall, color = Slate600)
                    }
                }
            }

            // Quick Student Roster
            item {
                Text("Student Roster (${allStudents.size})", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            }
            items(allStudents) { st ->
                StudentCardItem(student = st, onClick = { onStudentClick(st.id) })
            }
        }
    }
}
