# tldv-transcript

An agent skill that extracts the **complete** transcript from a [tl;dv](https://tldv.io)
meeting page and writes it to markdown, using a browser MCP.

tl;dv's transcript view resists naive scraping. This skill encodes the working
procedure — including the parts that are counter-intuitive and the pitfalls that
cost real debugging time.

## Install

```bash
npx skills add EgiStr/tldv-transcript-skill
```

Install into a specific agent:

```bash
npx skills add EgiStr/tldv-transcript-skill --skill tldv-transcript --agent claude-code
```

## Usage

Ask your agent:

> Scrape the transcript from https://tldv.io/app/meetings/&lt;MEETING_ID&gt;/?transcript=true&video=false
> and save it as markdown.

The skill triggers on "tldv transcript", "scrape tl;dv", "export tldv meeting",
"transkrip tldv".

## Requirements

- A browser MCP exposing JS evaluation and scroll control. Built and verified
  against **browser-mcp** (`browser_execute_script`, `browser_scroll`,
  `browser_switch_tab`). Other browser MCPs work if you map those three
  capabilities.
- An authenticated tl;dv session in that browser profile.

## What it produces

A markdown file with metadata, a speaker tally, a full transcript table, and a
plain-text section — every block, from the first to the last.

## Why the obvious approaches fail

| Approach | Result |
| --- | --- |
| Read the page once | Only ~5–8 blocks are in the DOM. Returns a sliver that looks complete. |
| Use the copy button | Free tier truncates around minute 1. |
| Call the API | `gaia.tldv.io` / `gw.tldv.io` blocked by CORS from page context. |
| `video.play()` | `AbortError` — blocked by the background power-saving policy. |
| Set `video.currentTime` while paused | Does not trigger re-render. |
| **Move `scrollTop` + dispatch a scroll event** | **Works.** The only reliable render trigger. |

## Structure

```
skills/tldv-transcript/
├── SKILL.md
└── scripts/
    ├── collector.js        # install in page: __acc / __collect / __save / __load
    ├── sweep.js            # drive the virtualizer, time-budgeted + resumable
    ├── verify.js           # completeness gate — run BEFORE writing output
    ├── build-markdown.js   # __acc -> lines + markdown + base64 chunks
    ├── fingerprint.js      # per-row fingerprint for file verification
    ├── emit-chunks.js      # pull base64 chunks out of the page
    └── decode-chunks.ps1   # reassemble chunks into the .md file
```

## The three habits that matter

1. **Save progress to `localStorage` after every sweep batch.** Pages reload;
   unsaved progress is gone.
2. **Sweep slowly.** A fast pass reaches the last index while silently missing
   whole ranges (observed: 233/390 with gaps at `38-41, 51-68, 73-124, ...`).
   A slow full pass closed every gap.
3. **Verify before writing, then verify the file.** The completeness gate caught
   real gaps; a row-by-row fingerprint diff against the browser data caught a
   one-character typo that a row count passed.

## Caveat

Output is **auto-generated caption text**. Expect misheard names and
terminology, inconsistent speaker labels for the same person, and no
punctuation. It is a raw extraction, not a publication-ready document.

## License

MIT — see [LICENSE](LICENSE).
