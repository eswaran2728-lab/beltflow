package com.example.beltflow

import android.app.Application
import com.example.beltflow.data.local.BeltFlowDatabase
import com.example.beltflow.data.repository.BeltFlowRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.SupervisorJob

class BeltFlowApplication : Application() {
    private val applicationScope = CoroutineScope(SupervisorJob())

    val database by lazy { BeltFlowDatabase.getDatabase(this, applicationScope) }
    val repository by lazy { BeltFlowRepository(database.dao()) }
}
