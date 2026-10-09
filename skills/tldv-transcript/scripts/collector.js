// collector.js — install into the page via browser_execute_script.
//
// Defines window.__acc / __collect / __save / __load.
// Must be re-installed after every page reload (a reload wipes page state).
//
// NOTE: avoid `??` and `?.` in page context — they throw `Unexpected token '?'`
// in the main world.

(() => {
  if (!window.__acc) window.__acc = {};

  window.__collect = function collect() {
    const container = document.querySelector('#transcript-container');
    if (!container) return { added: 0, error: 'no #transcript-container' };

    const nodes = container.querySelectorAll('p[data-index]');
    let added = 0;

    nodes.forEach(function (p) {
      const idx = parseInt(p.getAttribute('data-index'), 10);
      if (isNaN(idx)) return;

      // Only harvest blocks that actually rendered text.
      const raw = (p.innerText || '').trim();
      if (raw.length <= 5) return;

      // Skip placeholders that carry no child spans yet.
      const spans = p.querySelectorAll('span[data-word]');
      if (spans.length === 0) return;

      let speaker = '';
      let ms = parseInt(p.getAttribute('data-time'), 10);
      if (isNaN(ms)) ms = null;

      const words = [];
      spans.forEach(function (s, i) {
        const w = (s.getAttribute('data-word') || s.textContent || '').trim();
        if (w) words.push(w);
        if (i === 0) {
          const sp = s.getAttribute('data-speaker');
          if (sp) speaker = sp;
          const t = parseInt(s.getAttribute('data-time'), 10);
          if (!isNaN(t)) ms = t;
        }
      });

      const text = words.join(' ').replace(/\s+/g, ' ').trim();
      if (!text) return;

      const prev = window.__acc[idx];
      // Overwrite only when we have strictly more, so a later partial render
      // never truncates a good block.
      if (!prev || text.length > (prev.text || '').length) {
        window.__acc[idx] = { time: ms, speaker: speaker, text: text };
        added++;
      }
    });

    return { added: added, total: Object.keys(window.__acc).length };
  };

  window.__save = function save() {
    try {
      localStorage.setItem('__acc_backup', JSON.stringify(window.__acc));
      return { ok: true, bytes: localStorage.getItem('__acc_backup').length };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  };

  window.__load = function load() {
    try {
      const raw = localStorage.getItem('__acc_backup');
      if (!raw) return { ok: false, error: 'no backup' };
      window.__acc = JSON.parse(raw);
      return { ok: true, total: Object.keys(window.__acc).length };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  };

  return { installed: true, total: Object.keys(window.__acc).length };
})()
