'use strict';

/**
 * Visible truncation for extractor caps (v8.11).
 *
 * Extractors cap per-file signatures and per-class members to protect the token
 * budget. Historically that truncation was SILENT — the tail of a large file
 * simply vanished with no trace, so "5 of 40 methods extracted" looked identical
 * to "fully extracted". These helpers keep the cap but append a visible marker
 * so the loss is always disclosed.
 *
 * Zero-dependency, bundle-safe.
 */

/**
 * Cap a string array, appending a `… +N more <label>` marker when items drop.
 * @param {string[]} items
 * @param {number} limit
 * @param {string} label e.g. 'signatures'
 * @returns {string[]}
 */
function capWithNotice(items, limit, label) {
  if (!Array.isArray(items) || items.length <= limit) return items;
  const dropped = items.length - limit;
  return items.slice(0, limit).concat(`… +${dropped} more ${label}`);
}

/**
 * Cap an array of member objects ({ text, ... }), appending a marker member
 * when items drop so the class block discloses the omission.
 * @param {Array<{text:string}>} members
 * @param {number} limit
 * @param {string} [label='methods']
 * @returns {Array<{text:string}>}
 */
function capMembersWithNotice(members, limit, label = 'methods') {
  if (!Array.isArray(members) || members.length <= limit) return members;
  const dropped = members.length - limit;
  return members.slice(0, limit).concat({ text: `… +${dropped} more ${label}`, start: 0, end: 0 });
}

module.exports = { capWithNotice, capMembersWithNotice };
