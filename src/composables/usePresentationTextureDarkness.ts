import { ref, type Ref } from 'vue';

/**
 * Presentation texture darkness — the strength of the flat black wash layered
 * over a quote's texture (the `--tex-darkness` CSS var consumed by
 * `.is-textured::after` / `.qsb-fullbleed::after` in style.css). Exposed as a
 * slider next to the surface toggle so the viewer can dial the texture from
 * near-full brightness up to almost black for legibility / mood.
 *
 * A single shared preference across every presentation context (quote modal +
 * essay deck), persisted to localStorage. The 0.6 default matches the static
 * fallback still declared on the surfaces in style.css, so an unset preference
 * looks identical to the shipped default.
 */
export const DARKNESS_MIN = 0;
export const DARKNESS_MAX = 0.9;
export const DARKNESS_STEP = 0.05;
export const DARKNESS_DEFAULT = 0.6;

const KEY = 'presentation-tex-darkness';
let instance: Ref<number> | null = null;

function load(): number {
	try {
		const raw = localStorage.getItem(KEY);
		if (raw !== null) {
			const n = Number(raw);
			if (Number.isFinite(n)) return Math.min(DARKNESS_MAX, Math.max(DARKNESS_MIN, n));
		}
	} catch {
		// localStorage unavailable
	}
	return DARKNESS_DEFAULT;
}

function save(v: number): void {
	try {
		localStorage.setItem(KEY, String(v));
	} catch {
		// localStorage unavailable
	}
}

export function usePresentationTextureDarkness() {
	if (!instance) instance = ref(load());
	const darkness = instance;

	function setDarkness(v: number): void {
		darkness.value = Math.min(DARKNESS_MAX, Math.max(DARKNESS_MIN, v));
		save(darkness.value);
	}

	function reset(): void {
		setDarkness(DARKNESS_DEFAULT);
	}

	return {
		/** current darkness wash strength (0 = brightest texture, 0.9 = near black) */
		darkness,
		setDarkness,
		reset,
	};
}
