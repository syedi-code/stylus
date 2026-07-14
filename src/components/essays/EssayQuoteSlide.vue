<script setup lang="ts">
import { computed } from 'vue';
import type { EssayReference } from '../../lib/api';
import { useTypography } from '../../composables/useTypography';
import QuoteSlideBody from '../quotes/QuoteSlideBody.vue';

const props = defineProps<{
    reference: EssayReference;
    preferredFontSize: number;
    justified: boolean;
    hyphenation: boolean;
    /** Quote surface mode; defaults to the dark textured card. */
    mode?: 'textured' | 'fullbleed' | 'plain';
    /** Resolved texture asset for textured / fullbleed modes. */
    textureUrl?: string;
    /** Card-tier (tex-*) URL — placeholder / decode fallback for full-bleed. */
    fallbackTextureUrl?: string;
    /** Seeded CSS object-position for the full-bleed texture crop. */
    textureObjectPosition?: string;
    /** Texture darkness wash strength (0–0.9); forwarded to the surface. */
    darkness?: number;
}>();

// Pull the shared `useTypography('quote', 'presentation', length)` styling
// so embedded quote slides match the standalone PresentationViewQuote.
const contentLength = computed(() => props.reference.quote_text?.length ?? 0);
const { typographyClass } = useTypography('quote', 'presentation', contentLength);

const text = computed(() => props.reference.quote_text || '');
const creator = computed(
    () => props.reference.book_author || props.reference.quote_creator
);
const work = computed(
    () => props.reference.book_title || props.reference.quote_work
);
const year = computed(() => props.reference.book_originally_published);
const page = computed(
    () => props.reference.page || props.reference.quote_page
);

// The quote follows the viewer's font control exactly, like prose — so it's
// always fully sizeable across the control's min/max and can never get stuck
// oversized. (The per-embed `size` no longer forces the presentation size.)
const effectiveFontSize = computed(() => props.preferredFontSize);
</script>

<template>
    <div class="relative w-full h-full flex items-center justify-center overflow-y-auto overscroll-contain py-6">
        <QuoteSlideBody :text="text" :creator="creator || undefined" :work="work || undefined" :year="year || undefined" :page="page || undefined" :font-size="effectiveFontSize" :justified="justified" :hyphenation="hyphenation" :typography-class="typographyClass" with-quotation-marks :mode="mode ?? 'textured'" :texture-url="textureUrl" :fallback-texture-url="fallbackTextureUrl" :texture-object-position="textureObjectPosition" :darkness="darkness" />
    </div>
</template>
