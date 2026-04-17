import { defineConfig } from 'vitepress'

export default defineConfig({
  base: '/sigmap/',
  title: 'SigMap',
  description: 'Zero-dependency AI context engine. 97% token reduction.',

  appearance: 'dark',

  head: [
    ['link', { rel: 'icon', href: '/sigmap/favicon.png' }],
    // Global defaults — overridden per-page via frontmatter head
    ['meta', { property: 'og:site_name', content: 'SigMap' }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['meta', { property: 'og:image', content: 'https://manojmallick.github.io/sigmap/sigmap-banner.png' }],
    ['meta', { name: 'twitter:image', content: 'https://manojmallick.github.io/sigmap/sigmap-banner.png' }],
  ],

  themeConfig: {
    siteTitle: 'sigmap',
    logo: '/logo.svg',
    nav: [
      { text: 'Docs', link: '/guide/quick-start', activeMatch: '/guide/' },
      {
        text: 'GitHub',
        link: 'https://github.com/manojmallick/sigmap',
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
          { text: 'validate', link: '/guide/validate' },
          { text: 'judge', link: '/guide/judge' },
          { text: 'Learning & weights', link: '/guide/learning' },
          { text: 'compare & share', link: '/guide/compare' },
        ],
      },
      {
        text: 'Benchmarks',
        items: [
          { text: 'Overview', link: '/guide/benchmark' },
          { text: 'Quality', link: '/guide/quality-benchmark' },
          { text: 'Retrieval', link: '/guide/retrieval-benchmark' },
          { text: 'Task benchmark', link: '/guide/task-benchmark' },
          { text: 'Generalization', link: '/guide/generalization' },
        ],
      },
      {
        text: 'Reference',
        items: [
          { text: 'CLI', link: '/guide/cli' },
          { text: 'Config', link: '/guide/config' },
          { text: 'Strategies', link: '/guide/strategies' },
          { text: 'Languages', link: '/guide/languages' },
          { text: 'MCP server', link: '/guide/mcp' },
          { text: 'Repomix integration', link: '/guide/repomix' },
        ],
      },
      {
        text: 'Guides',
        items: [
          { text: 'End-to-end walkthrough', link: '/guide/walkthrough' },
          { text: 'Compare alternatives', link: '/guide/compare-alternatives' },
        ],
      },
      {
        text: 'More',
        items: [
          { text: 'Troubleshooting', link: '/guide/troubleshooting' },
          { text: 'Roadmap', link: '/guide/roadmap' },
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
    hostname: 'https://manojmallick.github.io/sigmap/',
  },
})
