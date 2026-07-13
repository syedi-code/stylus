<script setup lang="ts">
import { computed } from 'vue';
import { formatMarkdown } from '../../lib/formatText';
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
    /** Chosen texture asset for 'textured' (/textures/tex-0X.png) or
     *  'fullbleed' (/textures/fb-0X.png). */
    textureUrl?: string;
}>();

const html = computed(() => formatMarkdown(props.text));
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
            '--tex': textureUrl ? `url(${textureUrl})` : 'none',
        }">
            <span class="qc-body"><span v-if="withQuotationMarks" class="qc-mark" aria-hidden="true">&ldquo;</span><span v-html="html"></span><span v-if="withQuotationMarks" class="qc-mark" aria-hidden="true">&rdquo;</span></span>
        </blockquote>
        <EssayQuoteCite v-if="creator || work" class="mt-3 ml-auto pr-4" presentation :author="creator" :title="work" :year="year" :page="page" :title-href="pdfUrl" />
    </div>

    <!-- Full-bleed: the texture fills the whole slide; quote + credit float on
         it with a legibility wash. Absolute-fills the (relative) host slide. -->
    <div v-else-if="mode === 'fullbleed'" class="qsb-fullbleed qsb-fullbleed--dim" :style="{ '--tex': textureUrl ? `url(${textureUrl})` : 'none' }">
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
