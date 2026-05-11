#!/usr/bin/env python3
"""
test_python_ast_extractor.py — Tests for python_ast.py native extractor.

Covers: dataclasses, BaseModel fields, multiline signatures, private functions,
syntax errors, signature cap, and nested function behavior.
"""

import ast
import json
import os
import subprocess
import sys
import tempfile
import unittest


class TestPythonASTExtractor(unittest.TestCase):
    """Test the python_ast.py signature extractor."""

    def run_extractor(self, code):
        """Write code to temp file, run extractor, parse output."""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
            f.write(code)
            filepath = f.name

        try:
            # Get the extractor path
            extractor = os.path.join(os.path.dirname(__file__), '..', 'src', 'extractors', 'python_ast.py')
            result = subprocess.run(
                [sys.executable, extractor, filepath],
                capture_output=True,
                text=True,
                timeout=5
            )
            if result.returncode == 0 and result.stdout.strip():
                return json.loads(result.stdout.strip())
            return []
        finally:
            os.unlink(filepath)

    def test_dataclass_with_optional_fields(self):
        """Dataclass with Optional, | None, and default values."""
        code = '''
from dataclasses import dataclass
from typing import Optional

@dataclass
class User:
    id: int
    name: str | None
    email: Optional[str]
    age: int = 0
'''
        sigs = self.run_extractor(code)
        self.assertTrue(any('@dataclass' in s for s in sigs), "Should have @dataclass signature")
        dc_sig = next(s for s in sigs if '@dataclass' in s)
        self.assertIn('id', dc_sig)
        self.assertIn('name?', dc_sig, "name should be marked optional")
        self.assertIn('email?', dc_sig, "email should be marked optional")
        self.assertIn('age?', dc_sig, "age has default so should be optional")

    def test_basemodel_fields(self):
        """Pydantic BaseModel with required and optional fields."""
        code = '''
from pydantic import BaseModel
from typing import Optional

class UserModel(BaseModel):
    id: int
    name: str | None
    email: Optional[str] = None
    active: bool = True
'''
        sigs = self.run_extractor(code)
        self.assertTrue(any('UserModel' in s and 'BaseModel' in s for s in sigs),
                       "Should have UserModel(BaseModel) signature")
        bm_sig = next(s for s in sigs if 'UserModel' in s)
        self.assertIn('{', bm_sig, "Should have field list in braces")
        self.assertIn('id*', bm_sig, "id is required")
        self.assertIn('name?', bm_sig, "name is optional")
        self.assertIn('email?', bm_sig, "email is optional")

    def test_multiline_function_signature(self):
        """Function with parameters spanning multiple lines."""
        code = '''
def process_data(
    filepath: str,
    delimiter: str = ",",
    skip_rows: int = 0,
    encoding: str = "utf-8"
) -> dict:
    """Process a CSV file."""
    return {}
'''
        sigs = self.run_extractor(code)
        func_sig = next((s for s in sigs if 'process_data' in s), None)
        self.assertIsNotNone(func_sig, "Should extract multiline signature")
        self.assertIn('filepath', func_sig)
        self.assertIn('delimiter', func_sig)
        self.assertIn('skip_rows', func_sig)
        self.assertIn('encoding', func_sig)
        self.assertIn('→ dict', func_sig, "Should include return annotation")

    def test_private_functions_excluded(self):
        """Private functions (_foo) should be excluded, except methods."""
        code = '''
def public_func():
    pass

def _private_func():
    pass

def __dunder_func():
    pass

class MyClass:
    def __init__(self):
        pass

    def public_method(self):
        pass

    def _private_method(self):
        pass
'''
        sigs = self.run_extractor(code)
        sigs_str = ' '.join(sigs)
        self.assertIn('public_func', sigs_str)
        self.assertNotIn('_private_func', sigs_str, "_private_func should be excluded")
        self.assertNotIn('__dunder_func', sigs_str, "__dunder_func should be excluded")
        self.assertIn('__init__', sigs_str, "__init__ should be included (exception)")
        self.assertNotIn('_private_method', sigs_str, "_private_method should be excluded")

    def test_syntax_error_file(self):
        """File with syntax errors should return empty list."""
        code = 'def bad syntax here'
        sigs = self.run_extractor(code)
        self.assertEqual(sigs, [], "Syntax error should return empty list")

    def test_signature_cap_at_max_sigs(self):
        """When signatures exceed MAX_SIGS (30), should cap at 30."""
        # Generate 40+ function definitions
        funcs = '\n'.join(f'def func_{i}():\n    pass' for i in range(45))
        code = funcs
        sigs = self.run_extractor(code)
        self.assertEqual(len(sigs), 30, "Should cap at MAX_SIGS=30")
        # Verify first funcs are captured
        self.assertTrue(any('func_0' in s for s in sigs))

    def test_nested_fastapi_routes_excluded(self):
        """Nested function with FastAPI decorator should NOT be extracted."""
        code = '''
from fastapi import FastAPI

app = FastAPI()

def outer():
    @app.get("/nested")
    def nested_route():
        return {}
    return nested_route

@app.get("/top-level")
def top_level():
    return {}
'''
        sigs = self.run_extractor(code)
        sigs_str = ' '.join(sigs)
        self.assertIn('GET /top-level', sigs_str, "Top-level route should be extracted")
        self.assertNotIn('/nested', sigs_str, "Nested route should NOT be extracted")

    def test_async_function_signature(self):
        """Async functions should have 'async' prefix."""
        code = '''
async def fetch_data(url: str) -> dict:
    return {}

async def _private_async():
    pass
'''
        sigs = self.run_extractor(code)
        async_sig = next((s for s in sigs if 'fetch_data' in s), None)
        self.assertIsNotNone(async_sig)
        self.assertTrue(async_sig.startswith('async '), "Should have async prefix")

    def test_docstring_hint_truncation(self):
        """Docstring hints should be truncated at MAX_DOC_HINT_LEN (60)."""
        code = '''
def my_function():
    """This is a very long docstring that definitely exceeds the maximum length limit."""
    pass
'''
        sigs = self.run_extractor(code)
        func_sig = next((s for s in sigs if 'my_function' in s), None)
        self.assertIsNotNone(func_sig)
        if '#' in func_sig:
            hint = func_sig.split('#')[1].strip()
            self.assertLessEqual(len(hint), 60, "Docstring hint should be capped at 60 chars")

    def test_class_with_bases(self):
        """Classes with inheritance should show base classes."""
        code = '''
class Animal:
    pass

class Dog(Animal):
    def bark(self):
        pass
'''
        sigs = self.run_extractor(code)
        dog_sig = next((s for s in sigs if 'class Dog' in s), None)
        self.assertIsNotNone(dog_sig)
        self.assertIn('Animal', dog_sig, "Should show base class")

    def test_fastapi_multiple_methods(self):
        """FastAPI routes with different HTTP methods."""
        code = '''
from fastapi import FastAPI

app = FastAPI()

@app.get("/items")
def list_items():
    return []

@app.post("/items")
def create_item(data: dict):
    return data

@app.put("/items/{id}")
def update_item(id: int):
    return {}
'''
        sigs = self.run_extractor(code)
        sigs_str = ' '.join(sigs)
        self.assertIn('GET /items', sigs_str)
        self.assertIn('POST /items', sigs_str)
        self.assertIn('PUT /items/{id}', sigs_str)

    def test_empty_class(self):
        """Empty class should still be captured."""
        code = '''
class Empty:
    pass
'''
        sigs = self.run_extractor(code)
        self.assertTrue(any('Empty' in s for s in sigs))

    def test_complex_type_annotations(self):
        """Complex type annotations should be handled."""
        code = '''
from typing import List, Dict, Union

def transform(
    data: List[Dict[str, Union[int, str]]],
    config: Dict = None
) -> List[str]:
    return []
'''
        sigs = self.run_extractor(code)
        func_sig = next((s for s in sigs if 'transform' in s), None)
        self.assertIsNotNone(func_sig)
        self.assertIn('transform', func_sig)


if __name__ == '__main__':
    unittest.main()
