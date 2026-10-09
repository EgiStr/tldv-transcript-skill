# Reference run — verified findings

Concrete numbers from the run this skill was derived from. Useful as a sanity
baseline: if your run looks materially different, something is off.

Meeting: `6ac740deabce3900133486c2` (tl;dv), 01:40:03 duration.

## Final state

| Metric | Value |
| --- | --- |
| Transcript blocks | 390 / 390 |
| Missing indices | `[]` |
| Empty text blocks | `[]` |
| Non-monotonic timestamps | `[]` |
| First block | `00:00` Seruni Dewanti |
| Last block | `01:40:03` Yavta_M_Klini |
| Raw text chars | 55,802 |
| Markdown chars | 127,202 |
| Markdown lines | 1,199 |

Speaker tally:

| Speaker | Blocks |
| --- | ---: |
| Seruni Dewanti | 130 |
| sri_c_fauzi_x | 117 |
| Yavta_M_Klini | 67 |
| m_fh_n_x | 57 |
| Ria Masyita | 15 |
| faisal | 4 |

## Failed approaches (do not repeat)

Each of these consumed real time before being ruled out:

- **Direct API calls.** `https://gaia.tldv.io/v1/meetings/<id>/transcript`,
  `https://gw.tldv.io/v1/meetings/<id>/transcript`,
  `https://gw.tldv.io/v1/meetings/<id>/segments` —
  all `TypeError: Failed to fetch` from page context (CORS).
  Same result from the extension background fetch path.
- **`video.play()`** — `AbortError: The play() request was interrupted because
  video-only background media was paused to save power`. Browser policy, not a
  bug in the call.
- **`currentTime` seek while paused** — no re-render. Failed across ~5–6
  consecutive attempts. The "seek to the highest rendered timestamp and repeat"
  loop is intuitive and does not work.
- **Other data sources** — no `textTracks`, no useful `caches` entries, no
  transcript in IndexedDB (only `firebase-*`), no token in localStorage/cookies.
  The transcript exists only in rendered DOM.
- **Inflating the container** — `max-height: 6000px` and clearing inline styles
  did not increase the rendered block count. Reverted.

## Working technique

```js
const c = document.querySelector('#transcript-container');
c.scrollTop = pos;                                       // move the window
c.dispatchEvent(new Event('scroll', { bubbles: true })); // force re-render
```

Alternate unblocker when the virtualizer freezes: a **trusted** scroll via
`browser_scroll` on `#transcript-container` (`y=500/600/800`).

## Sweep speed matters

| Strategy | Outcome |
| --- | --- |
| Fast (`STEP 60–150`, `DWELL 150–280 ms`) | Reached index 389 but **233/390** — gaps at `38-41, 51-68, 73-124, 158-169, 188-225, 232-245, 252-270` |
| Slow full pass, 0 → `scrollHeight` | **390/390**, all gaps closed |

Fast sweeps look successful because they reach the end. They are not.

## Operational constraints hit

- `browser_execute_script` times out at **30000 ms**. Loops of 30/70/84 steps
  were killed. Wall-clock-budgeted loops (~18–20 s) returning `done: false`
  worked.
- **Virtualizer froze** repeatedly while `scrollTop` kept changing — window
  pinned at 142–146, 182–187, 82–86. Recovered with `browser_scroll`, and in
  some cases a reload (which resets the window to index 0 and requires
  `__load()` from `localStorage`).
- **Tab must be foregrounded.** `browser_click` returned
  `method: "scripting-fallback"` with "The tab was in the background" and clicks
  did not land. `browser_switch_tab` fixed it (`windowFocused: true`).
- **Page-context syntax limits:** `??` and `?.` throw `Unexpected token '?'`;
  CSP blocks `unsafe-eval`.
- The container carries ~52 event listeners (`getEventListeners` is available in
  page context) — consistent with a heavily-bound virtualizer.

## The verification that mattered

Row count alone would have passed a file with a typo. Fetching
`hms~speaker~textLength` per row from the browser and diffing against the file
surfaced exactly one mismatch:

- Row 204, browser: `...gimana memperbaikannya belum tentu bisa...`
- Row 204, file: `...gimana memperbaikinya belum tentu bisa...`

One character. Fixed, then re-verified to zero mismatches across all 390 rows.
This is why `fingerprint.js` exists.
