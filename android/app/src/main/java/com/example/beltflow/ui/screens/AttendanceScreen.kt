package com.example.beltflow.ui.screens

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.example.beltflow.data.model.AttendanceStatus
import com.example.beltflow.data.model.StudentWithDetails
import com.example.beltflow.ui.components.*
import com.example.beltflow.ui.theme.*
import com.example.beltflow.ui.viewmodels.BeltFlowViewModel
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AttendanceScreen(
    viewModel: BeltFlowViewModel,
    onBack: () -> Unit
) {
    val currentUser by viewModel.currentUser.collectAsState()
    val allClasses by viewModel.allClasses.collectAsState()
    val allStudents by viewModel.allStudents.collectAsState()

    val todayDate = remember { SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date()) }
    var sessionDate by remember { mutableStateOf(todayDate) }
    var selectedClassId by remember { mutableStateOf<String?>(allClasses.firstOrNull()?.id) }

    // Map of studentId -> AttendanceStatus
    var attendanceState by remember { mutableStateOf<Map<String, AttendanceStatus>>(emptyMap()) }
    var isSavedSnackbar by remember { mutableStateOf(false) }

    val context = LocalContext.current

    // Update selected class when classes load if currently null
    LaunchedEffect(allClasses) {
        if (selectedClassId == null && allClasses.isNotEmpty()) {
            selectedClassId = allClasses.first().id
        }
    }

    // Filter students enrolled in the selected class
    val enrolledStudents = remember(selectedClassId, allStudents) {
        if (selectedClassId == null) allStudents
        else allStudents.filter { it.classIds.contains(selectedClassId) }
    }

    // Load existing session attendance if any, or default to PRESENT
    LaunchedEffect(selectedClassId, sessionDate, enrolledStudents) {
        val classId = selectedClassId
        if (classId != null && enrolledStudents.isNotEmpty()) {
            val existing = viewModel.getSessionAttendance(classId, sessionDate)
            val map = mutableMapOf<String, AttendanceStatus>()
            val existingMap = existing.associateBy { it.studentId }
            enrolledStudents.forEach { s ->
                map[s.id] = existingMap[s.id]?.status ?: AttendanceStatus.PRESENT
            }
            attendanceState = map
        }
    }

    Scaffold(
        topBar = {
            TopNavBar(
                title = "Class Attendance Roster",
                currentUser = currentUser,
                onSwitchUser = { viewModel.loginAs(it) {} },
                onLogout = { viewModel.logout() },
                onBack = onBack
            )
        },
        containerColor = MaterialTheme.colorScheme.background,
        bottomBar = {
            Surface(
                color = MaterialTheme.colorScheme.surface,
                shadowElevation = 8.dp,
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier
                        .padding(16.dp)
                        .fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    val presentCount = attendanceState.values.count { it == AttendanceStatus.PRESENT || it == AttendanceStatus.LATE }
                    Text(
                        text = "$presentCount / ${enrolledStudents.size} Present",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = Navy800
                    )

                    Button(
                        onClick = {
                            selectedClassId?.let { classId ->
                                viewModel.markAttendance(classId, sessionDate, attendanceState) {
                                    isSavedSnackbar = true
                                }
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = Navy800),
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier.testTag("save_attendance_button")
                    ) {
                        Icon(Icons.Default.Check, contentDescription = null)
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("Save Attendance")
                    }
                }
            }
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            // Controls Card
            Card(
                shape = RoundedCornerShape(0.dp, 0.dp, 16.dp, 16.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    // Class Selector
                    var expandedClassDropdown by remember { mutableStateOf(false) }
                    val currentClassName = allClasses.find { it.id == selectedClassId }?.name ?: "Select Class"

                    ExposedDropdownMenuBox(
                        expanded = expandedClassDropdown,
                        onExpandedChange = { expandedClassDropdown = !expandedClassDropdown },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        OutlinedTextField(
                            value = currentClassName,
                            onValueChange = {},
                            readOnly = true,
                            label = { Text("Active Martial Arts Class") },
                            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expandedClassDropdown) },
                            modifier = Modifier.fillMaxWidth().menuAnchor()
                        )
                        ExposedDropdownMenu(
                            expanded = expandedClassDropdown,
                            onDismissRequest = { expandedClassDropdown = false }
                        ) {
                            allClasses.forEach { cls ->
                                DropdownMenuItem(
                                    text = { Text(cls.name) },
                                    onClick = {
                                        selectedClassId = cls.id
                                        expandedClassDropdown = false
                                    }
                                )
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(10.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        OutlinedTextField(
                            value = sessionDate,
                            onValueChange = { sessionDate = it },
                            label = { Text("Session Date") },
                            leadingIcon = { Icon(Icons.Default.CalendarMonth, contentDescription = null) },
                            singleLine = true,
                            modifier = Modifier.weight(1f)
                        )

                        FilledTonalButton(
                            onClick = {
                                val allPresentMap = enrolledStudents.associate { it.id to AttendanceStatus.PRESENT }
                                attendanceState = allPresentMap
                            },
                            colors = ButtonDefaults.filledTonalButtonColors(containerColor = Emerald100, contentColor = Emerald600),
                            modifier = Modifier.padding(top = 6.dp).testTag("mark_all_present_button")
                        ) {
                            Icon(Icons.Default.DoneAll, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("All Present", style = MaterialTheme.typography.labelSmall)
                        }
                    }
                }
            }

            // At-Risk Banner within this class
            val atRiskInClass = enrolledStudents.filter { it.isAtRisk }
            if (atRiskInClass.isNotEmpty()) {
                Surface(
                    color = Crimson100,
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp)
                ) {
                    Row(
                        modifier = Modifier.padding(10.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(Icons.Default.WarningAmber, contentDescription = null, tint = Crimson600)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "${atRiskInClass.size} student(s) in this class have 3+ consecutive absences.",
                            style = MaterialTheme.typography.bodySmall,
                            fontWeight = FontWeight.SemiBold,
                            color = Crimson600
                        )
                    }
                }
            }

            if (enrolledStudents.isEmpty()) {
                Box(
                    modifier = Modifier.fillMaxSize().padding(32.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text("No students enrolled in this class yet.", style = MaterialTheme.typography.bodyMedium, color = Slate600)
                }
            } else {
                LazyColumn(
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                    modifier = Modifier.fillMaxSize()
                ) {
                    items(enrolledStudents, key = { it.id }) { student ->
                        val currentStatus = attendanceState[student.id] ?: AttendanceStatus.PRESENT
                        AttendanceStudentRow(
                            student = student,
                            status = currentStatus,
                            onStatusChange = { newStatus ->
                                attendanceState = attendanceState + (student.id to newStatus)
                            },
                            onWhatsAppClick = {
                                val phoneClean = student.parentPhone.replace("[^0-9]".toRegex(), "")
                                val msg = Uri.encode("Hello ${student.parentName}, reminder regarding ${student.fullName}'s martial arts class today at BeltFlow.")
                                val intent = Intent(Intent.ACTION_VIEW, Uri.parse("https://wa.me/$phoneClean?text=$msg"))
                                try { context.startActivity(intent) } catch (e: Exception) {}
                            }
                        )
                    }
                }
            }
        }
    }

    if (isSavedSnackbar) {
        AlertDialog(
            onDismissRequest = { isSavedSnackbar = false },
            icon = { Icon(Icons.Default.CheckCircle, contentDescription = null, tint = Emerald600, modifier = Modifier.size(40.dp)) },
            title = { Text("Attendance Recorded") },
            text = { Text("Session attendance for $sessionDate has been saved successfully.") },
            confirmButton = {
                Button(onClick = { isSavedSnackbar = false }, colors = ButtonDefaults.buttonColors(containerColor = Navy800)) {
                    Text("OK")
                }
            }
        )
    }
}

@Composable
fun AttendanceStudentRow(
    student: StudentWithDetails,
    status: AttendanceStatus,
    onStatusChange: (AttendanceStatus) -> Unit,
    onWhatsAppClick: () -> Unit
) {
    Card(
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
        modifier = Modifier.fillMaxWidth().testTag("attendance_row_${student.id}")
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Surface(
                        color = Navy800,
                        shape = CircleShape,
                        modifier = Modifier.size(36.dp)
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Text(
                                text = student.fullName.take(2).uppercase(),
                                color = Gold500,
                                fontWeight = FontWeight.Bold,
                                style = MaterialTheme.typography.labelSmall
                            )
                        }
                    }
                    Spacer(modifier = Modifier.width(10.dp))
                    Column {
                        Text(student.fullName, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            BeltBadge(beltName = student.beltName, colorHex = student.beltColorHex)
                            if (student.isAtRisk) {
                                Spacer(modifier = Modifier.width(6.dp))
                                Text("⚠️ At-Risk", style = MaterialTheme.typography.labelSmall, color = Crimson600, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }

                IconButton(onClick = onWhatsAppClick, modifier = Modifier.size(32.dp)) {
                    Icon(Icons.Default.Send, contentDescription = "WhatsApp", tint = Emerald600, modifier = Modifier.size(18.dp))
                }
            }

            Spacer(modifier = Modifier.height(10.dp))

            // 4 Status toggle buttons
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                listOf(
                    AttendanceStatus.PRESENT to Emerald600,
                    AttendanceStatus.LATE to Gold600,
                    AttendanceStatus.ABSENT to Crimson600,
                    AttendanceStatus.EXCUSED to Sky600
                ).forEach { (st, color) ->
                    val isSelected = status == st
                    OutlinedButton(
                        onClick = { onStatusChange(st) },
                        shape = RoundedCornerShape(8.dp),
                        colors = if (isSelected) {
                            ButtonDefaults.outlinedButtonColors(containerColor = color.copy(alpha = 0.15f), contentColor = color)
                        } else {
                            ButtonDefaults.outlinedButtonColors(containerColor = Color.Transparent, contentColor = Slate600)
                        },
                        border = if (isSelected) androidx.compose.foundation.BorderStroke(1.5.dp, color) else androidx.compose.foundation.BorderStroke(1.dp, Slate200),
                        contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp),
                        modifier = Modifier.weight(1f).testTag("att_btn_${student.id}_${st.name}")
                    ) {
                        Text(
                            text = st.label,
                            style = MaterialTheme.typography.labelSmall,
                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal
                        )
                    }
                }
            }
        }
    }
}
