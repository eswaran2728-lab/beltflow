package com.example.beltflow

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.toRoute
import com.example.beltflow.data.model.UserRole
import com.example.beltflow.ui.navigation.Screen
import com.example.beltflow.ui.screens.*
import com.example.beltflow.ui.theme.BeltFlowTheme
import com.example.beltflow.ui.viewmodels.BeltFlowViewModel
import com.example.beltflow.ui.viewmodels.BeltFlowViewModelFactory

class MainActivity : ComponentActivity() {

    private val viewModel: BeltFlowViewModel by viewModels {
        val app = application as BeltFlowApplication
        BeltFlowViewModelFactory(app.repository)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            BeltFlowTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    BeltFlowNavGraph(viewModel = viewModel)
                }
            }
        }
    }
}

@Composable
fun BeltFlowNavGraph(viewModel: BeltFlowViewModel) {
    val navController = rememberNavController()

    NavHost(
        navController = navController,
        startDestination = Screen.AdminDashboard
    ) {
        composable<Screen.Auth> {
            AuthScreen(
                viewModel = viewModel,
                onAuthSuccess = { role ->
                    when (role) {
                        UserRole.ADMIN -> navController.navigate(Screen.AdminDashboard) {
                            popUpTo(Screen.Auth) { inclusive = true }
                        }
                        UserRole.COACH -> navController.navigate(Screen.CoachPortal) {
                            popUpTo(Screen.Auth) { inclusive = true }
                        }
                        UserRole.PARENT -> navController.navigate(Screen.ParentPortal) {
                            popUpTo(Screen.Auth) { inclusive = true }
                        }
                        UserRole.STUDENT -> navController.navigate(Screen.StudentPortal) {
                            popUpTo(Screen.Auth) { inclusive = true }
                        }
                    }
                },
                onVerifyCertClick = {
                    navController.navigate(Screen.VerifyCert)
                }
            )
        }

        composable<Screen.AdminDashboard> {
            AdminDashboardScreen(
                viewModel = viewModel,
                onNavigateToStudents = { navController.navigate(Screen.StudentsList) },
                onNavigateToAttendance = { navController.navigate(Screen.Attendance) },
                onNavigateToBilling = { navController.navigate(Screen.Billing) },
                onNavigateToGrading = { navController.navigate(Screen.Grading) },
                onNavigateToCurriculum = { navController.navigate(Screen.Curriculum) },
                onNavigateToTournaments = { navController.navigate(Screen.Tournaments) },
                onNavigateToCertificates = { navController.navigate(Screen.Certificates) },
                onNavigateToSettings = { navController.navigate(Screen.Settings) },
                onNavigateToParentPortal = { navController.navigate(Screen.ParentPortal) },
                onNavigateToCoachPortal = { navController.navigate(Screen.CoachPortal) },
                onNavigateToStudentPortal = { navController.navigate(Screen.StudentPortal) },
                onLogout = {
                    viewModel.logout()
                    navController.navigate(Screen.Auth) {
                        popUpTo(0) { inclusive = true }
                    }
                }
            )
        }

        composable<Screen.StudentsList> {
            StudentsListScreen(
                viewModel = viewModel,
                onStudentClick = { studentId ->
                    navController.navigate(Screen.StudentDetail(studentId))
                },
                onBack = { navController.popBackStack() }
            )
        }

        composable<Screen.StudentDetail> { backStackEntry ->
            val route = backStackEntry.toRoute<Screen.StudentDetail>()
            StudentDetailScreen(
                studentId = route.studentId,
                viewModel = viewModel,
                onBack = { navController.popBackStack() }
            )
        }

        composable<Screen.Attendance> {
            AttendanceScreen(
                viewModel = viewModel,
                onBack = { navController.popBackStack() }
            )
        }

        composable<Screen.Billing> {
            BillingScreen(
                viewModel = viewModel,
                onBack = { navController.popBackStack() }
            )
        }

        composable<Screen.Grading> {
            GradingScreen(
                viewModel = viewModel,
                onBack = { navController.popBackStack() }
            )
        }

        composable<Screen.Curriculum> {
            CurriculumScreen(
                viewModel = viewModel,
                onBack = { navController.popBackStack() }
            )
        }

        composable<Screen.Tournaments> {
            TournamentsScreen(
                viewModel = viewModel,
                onBack = { navController.popBackStack() }
            )
        }

        composable<Screen.Certificates> {
            CertificatesScreen(
                viewModel = viewModel,
                onNavigateToVerify = { navController.navigate(Screen.VerifyCert) },
                onBack = { navController.popBackStack() }
            )
        }

        composable<Screen.VerifyCert> {
            VerifyCertScreen(
                viewModel = viewModel,
                onBack = { navController.popBackStack() }
            )
        }

        val onRoleSwitch: (String) -> Unit = { email ->
            viewModel.loginAs(email) {
                when (email) {
                    "eswaran2728@gmail.com" -> navController.navigate(Screen.AdminDashboard) {
                        popUpTo(Screen.AdminDashboard) { inclusive = true }
                    }
                    "ravi.silambam@gmail.com" -> navController.navigate(Screen.CoachPortal) {
                        popUpTo(Screen.AdminDashboard) { inclusive = false }
                    }
                    "suresh.parent@gmail.com" -> navController.navigate(Screen.ParentPortal) {
                        popUpTo(Screen.AdminDashboard) { inclusive = false }
                    }
                    "aryan.suresh@gmail.com" -> navController.navigate(Screen.StudentPortal) {
                        popUpTo(Screen.AdminDashboard) { inclusive = false }
                    }
                    else -> navController.navigate(Screen.AdminDashboard) {
                        popUpTo(Screen.AdminDashboard) { inclusive = true }
                    }
                }
            }
        }

        composable<Screen.ParentPortal> {
            ParentPortalScreen(
                viewModel = viewModel,
                onNavigateToVerifyCert = { navController.navigate(Screen.VerifyCert) },
                onLogout = {
                    viewModel.logout()
                    navController.navigate(Screen.Auth) {
                        popUpTo(0) { inclusive = true }
                    }
                },
                onSwitchUser = onRoleSwitch
            )
        }

        composable<Screen.CoachPortal> {
            CoachPortalScreen(
                viewModel = viewModel,
                onNavigateToAttendance = { navController.navigate(Screen.Attendance) },
                onNavigateToGrading = { navController.navigate(Screen.Grading) },
                onNavigateToCurriculum = { navController.navigate(Screen.Curriculum) },
                onStudentClick = { studentId ->
                    navController.navigate(Screen.StudentDetail(studentId))
                },
                onLogout = {
                    viewModel.logout()
                    navController.navigate(Screen.Auth) {
                        popUpTo(0) { inclusive = true }
                    }
                },
                onSwitchUser = onRoleSwitch
            )
        }

        composable<Screen.StudentPortal> {
            StudentPortalScreen(
                viewModel = viewModel,
                onLogout = {
                    viewModel.logout()
                    navController.navigate(Screen.Auth) {
                        popUpTo(0) { inclusive = true }
                    }
                },
                onSwitchUser = onRoleSwitch
            )
        }

        composable<Screen.Settings> {
            SettingsScreen(
                viewModel = viewModel,
                onBack = { navController.popBackStack() }
            )
        }
    }
}
