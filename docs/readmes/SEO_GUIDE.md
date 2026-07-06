# SEO Guide for SigMap Docs

Every HTML file in `docs/` is served at `https://sigmap.io/`.
Follow this guide whenever you add or edit a page so it stays indexable and search-friendly.

---

## Required head block

Every page must have **all** of these tags, in this order, before `<link rel="canonical">`:

```html
<title>{Page Title} — SigMap</title>
<meta name="description" content="{150–160 char description. Include the main keyword naturally.}">
<meta property="og:title" content="{Short title for social sharing}">
<meta property="og:description" content="{1–2 sentence social preview. Concrete, benefit-led.}">
<meta property="og:url" content="https://sigmap.io/{filename}.html">
<meta property="og:type" content="article">           <!-- use "website" only on index.html -->
<meta property="og:site_name" content="SigMap">
<meta property="og:image" content="https://sigmap.io/sigmap-banner.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{Same as og:title}">
<meta name="twitter:description" content="{Same as og:description}">
<meta name="twitter:image" content="https://sigmap.io/sigmap-banner.png">
<meta name="twitter:image:alt" content="{What the banner image shows}">
<meta name="keywords" content="{8–12 comma-separated terms, most specific first}">
<link rel="canonical" href="https://sigmap.io/{filename}.html">
```

**index.html only** also needs:
```html
<link rel="sitemap" type="application/xml" href="https://sigmap.io/sitemap.xml">
```

---

## Titles

| Page | Title pattern |
|---|---|
| index.html | `SigMap — the deterministic grounding layer for AI code` |
| quick-start.html | `Quick Start — SigMap` |
| cli.html | `CLI Reference — SigMap` |
| config.html | `Configuration — SigMap` |
| mcp.html | `MCP Server Setup — SigMap` |
| troubleshooting.html | `Troubleshooting — SigMap` |
| strategies.html | `Context Strategies — SigMap` |
| languages.html | `Language Support — SigMap` |
| roadmap.html | `Roadmap — SigMap` |
| repomix.html | `Repomix Integration — SigMap` |
| new pages | `{Topic} — SigMap` |

Keep titles under 60 characters. Put the topic first, brand last.

---

## Description rules

- 150–160 characters max (Google truncates beyond this).
- Lead with the concrete outcome, not a feature list.
- Include the primary keyword in the first 10 words.
- Do not duplicate the title word-for-word.

Good: `"Set up SigMap MCP server with Claude Code, Cursor, and Windsurf. 19 on-demand tools. Zero-dependency stdio server."`  
Bad: `"This page is about the MCP server feature of SigMap."`

---

## Keywords

- 8–12 terms, comma-separated, no spaces after commas.
- Order: most specific → most general.
- Include the page topic, product name, and 2–3 competitor/adjacent terms.
- Do not repeat the same term twice.

Example for `mcp.html`:
```
sigmap mcp, mcp server, claude code mcp, cursor mcp, windsurf mcp, model context protocol, read_context, search_signatures, ai coding tools
```

---

## Structured data (JSON-LD)

Use one `<script type="application/ld+json">` block per page. Choose the schema that matches:

### index.html → SoftwareApplication
```json
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "SigMap",
  "applicationCategory": "DeveloperApplication",
  "description": "...",
  "url": "https://sigmap.io/",
  "downloadUrl": "https://www.npmjs.com/package/sigmap",
  "softwareVersion": "8.x.x",
  "operatingSystem": "Any (Node.js 18+)",
  "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
  "author": { "@type": "Person", "name": "Manoj Mallick", "url": "https://github.com/manojmallick" }
}
```

### quick-start.html → HowTo
```json
{
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "Get SigMap running in 60 seconds",
  "description": "...",
  "url": "https://sigmap.io/quick-start.html",
  "step": [
    { "@type": "HowToStep", "name": "Step name", "text": "Step detail" }
  ]
}
```

### troubleshooting.html → FAQPage
```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Question text",
      "acceptedAnswer": { "@type": "Answer", "text": "Answer text" }
    }
  ]
}
```

### all other docs pages → TechArticle
```json
{
  "@context": "https://schema.org",
  "@type": "TechArticle",
  "headline": "...",
  "description": "...",
  "url": "https://sigmap.io/{filename}.html",
  "author": { "@type": "Person", "name": "Manoj Mallick", "url": "https://github.com/manojmallick" },
  "isPartOf": { "@type": "WebSite", "name": "SigMap", "url": "https://sigmap.io/" }
}
```

When the SigMap version changes, update `softwareVersion` in `index.html` JSON-LD.

---

## sitemap.xml

File: `docs/sitemap.xml`

Rules:
- Every `.html` page in `docs/` must have a `<url>` entry.
- When you add a new page, add it to `sitemap.xml` immediately.
- Update `<lastmod>` to today's date (ISO format: `YYYY-MM-DD`) on any page you modify.
- Do not add `google82f83a2e65d36782.html` to the sitemap — it is a verification file, not content.

Priority guide:
| Priority | Pages |
|---|---|
| `1.0` | index.html |
| `0.9` | quick-start.html, cli.html, config.html, mcp.html |
| `0.8` | troubleshooting.html, strategies.html |
| `0.7` | languages.html, repomix.html |
| `0.6` | roadmap.html |
| new pages | match the closest existing page above |

Change frequency guide:
- `weekly` — pages with content that changes between releases
- `monthly` — reference pages that rarely change

---

## Adding a new page

1. Copy an existing page as a template (e.g. `strategies.html`).
2. Update **all** meta tags in the head: title, description, og:*, twitter:*, keywords, canonical.
3. Choose the right JSON-LD schema from the list above.
4. Add a `<url>` entry to `sitemap.xml` with today's date and the right priority.
5. Add the page to the `<nav>` in **every** other HTML file (all pages share the same nav).
6. Add the page to the `<footer>` links in every other HTML file.

