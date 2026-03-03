import { ref, computed, watch, type Ref, type ComputedRef } from 'vue';

type ContentType = 'note' | 'quote' | 'thought';

export const FONT_SIZE_MIN = 12;
export const FONT_SIZE_MAX = 24;
export const FONT_SIZE_STEP = 1;

function storageKey(contentType: ContentType): string {
    return `presentation-font-offset-${contentType}`;
}

function loadOffset(contentType: ContentType): number {
    try {
        const raw = localStorage.getItem(storageKey(contentType));
        if (raw !== null) {
            const parsed = parseInt(raw, 10);
            if (!isNaN(parsed)) return parsed;
        }
    } catch {
        // localStorage unavailable
    }
    return 0;
}

function saveOffset(contentType: ContentType, offset: number): void {
    try {
        localStorage.setItem(storageKey(contentType), String(offset));
    } catch {
        // localStorage unavailable
    }
}

export function usePresentationFontSize(
    contentType: ContentType,
    baseFontSize: Ref<number> | ComputedRef<number>,
) {
    const offset = ref(loadOffset(contentType));

    const finalFontSize = computed(() => {
        const raw = baseFontSize.value + offset.value;
        return Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, raw));
    });

    watch(offset, (val) => saveOffset(contentType, val));

    function setFontSize(size: number) {
        const clamped = Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, size));
        offset.value = clamped - baseFontSize.value;
    }

    function reset() {
        offset.value = 0;
    }

    return {
        finalFontSize,
        setFontSize,
        reset,
    };
}
