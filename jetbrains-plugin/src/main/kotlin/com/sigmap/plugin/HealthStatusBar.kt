package com.sigmap.plugin

import com.intellij.notification.Notification
import com.intellij.notification.NotificationAction
import com.intellij.notification.NotificationType
import com.intellij.notification.Notifications
import com.intellij.openapi.actionSystem.ActionManager
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.actionSystem.DataContext
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.Disposable
import com.intellij.openapi.project.Project
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

// Feature 5: typed health result including tokens + reduction from --health --json
data class HealthResult(
    val grade: String,
    val score: Int,
    val daysSince: Double,
    val tokens: Int = 0,
    val reduction: Int = 0,
)

class HealthStatusBar(project: Project) : EditorBasedWidget(project), StatusBarWidget.TextPresentation, Disposable {

    private val executor = Executors.newSingleThreadScheduledExecutor()
    private var healthText = "SigMap: --"
    private var toolTipText = "SigMap context health — Click to regenerate"
    // Feature 4: track whether the 24h stale popup has already been shown this session
    private var staleNotificationShown = false

    init {
        // Update every 60 seconds
        executor.scheduleAtFixedRate(
            { updateHealthStatus() },
            0,
            60,
            TimeUnit.SECONDS,
        )
    }

    override fun ID(): String = "sigmap.healthStatusBar"

    override fun getPresentation(): StatusBarWidget.WidgetPresentation = this

    override fun getText(): String = healthText

    override fun getTooltipText(): String = toolTipText

    override fun getClickConsumer(): Consumer<MouseEvent>? {
        return Consumer {
            val action = ActionManager.getInstance().getAction("SigMap.RegenerateContext") ?: return@Consumer
            ActionManager.getInstance().tryToExecute(action, it, null, "SigMapHealthStatusBar", true)
        }
    }

    private fun updateHealthStatus() {
        val projectPath = project.basePath ?: return
        val contextFile = File(projectPath, ".github/copilot-instructions.md")

        if (!contextFile.exists()) {
            healthText = "SigMap: ⚠ missing"
            toolTipText = "SigMap: no context file found — click to regenerate"
            myStatusBar?.updateWidget(ID())
            return
        }

        // Feature 5: prefer --health --json for rich grade + token data
        val health = fetchHealth(projectPath) ?: run {
            // Fallback: compute grade from mtime only
            val lastModified = Files.getLastModifiedTime(contextFile.toPath())
            val age = getAge(lastModified)
            HealthResult(grade = computeGrade(age), score = 0, daysSince = age.toMillis() / 86_400_000.0)
        }

        val tokStr = if (health.tokens > 0) " · ${health.tokens} tok" else ""
        val redStr = if (health.reduction > 0) " · ${health.reduction}% ↓" else ""
        healthText = "SigMap: ${health.grade}${tokStr}${redStr}"
        toolTipText = buildString {
            append("SigMap ${health.grade}")
            if (health.score > 0) append(" (${health.score}/100)")
            if (health.tokens > 0) append(" · ${health.tokens} tok")
            if (health.reduction > 0) append(" · ${health.reduction}% ↓")
            append(" · ${formatAge(health.daysSince)} · Click to regenerate")
        }
        myStatusBar?.updateWidget(ID())

        // Feature 4: show stale popup once per session when context is ≥ 24h old
        if (health.daysSince >= 1.0 && !staleNotificationShown) {
            staleNotificationShown = true
            val hours = (health.daysSince * 24).toInt()
            ApplicationManager.getApplication().invokeLater {
                showStaleNotification(project, hours)
            }
        }
        // Reset flag when context is fresh again (allows next stale to re-trigger)
        if (health.daysSince < 1.0) staleNotificationShown = false
    }

    // Feature 5: call `gen-context --health --json` and parse the result
    private fun findGenContextCommand(projectPath: String): Pair<String, List<String>>? {
        val candidates = listOf(
            File(projectPath, "gen-context.js"),
            File(projectPath, "node_modules/.bin/sigmap"),
            File(projectPath, "node_modules/.bin/sigmap.cmd"),
        )
        for (f in candidates) {
            if (f.exists()) {
                val node = ProcessBuilder("which", "node").start().inputStream.bufferedReader().readText().trim()
                    .ifEmpty { "node" }
                return if (f.name.endsWith(".js")) Pair(node, listOf(f.absolutePath))
                else Pair(f.absolutePath, emptyList())
            }
        }
        return null
    }

    private fun fetchHealth(projectPath: String): HealthResult? {
        return try {
            val (exe, params) = findGenContextCommand(projectPath) ?: return null
            val cmd = mutableListOf(exe) + params + listOf("--health", "--json")
            val out = ProcessBuilder(cmd)
                .directory(File(projectPath))
                .redirectErrorStream(true)
                .start()
                .inputStream.bufferedReader().readText()
            val grade     = Regex(""""grade"\s*:\s*"([A-F?])"""").find(out)?.groupValues?.get(1) ?: "?"
            val score     = Regex(""""score"\s*:\s*(\d+)""").find(out)?.groupValues?.get(1)?.toIntOrNull() ?: 0
            val days      = Regex(""""daysSinceRegen"\s*:\s*([\d.]+)""").find(out)?.groupValues?.get(1)?.toDoubleOrNull() ?: 0.0
            val tokens    = Regex(""""tokens"\s*:\s*(\d+)""").find(out)?.groupValues?.get(1)?.toIntOrNull() ?: 0
            val reduction = Regex(""""reduction"\s*:\s*(\d+)""").find(out)?.groupValues?.get(1)?.toIntOrNull() ?: 0
            HealthResult(grade, score, days, tokens, reduction)
        } catch (_: Exception) { null }
    }

    // Feature 4: stale notification shown once when context is ≥ 24h old
    private fun showStaleNotification(project: Project, hours: Int) {
        val n = Notification(
            "SigMap",
            "SigMap context is stale",
            "Context is ${hours}h old. Regenerate to keep AI suggestions accurate.",
            NotificationType.WARNING,
        )
        n.addAction(NotificationAction.createSimple("Regenerate") {
            ActionManager.getInstance().getAction("SigMap.RegenerateContext")
                ?.actionPerformed(AnActionEvent.createFromDataContext("", null, DataContext.EMPTY_CONTEXT))
            n.expire()
        })
        n.addAction(NotificationAction.createSimple("Dismiss") { n.expire() })
        Notifications.Bus.notify(n, project)
    }

    private fun getAge(lastModified: FileTime): Duration {
        val now = Instant.now()
        val fileInstant = lastModified.toInstant()
        return Duration.between(fileInstant, now)
    }

    private fun computeGrade(age: Duration): String {
        val hours = age.toHours()
        return when {
            hours < 1  -> "A"
            hours < 6  -> "B"
            hours < 12 -> "C"
            hours < 24 -> "D"
            else       -> "F"
        }
    }

    private fun formatAge(days: Double): String {
        val hours = (days * 24).toLong()
        val minutes = (days * 1440).toLong()
        return when {
            hours >= 24 -> "${(hours / 24)}d"
            hours >= 1  -> "${hours}h"
            else        -> "${minutes}m"
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
