import { computed, type Ref, type ComputedRef } from 'vue';

export type EntityType = 'note' | 'quote' | 'thought';
export type ViewContext = 'card' | 'thread' | 'presentation';

/**
 * Content-length-aware font sizing and typographic class selection.
 *
 * Quotes get `.typography-quote` (with hanging-punctuation) and tighter
 * leading; Notes and Thoughts share `.typography-prose` and the same tight
 * leading (`leading-[1.45]`) for visual consistency.
 *
 * Font-size tiers are tuned per entity × view context:
 *   - Card:         Quotes scale 12–18 px; Notes/Thoughts stay fixed 14 px
 *   - Thread:       All scale, ~2 px smaller than presentation
 *   - Presentation: All scale, largest sizes for immersive reading
 */
export function useTypography(
	entityType: EntityType,
	viewContext: ViewContext,
	contentLength: Ref<number> | ComputedRef<number>,
	/** Override font size (e.g. after user offset) for line-height scaling */
	effectiveFontSize?: Ref<number> | ComputedRef<number>
) {
	const baseFontSize = computed(() =>
		getFontSize(entityType, viewContext, contentLength.value)
	);

	const lineHeightClass = 'leading-[1.40]';

	/**
	 * Computed line-height that tightens as font size grows.
	 * At 12 px → 1.50, at 24 px → 1.30. Falls back to 1.45 when
	 * no effective font size is provided.
	 */
	const lineHeight = computed(() => {
		const size = effectiveFontSize?.value ?? baseFontSize.value;
		// Linear interpolation: 12px → 1.50, 24px → 1.30
		const t = Math.min(1, Math.max(0, (size - 12) / 12));
		return +(1.5 - t * 0.2).toFixed(2);
	});

	const typographyClass =
		entityType === 'quote' ? 'typography-quote' : 'typography-prose';

	return {
		/** Recommended font-size in px (feed into usePresentationFontSize for user offset) */
		baseFontSize,
		/** Tailwind line-height utility class (static fallback) */
		lineHeightClass,
		/** Computed line-height value that scales with font size */
		lineHeight,
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

		case 'thread':
			if (len < 80) return 19;
			if (len < 200) return 17;
			if (len < 400) return 15;
			if (len < 700) return 13;
			if (len < 1200) return 12;
			return 11;

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

		case 'thread':
			if (len < 200) return 14;
			if (len < 500) return 13;
			if (len < 1000) return 12;
			return 11;

		case 'presentation':
			if (len < 200) return 16;
			if (len < 500) return 15;
			if (len < 1000) return 14;
			return 13;
	}
}
