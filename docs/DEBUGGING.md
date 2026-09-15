# Debugging

## Texture debug overlay (`?texdebug`)

An opt-in on-screen log of every texture load, built for debugging iOS Safari/Chrome
where there's no devtools access. Lives in
`src/components/shared/TextureDebugOverlay.vue`, fed by the ring buffer in
`src/composables/useTextureBlob.ts`.

### Enable / disable

| Action  | URL                                        |
| ------- | ------------------------------------------ |
| Enable  | append `?texdebug=1` (or just `?texdebug`) |
| Disable | append `?texdebug=0`                       |

The flag persists to `localStorage` (`texdebug=1`), so it survives Cloudflare Access
re-auth redirects that strip query strings. When disabled, the component renders
nothing — zero cost.

### Reading the output

Tiny green mono text, fixed bottom-left, newest line first (capped at 30):

```
14:02:11 fb-nebula 200 image/webp 421KB red:n dec:ok [public, max-age=31536000, immutable] → blob
14:02:30 fb-nebula → cache-hit
14:03:02 fb-smoke ERR TypeError: Load failed → raw
```

| Field                       | Meaning                                                            |
| --------------------------- | ------------------------------------------------------------------ |
| `fb-nebula`                 | texture name (`/textures/<name>.webp`)                             |
| `200 image/webp 421KB`      | response status, content-type, size                                |
| `red:y`                     | response was redirected — likely a Cloudflare Access bounce        |
| `dec:ok` / `dec:fail`       | diagnostic `img.decode()` result (iOS false-rejects under memory pressure; a `fail` with a visible texture is fine) |
| `[...]`                     | response `cache-control` — proves the `_headers` rules deployed    |
| `→ blob`                    | fetched once, painting from a `blob:` URL from now on              |
| `→ cache-hit`               | painted synchronously from the module cache (the good path)        |
| `→ retry`                   | attempt failed transiently; retrying with backoff (up to 3 tries)  |
| `→ raw`                     | all attempts failed; fell back to the raw URL — retried on next use |
| `(try 2)`                   | which fetch attempt this line describes                            |
| `✓ all 18 textures warmed`  | idle prefetch finished — every texture is cached as a blob         |
| `ACCESS BOUNCE` (red)       | a fetch was redirected cross-origin — Access session expired; reload to re-auth |

### Why it exists

The iOS "black texture on reopen" bug (PR #263) only reproduced on prod/staging behind
Cloudflare Access, on a phone, with no way to see what the network layer was doing.
This overlay is the on-device answer: it shows per-URL fetch outcomes, redirect status,
and cache headers directly on screen.

### Pattern worth reusing

For any future mobile-only / prod-only bug, the same shape works: a module-level
`ref` ring buffer next to the suspect code, plus a `<Teleport to="body">` overlay
gated on a persisted query flag. Removal is one file plus a one-line mount in
`App.vue`.
