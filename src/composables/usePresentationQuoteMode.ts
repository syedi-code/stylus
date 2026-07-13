import { ref, type Ref } from 'vue';

/**
 * Presentation quote surface mode, cycled by one control:
 *   foil      → gold "highlighter" card (the default / "light")
 *   textured  → noir gilt-bordered card over a baked film-grain texture ("dark")
 *   fullbleed → the texture fills the whole slide, quote + credit float on it
 *
 * Persisted per-entity to localStorage (mirrors usePresentationJustify).
 *
 * The texture (textured + fullbleed) is chosen pseudo-randomly per slide index
 * via variantForIndex — stable so a slide doesn't flicker on re-render, but
 * varied across the deck. reshuffle() re-randomizes the whole mapping (called
 * when entering a texture mode or re-opening the deck). The caller builds the
 * asset URL from the variant + mode (tex-* for the card, fb-* for full-bleed).
 */
export type QuoteMode = 'foil' | 'textured' | 'fullbleed';

const BASE_KEY = 'presentation-quote-mode';
const ORDER: QuoteMode[] = ['foil', 'textured', 'fullbleed'];
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
	return 'foil';
}

function save(key: string, m: QuoteMode): void {
	try {
		localStorage.setItem(key, m);
	} catch {
		// localStorage unavailable
	}
}

export function usePresentationQuoteMode(entity: string = 'quote') {
	const storageKey = `${BASE_KEY}-${entity}`;

	if (!instances.has(storageKey)) {
		instances.set(storageKey, { mode: ref(load(storageKey)), shuffleSeed: ref(1) });
	}
	const { mode, shuffleSeed } = instances.get(storageKey)!;

	function reshuffle() {
		shuffleSeed.value = ((shuffleSeed.value * 1103515245 + 12345) >>> 0) || 1;
	}

	/** Stable pseudo-random texture variant ('02' | '03' | '06') for a slide. */
	function variantForIndex(i: number): string {
		const h = (Math.imul(i + 1, 2654435761) ^ Math.imul(shuffleSeed.value, 40503)) >>> 0;
		return VARIANTS[h % VARIANTS.length];
	}

	function cycle() {
		const next = ORDER[(ORDER.indexOf(mode.value) + 1) % ORDER.length];
		mode.value = next;
		save(storageKey, next);
		if (next !== 'foil') reshuffle();
	}

	return {
		/** current surface mode */
		mode,
		/** advance foil → textured → fullbleed → foil */
		cycle,
		/** re-randomize the per-slide texture mapping */
		reshuffle,
		/** stable texture variant key for a slide index */
		variantForIndex,
	};
}
