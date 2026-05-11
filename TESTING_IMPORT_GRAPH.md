# Import Graph Testing Guide

**Status:** Fixes for issues #181 and #182 have been merged to `develop` branch.

This guide helps you test whether the import graph improvements work on your 700-file Python monorepo.

---

## What Changed

### ✅ Issue #182: Import Graph Analysis Improvements
- Added comprehensive Python absolute import detection (`from package.module import X`)
- Improved edge case handling (monorepos, circular imports, multiple file extensions)
- Added diagnostic tools to debug import detection
- 8 regression tests (all passing)

### ✅ Issue #181: Python Absolute Imports
- Now detects: `from models.account import Account`
- Now detects: `from services.scheduler import process_accounts`
- Now detects: Nested imports like `from services.auth.oauth import get_token`

---

## Step-by-Step Testing

### 1. Pull the latest code

```bash
git pull origin develop
```

### 2. Generate the context file

```bash
node gen-context.js
# Output should show your 700 files scanned, import detection analysis
```

### 3. Run the import graph diagnostics

This new tool shows exactly what imports are being detected:

```bash
# Show summary of top imported/importing files
node sigmap-diagnostics.js --summary

# Analyze a specific file that had issues (e.g., account.py)
node sigmap-diagnostics.js --file src/models/account.py

# Find files matching a pattern
node sigmap-diagnostics.js --grep "scheduler"

# Verbose mode for more details
node sigmap-diagnostics.js --file src/models/account.py --verbose
```

**Expected output from diagnostics:**
- Shows which files import account.py (should show your 17+ importers)
- Shows what account.py imports
- Summary stats on total import edges detected

### 4. Test MCP tools

Now test the tools that depend on the import graph:

```bash
# Test explain_file (imports section)
node -e "
const { explainFile } = require('./src/mcp/handlers.js');
const result = explainFile({ path: 'src/models/account.py' }, process.cwd());
console.log(result);
" | grep -A 10 "## Imports"

# Test explain_file (callers section)
# Should show the 17+ files that import account.py
node -e "
const { explainFile } = require('./src/mcp/handlers.js');
const result = explainFile({ path: 'src/models/account.py' }, process.cwd());
console.log(result);
" | grep -A 20 "## Callers"

# Test get_impact
node -e "
const { getImpact } = require('./src/mcp/handlers.js');
const result = getImpact({ file: 'src/models/account.py' }, process.cwd());
console.log(result);
" | head -20
```

### 5. Run the test suite

```bash
# All tests should pass
node test/integration/all.js

# Specific import graph tests
node test/regression/mcp-tools-comprehensive.js
```

---

## Success Criteria

✅ **FULL FIX** (90%+ import graph populated):
- `node sigmap-diagnostics.js --file src/models/account.py` shows 17+ callers
- `explain_file` shows your actual import dependencies
- `get_impact` shows blast radius of 17+ files
- All MCP tools return non-empty results

⚠️ **PARTIAL FIX** (50-89% import graph populated):
- `explain_file` shows some callers but not all 17
- `get_impact` shows some blast radius but incomplete
- Some import patterns not detected
- → Debug output will help identify which patterns are missing

❌ **ISSUE PERSISTS** (<50% import graph populated):
- Similar to before: mostly empty results
- → Run `node sigmap-diagnostics.js --summary` and share output for debugging

---

## Diagnostic Output Checklist

When testing, collect this information:

```bash
# 1. Summary stats
node sigmap-diagnostics.js --summary

# 2. Specific file analysis
node sigmap-diagnostics.js --file src/models/account.py --verbose

# 3. Test results
node test/regression/mcp-tools-comprehensive.js

# 4. MCP tool results (from commands above)
```

---

## Expected vs Actual

### From Issue #181:
- **Before:** "No indexed files import this file" + "No resolvable relative imports found"
- **After:** Shows 17+ importers and import dependencies

### Expected Pattern Detection:
```python
✓ from models.account import Account
✓ from models.account import AccountManager
✓ from services.scheduler import process_accounts
✓ from config import SETTINGS
✓ from . import sibling
✓ from .. import parent
✓ from ...grandparent import X
```

---

## If Tests Fail

If imports are still showing as empty:

1. **Check file structure:**
   ```bash
   find src -name "*.py" | head -20
   # Are __init__.py files present?
   find src -name "__init__.py" | wc -l
   ```

2. **Check actual import statements in files:**
   ```bash
   grep -r "from models" src/services/*.py | head -5
   grep -r "from services" src/models/*.py | head -5
   ```

3. **Run diagnostics with verbose mode:**
   ```bash
   node sigmap-diagnostics.js --file src/models/account.py --verbose
   ```

4. **Share output from:**
   - `node sigmap-diagnostics.js --summary`
   - `node sigmap-diagnostics.js --file src/models/account.py`
   - Result of `node test/regression/mcp-tools-comprehensive.js`

This information will help identify which import patterns are not being detected.

---

## Timeline

| Stage | Status | Next |
|-------|--------|------|
| Development | ✅ Complete | → You test on your project |
| User Testing | ⏳ Pending | → Share diagnostic results |
| If 90%+ success | → `/ship` to main and release | |
| If <90% success | → Debug & iterate on identify patterns | |

---

## Questions?

If you encounter issues:
1. Run `node sigmap-diagnostics.js --summary`
2. Run `node sigmap-diagnostics.js --file <file-that-had-issues>`
3. Share the output in the issue
4. Include the file patterns (show imports in those files with grep)

The diagnostics tool will show exactly what's being detected vs what's missing.
