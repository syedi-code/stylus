import { parseEssayToken } from './essayTokens';
import type { Essay } from './api';

/**
 * Derives the display metadata the "gilded index" needs from an essay's raw
 * content. Essays have no title column — a piece's name is its first section
 * header (the book-title convention), falling back to the opening words of
 * prose (rendered italic / "untitled"). Word and source counts, a short
 * preview, and a relative date round out the row + Continue-hero.
 */

const HEADER_RE = /^#\s+(.+)$/;
const TOKEN_RE = /\[\[[^\]]+\]\]/g;

function paragraphs(content: string): string[] {
    return content
        .split(/\n{2,}/)
        .map((p) => p.trim())
        .filter((p) => p.length > 0);
}

/** Strip inline markdown delimiters (**bold**, *italic*, <u>, {highlight},
 *  ::Name::) and header hashes so a paragraph reads as plain text. The doubled
 *  colon is removed as a pair so ordinary prose colons survive. */
function stripInline(text: string): string {
    return text
        .replace(/^#+\s*/, '')
        .replace(/\*\*/g, '')
        .replace(/::/g, '')
        .replace(/[*_`]/g, '')
        .replace(/[<>{}]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

export interface EssayName {
    name: string;
    /** True when the name is a prose fallback rather than a real section title. */
    untitled: boolean;
}

export function essayName(content: string): EssayName {
    const paras = paragraphs(content);

    // Prefer the first section header — the essay's titled structure.
    for (const p of paras) {
        const h = p.match(HEADER_RE);
        if (h) return { name: h[1].trim(), untitled: false };
    }

    // Fall back to the opening words of the first prose paragraph.
    for (const p of paras) {
        if (parseEssayToken(p)) continue;
        const plain = stripInline(p);
        if (plain) {
            const name = plain.length > 42 ? `${plain.slice(0, 42).trimEnd()}…` : plain;
            return { name, untitled: true };
        }
    }

    return { name: 'Untitled', untitled: true };
}

/** First prose paragraph(s) as plain text, for the inline peek. */
export function essayPreview(content: string, maxLen = 220): string {
    const paras = paragraphs(content);
    const prose: string[] = [];
    for (const p of paras) {
        if (parseEssayToken(p)) continue;
        if (HEADER_RE.test(p)) continue;
        prose.push(stripInline(p));
        if (prose.join(' ').length >= maxLen) break;
    }
    const joined = prose.join(' ');
    return joined.length > maxLen ? `${joined.slice(0, maxLen).trimEnd()}…` : joined;
}

export function essayWordCount(content: string): number {
    const plain = content
        .replace(TOKEN_RE, ' ')
        .replace(/^#+\s*/gm, ' ')
        .replace(/[*_`<>{}]/g, ' ')
        .trim();
    if (!plain) return 0;
    return plain.split(/\s+/).filter(Boolean).length;
}

/** Number of woven sources (quotes / books / images referenced). */
export function essaySourceCount(essay: Essay): number {
    return essay.references?.length ?? 0;
}

export function essaySourceLabel(essay: Essay): string {
    const n = essaySourceCount(essay);
    if (n === 0) return 'no sources yet';
    return `${n} source${n === 1 ? '' : 's'}`;
}

/** "3m ago" → "5h ago" → "2d ago" → "Jul 5" for anything older than a week. */
export function relativeDate(iso: string, now = Date.now()): string {
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return '';
    const diff = Math.max(0, now - then);
    const MIN = 60_000;
    const HR = 3_600_000;
    const DAY = 86_400_000;

    if (diff < HR) return `${Math.max(1, Math.floor(diff / MIN))}m ago`;
    if (diff < DAY) return `${Math.floor(diff / HR)}h ago`;
    if (diff < 7 * DAY) return `${Math.floor(diff / DAY)}d ago`;
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
