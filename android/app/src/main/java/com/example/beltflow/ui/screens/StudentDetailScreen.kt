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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import com.example.beltflow.data.local.AttendanceEntity
import com.example.beltflow.data.local.InstructorNoteEntity
import com.example.beltflow.data.model.*
import com.example.beltflow.ui.components.*
import com.example.beltflow.ui.theme.*
import com.example.beltflow.ui.viewmodels.BeltFlowViewModel

@Composable
fun StudentDetailScreen(
    studentId: String,
    viewModel: BeltFlowViewModel,
    onBack: () -> Unit
) {
    val currentUser by viewModel.currentUser.collectAsState()
    val studentFlow = remember(studentId) { viewModel.getStudentDetails(studentId) }
    val student by studentFlow.collectAsState(initial = null)

    val attendanceList by viewModel.getStudentAttendance(studentId).collectAsState(initial = emptyList())
    val skillsProgress by viewModel.getStudentSkills(studentId).collectAsState(initial = emptyList())
    val certificates by viewModel.getStudentCertificates(studentId).collectAsState(initial = emptyList())
    val notes by viewModel.getStudentNotes(studentId).collectAsState(initial = emptyList())
    val allInvoices by viewModel.allInvoices.collectAsState()
    val studentInvoices = allInvoices.filter { it.studentId == studentId }

    val allBelts by viewModel.allBelts.collectAsState()
    val allClasses by viewModel.allClasses.collectAsState()

    var selectedTab by remember { mutableStateOf(0) }
    val tabTitles = listOf("Overview", "Attendance", "Syllabus Skills", "Invoices", "Certificates", "Notes")

    var showEditDialog by remember { mutableStateOf(false) }
    var showAddNoteDialog by remember { mutableStateOf(false) }
    var selectedCertForView by remember { mutableStateOf<CertificateDetail?>(null) }

    val context = LocalContext.current

    val s = student
    if (s == null) {
        Scaffold(
            topBar = {
                TopNavBar(
                    title = "Student Details",
                    currentUser = currentUser,
                    onSwitchUser = {},
                    onLogout = {},
                    onBack = onBack
                )
            }
        ) { padding ->
            Box(modifier = Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = Navy800)
            }
        }
        return
    }

    Scaffold(
        topBar = {
            TopNavBar(
                title = s.fullName,
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
        ) {
            // Header Profile Card
            Card(
                shape = RoundedCornerShape(0.dp, 0.dp, 20.dp, 20.dp),
                colors = CardDefaults.cardColors(containerColor = Navy800),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Surface(
                                shape = CircleShape,
                                color = Navy700,
                                modifier = Modifier.size(52.dp)
                            ) {
                                Box(contentAlignment = Alignment.Center) {
                                    Text(
                                        text = s.fullName.take(2).uppercase(),
                                        style = MaterialTheme.typography.titleLarge,
                                        fontWeight = FontWeight.Bold,
                                        color = Gold500
                                    )
                                }
                            }
                            Spacer(modifier = Modifier.width(12.dp))
                            Column {
                                Text(
                                    text = s.fullName,
                                    style = MaterialTheme.typography.titleLarge,
                                    fontWeight = FontWeight.Bold,
                                    color = Color.White
                                )
                                Text(
                                    text = "Joined: ${s.joinedAt} • ${if (s.age > 0) "${s.age} yrs old" else "Age N/A"}",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = Slate200
                                )
                            }
                        }

                        BeltBadge(beltName = s.beltName, colorHex = s.beltColorHex)
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.Phone, contentDescription = null, tint = Gold500, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = "${s.parentName} (${s.parentPhone})",
                                style = MaterialTheme.typography.bodySmall,
                                color = Slate200
                            )
                        }

                        Row {
                            IconButton(
                                onClick = {
                                    val phoneClean = s.parentPhone.replace("[^0-9]".toRegex(), "")
                                    val intent = Intent(Intent.ACTION_VIEW, Uri.parse("https://wa.me/$phoneClean"))
                                    try { context.startActivity(intent) } catch (e: Exception) {}
                                },
                                modifier = Modifier.size(36.dp).testTag("whatsapp_parent_button")
                            ) {
                                Icon(Icons.Default.Send, contentDescription = "WhatsApp", tint = Emerald600)
                            }

                            if (currentUser?.role == UserRole.ADMIN || currentUser?.role == UserRole.COACH) {
                                IconButton(
                                    onClick = { showEditDialog = true },
                                    modifier = Modifier.size(36.dp).testTag("edit_student_button")
                                ) {
                                    Icon(Icons.Default.Edit, contentDescription = "Edit", tint = Gold500)
                                }
                            }
                        }
                    }
                }
            }

            // Scrollable Tab Row
            ScrollableTabRow(
                selectedTabIndex = selectedTab,
                containerColor = MaterialTheme.colorScheme.surface,
                contentColor = Navy800,
                edgePadding = 16.dp
            ) {
                tabTitles.forEachIndexed { index, title ->
                    Tab(
                        selected = selectedTab == index,
                        onClick = { selectedTab = index },
                        text = {
                            Text(
                                text = title,
                                fontWeight = if (selectedTab == index) FontWeight.Bold else FontWeight.Normal
                            )
                        }
                    )
                }
            }

            // Tab Content
            when (selectedTab) {
                0 -> StudentBioTab(student = s)
                1 -> StudentAttendanceTab(attendanceList = attendanceList)
                2 -> StudentSkillsTab(
                    skills = skillsProgress,
                    canEdit = currentUser?.role == UserRole.ADMIN || currentUser?.role == UserRole.COACH,
                    onUpdateLevel = { skillId, level ->
                        viewModel.updateStudentSkill(s.id, skillId, level)
                    }
                )
                3 -> StudentInvoicesTab(invoices = studentInvoices)
                4 -> StudentCertificatesTab(
                    certificates = certificates,
                    onViewCert = { selectedCertForView = it }
                )
                5 -> StudentNotesTab(
                    notes = notes,
                    canAdd = currentUser?.role == UserRole.ADMIN || currentUser?.role == UserRole.COACH,
                    onAddNoteClick = { showAddNoteDialog = true }
                )
            }
        }
    }

    if (showEditDialog) {
        AddEditStudentDialog(
            student = s,
            belts = allBelts,
            classes = allClasses,
            onDismiss = { showEditDialog = false },
            onSave = { name, ic, dob, gender, beltId, lc, parentName, parentPhone, medNotes, classIds ->
                viewModel.updateStudent(
                    s.id, name, ic, dob, gender, beltId, lc, parentName, parentPhone, medNotes, classIds
                ) {
                    showEditDialog = false
                }
            }
        )
    }

    if (showAddNoteDialog) {
        AddNoteDialog(
            onDismiss = { showAddNoteDialog = false },
            onAdd = { body, visibility ->
                viewModel.addInstructorNote(s.id, body, visibility) {
                    showAddNoteDialog = false
                }
            }
        )
    }

    selectedCertForView?.let { cert ->
        CertificateDialog(certificate = cert, onDismiss = { selectedCertForView = null })
    }
}

