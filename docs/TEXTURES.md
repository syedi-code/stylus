# The texture system

How quote surfaces get their dark fluid-vortex backgrounds: where the assets
live, how a quote picks one, how it's painted, and how it's delivered without
tripping the iOS/Cloudflare Access failure modes that produced the "black
fullbleed" bug (PR #263).

## Assets

Nine variants, each in two tiers, all WebP, in `public/textures/`:

| Tier | Filename | Size | Used by |
| ---- | -------- | ---- | ------- |
| card | `tex-<slug>.webp` | ~1280px | textured card surfaces, feed thumbnails, essay foil quotes |
| fullbleed | `fb-<slug>.webp` | ~2560px | full-bleed presentation slides |

Slugs (see `VARIANTS` in `usePresentationQuoteMode.ts`): `vortex-01`,
`vortex-02`, `hurricane`, `maelstrom`, `turbulence`, `smoke`, `whirl-tight`,
`nebula`, `cyclones`.

**Textures are name-versioned and immutable.** `_headers` serves
`/textures/*` with `Cache-Control: public, max-age=31536000, immutable`, so
clients may cache a file for a year. Never edit a texture in place — add a
new filename (and VARIANTS entry) instead.

## Picking a texture: seeded, stable, everywhere the same

`usePresentationQuoteMode.ts` owns all of this:

- `variantForSeed(id)` — hashes the quote's id to one of the nine slugs.
  Pure function, so the same quote gets the same texture on every surface
  (Quotes-tab card, presentation modal, essay deck slide, essay foil quote)
  and across sessions. Toggling surface modes never swaps the texture.
- `textureAsset(variant, kind)` — builds the URL (`'card'` → `tex-*`,
  `'fullbleed'` → `fb-*`).
- `texturePositionForSeed(id)` — a seeded `"x% y%"` crop for full-bleed only,
  so each quote frames a different region of its texture instead of always
  the center. The hash salt goes *before* the seed (`'x:' + seed`) —
  suffix-salting would leave x/y correlated and pan only along the diagonal.
- `usePresentationQuoteMode(entity)` — the surface mode itself
  (`textured` → `fullbleed` → `plain`), persisted per-entity to localStorage.
- `allTextureAssets()` — every texture URL, fullbleed tier first; feeds the
  idle prefetch warmer (below).

## Painting

Two kinds of consumers:

1. **Presentation surfaces** (`QuoteSlideBody.vue`, the single choke point for
   both `PresentationViewQuote` and the essay deck's quote slides): paint the
   texture as a **CSS `background-image` from a `blob:` URL** via
   `useTextureBlob`. Never an `<img>` — a decode that fails under iOS's
   image-memory budget then degrades to the dark base instead of a
   broken-image glyph. Full-bleed layers a flat 20%-black gradient over the
   texture for legibility, plus the user-adjustable darkness wash
   (`--tex-darkness`, from `usePresentationTextureDarkness` via the
   brightness slider).
2. **Mount-once surfaces** (`QuoteCard.vue` feed thumbnails,
   `FoilQuote.vue` in essays): paint the **raw URL** directly. They mount
   once and never re-resolve, so they never hit the repaint bug — and by the
   time they render, the warmer has usually populated the HTTP cache anyway.

## Delivery: the blob cache (`useTextureBlob.ts`)

This is the load-bearing part. In prod the whole site — textures included —
sits behind Cloudflare Access. Two WebKit failure modes come from that:

1. **Repaint poisoning** (the original black-screen bug): every repaint of a
   texture `url(...)` used to re-contact the network through the Access gate.
   If any re-request came back as a non-image (Access bounce to the HTML
   login page), WebKit poisoned its per-page cache entry for that URL and
   every later paint silently no-op'd → black screen until reload.
2. **Transient fetch failures**: Safari 18 sometimes fails a fetch on a stale
   keep-alive connection with a generic `TypeError: Load failed` instead of
   retrying it like other browsers do. Random, unreproducible, more likely
   right after returning to the app.

The cache defeats both:

- Each texture URL is fetched **once per page lifetime** and held as a
  never-revoked `blob:` URL in a module-level map. Repaints read the blob —
  no network, no Access, no HTTP-cache entry to poison. Total pinned memory
  is the compressed bytes of ≤18 files (~6MB), document-scoped, freed on
  reload.
- Fetches **retry with backoff** (3 attempts; 250ms, 1s) on transient
  failures. An off-origin redirect (Access session expired) fails fast and
  sets the `ACCESS BOUNCE` flag instead — retrying can't fix auth.
- **Only successes are memoized.** A failed load falls back to the raw URL
  for that one paint but is forgotten, so the next request refetches. (An
  earlier version cached failures, which converted one random `Load failed`
  into a session-permanent black texture.)
- **Idle prefetch warmer**: `App.vue` calls `warmTextures(allTextureAssets())`
  once the browser is idle after auth. It resolves all 18 textures
  sequentially (never competing with data requests), gives stragglers a
  second pass 10s later, and logs one summary line. Result: transient
  failures and their retries happen invisibly before any quote is opened,
  and every open is a synchronous cache hit. Network cost is ~5–6MB once per
  device — repeat sessions come from the immutable HTTP disk cache.

Validation on the fetch path: status ok, same-origin final URL, no redirect,
`image/*` content-type. Anything else falls back to the raw URL. `img.decode()`
is run as a diagnostic only and never gates the result — iOS false-rejects it
under memory pressure while the CSS paint still succeeds.

## Debugging

`?texdebug=1` turns on an on-screen log of every texture load (fetch outcome,
retries, cache hits, warm summary, Access bounces) — see
[DEBUGGING.md](./DEBUGGING.md). This is how the bugs above were isolated on a
phone with no devtools.

## Adding a texture

1. Export both tiers as WebP: `tex-<slug>.webp` (~1280px) and
   `fb-<slug>.webp` (~2560px), dark/monochrome so white text stays legible.
2. Drop them in `public/textures/`.
3. Add the slug to `VARIANTS` in `usePresentationQuoteMode.ts`.

Note that changing `VARIANTS` (or the hash) reshuffles which texture every
existing quote gets, since assignment is `hash(id) % VARIANTS.length`.
