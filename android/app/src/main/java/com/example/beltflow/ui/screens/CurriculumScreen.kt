package com.example.beltflow.ui.screens

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import com.example.beltflow.data.local.SkillEntity
import com.example.beltflow.data.model.SkillLevel
import com.example.beltflow.data.model.StudentSkillProgress
import com.example.beltflow.data.model.UserRole
import com.example.beltflow.ui.components.*
import com.example.beltflow.ui.theme.*
import com.example.beltflow.ui.viewmodels.BeltFlowViewModel

@Composable
fun CurriculumScreen(
    viewModel: BeltFlowViewModel,
    onBack: () -> Unit
) {
    val currentUser by viewModel.currentUser.collectAsState()
    val allSkills by viewModel.allSkills.collectAsState()
    val allStudents by viewModel.allStudents.collectAsState()

    var selectedCategory by remember { mutableStateOf("All") }
    var selectedStudentId by remember { mutableStateOf<String?>(allStudents.firstOrNull()?.id) }
    var showAddSkillDialog by remember { mutableStateOf(false) }

    val studentSkillProgress by produceState(initialValue = emptyList<StudentSkillProgress>(), selectedStudentId) {
        val stId = selectedStudentId
        if (stId != null) {
            viewModel.getStudentSkills(stId).collect { value = it }
        } else {
            value = emptyList()
        }
    }

    val categories = remember(allSkills) {
        listOf("All") + allSkills.map { it.category }.distinct()
    }

    val filteredSkills = allSkills.filter { s ->
        selectedCategory == "All" || s.category.equals(selectedCategory, ignoreCase = true)
    }

    Scaffold(
        topBar = {
            TopNavBar(
                title = "Silambam Curriculum & Skills",
                currentUser = currentUser,
                onSwitchUser = { viewModel.loginAs(it) {} },
                onLogout = { viewModel.logout() },
                onBack = onBack
            )
        },
        floatingActionButton = {
            if (currentUser?.role == UserRole.ADMIN || currentUser?.role == UserRole.COACH) {
                FloatingActionButton(
                    onClick = { showAddSkillDialog = true },
                    containerColor = Navy800,
                    contentColor = Gold500,
                    modifier = Modifier.testTag("add_skill_fab")
                ) {
                    Icon(Icons.Default.Add, contentDescription = "Add Skill")
                }
            }
        },
        containerColor = MaterialTheme.colorScheme.background
    ) { padding ->
        LazyColumn(
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            // Student Assessment Selector (if coach/admin)
            if (currentUser?.role == UserRole.ADMIN || currentUser?.role == UserRole.COACH) {
                item {
                    Text("Assess Student Progress:", style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold, color = Slate700)
                    Spacer(modifier = Modifier.height(6.dp))
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        items(allStudents) { st ->
                            FilterChip(
                                selected = selectedStudentId == st.id,
                                onClick = { selectedStudentId = st.id },
                                label = { Text(st.fullName) }
                            )
                        }
                    }
                }
            }

            // Category Tabs
            item {
                LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(categories) { cat ->
                        FilterChip(
                            selected = selectedCategory == cat,
                            onClick = { selectedCategory = cat },
                            label = { Text(cat) }
                        )
                    }
                }
            }

            // Skill Items
            items(filteredSkills, key = { it.id }) { skill ->
                val progress = studentSkillProgress.find { it.skillId == skill.id }
                val currentLevel = progress?.level ?: SkillLevel.NOT_STARTED

                CurriculumSkillCard(
                    skill = skill,
                    currentLevel = currentLevel,
                    canEdit = (currentUser?.role == UserRole.ADMIN || currentUser?.role == UserRole.COACH) && selectedStudentId != null,
                    onLevelChange = { newLevel ->
                        selectedStudentId?.let { stId ->
                            viewModel.updateStudentSkill(stId, skill.id, newLevel)
                        }
                    }
                )
            }
        }
    }

    if (showAddSkillDialog) {
        AddSkillDialog(
            onDismiss = { showAddSkillDialog = false },
            onAdd = { name, category, desc, sort ->
                viewModel.addSkill(name, category, desc, sort)
                showAddSkillDialog = false
            }
        )
    }
}

@Composable
fun CurriculumSkillCard(
    skill: SkillEntity,
    currentLevel: SkillLevel,
    canEdit: Boolean,
    onLevelChange: (SkillLevel) -> Unit
) {
    Card(
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
        modifier = Modifier.fillMaxWidth().testTag("skill_card_${skill.id}")
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(skill.name, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                    if (skill.description.isNotBlank()) {
                        Text(skill.description, style = MaterialTheme.typography.bodySmall, color = Slate600)
                    }
                }
                Surface(
                    color = Sky100,
                    shape = RoundedCornerShape(6.dp)
                ) {
                    Text(
                        text = skill.category,
                        style = MaterialTheme.typography.labelSmall,
                        color = Sky600,
                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(10.dp))
            SkillProgressBar(level = currentLevel)

            if (canEdit) {
                Spacer(modifier = Modifier.height(12.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    SkillLevel.entries.forEach { lvl ->
                        FilterChip(
                            selected = currentLevel == lvl,
                            onClick = { onLevelChange(lvl) },
                            label = { Text(lvl.label.split(" ")[0], style = MaterialTheme.typography.labelSmall) },
                            modifier = Modifier.weight(1f)
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun AddSkillDialog(
    onDismiss: () -> Unit,
    onAdd: (name: String, category: String, description: String, sortOrder: Int) -> Unit
) {
    var name by remember { mutableStateOf("") }
    var category by remember { mutableStateOf("Foundation") }
    var description by remember { mutableStateOf("") }

    Dialog(onDismissRequest = onDismiss) {
        Card(
            shape = RoundedCornerShape(20.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
            modifier = Modifier.fillMaxWidth().padding(8.dp)
        ) {
            Column(modifier = Modifier.padding(20.dp)) {
                Text("Add Curriculum Technique", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, color = Navy800)
                Spacer(modifier = Modifier.height(12.dp))

                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Technique Name *") },
                    placeholder = { Text("e.g. Kaaladi Step 9, Madu Defense") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                Spacer(modifier = Modifier.height(8.dp))

                Text("Category", style = MaterialTheme.typography.bodySmall, color = Slate600)
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    listOf("Foundation", "Weapons", "Sparring", "Forms").forEach { c ->
                        FilterChip(
                            selected = category == c,
                            onClick = { category = c },
                            label = { Text(c) }
                        )
                    }
                }

                Spacer(modifier = Modifier.height(8.dp))

                OutlinedTextField(
                    value = description,
                    onValueChange = { description = it },
                    label = { Text("Description / Stance requirements") },
                    modifier = Modifier.fillMaxWidth().height(90.dp)
                )

                Spacer(modifier = Modifier.height(16.dp))

                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                    TextButton(onClick = onDismiss) { Text("Cancel") }
                    Spacer(modifier = Modifier.width(8.dp))
                    Button(
                        onClick = { if (name.isNotBlank()) onAdd(name.trim(), category, description.trim(), 99) },
                        colors = ButtonDefaults.buttonColors(containerColor = Navy800)
                    ) {
                        Text("Add Technique")
                    }
                }
            }
        }
    }
}
