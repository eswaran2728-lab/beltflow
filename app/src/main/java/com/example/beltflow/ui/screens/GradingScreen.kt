package com.example.beltflow.ui.screens

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
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
import com.example.beltflow.data.local.BeltEntity
import com.example.beltflow.data.model.*
import com.example.beltflow.ui.components.*
import com.example.beltflow.ui.theme.*
import com.example.beltflow.ui.viewmodels.BeltFlowViewModel

@Composable
fun GradingScreen(
    viewModel: BeltFlowViewModel,
    onBack: () -> Unit
) {
    val currentUser by viewModel.currentUser.collectAsState()
    val allGradingEvents by viewModel.allGradingEvents.collectAsState()
    val allStudents by viewModel.allStudents.collectAsState()
    val allBelts by viewModel.allBelts.collectAsState()

    var showCreateEventDialog by remember { mutableStateOf(false) }
    var selectedEventForCandidates by remember { mutableStateOf<GradingEventWithRecords?>(null) }
    var showRegisterCandidateDialog by remember { mutableStateOf(false) }
    var selectedCandidateForScoring by remember { mutableStateOf<GradingCandidateDetail?>(null) }

    Scaffold(
        topBar = {
            TopNavBar(
                title = "Belt Gradings & Examinations",
                currentUser = currentUser,
                onSwitchUser = { viewModel.loginAs(it) {} },
                onLogout = { viewModel.logout() },
                onBack = onBack
            )
        },
        floatingActionButton = {
            if (currentUser?.role == UserRole.ADMIN || currentUser?.role == UserRole.COACH) {
                FloatingActionButton(
                    onClick = { showCreateEventDialog = true },
                    containerColor = Navy800,
                    contentColor = Gold500,
                    modifier = Modifier.testTag("create_grading_event_fab")
                ) {
                    Icon(Icons.Default.Add, contentDescription = "Schedule Grading")
                }
            }
        },
        containerColor = MaterialTheme.colorScheme.background
    ) { padding ->
        if (allGradingEvents.isEmpty()) {
            Box(modifier = Modifier.fillMaxSize().padding(padding).padding(32.dp), contentAlignment = Alignment.Center) {
                Text("No belt grading examinations scheduled.", style = MaterialTheme.typography.bodyMedium, color = Slate600)
            }
        } else {
            LazyColumn(
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp),
                modifier = Modifier.fillMaxSize().padding(padding)
            ) {
                items(allGradingEvents, key = { it.id }) { item ->
                    GradingEventCard(
                        eventWithRecords = item,
                        onClick = { selectedEventForCandidates = item }
                    )
                }
            }
        }
    }

    if (showCreateEventDialog) {
        CreateGradingEventDialog(
            onDismiss = { showCreateEventDialog = false },
            onCreate = { name, date, loc, examiner, fee ->
                viewModel.addGradingEvent(name, date, loc, examiner, fee) {
                    showCreateEventDialog = false
                }
            }
        )
    }

    selectedEventForCandidates?.let { eventItem ->
        GradingCandidatesSheet(
            event = eventItem,
            viewModel = viewModel,
            canManage = currentUser?.role == UserRole.ADMIN || currentUser?.role == UserRole.COACH,
            onDismiss = { selectedEventForCandidates = null },
            onRegisterNew = { showRegisterCandidateDialog = true },
            onScoreCandidate = { candidate ->
                selectedCandidateForScoring = candidate
            }
        )
    }

    if (showRegisterCandidateDialog && selectedEventForCandidates != null) {
        val event = selectedEventForCandidates!!
        RegisterGradingCandidateDialog(
            students = allStudents,
            belts = allBelts,
            onDismiss = { showRegisterCandidateDialog = false },
            onRegister = { studentId, fromBeltId, toBeltId ->
                viewModel.registerForGrading(event.id, studentId, fromBeltId, toBeltId) {
                    showRegisterCandidateDialog = false
                }
            }
        )
    }

    selectedCandidateForScoring?.let { candidate ->
        ScoreGradingCandidateDialog(
            candidate = candidate,
            belts = allBelts,
            onDismiss = { selectedCandidateForScoring = null },
            onSaveResult = { result, toBeltId, notes ->
                viewModel.recordGradingResult(
                    recordId = candidate.recordId,
                    eventId = candidate.eventId,
                    studentId = candidate.studentId,
                    toBeltId = toBeltId,
                    result = result,
                    notes = notes
                ) {
                    selectedCandidateForScoring = null
                }
            }
        )
    }
}

