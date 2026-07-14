import { ref, watch, type Ref } from 'vue';

/**
 * Robustly resolve a texture image URL for display.
 *
 * The visible <img> is only ever handed a source that has already been fully
 * decoded (via HTMLImageElement.decode()), so it paints the instant it lands in
 * the DOM. This sidesteps the iOS Safari failure where a large, absolutely-
 * positioned <img> revealed by a CSS opacity transition fetches and fires
 * `load` but never actually repaints — the "full-bleed texture never replaces
 * the black background on mobile" bug. Decoding up front also removes the
 * desktop black flash, because a half-loaded image is never shown.
 *
 * `fallback` (the smaller card-tier texture, usually already cached from the
 * card surface) is used two ways:
 *   1. shown immediately on first load so there is no black gap while the large
 *      primary decodes, then upgraded in place once the primary is ready; and
 *   2. settled on as the final image if the primary decode REJECTS — iOS
 *      refuses to decode images past a per-image memory ceiling, and the
 *      2560×1440 full-bleed tier can trip it where the 1280×800 tier succeeds.
 *
 * The previously-resolved src is held while a new one decodes, so switching
 * surface mode / quote swaps textures without flashing through black.
 */
export function useTextureImage(
	primary: Ref<string | undefined>,
	fallback?: Ref<string | undefined>,
) {
	const src = ref('');
	// Guards against a stale async decode winning over a newer request.
	let token = 0;

	function decode(url: string): Promise<void> {
		const img = new Image();
		img.decoding = 'async';
		img.src = url;
		return img.decode();
	}

	watch(
		primary,
		async (url) => {
			const mine = ++token;
			if (!url) return; // keep the last src; the plain branch renders no img

			// Instant placeholder: the small card tier is usually already cached,
			// so it decodes almost immediately and fills the black gap while the
			// full-resolution primary is still decoding.
			const fb = fallback?.value;
			if (fb && fb !== url && src.value === '') {
				try {
					await decode(fb);
					if (mine === token && src.value === '') src.value = fb;
				} catch {
					/* fall through to the primary */
				}
			}

			// Upgrade to (or first set) the full-resolution primary once decoded.
			try {
				await decode(url);
				if (mine === token) src.value = url;
			} catch {
				// Primary won't decode on this device (iOS memory ceiling) — settle
				// on the smaller fallback tier so *something* renders.
				if (mine === token && fb && src.value === '') {
					try {
						await decode(fb);
						if (mine === token) src.value = fb;
					} catch {
						/* nothing renders; the surface's dark base shows through */
					}
				}
			}
		},
		{ immediate: true },
	);

	return { src };
}
