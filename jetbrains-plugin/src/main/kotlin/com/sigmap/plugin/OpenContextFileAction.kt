package com.sigmap.plugin

import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.fileEditor.FileEditorManager
import com.intellij.openapi.vfs.LocalFileSystem
import java.io.File

class OpenContextFileAction : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        val projectPath = project.basePath ?: return
        
        val contextFile = File(projectPath, ".github/copilot-instructions.md")
        
        if (!contextFile.exists()) {
            // Try alternative paths
            val alternativePaths = listOf(
                "CLAUDE.md",
                ".cursorrules",
                ".windsurfrules"
            )
            
            for (altPath in alternativePaths) {
                val altFile = File(projectPath, altPath)
                if (altFile.exists()) {
                    openFile(project, altFile)
                    return
                }
            }
            
            return
        }
        
        openFile(project, contextFile)
    }
    
    private fun openFile(project: com.intellij.openapi.project.Project, file: File) {
        val virtualFile = LocalFileSystem.getInstance().findFileByIoFile(file) ?: return
        FileEditorManager.getInstance(project).openFile(virtualFile, true)
    }
    
    override fun update(e: AnActionEvent) {
        e.presentation.isEnabled = e.project != null
    }
}
