package com.example.beltflow.ui.screens

import androidx.compose.runtime.Composable
import com.example.beltflow.ui.viewmodels.BeltFlowViewModel

@Composable
fun CoachPortalScreen(
    viewModel: BeltFlowViewModel,
    onNavigateToAttendance: () -> Unit,
    onNavigateToGrading: () -> Unit,
    onNavigateToCurriculum: () -> Unit,
    onStudentClick: (String) -> Unit,
    onLogout: () -> Unit,
    onSwitchUser: ((String) -> Unit)? = null
) {
    MasterPortalScreen(
        viewModel = viewModel,
        onNavigateToAttendance = onNavigateToAttendance,
        onNavigateToGrading = onNavigateToGrading,
        onNavigateToCurriculum = onNavigateToCurriculum,
        onNavigateToTournaments = {},
        onNavigateToCertificates = {},
        onStudentClick = onStudentClick,
        onLogout = onLogout,
        onSwitchUser = onSwitchUser
    )
}
