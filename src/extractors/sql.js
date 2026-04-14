'use strict';

/**
 * Extract signatures from SQL source files.
 * Captures CREATE TABLE, VIEW, INDEX, FUNCTION, PROCEDURE, TRIGGER, TYPE, SEQUENCE.
 *
 * @param {string} src - Raw SQL content
 * @returns {string[]} Array of signature strings
 */
function extract(src) {
  if (!src || typeof src !== 'string') return [];
  const sigs = [];

  // Strip single-line comments and block comments
  const stripped = src
    .replace(/--[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');

  // CREATE TABLE [IF NOT EXISTS] <name> / CREATE [TEMP] TABLE ...
  for (const m of stripped.matchAll(
    /CREATE\s+(?:OR\s+REPLACE\s+)?(?:TEMP(?:ORARY)?\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([`"[\w.]+)/gi
  )) {
    sigs.push(`TABLE ${_cleanName(m[1])}`);
  }

  // CREATE VIEW / MATERIALIZED VIEW
  for (const m of stripped.matchAll(
    /CREATE\s+(?:OR\s+REPLACE\s+)?(?:MATERIALIZED\s+)?VIEW\s+(?:IF\s+NOT\s+EXISTS\s+)?([`"[\w.]+)/gi
  )) {
    sigs.push(`VIEW ${_cleanName(m[1])}`);
  }

  // CREATE INDEX / UNIQUE INDEX
  for (const m of stripped.matchAll(
    /CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:CONCURRENTLY\s+)?(?:IF\s+NOT\s+EXISTS\s+)?([`"[\w.]+)\s+ON\s+([`"[\w.]+)/gi
  )) {
    sigs.push(`INDEX ${_cleanName(m[1])} ON ${_cleanName(m[2])}`);
  }

  // CREATE FUNCTION / CREATE OR REPLACE FUNCTION
  for (const m of stripped.matchAll(
    /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+([`"[\w.]+)\s*\(([^)]*)\)/gi
  )) {
    const params = _normalizeParams(m[2]);
    sigs.push(`FUNCTION ${_cleanName(m[1])}(${params})`);
  }

  // CREATE PROCEDURE
  for (const m of stripped.matchAll(
    /CREATE\s+(?:OR\s+REPLACE\s+)?PROCEDURE\s+([`"[\w.]+)\s*\(([^)]*)\)/gi
  )) {
    const params = _normalizeParams(m[2]);
    sigs.push(`PROCEDURE ${_cleanName(m[1])}(${params})`);
  }

  // CREATE TRIGGER
  for (const m of stripped.matchAll(
    /CREATE\s+(?:OR\s+REPLACE\s+)?(?:CONSTRAINT\s+)?TRIGGER\s+([`"[\w.]+)/gi
  )) {
    sigs.push(`TRIGGER ${_cleanName(m[1])}`);
  }

  // CREATE TYPE (composite, enum, domain)
  for (const m of stripped.matchAll(
    /CREATE\s+(?:OR\s+REPLACE\s+)?TYPE\s+([`"[\w.]+)/gi
  )) {
    sigs.push(`TYPE ${_cleanName(m[1])}`);
  }

  // CREATE SEQUENCE
  for (const m of stripped.matchAll(
    /CREATE\s+(?:OR\s+REPLACE\s+)?SEQUENCE\s+(?:IF\s+NOT\s+EXISTS\s+)?([`"[\w.]+)/gi
  )) {
    sigs.push(`SEQUENCE ${_cleanName(m[1])}`);
  }

  return sigs;
}

function _cleanName(raw) {
  return raw.replace(/^[`"[]|[`"\]]+$/g, '').trim();
}

function _normalizeParams(raw) {
  if (!raw || !raw.trim()) return '';
  return raw.trim()
    .split(',')
    .map((p) => p.trim().replace(/\s+/g, ' ').split(' ').slice(0, 2).join(' '))
    .filter(Boolean)
    .join(', ');
}

module.exports = { extract };
