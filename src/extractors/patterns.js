'use strict';

/**
 * Phase D: Cross-module pattern inference and architectural detection.
 * Identifies DI patterns, service/repo layers, circular deps, type linkage, and unsafe patterns.
 *
 * @param {string} src - Raw source code
 * @returns {string[]} Array of pattern signatures
 */
function extract(src) {
  if (!src || typeof src !== 'string') return [];
  const sigs = [];

  // ────────────────────────────────────────────────────────────────
  // Dependency Injection Pattern Detection
  // ────────────────────────────────────────────────────────────────

  // Service container / factory patterns
  const containerRe = /(?:class|function|const)\s+([A-Z]\w*(?:Container|Factory|Registry|Provider|Injector))\b/g;
  for (const m of src.matchAll(containerRe)) {
    sigs.push(`di-container ${m[1]}`);
  }

  // Service decorators: @Injectable, @Service, @Singleton, @Provide
  const decoratorRe = /@(?:Injectable|Service|Singleton|Provide|Module|Component)\s*(?:\([^)]*\))?\s*(?:class|export\s+class|const\s+)\s+([A-Z]\w*)/g;
  for (const m of src.matchAll(decoratorRe)) {
    sigs.push(`service-decorated ${m[1]}`);
  }

  // Dependency injection via constructor: constructor(private readonly ...: Service)
  const ctorDiRe = /constructor\s*\([^)]*(?:private|protected)?\s+(?:readonly\s+)?([a-z_]\w*)\s*:\s*([A-Z]\w*)/g;
  const diServices = new Set();
  for (const m of src.matchAll(ctorDiRe)) {
    diServices.add(m[1]);
  }
  if (diServices.size > 0) {
    sigs.push(`di-injection ${diServices.size} params`);
  }

  // ────────────────────────────────────────────────────────────────
  // Service/Repository/Middleware Layer Detection
  // ────────────────────────────────────────────────────────────────

  // Repository pattern: extends Repository, implements IRepository
  const repoRe = /class\s+([A-Z]\w*(?:Repository|Repo|DataAccess))\b/g;
  for (const m of src.matchAll(repoRe)) {
    sigs.push(`repo ${m[1]}`);
  }

  // Service layer: @Service or ServiceImpl pattern
  const serviceRe = /(?:export\s+)?class\s+([A-Z]\w*Service\b)/g;
  for (const m of src.matchAll(serviceRe)) {
    sigs.push(`service ${m[1]}`);
  }

  // Middleware detection: app.use(), router.use(), middleware function
  if (/app\.use\s*\(|router\.use\s*\(|\.use\s*\(\s*function|middleware|app\.get\s*\(\s*['"`]\/[^'"`]*['"`]/.test(src)) {
    sigs.push('middleware-present');
  }

  // ────────────────────────────────────────────────────────────────
  // Type Linkage: Exported types → Implementations
  // ────────────────────────────────────────────────────────────────

  // Export type/interface followed by class implementing it
  const exportTypeRe = /export\s+(?:type|interface)\s+([A-Z]\w*)/g;
  const exportedTypes = new Set();
  for (const m of src.matchAll(exportTypeRe)) {
    exportedTypes.add(m[1]);
  }

  // Check if exported types have implementations
  for (const type of exportedTypes) {
    const implRe = new RegExp(`class\\s+([A-Z]\\w*)\\s+(?:extends|implements)\\s+(?:.*\\s+)?${type}\\b`, 'i');
    if (implRe.test(src)) {
      sigs.push(`type-impl ${type}`);
    }
  }

  // ────────────────────────────────────────────────────────────────
  // Unsafe Pattern Detection
  // ────────────────────────────────────────────────────────────────

  // Unchecked nulls / optional without validation
  if (/\?\s*{|Optional\s*<|\?\s*\.get\(\)|\?\s*\[|\?\s*\.length|\.split\(\)\.filter\(Boolean\)|if\s*\(\s*!.*\).*throw/.test(src)) {
    sigs.push('unsafe-null-check');
  }

  // Missing validation (direct use of user input)
  const userInputRe = /(?:request|input|params|body|query|args)\s*\[\s*['"][^'"]*['"]\s*\]|req(?:uest)?\..*\s*==|params\.split|String\(.*\)\.toLowerCase/;
  if (userInputRe.test(src)) {
    sigs.push('unsafe-input-validation');
  }

  // Weak error handling (catch {} or empty catch)
  if (/catch\s*\(\s*\)\s*\{|\}\s*catch\s*\{(\s*\/\/|\s*\})/.test(src)) {
    sigs.push('weak-error-handling');
  }

  // Direct error exposure
  if (/throw\s+new\s+Error\(|console\s*\.\s*error|res\.status\(500\)\.send\(err\)/.test(src)) {
    sigs.push('unsafe-error-exposure');
  }

  // ────────────────────────────────────────────────────────────────
  // Circular Dependency Hints
  // ────────────────────────────────────────────────────────────────

  // Mutual imports detected (A imports B, B imports A) — can't directly detect in single file,
  // but we can flag suspicious patterns
  const importRe = /(?:import|require)\s+(?:{[^}]*}|[a-zA-Z_]\w*)\s+from\s+['"]\.?\.?\/[^'"]+['"]/g;
  const importCount = (src.match(importRe) || []).length;
  if (importCount > 5) {
    sigs.push(`heavy-imports ${importCount}`);
  }

  // ────────────────────────────────────────────────────────────────
  // Layer/Module Organization Hints
  // ────────────────────────────────────────────────────────────────

  // Controller/Handler layer
  const controllerRe = /(?:class|export)\s+([A-Z]\w*(?:Controller|Handler|Route))\b/g;
  for (const m of src.matchAll(controllerRe)) {
    sigs.push(`controller ${m[1]}`);
  }

  // Use case / Domain logic
  if (/UseCase|Command|Query|UseCase\b|Interactor/.test(src)) {
    sigs.push('domain-usecase');
  }

  return Array.from(new Set(sigs)).slice(0, 60);
}

module.exports = { extract };
