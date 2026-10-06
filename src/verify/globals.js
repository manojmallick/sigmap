'use strict';

/**
 * Language globals the Hallucination Guard must never flag (#777).
 *
 * `fake-symbol` asks "is this name defined in the repo?" — a question that is
 * only meaningful for names the *language* does not already define. The guard
 * previously carried a hand-maintained inline list that stopped at
 * `encodeURIComponent`, so `structuredClone(obj)` — a Node and browser global
 * since Node 17 — was reported as a hallucination at `high` confidence, with a
 * suggested replacement drawn from a test fixture.
 *
 * Kept as grouped data rather than one literal so a missing global is a
 * one-line addition to the right group, and so the groups can be asserted
 * individually in tests.
 *
 * Zero dependencies, deterministic.
 */

/** ECMAScript built-ins available in every JS runtime. */
const ES_GLOBALS = [
  'Object', 'Array', 'String', 'Number', 'Boolean', 'Symbol', 'BigInt',
  'Math', 'JSON', 'Date', 'RegExp', 'Error', 'TypeError', 'RangeError',
  'SyntaxError', 'ReferenceError', 'EvalError', 'URIError', 'AggregateError',
  'Promise', 'Map', 'Set', 'WeakMap', 'WeakSet', 'WeakRef', 'Proxy', 'Reflect',
  'Function', 'Intl', 'globalThis', 'eval', 'parseInt', 'parseFloat',
  'isNaN', 'isFinite', 'encodeURIComponent', 'decodeURIComponent',
  'encodeURI', 'decodeURI', 'structuredClone', 'queueMicrotask',
  'ArrayBuffer', 'SharedArrayBuffer', 'DataView', 'Atomics',
  'Int8Array', 'Uint8Array', 'Uint8ClampedArray', 'Int16Array', 'Uint16Array',
  'Int32Array', 'Uint32Array', 'Float32Array', 'Float64Array',
  'BigInt64Array', 'BigUint64Array', 'Generator', 'AsyncGenerator',
];

/** Web/Node platform globals — available in browsers, Node, or both. */
const WEB_GLOBALS = [
  'console', 'fetch', 'Request', 'Response', 'Headers', 'FormData',
  'URL', 'URLSearchParams', 'AbortController', 'AbortSignal',
  'TextEncoder', 'TextDecoder', 'Blob', 'File', 'FileReader',
  'ReadableStream', 'WritableStream', 'TransformStream',
  'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
  'setImmediate', 'clearImmediate', 'atob', 'btoa',
  'crypto', 'performance', 'structuredClone', 'EventTarget', 'Event',
  'CustomEvent', 'MessageChannel', 'MessagePort', 'BroadcastChannel',
  'WebSocket', 'Worker', 'navigator', 'location', 'document', 'window',
  'localStorage', 'sessionStorage', 'alert', 'requestAnimationFrame',
  'cancelAnimationFrame', 'IntersectionObserver', 'ResizeObserver',
  'MutationObserver', 'DOMParser', 'XMLHttpRequest',
];

/** Node module-scope identifiers and globals. */
const NODE_GLOBALS = [
  'require', 'module', 'exports', '__dirname', '__filename',
  'process', 'Buffer', 'global',
];

/** Test-runner globals — present via the runner, never defined in the repo. */
const TEST_GLOBALS = [
  'describe', 'it', 'test', 'expect', 'beforeEach', 'afterEach',
  'beforeAll', 'afterAll', 'before', 'after', 'jest', 'vi', 'suite',
];

/** Python built-ins. */
const PY_GLOBALS = [
  'print', 'len', 'range', 'str', 'int', 'float', 'dict', 'list', 'tuple',
  'set', 'frozenset', 'bool', 'bytes', 'bytearray', 'open', 'enumerate',
  'zip', 'map', 'filter', 'sorted', 'reversed', 'sum', 'min', 'max', 'abs',
  'round', 'pow', 'divmod', 'isinstance', 'issubclass', 'super', 'type',
  'getattr', 'setattr', 'hasattr', 'delattr', 'repr', 'hash', 'id', 'iter',
  'next', 'any', 'all', 'callable', 'format', 'vars', 'dir', 'input',
  'staticmethod', 'classmethod', 'property', 'slice', 'complex', 'ord', 'chr',
];

/**
 * Python standard-library top-level modules (3.8 – 3.12, public names).
 *
 * Module names, not symbols — so deliberately NOT part of `GROUPS` (which
 * flattens into `LANG_GLOBALS`, the names `fake-symbol` never flags). Used to
 * recognise an `import os.path` as real without a package manifest, and to
 * leave a repo package that shadows one (`queue/`, `types/`) undecided rather
 * than flag a standard-library submodule it does not have (#909).
 */
