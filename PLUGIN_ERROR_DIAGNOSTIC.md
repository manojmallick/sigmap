# Plugin Error Diagnostic Guide

## To help debug the error you're seeing on all plugins...

Please provide the following information:

### **Where are you seeing the error?**
- [ ] VS Code editor (vscode-extension)
- [ ] Open VSX Registry (vscode-extension)
- [ ] JetBrains IDE (jetbrains-plugin)
- [ ] Extension marketplace
- [ ] Build output
- [ ] Runtime logs
- [ ] Other: _________________

### **What is the exact error message?**

Please paste the full error message or screenshot here:

```
[ERROR MESSAGE HERE]
```

### **When does it occur?**
- [ ] On plugin installation
- [ ] On plugin activation
- [ ] When running "Regenerate Context"
- [ ] When opening context file
- [ ] On marketplace page display
- [ ] Other: _________________

---

## Quick Diagnostics to Run

While you gather the error message, run these commands:

### For VS Code Extension
```bash
cd vscode-extension
npm install
npm run lint
npm run test  # if available
npm run compile
```

### For JetBrains Plugin
```bash
cd jetbrains-plugin
./gradlew build
./gradlew test
```

### For Main CLI
```bash
node gen-context.js --health --json
node gen-context.js --analyze
```

---

## Common Issues to Check

### 1. **Version Mismatch**
- Check `package.json` version matches all plugin versions
- Verify version in: `vscode-extension/package.json`, `jetbrains-plugin/build.gradle.kts`

### 2. **Missing Dependencies**
- Run `npm install` in each plugin directory
- Verify no unresolved imports

### 3. **Build Issues**
- Clean build: `./gradlew clean build` (JetBrains)
- Clear node_modules: `rm -rf node_modules` then `npm install` (VS Code)

### 4. **Configuration Issues**
- Check `gen-context.config.json` validity
- Verify `output` path is writable
- Check `.contextignore` syntax

### 5. **Path Issues**
- Ensure `gen-context.js` is accessible
- Verify `node` is in system PATH
- Check project root detection

---

## Files to Check

```
vscode-extension/
├── package.json          ← version must match
├── src/extension.js      ← check for errors
└── test/                 ← run tests

jetbrains-plugin/
├── build.gradle.kts      ← check syntax
├── src/main/kotlin/      ← check for compilation errors
└── src/test/             ← run tests
```

---

## Once You Provide Error Details

I will:
1. Search codebase for related error handling
2. Create/update error message handling
3. Add test cases for the error scenario
4. Verify fix works across all plugins
5. Update documentation if needed

---

**⚠️ IMPORTANT:** Please paste the exact error message as-is so I can help you fix it!
