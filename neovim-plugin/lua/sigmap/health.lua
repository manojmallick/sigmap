local M = {}

function M.check()
  vim.health.start('sigmap')

  -- Node version check (requires 18+)
  local node_raw = vim.fn.systemlist('node --version')[1] or ''
  local major    = tonumber(node_raw:match('v(%d+)')) or 0
  if major >= 18 then
    vim.health.ok('Node ' .. node_raw)
  else
    vim.health.error('Node 18+ required (found: ' .. node_raw .. ')')
  end

  -- Binary detection
  if vim.fn.executable('sigmap') == 1 then
    vim.health.ok('sigmap binary found in PATH')
  elseif vim.fn.filereadable(vim.fn.getcwd() .. '/gen-context.js') == 1 then
    vim.health.warn('using local gen-context.js — for global install run: npm install -g sigmap')
  else
    vim.health.error('sigmap not found — run: npm install -g sigmap')
  end

  -- Context file freshness
  local ctx = vim.fn.getcwd() .. '/.github/copilot-instructions.md'
  if vim.fn.filereadable(ctx) == 1 then
    local age_h = math.floor((os.time() - vim.fn.getftime(ctx)) / 3600)
    if age_h < 24 then
      vim.health.ok('context file is fresh (' .. age_h .. 'h old)')
    else
      vim.health.warn('context file is stale (' .. age_h .. 'h old) — run :SigMap to regenerate')
    end
  else
    vim.health.warn('no context file found — run :SigMap to generate')
  end
end

return M
