# Security

## Reporting

Open a
[private security advisory](https://github.com/syedi-code/stylus.socialeating.studio/security/advisories/new).
Please do not open a public issue for a vulnerability.

There is no bounty and no SLA. This is one person's journal.

## What this repository holds

No data and no credentials. Every note, quote, thought and essay lives in
[alexandria](https://github.com/syedi-code/alexandria.socialeating.studio), and
every request for one goes through the Pages Function in
`functions/api/[[catchall]].ts`. A clone of this repository shows nothing until
it is pointed at an alexandria instance.

Two things are worth auditing:

**The proxy forwards identity, and verifies nothing.** It lifts the Access JWT
out of the `CF_Authorization` cookie into a `cf-access-jwt-assertion` header and
forwards to the worker named in `WORKER_URL`. It does not check the token, and
it should not: alexandria verifies the signature against Cloudflare Access's
JWKS and its own application's audience, so a forged assertion fails there. What
matters is that `WORKER_URL` cannot be changed to point somewhere else — it is
declared in `wrangler.toml`, which a `wrangler pages deploy` treats as the
source of truth, precisely so a dashboard edit cannot survive a deploy.

**Drafts are kept in `localStorage`.** `useDraft.ts` persists an unsent note in
the browser so a reload does not lose it, and `LibraryPage` remembers a sort
order the same way. On a shared machine, a draft outlives the Access session
that wrote it. Nothing clears it on sign-out, because there is no sign-out here:
the session is Cloudflare's.

## Known limits

- **The session is the Access cookie.** There is no account system, no
  registration and no logout beyond Cloudflare's. Anyone past Access is the
  reader.
- **Essay embeds are rendered from stored prose.** `[[book:UUID]]` tokens are
  parsed by `src/lib/essayTokenGrammar.ts` and resolved against the catalogue.
  The grammar is deliberately narrow; a change that lets a token carry arbitrary
  markup would turn stored text into an injection surface.
- **A signed file URL is handed to the browser** for covers and PDFs. It grants
  one object key for one hour; see alexandria's `SECURITY.md`.
- **No CSP.** Everything served is same-origin and built from this repository,
  so there is no third-party script to pin — but a policy would still narrow
  what an injected string could do.
