package com.example.beltflow.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.example.beltflow.R
import com.example.beltflow.data.model.*
import com.example.beltflow.ui.theme.*


fun parseHexColor(hex: String): Color {
    return try {
        val clean = hex.removePrefix("#")
        val colorInt = clean.toLong(16)
        if (clean.length == 6) {
            Color((0xFF000000 or colorInt).toInt())
        } else {
            Color(colorInt.toInt())
        }
    } catch (e: Exception) {
        Color(0xFF64748B)
    }
}

@Composable
fun BeltBadge(
    beltName: String,
    colorHex: String,
    modifier: Modifier = Modifier
) {
    val beltColor = parseHexColor(colorHex)
    val isLight = colorHex.equals("#FFFFFF", true) || colorHex.equals("#E2E8F0", true) || colorHex.equals("#FACC15", true)
    val textColor = if (isLight) Slate800 else Color.White

    Surface(
        color = beltColor,
        shape = RoundedCornerShape(12.dp),
        border = if (isLight) androidx.compose.foundation.BorderStroke(1.dp, Slate200) else null,
        modifier = modifier.testTag("belt_badge_$beltName")
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(8.dp)
                    .background(textColor, CircleShape)
            )
            Spacer(modifier = Modifier.width(6.dp))
            Text(
                text = beltName,
                color = textColor,
                style = MaterialTheme.typography.labelMedium,
                fontWeight = FontWeight.Bold
            )
        }
    }
}

@Composable
fun StatusBadge(
    statusText: String,
    backgroundColor: Color,
    textColor: Color,
    modifier: Modifier = Modifier
) {
    Surface(
        color = backgroundColor,
        shape = RoundedCornerShape(8.dp),
        modifier = modifier.testTag("status_badge_$statusText")
    ) {
        Text(
            text = statusText,
            color = textColor,
            style = MaterialTheme.typography.labelMedium,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
        )
    }
}

