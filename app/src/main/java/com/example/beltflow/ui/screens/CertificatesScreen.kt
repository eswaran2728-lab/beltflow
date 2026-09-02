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
import com.example.beltflow.data.model.CertificateDetail
import com.example.beltflow.ui.components.*
import com.example.beltflow.ui.theme.*
import com.example.beltflow.ui.viewmodels.BeltFlowViewModel

@Composable
fun CertificatesScreen(
    viewModel: BeltFlowViewModel,
    onNavigateToVerify: () -> Unit,
    onBack: () -> Unit
) {
    val currentUser by viewModel.currentUser.collectAsState()
    val allCertificates by viewModel.allCertificates.collectAsState()

    var searchQuery by remember { mutableStateOf("") }
    var selectedCertificateForDialog by remember { mutableStateOf<CertificateDetail?>(null) }

    val filteredCertificates = allCertificates.filter { cert ->
        searchQuery.isBlank() ||
                cert.studentName.contains(searchQuery, ignoreCase = true) ||
                cert.verifyCode.contains(searchQuery, ignoreCase = true) ||
                cert.title.contains(searchQuery, ignoreCase = true)
    }

    Scaffold(
        topBar = {
            TopNavBar(
                title = "Issued Certificates",
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
            // Search Box & Verification Quick Action
            Card(
                shape = RoundedCornerShape(0.dp, 0.dp, 16.dp, 16.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    OutlinedTextField(
                        value = searchQuery,
                        onValueChange = { searchQuery = it },
                        placeholder = { Text("Search by student or code (e.g. BF-ORANGE-9821)...") },
                        leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                        trailingIcon = {
                            if (searchQuery.isNotBlank()) {
                                IconButton(onClick = { searchQuery = "" }) {
                                    Icon(Icons.Default.Clear, contentDescription = "Clear")
                                }
                            }
                        },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth().testTag("cert_search_input")
                    )

                    Spacer(modifier = Modifier.height(10.dp))

                    OutlinedButton(
                        onClick = onNavigateToVerify,
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = Navy800),
                        modifier = Modifier.fillMaxWidth().testTag("open_verify_portal_button")
                    ) {
                        Icon(Icons.Default.Verified, contentDescription = null, tint = Gold600)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Open Public Verification Portal")
                    }
                }
            }

            if (filteredCertificates.isEmpty()) {
                Box(modifier = Modifier.fillMaxSize().padding(32.dp), contentAlignment = Alignment.Center) {
                    Text("No certificates found matching your search.", style = MaterialTheme.typography.bodyMedium, color = Slate600)
                }
            } else {
                LazyColumn(
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                    modifier = Modifier.fillMaxSize()
                ) {
                    items(filteredCertificates, key = { it.id }) { cert ->
                        CertificateListItem(
                            certificate = cert,
                            onClick = { selectedCertificateForDialog = cert }
                        )
                    }
                }
            }
        }
    }

    selectedCertificateForDialog?.let { cert ->
        CertificateDialog(
            certificate = cert,
            onDismiss = { selectedCertificateForDialog = null }
        )
    }
}

@Composable
fun CertificateListItem(
    certificate: CertificateDetail,
    onClick: () -> Unit
) {
    Card(
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
        modifier = Modifier.fillMaxWidth().clickable { onClick() }.testTag("cert_item_${certificate.id}")
    ) {
        Row(
            modifier = Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Surface(
                color = Gold100,
                shape = CircleShape,
                modifier = Modifier.size(48.dp)
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(Icons.Default.WorkspacePremium, contentDescription = null, tint = Gold600, modifier = Modifier.size(28.dp))
                }
            }

            Spacer(modifier = Modifier.width(14.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(certificate.title, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                Text("Awarded to: ${certificate.studentName}", style = MaterialTheme.typography.bodySmall, color = Navy800, fontWeight = FontWeight.SemiBold)
                Spacer(modifier = Modifier.height(4.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Surface(
                        color = Slate100,
                        shape = RoundedCornerShape(4.dp)
                    ) {
                        Text(
                            text = certificate.verifyCode,
                            style = MaterialTheme.typography.labelSmall,
                            fontWeight = FontWeight.Bold,
                            color = Slate700,
                            modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp)
                        )
                    }
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(certificate.issuedAt, style = MaterialTheme.typography.labelSmall, color = Slate600)
                }
            }

            Icon(Icons.Default.ChevronRight, contentDescription = "View", tint = Slate600)
        }
    }
}
