// emit-chunks.js — pull base64 chunks out of the page, one batch per call.
//
// A full document is ~127k chars and WILL be truncated if pasted raw.
// Retrieve ~20000-char base64 chunks, a few per call, then concatenate and
// base64-decode into the .md file on disk.
//
// Usage: change FROM/TO and re-run until all parts are collected.
// Decode on the host, e.g. PowerShell:
//
//   $b64 = ($chunks | ForEach-Object { Get-Content $_ -Raw }) -join ''
//   $md  = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($b64))
//   [IO.File]::WriteAllText($out, $md, (New-Object Text.UTF8Encoding($false)))

(() => {
  const FROM = 0; // inclusive part index
  const TO = 2;   // inclusive; keep to ~3 parts per call to stay under limits

  const parts = window.__parts || [];
  if (!parts.length) return { error: 'no __parts — run build-markdown.js first' };

  const res = { total: parts.length, lengths: parts.map((p) => p.length) };
  for (let i = FROM; i <= TO && i < parts.length; i++) {
    res['p' + i] = parts[i];
  }
  return res;
})()