@Composable
fun StatCard(
    title: String,
    value: String,
    subtitle: String,
    icon: ImageVector,
    accentColor: Color,
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null
) {
    Card(
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
        shape = RoundedCornerShape(16.dp),
        modifier = modifier
            .then(if (onClick != null) Modifier.clickable { onClick() } else Modifier)
            .testTag("stat_card_$title")
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.titleSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Surface(
                    color = accentColor.copy(alpha = 0.15f),
                    shape = CircleShape,
                    modifier = Modifier.size(36.dp)
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(
                            imageVector = icon,
                            contentDescription = title,
                            tint = accentColor,
                            modifier = Modifier.size(20.dp)
                        )
                    }
                }
            }
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = value,
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = subtitle,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@Composable
fun SkillProgressBar(
    level: SkillLevel,
    modifier: Modifier = Modifier
) {
    val barColor = when (level) {
        SkillLevel.NOT_STARTED -> Slate200
        SkillLevel.LEARNING -> Sky600
        SkillLevel.GOOD -> Gold500
        SkillLevel.MASTERED -> Emerald600
    }

    Column(modifier = modifier) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = level.label,
                style = MaterialTheme.typography.bodySmall,
                fontWeight = FontWeight.SemiBold,
                color = if (level == SkillLevel.NOT_STARTED) Slate600 else barColor
            )
            Text(
                text = "${level.percentage}%",
                style = MaterialTheme.typography.bodySmall,
                fontWeight = FontWeight.Bold,
                color = if (level == SkillLevel.NOT_STARTED) Slate600 else barColor
            )
        }
        Spacer(modifier = Modifier.height(4.dp))
        LinearProgressIndicator(
            progress = { level.percentage / 100f },
            modifier = Modifier
                .fillMaxWidth()
                .height(8.dp)
                .clip(RoundedCornerShape(4.dp)),
            color = barColor,
            trackColor = MaterialTheme.colorScheme.surfaceVariant
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TopNavBar(
    title: String,
    currentUser: AuthUser?,
    onSwitchUser: (String) -> Unit,
    onLogout: () -> Unit,
    onNavigateToSettings: (() -> Unit)? = null,
    onBack: (() -> Unit)? = null
) {
    var showUserMenu by remember { mutableStateOf(false) }

    Surface(
        color = Color.White,
        border = BorderStroke(1.dp, Slate200),
        shadowElevation = 1.dp,
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .statusBarsPadding()
                .padding(horizontal = 16.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            if (onBack != null) {
                IconButton(
                    onClick = onBack,
                    modifier = Modifier.size(36.dp).testTag("nav_back_button")
                ) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                        contentDescription = "Back",
                        tint = BrandNavy
                    )
                }
                Spacer(modifier = Modifier.width(6.dp))
            } else {
                Image(
                    painter = painterResource(id = R.drawable.beltflow_logo),
                    contentDescription = "BeltFlow Mark",
                    modifier = Modifier
                        .size(32.dp)
                        .clip(RoundedCornerShape(8.dp))
                )
                Spacer(modifier = Modifier.width(10.dp))
            }

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = BrandNavy,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                if (currentUser != null) {
                    Text(
                        text = "${currentUser.fullName} • ${currentUser.role.label}",
                        style = MaterialTheme.typography.labelSmall,
                        color = AccentAmber700,
                        fontSize = 11.sp
                    )
                }
            }

            // Notifications Bell
            IconButton(
                onClick = { /* notification badge */ },
                modifier = Modifier.size(36.dp).testTag("notifications_bell_button")
            ) {
                Box {
                    Icon(
                        imageVector = Icons.Default.NotificationsNone,
                        contentDescription = "Notifications",
                        tint = BrandNavy,
                        modifier = Modifier.size(20.dp)
                    )
                    Box(
                        modifier = Modifier
                            .size(7.dp)
                            .background(AccentAmber500, CircleShape)
                            .align(Alignment.TopEnd)
                    )
                }
            }

            if (onNavigateToSettings != null && currentUser?.role == UserRole.ADMIN) {
                IconButton(
                    onClick = onNavigateToSettings,
                    modifier = Modifier.size(36.dp).testTag("settings_button")
                ) {
                    Icon(
                        imageVector = Icons.Default.Settings,
                        contentDescription = "Settings",
                        tint = Slate600,
                        modifier = Modifier.size(20.dp)
                    )
                }
            }

            // User Switcher Profile Avatar
            Box {
                IconButton(
                    onClick = { showUserMenu = true },
                    modifier = Modifier.size(36.dp).testTag("user_profile_menu_button")
                ) {
                    Surface(
                        shape = CircleShape,
                        color = AccentAmber100,
                        border = BorderStroke(1.dp, AccentAmber300),
                        modifier = Modifier.size(30.dp)
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Text(
                                text = currentUser?.fullName?.split(" ")?.mapNotNull { it.firstOrNull() }?.take(2)?.joinToString("") ?: "ME",
                                style = MaterialTheme.typography.labelSmall,
                                fontWeight = FontWeight.Bold,
                                color = AccentAmber800,
                                fontSize = 11.sp
                            )
                        }
                    }
                }

                DropdownMenu(
                    expanded = showUserMenu,
                    onDismissRequest = { showUserMenu = false }
                ) {
                    DropdownMenuItem(
                        text = { Text("Switch to Master Eswaran (Admin)") },
                        leadingIcon = { Icon(Icons.Default.AdminPanelSettings, contentDescription = null, tint = AccentAmber700) },
                        onClick = {
                            showUserMenu = false
                            onSwitchUser("eswaran2728@gmail.com")
                        }
                    )
                    DropdownMenuItem(
                        text = { Text("Switch to Master Ravi (Coach)") },
                        leadingIcon = { Icon(Icons.Default.SportsMartialArts, contentDescription = null, tint = Sky600) },
                        onClick = {
                            showUserMenu = false
                            onSwitchUser("ravi.silambam@gmail.com")
                        }
                    )
                    DropdownMenuItem(
                        text = { Text("Switch to Suresh Kumar (Parent)") },
                        leadingIcon = { Icon(Icons.Default.FamilyRestroom, contentDescription = null, tint = Emerald600) },
                        onClick = {
                            showUserMenu = false
                            onSwitchUser("suresh.parent@gmail.com")
                        }
                    )
                    DropdownMenuItem(
                        text = { Text("Switch to Aryan Suresh (Student)") },
                        leadingIcon = { Icon(Icons.Default.School, contentDescription = null, tint = Purple600) },
                        onClick = {
                            showUserMenu = false
                            onSwitchUser("aryan.suresh@gmail.com")
                        }
                    )
                    HorizontalDivider()
                    DropdownMenuItem(
                        text = { Text("Sign Out / Switch Role Screen", color = Crimson600) },
                        leadingIcon = { Icon(Icons.Default.Logout, contentDescription = null, tint = Crimson600) },
                        onClick = {
                            showUserMenu = false
                            onLogout()
                        }
                    )
                }
            }
        }
    }
}


