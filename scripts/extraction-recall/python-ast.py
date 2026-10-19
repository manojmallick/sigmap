# Ground truth for scripts/extraction-recall/python.mjs: the functions, classes and methods
# that CPython's own parser (ast) finds in each file named on the command line.
#
#   python3 python-ast.py file.py [file.py ...]   # prints { "version": "3.9.6", "files": { file: [[kind, name], ...] } }
#
# kind is "func" (module level def / async def), "class" (module level class) or "method"
# ("Class.name", a def or async def directly in a module level class body). A file ast cannot
# parse (a syntax newer than this Python) is left out, and the comparison leaves it out on
# both sides. Dev-only: nothing here ships in the npm package and nothing at runtime uses it.
import ast
import json
import platform
import sys

out = {}
for path in sys.argv[1:]:
    try:
        with open(path, encoding='utf-8', errors='replace') as fh:
            tree = ast.parse(fh.read())
    except Exception:
        continue
    items = []
    for n in tree.body:
        if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef)):
            items.append(['func', n.name])
        elif isinstance(n, ast.ClassDef):
            items.append(['class', n.name])
            for m in n.body:
                if isinstance(m, (ast.FunctionDef, ast.AsyncFunctionDef)):
                    items.append(['method', n.name + '.' + m.name])
    out[path] = items
json.dump({'version': platform.python_version(), 'files': out}, sys.stdout)
