package com.example.beltflow.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
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
import androidx.compose.ui.window.Dialog
import com.example.beltflow.data.model.Lifecycle
import com.example.beltflow.data.model.StudentWithDetails
import com.example.beltflow.ui.components.*
import com.example.beltflow.ui.theme.*
import com.example.beltflow.ui.viewmodels.BeltFlowViewModel

@Composable
fun StudentsListScreen(
    viewModel: BeltFlowViewModel,
    onStudentClick: (String) -> Unit,
    onBack: () -> Unit
) {
    val currentUser by viewModel.currentUser.collectAsState()
    val allStudents by viewModel.allStudents.collectAsState()
    val allBelts by viewModel.allBelts.collectAsState()
    val allClasses by viewModel.allClasses.collectAsState()

    var searchQuery by remember { mutableStateOf("") }
    var selectedBeltId by remember { mutableStateOf<String?>(null) }
    var selectedLifecycle by remember { mutableStateOf<Lifecycle?>(null) }
    var showAddStudentDialog by remember { mutableStateOf(false) }

    val filteredStudents = allStudents.filter { s ->
        val matchesSearch = searchQuery.isBlank() ||
                s.fullName.contains(searchQuery, ignoreCase = true) ||
                s.icOrMykid.contains(searchQuery, ignoreCase = true) ||
                s.parentName.contains(searchQuery, ignoreCase = true)

        val matchesBelt = selectedBeltId == null || s.beltId == selectedBeltId
        val matchesLifecycle = selectedLifecycle == null || s.lifecycle == selectedLifecycle

        matchesSearch && matchesBelt && matchesLifecycle
    }

    Scaffold(
        topBar = {
            TopNavBar(
                title = "Students Directory",
                currentUser = currentUser,
                onSwitchUser = { viewModel.loginAs(it) {} },
                onLogout = { viewModel.logout() },
                onBack = onBack
            )
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = { showAddStudentDialog = true },
                containerColor = Navy800,
                contentColor = Gold500,
                modifier = Modifier.testTag("add_student_fab")
            ) {
                Icon(Icons.Default.PersonAdd, contentDescription = "Add Student")
            }
        },
        containerColor = MaterialTheme.colorScheme.background
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            // Search & Filter Header
            Card(
                shape = RoundedCornerShape(0.dp, 0.dp, 16.dp, 16.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    OutlinedTextField(
                        value = searchQuery,
                        onValueChange = { searchQuery = it },
                        placeholder = { Text("Search by student name, IC, or parent...") },
                        leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                        trailingIcon = {
                            if (searchQuery.isNotBlank()) {
                                IconButton(onClick = { searchQuery = "" }) {
                                    Icon(Icons.Default.Clear, contentDescription = "Clear")
                                }
                            }
                        },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth().testTag("student_search_input")
                    )

                    Spacer(modifier = Modifier.height(10.dp))

                    // Belt Filter Chips
                    Text("Filter by Belt Rank:", style = MaterialTheme.typography.labelSmall, color = Slate600)
                    Spacer(modifier = Modifier.height(4.dp))
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        item {
                            FilterChip(
                                selected = selectedBeltId == null,
                                onClick = { selectedBeltId = null },
                                label = { Text("All Belts") }
                            )
                        }
                        items(allBelts) { belt ->
                            FilterChip(
                                selected = selectedBeltId == belt.id,
                                onClick = { selectedBeltId = belt.id },
                                label = { Text(belt.name, style = MaterialTheme.typography.labelSmall) },
                                leadingIcon = {
                                    Surface(
                                        color = parseHexColor(belt.colorHex),
                                        shape = CircleShape,
                                        modifier = Modifier.size(8.dp)
                                    ) {}
                                }
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(8.dp))

                    // Lifecycle Status Filter Chips
                    Text("Filter by Enrollment Status:", style = MaterialTheme.typography.labelSmall, color = Slate600)
                    Spacer(modifier = Modifier.height(4.dp))
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        item {
                            FilterChip(
                                selected = selectedLifecycle == null,
                                onClick = { selectedLifecycle = null },
                                label = { Text("All Statuses (${allStudents.size})") }
                            )
                        }
                        items(Lifecycle.entries) { status ->
                            FilterChip(
                                selected = selectedLifecycle == status,
                                onClick = { selectedLifecycle = status },
                                label = { Text(status.label, style = MaterialTheme.typography.labelSmall) }
                            )
                        }
                    }
                }
            }

            // Student Count Summary
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Showing ${filteredStudents.size} Students",
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = FontWeight.Bold,
                    color = Slate600
                )
            }

            if (filteredStudents.isEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(32.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "No students found matching current filters.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = Slate600
                    )
                }
            } else {
                LazyColumn(
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                    modifier = Modifier.fillMaxSize()
                ) {
                    items(filteredStudents, key = { it.id }) { student ->
                        StudentCardItem(
                            student = student,
                            onClick = { onStudentClick(student.id) }
                        )
                    }
                }
            }
        }
    }

    if (showAddStudentDialog) {
        AddEditStudentDialog(
            student = null,
            belts = allBelts,
            classes = allClasses,
            onDismiss = { showAddStudentDialog = false },
            onSave = { name, ic, dob, gender, beltId, lifecycle, parentName, parentPhone, medNotes, classIds ->
                viewModel.registerStudent(
                    fullName = name,
                    icOrMykid = ic,
                    dateOfBirth = dob,
                    gender = gender,
                    beltId = beltId,
                    lifecycle = lifecycle,
                    parentName = parentName,
                    parentPhone = parentPhone,
                    medicalNotes = medNotes,
                    classIds = classIds
                ) {
                    showAddStudentDialog = false
                }
            }
        )
    }
}

