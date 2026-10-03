---
title: Language support
description: SigMap extracts signatures from 38 programming languages and formats. Pure regex, zero Tree-sitter, no binary dependencies. TypeScript, Python, Go, Rust, Java, R, GraphQL, SQL, Terraform, and more.
head:
  - - meta
    - property: og:title
      content: "SigMap Language Support — 38 languages, zero Tree-sitter"
  - - meta
    - property: og:description
      content: "Pure regex AST extraction for 38 languages and formats. No compiler required, no binary dependencies."
  - - meta
    - property: og:url
      content: "https://sigmap.io/guide/languages"
  - - meta
    - property: og:type
      content: article
  - - meta
    - name: keywords
      content: "sigmap languages, typescript signatures, python signatures, go signatures, rust signatures, graphql signatures, sql signatures, terraform signatures, ai context extraction"
---
# Language support

SigMap extracts signatures from 33 programming languages and formats using deterministic, zero-dependency extraction — no Tree-sitter, no native binaries. Every extractor is a single JS file. No grammar files to download. Runs deterministically on any machine with Node.js 18+.

**Stats:** 38 languages · 25 max signatures per file · 0 npm packages

Not every language gets the same depth — the tiers (AST / anchored regex / pattern-heuristic), the truncation caps, and the known regex gaps are stated plainly in [KNOWN_LIMITATIONS.md](https://github.com/manojmallick/sigmap/blob/main/KNOWN_LIMITATIONS.md) (v8.26.1), drift-locked by a guard test.

## How extraction works

Full source code goes in. Only public shapes come out. Bodies, comments, imports, and private members are stripped entirely.

**TypeScript example — input (1,240 tokens):**

```typescript
export interface User {
  id: string;
  email: string;
  createdAt: Date;
}

export class UserService {
  private db: Database;

  async findById(id: string): Promise<User> {
    // implementation...
  }

  async create(dto: CreateDto): Promise<User> { ... }

  private _validate(d: any) { ... }
}
```

**Output (62 tokens) — 95% reduction:**

```
export interface User
export class UserService
  async findById(id: string): Promise<User>
  async create(dto: CreateDto): Promise<User>

# private _validate stripped
# bodies stripped
# comments stripped
```

## What's extracted — and what isn't

### Extracted

- Exported / public classes with public methods
- Exported / public functions and procedures
- Exported types, interfaces, and enums
- Internal classes (unexported, lower priority)
- Internal functions (unexported, lower priority)
- Method signatures — name, parameters, return type
- Generic type parameters and constraints
- Async / await marker where language supports it

### Never extracted

- Function and method bodies (everything inside `{}`)
- Comments — `//`, `/*`, `#`, `"""`, `'''` in all languages
- Import and require statements
- Variable declarations that aren't type definitions
- Private class members (`_prefix`, `#` prefix, `private` keyword)
- Test files (`*.test.*`, `*.spec.*`, `*_test.*`)
- Generated files (`*.pb.*`, `*.generated.*`)
- Any credential, key, token, or secret pattern

## All 38 languages

| Language | Extensions | Extracts |
|----------|------------|----------|
| TypeScript | `.ts` `.tsx` | export function, export class, interface, type alias, enum, methods, generics |
| JavaScript | `.js` `.jsx` `.mjs` `.cjs` | export function, export class, arrow functions, module.exports, methods |
| Python | `.py` `.pyw` | def functions, class, methods, async def, @dataclass, @property |
| Java | `.java` | public class, interface, enum, public methods, annotations |
| Kotlin | `.kt` `.kts` | fun, class, data class, interface, object, sealed class |
| Go | `.go` | func, type struct, interface, method receivers, type alias |
| Rust | `.rs` | pub fn, pub struct, trait, enum, impl methods, pub type |
| C# | `.cs` | public class, interface, enum, public methods, record, struct |
| C / C++ | `.c` `.cpp` `.h` `.hpp` `.cc` | functions, class / struct, public methods, template, typedef |
| Ruby | `.rb` `.rake` | def, class, module, attr_accessor, include / extend |
| PHP | `.php` | function, class, interface, trait, public methods |
| Swift | `.swift` | func, class / struct, protocol, enum, extension |
| Dart | `.dart` | class, void / return type functions, abstract class, mixin, methods |
| Scala | `.scala` `.sc` | def, class, object, trait, case class, methods |
| Vue | `.vue` | defineProps, defineEmits, composables, component name, script functions |
| Svelte | `.svelte` | export let props, export function, script functions, component name |
| HTML | `.html` `.htm` | page title, h1–h3 headings, form id/action, script src, link rel |
| CSS / SCSS / LESS | `.css` `.scss` `.sass` `.less` | CSS variables (--), @mixin, @function, media queries, top-level selectors |
| YAML | `.yml` `.yaml` | top-level keys, CI job names, K8s kind/name, second-level keys |
| Shell | `.sh` `.bash` `.zsh` `.fish` | function names, exported vars, script description |
| Dockerfile | `Dockerfile` `Dockerfile.*` | FROM image, EXPOSE ports, ENTRYPOINT, multi-stage names, ARG / ENV keys |
| GraphQL | `.graphql` `.gql` | type, interface, input, enum, union, scalar, extend type, query / mutation |
| SQL | `.sql` | CREATE TABLE, VIEW, FUNCTION, PROCEDURE, INDEX, TRIGGER, CREATE TYPE |
| Terraform | `.tf` `.tfvars` | resource, data, module, variable, output, provider, locals |
| Protocol Buffers | `.proto` | message, enum, service, rpc, syntax, package |
| R | `.R` `.r` | function, S4 class / method, R6 class, S7 class, roxygen hints |
| TOML | `.toml` | top-level tables (`[table]`), arrays of tables (`[[array]]`), key groups |
| Properties | `.properties` | dotted-key namespaces, prefix groups (spring.*, db.*, server.*) |
| XML | `.xml` | root element, bean/route/kind, top-level named elements, Spring beans |
| Markdown | `.md` | h1–h3 headings, code-fence languages, link titles |
| GDScript | `.gd` | class definition, extends, signal, enum, constant, function definition |
| Lua | `.lua` | function, module-table methods (M.name / M:name), local functions, require hints, LDoc hints |
| Elixir | `.ex` `.exs` | defmodule, def/defp/defmacro, @spec return hints, @doc hints, alias/import deps |
| Astro | `.astro` | frontmatter via the TS extractor (Props, functions, consts), Astro.props destructure, component usages |
| PowerShell | `.ps1` `.psm1` `.psd1` | function, filter, workflow, param blocks, [CmdletBinding], PS5 class, methods, enum, Export-ModuleMember, .psd1 manifest |
| Objective-C | `.m` `.mm` (and `.h` that declares ObjC) | @interface, @protocol, @implementation, categories, @property, class/instance methods, typedef NS_ENUM / NS_OPTIONS, typedef struct, C functions, C++ classes in `.mm` |
| CI / pipelines | `.github/workflows/*` `action.yml` `.gitlab-ci.yml` `.circleci/config.yml` `azure-pipelines.yml` `bitbucket-pipelines.yml` `.drone.yml` `Jenkinsfile` `docker-compose.yml` | workflow name and triggers, jobs with runner / `needs` / `if` / matrix / environment, steps as real commands, referenced secrets, compose services — **routed by path, not extension** |

### Objective-C: three things worth knowing (v8.62.0)

**`.m` is shared with MATLAB and Octave.** A `.m` file with no Objective-C marker (`@interface`, `@implementation`, `@protocol`, `@property`, `@end`, `#import`, `NS_ENUM`, `NS_OPTIONS`) is not Objective-C, and goes to the generic extractor instead of producing Objective-C-shaped guesses.

**`.h` stays mapped to C/C++.** The C++ extractor checks the comment-stripped text for `@interface` / `@implementation` / `@protocol` / `#import` and hands the file to the Objective-C extractor when it finds one. A C++ header that only *mentions* `@interface` in a comment is still C++.

**Only declarations are read.** Methods and C functions are matched at brace depth 0, so nothing inside a body can surface as a signature — `return CGRectMake(0, 0, w, h);` is not a prototype and `a - b` is not a method. Depth follows `#if` / `#else` branches, and a method anchors to its real closing brace at any length:

```text
@implementation UserService  :43-64
  + (instancetype)serviceWithRepo:(id<Repository>)repo  :45-47
  - (instancetype)initWithRepo:(id<Repository>)repo  :49-54
  - (void)createUser:(CreateUserDto *)dto completion:(void (^)(User *user, NSError *error))completion  :60-62
static inline BOOL isValidId(NSString *identifier)  :70-72
```

Not extracted: ivar blocks, `@synthesize`, forward declarations (`@protocol FooDelegate;`, `@class Foo;`), and methods generated by a macro (`RCT_EXPORT_METHOD(...)`). Each container lists up to 120 members and each file up to 200 signatures; a cap is always disclosed as `… +N more`.

## Extraction quality tiers

### Mature

TypeScript, JavaScript, Python, Go, Rust, Java, Kotlin, Ruby, PHP, Swift, C#, C++, Dart, Scala.

These extractors cover the public shapes most developers care about day to day and are the most proven in the benchmark set.

### Stable

Vue, Svelte, GraphQL, SQL, Terraform, Protobuf, YAML, Shell, Dockerfile, TOML, XML, Properties, Markdown, R, GDScript, PowerShell, Objective-C.

These are reliable for structure-first context, but some ecosystems have more variation in how teams write files.

### Fallback or shape-level

HTML and CSS-family files are intentionally shallower. They capture the top-level structure that helps navigation, not full semantic behavior.

## Contributing a new language

Adding a language means contributing one extractor file. Follow the extractor contract, ensure all tests pass, and open a PR. See [CONTRIBUTING.md](https://github.com/manojmallick/sigmap/blob/main/CONTRIBUTING.md) for the full guide.


---

<div style="text-align:center;margin-top:2.5rem;padding-bottom:.5rem;font-size:0.85em;color:var(--vp-c-text-3)">
  Made in Amsterdam, Netherlands <span title="Netherlands">🇳🇱</span>
</div>