const PY_STDLIB = [
  '__future__', '__main__', '_thread', 'abc', 'aifc', 'argparse', 'array',
  'ast', 'asynchat', 'asyncio', 'asyncore', 'atexit', 'audioop', 'base64',
  'bdb', 'binascii', 'binhex', 'bisect', 'builtins', 'bz2', 'cProfile',
  'calendar', 'cgi', 'cgitb', 'chunk', 'cmath', 'cmd', 'code', 'codecs',
  'codeop', 'collections', 'colorsys', 'compileall', 'concurrent',
  'configparser', 'contextlib', 'contextvars', 'copy', 'copyreg', 'crypt',
  'csv', 'ctypes', 'curses', 'dataclasses', 'datetime', 'dbm', 'decimal',
  'difflib', 'dis', 'distutils', 'doctest', 'email', 'encodings', 'ensurepip',
  'enum', 'errno', 'faulthandler', 'fcntl', 'filecmp', 'fileinput', 'fnmatch',
  'fractions', 'ftplib', 'functools', 'gc', 'genericpath', 'getopt', 'getpass',
  'gettext', 'glob', 'graphlib', 'grp', 'gzip', 'hashlib', 'heapq', 'hmac',
  'html', 'http', 'idlelib', 'imaplib', 'imghdr', 'imp', 'importlib',
  'inspect', 'io', 'ipaddress', 'itertools', 'json', 'keyword', 'lib2to3',
  'linecache', 'locale', 'logging', 'lzma', 'mailbox', 'mailcap', 'marshal',
  'math', 'mimetypes', 'mmap', 'modulefinder', 'msilib', 'msvcrt',
  'multiprocessing', 'netrc', 'nis', 'nntplib', 'nt', 'ntpath', 'nturl2path',
  'numbers', 'opcode', 'operator', 'optparse', 'os', 'ossaudiodev', 'pathlib',
  'pdb', 'pickle', 'pickletools', 'pipes', 'pkgutil', 'platform', 'plistlib',
  'poplib', 'posix', 'posixpath', 'pprint', 'profile', 'pstats', 'pty', 'pwd',
  'py_compile', 'pyclbr', 'pydoc', 'pydoc_data', 'pyexpat', 'queue', 'quopri',
  'random', 're', 'readline', 'reprlib', 'resource', 'rlcompleter', 'runpy',
  'sched', 'secrets', 'select', 'selectors', 'shelve', 'shlex', 'shutil',
  'signal', 'site', 'smtpd', 'smtplib', 'sndhdr', 'socket', 'socketserver',
  'spwd', 'sqlite3', 'sre_compile', 'sre_constants', 'sre_parse', 'ssl', 'stat',
  'statistics', 'string', 'stringprep', 'struct', 'subprocess', 'sunau',
  'symtable', 'sys', 'sysconfig', 'syslog', 'tabnanny', 'tarfile', 'telnetlib',
  'tempfile', 'termios', 'textwrap', 'this', 'threading', 'time', 'timeit',
  'tkinter', 'token', 'tokenize', 'tomllib', 'trace', 'traceback',
  'tracemalloc', 'tty', 'turtle', 'turtledemo', 'types', 'typing',
  'unicodedata', 'unittest', 'urllib', 'uu', 'uuid', 'venv', 'warnings',
  'wave', 'weakref', 'webbrowser', 'winreg', 'winsound', 'wsgiref', 'xdrlib',
  'xml', 'xmlrpc', 'zipapp', 'zipfile', 'zipimport', 'zlib', 'zoneinfo',
];

/**
 * Go standard-library top-level package directories (1.21 – 1.23).
 *
 * An import whose first path element is one of these is the standard library,
 * which needs no manifest to be real. A third-party module always starts with
 * a domain, so this list never claims one (#909).
 */
const GO_STDLIB = [
  'archive', 'bufio', 'bytes', 'cmp', 'compress', 'container', 'context',
  'crypto', 'database', 'debug', 'embed', 'encoding', 'errors', 'expvar',
  'flag', 'fmt', 'go', 'hash', 'html', 'image', 'index', 'io', 'iter', 'log',
  'maps', 'math', 'mime', 'net', 'os', 'path', 'plugin', 'reflect', 'regexp',
  'runtime', 'slices', 'sort', 'strconv', 'strings', 'structs', 'sync',
  'syscall', 'testing', 'text', 'time', 'unicode', 'unique', 'unsafe',
];

const GROUPS = {
  es: ES_GLOBALS,
  web: WEB_GLOBALS,
  node: NODE_GLOBALS,
  test: TEST_GLOBALS,
  python: PY_GLOBALS,
};

/** Every global, flattened — the set the guard checks against. */
const LANG_GLOBALS = new Set(
  Object.values(GROUPS).reduce((acc, g) => acc.concat(g), [])
);

module.exports = { LANG_GLOBALS, GROUPS, ES_GLOBALS, WEB_GLOBALS, NODE_GLOBALS, TEST_GLOBALS, PY_GLOBALS, PY_STDLIB, GO_STDLIB };
