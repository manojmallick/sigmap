package com.sigmap.plugin

import com.intellij.openapi.Disposable
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.Disposer
import com.intellij.openapi.wm.StatusBarWidget
import com.intellij.openapi.wm.impl.status.EditorBasedWidget
import com.intellij.util.Consumer
import java.awt.event.MouseEvent
import java.io.File
import java.nio.file.Files
import java.nio.file.attribute.FileTime
import java.time.Duration
import java.time.Instant
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

class HealthStatusBar(project: Project) : EditorBasedWidget(project), StatusBarWidget.TextPresentation, Disposable {
    
    private val executor = Executors.newSingleThreadScheduledExecutor()
    private var healthText = "SigMap: --"
    
    init {
        // Update every 60 seconds
        executor.scheduleAtFixedRate(
            { updateHealthStatus() },
            0,
            60,
            TimeUnit.SECONDS
        )
    }
    
    override fun ID(): String = "sigmap.healthStatusBar"
    
    override fun getPresentation(): StatusBarWidget.WidgetPresentation = this
    
    override fun getText(): String = healthText
    
    override fun getTooltipText(): String {
        return "SigMap context health — Click to regenerate"
    }
    
    override fun getClickConsumer(): Consumer<MouseEvent>? {
        return Consumer {
            RegenerateAction().actionPerformed(
                com.intellij.openapi.actionSystem.AnActionEvent.createFromAnAction(
                    RegenerateAction(),
                    null,
                    "",
                    com.intellij.openapi.actionSystem.DataContext.EMPTY_CONTEXT
                )
            )
        }
    }
    
    private fun updateHealthStatus() {
        val projectPath = project.basePath ?: return
        val contextFile = File(projectPath, ".github/copilot-instructions.md")
        
        if (!contextFile.exists()) {
            healthText = "SigMap: ⚠ missing"
            myStatusBar?.updateWidget(ID())
            return
        }
        
        try {
            val lastModified = Files.getLastModifiedTime(contextFile.toPath())
            val age = getAge(lastModified)
            val grade = computeGrade(age)
            
            healthText = "SigMap: $grade ${formatAge(age)}"
            myStatusBar?.updateWidget(ID())
            
        } catch (e: Exception) {
            healthText = "SigMap: error"
            myStatusBar?.updateWidget(ID())
        }
    }
    
    private fun getAge(lastModified: FileTime): Duration {
        val now = Instant.now()
        val fileInstant = lastModified.toInstant()
        return Duration.between(fileInstant, now)
    }
    
    private fun computeGrade(age: Duration): String {
        val hours = age.toHours()
        return when {
            hours < 1 -> "A"
            hours < 6 -> "B"
            hours < 12 -> "C"
            hours < 24 -> "D"
            else -> "F"
        }
    }
    
    private fun formatAge(age: Duration): String {
        val hours = age.toHours()
        val minutes = age.toMinutes()
        
        return when {
            hours >= 24 -> "${hours / 24}d"
            hours >= 1 -> "${hours}h"
            else -> "${minutes}m"
        }
    }
    
    override fun getAlignment(): Float = 1f  // Right-align in status bar
    
    override fun dispose() {
        executor.shutdown()
        try {
            executor.awaitTermination(5, TimeUnit.SECONDS)
        } catch (e: InterruptedException) {
            executor.shutdownNow()
        }
    }
}
