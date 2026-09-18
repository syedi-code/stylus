# Housekeeping — September 2026

A running log of one housekeeping pass over stylus: what was removed, what was
changed, and what an open-source release still needs. Written to be read cold,
with no memory of the session that produced it.

Branch: `chore/drop-threads`, cut fresh from `main` at `45321b6`.

State of play: the branch cleanup is done and every remote branch verifies
clean; the one outstanding step is a GitHub Support gc — see section 4. The
housekeeping work is merged to both `main` (PR #5) and `staging` (PR #6) and
deployed to both. History has since been rewritten to purge the unreferenced
licensed fonts — see section 1 — so **`main` and `staging` were force-pushed and
every commit hash below the rewrite changed.** Anyone holding an older clone
must re-clone or hard-reset; a plain `git pull` will try to merge the two
histories together.

A verified full backup of the pre-rewrite history is at
`../stylus-prefilter-backup.bundle` (19 MB, `git bundle verify` clean). Keep it
until the rewrite is known good, then delete it.

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
`sk-` / `ghp_` / `AKIA` prefixed keys, PEM private key headers, `Bearer` tokens,
and assigned `password` / `api_key` literals. Two hits, both benign:

- `package-lock.json` — npm `integrity` hashes matching the base64 shape. Noise.
- `.env.example` — `VITE_API_KEY=123456789abcdef0123456789abcdef`, an obvious
  placeholder. That variable is also dead now; the current `.env.example` only
  declares `VITE_API_URL`.

No real credential has ever been committed. Deploy credentials
(`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`) are GitHub Actions secrets and
are correctly referenced rather than inlined. `WORKER_URL` is in `wrangler.toml`
deliberately and is not a secret — see the comment there for why it cannot live
in the dashboard.

### The licensed fonts — partly purged, partly still here

`public/fonts/` held 7.1 MB of retail typefaces committed as binaries, from Klim
Type Foundry (Tiempos, Söhne) and Commercial Type (Lyon Text). They split into
two groups with very different stakes, and only one group has been dealt with.

**Purged from history** (5.3 MB, 15 blobs) — licensed material that _nothing
referenced_, so removing it changed no pixel:

| Removed                                | Why it was here                     |
| -------------------------------------- | ----------------------------------- |
| `Tiempos.zip` (2.7 MB)                 | the original purchase archive       |
| `Tiempos/TiemposHeadline/*.otf` (× 12) | a whole family, never `@font-face`d |
| `vllg_TiemposHeadline.pdf` (1.1 MB)    | vendor specimen                     |
| `vllg_TiemposText.pdf` (0.9 MB)        | vendor specimen                     |

Done with `git filter-repo --invert-paths` over every ref, then force-pushed to
`main` and `staging`. Verified before pushing: the tree diff against the
pre-rewrite `main` is exactly those 15 paths and nothing else; every surviving
file is the _same blob hash_; both branches kept their full commit count (245
and 244). Production and staging both redeployed green afterwards, alexandria
smoke test included.

**Still in the repo** (1.8 MB, 13 blobs) — the faces `@font-face` actually
serves, and which the app cannot render without:

- `Tiempos/TiemposText/*.otf` × 8 — the body face, `--font-body`
- `SohneMono-{Regular,Medium,Bold}.otf` × 3 — `--font-mono`, used for numerals

These are still paid, per-seat licenses, still `.otf` desktop files being served
as webfonts (usually a separately-priced tier), and **publishing this repo would
still redistribute them.** Nothing here is legal advice and the EULAs have not
been read. Removing them is a decision with a runtime cost, so it was
deliberately left open:

1. Host them privately (R2 or similar) and point `@font-face` at that URL. Prod
   keeps its typography; the repo becomes publishable.
2. Swap to an open serif/mono stack of similar character. No hosting needed, but
   the app's look changes on every surface.
3. Keep the repo private and publish a scrubbed mirror.

### A dangling `@font-face`: Lyon Text

`src/style.css` declares `'Lyon Text'` from
`/fonts/LyonText/Lyon Text Regular.otf`, **but that file is not in the repo and
has not been for some time** — it was added and later deleted, well before this
housekeeping pass. The build says so on every run:

```
/fonts/LyonText/Lyon Text Regular.otf ... didn't resolve at build time
```

So that `@font-face` 404s in production and the rule never applies. Either
restore the file or delete the declaration; right now it is dead weight that
also misstates which foundries this project depends on.

### Missing before a public release

- **No `LICENSE` file.** `package.json` says `"private": true` and declares no
  license, so the code is currently all-rights-reserved by default. Pick one.
- `.gitignore` did not cover `.wrangler/`, wrangler's local state directory.
  Fixed.
- `.env.example` named a `VITE_API_KEY` that nothing reads. Fixed.
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

## 3. Unreferenced components — left in place, needing a decision

A sweep for components nothing imports. These were **not** deleted: dead code is
one thing, but each of these is a capability someone may have meant to wire up,
and that is a product call.

Orphaned by the threads removal, though their wiring was already dead:

- `library/AuthorManager.vue` and `library/EditAuthorModal.vue` — both were
  imported by `App.vue`, but nothing ever set `showAuthorModal` to `true` and
  `AuthorManager` was imported without ever being rendered. So **there is
  currently no way to edit an author in the UI**, and there was not one before
  this branch either. Either wire it to `LibraryPage` or drop both.
- `essays/EssayReferenceChips.vue` — its only caller was `ThreadViewEssay`.

Already orphaned on `main` before this branch, untouched for 4–6 months:

- `essays/EssayEndSlide.vue`
- `library/BookManager.vue`
- `shared/FilterBar.vue`

Nothing here is reachable, so nothing here ships — they cost repository noise,
not bundle size.

---

## 4. What GitHub still serves

After the rewrite, the force-push and the branch deletions, every branch on
`origin` verifies clean:

    origin/main                   clean
    origin/staging                clean
    origin/chore/font-purge-notes clean

**The purged fonts are still downloadable anyway.** GitHub keeps a permanent
`refs/pull/<n>/head` for every pull request ever opened, and those refs still
point at pre-rewrite commits. Deleting the branches did not touch them. Checked
by fetching `refs/pull/*/head` straight from the remote:

| PR ref | State                            |
| ------ | -------------------------------- |
| #1–#6  | 16 purged blobs still reachable  |
| #7–#8  | clean (opened after the rewrite) |

This is not theoretical. Pulling one blob back out of PR #1's ref returns an
intact 56 KB OpenType font, `OTTO` magic bytes and all — the real
`TiemposHeadline-Black.otf`, live from GitHub, today. Anyone who knows or
guesses a commit SHA can fetch it, and those SHAs are printed in the PR
timelines.

Only GitHub can remove these; there is no client-side command that reaches
`refs/pull/*`. Open a Support request (https://support.github.com/) asking them
to run `gc` on the repository. Something like:

> Repository: syedi-code/stylus.socialeating.studio
>
> I rewrote this repository's history with `git filter-repo` to remove
> commercially licensed font binaries that should never have been committed, and
> force-pushed the rewritten `main` and `staging`. I have also deleted all
> merged branches. No branch references the old commits any more.
>
> However, `refs/pull/<n>/head` for PRs #1–#6 still points at the pre-rewrite
> commits, so the removed files remain fetchable by SHA. Please garbage-collect
> the repository so these unreachable objects are dropped.

Until that lands, treat the repository as still containing the fonts — because
it does.

---

## 5. TODO — carried forward

- [ ] **Break `App.vue` into child components until no logic remains in it.** It
      is still the app's junk drawer: it owns quotes state, loading, search and
      its 300 ms debounce, plus every modal and every mobile FAB. Every other
      tab already owns itself (`NotesPage`, `ThoughtsList`, `EssaysWorkspace`,
      `LibraryPage`); quotes is the last tab whose state lives in the root.
      Extracting `QuotesPage.vue` with a `reload()` on `defineExpose`, matching
      the `NotesPage` convention, is the first step.
- [ ] Decide the font question above. It gates everything else.
- [ ] Add a `LICENSE`.
- [ ] Audit **alexandria** the same way; `notes.jsonl` is probably there.
- [ ] Decide on the six unreferenced components in section 3 — in particular
      that author editing has no route into it from the UI.
- [x] ~~Delete the three merged branches on GitHub.~~ Done.
      `chore/drop-threads`, `chore/tab-title-stylus` and
      `chore/wordmark-and-deploy-links` are gone; `origin` now carries only
      `main`, `staging` and the branch this note arrived on. Every remaining
      remote branch verifies clean.
- [ ] **Ask GitHub Support to garbage-collect the repository.** This is the last
      step, and the purge is genuinely incomplete without it — see "What GitHub
      still serves" below for the proof and a message to send.

- [ ] Resolve the Lyon Text `@font-face` that points at a file the repo does not
      contain.
- [ ] Once the rewrite is trusted, reclaim local disk: the old objects are still
      held by `refs/oldmain`, `refs/oldstaging` and the reflog.

      git update-ref -d refs/oldmain && git update-ref -d refs/oldstaging
                  git reflog expire --expire=now --all && git gc --prune=now --aggressive
