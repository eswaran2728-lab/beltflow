package com.example.beltflow.data.local

/**
 * A student may belong to zero, one, or multiple classes, persisted locally as
 * StudentEntity.classIdsJson (a JSON array of class IDs, e.g. ["cls_a","cls_b"]).
 * This centralizes the parsing/matching logic so it isn't reimplemented across
 * the repository and UI.
 *
 * Deliberately implemented with plain string parsing rather than
 * org.json.JSONArray: class IDs are always simple generated tokens with no
 * quotes, commas, or brackets in them, and org.json is the Android SDK stub
 * jar in plain JVM unit tests (every real method throws "not mocked"), so a
 * self-contained parser keeps this logic genuinely unit-testable.
 */
object ClassMembership {

    /** Parses a classIdsJson string into a list of class IDs. Never throws:
     * malformed, null-ish, or empty input safely yields an empty list. */
    fun parseClassIds(json: String?): List<String> {
        if (json.isNullOrBlank()) return emptyList()
        val trimmed = json.trim()
        if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) return emptyList()
        val inner = trimmed.substring(1, trimmed.length - 1).trim()
        if (inner.isEmpty()) return emptyList()
        return inner.split(",")
            .map { it.trim().trim('"') }
            .filter { it.isNotEmpty() }
    }

    /** True if the student (identified by their classIdsJson) belongs to at
     * least one of the given target class IDs. */
    fun belongsToAnyClass(classIdsJson: String?, targetClassIds: Collection<String>): Boolean {
        if (targetClassIds.isEmpty()) return false
        val studentClassIds = parseClassIds(classIdsJson)
        return studentClassIds.any { targetClassIds.contains(it) }
    }

    /** Serializes a list of class IDs back into the JSON array format stored
     * in StudentEntity.classIdsJson. */
    fun toClassIdsJson(classIds: List<String>): String =
        classIds.joinToString(separator = ",", prefix = "[", postfix = "]") { "\"$it\"" }
}
