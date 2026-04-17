local sigmap = require('sigmap')

vim.api.nvim_create_user_command('SigMap', function(opts)
  sigmap.run({ args = opts.args })
end, { nargs = '*', desc = 'Run SigMap context generation' })

vim.api.nvim_create_user_command('SigMapQuery', function(opts)
  sigmap.query(opts.args)
end, { nargs = '+', desc = 'Query SigMap signatures in a floating window' })