@Composable
fun GradingEventCard(
    eventWithRecords: GradingEventWithRecords,
    onClick: () -> Unit
) {
    Card(
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
        modifier = Modifier.fillMaxWidth().clickable { onClick() }.testTag("grading_event_${eventWithRecords.id}")
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Surface(
                    color = Gold100,
                    shape = CircleShape,
                    modifier = Modifier.size(44.dp)
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(Icons.Default.MilitaryTech, contentDescription = null, tint = Gold600)
                    }
                }
                Spacer(modifier = Modifier.width(12.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text(eventWithRecords.name, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    Text("Date: ${eventWithRecords.eventDate} • ${eventWithRecords.location}", style = MaterialTheme.typography.bodySmall, color = Slate600)
                }

                StatusBadge(
                    statusText = if (eventWithRecords.isCompleted) "Completed" else "Upcoming",
                    backgroundColor = if (eventWithRecords.isCompleted) Slate200 else Emerald100,
                    textColor = if (eventWithRecords.isCompleted) Slate700 else Emerald600
                )
            }

            Spacer(modifier = Modifier.height(12.dp))
            HorizontalDivider(color = Slate100)
            Spacer(modifier = Modifier.height(10.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Examiner: ${eventWithRecords.examiner} • Fee: RM %.2f".format(eventWithRecords.fee),
                    style = MaterialTheme.typography.bodySmall,
                    color = Slate700
                )

                Text(
                    text = "${eventWithRecords.candidateCount} Candidates (${eventWithRecords.passCount} passed)",
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = FontWeight.Bold,
                    color = Navy800
                )
            }
        }
    }
}

