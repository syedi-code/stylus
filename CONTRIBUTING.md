# Contributing

## Setup

```bash
npm install
npm run dev     # http://localhost:4571
```

stylus reads
[alexandria](https://github.com/syedi-code/alexandria.socialeating.studio) and
holds no data of its own, so it needs one running: `npm run dev` in that
repository puts it on `:8787`. There is no mock mode and no fixture set — **the
app is inert without a backend**, deliberately, because a fixture that drifts
from the API is worse than no fixture.

Point elsewhere with `VITE_API_URL` in `.env`, which bypasses the proxy:

```
VITE_API_URL=http://localhost:8787/api
```

The typefaces are commercially licensed and not covered by this repository's
licence; see [`FONTS.md`](FONTS.md) before you fork.

## Before opening a pull request

```bash
npm run lint
npm test
npm run build
```

CI runs those three. Merging into `main` deploys production; merging into
`staging` deploys staging. The two are parallel targets, not a promotion chain —
never merge one into the other. Branch fresh off `main` and open a pull request
into each.

Prettier settles formatting, but run it over the files you touched rather than
the whole tree: some files predate the config and reformatting them would bury
your diff.

## What matters here

**alexandria owns every row.** If you find yourself adding a store, a cache with
a write path, or a second source of truth, stop. This is a view.

**The API is additive-only, in both directions.** alexandria never removes a
field or retypes one, and in return a breaking change is never asked for
casually. Code written against it now keeps working.

**Two files are copied from alexandria on purpose.**
`src/lib/essayTokenGrammar.ts` is the embed syntax, duplicated because a network
call per keystroke is not an option; `src/lib/contract.ts` holds fallbacks for
limits that actually arrive in the `POST /session` response. Import both through
`src/lib/essayTokens.ts`, never directly. The README explains the split.

**A root component composes and nothing else.** `App.vue` says what is on the
screen and in what order; logic belongs in the child that owns it. This was true
only after a deliberate pass to make it true, and it is easy to undo by
accident.

**Every colour, face and size is a token** in `src/style.css`. An arbitrary hex
in a component is a bug.

## Style

Comments are for what the code cannot say — a constraint, a trap, a decision
that looks arbitrary and is not. A comment restating the line below it will be
removed.
