import type { Essay } from './api';
import { parseBlocks, isEmbedBlock, type EditorBlock } from '../composables/useEssayBlocks';
import { essayName, essayWordCount, relativeDate } from './essayDisplay';

/**
 * Pure logic behind the Essays workspace — the spine, the rhythm of the
 * writing surface, and the two input shortcuts.
 *
 * It lives here rather than inside the components for one reason: every rule
 * below is a decision that can silently regress (a slash command firing inside
 * prose, a paste offer on ordinary text, the rhythm classes landing on the
 * wrong join) and none of it is reachable from a test while it sits in a
 * component body. See essayWorkspace.test.ts.
 */

// ── Slash commands ───────────────────────────────────────────────────────

export type SlashCommand = 'quote' | 'section' | 'book' | 'image';

/**
 * A slash command is only a command at the very start of an otherwise empty
 * line, terminated by a space. Anything looser fires inside prose — dates,
 * fractions, URLs and "and/or" all carry a slash — so the whole value must be
 * the command and nothing else.
 */
const SLASH_RE = /^\/(quote|section|book|image)\s$/;

export function matchSlashCommand(value: string): SlashCommand | null {
	const m = value.match(SLASH_RE);
	return m ? (m[1] as SlashCommand) : null;
}

// ── Paste-to-quote ───────────────────────────────────────────────────────

export interface PastedQuote {
	text: string;
	creator?: string;
	work?: string;
	page?: string;
	/** True when the paste was the block's entire content. */
	whole: boolean;
}

/** Quoted body, optionally followed by an em-dash attribution tail. */
const QUOTED_RE = /^\s*[“"'‘]([\s\S]+?)[”"'’]\s*(?:[—–-]+\s*(.+))?$/;
/** `Author, Work, p. 12` — every part after the author optional. */
const ATTR_RE = /^([^,]+?)(?:,\s*([^,]+?))?(?:,\s*p+\.?\s*([0-9ivxlc]+))?\.?$/i;

/**
 * Recognise a pasted passage that is worth offering to set as a real quote.
 *
 * Deliberately conservative — a false positive interrupts writing with a
 * prompt nobody asked for, which is far worse than missing one. It requires
 * actual quotation marks and a plausible length; the attribution is a bonus,
 * not a condition.
 */
export function parsePastedQuote(raw: string, whole: boolean): PastedQuote | null {
	const text = raw.trim();
	if (text.length < 24 || text.length > 2000) return null;

	const q = text.match(QUOTED_RE);
	if (!q) return null;

	const body = q[1].trim();
	if (!body) return null;

	const out: PastedQuote = { text: body, whole };
	const tail = (q[2] ?? '').trim();
	if (tail) {
		const a = tail.match(ATTR_RE);
		if (a) {
			out.creator = (a[1] ?? '').trim() || undefined;
			out.work = (a[2] ?? '').trim() || undefined;
			out.page = (a[3] ?? '').trim() || undefined;
		}
	}
	return out;
}

// ── The rhythm of the surface ────────────────────────────────────────────

export type JoinKind = 'j-after-text' | 'j-after-embed' | 'j-stacked';

/**
 * How a block joins the one above it.
 *
 * Every block used to carry the same margin, so prose-after-prose,
 * prose-after-a-quote and quote-after-quote read identically — which is most
 * of why the column's spacing felt arbitrary. The corpus says these joins are
 * not alike: paragraphs run ~35 words, and essays routinely set three quotes
 * in a row. Prose wants air at the join; stacked objects want to tuck.
 */
export function joinKind(previous: EditorBlock, current: EditorBlock): JoinKind {
	if (isEmbedBlock(current) && isEmbedBlock(previous)) return 'j-stacked';
	return isEmbedBlock(previous) ? 'j-after-embed' : 'j-after-text';
}

/** The join class for every block, keyed by bid. The first block has none. */
export function joinClassMap(blocks: readonly EditorBlock[]): Map<string, JoinKind> {
	const m = new Map<string, JoinKind>();
	for (let i = 1; i < blocks.length; i++) {
		m.set(blocks[i].bid, joinKind(blocks[i - 1], blocks[i]));
	}
	return m;
}

// ── The spine ────────────────────────────────────────────────────────────

/** How many ticks a piece's mini deck rail shows before it stops counting. */
export const MAX_RAIL_TICKS = 12;

export interface SpineRow {
	essay: Essay;
	name: string;
	untitled: boolean;
	words: number;
	when: string;
	/** One tick per block: true = a source (quote / book / image). */
	ticks: boolean[];
	/** Real block count, which can exceed the ticks shown. */
	blockCount: number;
}

export function spineRow(essay: Essay): SpineRow {
	const content = essay.content ?? '';
	const n = essayName(content);
	const blocks = parseBlocks(content);
	return {
		essay,
		name: n.name,
		untitled: n.untitled,
		words: essayWordCount(content),
		when: relativeDate(essay.updated_at ?? essay.created_at ?? ''),
		ticks: blocks.slice(0, MAX_RAIL_TICKS).map((b) => isEmbedBlock(b)),
		blockCount: blocks.length,
	};
}

/** Filter is a plain case-insensitive substring over the piece's own text. */
export function filterEssays(essays: readonly Essay[], query: string): Essay[] {
	const q = query.trim().toLowerCase();
	if (!q) return [...essays];
	return essays.filter((e) => (e.content ?? '').toLowerCase().includes(q));
}

// ── The outline of the open piece ────────────────────────────────────────

export interface OutlineEntry {
	bid: string;
	n: number;
	kind: EditorBlock['kind'];
	label: string;
}

/** Embeds say what they are; prose shows its opening words. */
export function outlineOf(blocks: readonly EditorBlock[]): OutlineEntry[] {
	return blocks.map((b, i) => ({
		bid: b.bid,
		n: i + 1,
		kind: b.kind,
		label: isEmbedBlock(b)
			? b.kind
			: b.text.replace(/[*_`#<>{}]/g, '').trim() ||
				(b.kind === 'header' ? 'Untitled section' : 'Empty'),
	}));
}
