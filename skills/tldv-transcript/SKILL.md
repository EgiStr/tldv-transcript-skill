---
name: tldv-transcript
description: Extract the full transcript from a tl;dv (tldv.io) meeting page using a browser MCP. Use when the user wants to scrape, download, export, or copy a tldv.io meeting transcript to markdown/text, especially when the built-in copy button is limited to the first minute or when transcript text only renders while the video plays. Triggers on "tldv transcript", "scrape tl;dv", "export tldv meeting", "transkrip tldv".
---

# tl;dv Transcript Extractor

Extract **every** transcript block from a tl;dv meeting page and write it to a
markdown file.

## Why this skill exists

tl;dv's transcript view is hostile to naive scraping in three specific ways.
Understanding them is the whole skill:

1. **The virtual list truncates.** The transcript is a virtualized list of
   `<p data-index="N">` placeholders. At any moment only ~5–8 blocks near the
   scroll window contain real text; every other block is an empty `<p>` with an
   inline `style="min-height: NNpx"`. A single `get_page_content` returns a
   sliver that *looks* complete. It is not.
2. **Text only materialises on render.** Blocks do not carry text until the
   virtualizer renders them. Data is not in the DOM, not in `localStorage`, not
   in `caches`, and not in text tracks.
3. **The copy button is capped.** Free-tier copy stops around minute 1.

The API is a dead end too: `gaia.tldv.io` and `gw.tldv.io` return
`TypeError: Failed to fetch` from page context because of CORS. Do not burn time
there.

## The counter-intuitive part

**Driving the video does not work.** Two instincts fail:

- `video.play()` from JS is rejected by the browser's background power-saving
  policy: `AbortError: The play() request was interrupted because video-only
  background media was paused to save power`.
- Setting `video.currentTime` while paused does **not** trigger re-render.

**What actually works: force the virtualizer to re-render by moving
`scrollTop` on the transcript container and dispatching a scroll event.** This
was verified as the only reliable render driver.

## Required setup

- A browser MCP that exposes a JS-evaluation tool and a scroll tool. This skill
  was built and verified against **browser-mcp** (`browser_execute_script`,
  `browser_scroll`, `browser_switch_tab`).
- The user must already be logged into tl;dv in that browser profile.

## Procedure

### Step 1 — Focus the tab

