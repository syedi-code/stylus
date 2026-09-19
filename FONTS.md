# Fonts

stylus is set in two commercially licensed families:

| Family           | Foundry           | Where                    |
| ---------------- | ----------------- | ------------------------ |
| **Tiempos Text** | Klim Type Foundry | `--font-body`, the prose |
| **Söhne Mono**   | Klim Type Foundry | `--font-mono`, numerals  |

**They are not covered by this repository's licence.** The ISC grant in
`LICENSE` covers the code. The files under `public/fonts/` are licensed to this
project and to nobody else: you may read them here, and you may not use them in
anything of your own. If you fork this repository, delete them.

They are `.otf` desktop files served as webfonts, which most foundries price as
a separate tier, and they are in the repository's history as well as its working
tree — a deleted file is still downloadable from an old commit. Removing them
properly would mean rewriting history with `git filter-repo`, force-pushing, and
asking GitHub Support to garbage-collect the `refs/pull/*` refs that survive a
force-push. That has not been done. `docs/HOUSEKEEPING.md` records an earlier
pass that purged the families nothing referenced and explains the remainder.

## Running it without them

Delete `public/fonts/` and the `@font-face` blocks at the top of
`src/style.css`. `--font-body` falls through to Georgia and the generic serif
stack; `--font-mono` to the system monospace. The app works. It is a different
object: Tiempos is narrower than Georgia, so headings and note bodies run longer
than they were drawn to.

## What is no longer here

A `@font-face` for **Lyon Text** (Commercial Type) pointed at a file that has
not been in this repository for a long time. It resolved to a 404 on every build
and the family was never named by any rule, so it has been deleted. It also
misstated which foundries this project depends on, which matters more now that
anyone can read it.
