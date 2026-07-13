import { computed, type ComputedRef, type Ref } from 'vue';
import { useViewportWidth } from './useViewportWidth';

export interface FontSizeTier {
	/** Use this size when content length is <= maxLength. */
	maxLength: number;
	size: number;
}

export interface ScaleBreak {
	/** Below this viewport width, multiply the tiered size by `factor`. */
	width: number;
	factor: number;
}

export interface DynamicFontSizeOptions {
	/** Tiers applied below `mobileBreakpoint` (sorted ascending by maxLength; last tier is the fallback for anything longer). */
	mobile: FontSizeTier[];
	/** Tiers applied at/above `mobileBreakpoint`. */
	desktop: FontSizeTier[];
	/** Viewport width (px) that switches between mobile/desktop tiers. Default 640. */
	mobileBreakpoint?: number;
	/** Extra step-downs for medium desktop/laptop widths, checked in order (first match wins). */
	desktopScaleBreaks?: ScaleBreak[];
}

/**
 * Content-length + viewport-responsive font sizing, extracted from the Note
 * "deal" card's plaque-style scaling so any card can get the same reading
 * rhythm: bigger type for short content, tighter for long, and a step-down
 * on narrower/medium browser windows.
 */
export function useDynamicContentFontSize(
	contentLength: Ref<number> | ComputedRef<number>,
	options: DynamicFontSizeOptions
): ComputedRef<number> {
	const vw = useViewportWidth();
	const mobileBreakpoint = options.mobileBreakpoint ?? 640;

	return computed(() => {
		const len = contentLength.value;
		const isMobile = vw.value < mobileBreakpoint;
		const tiers = isMobile ? options.mobile : options.desktop;

		let base = tiers[tiers.length - 1].size;
		for (const tier of tiers) {
			if (len <= tier.maxLength) {
				base = tier.size;
				break;
			}
		}

		if (!isMobile && options.desktopScaleBreaks) {
			for (const brk of options.desktopScaleBreaks) {
				if (vw.value < brk.width) {
					base *= brk.factor;
					break;
				}
			}
		}

		return Math.round(base * 10) / 10;
	});
}
