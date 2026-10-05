#!/usr/bin/env node
'use strict';

/**
 * write-sync.mjs — write a whole document to a file descriptor before the process exits.
 *
 * A gate that prints one JSON document and then calls `process.exit()` loses whatever the pipe had
 * not yet taken: stdout is asynchronous when it is a pipe, and an exit cuts the write off at the
 * pipe buffer (65,536 bytes). The document a gate prints with `--signals` or `--why` is larger
 * than that, and what arrived was truncated JSON. This writes synchronously, retrying while the
 * pipe is full, so every byte is out before the next line runs.
 */

import { writeSync } from 'fs';

/**
 * @param {number} fd file descriptor (1 for stdout)
 * @param {string} text
 */
export function writeAll(fd, text) {
  const buf = Buffer.from(text);
  for (let off = 0; off < buf.length;) {
    try {
      off += writeSync(fd, buf, off);
    } catch (e) {
      if (e.code !== 'EAGAIN') throw e; // the pipe is full: try again once the reader has drained it
    }
  }
}
