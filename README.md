# stylus

| Deployment | Branch    | URL                                    |
| ---------- | --------- | -------------------------------------- |
| Production | `main`    | <https://stylus.socialeating.studio>   |
| Staging    | `staging` | <https://staging.stylus-64v.pages.dev> |

Both sit behind Cloudflare Access, so an unauthenticated visit redirects to the
login rather than showing anything.

Notes, thoughts, quotes and essays — the writing half of the system. Vue 3 +
TypeScript + Vite, deployed to Cloudflare Pages.

stylus holds no data of its own. Everything comes from **alexandria**, the
backend, over `/api/*`. There is no mock mode and no fixture set, so a clone of
this repository shows nothing until it is pointed at an alexandria instance —
deliberately, because a fixture that drifts from the API is worse than none.

The typefaces in `public/fonts/` are commercially licensed and are **not**
covered by this repository's licence. See [`FONTS.md`](FONTS.md) before you
fork.

## How it talks to alexandria

The browser calls `/api/*` on this origin. `functions/api/[[catchall]].ts` — a
Pages Function — proxies those requests to the worker named in `WORKER_URL`,
lifting the Cloudflare Access JWT out of the `CF_Authorization` cookie into a
`cf-access-jwt-assertion` header on the way.

Same-origin by construction, so there is no CORS, no cross-site cookie handling,
and no second API client to keep in step.

```
wrangler pages secret put WORKER_URL --project-name stylus
# https://alexandria.socialeating.studio
```

For local development against a worker running on your machine, set
`VITE_API_URL` in `.env` to bypass the proxy entirely:

```
VITE_API_URL=http://localhost:8787/api
```

## Development

```bash
npm install
npm run dev        # http://localhost:4571
npm run test
npm run lint
npm run build
npm run deploy:prod      # CI does this on push to main
npm run deploy:staging   # and this on push to staging
```

## Two files worth knowing about

`src/lib/essayTokenGrammar.ts` is copied from alexandria. Essay embeds are
written inline as `[[book:UUID size=26]]`, and both halves of the system read
that syntax — the server to work out which works an essay cites, the browser to
render it and to show live preview while you type. A network call per keystroke
is not an option, so the grammar is duplicated. It has not changed since
May 2026.

`src/lib/contract.ts` is the other half, and works the opposite way. Which
parameters an embed may carry, and how long each field may be, are _data_ — they
arrive in the `POST /session` response. The values in that file are only a
fallback for the frames before the server answers. Adding a param is a server
change; nothing here has to follow.

Import both through `src/lib/essayTokens.ts`, never directly.

## History

This repo was extracted from `antisocial-media` with `git filter-repo`, so the
commits are the real ones. Roughly nine in ten of them also touched the backend,
which stayed behind — expect messages describing changes you cannot find here.

## Related repositories

|                                                                                |                                                            |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| [**alexandria**](https://github.com/syedi-code/alexandria.socialeating.studio) | The backend. Every row this app shows belongs to it        |
| [**scribe**](https://github.com/syedi-code/scribe.socialeating.studio)         | The other frontend: works, documents, and the reading half |
| [**alexandria-mcp**](https://github.com/syedi-code/alexandria-mcp)             | The library as MCP tools a model can use                   |

## Reading further

|                                      |                                                       |
| ------------------------------------ | ----------------------------------------------------- |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | Setup, the checks, and what matters in this codebase  |
| [`SECURITY.md`](SECURITY.md)         | What the proxy trusts, and the known limits           |
| [`FONTS.md`](FONTS.md)               | The licensed typefaces, and how to run without them   |
| [`CONTEXT.md`](CONTEXT.md)           | The glossary. Authoritative on what words mean here   |
| `docs/HOUSEKEEPING.md`               | The open-source readiness pass, and what it left open |

## License

ISC, for the code. Not for the fonts — see [`FONTS.md`](FONTS.md).
