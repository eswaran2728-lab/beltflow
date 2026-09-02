package com.example.beltflow.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.beltflow.data.model.CertificateDetail
import com.example.beltflow.ui.theme.*
import com.example.beltflow.ui.viewmodels.BeltFlowViewModel
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun VerifyCertScreen(
    viewModel: BeltFlowViewModel,
    onBack: () -> Unit
) {
    var verifyCodeInput by remember { mutableStateOf("BF-ORANGE-9821") }
    var verifiedCert by remember { mutableStateOf<CertificateDetail?>(null) }
    var hasSearched by remember { mutableStateOf(false) }
    var isLoading by remember { mutableStateOf(false) }

    val scope = rememberCoroutineScope()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Public Certificate Verification", fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = Navy800,
                    titleContentColor = Color.White,
                    navigationIconContentColor = Color.White
                )
            )
        },
        containerColor = MaterialTheme.colorScheme.background
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Card(
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(20.dp)) {
                    Text(
                        text = "Verify Authentic Martial Arts Credentials",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = Navy800
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "Enter the unique Certificate Verification Code printed on physical credentials or displayed in the BeltFlow app.",
                        style = MaterialTheme.typography.bodySmall,
                        color = Slate600
                    )

                    Spacer(modifier = Modifier.height(16.dp))

                    OutlinedTextField(
                        value = verifyCodeInput,
                        onValueChange = { verifyCodeInput = it },
                        label = { Text("Verification Code") },
                        placeholder = { Text("e.g. BF-ORANGE-9821, BF-YELLOW-1042") },
                        leadingIcon = { Icon(Icons.Default.VerifiedUser, contentDescription = null, tint = Gold600) },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth().testTag("verify_code_input_field")
                    )

                    Spacer(modifier = Modifier.height(16.dp))

                    Button(
                        onClick = {
                            if (verifyCodeInput.isNotBlank()) {
                                isLoading = true
                                scope.launch {
                                    verifiedCert = viewModel.verifyCertificate(verifyCodeInput.trim())
                                    hasSearched = true
                                    isLoading = false
                                }
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = Navy800),
                        modifier = Modifier.fillMaxWidth().testTag("submit_verify_code_button")
                    ) {
                        if (isLoading) {
                            CircularProgressIndicator(modifier = Modifier.size(20.dp), color = Color.White)
                        } else {
                            Text("Verify Credential")
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(20.dp))

            if (hasSearched) {
                val cert = verifiedCert
                if (cert != null) {
                    // Valid Seal Certificate Card
                    Card(
                        shape = RoundedCornerShape(20.dp),
                        colors = CardDefaults.cardColors(containerColor = Slate50),
                        elevation = CardDefaults.cardElevation(defaultElevation = 6.dp),
                        modifier = Modifier.fillMaxWidth().testTag("verified_certificate_result")
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(16.dp)
                                .border(2.dp, Gold500, RoundedCornerShape(12.dp))
                                .padding(16.dp),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            // Verified Badge
                            Surface(
                                color = Emerald100,
                                shape = RoundedCornerShape(20.dp),
                                modifier = Modifier.padding(bottom = 12.dp)
                            ) {
                                Row(
                                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Icon(Icons.Default.Verified, contentDescription = null, tint = Emerald600, modifier = Modifier.size(18.dp))
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Text("OFFICIALLY VERIFIED & VALID", style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold, color = Emerald600)
                                }
                            }

                            Text(
                                text = cert.academyName.uppercase(),
                                style = MaterialTheme.typography.labelSmall,
                                fontWeight = FontWeight.Bold,
                                color = Navy800,
                                textAlign = TextAlign.Center
                            )

                            Spacer(modifier = Modifier.height(4.dp))

                            Text(
                                text = "CERTIFICATE OF ACHIEVEMENT",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.ExtraBold,
                                color = Gold600,
                                letterSpacing = 1.sp
                            )

                            Spacer(modifier = Modifier.height(12.dp))

                            Text(
                                text = "Awarded to",
                                style = MaterialTheme.typography.bodySmall,
                                fontStyle = FontStyle.Italic,
                                color = Slate600
                            )

                            Text(
                                text = cert.studentName,
                                style = MaterialTheme.typography.headlineMedium,
                                fontWeight = FontWeight.Bold,
                                color = Navy900
                            )

                            Spacer(modifier = Modifier.height(8.dp))

                            Text(
                                text = "for",
                                style = MaterialTheme.typography.bodySmall,
                                color = Slate600
                            )

                            Text(
                                text = cert.title,
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.SemiBold,
                                color = Navy700,
                                textAlign = TextAlign.Center
                            )

                            Spacer(modifier = Modifier.height(14.dp))
                            HorizontalDivider(color = Slate200)
                            Spacer(modifier = Modifier.height(10.dp))

                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Column {
                                    Text("Issue Date", style = MaterialTheme.typography.labelSmall, color = Slate600)
                                    Text(cert.issuedAt, style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.Bold)
                                }
                                Column(horizontalAlignment = Alignment.End) {
                                    Text("Certificate No.", style = MaterialTheme.typography.labelSmall, color = Slate600)
                                    Text(cert.certNo, style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.Bold)
                                }
                            }
                        }
                    }
                } else {
                    // Invalid Code
                    Card(
                        shape = RoundedCornerShape(16.dp),
                        colors = CardDefaults.cardColors(containerColor = Crimson100),
                        modifier = Modifier.fillMaxWidth().testTag("invalid_certificate_result")
                    ) {
                        Column(
                            modifier = Modifier.padding(20.dp),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Icon(Icons.Default.ErrorOutline, contentDescription = null, tint = Crimson600, modifier = Modifier.size(44.dp))
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(
                                text = "No Certificate Found",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold,
                                color = Crimson600
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = "The verification code '$verifyCodeInput' does not match any record in the BeltFlow registry. Please check the code and try again.",
                                style = MaterialTheme.typography.bodySmall,
                                color = Slate800,
                                textAlign = TextAlign.Center
                            )
                        }
                    }
                }
            }
        }
    }
}
