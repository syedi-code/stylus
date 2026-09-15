/**
 * The essay token grammar.
 *
 * Copied verbatim from alexandria's packages/core/writing/essay-tokens.ts,
 * where the server-side half still lives. It is duplicated rather than
 * fetched because it runs on every keystroke for live preview — a network
 * call per character is not an option.
 *
 * What it validates against is NOT duplicated. The param vocabulary arrives
 * from the server in the /session payload (see contract.ts), which is why
 * every function here takes the spec table as an argument. The table below is
 * only the fallback for the frames before that response lands. Adding a param
 * is a server change; this file does not need to follow.
 *
 * Keep it in step with alexandria if the grammar itself changes — the regex,
 * the quoting rules, the clamping. It has not changed since 2026-05-12, and
 * nothing planned goes near it.
 */

export type EmbedKind = 'quote' | 'book' | 'image';

export type ParamValue = number | string;

export interface ParamSpec {
	key: string;
	type: 'int' | 'enum' | 'string';
	/** Allowed values for `enum`. */
	enumValues?: readonly string[];
	/** Inclusive bounds for `int` — out-of-range values are clamped. */
	min?: number;
	max?: number;
	/** Used by the editor's chip strip as the seed value when inserting. */
	default?: ParamValue;
	/** Short, user-facing description surfaced by the param bar tooltip. */
	description: string;
}

/**
 * Param vocabulary, keyed by embed kind. Adding a new param means adding one
 * entry here — the parser, validator, editor chip strip, and renderer all
 * read this table. No other code path needs to change.
 */
export type EmbedParamSpecs = Record<EmbedKind, readonly ParamSpec[]>;

export const EMBED_PARAM_SPECS: EmbedParamSpecs = {
	quote: [
		{
			key: 'size',
			type: 'int',
			min: 12,
			max: 48,
			default: 24,
			description: 'Font size in pixels (12–48)',
		},
	],
	book: [
		{
			key: 'author',
			type: 'enum',
			enumValues: ['show', 'hide'] as const,
			default: 'hide',
			description: 'Show author above title (defaults to hidden)',
		},
		{
			key: 'size',
			type: 'int',
			min: 12,
			max: 64,
			default: 26,
			description: 'Title font size in pixels (12–64)',
		},
	],
	image: [
		{
			key: 'bg',
			type: 'enum',
			enumValues: ['dark', 'light', 'none'] as const,
			default: 'dark',
			description: 'Slide background (dark · light · none)',
		},
		{
			key: 'caption',
			type: 'string',
			default: '',
			description: 'Per-embed caption (overrides the image record)',
		},
	],
};

export type EmbedParams = Record<string, ParamValue>;

export interface ParsedToken {
	kind: EmbedKind;
	id: string;
	params: EmbedParams;
	/** Original attr-tail (everything after the UUID, without surrounding `[[…]]`). */
	raw: { tail: string };
}

/**
 * Token regex — captures kind, UUID, and an optional attr-tail.
 *
 * The tail is anything between the UUID and the closing `]]`, lazily matched
 * so we don't gobble across paragraphs. `parseAttrTail` does the heavy
 * lifting on the captured tail.
 */
const TOKEN_RE =
	/^\[\[(quote|book|image):([0-9a-fA-F-]{36})(?:\s+([^\]]*?))?\]\]$/;

/**
 * Parse a single paragraph as a token. Returns null if the paragraph isn't an
 * embed token. The returned `params` object contains only validated entries —
 * unknown keys and bad values are dropped.
 */
export function parseEssayToken(
	paragraph: string,
	specs: EmbedParamSpecs = EMBED_PARAM_SPECS
): ParsedToken | null {
	const trimmed = paragraph.trim();
	const m = trimmed.match(TOKEN_RE);
	if (!m) return null;
	const kind = m[1] as EmbedKind;
	const id = m[2];
	const tail = (m[3] ?? '').trim();
	const rawAttrs = tail ? parseAttrTail(tail) : {};
	const params = validateParams(kind, rawAttrs, specs);
	return { kind, id, params, raw: { tail } };
}

