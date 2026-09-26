/**
 * Where in the markdown a tap on the rendered paragraph landed.
 *
 * A paragraph at rest is rendered HTML — highlights, italics, curly quotes —
 * and turns into a textarea of raw markdown when tapped. The textarea used to
 * open with the caret at the very end, whatever you tapped: to fix a typo in
 * the second line you tapped it, then walked the caret back from the last
 * word. On a phone that walk is a long-press-and-drag.
 *
 * The rendered text is the raw text with markup removed and punctuation
 * smartened, so the two can be walked in step: equal characters advance both,
 * a smartened run (--- → —, ... → …) advances by its raw length, a hair space
 * exists only on the rendered side, and anything else on the raw side is
 * markup the renderer ate.
 */

const QUOTE_EQ: Record<string, string> = {
	'“': '"',
	'”': '"',
	'‘': "'",
	'’': "'",
};

export function rawOffsetFor(raw: string, rendered: string, renderedOffset: number): number {
	let i = 0;
	let j = 0;
	const target = Math.max(0, Math.min(renderedOffset, rendered.length));
	while (j < target && i < raw.length) {
		const r = raw[i];
		const d = rendered[j];
		if (d === ' ') {
			j += 1;
			continue;
		}
		if (r === d || QUOTE_EQ[d] === r) {
			i += 1;
			j += 1;
			continue;
		}
		if (d === '—' && raw.startsWith('---', i)) {
			i += 3;
			j += 1;
			continue;
		}
		if (d === '–' && raw.startsWith('--', i)) {
			i += 2;
			j += 1;
			continue;
		}
		if (d === '…' && raw.startsWith('...', i)) {
			i += 3;
			j += 1;
			continue;
		}
		// Markup on the raw side only.
		i += 1;
	}
	return Math.min(i, raw.length);
}

/**
 * The rendered-text offset under a point, measured within `root`. Uses
 * whichever caret-from-point the engine has; null where it has neither.
 */
export function renderedOffsetAt(root: HTMLElement, x: number, y: number): number | null {
	const doc = root.ownerDocument as Document & {
		caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
		caretRangeFromPoint?: (x: number, y: number) => Range | null;
	};
	let node: Node | null = null;
	let offset = 0;
	if (doc.caretPositionFromPoint) {
		const p = doc.caretPositionFromPoint(x, y);
		if (p) {
			node = p.offsetNode;
			offset = p.offset;
		}
	} else if (doc.caretRangeFromPoint) {
		const r = doc.caretRangeFromPoint(x, y);
		if (r) {
			node = r.startContainer;
			offset = r.startOffset;
		}
	}
	if (!node || !root.contains(node)) return null;

	const range = doc.createRange();
	range.setStart(root, 0);
	try {
		range.setEnd(node, offset);
	} catch {
		return null;
	}
	return range.toString().length;
}
