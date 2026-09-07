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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import com.example.beltflow.data.model.*
import com.example.beltflow.ui.components.*
import com.example.beltflow.ui.theme.*
import com.example.beltflow.ui.viewmodels.BeltFlowViewModel
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Composable
fun BillingScreen(
    viewModel: BeltFlowViewModel,
    onBack: () -> Unit
) {
    val currentUser by viewModel.currentUser.collectAsState()
    val allInvoices by viewModel.allInvoices.collectAsState()

    var selectedStatusFilter by remember { mutableStateOf<InvoiceStatus?>(null) }
    val currentMonth = remember { SimpleDateFormat("yyyy-MM", Locale.getDefault()).format(Date()) }
    var selectedMonth by remember { mutableStateOf(currentMonth) }

    var showGenerateDialog by remember { mutableStateOf(false) }
    var selectedInvoiceForPayment by remember { mutableStateOf<InvoiceWithStudent?>(null) }
    var selectedReceiptForView by remember { mutableStateOf<Pair<InvoiceWithStudent, PaymentWithReceipt>?>(null) }

    val filteredInvoices = allInvoices.filter { inv ->
        val matchesMonth = selectedMonth.isBlank() || inv.billingMonth == selectedMonth
        val matchesStatus = selectedStatusFilter == null || inv.status == selectedStatusFilter
        matchesMonth && matchesStatus
    }

    val totalPaid = filteredInvoices.filter { it.status == InvoiceStatus.PAID }.sumOf { it.netAmount }
    val totalPending = filteredInvoices.filter { it.status == InvoiceStatus.UNPAID || it.status == InvoiceStatus.PENDING_APPROVAL }.sumOf { it.netAmount }
    val totalOverdue = filteredInvoices.filter { it.status == InvoiceStatus.OVERDUE }.sumOf { it.netAmount }

    Scaffold(
        topBar = {
            TopNavBar(
                title = "Fee Invoices & Billing",
                currentUser = currentUser,
                onSwitchUser = { viewModel.loginAs(it) {} },
                onLogout = { viewModel.logout() },
                onBack = onBack
            )
        },
        floatingActionButton = {
            if (currentUser?.role == UserRole.ADMIN || currentUser?.role == UserRole.COACH) {
                FloatingActionButton(
                    onClick = { showGenerateDialog = true },
                    containerColor = Navy800,
                    contentColor = Gold500,
                    modifier = Modifier.testTag("generate_invoices_fab")
                ) {
                    Icon(Icons.Default.AddCard, contentDescription = "Generate Invoices")
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
            // Financial Summary Banner
            item {
                Card(
                    shape = RoundedCornerShape(18.dp),
                    colors = CardDefaults.cardColors(containerColor = Navy800),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(
                            text = "Collection Summary ($selectedMonth)",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            color = Color.White
                        )
                        Spacer(modifier = Modifier.height(12.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            SummaryPill(
                                label = "Collected",
                                amount = "RM %.2f".format(totalPaid),
                                color = Emerald600,
                                bgColor = Emerald100,
                                modifier = Modifier.weight(1f)
                            )
                            SummaryPill(
                                label = "Pending",
                                amount = "RM %.2f".format(totalPending),
                                color = Gold600,
                                bgColor = Gold100,
                                modifier = Modifier.weight(1f)
                            )
                            SummaryPill(
                                label = "Overdue",
                                amount = "RM %.2f".format(totalOverdue),
                                color = Crimson600,
                                bgColor = Crimson100,
                                modifier = Modifier.weight(1f)
                            )
                        }
                    }
                }
            }

            // Filters Row
            item {
                Column {
                    Text("Filter Status:", style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold, color = Slate700)
                    Spacer(modifier = Modifier.height(6.dp))
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        item {
                            FilterChip(
                                selected = selectedStatusFilter == null,
                                onClick = { selectedStatusFilter = null },
                                label = { Text("All Statuses (${allInvoices.size})") }
                            )
                        }
                        items(InvoiceStatus.entries) { st ->
                            FilterChip(
                                selected = selectedStatusFilter == st,
                                onClick = { selectedStatusFilter = st },
                                label = { Text(st.label) }
                            )
                        }
                    }
                }
            }

            // Invoices List
            if (filteredInvoices.isEmpty()) {
                item {
                    Box(modifier = Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) {
                        Text("No invoices match the selected filter.", style = MaterialTheme.typography.bodyMedium, color = Slate600)
                    }
                }
            } else {
                items(filteredInvoices, key = { it.id }) { inv ->
                    InvoiceRowCard(
                        invoice = inv,
                        canManage = currentUser?.role == UserRole.ADMIN || currentUser?.role == UserRole.COACH,
                        onRecordPayment = { selectedInvoiceForPayment = inv },
                        onViewReceipt = { payment -> selectedReceiptForView = inv to payment }
                    )
                }
            }
        }
    }

    if (showGenerateDialog) {
        GenerateInvoicesDialog(
            defaultMonth = currentMonth,
            onDismiss = { showGenerateDialog = false },
            onGenerate = { month ->
                viewModel.generateMonthlyInvoices(month) {
                    showGenerateDialog = false
                }
            }
        )
    }

    selectedInvoiceForPayment?.let { inv ->
        RecordPaymentDialog(
            invoice = inv,
            onDismiss = { selectedInvoiceForPayment = null },
            onRecord = { amount, method, notes ->
                viewModel.recordPayment(inv.id, amount, method, notes) {
                    selectedInvoiceForPayment = null
                }
            }
        )
    }

    selectedReceiptForView?.let { (inv, p) ->
        ReceiptDialog(invoice = inv, payment = p, onDismiss = { selectedReceiptForView = null })
    }
}

@Composable
fun InvoiceRowCard(
    invoice: InvoiceWithStudent,
    canManage: Boolean,
    onRecordPayment: () -> Unit,
    onViewReceipt: (PaymentWithReceipt) -> Unit
) {
    Card(
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
        modifier = Modifier.fillMaxWidth().testTag("invoice_card_${invoice.id}")
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(invoice.studentName, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                    Text("Parent: ${invoice.parentName} (${invoice.billingMonth})", style = MaterialTheme.typography.bodySmall, color = Slate600)
                }

                val (bg, txt) = when (invoice.status) {
                    InvoiceStatus.PAID -> Emerald100 to Emerald600
                    InvoiceStatus.PENDING_APPROVAL -> Gold100 to Gold600
                    InvoiceStatus.UNPAID -> Crimson100 to Crimson600
                    InvoiceStatus.OVERDUE -> Crimson100 to Crimson600
                    InvoiceStatus.WAIVED -> Slate200 to Slate700
                }
                StatusBadge(statusText = invoice.status.label, backgroundColor = bg, textColor = txt)
            }

            Spacer(modifier = Modifier.height(10.dp))
            HorizontalDivider(color = Slate100)
            Spacer(modifier = Modifier.height(8.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    if (invoice.discountAmount > 0) {
                        Text(
                            text = "Base: RM %.2f (-RM %.2f Sibling Disc)".format(invoice.amount, invoice.discountAmount),
                            style = MaterialTheme.typography.labelSmall,
                            color = Slate600
                        )
                    }
                    Text(
                        text = "Net Due: RM %.2f".format(invoice.netAmount),
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = Navy900
                    )
                }

                if (canManage && (invoice.status == InvoiceStatus.UNPAID || invoice.status == InvoiceStatus.OVERDUE || invoice.status == InvoiceStatus.PENDING_APPROVAL)) {
                    Button(
                        onClick = onRecordPayment,
                        colors = ButtonDefaults.buttonColors(containerColor = Navy800),
                        shape = RoundedCornerShape(8.dp),
                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp),
                        modifier = Modifier.testTag("record_payment_button_${invoice.id}")
                    ) {
                        Icon(Icons.Default.Payment, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            if (invoice.status == InvoiceStatus.PENDING_APPROVAL) "Review Claim" else "Record Pay",
                            style = MaterialTheme.typography.labelMedium
                        )
                    }
                } else if (invoice.status == InvoiceStatus.PAID && invoice.payments.isNotEmpty()) {
                    OutlinedButton(
                        onClick = { onViewReceipt(invoice.payments.last()) },
                        shape = RoundedCornerShape(8.dp),
                        contentPadding = PaddingValues(horizontal = 10.dp, vertical = 2.dp),
                        modifier = Modifier.testTag("view_receipt_button_${invoice.id}")
                    ) {
                        Icon(Icons.Default.Receipt, contentDescription = null, modifier = Modifier.size(14.dp), tint = Navy800)
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Receipt", style = MaterialTheme.typography.labelSmall, color = Navy800)
                    }
                }
            }
        }
    }
}