/**
 * Tokenize a `key=value key="quoted value"` tail into a flat map of raw
 * strings. Validation against the per-kind spec happens in `validateParams`.
 *
 * The grammar is intentionally tiny:
 *   - keys: [a-zA-Z][a-zA-Z0-9_-]*
 *   - bare values: anything up to whitespace
 *   - quoted values: "…" with `\"` as the only escape
 */
export function parseAttrTail(tail: string): Record<string, string> {
	const out: Record<string, string> = {};
	let i = 0;
	const n = tail.length;
	while (i < n) {
		// Skip whitespace
		while (i < n && /\s/.test(tail[i])) i++;
		if (i >= n) break;

		// Match key
		const keyStart = i;
		while (i < n && /[a-zA-Z0-9_-]/.test(tail[i])) i++;
		const key = tail.slice(keyStart, i);
		if (!key || tail[i] !== '=') {
			// Malformed pair — skip to next whitespace and continue
			while (i < n && !/\s/.test(tail[i])) i++;
			continue;
		}
		i++; // consume '='

		// Match value
		let value = '';
		if (tail[i] === '"') {
			i++; // consume opening quote
			let buf = '';
			while (i < n && tail[i] !== '"') {
				if (tail[i] === '\\' && tail[i + 1] === '"') {
					buf += '"';
					i += 2;
				} else {
					buf += tail[i];
					i++;
				}
			}
			if (i < n) i++; // consume closing quote
			value = buf;
		} else {
			const valStart = i;
			while (i < n && !/\s/.test(tail[i])) i++;
			value = tail.slice(valStart, i);
		}
		out[key] = value;
	}
	return out;
}

/**
 * Apply the per-kind param spec to a raw string map. Unknown keys are
 * dropped. Ints are coerced + clamped. Enums must match exactly. Strings
 * pass through. Defaults are NOT filled in — absence means "use the
 * renderer default" so we don't bloat the persisted JSON.
 */
export function validateParams(
	kind: EmbedKind,
	raw: Record<string, string>,
	specs: EmbedParamSpecs = EMBED_PARAM_SPECS
): EmbedParams {
	const out: EmbedParams = {};
	for (const spec of specs[kind] ?? []) {
		const v = raw[spec.key];
		if (v === undefined) continue;
		if (spec.type === 'int') {
			const n = parseInt(v, 10);
			if (isNaN(n)) continue;
			const clamped = Math.min(
				spec.max ?? Number.POSITIVE_INFINITY,
				Math.max(spec.min ?? Number.NEGATIVE_INFINITY, n)
			);
			out[spec.key] = clamped;
		} else if (spec.type === 'enum') {
			if (spec.enumValues?.includes(v)) {
				out[spec.key] = v;
			}
		} else if (spec.type === 'string') {
			out[spec.key] = v;
		}
	}
	return out;
}

/**
 * Round-trip a parsed token back to its canonical markup form. Used by the
 * editor's param bar to mutate params (cycle bg, set caption, etc.) via
 * parse → update → serialize, rather than string surgery in the UI.
 *
 * Canonical form: keys emitted in spec order; strings always double-quoted
 * if they contain whitespace or are empty; ints emitted bare.
 */
export function serializeToken(
	t: ParsedToken,
	specs: EmbedParamSpecs = EMBED_PARAM_SPECS
): string {
	const parts: string[] = [];
	for (const spec of specs[t.kind] ?? []) {
		const v = t.params[spec.key];
		if (v === undefined) continue;
		if (typeof v === 'number') {
			parts.push(`${spec.key}=${v}`);
		} else {
			const needsQuote = v === '' || /\s|"/.test(v);
			parts.push(
				`${spec.key}=${needsQuote ? `"${v.replace(/"/g, '\\"')}"` : v}`
			);
		}
	}
	const tail = parts.length > 0 ? ` ${parts.join(' ')}` : '';
	return `[[${t.kind}:${t.id}${tail}]]`;
}
