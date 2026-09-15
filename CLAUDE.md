# stylus

Vue 3 frontend for notes, thoughts, quotes and essays. No database, no server
logic — every byte of data comes from **alexandria** over `/api/*`.

## Stack

TypeScript 5.9 · Vue 3.5 · Vite 7 · Tailwind 4 · axios · vitest · Cloudflare
Pages (with one Pages Function).

## Commands

```bash
npm run dev      # vite, port 4571
npm run test     # vitest
npm run lint     # eslint
npm run build    # vue-tsc -b && vite build
npm run deploy   # build, then wrangler pages deploy
```

## Layout

```text
src/components/   by domain: notes, quotes, thoughts, threads, essays, library
src/composables/  reusable stateful logic
src/lib/          api client, auth, formatting, the essay token grammar
functions/api/    the Pages Function that proxies /api/* to alexandria
```

## Things that will bite you

**`src/lib/essayTokenGrammar.ts` is a copy.** It is owned by alexandria
(`packages/core/writing/essay-tokens.ts`). If the grammar itself changes —
the regex, the quoting rules, the clamping — both copies have to change. It
has not changed since May 2026.

**`src/lib/contract.ts` is not a copy, it is a cache.** Field limits and the
embed param vocabulary arrive from the server in the `POST /session` response.
The literals in that file are a fallback for the first few frames. Do not add
a param there and expect it to work — add it in alexandria.

**Import both through `src/lib/essayTokens.ts`.** That module binds the
grammar to the live vocabulary. Importing either half directly gets you the
fallback vocabulary instead of the server's.

**Columns are still called `book_id`.** alexandria renamed `books` to `works`,
but the ids are embedded in essay prose as `[[book:UUID]]` tokens, so the
names stayed. A column name is not a contract.

**The API is additive-only.** alexandria serves two frontends; a field is
never removed, never retyped, never has its enum narrowed. If you need a
breaking change, it is a planned two-repo event, not a commit.

## Style

Follow the surrounding code. Be extremely light on comments; only add one
where the intent is not obvious from reading the code itself.
