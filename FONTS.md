# Fonts

stylus is set in two commercially licensed families:

| Family           | Foundry           | Where                    |
| ---------------- | ----------------- | ------------------------ |
| **Tiempos Text** | Klim Type Foundry | `--font-body`, the prose |
| **Söhne Mono**   | Klim Type Foundry | `--font-mono`, numerals  |

**They are not covered by this repository's licence.** The ISC grant in
`LICENSE` covers the code. The files under `public/fonts/` are licensed to this
project and to nobody else: they are here because the site is built from here,
and they are not part of what this repository offers. If you fork it, delete
them and use your own.

## Running it without them

Delete `public/fonts/` and the `@font-face` blocks near the top of
`src/style.css`. `--font-body` falls through to Georgia and the generic serif
stack; `--font-mono` to the system monospace. The app works. It is a different
object: Tiempos is narrower than Georgia, so headings and note bodies run longer
than they were drawn to.

## What is no longer here

A `@font-face` for Lyon Text pointed at a file that has not been in this
repository for a long time. It resolved to a 404 on every build and no rule ever
named the family, so it has been deleted — it also named a foundry this project
does not in fact depend on.
