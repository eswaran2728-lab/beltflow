package com.example.beltflow.ui.screens

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
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
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
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

    var fullName by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var passwordVisible by remember { mutableStateOf(false) }
    var phone by remember { mutableStateOf("") }
    var selectedRole by remember { mutableStateOf(UserRole.PARENT) }
    var childName by remember { mutableStateOf("") }
    var classCode by remember { mutableStateOf("") }

    var isLoading by remember { mutableStateOf(false) }
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
            Spacer(modifier = Modifier.height(20.dp))

            // App Emblem
            Surface(
                shape = CircleShape,
                color = Color.White,
                shadowElevation = 3.dp,
                border = androidx.compose.foundation.BorderStroke(1.dp, Slate200),
                modifier = Modifier.size(88.dp)
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

            Spacer(modifier = Modifier.height(4.dp))

            Text(
                text = "Martial Arts Academy & Belt Management",
                style = MaterialTheme.typography.bodyMedium,
                color = Slate500,
                textAlign = TextAlign.Center
            )

            Spacer(modifier = Modifier.height(28.dp))

            // Toggle Tab: Sign In / Register Account
            Surface(
                shape = RoundedCornerShape(12.dp),
                color = Slate100,
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(modifier = Modifier.padding(4.dp)) {
                    Surface(
                        shape = RoundedCornerShape(10.dp),
                        color = if (!isSignUp) Color.White else Color.Transparent,
                        shadowElevation = if (!isSignUp) 2.dp else 0.dp,
                        modifier = Modifier
                            .weight(1f)
                            .clickable {
                                isSignUp = false
                                errorMessage = ""
                                successMessage = ""
                            }
                            .padding(vertical = 10.dp)
                    ) {
                        Text(
                            text = "Sign In",
                            textAlign = TextAlign.Center,
                            fontWeight = if (!isSignUp) FontWeight.Bold else FontWeight.Medium,
                            color = if (!isSignUp) BrandNavy else Slate500,
                            fontSize = 15.sp
                        )
                    }

                    Surface(
                        shape = RoundedCornerShape(10.dp),
                        color = if (isSignUp) Color.White else Color.Transparent,
                        shadowElevation = if (isSignUp) 2.dp else 0.dp,
                        modifier = Modifier
                            .weight(1f)
                            .clickable {
                                isSignUp = true
                                errorMessage = ""
                                successMessage = ""
                            }
                            .padding(vertical = 10.dp)
                    ) {
                        Text(
                            text = "Register Account",
                            textAlign = TextAlign.Center,
                            fontWeight = if (isSignUp) FontWeight.Bold else FontWeight.Medium,
                            color = if (isSignUp) BrandNavy else Slate500,
                            fontSize = 15.sp
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Form Card
            BlueprintCard(
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(20.dp)) {
                    if (errorMessage.isNotBlank()) {
                        Surface(
                            color = Crimson100,
                            shape = RoundedCornerShape(8.dp),
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(bottom = 14.dp)
                        ) {
                            Row(
                                modifier = Modifier.padding(10.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Icon(
                                    Icons.Default.ErrorOutline,
                                    contentDescription = null,
                                    tint = Crimson600,
                                    modifier = Modifier.size(18.dp)
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(
                                    text = errorMessage,
                                    color = Crimson600,
                                    style = MaterialTheme.typography.bodySmall
                                )
                            }
                        }
                    }

                    if (successMessage.isNotBlank()) {
                        Surface(
                            color = Emerald100,
                            shape = RoundedCornerShape(8.dp),
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(bottom = 14.dp)
                        ) {
                            Row(
                                modifier = Modifier.padding(10.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Icon(
                                    Icons.Default.CheckCircleOutline,
                                    contentDescription = null,
                                    tint = Emerald600,
                                    modifier = Modifier.size(18.dp)
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(
                                    text = successMessage,
                                    color = Emerald600,
                                    style = MaterialTheme.typography.bodySmall
                                )
                            }
                        }
                    }

                    if (!isSignUp) {
                        // Sign In Form
                        Text(
                            text = "Welcome Back",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            color = BrandNavy
                        )
                        Text(
                            text = "Enter your academy credentials to sign in",
                            style = MaterialTheme.typography.bodySmall,
                            color = Slate500,
                            modifier = Modifier.padding(bottom = 16.dp)
                        )

                        OutlinedTextField(
                            value = email,
                            onValueChange = { email = it; errorMessage = "" },
                            label = { Text("Email Address") },
                            placeholder = { Text("eswaran2728@gmail.com") },
                            leadingIcon = { Icon(Icons.Default.Email, contentDescription = null) },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                            singleLine = true,
                            modifier = Modifier
                                .fillMaxWidth()
                                .testTag("login_email_input")
                        )

                        Spacer(modifier = Modifier.height(14.dp))

                        OutlinedTextField(
                            value = password,
                            onValueChange = { password = it; errorMessage = "" },
                            label = { Text("Password") },
                            leadingIcon = { Icon(Icons.Default.Lock, contentDescription = null) },
                            trailingIcon = {
                                IconButton(onClick = { passwordVisible = !passwordVisible }) {
                                    Icon(
                                        imageVector = if (passwordVisible) Icons.Default.Visibility else Icons.Default.VisibilityOff,
                                        contentDescription = if (passwordVisible) "Hide password" else "Show password"
                                    )
                                }
                            },
                            visualTransformation = if (passwordVisible) VisualTransformation.None else PasswordVisualTransformation(),
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                            singleLine = true,
                            modifier = Modifier
                                .fillMaxWidth()
                                .testTag("login_password_input")
                        )

                        Spacer(modifier = Modifier.height(20.dp))

                        Button(
                            onClick = {
                                if (email.isBlank()) {
                                    errorMessage = "Please enter your email address."
                                } else if (password.isBlank()) {
                                    errorMessage = "Please enter your password."
                                } else {
                                    isLoading = true
                                    errorMessage = ""
                                    viewModel.login(email.trim(), password.trim()) { result ->
                                        isLoading = false
                                        result.onSuccess { user ->
                                            onAuthSuccess(user.role)
                                        }.onFailure { err ->
                                            errorMessage = err.message ?: "Sign in failed. Please check credentials."
                                        }
                                    }
                                }
                            },
                            enabled = !isLoading,
                            colors = ButtonDefaults.buttonColors(containerColor = BrandNavy),
                            shape = RoundedCornerShape(10.dp),
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(50.dp)
                                .testTag("login_submit_button")
                        ) {
                            if (isLoading) {
                                CircularProgressIndicator(
                                    color = Color.White,
                                    modifier = Modifier.size(22.dp),
                                    strokeWidth = 2.dp
                                )
                            } else {
                                Text(
                                    "Sign In",
                                    fontSize = 15.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }
                    } else {
                        // Registration Form
                        Text(
                            text = "Create Academy Account",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            color = BrandNavy
                        )
                        Text(
                            text = "Register as a Parent, Student, or Coach",
                            style = MaterialTheme.typography.bodySmall,
                            color = Slate500,
                            modifier = Modifier.padding(bottom = 16.dp)
                        )

                        OutlinedTextField(
                            value = fullName,
                            onValueChange = { fullName = it; errorMessage = "" },
                            label = { Text("Full Name *") },
                            placeholder = { Text("e.g. Master Eswaran") },
                            leadingIcon = { Icon(Icons.Default.Person, contentDescription = null) },
                            singleLine = true,
                            modifier = Modifier
                                .fillMaxWidth()
                                .testTag("signup_name_input")
                        )

                        Spacer(modifier = Modifier.height(12.dp))

                        OutlinedTextField(
                            value = email,
                            onValueChange = { email = it; errorMessage = "" },
                            label = { Text("Email Address *") },
                            placeholder = { Text("eswaran2728@gmail.com") },
                            leadingIcon = { Icon(Icons.Default.Email, contentDescription = null) },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                            singleLine = true,
                            modifier = Modifier
                                .fillMaxWidth()
                                .testTag("signup_email_input")
                        )

                        Spacer(modifier = Modifier.height(12.dp))

                        OutlinedTextField(
                            value = password,
                            onValueChange = { password = it; errorMessage = "" },
                            label = { Text("Password *") },
                            leadingIcon = { Icon(Icons.Default.Lock, contentDescription = null) },
                            trailingIcon = {
                                IconButton(onClick = { passwordVisible = !passwordVisible }) {
                                    Icon(
                                        imageVector = if (passwordVisible) Icons.Default.Visibility else Icons.Default.VisibilityOff,
                                        contentDescription = if (passwordVisible) "Hide password" else "Show password"
                                    )
                                }
                            },
                            visualTransformation = if (passwordVisible) VisualTransformation.None else PasswordVisualTransformation(),
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                            singleLine = true,
                            modifier = Modifier
                                .fillMaxWidth()
                                .testTag("signup_password_input")
                        )

                        Spacer(modifier = Modifier.height(12.dp))

                        OutlinedTextField(
                            value = phone,
                            onValueChange = { phone = it },
                            label = { Text("Phone Number") },
                            placeholder = { Text("+60 12-345 6789") },
                            leadingIcon = { Icon(Icons.Default.Phone, contentDescription = null) },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )

                        Spacer(modifier = Modifier.height(14.dp))

                        Text(
                            "Select Account Role:",
                            style = MaterialTheme.typography.labelMedium,
                            color = BrandNavy,
                            fontWeight = FontWeight.SemiBold
                        )
                        Spacer(modifier = Modifier.height(6.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            listOf(UserRole.PARENT, UserRole.STUDENT, UserRole.COACH).forEach { role ->
                                FilterChip(
                                    selected = selectedRole == role,
                                    onClick = { selectedRole = role },
                                    label = { Text(role.label.split("/")[0].trim()) },
                                    modifier = Modifier.weight(1f).testTag("role_chip_${role.name}")
                                )
                            }
                        }

                        if (selectedRole == UserRole.PARENT) {
                            Spacer(modifier = Modifier.height(12.dp))
                            OutlinedTextField(
                                value = childName,
                                onValueChange = { childName = it },
                                label = { Text("Child's Full Name") },
                                placeholder = { Text("e.g. Aryan Suresh") },
                                leadingIcon = { Icon(Icons.Default.ChildCare, contentDescription = null) },
                                singleLine = true,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .testTag("signup_child_name_input")
                            )
                        }

                        Spacer(modifier = Modifier.height(12.dp))

                        OutlinedTextField(
                            value = classCode,
                            onValueChange = { classCode = it },
                            label = { Text("Class Registration Code (Optional)") },
                            placeholder = { Text("e.g. NIL101, SEP202") },
                            supportingText = { Text("Provided by your coach for auto-assignment") },
                            leadingIcon = { Icon(Icons.Default.QrCode, contentDescription = null) },
                            singleLine = true,
                            modifier = Modifier
                                .fillMaxWidth()
                                .testTag("signup_class_code_input")
                        )

                        Spacer(modifier = Modifier.height(20.dp))

                        Button(
                            onClick = {
                                if (fullName.isBlank() || email.isBlank() || password.isBlank()) {
                                    errorMessage = "Please fill in Full Name, Email, and Password."
                                } else {
                                    isLoading = true
                                    errorMessage = ""
                                    viewModel.signup(
                                        fullName = fullName.trim(),
                                        email = email.trim(),
                                        password = password.trim(),
                                        phone = phone.trim(),
                                        role = selectedRole,
                                        childName = childName.trim(),
                                        classCode = classCode.trim()
                                    ) { result ->
                                        isLoading = false
                                        result.onSuccess {
                                            if (email.trim().equals("eswaran2728@gmail.com", ignoreCase = true)) {
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
                            enabled = !isLoading,
                            colors = ButtonDefaults.buttonColors(containerColor = BrandNavy),
                            shape = RoundedCornerShape(10.dp),
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(50.dp)
                                .testTag("signup_submit_button")
                        ) {
                            if (isLoading) {
                                CircularProgressIndicator(
                                    color = Color.White,
                                    modifier = Modifier.size(22.dp),
                                    strokeWidth = 2.dp
                                )
                            } else {
                                Text(
                                    "Register Account",
                                    fontSize = 15.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(20.dp))

            // Public Verification link
            OutlinedButton(
                onClick = onVerifyCertClick,
                colors = ButtonDefaults.outlinedButtonColors(contentColor = BrandNavy),
                border = androidx.compose.foundation.BorderStroke(1.dp, Slate300),
                shape = RoundedCornerShape(10.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(48.dp)
                    .testTag("public_verify_cert_button")
            ) {
                Icon(Icons.Default.Verified, contentDescription = null, tint = AccentAmber700)
                Spacer(modifier = Modifier.width(8.dp))
                Text("Public Certificate Verification Portal", fontWeight = FontWeight.Medium)
            }

            Spacer(modifier = Modifier.height(20.dp))
        }
    }

    if (showPendingDialog) {
        AlertDialog(
            onDismissRequest = { showPendingDialog = false },
            icon = {
                Icon(
                    Icons.Default.HourglassEmpty,
                    contentDescription = null,
                    tint = AccentAmber700,
                    modifier = Modifier.size(40.dp)
                )
            },
            title = {
                Text(
                    "Registration Submitted",
                    textAlign = TextAlign.Center,
                    color = BrandNavy,
                    fontWeight = FontWeight.Bold
                )
            },
            text = {
                Text(
                    "Your registration has been submitted and is awaiting approval by the academy administrator (Master Eswaran). You will be notified once activated.",
                    textAlign = TextAlign.Center,
                    color = Slate600
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        showPendingDialog = false
                        isSignUp = false
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = BrandNavy)
                ) {
                    Text("Return to Sign In")
                }
            }
        )
    }
}

