'use strict';

/** Render rows as a plain-text table. */
function renderTable(rows) {
  return rows.map((r) => r.join('\t')).join('\n');
}

module.exports = { renderTable };
