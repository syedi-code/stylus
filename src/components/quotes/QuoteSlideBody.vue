<script setup lang="ts">
import { computed } from 'vue';
import { formatMarkdown } from '../../lib/formatText';
import BookAttribution from '../books/BookAttribution.vue';
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
    /** Quote surface: 'foil' gold card, 'textured' noir gilt card, or
     *  'fullbleed' (texture fills the slide). Undefined → plain standalone. */
    mode?: 'foil' | 'textured' | 'fullbleed';
    /** Chosen texture asset for 'textured' (/textures/tex-0X.png) or
     *  'fullbleed' (/textures/fb-0X.png). */
    textureUrl?: string;
}>();

const html = computed(() => formatMarkdown(props.text));
</script>

<template>
    <!-- Essay-deck quote card. ONE layout for both surfaces — the gold "foil"
         bubble and the noir "textured" card share wrapper, blockquote,
         quotation marks and (crucially) the same credit placement, so layout
         tweaks land once. `mode` only swaps the surface class + mark color. -->
    <div v-if="mode === 'foil' || mode === 'textured'" class="w-full sm:max-w-2xl mx-auto px-6 sm:px-4">
        <blockquote lang="en" :class="[typographyClass, 'quote-card whitespace-pre-wrap', mode === 'foil' ? 'foil-bubble foil-text' : 'is-textured']" :style="{
            fontSize: fontSize + 'px',
            lineHeight: 'var(--leading-quote)',
            fontWeight: mode === 'foil' ? 500 : 400,
            textAlign: justified ? 'justify' : 'left',
            hyphens: hyphenation ? 'auto' : 'none',
            ...(mode === 'textured' ? { '--tex': textureUrl ? `url(${textureUrl})` : 'none' } : {}),
        }">
            <span class="qc-body"><span v-if="withQuotationMarks" class="qc-mark" aria-hidden="true">&ldquo;</span><span v-html="html"></span><span v-if="withQuotationMarks" class="qc-mark" aria-hidden="true">&rdquo;</span></span>
        </blockquote>
        <EssayQuoteCite v-if="creator || work" class="mt-3 ml-auto pr-4" presentation :author="creator" :title="work" :year="year" :page="page" />
    </div>

    <!-- Full-bleed: the texture fills the whole slide; quote + credit float on
         it with a legibility wash. Absolute-fills the (relative) host slide. -->
    <div v-else-if="mode === 'fullbleed'" class="qsb-fullbleed" :style="{ '--tex': textureUrl ? `url(${textureUrl})` : 'none' }">
        <!-- Same column as the card branch (wrapper + quote-card padding), so
             the quote wraps at the same width — just no card surface. -->
        <div class="fb-inner">
            <div class="w-full sm:max-w-2xl mx-auto px-6 sm:px-4">
                <blockquote lang="en" :class="[typographyClass, 'quote-card fb-quote whitespace-pre-wrap']" :style="{
                    fontSize: fontSize + 'px',
                    lineHeight: 'var(--leading-quote)',
                    textAlign: justified ? 'justify' : 'left',
                    hyphens: hyphenation ? 'auto' : 'none',
                }">
                    <span class="qc-body"><span v-if="withQuotationMarks" class="qc-mark" aria-hidden="true">&ldquo;</span><span v-html="html"></span><span v-if="withQuotationMarks" class="qc-mark" aria-hidden="true">&rdquo;</span></span>
                </blockquote>
                <EssayQuoteCite v-if="creator || work" class="mt-3 ml-auto pr-4" presentation :author="creator" :title="work" :year="year" :page="page" />
            </div>
        </div>
    </div>

    <!-- Standalone quote (unchanged). -->
    <div v-else class="w-full sm:max-w-2xl flex flex-col overflow-y-auto px-6 sm:px-4 mx-auto -translate-y-[2vh]">
        <div class="pl-2 pr-4 pt-4 pb-0 sm:pl-3 sm:pr-5 sm:pt-5 sm:pb-0 min-h-0 overflow-y-auto scrollbar-hide flex-1">
            <blockquote lang="en" :class="[typographyClass, 'text-white py-2 whitespace-pre-wrap']" :style="{
                fontSize: fontSize + 'px',
                lineHeight: 'var(--leading-quote)',
                textAlign: justified ? 'justify' : 'left',
                hyphens: hyphenation ? 'auto' : 'none',
            }">
                <span v-if="withQuotationMarks" style="color: #e8d0a8" aria-hidden="true">&ldquo;</span><span v-html="html"></span><span v-if="withQuotationMarks" style="color: #e8d0a8" aria-hidden="true">&rdquo;</span>
            </blockquote>
        </div>
        <BookAttribution v-if="creator || work" class="pr-4 sm:pr-5 pb-2 shrink-0 ml-auto" variant="presentation" align="end" dash muted-title :author="creator" :title="work" :year="year" :page="page" :title-href="pdfUrl" />
    </div>
