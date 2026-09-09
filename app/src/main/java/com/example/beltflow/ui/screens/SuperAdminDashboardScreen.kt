package com.example.beltflow.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.beltflow.data.model.SubscriptionPlan
import com.example.beltflow.data.model.UserRole
import com.example.beltflow.ui.components.BlueprintCard
import com.example.beltflow.ui.components.RoleBadge
import com.example.beltflow.ui.viewmodels.BeltFlowViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SuperAdminDashboardScreen(
    viewModel: BeltFlowViewModel,
    onLogout: () -> Unit,
    onSwitchUser: (String) -> Unit
) {
    val stats by viewModel.superAdminDashboardStats.collectAsState()
    val persatuans by viewModel.allPersatuans.collectAsState()
    val currentUser by viewModel.currentUser.collectAsState()

    var showCreateDialog by remember { mutableStateOf(false) }
    var persatuanName by remember { mutableStateOf("") }
    var adminEmail by remember { mutableStateOf("") }
    var adminFullName by remember { mutableStateOf("") }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                "ADMIN BELTFLOW",
                                fontWeight = FontWeight.Bold,
                                fontSize = 18.sp,
                                letterSpacing = 1.sp
                            )
                            Spacer(Modifier.width(8.dp))
                            RoleBadge(role = UserRole.SUPER_ADMIN)
                        }
                        Text(
                            "Platform Super Admin Control Center",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                },
                actions = {
                    IconButton(onClick = { showCreateDialog = true }) {
                        Icon(Icons.Default.Add, contentDescription = "Add Persatuan")
                    }
                    IconButton(onClick = onLogout) {
                        Icon(Icons.Default.Logout, contentDescription = "Logout")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surfaceVariant
                )
            )
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Platform Stats Row
            item {
                Text(
                    "BELTFLOW PLATFORM METRICS",
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary
                )
                Spacer(Modifier.height(8.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    BlueprintCard(modifier = Modifier.weight(1f)) {
                        Column(modifier = Modifier.padding(12.dp)) {
                            Text("Active Persatuans", style = MaterialTheme.typography.labelSmall)
                            Text(
                                "${stats.activePersatuans}",
                                style = MaterialTheme.typography.headlineMedium,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                "Total: ${stats.totalPersatuans}",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }

                    BlueprintCard(modifier = Modifier.weight(1f)) {
                        Column(modifier = Modifier.padding(12.dp)) {
                            Text("SaaS Subscription Revenue", style = MaterialTheme.typography.labelSmall)
                            Text(
                                "RM ${stats.totalMonthlySubscriptionRevenue.toInt()}",
                                style = MaterialTheme.typography.headlineMedium,
                                fontWeight = FontWeight.Bold,
                                color = Color(0xFF059669)
                            )
                            Text(
                                "Monthly Recurring",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }
            }

            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    BlueprintCard(modifier = Modifier.weight(1f)) {
                        Column(modifier = Modifier.padding(12.dp)) {
                            Text("Platform Charges Cut", style = MaterialTheme.typography.labelSmall)
                            Text(
                                "RM ${stats.totalPlatformChargesCollected.toInt()}",
                                style = MaterialTheme.typography.headlineMedium,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.primary
                            )
                            Text(
                                "8.0% Auto-deducted",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }

                    BlueprintCard(modifier = Modifier.weight(1f)) {
                        Column(modifier = Modifier.padding(12.dp)) {
                            Text("Total Platform Members", style = MaterialTheme.typography.labelSmall)
                            Text(
                                "${stats.totalPlatformStudents}",
                                style = MaterialTheme.typography.headlineMedium,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                "Across all Persatuans",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }
            }

            // Persatuan Directory List
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        "REGISTERED PERSATUAN ORGANIZATIONS",
                        style = MaterialTheme.typography.labelMedium,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.primary
                    )
                    Button(onClick = { showCreateDialog = true }) {
                        Text("+ Provision Persatuan")
                    }
                }
            }

            items(persatuans) { persatuan ->
                BlueprintCard(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                persatuan.name,
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold
                            )
                            Badge(containerColor = MaterialTheme.colorScheme.primaryContainer) {
                                Text(persatuan.subscriptionPlan.label, color = MaterialTheme.colorScheme.onPrimaryContainer)
                            }
                        }
                        Spacer(Modifier.height(6.dp))
                        Text(
                            "Admin Email: ${persatuan.email} | Fee Cut: ${persatuan.platformChargeRatePercent}%",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Spacer(Modifier.height(4.dp))
                        Text(
                            "Status: ${persatuan.status.label} | Renews: ${persatuan.renewalDate}",
                            style = MaterialTheme.typography.bodySmall,
                            fontWeight = FontWeight.Medium
                        )
                    }
                }
            }
        }
    }

    if (showCreateDialog) {
        AlertDialog(
            onDismissRequest = { showCreateDialog = false },
            title = { Text("Provision New Persatuan") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    OutlinedTextField(
                        value = persatuanName,
                        onValueChange = { persatuanName = it },
                        label = { Text("Persatuan Organization Name") },
                        modifier = Modifier.fillMaxWidth()
                    )
                    OutlinedTextField(
                        value = adminFullName,
                        onValueChange = { adminFullName = it },
                        label = { Text("Admin Persatuan Full Name") },
                        modifier = Modifier.fillMaxWidth()
                    )
                    OutlinedTextField(
                        value = adminEmail,
                        onValueChange = { adminEmail = it },
                        label = { Text("Admin Email Address") },
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            },
            confirmButton = {
                Button(onClick = {
                    if (persatuanName.isNotBlank() && adminEmail.isNotBlank()) {
                        viewModel.createPersatuan(
                            name = persatuanName,
                            adminEmail = adminEmail,
                            adminFullName = adminFullName,
                            plan = SubscriptionPlan.GROWTH,
                            chargePercent = 8.0
                        )
                        showCreateDialog = false
                        persatuanName = ""
                        adminEmail = ""
                        adminFullName = ""
                    }
                }) {
                    Text("Create & Provision")
                }
            },
            dismissButton = {
                TextButton(onClick = { showCreateDialog = false }) {
                    Text("Cancel")
                }
            }
        )
    }
}
