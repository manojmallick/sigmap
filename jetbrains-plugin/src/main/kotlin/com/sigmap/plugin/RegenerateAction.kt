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
                                "SigMap: gen-context not found",
                                "Install globally: npm install -g sigmap\nOr locally: npm install sigmap\nOr place gen-context.js in project root",
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
            return Pair("node", listOf(localGenContext.absolutePath))
        }
        
        // 2. Try to find global gen-context command in PATH
        val globalGenContext = findCommandInPath("gen-context")
        if (globalGenContext != null) {
            return Pair(globalGenContext, emptyList())
        }
        
        // 3. Check node_modules/.bin
        val nodeModulesGen = File(projectPath, "node_modules/.bin/gen-context")
        if (nodeModulesGen.exists()) {
            return Pair(nodeModulesGen.absolutePath, emptyList())
        }
        
        return null
    }
    
    /**
     * Find an executable command in the system PATH.
     * Returns the full path to the command if found, null otherwise.
     */
    private fun findCommandInPath(command: String): String? {
        val pathEnv = System.getenv("PATH") ?: return null
        val pathDirs = pathEnv.split(File.pathSeparator)
        
        for (dir in pathDirs) {
            val executable = File(dir, command)
            if (executable.exists() && executable.isFile && executable.canExecute()) {
                return executable.absolutePath
            }
        }
        
        return null
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