@Composable
fun GenerateInvoicesDialog(
    defaultMonth: String,
    onDismiss: () -> Unit,
    onGenerate: (month: String) -> Unit
) {
    var month by remember { mutableStateOf(defaultMonth) }

    Dialog(onDismissRequest = onDismiss) {
        Card(
            shape = RoundedCornerShape(20.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
            modifier = Modifier.fillMaxWidth().padding(8.dp)
        ) {
            Column(modifier = Modifier.padding(20.dp)) {
                Text("Generate Monthly Invoices", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, color = Navy800)
                Spacer(modifier = Modifier.height(10.dp))
                Text(
                    "Generates unpaid invoices for all active and trial students for the selected month. Automatically applies a 10% Sibling Discount to 2nd and subsequent siblings sharing the same guardian.",
                    style = MaterialTheme.typography.bodySmall,
                    color = Slate700
                )
                Spacer(modifier = Modifier.height(14.dp))

                OutlinedTextField(
                    value = month,
                    onValueChange = { month = it },
                    label = { Text("Billing Month (YYYY-MM)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth().testTag("billing_month_input")
                )

                Spacer(modifier = Modifier.height(16.dp))

                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                    TextButton(onClick = onDismiss) { Text("Cancel") }
                    Spacer(modifier = Modifier.width(8.dp))
                    Button(
                        onClick = { onGenerate(month.trim()) },
                        colors = ButtonDefaults.buttonColors(containerColor = Navy800),
                        modifier = Modifier.testTag("confirm_generate_invoices_button")
                    ) {
                        Text("Generate")
                    }
                }
            }
        }
    }
}

@Composable
fun RecordPaymentDialog(
    invoice: InvoiceWithStudent,
    onDismiss: () -> Unit,
    onRecord: (amount: Double, method: PaymentMethod, notes: String) -> Unit
) {
    var amount by remember { mutableStateOf(invoice.netAmount.toString()) }
    var selectedMethod by remember { mutableStateOf(PaymentMethod.CASH) }
    var notes by remember { mutableStateOf("Paid in person during class") }

    Dialog(onDismissRequest = onDismiss) {
        Card(
            shape = RoundedCornerShape(20.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
            modifier = Modifier.fillMaxWidth().padding(8.dp)
        ) {
            Column(modifier = Modifier.padding(20.dp)) {
                Text("Record Payment & Issue Receipt", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, color = Navy800)
                Spacer(modifier = Modifier.height(6.dp))
                Text("Student: ${invoice.studentName} (${invoice.billingMonth})", style = MaterialTheme.typography.bodySmall, color = Slate600)

                Spacer(modifier = Modifier.height(12.dp))

                OutlinedTextField(
                    value = amount,
                    onValueChange = { amount = it },
                    label = { Text("Amount (RM)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                Spacer(modifier = Modifier.height(10.dp))

                Text("Payment Method", style = MaterialTheme.typography.bodySmall, color = Slate600)
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    PaymentMethod.entries.forEach { m ->
                        FilterChip(
                            selected = selectedMethod == m,
                            onClick = { selectedMethod = m },
                            label = { Text(m.label.split(" ")[0]) }
                        )
                    }
                }

                Spacer(modifier = Modifier.height(10.dp))

                OutlinedTextField(
                    value = notes,
                    onValueChange = { notes = it },
                    label = { Text("Receipt Remarks") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                Spacer(modifier = Modifier.height(16.dp))

                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                    TextButton(onClick = onDismiss) { Text("Cancel") }
                    Spacer(modifier = Modifier.width(8.dp))
                    Button(
                        onClick = {
                            val amt = amount.toDoubleOrNull() ?: invoice.netAmount
                            onRecord(amt, selectedMethod, notes.trim())
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = Navy800),
                        modifier = Modifier.testTag("submit_direct_payment_button")
                    ) {
                        Text("Confirm & Issue Receipt")
                    }
                }
            }
        }
    }
}

@Composable
private fun SummaryPill(
    label: String,
    amount: String,
    color: Color,
    bgColor: Color,
    modifier: Modifier = Modifier
) {
    Surface(
        color = bgColor,
        shape = RoundedCornerShape(12.dp),
        modifier = modifier
    ) {
        Column(
            modifier = Modifier.padding(10.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(label, style = MaterialTheme.typography.labelSmall, color = color, fontWeight = FontWeight.Bold)
            Spacer(modifier = Modifier.height(2.dp))
            Text(amount, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.ExtraBold, color = color)
        }
    }
}
