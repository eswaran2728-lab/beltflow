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
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.beltflow.ui.theme.*


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
 * Clean badge tag matching the Claude design system (.tag .tag-accent, .tag-neutral, .tag-outline)
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
        androidx.compose.material3.Text(
            text = text,
            color = textColor,
            style = androidx.compose.material3.MaterialTheme.typography.labelSmall,
            fontWeight = androidx.compose.ui.text.font.FontWeight.Medium,
            modifier = Modifier.padding(horizontal = 7.dp, vertical = 3.dp)
        )
    }
}

/**
 * The 4 primary mobile tabs from the BeltFlow Claude design specification:
 * Home (Dashboard), Students (Roster), Grading (Belt Exams), Certificates (Promotion)
 */
enum class BeltFlowTab(val label: String) {
    HOME("Home"),
    STUDENTS("Students"),
    GRADING("Grading"),
    CERTIFICATES("Certificates")
}

/**
 * Circular Official Seal Badge ("OFF" / "OFFICIAL") matching the Certificate of Promotion cards.
 */
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
            androidx.compose.material3.Text(
                text = text,
                color = accentColor,
                fontSize = 8.sp,
                fontWeight = androidx.compose.ui.text.font.FontWeight.Bold,
                letterSpacing = 0.5.sp
            )
        }
    }
}

/**
 * Bottom navigation bar styled with exact Lucide/Claude aesthetic and amber highlights.
 */
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
                    androidx.compose.material3.Text(
                        text = tab.label,
                        color = color,
                        style = androidx.compose.material3.MaterialTheme.typography.labelSmall,
                        fontWeight = if (isSelected) androidx.compose.ui.text.font.FontWeight.SemiBold else androidx.compose.ui.text.font.FontWeight.Normal,
                        fontSize = 11.sp
                    )
                }
            }
        }
    }
}

