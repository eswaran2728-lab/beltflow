package com.example.beltflow.ui.navigation

import kotlinx.serialization.Serializable

sealed interface Screen {
    @Serializable
    data object Auth : Screen

    @Serializable
    data object AdminDashboard : Screen

    @Serializable
    data object StudentsList : Screen

    @Serializable
    data class StudentDetail(val studentId: String) : Screen

    @Serializable
    data object Attendance : Screen

    @Serializable
    data object Billing : Screen

    @Serializable
    data object Grading : Screen

    @Serializable
    data object Curriculum : Screen

    @Serializable
    data object Tournaments : Screen

    @Serializable
    data object Certificates : Screen

    @Serializable
    data object VerifyCert : Screen

    @Serializable
    data object ParentPortal : Screen

    @Serializable
    data object CoachPortal : Screen

    @Serializable
    data object StudentPortal : Screen

    @Serializable
    data object Settings : Screen
}
