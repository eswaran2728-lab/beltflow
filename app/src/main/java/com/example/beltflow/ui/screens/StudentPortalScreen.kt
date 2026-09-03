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
import com.example.beltflow.data.local.AttendanceEntity
import com.example.beltflow.data.model.CertificateDetail
import com.example.beltflow.data.model.StudentSkillProgress
import com.example.beltflow.ui.components.*
import com.example.beltflow.ui.theme.*
import com.example.beltflow.ui.viewmodels.BeltFlowViewModel

@Composable
fun StudentPortalScreen(
    viewModel: BeltFlowViewModel,
    onLogout: () -> Unit,
    onSwitchUser: ((String) -> Unit)? = null
) {
    val currentUser by viewModel.currentUser.collectAsState()
    val allStudents by viewModel.allStudents.collectAsState()

    // Find Aryan Suresh or first student
    val student = remember(allStudents, currentUser) {
        val user = currentUser
        if (user != null && user.studentId != null) {
            allStudents.find { it.id == user.studentId } ?: allStudents.firstOrNull()
        } else {
            allStudents.find { it.fullName.contains("Aryan", ignoreCase = true) } ?: allStudents.firstOrNull()
        }
    }

    val studentSkills by produceState(initialValue = emptyList<StudentSkillProgress>(), student?.id) {
        if (student != null) {
            viewModel.getStudentSkills(student.id).collect { value = it }
        } else {
            value = emptyList()
        }
    }

    val studentCerts by produceState(initialValue = emptyList<CertificateDetail>(), student?.id) {
        if (student != null) {
            viewModel.getStudentCertificates(student.id).collect { value = it }
        } else {
            value = emptyList()
        }
    }

    val studentAttendance by produceState(initialValue = emptyList<AttendanceEntity>(), student?.id) {
        if (student != null) {
            viewModel.getStudentAttendance(student.id).collect { value = it }
        } else {
            value = emptyList()
        }
    }

    var selectedCertForView by remember { mutableStateOf<CertificateDetail?>(null) }

    Scaffold(
        topBar = {
            TopNavBar(
                title = "Student Martial Arts Portal",
                currentUser = currentUser,
                onSwitchUser = { email ->
                    if (onSwitchUser != null) {
                        onSwitchUser(email)
                    } else {
                        viewModel.loginAs(email) {}
                    }
                },
                onLogout = onLogout
            )
        },
        containerColor = MaterialTheme.colorScheme.background
    ) { padding ->
        if (student == null) {
            Box(modifier = Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                Text("No student profile found.", style = MaterialTheme.typography.bodyMedium, color = Slate600)
            }
        } else {
            LazyColumn(
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp),
                modifier = Modifier.fillMaxSize().padding(padding)
            ) {
                // Belt & Rank Banner
                item {
                    Card(
                        shape = RoundedCornerShape(20.dp),
                        colors = CardDefaults.cardColors(containerColor = Navy800),
                        modifier = Modifier.fillMaxWidth().testTag("student_rank_banner")
                    ) {
                        Column(modifier = Modifier.padding(20.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Surface(color = Navy700, shape = CircleShape, modifier = Modifier.size(52.dp)) {
                                        Box(contentAlignment = Alignment.Center) {
                                            Text(student.fullName.take(2).uppercase(), color = Gold500, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleLarge)
                                        }
                                    }
                                    Spacer(modifier = Modifier.width(14.dp))
                                    Column {
                                        Text(student.fullName, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, color = Color.White)
                                        Text("Daerah Sepang Silambam Academy", style = MaterialTheme.typography.bodySmall, color = Slate200)
                                    }
                                }

                                BeltBadge(beltName = student.beltName, colorHex = student.beltColorHex)
                            }

                            Spacer(modifier = Modifier.height(16.dp))
                            HorizontalDivider(color = Navy700)
                            Spacer(modifier = Modifier.height(12.dp))

                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Column {
                                    Text("Attendance Score", style = MaterialTheme.typography.labelSmall, color = Slate200)
                                    Text("${student.attendanceRate}%", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = Emerald600)
                                }
                                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                    Text("Classes Attended", style = MaterialTheme.typography.labelSmall, color = Slate200)
                                    Text("${studentAttendance.size} sessions", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = Color.White)
                                }
                                Column(horizontalAlignment = Alignment.End) {
                                    Text("Next Milestone", style = MaterialTheme.typography.labelSmall, color = Slate200)
                                    Text("Green Belt Exam", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = Gold500)
                                }
                            }
                        }
                    }
                }

                // Curriculum & Techniques Progress
                item {
                    Text("My Technique Progress", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                }

                items(studentSkills) { skill ->
                    Card(
                        shape = RoundedCornerShape(14.dp),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
                    ) {
                        Column(modifier = Modifier.padding(14.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(skill.skillName, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                                Surface(color = Sky100, shape = RoundedCornerShape(6.dp)) {
                                    Text(skill.category, style = MaterialTheme.typography.labelSmall, color = Sky600, modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp))
                                }
                            }
                            Spacer(modifier = Modifier.height(8.dp))
                            SkillProgressBar(level = skill.level)
                        }
                    }
                }

                // Certificates Gallery
                item {
                    Text("My Certificates & Honors", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                }

                if (studentCerts.isEmpty()) {
                    item {
                        Card(
                            shape = RoundedCornerShape(14.dp),
                            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Box(modifier = Modifier.padding(20.dp).fillMaxWidth(), contentAlignment = Alignment.Center) {
                                Text("No certificates issued yet.", style = MaterialTheme.typography.bodyMedium, color = Slate600)
                            }
                        }
                    }
                } else {
                    items(studentCerts) { cert ->
                        Card(
                            shape = RoundedCornerShape(14.dp),
                            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                            modifier = Modifier.fillMaxWidth().clickable { selectedCertForView = cert }
                        ) {
                            Row(
                                modifier = Modifier.padding(14.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Surface(color = Gold100, shape = CircleShape, modifier = Modifier.size(44.dp)) {
                                    Box(contentAlignment = Alignment.Center) {
                                        Icon(Icons.Default.WorkspacePremium, contentDescription = null, tint = Gold600)
                                    }
                                }
                                Spacer(modifier = Modifier.width(12.dp))
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(cert.title, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                                    Text("Verify Code: ${cert.verifyCode} • ${cert.issuedAt}", style = MaterialTheme.typography.bodySmall, color = Slate600)
                                }
                                Icon(Icons.Default.Visibility, contentDescription = "View", tint = Navy800)
                            }
                        }
                    }
                }
            }
        }
    }

    selectedCertForView?.let { cert ->
        CertificateDialog(certificate = cert, onDismiss = { selectedCertForView = null })
    }
}
