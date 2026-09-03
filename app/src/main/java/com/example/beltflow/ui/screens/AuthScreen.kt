package com.example.beltflow.ui.screens

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.beltflow.R
import com.example.beltflow.data.model.ProfileStatus
import com.example.beltflow.data.model.UserRole
import com.example.beltflow.ui.components.BlueprintCard
import com.example.beltflow.ui.theme.*
import com.example.beltflow.ui.viewmodels.BeltFlowViewModel

@Composable
fun AuthScreen(
    viewModel: BeltFlowViewModel,
    onAuthSuccess: (UserRole) -> Unit,
    onVerifyCertClick: () -> Unit
) {
    var isSignUp by remember { mutableStateOf(false) }
    var selectedDemoEmail by remember { mutableStateOf("eswaran2728@gmail.com") }

    var fullName by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }
    var selectedRole by remember { mutableStateOf(UserRole.PARENT) }
    var childName by remember { mutableStateOf("") }
    var classCode by remember { mutableStateOf("") }

    var errorMessage by remember { mutableStateOf("") }
    var successMessage by remember { mutableStateOf("") }
    var showPendingDialog by remember { mutableStateOf(false) }

    val currentUser by viewModel.currentUser.collectAsState()

    LaunchedEffect(currentUser) {
        val user = currentUser
        if (user != null) {
            if (user.status == ProfileStatus.APPROVED) {
                onAuthSuccess(user.role)
            } else if (user.status == ProfileStatus.PENDING) {
                showPendingDialog = true
            }
        }
    }

    Scaffold(
        containerColor = BlueprintBg
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 24.dp, vertical = 20.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Spacer(modifier = Modifier.height(16.dp))

            // App Emblem
            Surface(
                shape = CircleShape,
                color = Color.White,
                shadowElevation = 3.dp,
                border = androidx.compose.foundation.BorderStroke(1.dp, Slate200),
                modifier = Modifier.size(80.dp)
            ) {
                Box(contentAlignment = Alignment.Center, modifier = Modifier.padding(6.dp)) {
                    Image(
                        painter = painterResource(id = R.drawable.beltflow_logo),
                        contentDescription = "BeltFlow Logo",
                        modifier = Modifier.fillMaxSize()
                    )
                }
            }

            Spacer(modifier = Modifier.height(14.dp))

            Text(
                text = "BeltFlow",
                style = MaterialTheme.typography.headlineLarge,
                fontWeight = FontWeight.Bold,
                color = BrandNavy,
                letterSpacing = 0.5.sp
            )

            Spacer(modifier = Modifier.height(2.dp))

            Text(
                text = "Martial Arts Academy & Belt Management",
                style = MaterialTheme.typography.bodyMedium,
                color = Slate500,
                textAlign = TextAlign.Center
            )

            Spacer(modifier = Modifier.height(24.dp))

            // Fast Demo Role Switcher Card in Blueprint style
            BlueprintCard(
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag("fast_demo_login_card")
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(
                            text = "INSTANT DEMO SIGN-IN",
                            style = MaterialTheme.typography.labelSmall,
                            fontWeight = FontWeight.Bold,
                            color = AccentAmber700,
                            letterSpacing = 0.8.sp
                        )
                        Surface(
                            shape = CircleShape,
                            color = AccentAmber100,
                            modifier = Modifier.size(20.dp)
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Icon(
                                    Icons.Default.Bolt,
                                    contentDescription = null,
                                    tint = AccentAmber700,
                                    modifier = Modifier.size(14.dp)
                                )
                            }
                        }
                    }

                    Text(
                        text = "Select any persona to immediately enter its portal:",
                        style = MaterialTheme.typography.bodySmall,
                        color = Slate500,
                        modifier = Modifier.padding(top = 2.dp, bottom = 12.dp)
                    )

                    DemoAccountRow(
                        name = "Master Eswaran",
                        roleLabel = "Founder & Admin",
                        email = "eswaran2728@gmail.com",
                        color = AccentAmber700,
                        icon = Icons.Default.AdminPanelSettings,
                        isSelected = selectedDemoEmail == "eswaran2728@gmail.com",
                        onClick = {
                            selectedDemoEmail = "eswaran2728@gmail.com"
                            viewModel.loginAs("eswaran2728@gmail.com") { success ->
                                if (success) onAuthSuccess(UserRole.ADMIN)
                            }
                        }
                    )

                    Spacer(modifier = Modifier.height(8.dp))

                    DemoAccountRow(
                        name = "Master Ravi",
                        roleLabel = "Head Coach",
                        email = "ravi.silambam@gmail.com",
                        color = Sky600,
                        icon = Icons.Default.SportsMartialArts,
                        isSelected = selectedDemoEmail == "ravi.silambam@gmail.com",
                        onClick = {
                            selectedDemoEmail = "ravi.silambam@gmail.com"
                            viewModel.loginAs("ravi.silambam@gmail.com") { success ->
                                if (success) onAuthSuccess(UserRole.COACH)
                            }
                        }
                    )

                    Spacer(modifier = Modifier.height(8.dp))

                    DemoAccountRow(
                        name = "Suresh Kumar",
                        roleLabel = "Parent (Aryan & Tharun)",
                        email = "suresh.parent@gmail.com",
                        color = Emerald600,
                        icon = Icons.Default.FamilyRestroom,
                        isSelected = selectedDemoEmail == "suresh.parent@gmail.com",
                        onClick = {
                            selectedDemoEmail = "suresh.parent@gmail.com"
                            viewModel.loginAs("suresh.parent@gmail.com") { success ->
                                if (success) onAuthSuccess(UserRole.PARENT)
                            }
                        }
                    )

                    Spacer(modifier = Modifier.height(8.dp))

                    DemoAccountRow(
                        name = "Aryan Suresh",
                        roleLabel = "Student (Orange Belt)",
                        email = "aryan.suresh@gmail.com",
                        color = Purple600,
                        icon = Icons.Default.School,
                        isSelected = selectedDemoEmail == "aryan.suresh@gmail.com",
                        onClick = {
                            selectedDemoEmail = "aryan.suresh@gmail.com"
                            viewModel.loginAs("aryan.suresh@gmail.com") { success ->
                                if (success) onAuthSuccess(UserRole.STUDENT)
                            }
                        }
                    )
                }
            }

            Spacer(modifier = Modifier.height(20.dp))

            // Toggle Tab: Sign In / Create Account
            Surface(
                shape = RoundedCornerShape(10.dp),
                color = Slate100,
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(modifier = Modifier.padding(4.dp)) {
                    Surface(
                        shape = RoundedCornerShape(8.dp),
                        color = if (!isSignUp) Color.White else Color.Transparent,
                        shadowElevation = if (!isSignUp) 1.dp else 0.dp,
                        modifier = Modifier
                            .weight(1f)
                            .clickable { isSignUp = false; errorMessage = ""; successMessage = "" }
                            .padding(vertical = 8.dp)
                    ) {
                        Text(
                            text = "Sign In",
                            textAlign = TextAlign.Center,
                            fontWeight = if (!isSignUp) FontWeight.Bold else FontWeight.Medium,
                            color = if (!isSignUp) BrandNavy else Slate500,
                            fontSize = 14.sp
                        )
                    }

                    Surface(
                        shape = RoundedCornerShape(8.dp),
                        color = if (isSignUp) Color.White else Color.Transparent,
                        shadowElevation = if (isSignUp) 1.dp else 0.dp,
                        modifier = Modifier
                            .weight(1f)
                            .clickable { isSignUp = true; errorMessage = ""; successMessage = "" }
                            .padding(vertical = 8.dp)
                    ) {
                        Text(
                            text = "Register Account",
                            textAlign = TextAlign.Center,
                            fontWeight = if (isSignUp) FontWeight.Bold else FontWeight.Medium,
                            color = if (isSignUp) BrandNavy else Slate500,
                            fontSize = 14.sp
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(14.dp))

            // Form Card in Blueprint style
            BlueprintCard(
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(18.dp)) {
                    if (errorMessage.isNotBlank()) {
                        Surface(
                            color = Crimson100,
                            shape = RoundedCornerShape(8.dp),
                            modifier = Modifier.fillMaxWidth().padding(bottom = 12.dp)
                        ) {
                            Text(
                                text = errorMessage,
                                color = Crimson600,
                                style = MaterialTheme.typography.bodySmall,
                                modifier = Modifier.padding(8.dp)
                            )
                        }
                    }

                    if (successMessage.isNotBlank()) {
                        Surface(
                            color = Emerald100,
                            shape = RoundedCornerShape(8.dp),
                            modifier = Modifier.fillMaxWidth().padding(bottom = 12.dp)
                        ) {
                            Text(
                                text = successMessage,
                                color = Emerald600,
                                style = MaterialTheme.typography.bodySmall,
                                modifier = Modifier.padding(8.dp)
                            )
                        }
                    }

                    if (!isSignUp) {
                        OutlinedTextField(
                            value = email,
                            onValueChange = { email = it },
                            label = { Text("Email Address") },
                            placeholder = { Text("e.g. eswaran2728@gmail.com") },
                            leadingIcon = { Icon(Icons.Default.Email, contentDescription = null) },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth().testTag("login_email_input")
                        )

                        Spacer(modifier = Modifier.height(16.dp))

                        Button(
                            onClick = {
                                if (email.isBlank()) {
                                    errorMessage = "Please enter your email address."
                                } else {
                                    errorMessage = ""
                                    viewModel.loginAs(email.trim()) { success ->
                                        if (!success) {
                                            errorMessage = "Account not found with this email. Please register below."
                                        }
                                    }
                                }
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = BrandNavy),
                            shape = RoundedCornerShape(8.dp),
                            modifier = Modifier.fillMaxWidth().testTag("login_submit_button")
                        ) {
                            Text("Sign In with Email", modifier = Modifier.padding(vertical = 4.dp), fontWeight = FontWeight.Bold)
                        }
                    } else {
                        // Registration Form
                        OutlinedTextField(
                            value = fullName,
                            onValueChange = { fullName = it },
                            label = { Text("Full Name") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth().testTag("signup_name_input")
                        )

                        Spacer(modifier = Modifier.height(10.dp))

                        OutlinedTextField(
                            value = email,
                            onValueChange = { email = it },
                            label = { Text("Email Address") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth().testTag("signup_email_input")
                        )

                        Spacer(modifier = Modifier.height(10.dp))

                        OutlinedTextField(
                            value = phone,
                            onValueChange = { phone = it },
                            label = { Text("Phone Number") },
                            placeholder = { Text("+60 12-345 6789") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )

                        Spacer(modifier = Modifier.height(12.dp))

                        Text("Select Role:", style = MaterialTheme.typography.titleSmall, color = BrandNavy, fontWeight = FontWeight.Bold)
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            listOf(UserRole.PARENT, UserRole.STUDENT, UserRole.COACH).forEach { role ->
                                FilterChip(
                                    selected = selectedRole == role,
                                    onClick = { selectedRole = role },
                                    label = { Text(role.label.split("/")[0].trim()) },
                                    modifier = Modifier.testTag("role_chip_${role.name}")
                                )
                            }
                        }

                        if (selectedRole == UserRole.PARENT) {
                            Spacer(modifier = Modifier.height(10.dp))
                            OutlinedTextField(
                                value = childName,
                                onValueChange = { childName = it },
                                label = { Text("Child's Full Name") },
                                singleLine = true,
                                modifier = Modifier.fillMaxWidth().testTag("signup_child_name_input")
                            )
                        }

                        Spacer(modifier = Modifier.height(10.dp))

                        OutlinedTextField(
                            value = classCode,
                            onValueChange = { classCode = it },
                            label = { Text("Class Registration Code (Optional)") },
                            placeholder = { Text("e.g. NIL101, SEP202, SGP303") },
                            supportingText = { Text("Provided by your coach for auto-class assignment") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth().testTag("signup_class_code_input")
                        )

                        Spacer(modifier = Modifier.height(16.dp))

                        Button(
                            onClick = {
                                if (fullName.isBlank() || email.isBlank()) {
                                    errorMessage = "Please fill in all required fields."
                                } else {
                                    errorMessage = ""
                                    viewModel.signup(
                                        fullName = fullName.trim(),
                                        email = email.trim(),
                                        phone = phone.trim(),
                                        role = selectedRole,
                                        childName = childName.trim(),
                                        classCode = classCode.trim()
                                    ) { result ->
                                        result.onSuccess {
                                            if (email.equals("eswaran2728@gmail.com", ignoreCase = true)) {
                                                onAuthSuccess(UserRole.ADMIN)
                                            } else {
                                                showPendingDialog = true
                                                successMessage = "Account submitted for approval."
                                            }
                                        }.onFailure {
                                            errorMessage = it.message ?: "Failed to sign up."
                                        }
                                    }
                                }
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = BrandNavy),
                            shape = RoundedCornerShape(8.dp),
                            modifier = Modifier.fillMaxWidth().testTag("signup_submit_button")
                        ) {
                            Text("Submit Registration", modifier = Modifier.padding(vertical = 4.dp), fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(18.dp))

            // Public Verification link
            OutlinedButton(
                onClick = onVerifyCertClick,
                colors = ButtonDefaults.outlinedButtonColors(contentColor = BrandNavy),
                border = androidx.compose.foundation.BorderStroke(1.dp, Slate300),
                shape = RoundedCornerShape(8.dp),
                modifier = Modifier.fillMaxWidth().testTag("public_verify_cert_button")
            ) {
                Icon(Icons.Default.Verified, contentDescription = null, tint = AccentAmber700)
                Spacer(modifier = Modifier.width(8.dp))
                Text("Public Certificate Verification Portal", fontWeight = FontWeight.Medium)
            }

            Spacer(modifier = Modifier.height(16.dp))
        }
    }

    if (showPendingDialog) {
        AlertDialog(
            onDismissRequest = { showPendingDialog = false },
            icon = { Icon(Icons.Default.HourglassEmpty, contentDescription = null, tint = AccentAmber700, modifier = Modifier.size(40.dp)) },
            title = { Text("Registration Submitted", textAlign = TextAlign.Center, color = BrandNavy, fontWeight = FontWeight.Bold) },
            text = {
                Text(
                    "Your registration has been received and is currently pending review by the academy administrator (Master Eswaran). You will have full access once approved.",
                    textAlign = TextAlign.Center,
                    color = Slate600
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        showPendingDialog = false
                        viewModel.loginAs("eswaran2728@gmail.com") {
                            onAuthSuccess(UserRole.ADMIN)
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = BrandNavy)
                ) {
                    Text("Explore as Admin for Demo")
                }
            }
        )
    }
}

@Composable
private fun DemoAccountRow(
    name: String,
    roleLabel: String,
    email: String,
    color: Color,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    isSelected: Boolean,
    onClick: () -> Unit
) {
    Surface(
        color = if (isSelected) BrandNavyTint else Color.White,
        shape = RoundedCornerShape(8.dp),
        border = androidx.compose.foundation.BorderStroke(
            1.dp,
            if (isSelected) AccentAmber700 else Slate200
        ),
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onClick() }
            .testTag("demo_row_$email")
    ) {
        Row(
            modifier = Modifier.padding(10.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Surface(
                color = color.copy(alpha = 0.12f),
                shape = CircleShape,
                modifier = Modifier.size(36.dp)
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(icon, contentDescription = null, tint = color, modifier = Modifier.size(20.dp))
                }
            }
            Spacer(modifier = Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = name,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold,
                    color = BrandNavy
                )
                Text(
                    text = roleLabel,
                    style = MaterialTheme.typography.bodySmall,
                    color = Slate500
                )
            }
            Icon(Icons.Default.ChevronRight, contentDescription = null, tint = Slate400)
        }
    }
}
