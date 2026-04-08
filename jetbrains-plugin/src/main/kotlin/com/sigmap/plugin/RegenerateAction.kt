package com.sigmap.plugin

import com.intellij.execution.configurations.GeneralCommandLine
import com.intellij.execution.process.ProcessHandler
import com.intellij.execution.process.ProcessHandlerFactory
import com.intellij.execution.process.ProcessTerminatedListener
import com.intellij.notification.Notification
import com.intellij.notification.NotificationType
import com.intellij.notification.Notifications
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.progress.ProgressIndicator
import com.intellij.openapi.progress.ProgressManager
import com.intellij.openapi.progress.Task
import com.intellij.openapi.project.Project
import java.io.File
import java.util.Locale

class RegenerateAction : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        
        ProgressManager.getInstance().run(object : Task.Backgroundable(project, "Regenerating SigMap Context", false) {
            override fun run(indicator: ProgressIndicator) {
                indicator.text = "Running gen-context..."
                
                try {
                    val projectPath = project.basePath ?: return
                    
                    // Try to find gen-context: first local, then global
                    val (commandExe, commandParams) = findGenContextCommand(projectPath)
                        ?: run {
                            showNotification(
                                project,
                                "SigMap: command not found",
                                installHelpMessage(),
                                NotificationType.WARNING
                            )
                            return
                        }
                    
                    val commandLine = GeneralCommandLine()
                        .withWorkDirectory(projectPath)
                        .withExePath(commandExe)
                    
                    commandParams.forEach { param ->
                        commandLine.addParameter(param)
                    }
                    
                    val processHandler: ProcessHandler = ProcessHandlerFactory.getInstance()
                        .createColoredProcessHandler(commandLine)
                    
                    ProcessTerminatedListener.attach(processHandler)
                    processHandler.startNotify()
                    processHandler.waitFor()
                    
                    val exitCode = processHandler.exitCode
                    if (exitCode == 0) {
                        showNotification(
                            project,
                            "SigMap: Context Regenerated",
                            "Successfully updated context file (.github/copilot-instructions.md or CLAUDE.md)",
                            NotificationType.INFORMATION
                        )
                    } else {
                        showNotification(
                            project,
                            "SigMap: Generation Failed",
                            "gen-context exited with code $exitCode",
                            NotificationType.ERROR
                        )
                    }
                    
                } catch (ex: Exception) {
                    showNotification(
                        project,
                        "SigMap: Error",
                        "Failed to run gen-context: ${ex.message}",
                        NotificationType.ERROR
                    )
                }
            }
        })
    }
    
    /**
     * Find gen-context command: tries local gen-context.js first, then global gen-context command.
     * Returns a Pair of (executable, listOf(parameters)) or null if not found.
     */
    private fun findGenContextCommand(projectPath: String): Pair<String, List<String>>? {
        // 1. Check for local gen-context.js
        val localGenContext = File(projectPath, "gen-context.js")
        if (localGenContext.exists()) {
            return Pair(findNodeExecutable(), listOf(localGenContext.absolutePath))
        }

        // 2. Check project-local node_modules/.bin (prefer sigmap, then gen-context)
        val localBin = findFirstExisting(
            commandCandidates(File(projectPath, "node_modules/.bin").absolutePath, "sigmap") +
            commandCandidates(File(projectPath, "node_modules/.bin").absolutePath, "gen-context")
        )
        if (localBin != null) {
            return Pair(localBin, emptyList())
        }

        // 3. Probe known global install paths
        val globalKnown = findFirstExisting(globalCommandCandidates())
        if (globalKnown != null) {
            return Pair(globalKnown, emptyList())
        }
        
        // 4. Search current PATH (prefer sigmap)
        val fromPath = findCommandInPath("sigmap") ?: findCommandInPath("gen-context")
        if (fromPath != null) {
            return Pair(fromPath, emptyList())
        }

        // 5. Last resort: shell lookup (login shell / where)
        val fromShell = resolveViaShell("sigmap") ?: resolveViaShell("gen-context")
        if (fromShell != null) {
            return Pair(fromShell, emptyList())
        }

        return null
    }

    private fun findNodeExecutable(): String {
        return findCommandInPath("node") ?: "node"
    }

    private fun commandCandidates(baseDir: String, command: String): List<String> {
        val base = File(baseDir)
        if (!base.exists()) return emptyList()
        return if (isWindows()) {
            listOf(
                File(base, "$command.cmd").absolutePath,
                File(base, "$command.exe").absolutePath,
                File(base, "$command.bat").absolutePath,
                File(base, command).absolutePath
            )
        } else {
            listOf(File(base, command).absolutePath)
        }
    }

    private fun findFirstExisting(paths: List<String>): String? {
        for (p in paths) {
            val f = File(p)
            if (f.exists() && f.isFile) return f.absolutePath
        }
        return null
    }

    private fun globalCommandCandidates(): List<String> {
        val home = System.getProperty("user.home") ?: ""
        val paths = mutableListOf<String>()

        // Volta
        paths += commandCandidates(File(home, ".volta/bin").absolutePath, "sigmap")
        paths += commandCandidates(File(home, ".volta/bin").absolutePath, "gen-context")

        // nvm (Unix)
        val nvmRoot = File(home, ".nvm/versions/node")
        if (nvmRoot.exists() && nvmRoot.isDirectory) {
            val versions = nvmRoot.listFiles()?.filter { it.isDirectory }?.sortedByDescending { it.name } ?: emptyList()
            versions.forEach { versionDir ->
                val binDir = File(versionDir, "bin").absolutePath
                paths += commandCandidates(binDir, "sigmap")
                paths += commandCandidates(binDir, "gen-context")
            }
        }

        // Common Unix locations
        paths += commandCandidates("/usr/local/bin", "sigmap")
        paths += commandCandidates("/usr/local/bin", "gen-context")
        paths += commandCandidates("/opt/homebrew/bin", "sigmap")
        paths += commandCandidates("/opt/homebrew/bin", "gen-context")
        paths += commandCandidates(File(home, ".npm-global/bin").absolutePath, "sigmap")
        paths += commandCandidates(File(home, ".npm-global/bin").absolutePath, "gen-context")
        paths += commandCandidates(File(home, "npm/bin").absolutePath, "sigmap")
        paths += commandCandidates(File(home, "npm/bin").absolutePath, "gen-context")

        // Windows global npm + user bins
        val appData = System.getenv("APPDATA") ?: File(home, "AppData/Roaming").absolutePath
        paths += commandCandidates(File(appData, "npm").absolutePath, "sigmap")
        paths += commandCandidates(File(appData, "npm").absolutePath, "gen-context")
        paths += commandCandidates(File(home, "bin").absolutePath, "sigmap")
        paths += commandCandidates(File(home, "bin").absolutePath, "gen-context")
        paths += commandCandidates(File(home, ".local/bin").absolutePath, "sigmap")
        paths += commandCandidates(File(home, ".local/bin").absolutePath, "gen-context")

        return paths
    }
    
    /**
     * Find an executable command in the system PATH.
     * Returns the full path to the command if found, null otherwise.
     */
    private fun findCommandInPath(command: String): String? {
        val pathEnv = System.getenv("PATH") ?: return null
        val pathDirs = pathEnv.split(File.pathSeparator)
        val candidates = if (isWindows()) {
            listOf("$command.cmd", "$command.exe", "$command.bat", command)
        } else {
            listOf(command)
        }
        
        for (dir in pathDirs) {
            for (candidate in candidates) {
                val executable = File(dir, candidate)
                if (!executable.exists() || !executable.isFile) continue
                if (!isWindows() && !executable.canExecute()) continue
                return executable.absolutePath
            }
        }
        
        return null
    }

    private fun resolveViaShell(command: String): String? {
        return try {
            val output = if (isWindows()) {
                ProcessBuilder("where", command).start().inputStream.bufferedReader().readText()
            } else {
                val shell = if (File("/bin/zsh").exists()) "/bin/zsh" else "/bin/bash"
                ProcessBuilder(shell, "-lc", "command -v $command || which $command")
                    .start().inputStream.bufferedReader().readText()
            }
            output.lineSequence().map { it.trim() }.firstOrNull { it.isNotEmpty() && File(it).exists() }
        } catch (_: Exception) {
            null
        }
    }

    private fun isWindows(): Boolean {
        return System.getProperty("os.name")?.lowercase(Locale.ROOT)?.contains("win") == true
    }

    private fun installHelpMessage(): String {
        return if (isWindows()) {
            "Try one of:\n" +
            "1) npm global: npm install -g sigmap\n" +
            "2) npm local: npm install sigmap\n" +
            "3) standalone binary: place sigmap.exe in %USERPROFILE%\\bin and add it to PATH\n" +
            "4) put gen-context.js in project root"
        } else {
            "Try one of:\n" +
            "1) npm global: npm install -g sigmap\n" +
            "2) npm local: npm install sigmap\n" +
            "3) standalone binary: place sigmap in ~/.local/bin and add it to PATH\n" +
            "4) put gen-context.js in project root"
        }
    }
    
    override fun update(e: AnActionEvent) {
        e.presentation.isEnabled = e.project != null
    }
    
    private fun showNotification(project: Project, title: String, content: String, type: NotificationType) {
        Notifications.Bus.notify(
            Notification("SigMap", title, content, type),
            project
        )
    }
}
