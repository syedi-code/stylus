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
 * The texture (textured + fullbleed) is chosen pseudo-randomly per slide index
 * via variantForIndex — stable so a slide doesn't flicker on re-render, but
 * varied across the deck. reshuffle() re-randomizes the whole mapping (called
 * when entering a texture mode or re-opening the deck). variantForSeed offers
 * the same stable pick keyed by an arbitrary id string instead of a slide
 * index, for non-deck contexts (writing-view foils, Quotes-tab list cards).
 * The caller builds the asset URL from the variant + mode (tex-* for the
 * card, fb-* for full-bleed).
 */
export type QuoteMode = 'textured' | 'fullbleed' | 'plain';

const BASE_KEY = 'presentation-quote-mode';
const ORDER: QuoteMode[] = ['textured', 'fullbleed', 'plain'];
const VARIANTS = ['02', '03', '06'] as const;

interface Shared {
	mode: Ref<QuoteMode>;
	shuffleSeed: Ref<number>;
}
const instances = new Map<string, Shared>();

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

/** Stable pseudo-random texture variant ('02' | '03' | '06') for an id. */
export function variantForSeed(seed: string): string {
	return VARIANTS[hashString(seed) % VARIANTS.length];
}

export function usePresentationQuoteMode(entity: string = 'quote') {
	const storageKey = `${BASE_KEY}-${entity}`;

	if (!instances.has(storageKey)) {
		instances.set(storageKey, {
			mode: ref(load(storageKey)),
			shuffleSeed: ref(1),
		});
	}
	const { mode, shuffleSeed } = instances.get(storageKey)!;

	function reshuffle() {
		shuffleSeed.value = (shuffleSeed.value * 1103515245 + 12345) >>> 0 || 1;
	}

	/** Stable pseudo-random texture variant ('02' | '03' | '06') for a slide. */
	function variantForIndex(i: number): string {
		const h =
			(Math.imul(i + 1, 2654435761) ^
				Math.imul(shuffleSeed.value, 40503)) >>>
			0;
		return VARIANTS[h % VARIANTS.length];
	}

	function cycle() {
		const next = ORDER[(ORDER.indexOf(mode.value) + 1) % ORDER.length];
		mode.value = next;
		save(storageKey, next);
		if (next === 'textured' || next === 'fullbleed') reshuffle();
	}

	/** Force back to the default rounded card and re-randomize the texture. */
	function reset() {
		mode.value = 'textured';
		save(storageKey, 'textured');
		reshuffle();
	}

	return {
		/** current surface mode */
		mode,
		/** advance textured → fullbleed → plain → textured */
		cycle,
		/** re-randomize the per-slide texture mapping */
		reshuffle,
		/** reset to the default 'textured' card */
		reset,
		/** stable texture variant key for a slide index */
		variantForIndex,
	};
}
