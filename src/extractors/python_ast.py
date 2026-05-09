#!/usr/bin/env python3
"""
python_ast.py — Native Python AST-based signature extractor for SigMap.

More accurate than the JS regex approach:
- Handles multiline signatures correctly
- Decorator stacking resolved properly
- Type annotations extracted from AST nodes
- No false positives from regex on string contents

Usage (called by SigMap's python.js extractor as fallback):
    python3 python_ast.py <filepath>

Output: JSON array of signature strings (one per line → stdout)
"""

import ast
import json
import sys

MAX_SIGS = 30
MAX_DOC_HINT_LEN = 60


def annotation_to_str(node):
    """Convert an AST annotation node to a string representation."""
    if node is None:
        return None
    try:
        return ast.unparse(node)
    except Exception:
        # Fallback for older Python versions without ast.unparse
        if isinstance(node, ast.Name):
            return node.id
        if isinstance(node, ast.Attribute):
            return f"{annotation_to_str(node.value)}.{node.attr}"
        if isinstance(node, ast.Subscript):
            val = annotation_to_str(node.value)
            slc = annotation_to_str(node.slice)
            return f"{val}[{slc}]"
        if isinstance(node, ast.Index):
            return annotation_to_str(node.value)
        if isinstance(node, ast.Tuple):
            parts = ", ".join(annotation_to_str(e) for e in node.elts)
            return parts
        if isinstance(node, ast.Constant):
            return repr(node.value)
        return "..."


def format_args(args_node):
    """Format a function arguments node into a compact signature string."""
    parts = []
    all_args = args_node.args or []
    defaults = args_node.defaults or []
    # Align defaults to the right of args
    default_offset = len(all_args) - len(defaults)

    for i, arg in enumerate(all_args):
        name = arg.arg
        ann = annotation_to_str(arg.annotation) if arg.annotation else None
        default_idx = i - default_offset
        has_default = default_idx >= 0
        token = name
        if ann:
            token = f"{name}: {ann}"
        if has_default:
            token = f"{token}=..."
        parts.append(token)

    # *args
    vararg = args_node.vararg
    if vararg:
        ann = annotation_to_str(vararg.annotation) if vararg.annotation else None
        token = f"*{vararg.arg}"
        if ann:
            token = f"*{vararg.arg}: {ann}"
        parts.append(token)

    # keyword-only args
    kwonly = args_node.kwonlyargs or []
    kw_defaults = args_node.kw_defaults or []
    for i, arg in enumerate(kwonly):
        name = arg.arg
        ann = annotation_to_str(arg.annotation) if arg.annotation else None
        has_default = i < len(kw_defaults) and kw_defaults[i] is not None
        token = name
        if ann:
            token = f"{name}: {ann}"
        if has_default:
            token = f"{token}=..."
        parts.append(token)

    # **kwargs
    kwarg = args_node.kwarg
    if kwarg:
        ann = annotation_to_str(kwarg.annotation) if kwarg.annotation else None
        token = f"**{kwarg.arg}"
        if ann:
            token = f"**{kwarg.arg}: {ann}"
        parts.append(token)

    return ", ".join(parts)


def get_decorator_names(node):
    """Return a list of decorator name strings for a function/class node."""
    names = []
    for dec in node.decorator_list:
        if isinstance(dec, ast.Name):
            names.append(dec.id)
        elif isinstance(dec, ast.Attribute):
            names.append(dec.attr)
        elif isinstance(dec, ast.Call):
            func = dec.func
            if isinstance(func, ast.Name):
                names.append(func.id)
            elif isinstance(func, ast.Attribute):
                names.append(func.attr)
    return names


def is_dataclass(node):
    return "dataclass" in get_decorator_names(node)


def is_basemodel(bases):
    """Check if class bases include BaseModel or BaseSettings."""
    for base in bases:
        name = annotation_to_str(base) or ""
        if "BaseModel" in name or "BaseSettings" in name:
            return True
    return False


def is_optional_annotation(annotation):
    """Check if an annotation represents an Optional type."""
    if annotation is None:
        return False
    ann_str = annotation_to_str(annotation) or ""
    return (
        "Optional[" in ann_str
        or ("Union[" in ann_str and "None" in ann_str)
        or "| None" in ann_str
        or "None |" in ann_str
    )


def get_docstring_hint(node):
    """Extract first sentence of docstring, if present."""
    try:
        doc = ast.get_docstring(node)
        if doc:
            first_line = doc.strip().splitlines()[0]
            return first_line[:MAX_DOC_HINT_LEN] if len(first_line) > MAX_DOC_HINT_LEN else first_line
    except Exception:
        pass
    return None


def extract_dataclass_fields(class_node):
    """Return a collapsed fields string for a @dataclass class."""
    fields = []
    for stmt in class_node.body:
        if isinstance(stmt, ast.AnnAssign) and isinstance(stmt.target, ast.Name):
            name = stmt.target.id
            has_default = stmt.value is not None
            is_optional = is_optional_annotation(stmt.annotation) or has_default
            suffix = "?" if is_optional else ""
            fields.append(f"{name}{suffix}")
    return ", ".join(fields)


