package com.example.beltflow.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.MilitaryTech
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.WorkspacePremium
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.beltflow.data.model.UserRole
import com.example.beltflow.ui.theme.*

@Composable
fun RoleBadge(
    role: UserRole,
    modifier: Modifier = Modifier
) {
    val (bgColor, textColor, labelText) = when (role) {
        UserRole.SUPER_ADMIN -> Triple(Color(0xFFFEE2E2), Color(0xFFDC2626), "SUPER ADMIN")
        UserRole.ADMIN_PERSATUAN -> Triple(Color(0xFFDBEAFE), Color(0xFF2563EB), "ADMIN PERSATUAN")
        UserRole.MASTER -> Triple(Color(0xFFFEF3C7), Color(0xFFD97706), "MASTER")
        UserRole.STUDENT -> Triple(Color(0xFFD1FAE5), Color(0xFF059669), "STUDENT")
        UserRole.PARENT -> Triple(Color(0xFFF3E8FF), Color(0xFF7C3AED), "PARENT")
    }

    Surface(
        color = bgColor,
        shape = RoundedCornerShape(4.dp),
        border = BorderStroke(1.dp, textColor.copy(alpha = 0.3f)),
        modifier = modifier
    ) {
        Text(
            text = labelText,
            color = textColor,
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.5.sp,
            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
        )
    }
}

/**
 * Blueprint card with technical corner markers matching the BeltFlow Claude design.
 */
@Composable
fun BlueprintCard(
    modifier: Modifier = Modifier,
    backgroundColor: Color = Color.White,
    borderColor: Color = Slate200,
    cornerColor: Color = AccentAmber700.copy(alpha = 0.55f),
    shapeRadius: Dp = 8.dp,
    elevation: Dp = 0.dp,
    showCorners: Boolean = true,
    onClick: (() -> Unit)? = null,
    content: @Composable ColumnScope.() -> Unit
) {
    Card(
        shape = RoundedCornerShape(shapeRadius),
        colors = CardDefaults.cardColors(containerColor = backgroundColor),
        elevation = CardDefaults.cardElevation(defaultElevation = elevation),
        border = BorderStroke(1.dp, borderColor),
        modifier = modifier
            .then(if (onClick != null) Modifier.clickable { onClick() } else Modifier)
            .then(
                if (showCorners) {
                    Modifier.drawWithContent {
                        drawContent()
                        val tick = 8.dp.toPx()
                        val stroke = 1.8.dp.toPx()
                        val pad = 4.dp.toPx()

                        // Top-Left corner
                        drawLine(
                            color = cornerColor,
                            start = Offset(pad, pad),
                            end = Offset(pad + tick, pad),
                            strokeWidth = stroke,
                            cap = StrokeCap.Square
                        )
                        drawLine(
                            color = cornerColor,
                            start = Offset(pad, pad),
                            end = Offset(pad, pad + tick),
                            strokeWidth = stroke,
                            cap = StrokeCap.Square
                        )

                        // Top-Right corner
                        drawLine(
                            color = cornerColor,
                            start = Offset(size.width - pad - tick, pad),
                            end = Offset(size.width - pad, pad),
                            strokeWidth = stroke,
                            cap = StrokeCap.Square
                        )
                        drawLine(
                            color = cornerColor,
                            start = Offset(size.width - pad, pad),
                            end = Offset(size.width - pad, pad + tick),
                            strokeWidth = stroke,
                            cap = StrokeCap.Square
                        )

                        // Bottom-Left corner
                        drawLine(
                            color = cornerColor,
                            start = Offset(pad, size.height - pad),
                            end = Offset(pad + tick, size.height - pad),
                            strokeWidth = stroke,
                            cap = StrokeCap.Square
                        )
                        drawLine(
                            color = cornerColor,
                            start = Offset(pad, size.height - pad - tick),
                            end = Offset(pad, size.height - pad),
                            strokeWidth = stroke,
                            cap = StrokeCap.Square
                        )

                        // Bottom-Right corner
                        drawLine(
                            color = cornerColor,
                            start = Offset(size.width - pad - tick, size.height - pad),
                            end = Offset(size.width - pad, size.height - pad),
                            strokeWidth = stroke,
                            cap = StrokeCap.Square
                        )
                        drawLine(
                            color = cornerColor,
                            start = Offset(size.width - pad, size.height - pad - tick),
                            end = Offset(size.width - pad, size.height - pad),
                            strokeWidth = stroke,
                            cap = StrokeCap.Square
                        )
                    }
                } else Modifier
            )
    ) {
        Column(content = content)
    }
}

