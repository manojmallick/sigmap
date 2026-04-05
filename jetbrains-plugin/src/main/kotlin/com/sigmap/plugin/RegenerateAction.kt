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
                indicator.text = "Running gen-context.js..."
                
                try {
                    val projectPath = project.basePath ?: return
                    val genContextPath = File(projectPath, "gen-context.js")
                    
                    if (!genContextPath.exists()) {
                        showNotification(
                            project,
                            "SigMap: gen-context.js not found",
                            "Run `npm install sigmap` or place gen-context.js in project root",
                            NotificationType.WARNING
                        )
                        return
                    }
                    
                    val commandLine = GeneralCommandLine()
                        .withWorkDirectory(projectPath)
                        .withExePath("node")
                        .withParameters(genContextPath.absolutePath)
                    
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
                            "Successfully updated .github/copilot-instructions.md",
                            NotificationType.INFORMATION
                        )
                    } else {
                        showNotification(
                            project,
                            "SigMap: Generation Failed",
                            "gen-context.js exited with code $exitCode",
                            NotificationType.ERROR
                        )
                    }
                    
                } catch (ex: Exception) {
                    showNotification(
                        project,
                        "SigMap: Error",
                        "Failed to run gen-context.js: ${ex.message}",
                        NotificationType.ERROR
                    )
                }
            }
        })
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
