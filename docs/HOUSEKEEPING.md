# Housekeeping — September 2026

A running log of one housekeeping pass over stylus: what was removed, what was
changed, and what an open-source release still needs. Written to be read cold,
with no memory of the session that produced it.

Branch: `chore/drop-threads`, cut fresh from `main` at `45321b6`.

---

## 1. Open-source readiness audit

### The headline: `notes.jsonl` is not in this repository

The concern that prompted the audit was a personal journal export
(`notes.jsonl`) believed to be buried in the commit history, possibly requiring
the repo to be deleted and recreated. **It is not here.** Checks run:

| Check                                                      | Result             |
| ---------------------------------------------------------- | ------------------ |
| Every path ever added, in every branch (`--diff-filter=A`) | 248 paths, no hit  |
| Every path ever _touched_, in every branch                 | no hit             |
| Every reachable blob, by size, largest 25                  | all fonts/textures |
| `git fsck --dangling --lost-found` (amended-away commits)  | nothing dangling   |
| `git stash list`                                           | empty              |

No file matching `*.jsonl`, `*.csv`, `*.sqlite`, `*.db`, `*.sql`, `*.dump` has
ever existed on any branch. The largest non-asset blob in history is
`package-lock.json` at 181 KB.

**Conclusion: no history rewrite is needed, and the repo does not need to be
deleted and recreated.** The journal is most likely in **alexandria** — the
data-owning repo — which is where an import script would naturally have lived.
That repo has not been audited; it should get the same treatment before it is
opened.

### Secret scan

Every text blob in history (all branches, all commits) was scanned for JWTs,
`sk-` / `ghp_` / `AKIA` prefixed keys, PEM private key headers, `Bearer`
tokens, and assigned `password` / `api_key` literals. Two hits, both benign:

- `package-lock.json` — npm `integrity` hashes matching the base64 shape. Noise.
- `.env.example` — `VITE_API_KEY=123456789abcdef0123456789abcdef`, an obvious
  placeholder. That variable is also dead now; the current `.env.example` only
  declares `VITE_API_URL`.

No real credential has ever been committed. Deploy credentials
(`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`) are GitHub Actions secrets and
are correctly referenced rather than inlined. `WORKER_URL` is in `wrangler.toml`
deliberately and is not a secret — see the comment there for why it cannot live
in the dashboard.

### The actual blocker: commercially licensed fonts

`public/fonts/` is 6.1 MB of retail typefaces committed as binaries:

| Family                           | Foundry                     |
| -------------------------------- | --------------------------- |
| Tiempos Text, Tiempos Headline   | Klim Type Foundry, via VLLG |
| Söhne Mono (Bold/Medium/Regular) | Klim Type Foundry           |
| Lyon Text                        | Commercial Type             |

Also committed: `Tiempos.zip` (2.7 MB — the original purchase archive, still in
history) and `vllg_TiemposHeadline.pdf` / `vllg_TiemposText.pdf`, the vendor
specimen PDFs, which are a receipt for the license as much as anything.

These are paid, per-seat licenses. Publishing the binaries in a public
repository redistributes them to anyone who clones it. Separately, they are
`.otf` desktop files being served over HTTP as webfonts, which is usually a
distinct and separately-priced license tier from desktop use.

This has not been checked against the actual EULAs and is not legal advice, but
it is the one finding that genuinely stands between this repo and a public one.
Options, cheapest first:

1. **Delete the fonts from the working tree and from history**, ship the repo
   with a free fallback stack, and document what the intended faces are. Since
   `public/_headers` already treats fonts as immutable name-versioned assets,
   they can be served from a private bucket instead. This is the only option
   that also sheds ~9 MB of history.
2. Keep the repo private and open a scrubbed mirror.
3. Read the EULAs and confirm whether a public repo is permitted. Unlikely.

Note that option 1 _does_ require the history rewrite that `notes.jsonl` turned
out not to need — the fonts are in old commits, not just `HEAD`.

### Missing before a public release

