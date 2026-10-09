import { defineConfig } from 'vitepress'

export default defineConfig({
  base: '/',
  title: 'SigMap',
  description: 'The deterministic, verifiable grounding layer for AI code work. Zero dependencies, no embeddings, fully offline.',

  appearance: 'dark',

  head: [
    ['link', { rel: 'icon', href: '/favicon.png' }],
    // Global defaults — overridden per-page via frontmatter head
    ['meta', { property: 'og:site_name', content: 'SigMap' }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['meta', { property: 'og:image', content: 'https://sigmap.io/sigmap-banner.png' }],
    ['meta', { name: 'twitter:image', content: 'https://sigmap.io/sigmap-banner.png' }],
  ],

  themeConfig: {
    siteTitle: 'sigmap',
    logo: '/logo.svg',
    nav: [
      { text: 'Docs', link: '/guide/quick-start', activeMatch: '/guide/' },
      {
        text: 'GitHub ⭐',
        link: 'https://github.com/manojmallick/sigmap',
        badge: {
          text: '⭐',
          type: 'tip'
        }
      },
    ],

    sidebar: [
      {
        text: 'Getting started',
        items: [
          { text: 'Quick start', link: '/guide/quick-start' },
        ],
      },
      {
        text: 'Core workflow',
        items: [
          { text: 'ask', link: '/guide/ask' },
          { text: 'Surgical Context', link: '/guide/surgical-context' },
          { text: 'Hallucination Guard', link: '/guide/verify-ai-output' },
          { text: 'validate', link: '/guide/validate' },
          { text: 'judge', link: '/guide/judge' },
          { text: 'Learning & weights', link: '/guide/learning' },
          { text: 'Memory & notes', link: '/guide/memory' },
          { text: 'compare & share', link: '/guide/compare' },
        ],
      },
      {
        text: 'Benchmarks',
        items: [
          { text: 'Overview', link: '/guide/benchmark' },
          { text: 'Methodology', link: '/guide/methodology' },
          { text: 'Quality', link: '/guide/quality-benchmark' },
          { text: 'Retrieval', link: '/guide/retrieval-benchmark' },
          { text: 'Task benchmark', link: '/guide/task-benchmark' },
          { text: 'Generalization', link: '/guide/generalization' },
        ],
      },
      {
        text: 'Integrations',
        items: [
          { text: 'Open-source agents', link: '/guide/agents' },
          { text: 'Local LLMs (Ollama, llama.cpp)', link: '/guide/local-llms' },
          { text: 'MCP server', link: '/guide/mcp' },
          { text: 'Repomix integration', link: '/guide/repomix' },
        ],
      },
      {
        text: 'Reference',
        items: [
          { text: 'CLI', link: '/guide/cli' },
          { text: 'Config', link: '/guide/config' },
          { text: 'Strategies', link: '/guide/strategies' },
          { text: 'Languages', link: '/guide/languages' },
        ],
      },
      {
        text: 'Guides',
        items: [
          { text: 'When to use what', link: '/guide/when-to-use' },
          { text: 'End-to-end walkthrough', link: '/guide/walkthrough' },
          { text: 'Compare alternatives', link: '/guide/compare-alternatives' },
          { text: 'Measure AI credits', link: '/guide/measure-ai-credits' },
          { text: 'How I built SigMap', link: '/guide/how-i-built-sigmap' },
        ],
      },
      {
        text: 'Architecture decisions',
        collapsed: true,
        items: [
          { text: 'Overview', link: '/adr/' },
          { text: '0001 BM25, not embeddings', link: '/adr/0001-bm25-over-embeddings' },
          { text: '0002 Hand-written extractors', link: '/adr/0002-hand-written-extractors-no-tree-sitter' },
          { text: '0003 No LLM in the core', link: '/adr/0003-no-llm-in-the-deterministic-core' },
          { text: '0004 Blast-radius score', link: '/adr/0004-blast-radius-is-a-closed-form-score' },
          { text: '0005 Centrality, deprecated', link: '/adr/0005-centrality-flag-gated-then-deprecated' },
          { text: '0006 Local NDJSON state', link: '/adr/0006-append-only-local-ndjson-for-shared-state' },
        ],
      },
      {
        text: 'More',
        items: [
          { text: 'Troubleshooting', link: '/guide/troubleshooting' },
          { text: 'Release checklist', link: '/guide/release-checklist' },
          { text: 'Roadmap', link: '/guide/roadmap' },
          { text: 'Learning Resources', link: '/guide/resources' },
        ],
      },
    ],

    search: {
      provider: 'local',
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/manojmallick/sigmap' },
    ],

    footer: {
      message: 'MIT License',
      copyright: 'Copyright © 2026 <a href="https://github.com/manojmallick" target="_blank" rel="noopener">Manoj Mallick</a> · Made in Amsterdam, Netherlands 🇳🇱',
    },

    editLink: {
      pattern: 'https://github.com/manojmallick/sigmap/edit/main/docs-vp/:path',
      text: 'Edit this page on GitHub',
    },
  },

  sitemap: {
    hostname: 'https://sigmap.io/',
  },
})
