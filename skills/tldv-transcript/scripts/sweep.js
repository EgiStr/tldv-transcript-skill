// sweep.js — drive the virtualized transcript list and harvest blocks.
//
// Run via browser_execute_script. Parameterised at the top; edit before each call.
//
// WHY IT LOOKS LIKE THIS:
//   - browser_execute_script times out at 30000 ms, so the loop is wall-clock
//     budgeted and returns done:false so you can resume in a later call.
//   - Moving scrollTop + dispatching a scroll event is the ONLY reliable render
//     trigger. video.play() is blocked by the power-saving policy and setting
//     currentTime while paused does not re-render.
//   - A fast sweep reaches the end but leaves gaps. Use a SLOW full pass.
//   - __acc is persisted before returning, so a reload cannot destroy progress.

(() => {
  const STEP = 300;       // px per scroll stop (smaller = slower = fewer gaps)
  const DWELL = 350;      // ms to wait for re-render at each stop
  const BUDGET_MS = 18000; // stay well under the 30000 ms script timeout

  // Re-install collector if a reload wiped it.
  if (typeof window.__collect !== 'function') {
    return { error: 'collector missing — install scripts/collector.js first' };
  }

  const container = document.querySelector('#transcript-container');
  if (!container) return { error: 'no #transcript-container' };

  const total = container.querySelectorAll('p[data-index]').length;
  const maxTop = container.scrollHeight - container.clientHeight;

  // Resume from where the last call stopped.
  let pos = typeof window.__sweepPos === 'number' ? window.__sweepPos : 0;
  const startedAt = Date.now();
  let passes = 0;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // The sweep body is async; browser_execute_script can await a returned promise.
  return (async () => {
    while (pos <= maxTop) {
      if (Date.now() - startedAt > BUDGET_MS) break;

      container.scrollTop = pos;
      container.dispatchEvent(new Event('scroll', { bubbles: true }));
      await sleep(DWELL);

      window.__collect();
      pos += STEP;
      passes++;
    }

    window.__sweepPos = pos;
    const saved = window.__save();
    const have = Object.keys(window.__acc).length;
    const done = pos > maxTop;

    if (done) window.__sweepPos = 0; // reset for a future run

    return {
      done: done,
      passes: passes,
      have: have,
      total: total,
      remaining: total - have,
      pos: Math.round(pos),
      maxTop: Math.round(maxTop),
      saved: saved
    };
  })();
})()