def extract_basemodel_fields(class_node):
    """Return a compact {required*, optional?} string for a BaseModel subclass."""
    req = []
    opt = []
    for stmt in class_node.body:
        if isinstance(stmt, ast.AnnAssign) and isinstance(stmt.target, ast.Name):
            name = stmt.target.id
            has_default = stmt.value is not None
            is_optional = is_optional_annotation(stmt.annotation) or has_default
            if is_optional:
                opt.append(f"{name}?")
            else:
                req.append(f"{name}*")
    all_fields = req + opt
    if not all_fields:
        return None
    return "{" + ", ".join(all_fields) + "}"


def extract_class_constants(class_node):
    """Yield ALL_CAPS constant assignments from class body."""
    for stmt in class_node.body:
        if isinstance(stmt, ast.Assign):
            for target in stmt.targets:
                if isinstance(target, ast.Name) and target.id.isupper():
                    try:
                        val = ast.unparse(stmt.value)
                    except Exception:
                        val = "..."
                    yield f"{target.id}={val}"
        elif isinstance(stmt, ast.AnnAssign) and isinstance(stmt.target, ast.Name):
            name = stmt.target.id
            if name.isupper():
                val = "..."
                if stmt.value:
                    try:
                        val = ast.unparse(stmt.value)
                    except Exception:
                        pass
                yield f"{name}={val}"


def extract_method_sig(func_node):
    """Format a method signature string (already indented by caller)."""
    is_async = isinstance(func_node, ast.AsyncFunctionDef)
    prefix = "async " if is_async else ""
    params = format_args(func_node.args)
    ret = annotation_to_str(func_node.returns) if func_node.returns else None
    ret_str = f" → {ret}" if ret else ""
    return f"{prefix}def {func_node.name}({params}){ret_str}"


def extract_function_sig(func_node, src_lines=None):
    """Format a top-level function signature string."""
    is_async = isinstance(func_node, ast.AsyncFunctionDef)
    prefix = "async " if is_async else ""
    params = format_args(func_node.args)
    ret = annotation_to_str(func_node.returns) if func_node.returns else None
    ret_str = f" → {ret}" if ret else ""
    hint = get_docstring_hint(func_node)
    hint_str = f"  # {hint}" if hint else ""
    return f"{prefix}def {func_node.name}({params}){ret_str}{hint_str}"


def extract_fastapi_routes(tree, src_lines):
    """Extract FastAPI route signatures from top-level decorated functions only."""
    routes = []
    http_methods = {"get", "post", "put", "patch", "delete", "head"}
    for node in tree.body:
        if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            continue
        for dec in node.decorator_list:
            if not isinstance(dec, ast.Call):
                continue
            func = dec.func
            if not isinstance(func, ast.Attribute):
                continue
            method = func.attr.lower()
            if method not in http_methods:
                continue
            if dec.args:
                path_node = dec.args[0]
                if isinstance(path_node, ast.Constant):
                    path = path_node.value
                    routes.append(f"{method.upper()} {path}  →  {node.name}()")
    return routes


def extract(filepath):
    with open(filepath, "r", encoding="utf-8", errors="replace") as f:
        src = f.read()

    tree = ast.parse(src, filename=filepath)
    src_lines = src.splitlines()
    sigs = []

    # Walk top-level statements only
    for node in tree.body:
        if len(sigs) >= MAX_SIGS:
            break

        # Classes
        if isinstance(node, ast.ClassDef):
            bases_str = ", ".join(annotation_to_str(b) for b in node.bases if b)
            dec_names = get_decorator_names(node)

            if is_dataclass(node):
                fields = extract_dataclass_fields(node)
                sigs.append(f"@dataclass {node.name}({fields})")
            elif is_basemodel(node.bases):
                bm_fields = extract_basemodel_fields(node)
                base_label = next(
                    (annotation_to_str(b) for b in node.bases
                     if "BaseModel" in (annotation_to_str(b) or "") or "BaseSettings" in (annotation_to_str(b) or "")),
                    "BaseModel"
                )
                if bm_fields:
                    sigs.append(f"class {node.name}({base_label}) {bm_fields}")
                else:
                    sigs.append(f"class {node.name}({base_label})")
            else:
                base_part = f"({bases_str})" if bases_str else ""
                sigs.append(f"class {node.name}{base_part}")

            # Class constants
            for const in extract_class_constants(node):
                if len(sigs) >= MAX_SIGS:
                    break
                sigs.append(f"  {const}")

            # Methods (skip private except __init__, skip all other dunder)
            for stmt in node.body:
                if len(sigs) >= MAX_SIGS:
                    break
                if not isinstance(stmt, (ast.FunctionDef, ast.AsyncFunctionDef)):
                    continue
                name = stmt.name
                if name.startswith("_") and name != "__init__":
                    continue
                sigs.append(f"  {extract_method_sig(stmt)}")

        # Top-level functions
        elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            if node.name.startswith("_"):
                continue
            sigs.append(extract_function_sig(node, src_lines))

    # FastAPI routes (extract top-level decorated functions)
    routes = extract_fastapi_routes(tree, src_lines)
    seen_sigs = set(sigs)
    for route in routes:
        if len(sigs) >= MAX_SIGS:
            break
        if route not in seen_sigs:
            sigs.append(route)
            seen_sigs.add(route)

    return sigs[:MAX_SIGS]


def main():
    if len(sys.argv) < 2:
        print("[]")
        return

    filepath = sys.argv[1]
    try:
        sigs = extract(filepath)
        print(json.dumps(sigs))
    except Exception:
        print("[]")


if __name__ == "__main__":
    main()