@Composable
fun GradingCandidatesSheet(
    event: GradingEventWithRecords,
    viewModel: BeltFlowViewModel,
    canManage: Boolean,
    onDismiss: () -> Unit,
    onRegisterNew: () -> Unit,
    onScoreCandidate: (GradingCandidateDetail) -> Unit
) {
    val candidates by viewModel.getGradingCandidates(event.id).collectAsState(initial = emptyList())

    Dialog(onDismissRequest = onDismiss) {
        Card(
            shape = RoundedCornerShape(20.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
            modifier = Modifier.fillMaxWidth().fillMaxHeight(0.85f).padding(8.dp)
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(event.name, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = Navy800)
                        Text("Candidates Examination List", style = MaterialTheme.typography.bodySmall, color = Slate600)
                    }
                    IconButton(onClick = onDismiss) {
                        Icon(Icons.Default.Close, contentDescription = "Close")
                    }
                }

                Spacer(modifier = Modifier.height(10.dp))

                if (canManage) {
                    Button(
                        onClick = onRegisterNew,
                        colors = ButtonDefaults.buttonColors(containerColor = Navy800),
                        modifier = Modifier.fillMaxWidth().testTag("register_candidate_button")
                    ) {
                        Icon(Icons.Default.PersonAdd, contentDescription = null)
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("Register Candidate")
                    }
                    Spacer(modifier = Modifier.height(10.dp))
                }

                if (candidates.isEmpty()) {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Text("No candidates registered for this examination.", style = MaterialTheme.typography.bodyMedium, color = Slate600)
                    }
                } else {
                    LazyColumn(
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                        modifier = Modifier.fillMaxSize()
                    ) {
                        items(candidates) { candidate ->
                            CandidateRow(
                                candidate = candidate,
                                canManage = canManage,
                                onScore = { onScoreCandidate(candidate) }
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun CandidateRow(
    candidate: GradingCandidateDetail,
    canManage: Boolean,
    onScore: () -> Unit
) {
    Card(
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = Slate50),
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(candidate.studentName, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                Spacer(modifier = Modifier.height(2.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    BeltBadge(beltName = candidate.fromBeltName, colorHex = candidate.fromBeltColorHex)
                    Icon(Icons.Default.ArrowForward, contentDescription = null, modifier = Modifier.size(16.dp).padding(horizontal = 2.dp), tint = Slate600)
                    BeltBadge(beltName = candidate.toBeltName, colorHex = candidate.toBeltColorHex)
                }
            }

            Column(horizontalAlignment = Alignment.End) {
                val (bg, txt) = when (candidate.result) {
                    GradingResultType.PASS -> Emerald100 to Emerald600
                    GradingResultType.DOUBLE_PROMOTION -> Purple100 to Purple600
                    GradingResultType.FAIL -> Crimson100 to Crimson600
                    GradingResultType.RETEST -> Gold100 to Gold600
                    GradingResultType.REGISTERED -> Slate200 to Slate700
                    GradingResultType.ABSENT -> Slate200 to Slate700
                }
                StatusBadge(statusText = candidate.result.label, backgroundColor = bg, textColor = txt)

                if (canManage) {
                    Spacer(modifier = Modifier.height(4.dp))
                    TextButton(onClick = onScore, contentPadding = PaddingValues(0.dp)) {
                        Text("Score Exam", style = MaterialTheme.typography.labelSmall, color = Navy800)
                    }
                }
            }
        }
    }
}

@Composable
fun CreateGradingEventDialog(
    onDismiss: () -> Unit,
    onCreate: (name: String, date: String, loc: String, examiner: String, fee: Double) -> Unit
) {
    var name by remember { mutableStateOf("Sepang Silambam Grading Examination") }
    var eventDate by remember { mutableStateOf("2026-11-20") }
    var location by remember { mutableStateOf("Dojo Sepang Utama") }
    var examiner by remember { mutableStateOf("Master Eswaran") }
    var fee by remember { mutableStateOf("80.00") }

    Dialog(onDismissRequest = onDismiss) {
        Card(
            shape = RoundedCornerShape(20.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
            modifier = Modifier.fillMaxWidth().padding(8.dp)
        ) {
            Column(modifier = Modifier.padding(20.dp).verticalScroll(rememberScrollState())) {
                Text("Schedule Belt Grading", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, color = Navy800)
                Spacer(modifier = Modifier.height(12.dp))

                OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("Event Name") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedTextField(value = eventDate, onValueChange = { eventDate = it }, label = { Text("Exam Date (YYYY-MM-DD)") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedTextField(value = location, onValueChange = { location = it }, label = { Text("Location") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedTextField(value = examiner, onValueChange = { examiner = it }, label = { Text("Lead Examiner") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedTextField(value = fee, onValueChange = { fee = it }, label = { Text("Grading Fee (RM)") }, singleLine = true, modifier = Modifier.fillMaxWidth())

                Spacer(modifier = Modifier.height(16.dp))
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                    TextButton(onClick = onDismiss) { Text("Cancel") }
                    Spacer(modifier = Modifier.width(8.dp))
                    Button(
                        onClick = { onCreate(name.trim(), eventDate.trim(), location.trim(), examiner.trim(), fee.toDoubleOrNull() ?: 0.0) },
                        colors = ButtonDefaults.buttonColors(containerColor = Navy800)
                    ) {
                        Text("Create Event")
                    }
                }
            }
        }
    }
}

@Composable
fun RegisterGradingCandidateDialog(
    students: List<StudentWithDetails>,
    belts: List<BeltEntity>,
    onDismiss: () -> Unit,
    onRegister: (studentId: String, fromBeltId: String?, toBeltId: String?) -> Unit
) {
    var selectedStudentId by remember { mutableStateOf(students.firstOrNull()?.id ?: "") }
    val selectedStudent = students.find { it.id == selectedStudentId }
    val fromBeltId = selectedStudent?.beltId
    var selectedToBeltId by remember {
        val currentOrder = belts.find { it.id == fromBeltId }?.sortOrder ?: 0
        mutableStateOf(belts.find { it.sortOrder == currentOrder + 1 }?.id ?: belts.lastOrNull()?.id)
    }

    Dialog(onDismissRequest = onDismiss) {
        Card(
            shape = RoundedCornerShape(20.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
            modifier = Modifier.fillMaxWidth().padding(8.dp)
        ) {
            Column(modifier = Modifier.padding(20.dp)) {
                Text("Register Candidate", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, color = Navy800)
                Spacer(modifier = Modifier.height(12.dp))

                Text("Select Student:", style = MaterialTheme.typography.bodySmall, color = Slate600)
                LazyColumn(modifier = Modifier.height(150.dp)) {
                    items(students) { st ->
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { selectedStudentId = st.id }
                                .padding(vertical = 4.dp)
                        ) {
                            RadioButton(
                                selected = selectedStudentId == st.id,
                                onClick = { selectedStudentId = st.id }
                            )
                            Text(st.fullName, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold)
                        }
                    }
                }

                Spacer(modifier = Modifier.height(10.dp))

                Text("Target Promotion Belt:", style = MaterialTheme.typography.bodySmall, color = Slate600)
                LazyColumn(modifier = Modifier.height(120.dp)) {
                    items(belts) { b ->
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { selectedToBeltId = b.id }
                                .padding(vertical = 4.dp)
                        ) {
                            RadioButton(
                                selected = selectedToBeltId == b.id,
                                onClick = { selectedToBeltId = b.id }
                            )
                            BeltBadge(beltName = b.name, colorHex = b.colorHex)
                        }
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                    TextButton(onClick = onDismiss) { Text("Cancel") }
                    Spacer(modifier = Modifier.width(8.dp))
                    Button(
                        onClick = { onRegister(selectedStudentId, fromBeltId, selectedToBeltId) },
                        colors = ButtonDefaults.buttonColors(containerColor = Navy800)
                    ) {
                        Text("Register")
                    }
                }
            }
        }
    }
}

@Composable
fun ScoreGradingCandidateDialog(
    candidate: GradingCandidateDetail,
    belts: List<BeltEntity>,
    onDismiss: () -> Unit,
    onSaveResult: (result: GradingResultType, toBeltId: String?, notes: String) -> Unit
) {
    var result by remember { mutableStateOf(if (candidate.result == GradingResultType.REGISTERED || candidate.result == GradingResultType.ABSENT) GradingResultType.PASS else candidate.result) }
    var toBeltId by remember { mutableStateOf(candidate.toBeltId) }
    var examinerNotes by remember { mutableStateOf(candidate.notes) }

    Dialog(onDismissRequest = onDismiss) {
        Card(
            shape = RoundedCornerShape(20.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
            modifier = Modifier.fillMaxWidth().padding(8.dp)
        ) {
            Column(modifier = Modifier.padding(20.dp)) {
                Text("Record Grading Result", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, color = Navy800)
                Spacer(modifier = Modifier.height(4.dp))
                Text("Candidate: ${candidate.studentName}", style = MaterialTheme.typography.bodyMedium, color = Slate600)

                Spacer(modifier = Modifier.height(12.dp))

                Text("Examination Verdict", style = MaterialTheme.typography.bodySmall, color = Slate600)
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    listOf(GradingResultType.PASS, GradingResultType.FAIL, GradingResultType.DOUBLE_PROMOTION, GradingResultType.RETEST).forEach { res ->
                        FilterChip(
                            selected = result == res,
                            onClick = { result = res },
                            label = { Text(res.label.split(" ")[0]) }
                        )
                    }
                }

                Spacer(modifier = Modifier.height(10.dp))

                OutlinedTextField(
                    value = examinerNotes,
                    onValueChange = { examinerNotes = it },
                    label = { Text("Examiner Feedback / Technique remarks") },
                    modifier = Modifier.fillMaxWidth().height(90.dp)
                )

                Spacer(modifier = Modifier.height(16.dp))

                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                    TextButton(onClick = onDismiss) { Text("Cancel") }
                    Spacer(modifier = Modifier.width(8.dp))
                    Button(
                        onClick = { onSaveResult(result, toBeltId, examinerNotes.trim()) },
                        colors = ButtonDefaults.buttonColors(containerColor = Navy800)
                    ) {
                        Text("Save & Promote")
                    }
                }
            }
        }
    }
}
