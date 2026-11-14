#!/usr/bin/env node
'use strict';

/**
 * agent-ab-placebo.mjs — the control for "is it SigMap, or just having something in the prompt?".
 *
 * The `placebo` variant gives the agent's system prompt a block of generic code-search guidance of about the same size as what the `index`
 * setup adds to every turn (the section SigMap writes plus the seven `core` tool definitions: measured, see the study's results page),
 * and nothing else: no repository information, no SigMap, no extra tools. It is deliberately a *strong* placebo — it carries the same
 * kind of behavioural advice the SigMap section does (search with distinctive words, read only the region you need, stop when you have the
 * definition and one more signal) — so that if SigMap beats it, the retrieval is what does the work, and if it does not, the saving came
 * from the prompt and not from the index.
 *
 * Zero dependencies. API agent only (`--agent api`): the text goes in the system prompt the way the SigMap section does.
 */

export const PLACEBO_SECTION = `## Working notes: finding code in an unfamiliar repository

These notes are general. They say nothing about this particular repository; use them as a checklist when a question asks where something is implemented.

### Start from the words of the question
- Pull the distinctive nouns and verbs out of the question and search for those first. A rare word narrows a search faster than a common one.
- Try the spellings a codebase might use for the same idea: snake_case, camelCase, PascalCase, kebab-case, and the singular and plural form. A concept called "retry budget" may be \`retry_budget\`, \`retryBudget\`, \`RetryBudget\` or \`retry-budget\`.
- Search for the literal strings a feature leaves behind: an error message, a command-line flag, a configuration key, an environment variable, a route path, a log line, a header name. These are rarely renamed and are usually defined in exactly one place.
- When a first search returns hundreds of lines, add a second word instead of reading them. When it returns nothing, drop the most specific word and try a synonym before concluding the feature is somewhere else.

### Know where code usually lives
- Source is typically under a directory named \`src\`, \`lib\`, \`pkg\`, \`internal\`, \`app\`, \`cmd\`, or the project's own name. Tests sit beside the source or under \`test\`, \`tests\`, \`spec\` or \`__tests__\`, and they often mirror the source file's name.
- Documentation, examples, fixtures, generated files, build output and vendored dependencies contain many of the same words as the real implementation. They are rarely the answer to where something is implemented. Skip \`dist\`, \`build\`, \`node_modules\`, \`vendor\`, \`target\`, \`.git\` and anything marked as generated.
- Command-line tools usually have one file that parses arguments and several that do the work. The parsing file calls the implementation; the question is usually about the implementation.
- Web frameworks separate routing, handlers or controllers, models and services. A route table tells you which handler runs; the handler tells you which service does the work.

### Let the tests point at the implementation
- A test file's imports name the module it exercises, and its test names describe behaviour in plain words. When you find a test that matches the question, the module it imports is a strong candidate.
- A test shows how a function is meant to be called and what it must return. Read the test before the implementation when the implementation is long.

### Read as little as will answer the question
- Do not open a file to look around. Search first, then read the lines around the match. Most definitions fit in a few dozen lines.
- Use line offsets and limits when you read, and read the next region only when the first one did not settle the question.
- A directory listing is cheap but rarely decisive. Prefer a search for a name over browsing a tree.
- Do not read a whole file because it is short; read it because the search put you there.

### Tell a definition from a use
- The place a name is defined is usually the answer. The places that call it are not, unless the question is about who calls it.
- A function that only forwards its arguments to another function is a wrapper. Follow it one step to the function that does the work, and count that one as the implementation.
- When two files both seem to implement the behaviour, prefer the one that holds the logic over the one that wires it up or exports it.
- Configuration files list options; the code that reads them implements them. A question about a setting's effect is about the reader, not the file that declares the setting.

### Confirm cheaply
- Once you have the definition, look for one more signal that you have the right place: a caller, a test, or an import. Two signals are enough. A third rarely changes the answer.
- If the definition has a clear name but the body does something different from the question, keep looking. If the name is odd but the body does what the question asks, that is your file.
- If you are choosing between candidates, say which you chose and why in one sentence.

### Stop when you have it
- The goal is the right answer, not the most thorough search. When the definition and a second signal agree, stop searching and answer.
- Do not run additional searches to rule out files you have no reason to suspect.
- If you have used several searches and nothing fits, say what you tried and give the best candidates you found rather than continuing indefinitely.

### Language and ecosystem habits
- JavaScript and TypeScript: entry points are named in \`package.json\` (\`main\`, \`module\`, \`exports\`, \`bin\`); an \`index\` file usually re-exports from sibling modules, so follow the export to the file that defines the name. Type-only files (\`.d.ts\`) describe a shape, they do not implement it.
- Python: a package directory with an \`__init__.py\` often re-exports names; the definition is in the submodule. Command-line entry points are declared in \`pyproject.toml\` or \`setup.py\`. Decorators register handlers, so a route or a command may be defined far from where it is dispatched.
- Go: a package is a directory; exported names start with a capital letter. \`cmd/<name>/main.go\` is the thin entry point and the work is in \`internal/\` or \`pkg/\`. Interfaces are declared where they are consumed, which is not always where they are implemented.
- Java, Kotlin and Scala: the directory path mirrors the package name, so the class named in an import statement is a file you can open directly. Dependency injection and annotations hide the link between an interface and its implementation; search for the class that implements or extends it.
- Rust: \`lib.rs\` and \`main.rs\` declare modules with \`mod\`; a \`mod foo;\` line means the code is in \`foo.rs\` or \`foo/mod.rs\`. Trait implementations can live far from the type that they implement.
- Ruby and PHP: the framework's naming convention maps a class name to a file path (\`UsersController\` to \`users_controller.rb\` or \`UsersController.php\`). Routes, jobs and listeners are registered in configuration files that name the class.
- C and C++: declarations are in headers and definitions in source files; a question about behaviour is about the source file, a question about an interface is about the header.

### Large repositories and monorepos
- In a repository with many packages, find the package first (its manifest names it), then search inside it. A search across the whole tree returns the same word from every package.
- Shared helpers live in a common or core package; a feature that several packages use is often defined there once and wrapped elsewhere.
- Build scripts, CI configuration and release tooling mention many names but implement none of the product's behaviour.

### Answering
- Give repository-relative paths, one per line, most likely first. Name only files you have seen evidence for; do not list a file because its name sounds related.
- Add a short reason after each path: the function or class you found there and what it does.
- Do not paste large blocks of code in the answer. A path, a name and a line number are enough.
- State plainly when you are unsure, and name the file you would check next.
`;
