// verify.js — the completeness gate. Run BEFORE building any output.
//
// This is the step that makes the difference between "looks done" and "is done".
// A sweep that visually reaches the end can still be missing dozens of blocks.
//
// GATE: missing / empty / nonMonotonicTimes must all be [] and have === total.
// If not, return to sweep.js for the gaps. Do not write output yet.

(() => {
  const container = document.querySelector('#transcript-container');
  if (!container) return { error: 'no #transcript-container' };

  const total = container.querySelectorAll('p[data-index]').length;
  const acc = window.__acc || {};
  const keys = Object.keys(acc).map(Number).sort((a, b) => a - b);

  const missing = [];
  for (let i = 0; i < total; i++) {
    if (!acc[i]) missing.push(i);
  }

  const empty = keys.filter((k) => !((acc[k].text || '').trim()));

  // Non-monotonic timestamps reveal blocks collected against the wrong index.
  const nonMono = [];
  for (let i = 1; i < keys.length; i++) {
    const a = acc[keys[i - 1]].time;
    const b = acc[keys[i]].time;
    if (typeof a === 'number' && typeof b === 'number' && b < a) {
      nonMono.push({ prev: keys[i - 1], cur: keys[i], prevT: a, curT: b });
    }
  }

  const speakers = {};
  keys.forEach((k) => {
    const s = (acc[k].speaker || 'Unknown').trim();
    speakers[s] = (speakers[s] || 0) + 1;
  });

  const totalChars = keys.reduce((n, k) => n + (acc[k].text || '').length, 0);

  return {
    total: total,
    have: keys.length,
    missing: missing,
    missingCount: missing.length,
    empty: empty,
    emptyCount: empty.length,
    nonMonotonicTimes: nonMono,
    firstTime: keys.length ? acc[keys[0]].time : null,
    lastTime: keys.length ? acc[keys[keys.length - 1]].time : null,
    totalChars: totalChars,
    speakers: speakers,
    PASS: missing.length === 0 && empty.length === 0 && nonMono.length === 0 && keys.length === total
  };
})()