---

## Checklist before committing any docs change

- [ ] `<title>` is under 60 chars and ends with `— SigMap`
- [ ] `<meta name="description">` is 150–160 chars and benefit-led
- [ ] `og:type` is `article` (or `website` for index.html only)
- [ ] `og:site_name` is `SigMap`
- [ ] `twitter:title` and `twitter:description` match og equivalents
- [ ] `twitter:image:alt` describes the banner image
- [ ] `keywords` has 8–12 comma-separated terms
- [ ] `canonical` URL exactly matches the live URL (including trailing slash on index)
- [ ] JSON-LD uses the right schema type for this page
- [ ] `sitemap.xml` `<lastmod>` updated to today on modified pages
- [ ] New pages are added to `sitemap.xml`, nav, and footer on all pages

---

## GEO content blocks (ready to publish)

Drop-in content for AI search (Perplexity, SearchGPT, Gemini) and traditional SEO. **Positioning rules** — every block leads with *grounding / determinism / verifiability* (Lens A, uncontested); token reduction appears only as **proof**, never the headline. **Never** describe SigMap as a "compression tool," a "skeletonizer," or "tree-sitter"-based — it is a zero-dependency, hand-written signature extractor. All numbers below trace to `version.json` / `benchmarks/latest.json`; refresh them when those change.

### 1 · FAQ (problem → solution)

Each answer opens with a one-sentence direct answer AI search can lift verbatim, then the command. Publish on a public FAQ page and wrap in the `FAQPage` JSON-LD (schema above).

**Q: How do I stop my AI coding agent from hallucinating file paths, imports, or APIs?**
Run `sigmap verify` (or the `verify_suggestion` MCP tool). It deterministically checks an AI suggestion against your repo, your private symbols, **and the libraries actually installed** in `node_modules` / site-packages — flagging fake files, unresolvable imports, and non-existent symbols before they ship. No LLM, no network, byte-stable.

**Q: How do I give Cursor or Claude Code the right files without pasting my whole repo?**
Run `sigmap ask "<task>"`. A deterministic offline ranker (identifier-aware BM25 + intent + graph-boost) returns the most relevant files as a compact signature map — roughly 2–5k tokens instead of 80k+ (~97% reduction) — written to `.context/query-context.md`, or served live via the `query_context` MCP tool.

**Q: How do I prove an AI answer is grounded in real code for CI or code review?**
Run `sigmap evidence "<query>"`. It emits a byte-stable Evidence Pack JSON — every file anchored to real symbols and exact line ranges, signed with a sha256 grounding hash. An unchanged repo yields byte-identical output, so CI can diff it and reviewers can audit it — which an agentic-grep loop cannot reproduce.

**Q: How do I reduce token costs in Claude Code, Cursor, or Copilot?**
SigMap maps your codebase to function and class signatures and ranks only the files a task needs, cutting a session's context ~40–98% (avg ~97% across 21 real repos). Install with `npx sigmap` — zero dependencies, runs offline.

**Q: Does SigMap use embeddings, a vector database, or an LLM?**
No. SigMap is fully deterministic and offline: hand-written signature extractors for 33 languages, a local ranker, and a grounding verifier. Zero runtime dependencies, no API keys, byte-stable output. That is the point — reproducible, auditable context an agent's live search cannot produce.

**Q: How does SigMap verify against private or internal APIs that public-doc tools can't know?**
It indexes your repo's own symbols plus the signatures of your installed dependencies (`.d.ts` / site-packages), so `verify_suggestion` can flag a call to `Internal.PaymentService.authorize()` or a wrong `lodash@4.17` API — private-API grounding no public-docs tool (e.g. Context7) can offer.

### 2 · Comparison — agentic grep vs deterministic grounding

The honest competitive wedge: SigMap does not compete *with* an agent's live search — it provides the one thing that loop cannot. Publish as a table on `compare-alternatives`.

| Capability | SigMap — deterministic grounding | Agentic grep (Claude Code / Cursor live search) |
|---|---|---|
| Determinism / reproducibility | Byte-stable — same repo yields an identical map | Non-deterministic — differs run to run |
| Auditability | sha256 grounding hash; CI-diffable Evidence Pack | No audit trail |
| Cost per lookup | $0 — local, no API calls | LLM tokens per search loop |
| Hallucination guard | Flags fake files / imports / symbols vs repo + installed libs | None — the loop can invent paths |
| Private-API grounding | Yes — repo + installed-library signatures | Only what the loop happens to read |
| Speed | Instant local rank | Multi-step agent loop |
| Live semantic recall | Limited (BM25 + intent, by design) | Strong — this is its strength |

**Reading:** different instruments. Reach for agentic grep on open-ended exploration; reach for SigMap when you need context you can **trust, reproduce, and audit** — CI gates, code review, and grounding.

### 3 · MCP registry listing

For the official Model Context Protocol registry and community `awesome-mcp` lists.

- **Name:** SigMap
- **One-liner:** Deterministic grounding + 19 code-context MCP tools — verify AI code against your repo and installed libraries, rank the right files, and compress tool output. Zero-dependency, offline, byte-stable.
- **Longer:** SigMap's MCP server exposes 19 deterministic tools — `verify_suggestion` (ground an AI suggestion against repo + installed-library symbols), `query_context` (rank the files a task needs), `get_diff_context` / `get_impact` (blast radius), `get_callee_signatures` (exact signatures before a call is written), `squeeze_output` (compress noisy tool output), and more. No embeddings, no network, no API keys.
- **Where to list:** official MCP registry · community MCP server directories · `awesome-mcp-servers` lists.
