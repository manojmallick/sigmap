# SEO Guide for SigMap Docs

Every HTML file in `docs/` is served at `https://manojmallick.github.io/sigmap/`.
Follow this guide whenever you add or edit a page so it stays indexable and search-friendly.

---

## Required head block

Every page must have **all** of these tags, in this order, before `<link rel="canonical">`:

```html
<title>{Page Title} — SigMap</title>
<meta name="description" content="{150–160 char description. Include the main keyword naturally.}">
<meta property="og:title" content="{Short title for social sharing}">
<meta property="og:description" content="{1–2 sentence social preview. Concrete, benefit-led.}">
<meta property="og:url" content="https://manojmallick.github.io/sigmap/{filename}.html">
<meta property="og:type" content="article">           <!-- use "website" only on index.html -->
<meta property="og:site_name" content="SigMap">
<meta property="og:image" content="https://manojmallick.github.io/sigmap/sigmap-banner.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{Same as og:title}">
<meta name="twitter:description" content="{Same as og:description}">
<meta name="twitter:image" content="https://manojmallick.github.io/sigmap/sigmap-banner.png">
<meta name="twitter:image:alt" content="{What the banner image shows}">
<meta name="keywords" content="{8–12 comma-separated terms, most specific first}">
<link rel="canonical" href="https://manojmallick.github.io/sigmap/{filename}.html">
```

**index.html only** also needs:
```html
<link rel="sitemap" type="application/xml" href="https://manojmallick.github.io/sigmap/sitemap.xml">
```

---

## Titles

| Page | Title pattern |
|---|---|
| index.html | `SigMap — Zero-dependency AI context engine` |
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

Good: `"Set up SigMap MCP server with Claude Code, Cursor, and Windsurf. 8 on-demand tools. Zero-dependency stdio server."`  
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
  "url": "https://manojmallick.github.io/sigmap/",
  "downloadUrl": "https://www.npmjs.com/package/sigmap",
  "softwareVersion": "3.x.x",
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
  "url": "https://manojmallick.github.io/sigmap/quick-start.html",
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
  "url": "https://manojmallick.github.io/sigmap/{filename}.html",
  "author": { "@type": "Person", "name": "Manoj Mallick", "url": "https://github.com/manojmallick" },
  "isPartOf": { "@type": "WebSite", "name": "SigMap", "url": "https://manojmallick.github.io/sigmap/" }
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
