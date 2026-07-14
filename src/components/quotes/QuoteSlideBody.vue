<script setup lang="ts">
import { computed, toRef } from 'vue';
import { formatMarkdown } from '../../lib/formatText';
import { useTextureImage } from '../../composables/useTextureImage';
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
     *  'fullbleed' (/textures/fb-<slug>.webp). */
    textureUrl?: string;
    /** Card-tier (tex-*) URL for the same variant — the instant placeholder /
     *  decode fallback for the heavier full-bleed tier (see useTextureImage). */
    fallbackTextureUrl?: string;
    /** Optional darkness wash strength (0–0.9). When set, overrides the static
     *  `--tex-darkness` default on the surface; undefined keeps the CSS value. */
    darkness?: number;
}>();

const html = computed(() => formatMarkdown(props.text));

// Decode-gated texture src: the <img> only ever receives an already-decoded
// URL, so it paints instantly and reliably on iOS (no opacity-reveal that
// silently fails to repaint a large full-bleed image on mobile).
const { src: texSrc } = useTextureImage(
    toRef(props, 'textureUrl'),
    toRef(props, 'fallbackTextureUrl'),
);
</script>

<template>
    <!-- Essay-deck / Quotes-tab textured card. -->
    <div v-if="mode === 'textured'" class="w-full sm:max-w-2xl mx-auto px-6 sm:px-4">
        <blockquote lang="en" :class="[typographyClass, 'quote-card whitespace-pre-wrap is-textured']" :style="{
            fontSize: fontSize + 'px',
            lineHeight: 'var(--content-leading)',
            fontWeight: 400,
            textAlign: justified ? 'justify' : 'left',
            hyphens: hyphenation ? 'auto' : 'none',
            '--tex-darkness': darkness != null ? String(darkness) : undefined,
        }">
            <img v-if="texSrc" class="tex-img" :src="texSrc" alt="" aria-hidden="true" />
            <span class="qc-body"><span v-if="withQuotationMarks" class="qc-mark" aria-hidden="true">&ldquo;</span><span v-html="html"></span><span v-if="withQuotationMarks" class="qc-mark" aria-hidden="true">&rdquo;</span></span>
        </blockquote>
        <EssayQuoteCite v-if="creator || work" class="mt-3 ml-auto pr-4" presentation :author="creator" :title="work" :year="year" :page="page" :title-href="pdfUrl" />
    </div>

    <!-- Full-bleed: the texture fills the whole slide; quote + credit float on
         it with a legibility wash. Absolute-fills the (relative) host slide. -->
    <div v-else-if="mode === 'fullbleed'" class="qsb-fullbleed" :style="{ '--tex-darkness': darkness != null ? String(darkness) : undefined }">
        <img v-if="texSrc" class="tex-img tex-img--dim" :src="texSrc" alt="" aria-hidden="true" />
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
