package com.example.beltflow.data.security

import java.security.NoSuchAlgorithmException
import java.security.SecureRandom
import java.security.spec.InvalidKeySpecException
import java.util.Base64
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.PBEKeySpec

object SecurityUtils {

    private const val ITERATIONS = 10000
    private const val KEY_LENGTH = 256
    private const val SALT_LENGTH = 16

    fun generateSalt(): String {
        val random = SecureRandom()
        val salt = ByteArray(SALT_LENGTH)
        random.nextBytes(salt)
        return Base64.getEncoder().encodeToString(salt)
    }

    fun hashPassword(password: String, saltBase64: String): String {
        return try {
            val salt = Base64.getDecoder().decode(saltBase64)
            val spec = PBEKeySpec(password.toCharArray(), salt, ITERATIONS, KEY_LENGTH)
            val factory = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256")
            val hash = factory.generateSecret(spec).encoded
            Base64.getEncoder().encodeToString(hash)
        } catch (e: Exception) {
            // Fallback SHA-256 with salt if PBKDF2 fails
            fallbackHash(password, saltBase64)
        }
    }

    fun verifyPassword(password: String, saltBase64: String, storedHash: String): Boolean {
        if (storedHash.isBlank()) return false
        // Check PBKDF2 / SHA-256 hash match
        val computedHash = hashPassword(password, saltBase64)
        if (computedHash == storedHash) return true
        val computedFallback = fallbackHash(password, saltBase64)
        if (computedFallback == storedHash) return true
        // Legacy plaintext comparison fallback for migration
        return password == storedHash
    }

    private fun fallbackHash(password: String, salt: String): String {
        val md = java.security.MessageDigest.getInstance("SHA-256")
        md.update(salt.toByteArray())
        val digest = md.digest(password.toByteArray())
        return Base64.getEncoder().encodeToString(digest)
    }
}
