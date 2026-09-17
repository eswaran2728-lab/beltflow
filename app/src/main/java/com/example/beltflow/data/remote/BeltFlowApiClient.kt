package com.example.beltflow.data.remote

import com.example.beltflow.BuildConfig
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

/**
 * Singleton HTTP client configured to communicate with the shared BeltFlow backend API.
 */
object BeltFlowApiClient {
    // Debug builds point at 10.0.2.2 (the Android Emulator alias for host
    // localhost:4000) via BuildConfig.API_BASE_URL. Release builds must
    // never fall back to that: if RELEASE_API_BASE_URL wasn't supplied at
    // build time, BuildConfig.API_BASE_URL is blank and this fails loudly
    // rather than silently shipping a release build that talks to a
    // developer's loopback address.
    private var baseUrl: String = BuildConfig.API_BASE_URL.ifBlank {
        throw IllegalStateException(
            "API_BASE_URL is not configured for this build. Release builds must set " +
                "RELEASE_API_BASE_URL at build time (-PRELEASE_API_BASE_URL=... or the " +
                "RELEASE_API_BASE_URL environment variable)."
        )
    }
    @Volatile private var authToken: String? = null

    private val okHttpClient: OkHttpClient by lazy {
        val logging = HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.NONE
        }
        OkHttpClient.Builder()
            .addInterceptor(logging)
            .addInterceptor { chain ->
                val requestBuilder = chain.request().newBuilder()
                authToken?.let { token ->
                    requestBuilder.addHeader("Authorization", "Bearer $token")
                }
                chain.proceed(requestBuilder.build())
            }
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(15, TimeUnit.SECONDS)
            .build()
    }

    private fun createService(): BeltFlowApiService {
        return Retrofit.Builder()
            .baseUrl(baseUrl)
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(BeltFlowApiService::class.java)
    }

    @Volatile private var currentService: BeltFlowApiService? = null

    val service: BeltFlowApiService get() = currentService ?: synchronized(this) {
        currentService ?: createService().also { currentService = it }
    }

    fun setAuthToken(token: String?) {
        this.authToken = token
    }

    fun setCustomBaseUrl(url: String) {
        require(url.startsWith("https://") || url.startsWith("http://10.0.2.2:")) {
            "Use HTTPS for device backends. Local emulator development may use 10.0.2.2."
        }
        synchronized(this) {
            this.baseUrl = url.trimEnd('/') + "/"
            currentService = null
        }
    }
}
