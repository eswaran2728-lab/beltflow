package com.example.beltflow.data.local

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ClassMembershipTest {

    // --- parseClassIds ---

    @Test
    fun parseClassIds_singleClassStudent_returnsOneId() {
        val result = ClassMembership.parseClassIds("[\"cls_junior_beginners\"]")
        assertEquals(listOf("cls_junior_beginners"), result)
    }

    @Test
    fun parseClassIds_multiClassStudent_returnsAllIds() {
        val result = ClassMembership.parseClassIds("[\"cls_junior\",\"cls_advanced\",\"cls_weapons\"]")
        assertEquals(listOf("cls_junior", "cls_advanced", "cls_weapons"), result)
    }

    @Test
    fun parseClassIds_studentWithNoClasses_returnsEmptyList() {
        assertTrue(ClassMembership.parseClassIds("[]").isEmpty())
    }

    @Test
    fun parseClassIds_nullValue_returnsEmptyListSafely() {
        assertTrue(ClassMembership.parseClassIds(null).isEmpty())
    }

    @Test
    fun parseClassIds_blankValue_returnsEmptyListSafely() {
        assertTrue(ClassMembership.parseClassIds("   ").isEmpty())
    }

    @Test
    fun parseClassIds_malformedJson_returnsEmptyListRatherThanThrowing() {
        assertTrue(ClassMembership.parseClassIds("not valid json").isEmpty())
        assertTrue(ClassMembership.parseClassIds("{\"not\":\"an array\"}").isEmpty())
        assertTrue(ClassMembership.parseClassIds("[\"unterminated").isEmpty())
    }

    // --- toClassIdsJson round-trip (legacy classId -> classIdsJson representation) ---

    @Test
    fun toClassIdsJson_singleLegacyClassId_wrapsAsOneElementArray() {
        val json = ClassMembership.toClassIdsJson(listOf("cls_legacy_only"))
        assertEquals(listOf("cls_legacy_only"), ClassMembership.parseClassIds(json))
    }

    @Test
    fun toClassIdsJson_emptyList_producesEmptyArray() {
        val json = ClassMembership.toClassIdsJson(emptyList())
        assertTrue(ClassMembership.parseClassIds(json).isEmpty())
    }

    // --- belongsToAnyClass (Master roster / class-scoped authorization semantics) ---

    @Test
    fun belongsToAnyClass_studentInExactlyThatClass_isTrue() {
        assertTrue(ClassMembership.belongsToAnyClass("[\"cls_a\"]", setOf("cls_a")))
    }

    @Test
    fun belongsToAnyClass_multiClassStudent_matchesIfAnyOneOverlaps() {
        // A Master assigned only to cls_b should still be authorized for a
        // student enrolled in both cls_a and cls_b.
        assertTrue(ClassMembership.belongsToAnyClass("[\"cls_a\",\"cls_b\"]", setOf("cls_b")))
    }

    @Test
    fun belongsToAnyClass_noOverlap_isFalse() {
        assertFalse(ClassMembership.belongsToAnyClass("[\"cls_a\"]", setOf("cls_z")))
    }

    @Test
    fun belongsToAnyClass_studentWithNoClasses_isFalse() {
        assertFalse(ClassMembership.belongsToAnyClass("[]", setOf("cls_a")))
        assertFalse(ClassMembership.belongsToAnyClass(null, setOf("cls_a")))
    }

    @Test
    fun belongsToAnyClass_noTargetClasses_isFalse() {
        assertFalse(ClassMembership.belongsToAnyClass("[\"cls_a\"]", emptySet()))
    }
}