@Composable
fun StudentCardItem(
    student: StudentWithDetails,
    onClick: () -> Unit
) {
    Card(
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onClick() }
            .testTag("student_card_${student.id}")
    ) {
        Row(
            modifier = Modifier
                .padding(14.dp)
                .fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Surface(
                color = Navy800,
                shape = CircleShape,
                modifier = Modifier.size(46.dp)
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Text(
                        text = student.fullName.take(2).uppercase(),
                        color = Gold500,
                        fontWeight = FontWeight.Bold,
                        style = MaterialTheme.typography.titleMedium
                    )
                }
            }

            Spacer(modifier = Modifier.width(12.dp))

            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = student.fullName,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                    if (student.isAtRisk) {
                        Spacer(modifier = Modifier.width(6.dp))
                        Surface(
                            color = Crimson100,
                            shape = RoundedCornerShape(4.dp)
                        ) {
                            Text(
                                text = "At-Risk",
                                color = Crimson600,
                                style = MaterialTheme.typography.labelSmall,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp)
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(2.dp))

                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    BeltBadge(beltName = student.beltName, colorHex = student.beltColorHex)
                    Text("•", color = Slate400, style = MaterialTheme.typography.bodySmall)
                    Text("Age ${student.age}", style = MaterialTheme.typography.bodySmall, color = Slate600)
                    Text("•", color = Slate400, style = MaterialTheme.typography.bodySmall)
                    Text("${student.attendanceRate}% Att.", style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.SemiBold, color = if (student.isAtRisk) Crimson600 else Emerald600)
                }

                if (student.parentPhone.isNotBlank()) {
                    Spacer(modifier = Modifier.height(2.dp))
                    Text(
                        text = "Guardian: ${student.parentName} (${student.parentPhone})",
                        style = MaterialTheme.typography.bodySmall,
                        color = Slate500
                    )
                }
            }

            Icon(
                Icons.Default.ChevronRight,
                contentDescription = "Details",
                tint = Slate400
            )
        }
    }
}

