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
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.example.beltflow.data.model.Medal
import com.example.beltflow.data.model.StudentWithDetails
import com.example.beltflow.data.model.TournamentDetail
import com.example.beltflow.data.model.UserRole
import com.example.beltflow.ui.components.*
import com.example.beltflow.ui.theme.*
import com.example.beltflow.ui.viewmodels.BeltFlowViewModel

@Composable
fun TournamentsScreen(
    viewModel: BeltFlowViewModel,
    onBack: () -> Unit
) {
    val currentUser by viewModel.currentUser.collectAsState()
    val allTournaments by viewModel.allTournaments.collectAsState()
    val allStudents by viewModel.allStudents.collectAsState()

    var showAddTournamentDialog by remember { mutableStateOf(false) }
    var selectedTournamentForMedal by remember { mutableStateOf<TournamentDetail?>(null) }

    val allResults = allTournaments.flatMap { it.results }
    val goldCount = allResults.count { it.medal == Medal.GOLD }
    val silverCount = allResults.count { it.medal == Medal.SILVER }
    val bronzeCount = allResults.count { it.medal == Medal.BRONZE }

    Scaffold(
        topBar = {
            TopNavBar(
                title = "Martial Arts Tournaments",
                currentUser = currentUser,
                onSwitchUser = { viewModel.loginAs(it) {} },
                onLogout = { viewModel.logout() },
                onBack = onBack
            )
        },
        floatingActionButton = {
            if (currentUser?.role == UserRole.ADMIN || currentUser?.role == UserRole.COACH) {
                FloatingActionButton(
                    onClick = { showAddTournamentDialog = true },
                    containerColor = Navy800,
                    contentColor = Gold500,
                    modifier = Modifier.testTag("add_tournament_fab")
                ) {
                    Icon(Icons.Default.Add, contentDescription = "Add Tournament")
                }
            }
        },
        containerColor = MaterialTheme.colorScheme.background
    ) { padding ->
        LazyColumn(
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
            modifier = Modifier.fillMaxSize().padding(padding)
        ) {
            // Academy Medal Tally Banner
            item {
                Card(
                    shape = RoundedCornerShape(20.dp),
                    colors = CardDefaults.cardColors(containerColor = Navy800),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(
                            text = "🏆 Academy Championship Tally",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            color = Gold500
                        )
                        Spacer(modifier = Modifier.height(12.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            MedalCountCard(medalEmoji = "🥇", label = "Gold", count = "$goldCount", modifier = Modifier.weight(1f))
                            MedalCountCard(medalEmoji = "🥈", label = "Silver", count = "$silverCount", modifier = Modifier.weight(1f))
                            MedalCountCard(medalEmoji = "🥉", label = "Bronze", count = "$bronzeCount", modifier = Modifier.weight(1f))
                        }
                    }
                }
            }

            item {
                Text(
                    text = "State & National Tournaments",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
            }

            if (allTournaments.isEmpty()) {
                item {
                    Box(modifier = Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) {
                        Text("No tournaments recorded.", style = MaterialTheme.typography.bodyMedium, color = Slate600)
                    }
                }
            } else {
                items(allTournaments, key = { it.id }) { t ->
                    TournamentCard(
                        tournament = t,
                        canManage = currentUser?.role == UserRole.ADMIN || currentUser?.role == UserRole.COACH,
                        onRecordMedal = { selectedTournamentForMedal = t }
                    )
                }
            }
        }
    }

    if (showAddTournamentDialog) {
        AddTournamentDialog(
            onDismiss = { showAddTournamentDialog = false },
            onAdd = { name, date, loc, org ->
                viewModel.addTournament(name, date, loc, org) {
                    showAddTournamentDialog = false
                }
            }
        )
    }

    selectedTournamentForMedal?.let { t ->
        RecordMedalDialog(
            tournament = t,
            students = allStudents,
            onDismiss = { selectedTournamentForMedal = null },
            onRecord = { studentId, category, medal, notes ->
                viewModel.recordTournamentResult(t.id, studentId, category, medal, notes) {
                    selectedTournamentForMedal = null
                }
            }
        )
    }
}

@Composable
private fun MedalCountCard(
    medalEmoji: String,
    label: String,
    count: String,
    modifier: Modifier = Modifier
) {
    Surface(
        color = Navy700,
        shape = RoundedCornerShape(12.dp),
        modifier = modifier
    ) {
        Column(
            modifier = Modifier.padding(10.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(medalEmoji, fontSize = 24.sp)
            Spacer(modifier = Modifier.height(2.dp))
            Text(count, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = Color.White)
            Text(label, style = MaterialTheme.typography.labelSmall, color = Slate200)
        }
    }
}

@Composable
fun TournamentCard(
    tournament: TournamentDetail,
    canManage: Boolean,
    onRecordMedal: () -> Unit
) {
    Card(
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
        modifier = Modifier.fillMaxWidth().testTag("tournament_card_${tournament.id}")
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
                        Icon(Icons.Default.EmojiEvents, contentDescription = null, tint = Gold600)
                    }
                }
                Spacer(modifier = Modifier.width(12.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text(tournament.name, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    Text("Date: ${tournament.eventDate} • ${tournament.location}", style = MaterialTheme.typography.bodySmall, color = Slate600)
                }
            }

            Spacer(modifier = Modifier.height(10.dp))
            HorizontalDivider(color = Slate100)
            Spacer(modifier = Modifier.height(8.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Organizer: ${tournament.organizer}",
                    style = MaterialTheme.typography.bodySmall,
                    color = Slate700
                )

                if (canManage) {
                    Button(
                        onClick = onRecordMedal,
                        colors = ButtonDefaults.buttonColors(containerColor = Navy800),
                        shape = RoundedCornerShape(8.dp),
                        contentPadding = PaddingValues(horizontal = 10.dp, vertical = 2.dp),
                        modifier = Modifier.testTag("record_medal_button_${tournament.id}")
                    ) {
                        Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Record Medal", style = MaterialTheme.typography.labelSmall)
                    }
                }
            }

            if (tournament.results.isNotEmpty()) {
                Spacer(modifier = Modifier.height(12.dp))
                Text("Medal Winners:", style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold, color = Slate600)
                Spacer(modifier = Modifier.height(4.dp))
                tournament.results.forEach { res ->
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(vertical = 2.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(res.medal.emoji, fontSize = 16.sp)
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("${res.studentName} (${res.eventCategory})", style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.Medium)
                        }
                        Text("+${res.points} pts", style = MaterialTheme.typography.labelSmall, color = Emerald600, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}

@Composable
fun AddTournamentDialog(
    onDismiss: () -> Unit,
    onAdd: (name: String, date: String, loc: String, org: String) -> Unit
) {
    var name by remember { mutableStateOf("National Youth Silambam Championship 2026") }
    var eventDate by remember { mutableStateOf("2026-12-05") }
    var location by remember { mutableStateOf("Stadium Melawati, Shah Alam") }
    var organizer by remember { mutableStateOf("Silambam Association of Malaysia") }

    Dialog(onDismissRequest = onDismiss) {
        Card(
            shape = RoundedCornerShape(20.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
            modifier = Modifier.fillMaxWidth().padding(8.dp)
        ) {
            Column(modifier = Modifier.padding(20.dp)) {
                Text("Add Tournament Event", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, color = Navy800)
                Spacer(modifier = Modifier.height(12.dp))

                OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("Tournament Name") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedTextField(value = eventDate, onValueChange = { eventDate = it }, label = { Text("Event Date (YYYY-MM-DD)") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedTextField(value = location, onValueChange = { location = it }, label = { Text("Venue / Location") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedTextField(value = organizer, onValueChange = { organizer = it }, label = { Text("Sanctioning Body / Organizer") }, singleLine = true, modifier = Modifier.fillMaxWidth())

                Spacer(modifier = Modifier.height(16.dp))
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                    TextButton(onClick = onDismiss) { Text("Cancel") }
                    Spacer(modifier = Modifier.width(8.dp))
                    Button(
                        onClick = { onAdd(name.trim(), eventDate.trim(), location.trim(), organizer.trim()) },
                        colors = ButtonDefaults.buttonColors(containerColor = Navy800)
                    ) {
                        Text("Add Tournament")
                    }
                }
            }
        }
    }
}

@Composable
fun RecordMedalDialog(
    tournament: TournamentDetail,
    students: List<StudentWithDetails>,
    onDismiss: () -> Unit,
    onRecord: (studentId: String, category: String, medal: Medal, notes: String) -> Unit
) {
    var selectedStudentId by remember { mutableStateOf(students.firstOrNull()?.id ?: "") }
    var category by remember { mutableStateOf("Under-12 Individual Weapon Routine") }
    var selectedMedal by remember { mutableStateOf(Medal.GOLD) }
    var notes by remember { mutableStateOf("First place with flawless Kaaladi sequence") }

    Dialog(onDismissRequest = onDismiss) {
        Card(
            shape = RoundedCornerShape(20.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
            modifier = Modifier.fillMaxWidth().padding(8.dp)
        ) {
            Column(modifier = Modifier.padding(20.dp)) {
                Text("Record Medal Achievement", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, color = Navy800)
                Spacer(modifier = Modifier.height(4.dp))
                Text(tournament.name, style = MaterialTheme.typography.bodySmall, color = Slate600)

                Spacer(modifier = Modifier.height(10.dp))

                Text("Select Winning Student:", style = MaterialTheme.typography.bodySmall, color = Slate600)
                LazyColumn(modifier = Modifier.height(120.dp)) {
                    items(students) { st ->
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.fillMaxWidth().clickable { selectedStudentId = st.id }.padding(vertical = 4.dp)
                        ) {
                            RadioButton(selected = selectedStudentId == st.id, onClick = { selectedStudentId = st.id })
                            Text(st.fullName, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold)
                        }
                    }
                }

                Spacer(modifier = Modifier.height(8.dp))

                OutlinedTextField(value = category, onValueChange = { category = it }, label = { Text("Event Category") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                Spacer(modifier = Modifier.height(8.dp))

                Text("Medal Won", style = MaterialTheme.typography.bodySmall, color = Slate600)
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Medal.entries.forEach { m ->
                        FilterChip(
                            selected = selectedMedal == m,
                            onClick = { selectedMedal = m },
                            label = { Text("${m.emoji} ${m.label}") }
                        )
                    }
                }

                Spacer(modifier = Modifier.height(8.dp))
                OutlinedTextField(value = notes, onValueChange = { notes = it }, label = { Text("Remarks") }, singleLine = true, modifier = Modifier.fillMaxWidth())

                Spacer(modifier = Modifier.height(16.dp))
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                    TextButton(onClick = onDismiss) { Text("Cancel") }
                    Spacer(modifier = Modifier.width(8.dp))
                    Button(
                        onClick = { onRecord(selectedStudentId, category.trim(), selectedMedal, notes.trim()) },
                        colors = ButtonDefaults.buttonColors(containerColor = Navy800)
                    ) {
                        Text("Save & Issue Certificate")
                    }
                }
            }
        }
    }
}
