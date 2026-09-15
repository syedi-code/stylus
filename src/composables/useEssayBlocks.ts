import { ref, type Ref } from 'vue';
import {
	parseEssayToken,
	serializeToken,
	type EmbedKind,
	type EmbedParams,
	type ParamValue,
} from '@antisocial/core';

/**
 * Block model for the essay writing room.
 *
 * The persisted source of truth is, and stays, the single `content` string
 * (markdown + paragraph-isolated `[[quote:UUID]]` tokens). Blocks are a
 * *working view* parsed from that string on open and serialized straight back
 * on every edit — so drafts, versioning (`createEssay({ replaces })`), and the
 * server's token→reference derivation never learn the editor changed shape.
 *
 * The parse / serialize pair below is pure and round-trip-canonical:
 *   serializeBlocks(parseBlocks(s)) is idempotent.
 * That idempotency is the correctness gate — opening an essay and saving it
 * untouched must never mint a spurious version. See useEssayBlocks.roundtrip.ts.
 *
 * Token grammar (regex, params) is owned by `@antisocial/core`; we never
 * re-roll it — parse via `parseEssayToken`, emit via `serializeToken`.
 */

export type TextBlockKind = 'para' | 'header';
export type EmbedBlockKind = EmbedKind; // 'quote' | 'book' | 'image'
export type BlockKind = TextBlockKind | EmbedBlockKind;

export interface TextBlock {
	/** Stable client id — the `:key` for FLIP / drag; prose carries no UUID. */
	bid: string;
	kind: TextBlockKind;
	/** Raw markdown (header text is stored WITHOUT the leading `# `). */
	text: string;
}

export interface EmbedBlock {
	bid: string;
	kind: EmbedBlockKind;
	id: string;
	params: EmbedParams;
}

export type EditorBlock = TextBlock | EmbedBlock;

export function isEmbedBlock(b: EditorBlock): b is EmbedBlock {
	return b.kind === 'quote' || b.kind === 'book' || b.kind === 'image';
}
export function isTextBlock(b: EditorBlock): b is TextBlock {
	return b.kind === 'para' || b.kind === 'header';
}

// Matches essayDisplay.ts HEADER_RE exactly so the editor and the read renderer
// agree on what a section header is (single-line paragraph starting `# `).
const HEADER_RE = /^#\s+(.+)$/;

let bidSeq = 0;
function newBid(): string {
	// Uniqueness within a session is all we need; ids never persist.
	bidSeq += 1;
	return `b${bidSeq}`;
}

// ─── Pure core (no Vue) — testable in isolation ───

/** Parse a content string into blocks. Empty paragraphs are dropped. */
export function parseBlocks(content: string): EditorBlock[] {
	const out: EditorBlock[] = [];
	for (const raw of content.split(/\n{2,}/)) {
		const p = raw.trim();
		if (!p) continue;

		const token = parseEssayToken(p);
		if (token) {
			out.push({ bid: newBid(), kind: token.kind, id: token.id, params: token.params });
			continue;
		}

		const h = p.match(HEADER_RE);
		if (h) {
			out.push({ bid: newBid(), kind: 'header', text: h[1].trim() });
			continue;
		}

		out.push({ bid: newBid(), kind: 'para', text: p });
	}
	return out;
}

/** Serialize a single block to its canonical markup, or `null` to drop it
 *  (empty text blocks). */
export function serializeBlock(b: EditorBlock): string | null {
	if (isEmbedBlock(b)) {
		return serializeToken({ kind: b.kind, id: b.id, params: b.params, raw: { tail: '' } });
	}
	const t = b.text.trim();
	if (!t.length) return null;
	return b.kind === 'header' ? `# ${t}` : t;
}

/** Serialize blocks back to the canonical content string. */
export function serializeBlocks(blocks: readonly EditorBlock[]): string {
	const parts: string[] = [];
	for (const b of blocks) {
		const s = serializeBlock(b);
		if (s !== null) parts.push(s);
	}
	return parts.join('\n\n');
}

/** Normalize a content string through the block round-trip (canonical form). */
export function normalizeContent(content: string): string {
	return serializeBlocks(parseBlocks(content));
}

// ─── Merge result — the component needs to know what a Backspace-at-0 did ───