@Composable
fun CertificateDialog(
    certificate: CertificateDetail,
    onDismiss: () -> Unit
) {
    Dialog(onDismissRequest = onDismiss) {
        Card(
            shape = RoundedCornerShape(20.dp),
            colors = CardDefaults.cardColors(containerColor = Slate50),
            elevation = CardDefaults.cardElevation(defaultElevation = 8.dp),
            modifier = Modifier
                .fillMaxWidth()
                .padding(8.dp)
                .testTag("certificate_dialog")
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(20.dp)
                    .border(2.dp, Gold500, RoundedCornerShape(12.dp))
                    .padding(16.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                // Academy Emblem
                Surface(
                    shape = CircleShape,
                    color = Navy800,
                    modifier = Modifier.size(56.dp)
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(
                            imageVector = Icons.Default.WorkspacePremium,
                            contentDescription = "Seal",
                            tint = Gold500,
                            modifier = Modifier.size(36.dp)
                        )
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))

                Text(
                    text = certificate.academyName.uppercase(),
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

                Spacer(modifier = Modifier.height(16.dp))

                Text(
                    text = "This is proudly presented to",
                    style = MaterialTheme.typography.bodySmall,
                    fontStyle = FontStyle.Italic,
                    color = Slate600
                )

                Spacer(modifier = Modifier.height(6.dp))

                Text(
                    text = certificate.studentName,
                    style = MaterialTheme.typography.headlineMedium,
                    fontWeight = FontWeight.Bold,
                    color = Navy900
                )

                Spacer(modifier = Modifier.height(8.dp))

                Text(
                    text = "for successfully accomplishing",
                    style = MaterialTheme.typography.bodySmall,
                    color = Slate600
                )

                Spacer(modifier = Modifier.height(4.dp))

                Text(
                    text = certificate.title,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                    color = Navy700,
                    textAlign = TextAlign.Center
                )

                Spacer(modifier = Modifier.height(16.dp))
                HorizontalDivider(color = Slate200)
                Spacer(modifier = Modifier.height(12.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Column {
                        Text("Issue Date", style = MaterialTheme.typography.labelSmall, color = Slate600)
                        Text(certificate.issuedAt, style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.Bold)
                    }
                    Column(horizontalAlignment = Alignment.End) {
                        Text("Certificate No.", style = MaterialTheme.typography.labelSmall, color = Slate600)
                        Text(certificate.certNo, style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.Bold)
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))

                // Verification Stamp
                Surface(
                    color = Gold100,
                    shape = RoundedCornerShape(8.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier.padding(8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.Center
                    ) {
                        Icon(Icons.Default.Verified, contentDescription = "Verified", tint = Gold600, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = "Verify Code: ${certificate.verifyCode}",
                            style = MaterialTheme.typography.labelMedium,
                            fontWeight = FontWeight.Bold,
                            color = Gold600
                        )
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                Button(
                    onClick = onDismiss,
                    colors = ButtonDefaults.buttonColors(containerColor = Navy800),
                    modifier = Modifier.fillMaxWidth().testTag("close_certificate_button")
                ) {
                    Text("Close")
                }
            }
        }
    }
}

@Composable
fun ReceiptDialog(
    invoice: InvoiceWithStudent,
    payment: PaymentWithReceipt,
    onDismiss: () -> Unit
) {
    Dialog(onDismissRequest = onDismiss) {
        Card(
            shape = RoundedCornerShape(20.dp),
            colors = CardDefaults.cardColors(containerColor = Color.White),
            elevation = CardDefaults.cardElevation(defaultElevation = 8.dp),
            modifier = Modifier
                .fillMaxWidth()
                .padding(8.dp)
                .testTag("receipt_dialog")
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(20.dp)
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column {
                        Text(
                            text = "OFFICIAL RECEIPT",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            color = Navy800
                        )
                        Text(
                            text = "Persatuan Silambam Malaysia Daerah Sepang",
                            style = MaterialTheme.typography.labelSmall,
                            color = Slate600
                        )
                    }
                    Surface(
                        color = Emerald100,
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Text(
                            text = "PAID",
                            color = Emerald600,
                            fontWeight = FontWeight.Bold,
                            style = MaterialTheme.typography.labelMedium,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                        )
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))
                HorizontalDivider(color = Slate200)
                Spacer(modifier = Modifier.height(12.dp))

                ReceiptRow(label = "Receipt Number", value = payment.receiptNo ?: "BF-PENDING")
                ReceiptRow(label = "Student Name", value = invoice.studentName)
                ReceiptRow(label = "Payer", value = invoice.parentName)
                ReceiptRow(label = "Billing Month", value = invoice.billingMonth)
                ReceiptRow(label = "Payment Method", value = payment.method.label)
                ReceiptRow(
                    label = "Amount Paid",
                    value = "RM %.2f".format(payment.amount),
                    isBold = true
                )

                if (payment.notes.isNotBlank()) {
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "Notes: ${payment.notes}",
                        style = MaterialTheme.typography.bodySmall,
                        color = Slate600
                    )
                }

                Spacer(modifier = Modifier.height(20.dp))

                Button(
                    onClick = onDismiss,
                    colors = ButtonDefaults.buttonColors(containerColor = Navy800),
                    modifier = Modifier.fillMaxWidth().testTag("close_receipt_button")
                ) {
                    Text("Close Receipt")
                }
            }
        }
    }
}

@Composable
private fun ReceiptRow(label: String, value: String, isBold: Boolean = false) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(text = label, style = MaterialTheme.typography.bodyMedium, color = Slate600)
        Text(
            text = value,
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = if (isBold) FontWeight.Bold else FontWeight.Medium,
            color = if (isBold) Emerald600 else Navy900
        )
    }
}
