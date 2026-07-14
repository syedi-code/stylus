import { ref, type Ref } from 'vue';

/**
 * Presentation quote surface mode, cycled by one control:
 *   textured  → noir gilt-bordered card over a baked film-grain texture (the default)
 *   fullbleed → the texture fills the whole slide, quote + credit float on it
 *   plain     → no surface at all — quote text directly on the dark ground
 *
 * Persisted per-entity to localStorage (mirrors usePresentationJustify). A
 * stale `'foil'` value from before this mode was retired is silently rejected
 * by the `ORDER.includes()` guard in `load()` and falls back to the default.
 *
 * The texture variant is a pure function of the quote's id (variantForSeed):
 * every surface — Quotes-tab card, essay-writing foil, presentation modal, and
 * essay deck — derives the same stable variant for a given quote. So a quote
 * looks identical everywhere, and toggling the surface mode never swaps (nor
 * re-fetches) the texture; it only changes how that one texture is framed.
 * Build the asset URL with textureAsset(variant, kind) — 'card' → tex-*, and
 * 'fullbleed' → fb-* — served as WebP from /public/textures.
 */
export type QuoteMode = 'textured' | 'fullbleed' | 'plain';

const BASE_KEY = 'presentation-quote-mode';
const ORDER: QuoteMode[] = ['textured', 'fullbleed', 'plain'];

/**
 * The shipped texture slugs (dark, monochrome fluid vortex/hurricane fields).
 * Files live at /public/textures/{tex,fb}-<slug>.webp — the `tex-` card tier
 * (~1280px) and the `fb-` full-bleed tier (~2560px).
 */
const VARIANTS = [
	'vortex-01', 'vortex-02', 'hurricane', 'maelstrom', 'turbulence',
	'smoke', 'whirl-tight', 'nebula', 'cyclones',
] as const;

/** Build the texture asset URL for a variant + surface kind. */
export function textureAsset(variant: string, kind: 'card' | 'fullbleed'): string {
	return `/textures/${kind === 'fullbleed' ? 'fb' : 'tex'}-${variant}.webp`;
}

const instances = new Map<string, Ref<QuoteMode>>();

function load(key: string): QuoteMode {
	try {
		const raw = localStorage.getItem(key);
		if (raw && (ORDER as string[]).includes(raw)) return raw as QuoteMode;
	} catch {
		// localStorage unavailable
	}
	return 'textured';
}

function save(key: string, m: QuoteMode): void {
	try {
		localStorage.setItem(key, m);
	} catch {
		// localStorage unavailable
	}
}

function hashString(s: string): number {
	let h = 0;
	for (let i = 0; i < s.length; i++) {
		h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
	}
	return h >>> 0;
}

/** Stable pseudo-random texture variant (a VARIANTS slug) for an id. */
export function variantForSeed(seed: string): string {
	return VARIANTS[hashString(seed) % VARIANTS.length];
}

/**
 * Stable, bold per-seed CSS object-position ("x% y%") for the full-bleed
 * texture, so each quote frames a different region of its (16:9, 2560×1440)
 * texture instead of always the center. The seed is salted per axis so the
 * crop is decorrelated from the variant choice (variantForSeed), and full-pan
 * (0–100%) for maximum variety.
 */
export function objectPositionForSeed(seed: string): string {
	// Salt BEFORE the seed: hashString accumulates left-to-right, so a prefix
	// difference is amplified by every following char, decorrelating the two
	// axes. Salting after (a suffix) leaves x/y differing by ~1 — the crop would
	// only ever pan along the diagonal.
	const x = hashString('x:' + seed) % 101; // 0–100 inclusive
	const y = hashString('y:' + seed) % 101;
	return `${x}% ${y}%`;
}

export function usePresentationQuoteMode(entity: string = 'quote') {
	const storageKey = `${BASE_KEY}-${entity}`;

	if (!instances.has(storageKey)) {
		instances.set(storageKey, ref(load(storageKey)));
	}
	const mode = instances.get(storageKey)!;

	function cycle() {
		const next = ORDER[(ORDER.indexOf(mode.value) + 1) % ORDER.length];
		mode.value = next;
		save(storageKey, next);
	}

	/** Force back to the default rounded card. */
	function reset() {
		mode.value = 'textured';
		save(storageKey, 'textured');
	}

	return {
		/** current surface mode */
		mode,
		/** advance textured → fullbleed → plain → textured */
		cycle,
		/** reset to the default 'textured' card */
		reset,
	};
}