@Composable
fun AddEditStudentDialog(
    student: StudentWithDetails?,
    belts: List<com.example.beltflow.data.local.BeltEntity>,
    classes: List<com.example.beltflow.data.local.ClassEntity>,
    onDismiss: () -> Unit,
    onSave: (
        fullName: String,
        ic: String,
        dob: String,
        gender: String,
        beltId: String?,
        lifecycle: Lifecycle,
        parentName: String,
        parentPhone: String,
        medicalNotes: String,
        classIds: List<String>
    ) -> Unit
) {
    var fullName by remember { mutableStateOf(student?.fullName ?: "") }
    var ic by remember { mutableStateOf(student?.icOrMykid ?: "") }
    var dob by remember { mutableStateOf(student?.dateOfBirth ?: "2014-05-10") }
    var gender by remember { mutableStateOf(student?.gender ?: "Male") }
    var selectedBeltId by remember { mutableStateOf<String?>(student?.beltId ?: belts.firstOrNull()?.id) }
    var lifecycle by remember { mutableStateOf(student?.lifecycle ?: Lifecycle.ACTIVE) }
    var parentName by remember { mutableStateOf(student?.parentName ?: "") }
    var parentPhone by remember { mutableStateOf(student?.parentPhone ?: "+60 ") }
    var medicalNotes by remember { mutableStateOf(student?.medicalNotes ?: "") }
    var selectedClassIds by remember { mutableStateOf(student?.classIds ?: listOfNotNull(classes.firstOrNull()?.id)) }

    var error by remember { mutableStateOf("") }

    Dialog(onDismissRequest = onDismiss) {
        Card(
            shape = RoundedCornerShape(20.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
            elevation = CardDefaults.cardElevation(defaultElevation = 8.dp),
            modifier = Modifier
                .fillMaxWidth()
                .padding(8.dp)
                .testTag("add_edit_student_dialog")
        ) {
            Column(
                modifier = Modifier
                    .padding(20.dp)
                    .verticalScroll(rememberScrollState())
            ) {
                Text(
                    text = if (student == null) "Register New Student" else "Edit Student Profile",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                    color = Navy800
                )

                Spacer(modifier = Modifier.height(12.dp))

                if (error.isNotBlank()) {
                    Text(error, color = Crimson600, style = MaterialTheme.typography.bodySmall)
                    Spacer(modifier = Modifier.height(6.dp))
                }

                OutlinedTextField(
                    value = fullName,
                    onValueChange = { fullName = it },
                    label = { Text("Student Full Name *") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth().testTag("student_form_name")
                )

                Spacer(modifier = Modifier.height(8.dp))

                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = ic,
                        onValueChange = { ic = it },
                        label = { Text("IC / MyKid No.") },
                        placeholder = { Text("e.g. 140510-10-1234") },
                        singleLine = true,
                        modifier = Modifier.weight(1f)
                    )
                    OutlinedTextField(
                        value = dob,
                        onValueChange = { dob = it },
                        label = { Text("DOB (YYYY-MM-DD)") },
                        singleLine = true,
                        modifier = Modifier.weight(1f)
                    )
                }

                Spacer(modifier = Modifier.height(8.dp))

                Text("Gender", style = MaterialTheme.typography.bodySmall, color = Slate600)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf("Male", "Female").forEach { g ->
                        FilterChip(
                            selected = gender == g,
                            onClick = { gender = g },
                            label = { Text(g) }
                        )
                    }
                }

                Spacer(modifier = Modifier.height(8.dp))

                Text("Current Belt Rank", style = MaterialTheme.typography.bodySmall, color = Slate600)
                LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    items(belts) { b ->
                        FilterChip(
                            selected = selectedBeltId == b.id,
                            onClick = { selectedBeltId = b.id },
                            label = { Text(b.name, style = MaterialTheme.typography.labelSmall) }
                        )
                    }
                }

                Spacer(modifier = Modifier.height(8.dp))

                OutlinedTextField(
                    value = parentName,
                    onValueChange = { parentName = it },
                    label = { Text("Parent / Guardian Name *") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                Spacer(modifier = Modifier.height(8.dp))

                OutlinedTextField(
                    value = parentPhone,
                    onValueChange = { parentPhone = it },
                    label = { Text("Parent Phone (WhatsApp)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                Spacer(modifier = Modifier.height(8.dp))

                Text("Assign Classes", style = MaterialTheme.typography.bodySmall, color = Slate600)
                classes.forEach { cls ->
                    val isChecked = selectedClassIds.contains(cls.id)
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable {
                                selectedClassIds = if (isChecked) {
                                    selectedClassIds.filter { it != cls.id }
                                } else {
                                    selectedClassIds + cls.id
                                }
                            }
                    ) {
                        Checkbox(
                            checked = isChecked,
                            onCheckedChange = { checked ->
                                selectedClassIds = if (checked) selectedClassIds + cls.id else selectedClassIds.filter { it != cls.id }
                            }
                        )
                        Text(cls.name, style = MaterialTheme.typography.bodyMedium)
                    }
                }

                Spacer(modifier = Modifier.height(8.dp))

                OutlinedTextField(
                    value = medicalNotes,
                    onValueChange = { medicalNotes = it },
                    label = { Text("Medical / Injury Notes") },
                    placeholder = { Text("e.g. Asthma, allergies, past injuries...") },
                    modifier = Modifier.fillMaxWidth()
                )

                Spacer(modifier = Modifier.height(16.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End
                ) {
                    TextButton(onClick = onDismiss) {
                        Text("Cancel")
                    }
                    Spacer(modifier = Modifier.width(8.dp))
                    Button(
                        onClick = {
                            if (fullName.isBlank() || parentName.isBlank()) {
                                error = "Student name and Parent name are required."
                            } else {
                                onSave(
                                    fullName.trim(),
                                    ic.trim(),
                                    dob.trim(),
                                    gender,
                                    selectedBeltId,
                                    lifecycle,
                                    parentName.trim(),
                                    parentPhone.trim(),
                                    medicalNotes.trim(),
                                    selectedClassIds
                                )
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = Navy800),
                        modifier = Modifier.testTag("save_student_button")
                    ) {
                        Text("Save Student")
                    }
                }
            }
        }
    }
}
