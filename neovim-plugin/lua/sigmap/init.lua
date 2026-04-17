local M = {}

M.config = {
  auto_run    = false,
  binary      = nil,
  notify      = true,
  float_query = true,
}

local function find_binary()
  if M.config.binary then return M.config.binary end
  if vim.fn.executable('sigmap') == 1 then return 'sigmap' end
  if vim.fn.executable('npx') == 1 then return 'npx sigmap' end
  local local_path = vim.fn.getcwd() .. '/gen-context.js'
  if vim.fn.filereadable(local_path) == 1 then return 'node ' .. local_path end
  return nil
end

function M.run(opts)
  local bin = find_binary()
  if not bin then
    vim.notify('[sigmap] not found — install: npm install -g sigmap', vim.log.levels.ERROR)
    return
  end
  local args = opts and opts.args or ''
  local cmd  = bin .. (args ~= '' and (' ' .. args) or '')
  vim.fn.jobstart(cmd, {
    cwd     = vim.fn.getcwd(),
    on_exit = function(_, code)
      if M.config.notify then
        if code == 0 then
          vim.notify('[sigmap] context regenerated', vim.log.levels.INFO)
        else
          vim.notify('[sigmap] failed (exit ' .. code .. ')', vim.log.levels.WARN)
        end
      end
    end,
  })
end

function M.query(text)
  local bin = find_binary()
  if not bin then
    vim.notify('[sigmap] not found — install: npm install -g sigmap', vim.log.levels.ERROR)
    return
  end
  local lines = {}
  vim.fn.jobstart(bin .. ' query "' .. text .. '"', {
    cwd       = vim.fn.getcwd(),
    on_stdout = function(_, data)
      if data then vim.list_extend(lines, data) end
    end,
    on_exit   = function()
      if not M.config.float_query then return end
      -- filter trailing blank lines
      while #lines > 0 and lines[#lines] == '' do
        table.remove(lines)
      end
      if #lines == 0 then lines = { '(no results)' } end
      local buf    = vim.api.nvim_create_buf(false, true)
      vim.api.nvim_buf_set_lines(buf, 0, -1, false, lines)
      local width  = math.min(100, vim.o.columns - 4)
      local height = math.min(#lines + 2, 30)
      vim.api.nvim_open_win(buf, true, {
        relative = 'editor',
        style    = 'minimal',
        border   = 'rounded',
        width    = width,
        height   = height,
        row      = math.floor((vim.o.lines - height) / 2),
        col      = math.floor((vim.o.columns - width) / 2),
      })
      -- close float with q or Escape
      vim.api.nvim_buf_set_keymap(buf, 'n', 'q',      '<cmd>close<cr>', { noremap = true, silent = true })
      vim.api.nvim_buf_set_keymap(buf, 'n', '<Esc>',  '<cmd>close<cr>', { noremap = true, silent = true })
    end,
  })
end

-- Returns a short string for lualine / statusline widgets.
-- 'sm:✓' when context file < 24 h old, 'sm:⚠ Nh' otherwise.
function M.statusline()
  local ctx = vim.fn.getcwd() .. '/.github/copilot-instructions.md'
  if vim.fn.filereadable(ctx) == 0 then return '' end
  local age_h = math.floor((os.time() - vim.fn.getftime(ctx)) / 3600)
  if age_h < 24 then
    return 'sm:✓'
  else
    return 'sm:⚠ ' .. age_h .. 'h'
  end
end

function M.setup(opts)
  M.config = vim.tbl_deep_extend('force', M.config, opts or {})
  if M.config.auto_run then
    vim.api.nvim_create_autocmd('BufWritePost', {
      pattern  = { '*.js', '*.ts', '*.py', '*.go', '*.rs', '*.java', '*.rb', '*.lua' },
      callback = function() M.run() end,
    })
  end
end

return M