</template>

<style scoped>
/* ── Quote card (shared) ─────────────────────────────────────────────────
   The one layout for both essay-deck surfaces. Padding, wrapping and the text
   body live here; `.foil-bubble` (global) and `.is-textured` (below) only
   supply the surface. `.qc-body` sits above any texture layers. */
.quote-card {
	margin: 0;
	padding: 1.15em 1.4em;
	text-wrap: pretty;
}
.qc-body {
	position: relative;
	z-index: 2;
}

/* ── Noir grit textured surface ──────────────────────────────────────────
   A gilt-bevel border (masked gradient) over a baked film-grain texture (a
   decoded PNG — no live filter, so no repaint cost on scroll). A vertical
   scrim darkens the text band; a text-shadow adds the last lift. */
.is-textured {
	position: relative;
	z-index: 1;
	border-radius: 16px;
	overflow: hidden;
	/* Flat gold outline (not the graded bevel) — dim, receding antique gold */
	border: 1px solid #8a7548;
	background: #050505;
	box-shadow: 0 22px 52px -28px rgba(0, 0, 0, 0.88);
}
/* the baked texture, scaled to cover — downscales in crisply at any card size */
.is-textured::before {
	content: '';
	position: absolute;
	inset: 0;
	z-index: 0;
	background-image: var(--tex);
	background-size: cover;
	background-position: center;
	background-repeat: no-repeat;
	filter: brightness(0.82);
}
/* legibility scrim — darkens the middle band the text sits in */
.is-textured::after {
	content: '';
	position: absolute;
	inset: 0;
	z-index: 1;
	pointer-events: none;
	background: linear-gradient(180deg, rgba(5, 5, 5, 0.10) 0%, rgba(5, 5, 5, 0.42) 50%, rgba(5, 5, 5, 0.12) 100%);
}
.is-textured .qc-body {
	color: #ededed;
	text-shadow: 0 1px 9px rgba(0, 0, 0, 0.6);
}
/* gold curly quotation marks flanking the quote body (textured only) */
.is-textured .qc-mark {
	color: #e8d0a8;
}

/* ── Full-bleed surface ──────────────────────────────────────────────────
   The texture fills the whole (relative) host slide; quote + credit float
   above it with a legibility wash. */
.qsb-fullbleed {
	position: absolute;
	inset: 0;
	overflow: hidden;
}
.qsb-fullbleed::before {
	content: '';
	position: absolute;
	inset: 0;
	z-index: 0;
	background-image: var(--tex);
	background-size: cover;
	background-position: center;
	background-repeat: no-repeat;
	/* darken the texture client-side (tunable, no re-bake) */
	filter: brightness(0.25);
}
.qsb-fullbleed::after {
	content: '';
	position: absolute;
	inset: 0;
	z-index: 1;
	pointer-events: none;
	background:
		radial-gradient(120% 78% at 50% 44%, rgba(5, 5, 5, 0.5), rgba(5, 5, 5, 0) 60%),
		linear-gradient(180deg, rgba(5, 5, 5, 0.32) 0%, rgba(5, 5, 5, 0) 24%, rgba(5, 5, 5, 0) 70%, rgba(5, 5, 5, 0.46) 100%);
}
.fb-inner {
	position: absolute;
	inset: 0;
	z-index: 2;
	display: flex;
	align-items: center;
	justify-content: center;
	overflow-y: auto;
}
.fb-quote {
	color: #ededed;
	font-weight: 400;
	text-shadow: 0 1px 14px rgba(0, 0, 0, 0.7);
}
.fb-quote .qc-mark {
	color: #e8d0a8;
}
/* the floating credit needs a shadow to read on the open texture */
.qsb-fullbleed :deep(.qcite) {
	text-shadow: 0 1px 10px rgba(0, 0, 0, 0.7);
}
</style>
