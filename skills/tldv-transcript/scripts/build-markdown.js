// build-markdown.js — turn window.__acc into normalized lines + markdown.
//
// Run via browser_execute_script after the verification gate is clean.
// Sets window.__lines, window.__md, window.__mdB64, window.__parts.
//
// Avoid `??` / `?.` — they throw in the main world.

(() => {
  const acc = window.__acc;
  if (!acc) return { error: 'no __acc' };

  const keys = Object.keys(acc).map(Number).sort((a, b) => a - b);
  if (!keys.length) return { error: '__acc empty' };

  const pad = (n) => (n < 10 ? '0' + n : '' + n);

  const hms = (ms) => {
    const t = Math.max(0, Math.round((ms || 0) / 1000));
    const h = Math.floor(t / 3600);
    const m = Math.floor((t % 3600) / 60);
    const s = t % 60;
    if (h > 0) return pad(h) + ':' + pad(m) + ':' + pad(s);
    return pad(m) + ':' + pad(s);
  };

  const clean = (s) => {
    let out = String(s || '');
    // Strip a leading "Speaker:" prefix the DOM sometimes includes.
    out = out.replace(/^[^:\n]{1,40}:\s*/, '');
    return out.replace(/\s+/g, ' ').trim();
  };

  const lines = [];
  const tally = {};
  for (let i = 0; i < keys.length; i++) {
    const b = acc[keys[i]];
    const speaker = (b.speaker || 'Unknown').trim();
    const text = clean(b.text);
    tally[speaker] = (tally[speaker] || 0) + 1;
    lines.push({
      k: keys[i],
      sec: Math.round((b.time || 0) / 1000),
      hms: hms(b.time),
      speaker: speaker,
      text: text
    });
  }

  const totalChars = lines.reduce((n, l) => n + l.text.length, 0);
  const dur = lines[lines.length - 1].hms;
  const durSec = lines[lines.length - 1].sec;

  const speakers = Object.keys(tally).sort((a, b) => tally[b] - tally[a]);

  const meetingId = (location.pathname.split('/')[3] || '');
  const url = 'https://tldv.io/app/meetings/' + meetingId + '/';
  const title = document.title.replace(/\s*[|·-]\s*tl;dv.*$/i, '').trim() || 'Meeting';

  const out = [];
  out.push('# Transcript — ' + title);
  out.push('');
  out.push('- **Meeting ID:** `' + meetingId + '`');
  out.push('- **URL:** ' + url);
  out.push('- **Duration:** ' + dur + ' (' + durSec + ' detik)');
  out.push('- **Blocks:** ' + lines.length);
  out.push('- **Characters:** ' + totalChars);
  out.push('- **Speakers:** ' + speakers.length);
  out.push('');
  out.push('## Speakers');
  out.push('');
  out.push('| Speaker | Blocks |');
  out.push('| --- | ---: |');
  speakers.forEach((s) => out.push('| ' + s + ' | ' + tally[s] + ' |'));
  out.push('');
  out.push('---');
  out.push('');
  out.push('## Full Transcript');
  out.push('');
  out.push('| # | Time | Speaker | Text |');
  out.push('| ---: | --- | --- | --- |');
  lines.forEach((l, i) => {
    // Escape pipes so an embedded "|" cannot break the table structure.
    const safe = l.text.replace(/\|/g, '\\|');
    out.push('| ' + (i + 1) + ' | ' + l.hms + ' | ' + l.speaker + ' | ' + safe + ' |');
  });
  out.push('');
  out.push('---');
  out.push('');
  out.push('## Plain Text');
  out.push('');
  lines.forEach((l) => {
    out.push('**[' + l.hms + '] ' + l.speaker + ':** ' + l.text);
    out.push('');
  });

  const md = out.join('\n');

  window.__lines = lines;
  window.__md = md;
  window.__mdB64 = btoa(unescape(encodeURIComponent(md)));

  // Split into ~20k base64 chunks for safe transfer out of the page.
  const CH = 20000;
  const parts = [];
  for (let i = 0; i < window.__mdB64.length; i += CH) {
    parts.push(window.__mdB64.slice(i, i + CH));
  }
  window.__parts = parts;

  return {
    lines: lines.length,
    chars: md.length,
    b64: window.__mdB64.length,
    parts: parts.length,
    speakers: speakers.length,
    first: lines[0].hms + ' ' + lines[0].speaker,
    last: lines[lines.length - 1].hms + ' ' + lines[lines.length - 1].speaker,
    tally: tally
  };
})()
