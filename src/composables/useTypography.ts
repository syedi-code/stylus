import { computed, type Ref, type ComputedRef } from 'vue';

export type EntityType = 'note' | 'quote' | 'thought';
export type ViewContext = 'card' | 'presentation';

/**
 * Content-length-aware font sizing and typographic class selection.
 *
 * Quotes get `.typography-quote` (with hanging-punctuation); Notes and
 * Thoughts share `.typography-prose`. All content prose uses the shared
 * `--content-leading` (1.08) line-height, applied at the call site.
 *
 * Font-size tiers are tuned per entity × view context:
 *   - Card:         Quotes scale 12–18 px; Notes/Thoughts stay fixed 14 px
 *   - Presentation: All scale, largest sizes for immersive reading
 */
export function useTypography(
	entityType: EntityType,
	viewContext: ViewContext,
	contentLength: Ref<number> | ComputedRef<number>
) {
	const baseFontSize = computed(() =>
		getFontSize(entityType, viewContext, contentLength.value)
	);

	const typographyClass =
		entityType === 'quote' ? 'typography-quote' : 'typography-prose';

	return {
		/** Recommended font-size in px (feed into usePresentationFontSize for user offset) */
		baseFontSize,
		/** Global CSS class for typographic refinements */
		typographyClass,
	};
}

// ---------------------------------------------------------------------------
// Font-size tier tables
// ---------------------------------------------------------------------------

function getFontSize(
	entity: EntityType,
	view: ViewContext,
	len: number
): number {
	if (entity === 'quote') return getQuoteFontSize(view, len);
	return getProseSize(view, len);
}

/** Quotes — the "typeset prose" entity; widest size range. */
function getQuoteFontSize(view: ViewContext, len: number): number {
	switch (view) {
		case 'card':
			if (len < 100) return 18;
			if (len < 250) return 16;
			if (len < 500) return 15;
			if (len < 800) return 14;
			if (len < 1200) return 13;
			return 12;

		case 'presentation':
			if (len < 80) return 22;
			if (len < 200) return 20;
			if (len < 400) return 18;
			if (len < 700) return 16;
			if (len < 1200) return 14;
			return 12;
	}
}

/** Notes & Thoughts — utilitarian prose; conservative sizes in cards. */
function getProseSize(view: ViewContext, len: number): number {
	switch (view) {
		case 'card':
			// Fixed size — stays compact in the grid
			return 14;

		case 'presentation':
			if (len < 200) return 15;
			if (len < 500) return 14;
			if (len < 1000) return 13;
			return 12;
	}
}
