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
// The palette is a soft pastel range (yellow → orange → pink → purple →
// red) tuned to read warmly on `--color-mono-950`.

const SUFFIXES = new Set(['jr', 'jr.', 'sr', 'sr.', 'ii', 'iii', 'iv', 'phd', 'md']);

// Soft pastels across the warm half of the wheel + magenta/violet — no
// greens, blues, or cyans. S/L tuned high-light/medium-saturation so they
// feel quiet on `#050505` rather than candy-bright.
const PALETTE = [
    'hsl(0 70% 82%)',     // blush
    'hsl(12 78% 80%)',    // soft coral
    'hsl(24 80% 78%)',    // peach
    'hsl(34 78% 76%)',    // apricot
    'hsl(44 72% 76%)',    // butter
    'hsl(54 60% 78%)',    // pale yellow
    'hsl(290 48% 82%)',   // soft lavender
    'hsl(305 55% 82%)',   // light orchid
    'hsl(320 60% 82%)',   // pink
    'hsl(335 70% 82%)',   // bubblegum
    'hsl(348 75% 82%)',   // rose
    'hsl(358 70% 80%)',   // dusty red
];

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

/** Hash a surname to a curated palette entry. */
export function colorForName(name: string): string {
    const key = name.trim().toLowerCase();
    if (!key) return 'var(--color-mono-200)';
    return PALETTE[hashFnv1a(key) % PALETTE.length];
}

export function parseAuthors(raw: string | null | undefined): ParsedAuthor[] {
    if (!raw) return [];
    return splitAuthors(raw).map((full) => {
        const { firstParts, lastName, suffix } = sliceName(full);
        return { full, firstParts, lastName, suffix, color: colorForName(lastName) };
    });
}
