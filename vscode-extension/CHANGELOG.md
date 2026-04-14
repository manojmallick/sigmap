# Changelog

## [3.4.0] - 2026-04-14

### Added
- Added support documentation for Phase A coverage formats: TOML (`.toml`), properties (`.properties`), XML (`.xml`), and Markdown (`.md`)

### Changed
- Version sync with SigMap core release 3.4.0
## [3.3.4] - 2026-04-14

### Changed
- Version sync with SigMap core release 3.3.4
- Updated marketplace description language count from 21 to 25

## [3.3.3] - 2026-04-14

### Added
- Added support documentation for 4 new extractor-backed languages: SQL, GraphQL, Terraform, Protobuf

### Changed
- Updated language support references from 21 to 25
- Version sync with SigMap core release 3.3.3

## [2.0.2] - 2026-04-04

### Changed
- Added Open VSX badge and availability table to README
- Added CLI commands reference table to README
- Updated MCP section to list all 7 tools
- Improved status bar format documentation

## [2.0.1] — 2026-04-04

### Added
- v2 pipeline support: TODOs, recent changes, coverage gaps, PR diff context
- Dependency extractors for Python and TypeScript
- Impact radius hints (reverse dependency annotations)
- Enriched signatures with return types and type hints across all 21 languages
- "What's new in 2.0" section in extension README

### Changed
- Status bar prefix updated from `cf:` to `sm:` for SigMap branding alignment

### Fixed
- Status bar now correctly shows SigMap branding

## [1.5.0] — 2026-04-03

### Added
- Initial release on VS Code Marketplace
- Status bar showing health grade (A/B/C/D) and time since last regeneration
- `SigMap: Regenerate Context` command
- `SigMap: Open Context File` command
- Stale context notification (>24h) with one-click regenerate
- Configurable `sigmap.scriptPath` setting
- 21 language support
- Secret scanning (AWS keys, GitHub tokens, DB strings, etc.)
- MCP server support for Claude and Cursor
