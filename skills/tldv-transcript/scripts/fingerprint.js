// fingerprint.js — emit a per-row fingerprint for verifying the file on disk.
//
// Row count alone will NOT catch a transcription typo. This emits
// hms~speaker~textLength per block so the written file can be diffed row by row
// against what the browser actually held.
//
// Reference run: this is what caught "memperbaikinya" vs "memperbaikannya"
// (1 char, row 204) — a mistake a row count passes happily.

(() => {
  const lines = window.__lines;
  if (!lines || !lines.length) return { error: 'no __lines — run build-markdown.js first' };
  return lines.map((r) => r.hms + '~' + (r.speaker || '') + '~' + (r.text || '').length).join('\n');
})()
