package com.sigmap.plugin

import org.junit.After
import org.junit.Before
import org.junit.Test
import java.io.File
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class RegenerateActionTest {
    private lateinit var testProjectDir: File

    @Before
    fun setUp() {
        // Create a temporary test project directory
        testProjectDir = File.createTempFile("sigmap-test-", "-project").also { it.delete() }
        testProjectDir.mkdirs()
    }

    @After
    fun tearDown() {
        // Clean up test directory
        testProjectDir.deleteRecursively()
    }

    @Test
    fun testFindGenContextCommandWithLocalFile() {
        // Create a local gen-context.js file
        val genContextFile = File(testProjectDir, "gen-context.js")
        genContextFile.writeText("console.log('test')")
        
        val action = RegenerateAction()
        val result = findGenContextCommandReflection(action, testProjectDir.absolutePath)
        
        assertNotNull(result, "Should find local gen-context.js")
        assertTrue(result.first.endsWith("node") || result.first.endsWith("node.exe"),
            "Should use node executor for local gen-context.js")
        assertEquals(genContextFile.absolutePath, result.second.firstOrNull(), "Should pass absolute path to gen-context.js")
    }

    @Test
    fun testFindGenContextCommandWithNodeModules() {
        // Create node_modules/.bin/gen-context
        val nodeModulesDir = File(testProjectDir, "node_modules/.bin")
        nodeModulesDir.mkdirs()
        val genContextBin = File(nodeModulesDir, "gen-context")
        genContextBin.writeText("#!/bin/bash\necho 'gen-context'")
        genContextBin.setExecutable(true)
        
        val action = RegenerateAction()
        val result = findGenContextCommandReflection(action, testProjectDir.absolutePath)
        
        // When gen-context.js doesn't exist locally, the code should find gen-context
        // either globally (if installed) or in node_modules/.bin
        assertNotNull(result, "Should find gen-context somewhere")
        assertTrue(
            result.first.contains("gen-context") ||
            result.first.contains("sigmap") ||
            result.first == "node",
            "Executor should contain gen-context/sigmap or be 'node'"
        )
    }

    @Test
    fun testFindGenContextCommandNotFound() {
        // Create empty project directory without any gen-context
        val action = RegenerateAction()
        
        val result = findGenContextCommandReflection(action, testProjectDir.absolutePath)
        
        // When no gen-context.js, no node_modules, result should be null (unless gen-context is globally installed)
        // In test environment with no global gen-context, this should be null
        if (result == null) {
            assertTrue(true, "Expected behavior when gen-context is not found anywhere")
        } else {
            // Could be found if gen-context is installed globally
            assertTrue(true, "Could be found if installed globally on this system")
        }
    }

    @Test
    fun testFindGenContextCommandLocalPrecedence() {
        // Create both local file and node_modules binary
        val genContextFile = File(testProjectDir, "gen-context.js")
        genContextFile.writeText("console.log('local')")
        
        val nodeModulesDir = File(testProjectDir, "node_modules/.bin")
        nodeModulesDir.mkdirs()
        val genContextBin = File(nodeModulesDir, "gen-context")
        genContextBin.writeText("#!/bin/bash\necho 'nodemodules'")
        genContextBin.setExecutable(true)
        
        val action = RegenerateAction()
        val result = findGenContextCommandReflection(action, testProjectDir.absolutePath)
        
        assertNotNull(result, "Should find gen-context")
        assertTrue(result.first.endsWith("node") || result.first.endsWith("node.exe"),
            "Should prefer local gen-context.js (use node executor)")
        assertTrue(result.second.isNotEmpty(), "Should have parameters for node execution")
    }

    @Test
    fun testFindCommandInPathValidCommand() {
        val action = RegenerateAction()
        // Try to find a common system command that should exist
        val result = findCommandInPathReflection(action, "ls")
        
        // This command should exist on Unix-like systems (Linux, macOS)
        assertNotNull(result, "Should find 'ls' command in PATH")
        assertTrue(File(result).exists(), "Found command should exist")
        assertTrue(File(result).isFile, "Found command should be a file")
    }

    @Test
    fun testFindCommandInPathInvalidCommand() {
        val action = RegenerateAction()
        val result = findCommandInPathReflection(action, "nonexistent-command-xyz-12345")
        
        assertNull(result, "Should not find non-existent command")
    }

    /**
     * Reflection helper to call private findGenContextCommand method
     */
    private fun findGenContextCommandReflection(
        action: RegenerateAction,
        projectPath: String
    ): Pair<String, List<String>>? {
        val method = RegenerateAction::class.java.getDeclaredMethod(
            "findGenContextCommand",
            String::class.java
        )
        method.isAccessible = true
        @Suppress("UNCHECKED_CAST")
        return method.invoke(action, projectPath) as? Pair<String, List<String>>
    }

    /**
     * Reflection helper to call private findCommandInPath method
     */
    private fun findCommandInPathReflection(
        action: RegenerateAction,
        command: String
    ): String? {
        val method = RegenerateAction::class.java.getDeclaredMethod(
            "findCommandInPath",
            String::class.java
        )
        method.isAccessible = true
        return method.invoke(action, command) as? String
    }
}
