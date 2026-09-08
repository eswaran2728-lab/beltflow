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
import com.example.beltflow.data.model.UserRole
import com.example.beltflow.ui.components.BlueprintCard
import com.example.beltflow.ui.components.beltFlowTextFieldColors
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
        currentUser?.let { user ->
            onAuthSuccess(user.role)
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Slate900),
        contentAlignment = Alignment.Center
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            // App Branding Header
            Spacer(modifier = Modifier.height(24.dp))
            Surface(
                color = AccentAmber500,
                shape = CircleShape,
                modifier = Modifier.size(72.dp)
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(
                        Icons.Default.Shield,
                        contentDescription = null,
                        tint = Slate900,
                        modifier = Modifier.size(40.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            Text(
                text = "BELTFLOW",
                fontSize = 28.sp,
                fontWeight = FontWeight.Black,
                color = Color.White,
                letterSpacing = 3.sp
            )

            Text(
                text = "Martial Arts Academy Operations",
                fontSize = 12.sp,
                fontWeight = FontWeight.Medium,
                color = AccentAmber300,
                letterSpacing = 1.sp,
                modifier = Modifier.padding(bottom = 24.dp)
            )

            // Auth Container Card
            BlueprintCard(
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(24.dp)
                ) {
                    // Auth Mode Switcher Tabs
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(8.dp))
                            .background(Slate100)
                            .padding(4.dp)
                    ) {
                        Surface(
                            color = if (!isSignUp) Color.White else Color.Transparent,
                            shape = RoundedCornerShape(6.dp),
                            modifier = Modifier
                                .weight(1f)
                                .clickable { isSignUp = false; errorMessage = "" }
                        ) {
                            Text(
                                text = "Sign In",
                                modifier = Modifier.padding(vertical = 10.dp),
                                textAlign = TextAlign.Center,
                                fontWeight = if (!isSignUp) FontWeight.Bold else FontWeight.Medium,
                                color = if (!isSignUp) BrandNavy else Slate600
                            )
                        }

                        Surface(
                            color = if (isSignUp) Color.White else Color.Transparent,
                            shape = RoundedCornerShape(6.dp),
                            modifier = Modifier
                                .weight(1f)
                                .clickable { isSignUp = true; errorMessage = "" }
                        ) {
                            Text(
                                text = "Register",
                                modifier = Modifier.padding(vertical = 10.dp),
                                textAlign = TextAlign.Center,
                                fontWeight = if (isSignUp) FontWeight.Bold else FontWeight.Medium,
                                color = if (isSignUp) BrandNavy else Slate600
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(20.dp))

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

                    if (!isSignUp) {
                        // Sign In Form
                        Text(
                            text = "Welcome Back",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            color = BrandNavy
                        )
                        Text(
                            text = "Enter your credentials to sign in",
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
                            colors = beltFlowTextFieldColors(),
                            modifier = Modifier.fillMaxWidth()
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
                                        contentDescription = null
                                    )
                                }
                            },
                            visualTransformation = if (passwordVisible) VisualTransformation.None else PasswordVisualTransformation(),
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                            singleLine = true,
                            colors = beltFlowTextFieldColors(),
                            modifier = Modifier.fillMaxWidth()
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
                                            errorMessage = err.message ?: "Sign in failed."
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
                        ) {
                            if (isLoading) {
                                CircularProgressIndicator(
                                    color = Color.White,
                                    modifier = Modifier.size(22.dp),
                                    strokeWidth = 2.dp
                                )
                            } else {
                                Text("Sign In", fontSize = 15.sp, fontWeight = FontWeight.Bold)
                            }
                        }

                        Spacer(modifier = Modifier.height(20.dp))

                        // Fixed Administrator & Master Quick Access
                        Text(
                            text = "Fixed Accounts Quick Sign-In:",
                            style = MaterialTheme.typography.labelSmall,
                            fontWeight = FontWeight.Bold,
                            color = Slate500
                        )
                        Spacer(modifier = Modifier.height(8.dp))

                        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            // Super Admin
                            Surface(
                                color = Slate50,
                                shape = RoundedCornerShape(8.dp),
                                border = androidx.compose.foundation.BorderStroke(1.dp, Slate200),
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable {
                                        email = "eswaran2728@gmail.com"
                                        password = "password"
                                    }
                            ) {
                                Row(
                                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Icon(Icons.Default.AdminPanelSettings, contentDescription = null, tint = Crimson600, modifier = Modifier.size(16.dp))
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text("Super Admin (BeltFlow Platform)", style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold, color = Slate800)
                                        Text("eswaran2728@gmail.com", style = MaterialTheme.typography.bodySmall, color = Slate500, fontSize = 11.sp)
                                    }
                                    Text("Tap to fill", style = MaterialTheme.typography.labelSmall, color = BrandNavy, fontWeight = FontWeight.Medium)
                                }
                            }

                            // Admin Persatuan Sepang
                            Surface(
                                color = Slate50,
                                shape = RoundedCornerShape(8.dp),
                                border = androidx.compose.foundation.BorderStroke(1.dp, Slate200),
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable {
                                        email = "persatuansilambamdaerahsepang@gmail.com"
                                        password = "Mahagurusrisarumugam"
                                    }
                            ) {
                                Row(
                                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Icon(Icons.Default.MilitaryTech, contentDescription = null, tint = AccentAmber600, modifier = Modifier.size(16.dp))
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text("Admin Persatuan Silambam Daerah Sepang", style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold, color = Slate800)
                                        Text("persatuansilambamdaerahsepang@gmail.com", style = MaterialTheme.typography.bodySmall, color = Slate500, fontSize = 11.sp)
                                    }
                                    Text("Tap to fill", style = MaterialTheme.typography.labelSmall, color = BrandNavy, fontWeight = FontWeight.Medium)
                                }
                            }

                            // Master Persatuan Sepang
                            Surface(
                                color = Slate50,
                                shape = RoundedCornerShape(8.dp),
                                border = androidx.compose.foundation.BorderStroke(1.dp, Slate200),
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable {
                                        email = "master.silambamsepang@gmail.com"
                                        password = "Mahagurusrisarumugam"
                                    }
                            ) {
                                Row(
                                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Icon(Icons.Default.SportsMartialArts, contentDescription = null, tint = Indigo600, modifier = Modifier.size(16.dp))
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text("Master Silambam (Persatuan Sepang)", style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold, color = Slate800)
                                        Text("master.silambamsepang@gmail.com", style = MaterialTheme.typography.bodySmall, color = Slate500, fontSize = 11.sp)
                                    }
                                    Text("Tap to fill", style = MaterialTheme.typography.labelSmall, color = BrandNavy, fontWeight = FontWeight.Medium)
                                }
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
                            text = "Register as a Parent, Student, or Master",
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
                            colors = beltFlowTextFieldColors(),
                            modifier = Modifier.fillMaxWidth()
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
                            colors = beltFlowTextFieldColors(),
                            modifier = Modifier.fillMaxWidth()
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
                                        contentDescription = null
                                    )
                                }
                            },
                            visualTransformation = if (passwordVisible) VisualTransformation.None else PasswordVisualTransformation(),
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                            singleLine = true,
                            colors = beltFlowTextFieldColors(),
                            modifier = Modifier.fillMaxWidth()
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
                            colors = beltFlowTextFieldColors(),
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
                            listOf(UserRole.PARENT, UserRole.STUDENT, UserRole.MASTER).forEach { role ->
                                FilterChip(
                                    selected = selectedRole == role,
                                    onClick = { selectedRole = role },
                                    label = {
                                        Text(
                                            text = role.label.split("/")[0].trim(),
                                            fontWeight = if (selectedRole == role) FontWeight.Bold else FontWeight.Medium
                                        )
                                    },
                                    colors = FilterChipDefaults.filterChipColors(
                                        containerColor = Color.White,
                                        labelColor = Slate700,
                                        selectedContainerColor = AccentAmber100,
                                        selectedLabelColor = AccentAmber800
                                    ),
                                    border = FilterChipDefaults.filterChipBorder(
                                        enabled = true,
                                        selected = selectedRole == role,
                                        borderColor = Slate300,
                                        selectedBorderColor = AccentAmber600
                                    ),
                                    modifier = Modifier.weight(1f)
                                )
                            }
                        }

                        if (selectedRole == UserRole.PARENT) {
                            Spacer(modifier = Modifier.height(12.dp))
                            OutlinedTextField(
                                value = childName,
                                onValueChange = { childName = it },
                                label = { Text("Child's Full Name") },
                                placeholder = { Text("e.g. Student's Full Name") },
                                leadingIcon = { Icon(Icons.Default.ChildCare, contentDescription = null) },
                                singleLine = true,
                                colors = beltFlowTextFieldColors(),
                                modifier = Modifier.fillMaxWidth()
                            )
                        }

                        Spacer(modifier = Modifier.height(20.dp))

                        Button(
                            onClick = {
                                if (fullName.isBlank() || email.isBlank() || password.isBlank()) {
                                    errorMessage = "Please fill in Full Name, Email, and Password."
                                } else {
                                    isLoading = true
                                    errorMessage = ""
                                    viewModel.registerUser(
                                        fullName = fullName.trim(),
                                        email = email.trim(),
                                        phone = phone.trim(),
                                        role = selectedRole,
                                        childName = childName.trim(),
                                        assignedClass = classCode.trim(),
                                        password = password.trim()
                                    ) { result ->
                                        isLoading = false
                                        result.onSuccess {
                                            if (email.trim().equals("eswaran2728@gmail.com", ignoreCase = true)) {
                                                onAuthSuccess(UserRole.SUPER_ADMIN)
                                            } else if (email.trim().equals("persatuansilambamdaerahsepang@gmail.com", ignoreCase = true)) {
                                                onAuthSuccess(UserRole.ADMIN_PERSATUAN)
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
                        ) {
                            if (isLoading) {
                                CircularProgressIndicator(
                                    color = Color.White,
                                    modifier = Modifier.size(22.dp),
                                    strokeWidth = 2.dp
                                )
                            } else {
                                Text("Register Account", fontSize = 15.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(20.dp))

            // Public Verification link
            OutlinedButton(
                onClick = onVerifyCertClick,
                colors = ButtonDefaults.outlinedButtonColors(contentColor = Color.White),
                border = androidx.compose.foundation.BorderStroke(1.dp, Slate600),
                shape = RoundedCornerShape(10.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(48.dp)
            ) {
                Icon(Icons.Default.Verified, contentDescription = null, tint = AccentAmber300)
                Spacer(modifier = Modifier.width(8.dp))
                Text("Public Certificate Verification Portal", fontWeight = FontWeight.Medium)
            }

            Spacer(modifier = Modifier.height(20.dp))
        }
    }

    if (showPendingDialog) {
        AlertDialog(
            onDismissRequest = { showPendingDialog = false },
            containerColor = Color.White,
            titleContentColor = BrandNavy,
            textContentColor = Slate700,
            icon = {
                Icon(
                    Icons.Default.HourglassEmpty,
                    contentDescription = null,
                    tint = AccentAmber700,
                    modifier = Modifier.size(40.dp)
                )
            },
            title = {
                Text("Registration Submitted", textAlign = TextAlign.Center, fontWeight = FontWeight.Bold)
            },
            text = {
                Text(
                    "Your registration has been submitted and is awaiting approval by the academy administrator. You will be notified once activated.",
                    textAlign = TextAlign.Center,
                    color = Slate600
                )
            },
            confirmButton = {
                Button(
                    onClick = { showPendingDialog = false; isSignUp = false },
                    colors = ButtonDefaults.buttonColors(containerColor = BrandNavy)
                ) {
                    Text("OK, Back to Sign In")
                }
            }
        )
    }
}