export type MergeResult =
	/** Text merged up into the previous text block; place caret at `caret`. */
	| { type: 'merged'; bid: string; caret: number }
	/** Previous block is a foil object — select it (arm delete) instead. */
	| { type: 'selectEmbed'; bid: string }
	/** Nothing above to merge into. */
	| { type: 'noop' };

// ─── The composable ───

export function useEssayBlocks(content: Ref<string>) {
	const blocks = ref<EditorBlock[]>([]);
	/** The last content string this composable read-from or wrote-to. Lets the
	 *  editor tell an external content replacement (→ reload) apart from its own
	 *  sync writes (→ no reload, no bid churn). */
	const serialized = ref('');

	/** (Re)load blocks FROM the content string. Call on open / essay change. */
	function load(source?: string) {
		const src = source ?? content.value;
		blocks.value = parseBlocks(src);
		serialized.value = src;
	}

	/** Write content FROM blocks — one-directional; never re-parses back. */
	function sync() {
		const s = serializeBlocks(blocks.value);
		serialized.value = s;
		content.value = s;
	}

	function indexOf(bid: string): number {
		return blocks.value.findIndex((b) => b.bid === bid);
	}

	function updateText(bid: string, text: string) {
		const b = blocks.value[indexOf(bid)];
		if (b && isTextBlock(b)) {
			b.text = text;
			sync();
		}
	}

	function setParam(bid: string, key: string, value: ParamValue) {
		const b = blocks.value[indexOf(bid)];
		if (b && isEmbedBlock(b)) {
			b.params = { ...b.params, [key]: value };
			sync();
		}
	}

	function newTextBlock(kind: TextBlockKind, text = ''): TextBlock {
		return { bid: newBid(), kind, text };
	}
	function newEmbedBlock(kind: EmbedBlockKind, id: string, params: EmbedParams = {}): EmbedBlock {
		return { bid: newBid(), kind, id, params };
	}

	/** Insert `block` after `afterBid` (or at the end when null). Returns bid. */
	function insertAfter(afterBid: string | null, block: EditorBlock): string {
		const i = afterBid === null ? blocks.value.length - 1 : indexOf(afterBid);
		blocks.value.splice(i + 1, 0, block);
		sync();
		return block.bid;
	}

	function remove(bid: string) {
		const i = indexOf(bid);
		if (i === -1) return;
		blocks.value.splice(i, 1);
		sync();
	}

	function move(fromIndex: number, toIndex: number) {
		const n = blocks.value.length;
		if (fromIndex < 0 || fromIndex >= n || toIndex < 0 || toIndex >= n || fromIndex === toIndex) {
			return;
		}
		const [moved] = blocks.value.splice(fromIndex, 1);
		blocks.value.splice(toIndex, 0, moved);
		sync();
	}

	/**
	 * Split a text block at `caret`: text before stays, text after becomes a
	 * new paragraph block below. Returns the new block's bid (caret → its start).
	 */
	function split(bid: string, caret: number): string | null {
		const i = indexOf(bid);
		const b = blocks.value[i];
		if (!b || !isTextBlock(b)) return null;
		const before = b.text.slice(0, caret);
		const after = b.text.slice(caret);
		b.text = before;
		const next = newTextBlock('para', after);
		blocks.value.splice(i + 1, 0, next);
		sync();
		return next.bid;
	}

	/** Backspace-at-0 on a text block: merge up, or select a foil above. */
	function merge(bid: string): MergeResult {
		const i = indexOf(bid);
		const cur = blocks.value[i];
		if (i <= 0 || !cur || !isTextBlock(cur)) return { type: 'noop' };
		const prev = blocks.value[i - 1];
		if (isEmbedBlock(prev)) {
			return { type: 'selectEmbed', bid: prev.bid };
		}
		const caret = prev.text.length;
		prev.text = prev.text + cur.text;
		blocks.value.splice(i, 1);
		sync();
		return { type: 'merged', bid: prev.bid, caret };
	}

	return {
		blocks,
		serialized,
		load,
		sync,
		indexOf,
		updateText,
		setParam,
		insertAfter,
		newTextBlock,
		newEmbedBlock,
		remove,
		move,
		split,
		merge,
	};
}