/**
 * Clean badge tag matching the design system (.tag .tag-accent, .tag-neutral, .tag-outline)
 */
@Composable
fun BeltFlowTag(
    text: String,
    modifier: Modifier = Modifier,
    backgroundColor: Color = AccentAmber100,
    textColor: Color = AccentAmber800,
    borderColor: Color? = null
) {
    Surface(
        color = backgroundColor,
        shape = RoundedCornerShape(4.dp),
        border = borderColor?.let { BorderStroke(1.dp, it) },
        modifier = modifier
    ) {
        Text(
            text = text,
            color = textColor,
            style = androidx.compose.material3.MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.Medium,
            modifier = Modifier.padding(horizontal = 7.dp, vertical = 3.dp)
        )
    }
}

enum class BeltFlowTab(val label: String) {
    HOME("Home"),
    STUDENTS("Students"),
    GRADING("Grading"),
    CERTIFICATES("Certificates")
}

@Composable
fun OfficialSealBadge(
    text: String = "OFF",
    modifier: Modifier = Modifier,
    accentColor: Color = AccentAmber700
) {
    Surface(
        shape = androidx.compose.foundation.shape.CircleShape,
        color = Color.Transparent,
        border = BorderStroke(1.dp, accentColor),
        modifier = modifier.size(28.dp)
    ) {
        Box(contentAlignment = androidx.compose.ui.Alignment.Center) {
            Text(
                text = text,
                color = accentColor,
                fontSize = 8.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 0.5.sp
            )
        }
    }
}

@Composable
fun BeltFlowBottomBar(
    currentTab: BeltFlowTab,
    onTabSelected: (BeltFlowTab) -> Unit,
    modifier: Modifier = Modifier
) {
    Surface(
        color = Color.White,
        border = BorderStroke(1.dp, Slate200),
        shadowElevation = 4.dp,
        modifier = modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .navigationBarsPadding()
                .padding(vertical = 6.dp),
            horizontalArrangement = Arrangement.SpaceAround,
            verticalAlignment = androidx.compose.ui.Alignment.CenterVertically
        ) {
            BeltFlowTab.values().forEach { tab ->
                val isSelected = currentTab == tab
                val color = if (isSelected) AccentAmber700 else Slate500
                val icon = when (tab) {
                    BeltFlowTab.HOME -> Icons.Default.Home
                    BeltFlowTab.STUDENTS -> Icons.Default.Person
                    BeltFlowTab.GRADING -> Icons.Default.MilitaryTech
                    BeltFlowTab.CERTIFICATES -> Icons.Default.WorkspacePremium
                }

                Column(
                    modifier = Modifier
                        .weight(1f)
                        .clickable { onTabSelected(tab) }
                        .padding(vertical = 4.dp),
                    horizontalAlignment = androidx.compose.ui.Alignment.CenterHorizontally
                ) {
                    androidx.compose.material3.Icon(
                        imageVector = icon,
                        contentDescription = tab.label,
                        tint = color,
                        modifier = Modifier.size(22.dp)
                    )
                    Spacer(modifier = Modifier.height(2.dp))
                    Text(
                        text = tab.label,
                        color = color,
                        style = androidx.compose.material3.MaterialTheme.typography.labelSmall,
                        fontWeight = if (isSelected) FontWeight.SemiBold else FontWeight.Normal,
                        fontSize = 11.sp
                    )
                }
            }
        }
    }
}

@Composable
fun beltFlowTextFieldColors() = OutlinedTextFieldDefaults.colors(
    focusedTextColor = Slate900,
    unfocusedTextColor = Slate900,
    focusedLabelColor = BrandNavy,
    unfocusedLabelColor = Slate700,
    focusedPlaceholderColor = Slate400,
    unfocusedPlaceholderColor = Slate400,
    focusedBorderColor = AccentAmber700,
    unfocusedBorderColor = Slate300,
    focusedLeadingIconColor = BrandNavy,
    unfocusedLeadingIconColor = Slate500,
    focusedTrailingIconColor = BrandNavy,
    unfocusedTrailingIconColor = Slate500,
    cursorColor = AccentAmber700,
    focusedContainerColor = Color.White,
    unfocusedContainerColor = Color.White,
    errorContainerColor = Color.White,
    errorTextColor = Crimson600,
    errorLabelColor = Crimson600,
    errorBorderColor = Crimson600
)
