package com.example.beltflow.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val LightColorScheme = lightColorScheme(
    primary = Navy800,
    onPrimary = Color.White,
    primaryContainer = Navy700,
    onPrimaryContainer = Color.White,
    secondary = Gold600,
    onSecondary = Color.White,
    secondaryContainer = Gold100,
    onSecondaryContainer = Gold600,
    tertiary = Crimson600,
    background = Slate50,
    onBackground = Slate800,
    surface = Color.White,
    onSurface = Slate800,
    surfaceVariant = Slate100,
    onSurfaceVariant = Slate700,
    outline = Slate200,
    outlineVariant = Slate100
)

private val DarkColorScheme = darkColorScheme(
    primary = Gold500,
    onPrimary = Navy900,
    primaryContainer = Navy800,
    onPrimaryContainer = Color.White,
    secondary = Gold500,
    onSecondary = Navy900,
    secondaryContainer = Navy700,
    onSecondaryContainer = Gold100,
    tertiary = Crimson600,
    background = Navy900,
    onBackground = Slate50,
    surface = Navy800,
    onSurface = Slate50,
    surfaceVariant = Navy700,
    onSurfaceVariant = Slate200,
    outline = Slate700,
    outlineVariant = Slate800
)

@Composable
fun BeltFlowTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    val colorScheme = if (darkTheme) DarkColorScheme else LightColorScheme

    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography,
        content = content
    )
}
