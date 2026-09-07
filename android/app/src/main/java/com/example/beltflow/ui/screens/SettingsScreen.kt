package com.example.beltflow.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
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
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.example.beltflow.data.local.AcademySettingsEntity
import com.example.beltflow.data.local.BeltEntity
import com.example.beltflow.data.local.BranchEntity
import com.example.beltflow.data.local.ClassEntity
import com.example.beltflow.data.model.*
import com.example.beltflow.ui.components.*
import com.example.beltflow.ui.theme.*
import com.example.beltflow.ui.viewmodels.BeltFlowViewModel

@Composable
fun SettingsScreen(
    viewModel: BeltFlowViewModel,
    onBack: () -> Unit
) {
    val currentUser by viewModel.currentUser.collectAsState()
    val settings by viewModel.academySettings.collectAsState()
    val allBelts by viewModel.allBelts.collectAsState()
    val allBranches by viewModel.allBranches.collectAsState()
    val allClasses by viewModel.allClasses.collectAsState()
    val allProfiles by viewModel.allProfiles.collectAsState()

    var showAddBeltDialog by remember { mutableStateOf(false) }
    var showAddBranchDialog by remember { mutableStateOf(false) }
    var showAddClassDialog by remember { mutableStateOf(false) }
    var isSavedToast by remember { mutableStateOf(false) }

    var academyName by remember { mutableStateOf(settings?.name ?: "Persatuan Silambam Malaysia Daerah Sepang") }
    var phone by remember { mutableStateOf(settings?.phone ?: "+60 12-345 6789") }
    var address by remember { mutableStateOf(settings?.address ?: "Dojo Sepang Utama, Selangor") }
    var defaultMonthlyFee by remember { mutableStateOf((settings?.defaultMonthlyFee ?: 80.0).toString()) }
    var siblingDiscountPercent by remember { mutableStateOf((settings?.siblingDiscountPercent ?: 10.0).toString()) }

    // Synchronize when settings load
    LaunchedEffect(settings) {
        settings?.let {
            academyName = it.name
            phone = it.phone
            address = it.address
            defaultMonthlyFee = it.defaultMonthlyFee.toString()
            siblingDiscountPercent = it.siblingDiscountPercent.toString()
        }
    }

    Scaffold(
        topBar = {
            TopNavBar(
                title = "Academy Settings",
                currentUser = currentUser,
                onSwitchUser = { viewModel.loginAs(it) {} },
                onLogout = { viewModel.logout() },
                onBack = onBack
            )
        },
        containerColor = MaterialTheme.colorScheme.background
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Academy Profile Card
            Card(
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text("Academy Profile & Financial Defaults", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = Navy800)
                    Spacer(modifier = Modifier.height(12.dp))

                    OutlinedTextField(
                        value = academyName,
                        onValueChange = { academyName = it },
                        label = { Text("Academy / Club Name") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth().testTag("academy_name_input")
                    )

                    Spacer(modifier = Modifier.height(8.dp))

                    OutlinedTextField(
                        value = phone,
                        onValueChange = { phone = it },
                        label = { Text("Contact Phone") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )

                    Spacer(modifier = Modifier.height(8.dp))

                    OutlinedTextField(
                        value = address,
                        onValueChange = { address = it },
                        label = { Text("Headquarters Address") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )

                    Spacer(modifier = Modifier.height(8.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        OutlinedTextField(
                            value = defaultMonthlyFee,
                            onValueChange = { defaultMonthlyFee = it },
                            label = { Text("Default Fee (RM)") },
                            singleLine = true,
                            modifier = Modifier.weight(1f).testTag("default_fee_input")
                        )

                        OutlinedTextField(
                            value = siblingDiscountPercent,
                            onValueChange = { siblingDiscountPercent = it },
                            label = { Text("Sibling Discount %") },
                            singleLine = true,
                            modifier = Modifier.weight(1f).testTag("sibling_discount_input")
                        )
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    Button(
                        onClick = {
                            val fee = defaultMonthlyFee.toDoubleOrNull() ?: 80.0
                            val discount = siblingDiscountPercent.toDoubleOrNull() ?: 10.0
                            viewModel.saveAcademySettings(
                                AcademySettingsEntity(
                                    id = settings?.id ?: "academy_main",
                                    name = academyName.trim(),
                                    phone = phone.trim(),
                                    address = address.trim(),
                                    defaultMonthlyFee = fee,
                                    siblingDiscountPercent = discount
                                )
                            ) {
                                isSavedToast = true
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = Navy800),
                        modifier = Modifier.fillMaxWidth().testTag("save_academy_settings_button")
                    ) {
                        Text("Save Academy Settings")
                    }
                }
            }

            // Belt Ranks Manager
            Card(
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("Belt Rank Progression", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = Navy800)
                        IconButton(onClick = { showAddBeltDialog = true }) {
                            Icon(Icons.Default.AddCircle, contentDescription = "Add Belt", tint = Navy800)
                        }
                    }

                    Spacer(modifier = Modifier.height(8.dp))

                    allBelts.sortedBy { it.sortOrder }.forEach { belt ->
                        Row(
                            modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text("#${belt.sortOrder}", style = MaterialTheme.typography.bodySmall, color = Slate600, modifier = Modifier.width(28.dp))
                                BeltBadge(beltName = belt.name, colorHex = belt.colorHex)
                            }
                            IconButton(onClick = { viewModel.deleteBelt(belt) }, modifier = Modifier.size(28.dp)) {
                                Icon(Icons.Default.DeleteOutline, contentDescription = "Delete", tint = Crimson600, modifier = Modifier.size(18.dp))
                            }
                        }
                    }
                }
            }

            // Training Branches Manager
            Card(
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("Dojo Branches / Training Centers", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = Navy800)
                        IconButton(onClick = { showAddBranchDialog = true }) {
                            Icon(Icons.Default.AddCircle, contentDescription = "Add Branch", tint = Navy800)
                        }
                    }

                    Spacer(modifier = Modifier.height(8.dp))

                    allBranches.forEach { branch ->
                        Row(
                            modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Text(branch.name, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Bold)
                                Text("${branch.address} • ${branch.phone}", style = MaterialTheme.typography.bodySmall, color = Slate600)
                            }
                            IconButton(onClick = { viewModel.deleteBranch(branch) }, modifier = Modifier.size(28.dp)) {
                                Icon(Icons.Default.DeleteOutline, contentDescription = "Delete", tint = Crimson600, modifier = Modifier.size(18.dp))
                            }
                        }
                    }
                }
            }

            // Classes Manager
            Card(
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("Schedules & Class Slots", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = Navy800)
                        IconButton(onClick = { showAddClassDialog = true }) {
                            Icon(Icons.Default.AddCircle, contentDescription = "Add Class", tint = Navy800)
                        }
                    }

                    Spacer(modifier = Modifier.height(8.dp))

                    allClasses.forEach { cls ->
                        Row(
                            modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Text("${cls.name} (${cls.code})", style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Bold)
                                Text("${cls.schedule} • RM %.2f/mo".format(cls.monthlyFee), style = MaterialTheme.typography.bodySmall, color = Slate600)
                            }
                            IconButton(onClick = { viewModel.deleteClass(cls) }, modifier = Modifier.size(28.dp)) {
                                Icon(Icons.Default.DeleteOutline, contentDescription = "Delete", tint = Crimson600, modifier = Modifier.size(18.dp))
                            }
                        }
                    }
                }
            }

            // User Accounts & Registration Approvals
            Card(
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        "Registered User Accounts (${allProfiles.size})",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = Navy800
                    )
                    Text(
                        "Manage logins and review registrations for coaches, parents, and students.",
                        style = MaterialTheme.typography.bodySmall,
                        color = Slate600
                    )

                    Spacer(modifier = Modifier.height(12.dp))

                    allProfiles.forEach { profile ->
                        Surface(
                            shape = RoundedCornerShape(8.dp),
                            color = Slate100.copy(alpha = 0.5f),
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 4.dp)
                        ) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(10.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Text(
                                            text = profile.fullName,
                                            style = MaterialTheme.typography.bodyMedium,
                                            fontWeight = FontWeight.Bold,
                                            color = BrandNavy
                                        )
                                        Spacer(modifier = Modifier.width(6.dp))
                                        Surface(
                                            shape = RoundedCornerShape(6.dp),
                                            color = when (profile.role) {
                                                UserRole.ADMIN -> AccentAmber100
                                                UserRole.COACH -> Sky100
                                                UserRole.PARENT -> Emerald100
                                                UserRole.STUDENT -> Purple100
                                            }
                                        ) {
                                            Text(
                                                text = profile.role.label.split("/")[0].trim(),
                                                style = MaterialTheme.typography.labelSmall,
                                                fontWeight = FontWeight.Bold,
                                                fontSize = 10.sp,
                                                color = when (profile.role) {
                                                    UserRole.ADMIN -> AccentAmber800
                                                    UserRole.COACH -> Sky800
                                                    UserRole.PARENT -> Emerald800
                                                    UserRole.STUDENT -> Purple800
                                                },
                                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                            )
                                        }
                                    }
                                    Text(
                                        text = profile.email,
                                        style = MaterialTheme.typography.bodySmall,
                                        color = Slate500
                                    )
                                }

                                if (profile.role != UserRole.ADMIN) {
                                    when (profile.status) {
                                        ProfileStatus.PENDING -> {
                                            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                                Button(
                                                    onClick = { viewModel.approveProfile(profile.id) },
                                                    colors = ButtonDefaults.buttonColors(containerColor = Emerald600),
                                                    shape = RoundedCornerShape(6.dp),
                                                    contentPadding = PaddingValues(horizontal = 10.dp, vertical = 2.dp),
                                                    modifier = Modifier.height(32.dp)
                                                ) {
                                                    Text("Accept", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                                }
                                                OutlinedButton(
                                                    onClick = { viewModel.rejectProfile(profile.id) },
                                                    colors = ButtonDefaults.outlinedButtonColors(contentColor = Crimson600),
                                                    border = BorderStroke(1.dp, Crimson600.copy(alpha = 0.5f)),
                                                    shape = RoundedCornerShape(6.dp),
                                                    contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp),
                                                    modifier = Modifier.height(32.dp)
                                                ) {
                                                    Text("Decline", fontSize = 11.sp)
                                                }
                                            }
                                        }
                                        ProfileStatus.APPROVED -> {
                                            Surface(
                                                shape = RoundedCornerShape(6.dp),
                                                color = Emerald100
                                            ) {
                                                Text(
                                                    text = "Approved",
                                                    color = Emerald800,
                                                    style = MaterialTheme.typography.labelSmall,
                                                    fontWeight = FontWeight.Bold,
                                                    fontSize = 11.sp,
                                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                                                )
                                            }
                                        }
                                        ProfileStatus.REJECTED -> {
                                            Button(
                                                onClick = { viewModel.approveProfile(profile.id) },
                                                colors = ButtonDefaults.buttonColors(containerColor = AccentAmber700),
                                                shape = RoundedCornerShape(6.dp),
                                                contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp),
                                                modifier = Modifier.height(30.dp)
                                            ) {
                                                Text("Re-approve", fontSize = 11.sp)
                                            }
                                        }
                                    }
                                } else {
                                    Surface(
                                        shape = RoundedCornerShape(6.dp),
                                        color = AccentAmber100
                                    ) {
                                        Text(
                                            text = "Admin",
                                            color = AccentAmber800,
                                            style = MaterialTheme.typography.labelSmall,
                                            fontWeight = FontWeight.Bold,
                                            fontSize = 11.sp,
                                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    if (isSavedToast) {
        AlertDialog(
            onDismissRequest = { isSavedToast = false },
            icon = { Icon(Icons.Default.CheckCircle, contentDescription = null, tint = Emerald600, modifier = Modifier.size(36.dp)) },
            title = { Text("Settings Saved") },
            text = { Text("Academy preferences and pricing defaults have been updated successfully.") },
            confirmButton = {
                Button(onClick = { isSavedToast = false }, colors = ButtonDefaults.buttonColors(containerColor = Navy800)) {
                    Text("OK")
                }
            }
        )
    }

    if (showAddBeltDialog) {
        AddBeltDialog(
            nextOrder = allBelts.size + 1,
            onDismiss = { showAddBeltDialog = false },
            onAdd = { name, hex, order ->
                viewModel.addBelt(name, hex, order)
                showAddBeltDialog = false
            }
        )
    }

    if (showAddBranchDialog) {
        AddBranchDialog(
            onDismiss = { showAddBranchDialog = false },
            onAdd = { name, address, phone ->
                viewModel.addBranch(name, address, phone)
                showAddBranchDialog = false
            }
        )
    }

    if (showAddClassDialog) {
        AddClassDialog(
            branches = allBranches,
            onDismiss = { showAddClassDialog = false },
            onAdd = { cls ->
                viewModel.addClass(cls)
                showAddClassDialog = false
            }
        )
    }
}

@Composable
fun AddBeltDialog(
    nextOrder: Int,
    onDismiss: () -> Unit,
    onAdd: (name: String, colorHex: String, sortOrder: Int) -> Unit
) {
    var name by remember { mutableStateOf("") }
    var colorHex by remember { mutableStateOf("#3B82F6") }
    var sortOrder by remember { mutableStateOf(nextOrder.toString()) }

    Dialog(onDismissRequest = onDismiss) {
        Card(shape = RoundedCornerShape(20.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface), modifier = Modifier.fillMaxWidth().padding(8.dp)) {
            Column(modifier = Modifier.padding(20.dp)) {
                Text("Add Belt Rank", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                Spacer(modifier = Modifier.height(10.dp))
                OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("Belt Name (e.g. Purple Belt)") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedTextField(value = colorHex, onValueChange = { colorHex = it }, label = { Text("Hex Color (e.g. #A855F7)") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedTextField(value = sortOrder, onValueChange = { sortOrder = it }, label = { Text("Order Rank Number") }, singleLine = true, modifier = Modifier.fillMaxWidth())

                Spacer(modifier = Modifier.height(16.dp))
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                    TextButton(onClick = onDismiss) { Text("Cancel") }
                    Spacer(modifier = Modifier.width(8.dp))
                    Button(onClick = { if (name.isNotBlank()) onAdd(name.trim(), colorHex.trim(), sortOrder.toIntOrNull() ?: nextOrder) }) {
                        Text("Add")
                    }
                }
            }
        }
    }
}

@Composable
fun AddBranchDialog(
    onDismiss: () -> Unit,
    onAdd: (name: String, address: String, phone: String) -> Unit
) {
    var name by remember { mutableStateOf("") }
    var address by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("+60 ") }

    Dialog(onDismissRequest = onDismiss) {
        Card(shape = RoundedCornerShape(20.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface), modifier = Modifier.fillMaxWidth().padding(8.dp)) {
            Column(modifier = Modifier.padding(20.dp)) {
                Text("Add Dojo Branch", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                Spacer(modifier = Modifier.height(10.dp))
                OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("Branch Name") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedTextField(value = address, onValueChange = { address = it }, label = { Text("Address") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedTextField(value = phone, onValueChange = { phone = it }, label = { Text("Phone") }, singleLine = true, modifier = Modifier.fillMaxWidth())

                Spacer(modifier = Modifier.height(16.dp))
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                    TextButton(onClick = onDismiss) { Text("Cancel") }
                    Spacer(modifier = Modifier.width(8.dp))
                    Button(onClick = { if (name.isNotBlank()) onAdd(name.trim(), address.trim(), phone.trim()) }) {
                        Text("Add")
                    }
                }
            }
        }
    }
}

@Composable
fun AddClassDialog(
    branches: List<BranchEntity>,
    onDismiss: () -> Unit,
    onAdd: (ClassEntity) -> Unit
) {
    var name by remember { mutableStateOf("") }
    var code by remember { mutableStateOf("") }
    var schedule by remember { mutableStateOf("Saturday 10:00 AM - 11:30 AM") }
    var fee by remember { mutableStateOf("80.00") }
    var selectedBranchId by remember { mutableStateOf(branches.firstOrNull()?.id) }

    Dialog(onDismissRequest = onDismiss) {
        Card(shape = RoundedCornerShape(20.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface), modifier = Modifier.fillMaxWidth().padding(8.dp)) {
            Column(modifier = Modifier.padding(20.dp)) {
                Text("Add Martial Arts Class", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                Spacer(modifier = Modifier.height(10.dp))
                OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("Class Name") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedTextField(value = code, onValueChange = { code = it }, label = { Text("Class Registration Code (e.g. SEP202)") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedTextField(value = schedule, onValueChange = { schedule = it }, label = { Text("Schedule") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedTextField(value = fee, onValueChange = { fee = it }, label = { Text("Monthly Fee (RM)") }, singleLine = true, modifier = Modifier.fillMaxWidth())

                Spacer(modifier = Modifier.height(16.dp))
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                    TextButton(onClick = onDismiss) { Text("Cancel") }
                    Spacer(modifier = Modifier.width(8.dp))
                    Button(
                        onClick = {
                            if (name.isNotBlank()) {
                                onAdd(
                                    ClassEntity(
                                        id = "class-${System.currentTimeMillis()}",
                                        branchId = selectedBranchId,
                                        name = name.trim(),
                                        code = code.trim(),
                                        scheduleNote = schedule.trim(),
                                        monthlyFeeOverride = fee.toDoubleOrNull() ?: 80.0
                                    )
                                )
                            }
                        }
                    ) {
                        Text("Add Class")
                    }
                }
            }
        }
    }
}
