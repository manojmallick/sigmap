# sigmap.nvim

Neovim plugin for [SigMap](https://github.com/manojmallick/sigmap) — the zero-dependency AI context engine.

## Features

- `:SigMap [args]` — regenerate your AI context file
- `:SigMapQuery <text>` — TF-IDF ranked retrieval in a floating window
- Auto-regenerate on save (`auto_run = true`)
- `require('sigmap').statusline()` — lualine / custom statusline widget
- `:checkhealth sigmap` — validates Node 18+, binary, context file age

## Requirements

- Neovim 0.9+
- Node 18+ and `sigmap` CLI (`npm install -g sigmap`)

## Install

**lazy.nvim:**
```lua
{ 'manojmallick/sigmap',
  -- path inside the monorepo:
  -- dir = vim.fn.expand('~') .. '/path/to/sigmap/neovim-plugin',
  config = function()
    require('sigmap').setup({
      auto_run    = true,   -- regen on BufWritePost for source files
      float_query = true,   -- show query results in a floating window
    })
  end,
}
```

## Configuration

```lua
require('sigmap').setup({
  auto_run    = false,  -- true: regen on save for *.js/ts/py/go/rs/java/rb/lua
  binary      = nil,    -- nil: auto-detect (sigmap → npx sigmap → local gen-context.js)
  notify      = true,   -- show vim.notify messages on completion
  float_query = true,   -- open query results in a floating window
})
```

## Statusline

```lua
-- lualine component example:
require('lualine').setup({
  sections = {
    lualine_x = { require('sigmap').statusline },
  },
})
```

Returns `sm:✓` when the context file is < 24 h old, `sm:⚠ Nh` otherwise.

## Health check

```
:checkhealth sigmap
```

Validates:
- Node 18+ is installed
- `sigmap` binary (or local fallback) is present
- Context file exists and is fresh (< 24 h)
