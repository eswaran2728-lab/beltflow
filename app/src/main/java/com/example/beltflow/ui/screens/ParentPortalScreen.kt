package com.example.beltflow.ui.screens

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
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
import androidx.compose.ui.window.Dialog
import com.example.beltflow.data.local.AttendanceEntity
import com.example.beltflow.data.local.InstructorNoteEntity
import com.example.beltflow.data.model.*
import com.example.beltflow.ui.components.*
import com.example.beltflow.ui.theme.*
import com.example.beltflow.ui.viewmodels.BeltFlowViewModel

@Composable
fun ParentPortalScreen(
    viewModel: BeltFlowViewModel,
    onNavigateToVerifyCert: () -> Unit,
    onLogout: () -> Unit
) {
    val currentUser by viewModel.currentUser.collectAsState()
    val allStudents by viewModel.allStudents.collectAsState()
    val allInvoices by viewModel.allInvoices.collectAsState()

    // Find children linked to this parent (by parent name or child ID)
    val parentChildren = remember(allStudents, currentUser) {
        val user = currentUser
        if (user != null) {
            allStudents.filter { s ->
                s.parentName.contains("Suresh", ignoreCase = true) ||
                        (user.linkedStudentId != null && s.id == user.linkedStudentId) ||
                        s.parentPhone.contains(user.phone)
            }.ifEmpty { allStudents.take(2) }
        } else {
            allStudents.take(2)
        }
    }

    var selectedChildId by remember { mutableStateOf<String?>(parentChildren.firstOrNull()?.id) }
    val currentChild = parentChildren.find { it.id == selectedChildId } ?: parentChildren.firstOrNull()

    val childInvoices = remember(allInvoices, currentChild) {
        if (currentChild == null) emptyList()
        else allInvoices.filter { it.studentId == currentChild.id }
    }

    val childAttendance by produceState(initialValue = emptyList<AttendanceEntity>(), currentChild?.id) {
        if (currentChild != null) {
            viewModel.getStudentAttendance(currentChild.id).collect { value = it }
        } else {
            value = emptyList()
        }
    }

    val childSkills by produceState(initialValue = emptyList<StudentSkillProgress>(), currentChild?.id) {
        if (currentChild != null) {
            viewModel.getStudentSkills(currentChild.id).collect { value = it }
        } else {
            value = emptyList()
        }
    }

    val childCertificates by produceState(initialValue = emptyList<CertificateDetail>(), currentChild?.id) {
        if (currentChild != null) {
            viewModel.getStudentCertificates(currentChild.id).collect { value = it }
        } else {
            value = emptyList()
        }
    }

    val childNotes by produceState(initialValue = emptyList<InstructorNoteEntity>(), currentChild?.id) {
        if (currentChild != null) {
            viewModel.getStudentNotes(currentChild.id).collect { value = it }
        } else {
            value = emptyList()
        }
    }

    var showCashClaimDialog by remember { mutableStateOf<InvoiceWithStudent?>(null) }
    var selectedCertForView by remember { mutableStateOf<CertificateDetail?>(null) }
    var selectedReceiptForView by remember { mutableStateOf<Pair<InvoiceWithStudent, PaymentWithReceipt>?>(null) }

    Scaffold(
        topBar = {
            TopNavBar(
                title = "Parent Portal",
                currentUser = currentUser,
                onSwitchUser = { email -> viewModel.loginAs(email) {} },
                onLogout = onLogout
            )
        },
        containerColor = MaterialTheme.colorScheme.background
    ) { padding ->
        if (parentChildren.isEmpty() || currentChild == null) {
            Box(modifier = Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                Text("No children linked to this parent account.", style = MaterialTheme.typography.bodyMedium, color = Slate600)
            }
        } else {
            LazyColumn(
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp),
                modifier = Modifier.fillMaxSize().padding(padding)
            ) {
                // Child Selector (if multiple children)
                if (parentChildren.size > 1) {
                    item {
                        Text("Select Child:", style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold, color = Slate700)
                        Spacer(modifier = Modifier.height(6.dp))
                        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            items(parentChildren) { child ->
                                FilterChip(
                                    selected = child.id == currentChild.id,
                                    onClick = { selectedChildId = child.id },
                                    label = { Text(child.fullName) },
                                    leadingIcon = {
                                        Surface(color = parseHexColor(child.beltColorHex), shape = CircleShape, modifier = Modifier.size(10.dp)) {}
                                    }
                                )
                            }
                        }
                    }
                }

                // Child Header & Belt Rank Card
                item {
                    Card(
                        shape = RoundedCornerShape(20.dp),
                        colors = CardDefaults.cardColors(containerColor = Navy800),
                        modifier = Modifier.fillMaxWidth().testTag("parent_child_overview_card")
                    ) {
                        Column(modifier = Modifier.padding(20.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Surface(color = Navy700, shape = CircleShape, modifier = Modifier.size(54.dp)) {
                                        Box(contentAlignment = Alignment.Center) {
                                            Text(
                                                text = currentChild.fullName.take(2).uppercase(),
                                                color = Gold500,
                                                fontWeight = FontWeight.Bold,
                                                style = MaterialTheme.typography.titleLarge
                                            )
                                        }
                                    }
                                    Spacer(modifier = Modifier.width(14.dp))
                                    Column {
                                        Text(currentChild.fullName, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, color = Color.White)
                                        Text("Age: ${currentChild.age} • ${currentChild.gender}", style = MaterialTheme.typography.bodySmall, color = Slate200)
                                    }
                                }

                                BeltBadge(beltName = currentChild.beltName, colorHex = currentChild.beltColorHex)
                            }

                            Spacer(modifier = Modifier.height(16.dp))
                            HorizontalDivider(color = Navy700)
                            Spacer(modifier = Modifier.height(12.dp))

                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Column {
                                    Text("Attendance Rate", style = MaterialTheme.typography.labelSmall, color = Slate200)
                                    Text("${currentChild.attendanceRate}%", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = Emerald600)
                                }
                                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                    Text("Classes Enrolled", style = MaterialTheme.typography.labelSmall, color = Slate200)
                                    Text(currentChild.classNames.joinToString(", ").ifEmpty { "Weekend Silambam" }, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold, color = Color.White)
                                }
                                Column(horizontalAlignment = Alignment.End) {
                                    Text("Status", style = MaterialTheme.typography.labelSmall, color = Slate200)
                                    Text(currentChild.lifecycle.label, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = Gold500)
                                }
                            }
                        }
                    }
                }

                // Billing & Monthly Dues Section
                item {
                    Text("Fee Invoices & Billing", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                }

                if (childInvoices.isEmpty()) {
                    item {
                        Card(
                            shape = RoundedCornerShape(14.dp),
                            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Box(modifier = Modifier.padding(20.dp).fillMaxWidth(), contentAlignment = Alignment.Center) {
                                Text("No pending invoices found. All fees are up to date!", style = MaterialTheme.typography.bodyMedium, color = Slate600)
                            }
                        }
                    }
                } else {
                    items(childInvoices) { inv ->
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
                                    Column {
                                        Text("Month: ${inv.billingMonth}", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                                        Text("Amount: RM %.2f".format(inv.netAmount), style = MaterialTheme.typography.bodyMedium, color = Navy900, fontWeight = FontWeight.SemiBold)
                                    }

                                    val (bg, txt) = when (inv.status) {
                                        InvoiceStatus.PAID -> Emerald100 to Emerald600
                                        InvoiceStatus.PENDING_APPROVAL -> Gold100 to Gold600
                                        InvoiceStatus.UNPAID -> Crimson100 to Crimson600
                                        InvoiceStatus.OVERDUE -> Crimson100 to Crimson600
                                        InvoiceStatus.WAIVED -> Slate200 to Slate700
                                    }
                                    StatusBadge(statusText = inv.status.label, backgroundColor = bg, textColor = txt)
                                }

                                if (inv.status == InvoiceStatus.UNPAID || inv.status == InvoiceStatus.OVERDUE) {
                                    Spacer(modifier = Modifier.height(10.dp))
                                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                        Button(
                                            onClick = { showCashClaimDialog = inv },
                                            colors = ButtonDefaults.buttonColors(containerColor = Navy800),
                                            modifier = Modifier.weight(1f).testTag("pay_cash_claim_button")
                                        ) {
                                            Text("Paid Cash to Coach")
                                        }
                                        OutlinedButton(
                                            onClick = {
                                                viewModel.payInvoiceWithFpx(inv.id) {}
                                            },
                                            modifier = Modifier.weight(1f).testTag("pay_fpx_button")
                                        ) {
                                            Text("Pay via FPX")
                                        }
                                    }
                                } else if (inv.status == InvoiceStatus.PAID && inv.payments.isNotEmpty()) {
                                    Spacer(modifier = Modifier.height(8.dp))
                                    TextButton(
                                        onClick = { selectedReceiptForView = inv to inv.payments.last() },
                                        contentPadding = PaddingValues(0.dp)
                                    ) {
                                        Icon(Icons.Default.Receipt, contentDescription = null, tint = Navy800, modifier = Modifier.size(16.dp))
                                        Spacer(modifier = Modifier.width(4.dp))
                                        Text("View Official Receipt", color = Navy800, style = MaterialTheme.typography.labelMedium)
                                    }
                                }
                            }
                        }
                    }
                }

                // Certificates Section
                item {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("Certificates & Achievements", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                        TextButton(onClick = onNavigateToVerifyCert) {
                            Text("Verify Code", color = Navy800)
                        }
                    }
                }

                if (childCertificates.isEmpty()) {
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
                    items(childCertificates) { cert ->
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
                                    Text("Cert No: ${cert.certNo} • Date: ${cert.issuedAt}", style = MaterialTheme.typography.bodySmall, color = Slate600)
                                }
                                Icon(Icons.Default.Visibility, contentDescription = "View", tint = Navy800)
                            }
                        }
                    }
                }

                // Technique Syllabus Progress
                item {
                    Text("Technique Syllabus Progress", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                }
                items(childSkills.take(4)) { skill ->
                    Card(
                        shape = RoundedCornerShape(14.dp),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
                    ) {
                        Column(modifier = Modifier.padding(14.dp)) {
                            Text(skill.skillName, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                            Spacer(modifier = Modifier.height(6.dp))
                            SkillProgressBar(level = skill.level)
                        }
                    }
                }

                // Instructor Notes
                val parentVisibleNotes = childNotes.filter { it.visibility == NoteVisibility.PARENT_VISIBLE }
                if (parentVisibleNotes.isNotEmpty()) {
                    item {
                        Text("Instructor Feedback & Observations", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    }
                    items(parentVisibleNotes) { note ->
                        Card(
                            shape = RoundedCornerShape(14.dp),
                            colors = CardDefaults.cardColors(containerColor = Slate50)
                        ) {
                            Column(modifier = Modifier.padding(14.dp)) {
                                Text("From: ${note.authorName}", style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold, color = Gold600)
                                Spacer(modifier = Modifier.height(4.dp))
                                Text(note.body, style = MaterialTheme.typography.bodyMedium, color = Slate800)
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

    showCashClaimDialog?.let { inv ->
        SubmitCashClaimDialog(
            invoice = inv,
            onDismiss = { showCashClaimDialog = null },
            onSubmit = { amount, notes ->
                viewModel.submitCashPayment(inv.id, amount, notes) {
                    showCashClaimDialog = null
                }
            }
        )
    }

    selectedReceiptForView?.let { (inv, p) ->
        ReceiptDialog(invoice = inv, payment = p, onDismiss = { selectedReceiptForView = null })
    }
}

@Composable
fun SubmitCashClaimDialog(
    invoice: InvoiceWithStudent,
    onDismiss: () -> Unit,
    onSubmit: (amount: Double, notes: String) -> Unit
) {
    var amount by remember { mutableStateOf(invoice.netAmount.toString()) }
    var notes by remember { mutableStateOf("Handed cash RM %.2f to Coach during Saturday session".format(invoice.netAmount)) }

    Dialog(onDismissRequest = onDismiss) {
        Card(
            shape = RoundedCornerShape(20.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
            modifier = Modifier.fillMaxWidth().padding(8.dp)
        ) {
            Column(modifier = Modifier.padding(20.dp)) {
                Text("Submit Cash / Online Payment Claim", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, color = Navy800)
                Spacer(modifier = Modifier.height(6.dp))
                Text("Month: ${invoice.billingMonth} • Student: ${invoice.studentName}", style = MaterialTheme.typography.bodySmall, color = Slate600)

                Spacer(modifier = Modifier.height(12.dp))

                OutlinedTextField(
                    value = amount,
                    onValueChange = { amount = it },
                    label = { Text("Amount Paid (RM)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                Spacer(modifier = Modifier.height(10.dp))

                OutlinedTextField(
                    value = notes,
                    onValueChange = { notes = it },
                    label = { Text("Payment Details / Coach Name / Ref No.") },
                    modifier = Modifier.fillMaxWidth().height(90.dp)
                )

                Spacer(modifier = Modifier.height(16.dp))

                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                    TextButton(onClick = onDismiss) { Text("Cancel") }
                    Spacer(modifier = Modifier.width(8.dp))
                    Button(
                        onClick = {
                            val amt = amount.toDoubleOrNull() ?: invoice.netAmount
                            onSubmit(amt, notes.trim())
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = Navy800),
                        modifier = Modifier.testTag("submit_claim_confirm_button")
                    ) {
                        Text("Submit Claim")
                    }
                }
            }
        }
    }
}
