<script setup lang="ts">
import { computed, toRef } from 'vue';
import { formatMarkdown } from '../../lib/formatText';
import { useTextureBlob } from '../../composables/useTextureBlob';
import EssayQuoteCite from '../essays/blocks/EssayQuoteCite.vue';

/**
 * Shared inner rendering for a quote in any presentation context.
 *
 * Used by:
 *   - PresentationViewQuote — the standalone quote modal
 *   - EssayQuoteSlide       — quote embeds in an essay deck
 *
 * The component owns the cardless blockquote + right-aligned em-dash
 * attribution that defines the quote's visual identity, plus font / justify /
 * hyphenation styling. Surrounding chrome (modal frame, controls) belongs to
 * the host.
 */

const props = defineProps<{
    text: string;
    creator?: string;
    work?: string;
    year?: string;
    page?: string;
    /** When set, the work title becomes a clickable link to the source PDF. */
    pdfUrl?: string;
    /** Final px font size (host owns the size composable). */
    fontSize: number;
    justified: boolean;
    hyphenation: boolean;
    /** Tailwind classes from `useTypography('quote', 'presentation', length)`. */
    typographyClass?: string;
    /** When true, wrap the quote text in gold curly quotation marks. */
    withQuotationMarks?: boolean;
    /** Quote surface: 'textured' noir gilt card, 'fullbleed' (texture fills
     *  the slide), or 'plain' (no surface — text directly on the dark
     *  ground). Undefined behaves like 'plain'. */
    mode?: 'textured' | 'fullbleed' | 'plain';
    /** Chosen texture asset for 'textured' (/textures/tex-<slug>.webp) or
     *  'fullbleed' (/textures/fb-<slug>.webp). Undefined paints no texture —
     *  the surface's dark base shows; hosts use this to window which slides
     *  hold a decoded bitmap (see PresentationViewEssay). */
    textureUrl?: string;
    /** Optional darkness wash strength (0–0.9). When set, overrides the static
     *  `--tex-darkness` default on the surface; undefined keeps the CSS value. */
    darkness?: number;
    /** Seeded background-position ("x% y%") that pans the full-bleed texture so
     *  each quote frames a different region. Undefined leaves it centered. */
    texturePosition?: string;
}>();

const html = computed(() => formatMarkdown(props.text));

// Texture URLs resolve once per session into blob: URLs (useTextureBlob), so
// repainting on modal remount never re-contacts the network — in prod that
// path runs through Cloudflare Access, and a bounced re-request permanently
// poisons WebKit's cache entry for the URL (the iOS black-screen bug).
const displayTextureUrl = useTextureBlob(toRef(props, 'textureUrl'));

// Fullbleed surface style: texture + a flat 20%-black dim (pixel-identical to
// the old brightness(0.8) filter on an opaque image, minus the offscreen
// buffer), panned to the seeded per-quote crop. Painted as a CSS background —
// never an <img> — so a decode that fails under iOS's image-memory budget
// degrades to the dark base instead of a broken-image glyph.
const fullbleedStyle = computed(() => ({
    '--tex-darkness': props.darkness != null ? String(props.darkness) : undefined,
    ...(displayTextureUrl.value
        ? {
            backgroundImage: `linear-gradient(rgb(0 0 0 / 0.2), rgb(0 0 0 / 0.2)), url(${displayTextureUrl.value})`,
            backgroundPosition: `center, ${props.texturePosition ?? 'center'}`,
        }
        : {}),
}));

// Textured-card surface style (was inline in the template; extracted so it
// can paint from the resolved blob URL too).
const texturedStyle = computed(() => ({
    fontSize: props.fontSize + 'px',
    lineHeight: 'var(--content-leading)',
    fontWeight: 400,
    textAlign: props.justified ? ('justify' as const) : ('left' as const),
    hyphens: props.hyphenation ? ('auto' as const) : ('none' as const),
    '--tex-darkness': props.darkness != null ? String(props.darkness) : undefined,
    backgroundImage: displayTextureUrl.value ? `url(${displayTextureUrl.value})` : undefined,
}));
</script>

<template>
    <!-- Essay-deck / Quotes-tab textured card. -->
    <div v-if="mode === 'textured'" class="w-full sm:max-w-2xl mx-auto px-6 sm:px-4">
        <blockquote lang="en" :class="[typographyClass, 'quote-card whitespace-pre-wrap is-textured tex-bg']" :style="texturedStyle">
            <span class="qc-body"><span v-if="withQuotationMarks" class="qc-mark" aria-hidden="true">&ldquo;</span><span v-html="html"></span><span v-if="withQuotationMarks" class="qc-mark" aria-hidden="true">&rdquo;</span></span>
        </blockquote>
        <EssayQuoteCite v-if="creator || work" class="mt-3 ml-auto pr-4" presentation :author="creator" :title="work" :year="year" :page="page" :title-href="pdfUrl" />
    </div>

    <!-- Full-bleed: the texture fills the whole slide; quote + credit float on
         it with a legibility wash. Absolute-fills the (relative) host slide. -->
    <div v-else-if="mode === 'fullbleed'" class="qsb-fullbleed tex-bg" :style="fullbleedStyle">
        <!-- Same column as the card branch (wrapper + quote-card padding), so
             the quote wraps at the same width — just no card surface. -->
        <div class="fb-inner">
            <div class="w-full sm:max-w-2xl mx-auto px-6 sm:px-4">
                <blockquote lang="en" :class="[typographyClass, 'quote-card fb-quote whitespace-pre-wrap']" :style="{
                    fontSize: fontSize + 'px',
                    lineHeight: 'var(--content-leading)',
                    textAlign: justified ? 'justify' : 'left',
                    hyphens: hyphenation ? 'auto' : 'none',
                }">
                    <span class="qc-body"><span v-if="withQuotationMarks" class="qc-mark" aria-hidden="true">&ldquo;</span><span v-html="html"></span><span v-if="withQuotationMarks" class="qc-mark" aria-hidden="true">&rdquo;</span></span>
                </blockquote>
                <EssayQuoteCite v-if="creator || work" class="mt-3 ml-auto pr-4" presentation :author="creator" :title="work" :year="year" :page="page" :title-href="pdfUrl" />
            </div>
        </div>
    </div>

    <!-- Plain: no surface at all — quote text directly on the dark ground.
         Same outer width/padding as the textured branch (just no card
         surface) so switching modes never shifts or resizes the text. -->
    <div v-else class="w-full sm:max-w-2xl mx-auto px-6 sm:px-4">
        <blockquote lang="en" :class="[typographyClass, 'quote-card whitespace-pre-wrap']" :style="{
            fontSize: fontSize + 'px',
            lineHeight: 'var(--content-leading)',
            textAlign: justified ? 'justify' : 'left',
            hyphens: hyphenation ? 'auto' : 'none',
        }">
            <span class="qc-body"><span v-if="withQuotationMarks" class="qc-mark" aria-hidden="true">&ldquo;</span><span v-html="html"></span><span v-if="withQuotationMarks" class="qc-mark" aria-hidden="true">&rdquo;</span></span>
        </blockquote>
        <EssayQuoteCite v-if="creator || work" class="mt-3 ml-auto pr-4" presentation :author="creator" :title="work" :year="year" :page="page" :title-href="pdfUrl" />
    </div>
</template>
