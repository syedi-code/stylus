// Parsing + deterministic coloring for book author attributions.
//
// Authors arrive as free-text strings. Most are "First Last", but the
// dataset includes:
//   - Multiple authors joined by " & " or "; "
//   - Suffixes: "Martin Luther King Jr."
//   - Initials: "G. W. Leibniz"
//   - Mononyms: "Plato"
//   - Single-letter surnames: "Malcolm X"
//   - Diacritics / apostrophes: "Aimé Césaire", "Ibn 'Arabī"
//
// We split into one or more authors and slice each into firstParts +
// lastName + suffix. Only the lastName gets the deterministic palette
// color; firstParts and suffix render in the surface's default text color.
// The palette is a blue · gold · ember triad tuned to read on the essay's
// near-black ground (`--color-mono-950`).

const SUFFIXES = new Set(['jr', 'jr.', 'sr', 'sr.', 'ii', 'iii', 'iv', 'phd', 'md']);

// The blue · gold · ember palette itself lives in style.css as `--author-c0`
// … `--author-c9` — a single source of truth shared with the `.author-cN`
// classes that formatMarkdown emits for `::Name::` mentions. Here we only need
// how many slots there are and how to name one, so a surface can retint the
// whole palette by redefining those variables in its own scope.
const PALETTE_SIZE = 10;

export interface ParsedAuthor {
    /** Full original token, e.g. "Martin Luther King Jr." */
    full: string;
    /** Tokens before the surname, joined with trailing space. e.g. "G. W. ". Empty for mononyms. */
    firstParts: string;
    /** Display surname, e.g. "King". For mononyms, the entire name. */
    lastName: string;
    /** Suffix tokens after the surname, with leading space. e.g. " Jr.". Empty when none. */
    suffix: string;
    /** Deterministic palette color for the surname. */
    color: string;
}

/** Split a multi-author string. "; " takes priority over " & ". */
export function splitAuthors(raw: string): string[] {
    if (!raw) return [];
    const parts = raw.includes(';')
        ? raw.split(/\s*;\s*/)
        : raw.split(/\s+&\s+/);
    return parts.map((p) => p.trim()).filter(Boolean);
}

interface NameSlice {
    firstParts: string;
    lastName: string;
    suffix: string;
}

/** Slice a single author into firstParts / lastName / suffix. */
export function sliceName(author: string): NameSlice {
    const trimmed = author.trim();
    if (!trimmed) return { firstParts: '', lastName: '', suffix: '' };

    const tokens = trimmed.split(/\s+/);
    if (tokens.length === 1) {
        return { firstParts: '', lastName: tokens[0], suffix: '' };
    }

    // Walk back over trailing suffix tokens.
    let lastIdx = tokens.length - 1;
    while (lastIdx > 0 && SUFFIXES.has(tokens[lastIdx].toLowerCase().replace(/[.,]$/, ''))) {
        lastIdx--;
    }

    const firstParts = lastIdx === 0 ? '' : tokens.slice(0, lastIdx).join(' ') + ' ';
    const lastName = tokens[lastIdx];
    const suffix =
        lastIdx === tokens.length - 1 ? '' : ' ' + tokens.slice(lastIdx + 1).join(' ');

    return { firstParts, lastName, suffix };
}

// FNV-1a 32-bit — small, fast, deterministic, no deps.
function hashFnv1a(str: string): number {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
}

// Apostrophes reach us in three forms: a straight ' typed on a desktop, a
// curly ’ that iOS substitutes automatically, and the modifier letter ʼ used in
// transliterations ("Ibn ʼArabī"). They must all hash alike or the same person
// draws a different color depending on where the name was typed. Prose names
// make this unavoidable rather than merely likely — `smartPunctuation` curls
// every apostrophe before the formatter ever sees the name.
const APOSTROPHES = /[‘’ʼ]/g;

/**
 * Palette slot for a surname, or -1 when there is no name to hash. Callers
 * wanting a CSS color use `colorForName`; the text formatter emits the index
 * as an `.author-cN` class so the palette can stay in the stylesheet.
 */
export function paletteIndexForName(name: string): number {
    const key = name.trim().toLowerCase().replace(APOSTROPHES, "'");
    if (!key) return -1;
    return hashFnv1a(key) % PALETTE_SIZE;
}

/** Hash a surname to a curated palette entry. */
export function colorForName(name: string): string {
    const slot = paletteIndexForName(name);
    return slot < 0 ? 'var(--color-mono-200)' : `var(--author-c${slot})`;
}

export function parseAuthors(raw: string | null | undefined): ParsedAuthor[] {
    if (!raw) return [];
    return splitAuthors(raw).map((full) => {
        const { firstParts, lastName, suffix } = sliceName(full);
        return { full, firstParts, lastName, suffix, color: colorForName(lastName) };
    });
}