Browser MCP input only lands when the tab is foregrounded. Skipping this causes
clicks to silently no-op (`method: "scripting-fallback"`, "The tab was in the
background").

```
browser_list_tabs
browser_switch_tab(tab_id)   # confirm windowFocused: true
```

### Step 2 — Confirm the page shape

Navigate to the meeting URL with transcript mode on, then verify the container
and block count:

```
browser_navigate("https://tldv.io/app/meetings/<MEETING_ID>/?transcript=true&video=false")

browser_execute_script(`
  (() => {
    const c = document.querySelector('#transcript-container');
    const ps = c ? c.querySelectorAll('p[data-index]') : [];
    return { container: !!c, blocks: ps.length, scrollHeight: c ? c.scrollHeight : 0 };
  })()
`)
```

A healthy meeting shows `blocks: 390`-style totals and a large `scrollHeight`.
`blocks` is the authoritative total to reach.

### Step 3 — Install the collector

The accumulator and collector must be installed **in page context**. Re-install
them after any page reload — a reload wipes them.

Call `browser_execute_script` with the contents of
[`scripts/collector.js`](scripts/collector.js). This defines:

- `window.__acc` — `{ [dataIndex]: { time, speaker, text } }`
- `window.__collect()` — sweeps the DOM, harvests any block with text, dedupes
  into `__acc`, returns how many were newly added
- `window.__save()` / `window.__load()` — persist to `localStorage` so a reload
  does not destroy progress

**Write `__acc` to `localStorage` after every sweep batch.** This is the single
most important defensive habit here: the page reloads itself or gets reloaded,
and unsaved progress is gone.

### Step 4 — Sweep the list

Use [`scripts/sweep.js`](scripts/sweep.js). It walks `scrollTop` from 0 to
`scrollHeight` in steps, dispatching a scroll event at each stop, and calls
`__collect()`.

Two hard constraints, learned the hard way:

- **`browser_execute_script` times out at 30000 ms.** A full sweep in one call
  will be killed. Budget by wall clock inside the loop (e.g. `Date.now() + 18000`)
  and return `done: false` so you can resume with another call. Save to
  `localStorage` before returning.
- **Fast sweeps leave gaps.** A fast pass (`STEP 60–150`, `DWELL 150–280 ms`)
  reaches the last index but silently misses ranges — observed missing
  `38-41, 51-68, 73-124, 158-169, 188-225, 232-245, 252-270`, yielding 233/390.
  A **slow full pass from 0 to `scrollHeight`** closed every gap to 390/390.
  Prefer slow-and-complete over fast-and-retried.

Loop until `__acc` reaches the total from Step 2.

### Step 5 — Recover a frozen virtualizer

Symptom: `scrollTop` changes but the rendered index window stays pinned
(e.g. stuck at 142–146, 182–187, 82–86) sweep after sweep.

Recovery, in order:

1. `browser_scroll` (a *trusted* scroll) on `#transcript-container` with
   `y=500..800`. This is the most reliable unblocker.
2. Re-dispatch the synthetic scroll event.
3. Reload the page, then `__load()` from `localStorage` and continue.

Do not try to defeat the virtualizer by inflating the container
(`max-height: 6000px`, clearing inline styles). Tested — it does **not**
increase the rendered block count. Revert it.

### Step 6 — Verify completeness BEFORE writing

Never trust the sweep. Assert against the expected total:

```
browser_execute_script(`
  (() => {
    const total = document.querySelectorAll('#transcript-container p[data-index]').length;
    const acc = window.__acc || {};
    const keys = Object.keys(acc).map(Number).sort((a,b) => a-b);
    const missing = [];
    for (let i = 0; i < total; i++) if (!acc[i]) missing.push(i);
    const empty = keys.filter(k => !(acc[k].text || '').trim());
    const badTimes = keys.filter((k,i) => i > 0 && acc[k].time < acc[keys[i-1]].time);
    return { total, have: keys.length, missing, empty, nonMonotonicTimes: badTimes,
             firstTime: keys.length ? acc[keys[0]].time : null,
             lastTime: keys.length ? acc[keys[keys.length-1]].time : null };
  })()
`)
```

**Gate: `missing`, `empty`, and `nonMonotonicTimes` must all be `[]` and
`have === total`.** A non-empty result means go back to Step 4 for the gaps.
Only proceed when clean. `nonMonotonicTimes` catches blocks collected out of
order, which signals a mis-mapped index.

### Step 7 — Build the markdown

Run [`scripts/build-markdown.js`](scripts/build-markdown.js). It turns `__acc`
into lines and a full markdown document, and computes speaker tallies.

Then get the content out of the browser. **Chunk base64, do not paste raw.**
A 127k-character document will be truncated in transit. Split into ~20k-character
base64 parts, retrieve them across several calls, concatenate, and decode to the
file. [`scripts/emit-chunks.js`](scripts/emit-chunks.js) does the splitting.

### Step 8 — Verify the file on disk

Re-verify after writing. Fetch a per-row fingerprint from the browser
(`hms~speaker~textLength` per line) and diff it against the file:

```
browser_execute_script(`(window.__lines||[]).map(r => r.hms+'~'+(r.speaker||'')+'~'+(r.text||'').length).join('\\n')`)
```

Then compare row-by-row. This is what catches hand-transcription mistakes — in
the reference run it caught a one-character typo (`memperbaikinya` vs
`memperbaikannya`) that a row *count* would have passed.

Check both output sections: the table and the plain-text section must each have
the full block count.

## Output format

```
# Transcript — <meeting title>

- **Meeting ID:** `<id>`
- **URL:** <url>
- **Duration:** <hh:mm:ss> (<seconds> detik)
- **Blocks:** <n>
- **Speakers:** <n>

## Speakers
| Speaker | Blocks |
| --- | ---: |

## Full Transcript
| # | Time | Speaker | Text |
| ---: | --- | --- | --- |

## Plain Text
**[hh:mm:ss] Speaker:** text
```

## Pitfalls checklist

- [ ] Tab foregrounded before any click/scroll
- [ ] `__acc` saved to `localStorage` after each batch
- [ ] Sweeps budgeted under 30 s, resumable
- [ ] Slow full pass (not fast) to close gaps
- [ ] Frozen virtualizer recovered with a *trusted* `browser_scroll`
- [ ] Verification gate clean before writing
- [ ] Base64 chunked for transfer
- [ ] File re-verified row-by-row against browser data

## Syntax gotchas in page context (main world)

- `??` and `?.` throw `Unexpected token '?'`. Avoid them; use explicit
  `if/else` and `&&` guards.
- CSP blocks `unsafe-eval`. Do not use `eval` or `new Function`.
- `getEventListeners` is available and is a useful signal: the transcript
  container carries ~50 listeners, consistent with a heavily-bound virtualizer.

## Caveat to pass to the user

The output is **auto-generated caption text**. Expect misheard names and
terminology, inconsistent speaker labels for the same person, and no
punctuation. State this plainly — the file is a raw extraction, not a
publication-ready document.
