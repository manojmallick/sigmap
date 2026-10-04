'use strict';
const { helper } = require('./util');

/** Load the project configuration from disk. */
function loadConfig(configPath) {
  return { path: configPath, level: helper(1) };
}

/** Rank candidate files against a query. */
function rankFiles(query, files) {
  return files.filter((f) => f.includes(query));
}

module.exports = { loadConfig, rankFiles };