- **No `LICENSE` file.** `package.json` says `"private": true` and declares no
  license, so the code is currently all-rights-reserved by default. Pick one.
- **`.gitignore` does not cover `.wrangler/`**, wrangler's local state
  directory. It shows up as untracked noise in every `git status`.
- `.env.example` still names `VITE_API_KEY`, which nothing reads. Stale.
- `README.md` should say that the app is inert without an alexandria instance,
  since there is no mock or fixture mode. A cloner cannot run this standalone.

### What would be lost if the repo were deleted and recreated

Asked specifically. All build, deploy and CI configuration is **in-repo** and
travels with a push:

- `.github/workflows/` — checks, deploy-production, deploy-staging
- `.github/actions/deploy-pages/action.yml` — the shared composite action
- `wrangler.toml` including the `WORKER_URL` vars that a dashboard edit cannot
  survive, `public/_headers`, `.prettierrc`, `.nvmrc`, `eslint.config.mjs`, the
  four `tsconfig*.json`, `vite.config.ts`, `vitest.config.ts`

What lives outside the repo and **would** have to be recreated by hand:

- The two GitHub Actions secrets, `CLOUDFLARE_API_TOKEN` and
  `CLOUDFLARE_ACCOUNT_ID`. The token needs `Account → Cloudflare Pages → Edit`;
  the deploy action preflights exactly this and fails loudly if it is missing.
- The `staging` branch, plus any branch protection and the default-branch
  setting.
- Issue and PR history. Not much yet — PRs #1 and #3.

The Cloudflare Pages project itself is **safe**. Deploys run through
`wrangler pages deploy` with an API token, not Cloudflare's GitHub integration,
so the Pages project is not bound to this GitHub repo and would keep its custom
domains (`stylus.socialeating.studio`, `anti.socialeating.studio`,
`journal.ibrahimsyed.io`) across a recreate.

Since no history rewrite is needed for the journal, **recreating the repo buys
nothing.** If the fonts are removed from history, that is a `filter-repo` pass
on the existing repo, which preserves the issues and PRs a recreate would drop.

---

## 2. Threads removed

The Threads feature — user-curated ordered collections spanning notes, quotes,
thoughts and essays — was long obsolete and has been deleted.

Removed outright:

- `src/components/threads/` — `ThreadList`, `ThreadCard`, `ThreadDetail`,
  `AddToThreadModal`
- the four per-entity thread renderers, each used only by `ThreadDetail`:
  `notes/ThreadViewNote.vue`, `quotes/ThreadViewQuote.vue`,
  `thoughts/ThreadViewThought.vue`, `essays/ThreadViewEssay.vue`
- `src/lib/api.ts` — the `Thread`, `ThreadInput` and `ThreadItem` types and all
  eleven `/threads/*` client functions, two contiguous blocks
- the `threads` tab, and the per-item "Add to thread…" / "in &lt;thread&gt;"
  chips on note, quote, thought and essay surfaces
- the `'thread'` `ViewContext` in `useTypography` and the `'thread'` variant in
  `BookAttribution`, both reachable only from the deleted `ThreadView*` files

The endpoints still exist server-side; alexandria's API is additive-only and
this removal is client-side only. Nothing was asked of alexandria.

---

## 3. TODO — carried forward

- [ ] **Break `App.vue` into child components until no logic remains in it.**
      It is still the app's junk drawer: it owns quotes state, loading, search
      and its 300 ms debounce, plus every modal and every mobile FAB. Every
      other tab already owns itself (`NotesPage`, `ThoughtsList`,
      `EssaysWorkspace`, `LibraryPage`); quotes is the last tab whose state
      lives in the root. Extracting `QuotesPage.vue` with a `reload()` on
      `defineExpose`, matching the `NotesPage` convention, is the first step.
- [ ] Decide the font question above. It gates everything else.
- [ ] Add a `LICENSE`.
- [ ] Audit **alexandria** the same way; `notes.jsonl` is probably there.
