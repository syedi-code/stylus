# Fonts

stylus is set in two commercially licensed families:

| Family           | Foundry           | Where                    |
| ---------------- | ----------------- | ------------------------ |
| **Tiempos Text** | Klim Type Foundry | `--font-body`, the prose |
| **Söhne Mono**   | Klim Type Foundry | `--font-mono`, numerals  |

**They are not covered by this repository's licence.** The ISC grant in
`LICENSE` covers the code. These faces are licensed to this project and to
nobody else, so they are not part of what this repository offers. If you fork
it, use your own.

The files are kept out of the working tree — `.gitignore` carries
`public/fonts/` — and production gets them from R2 at deploy time. Keep it that
way.

## Where production's copy lives

In alexandria's bucket, under a prefix of its own:

```text
antisocial-media-files/stylus-fonts/<path under public/fonts/>
```

The `Fetch licensed fonts` step in `.github/actions/deploy-pages/action.yml`
copies every face `src/style.css` names from there into `public/fonts/` before
the build, for both environments. It reads the list from the stylesheet, so
adding a face to `style.css` without uploading it fails the next deploy —
deliberately, because the alternative is production quietly set in Georgia.

The bucket is private, and nothing serves this prefix to the public: the only
route into it is alexandria's signed `/files/*`, and stylus never signs one of
these keys. The faces reach readers from stylus's own Pages deployment.

To get them locally, or to add or replace one:

```bash
# download every face the stylesheet names
grep -oE "url\('/fonts/[^']+'\)" src/style.css | sed "s|url('/fonts/||; s|')||" | sort -u |
  while IFS= read -r face; do
    mkdir -p "public/fonts/$(dirname "$face")"
    npx wrangler r2 object get "antisocial-media-files/stylus-fonts/$face" --remote --file "public/fonts/$face"
  done

# upload one
npx wrangler r2 object put "antisocial-media-files/stylus-fonts/<path>"   --remote --file "public/fonts/<path>" --content-type font/otf
```

## Running it without them

Leave `public/fonts/` empty and delete the `@font-face` blocks near the top of
`src/style.css`. `--font-body` falls through to Georgia and the generic serif
stack; `--font-mono` to the system monospace. The app works. It is a different
object: Tiempos is narrower than Georgia, so headings and note bodies run longer
than they were drawn to.

## What is no longer here

A `@font-face` for Lyon Text pointed at a file that has not been in this
repository for a long time. It resolved to a 404 on every build and no rule ever
named the family, so it has been deleted — it also named a foundry this project
does not in fact depend on.
