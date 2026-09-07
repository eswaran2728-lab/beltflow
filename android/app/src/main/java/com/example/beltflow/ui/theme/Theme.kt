package com.example.beltflow.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val LightColorScheme = lightColorScheme(
    primary = BrandNavy,
    onPrimary = Color.White,
    primaryContainer = BrandNavyTint,
    onPrimaryContainer = BrandNavy,
    secondary = AccentAmber700,
    onSecondary = Color.White,
    secondaryContainer = AccentAmber100,
    onSecondaryContainer = AccentAmber800,
    tertiary = Crimson600,
    onTertiary = Color.White,
    background = BlueprintBg,
    onBackground = Slate900,
    surface = Color.White,
    onSurface = Slate900,
    surfaceVariant = Slate100,
    onSurfaceVariant = Slate700,
    outline = Slate300,
    outlineVariant = Slate200
)

private val DarkColorScheme = lightColorScheme(
    primary = BrandNavy,
    onPrimary = Color.White,
    primaryContainer = BrandNavyTint,
    onPrimaryContainer = BrandNavy,
    secondary = AccentAmber700,
    onSecondary = Color.White,
    secondaryContainer = AccentAmber100,
    onSecondaryContainer = AccentAmber800,
    tertiary = Crimson600,
    onTertiary = Color.White,
    background = BlueprintBg,
    onBackground = Slate900,
    surface = Color.White,
    onSurface = Slate900,
    surfaceVariant = Slate100,
    onSurfaceVariant = Slate700,
    outline = Slate300,
    outlineVariant = Slate200
)

@Composable
fun BeltFlowTheme(
    darkTheme: Boolean = false,
    content: @Composable () -> Unit
) {
    val colorScheme = if (darkTheme) DarkColorScheme else LightColorScheme

    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography,
        content = content
    )
}