@Composable
private fun StudentBioTab(student: StudentWithDetails) {
    LazyColumn(
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Card(
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text("Bio & Registration", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    Spacer(modifier = Modifier.height(10.dp))
                    DetailRow(label = "IC / MyKid No.", value = student.icOrMykid.ifBlank { "Not Recorded" })
                    DetailRow(label = "Date of Birth", value = student.dateOfBirth.ifBlank { "—" })
                    DetailRow(label = "Gender", value = student.gender)
                    DetailRow(label = "Membership Status", value = student.lifecycle.label)
                    DetailRow(label = "Assigned Classes", value = student.classNames.joinToString(", ").ifBlank { "None" })
                }
            }
        }

        item {
            Card(
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text("Medical & Special Notes", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = student.medicalNotes.ifBlank { "No medical conditions or allergies recorded." },
                        style = MaterialTheme.typography.bodyMedium,
                        color = Slate700
                    )
                }
            }
        }
    }
}

@Composable
private fun StudentAttendanceTab(attendanceList: List<AttendanceEntity>) {
    if (attendanceList.isEmpty()) {
        Box(modifier = Modifier.fillMaxSize().padding(32.dp), contentAlignment = Alignment.Center) {
            Text("No recorded attendance sessions yet.", style = MaterialTheme.typography.bodyMedium, color = Slate600)
        }
        return
    }

    val total = attendanceList.size
    val present = attendanceList.count { it.status == AttendanceStatus.PRESENT || it.status == AttendanceStatus.LATE }
    val pct = if (total > 0) (present * 100) / total else 100

    LazyColumn(
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        item {
            Card(
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
            ) {
                Row(
                    modifier = Modifier.padding(16.dp).fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Column {
                        Text("Overall Attendance Rate", style = MaterialTheme.typography.bodyMedium, color = Slate600)
                        Text("$pct%", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold, color = if (pct >= 80) Emerald600 else Crimson600)
                    }
                    Text("$present / $total Sessions Present", style = MaterialTheme.typography.bodySmall, color = Slate700)
                }
            }
        }

        items(attendanceList) { att ->
            Card(
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
            ) {
                Row(
                    modifier = Modifier.padding(14.dp).fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Column {
                        Text("Session Date: ${att.sessionDate}", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                    }

                    val (bgColor, txtColor) = when (att.status) {
                        AttendanceStatus.PRESENT -> Emerald100 to Emerald600
                        AttendanceStatus.ABSENT -> Crimson100 to Crimson600
                        AttendanceStatus.LATE -> Gold100 to Gold600
                        AttendanceStatus.EXCUSED -> Sky100 to Sky600
                    }
                    StatusBadge(statusText = att.status.label, backgroundColor = bgColor, textColor = txtColor)
                }
            }
        }
    }
}

@Composable
private fun StudentSkillsTab(
    skills: List<StudentSkillProgress>,
    canEdit: Boolean,
    onUpdateLevel: (String, SkillLevel) -> Unit
) {
    if (skills.isEmpty()) {
        Box(modifier = Modifier.fillMaxSize().padding(32.dp), contentAlignment = Alignment.Center) {
            Text("No curriculum skills registered.", style = MaterialTheme.typography.bodyMedium, color = Slate600)
        }
        return
    }

    LazyColumn(
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        items(skills) { skill ->
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
                        Column(modifier = Modifier.weight(1f)) {
                            Text(skill.skillName, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                            Text("Category: ${skill.category}", style = MaterialTheme.typography.bodySmall, color = Slate600)
                        }
                    }

                    Spacer(modifier = Modifier.height(10.dp))
                    SkillProgressBar(level = skill.level)

                    if (canEdit) {
                        Spacer(modifier = Modifier.height(12.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            SkillLevel.entries.forEach { lvl ->
                                FilterChip(
                                    selected = skill.level == lvl,
                                    onClick = { onUpdateLevel(skill.skillId, lvl) },
                                    label = { Text(lvl.label.split(" ")[0], style = MaterialTheme.typography.labelSmall) },
                                    modifier = Modifier.testTag("skill_${skill.skillId}_${lvl.name}")
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
private fun StudentInvoicesTab(invoices: List<InvoiceWithStudent>) {
    if (invoices.isEmpty()) {
        Box(modifier = Modifier.fillMaxSize().padding(32.dp), contentAlignment = Alignment.Center) {
            Text("No invoices on record for this student.", style = MaterialTheme.typography.bodyMedium, color = Slate600)
        }
        return
    }

    LazyColumn(
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        items(invoices) { inv ->
            Card(
                shape = RoundedCornerShape(14.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
            ) {
                Column(modifier = Modifier.padding(14.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("Billing: ${inv.billingMonth}", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                        val (bg, txt) = when (inv.status) {
                            InvoiceStatus.PAID -> Emerald100 to Emerald600
                            InvoiceStatus.UNPAID -> Crimson100 to Crimson600
                            InvoiceStatus.PENDING_APPROVAL -> Gold100 to Gold600
                            InvoiceStatus.OVERDUE -> Crimson100 to Crimson600
                            InvoiceStatus.WAIVED -> Slate200 to Slate700
                        }
                        StatusBadge(statusText = inv.status.label, backgroundColor = bg, textColor = txt)
                    }

                    Spacer(modifier = Modifier.height(6.dp))
                    Text(
                        text = "Net Amount: RM %.2f ${if (inv.discount > 0) "(${inv.discountReason})" else ""}".format(inv.netAmount),
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.Bold,
                        color = Navy900
                    )
                }
            }
        }
    }
}

@Composable
private fun StudentCertificatesTab(
    certificates: List<CertificateDetail>,
    onViewCert: (CertificateDetail) -> Unit
) {
    if (certificates.isEmpty()) {
        Box(modifier = Modifier.fillMaxSize().padding(32.dp), contentAlignment = Alignment.Center) {
            Text("No certificates issued yet.", style = MaterialTheme.typography.bodyMedium, color = Slate600)
        }
        return
    }

    LazyColumn(
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        items(certificates) { cert ->
            Card(
                shape = RoundedCornerShape(14.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                modifier = Modifier.clickable { onViewCert(cert) }
            ) {
                Row(
                    modifier = Modifier.padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Surface(
                        color = Gold100,
                        shape = CircleShape,
                        modifier = Modifier.size(44.dp)
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Icon(Icons.Default.WorkspacePremium, contentDescription = null, tint = Gold600)
                        }
                    }
                    Spacer(modifier = Modifier.width(12.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text(cert.title, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                        Text("Cert No: ${cert.certNo} • Date: ${cert.issuedAt}", style = MaterialTheme.typography.bodySmall, color = Slate600)
                    }
                    Icon(Icons.Default.Visibility, contentDescription = "View", tint = Navy800)
                }
            }
        }
    }
}

@Composable
private fun StudentNotesTab(
    notes: List<InstructorNoteEntity>,
    canAdd: Boolean,
    onAddNoteClick: () -> Unit
) {
    Column(modifier = Modifier.fillMaxSize()) {
        if (canAdd) {
            PaddingValues(16.dp)
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp, 8.dp),
                horizontalArrangement = Arrangement.End
            ) {
                Button(
                    onClick = onAddNoteClick,
                    colors = ButtonDefaults.buttonColors(containerColor = Navy800),
                    modifier = Modifier.testTag("add_instructor_note_button")
                ) {
                    Icon(Icons.Default.NoteAdd, contentDescription = null)
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Add Instructor Note")
                }
            }
        }

        if (notes.isEmpty()) {
            Box(modifier = Modifier.fillMaxSize().padding(32.dp), contentAlignment = Alignment.Center) {
                Text("No instructor notes yet.", style = MaterialTheme.typography.bodyMedium, color = Slate600)
            }
            return
        }

        LazyColumn(
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            items(notes) { note ->
                Card(
                    shape = RoundedCornerShape(14.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
                ) {
                    Column(modifier = Modifier.padding(14.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(note.authorName, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                            Surface(
                                color = if (note.visibility == NoteVisibility.PARENT_VISIBLE) Emerald100 else Slate200,
                                shape = RoundedCornerShape(6.dp)
                            ) {
                                Text(
                                    text = note.visibility.label,
                                    style = MaterialTheme.typography.labelSmall,
                                    color = if (note.visibility == NoteVisibility.PARENT_VISIBLE) Emerald600 else Slate700,
                                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                )
                            }
                        }
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(note.body, style = MaterialTheme.typography.bodyMedium, color = Slate800)
                    }
                }
            }
        }
    }
}

@Composable
fun AddNoteDialog(
    onDismiss: () -> Unit,
    onAdd: (body: String, visibility: NoteVisibility) -> Unit
) {
    var body by remember { mutableStateOf("") }
    var visibility by remember { mutableStateOf(NoteVisibility.PARENT_VISIBLE) }

    Dialog(onDismissRequest = onDismiss) {
        Card(
            shape = RoundedCornerShape(20.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
            modifier = Modifier.fillMaxWidth().padding(8.dp)
        ) {
            Column(modifier = Modifier.padding(20.dp)) {
                Text("Add Instructor Observation", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                Spacer(modifier = Modifier.height(12.dp))

                OutlinedTextField(
                    value = body,
                    onValueChange = { body = it },
                    label = { Text("Observation / Feedback") },
                    placeholder = { Text("Note student performance, technique, or areas to improve...") },
                    modifier = Modifier.fillMaxWidth().height(120.dp)
                )

                Spacer(modifier = Modifier.height(12.dp))

                Text("Visibility", style = MaterialTheme.typography.bodySmall, color = Slate600)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    NoteVisibility.entries.forEach { v ->
                        FilterChip(
                            selected = visibility == v,
                            onClick = { visibility = v },
                            label = { Text(v.label) }
                        )
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                    TextButton(onClick = onDismiss) { Text("Cancel") }
                    Spacer(modifier = Modifier.width(8.dp))
                    Button(
                        onClick = { if (body.isNotBlank()) onAdd(body.trim(), visibility) },
                        colors = ButtonDefaults.buttonColors(containerColor = Navy800)
                    ) {
                        Text("Save Note")
                    }
                }
            }
        }
    }
}

@Composable
private fun DetailRow(label: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(label, style = MaterialTheme.typography.bodyMedium, color = Slate600)
        Text(value, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium)
    }
}
