<script setup lang="ts">
import { computed } from 'vue';
import { useSourceLibrary } from '../../../composables/useSourceLibrary';
import { usePresentationQuoteMode, variantForSeed, textureAsset } from '../../../composables/usePresentationQuoteMode';
import { formatMarkdown } from '../../../lib/formatText';
import { useTypography } from '../../../composables/useTypography';
import type { EmbedBlock } from '../../../composables/useEssayBlocks';
import EssayQuoteCite from './EssayQuoteCite.vue';

/**
 * Quote foil — presentational.
 *
 * THE SURFACE. It rests on 'plain': the passage set on the page's own ground
 * behind a single gold hairline, no card, no texture, no ring. A page of
 * quotes — and the corpus has essays that open on three in a row — was a page
 * of gilt-edged textured slabs you had to read past. The textured card and the
 * full-bleed texture are both still here, one tap away on the foil's rail, but
 * they are a choice you make about one piece rather than the resting state of
 * the manuscript.
 *
 * (The gilt ring is also the aliasing you see on a desktop: a rounded 1px edge
 * against a rounded texture underneath never quite agrees at the corners. A
 * straight rule has no corners.)
 */
const props = defineProps<{ block: EmbedBlock }>();

const { quoteById, bookById, loaded } = useSourceLibrary();
// Keyed -v2 so the shipped 'textured' preference does not survive as the
// resting state for people who already opened the old writing room.
const { mode } = usePresentationQuoteMode('essay-write-v2', 'plain');

const quote = computed(() => quoteById.value.get(props.block.id));
const book = computed(() =>
	quote.value?.book_id ? bookById.value.get(quote.value.book_id) : undefined
);
const html = computed(() => (quote.value ? formatMarkdown(quote.value.quote) : ''));
const author = computed(() => book.value?.author ?? quote.value?.creator ?? '');
const title = computed(() => book.value?.title ?? quote.value?.work ?? '');
const year = computed(() => book.value?.originally_published ?? '');
const page = computed(() => quote.value?.page ?? '');

/**
 * Type sized from the quote's own length, via the same tier table the Quotes
 * tab and the deck use — a foil was set at a flat 15px regardless.
 *
 * It matters more here than anywhere: quotes in the corpus run to a median of
 * 189 characters and a p90 of 344, so these are paragraphs, not epigrams, and
 * a fixed size turns the long ones into a wall inside the writing column.
 * `typographyClass` also brings the hanging punctuation the surface expects.
 */
const contentLength = computed(() => quote.value?.quote?.length ?? 0);
const { baseFontSize, typographyClass } = useTypography('quote', 'card', contentLength);

// Always the card tier (tex-*, 1280×800) — an inline foil never renders large
// enough to need the 2560×1440 full-bleed tier, and a writing view can hold
// many foils at once (each fb-* decodes to ~15MB, straight into iOS WebKit's
// per-page image-memory budget). Painted as a .tex-bg background so a failed
// decode degrades to the dark base, never a broken-image glyph.
const textureStyle = computed(() =>
	mode.value === 'plain'
		? undefined
		: { backgroundImage: `url(${textureAsset(variantForSeed(props.block.id), 'card')})` },
);
</script>

<template>
	<!-- --qfs publishes the quote's own size so the hanging credit can be
	     placed at the surface's top padding, which is em-relative TO THE QUOTE
	     and not to the 11px credit that has to line up with it. -->
	<div class="fq" :class="[`m-${mode}`]" :style="{ '--qfs': `${baseFontSize}px` }">
		<div v-if="mode === 'fullbleed'" class="qsb-fullbleed tex-bg" :style="textureStyle">
			<div class="fb-inner">
				<blockquote class="quote-card fb-quote qbody" :class="typographyClass" :style="{ fontSize: `${baseFontSize}px` }">
					<template v-if="quote"><span class="qc-body"><span class="qc-mark">&ldquo;</span><span v-html="html"></span><span class="qc-mark">&rdquo;</span></span></template>
					<span v-else-if="!loaded" class="pending" aria-label="Loading quote"><i></i><i></i></span>
					<span v-else class="missing">quote unavailable</span>
				</blockquote>
			</div>
		</div>
		<blockquote v-else class="quote-card qbody" :class="[typographyClass, mode === 'textured' ? 'is-textured tex-bg' : '']" :style="[{ fontSize: `${baseFontSize}px` }, mode === 'textured' ? textureStyle : {}]">
			<template v-if="quote"><span class="qc-body"><span class="qc-mark">&ldquo;</span><span v-html="html"></span><span class="qc-mark">&rdquo;</span></span></template>
			<span v-else-if="!loaded" class="pending" aria-label="Loading quote"><i></i><i></i></span>
					<span v-else class="missing">quote unavailable</span>
		</blockquote>

		<EssayQuoteCite class="cite" compact :author="author" :title="title" :year="year" :page="page" />
	</div>
</template>

<style scoped>
.fq {
	position: relative;
	-webkit-user-select: none;
	user-select: none;
	-webkit-touch-callout: none;
}
.fq.m-fullbleed {
	min-height: 180px;
}
.qbody {
	margin: 0;
	/* em-relative, so the surface's inset scales with the quote the way
	   `.quote-card`'s own 1.15em/1.4em does on a slide. */
	padding: 0.95em 1.2em;
	/* 400, matching QuoteSlideBody exactly. The foil was set at 500, which on
	   Tiempos at card sizes reads as bold — the quotes shouted over the prose
	   they were being quoted inside. */
	font-weight: 400;
	line-height: var(--content-leading);
	text-wrap: pretty;
}
/* THE RESTING SURFACE — no card, no texture, no ring. One straight gold
   hairline at the left, which is the whole of the object-ness a quote needs
   inside a manuscript, and which cannot alias the way a rounded gilt edge
   over a rounded texture does. */
.fq.m-plain .qbody {
	padding: 0.1em 0 0.1em 1.05em;
	border-left: 1px solid rgb(232 208 168 / 0.4);
	border-radius: 0;
	background: none;
	box-shadow: none;
}
/* The catalogue arrives after the page does. Until it has, a quote is a
   quiet outline in its own measure — not "unavailable", which it isn't. */
.qbody .pending {
	display: flex;
	flex-direction: column;
	gap: 0.45em;
	padding: 0.2em 0;
}
.qbody .pending i {
	display: block;
	height: 0.62em;
	border-radius: 3px;
	background: linear-gradient(90deg, rgb(232 208 168 / 0.06) 0%, rgb(232 208 168 / 0.13) 50%, rgb(232 208 168 / 0.06) 100%);
	background-size: 200% 100%;
	animation: sheen 1.7s ease-in-out infinite;
}
.qbody .pending i:last-child {
	width: 62%;
}
@keyframes sheen {
	from {
		background-position: 100% 0;
	}
	to {
		background-position: -100% 0;
	}
}
@media (prefers-reduced-motion: reduce) {
	.qbody .pending i {
		animation: none;
	}
}
.qbody .missing {
	font-style: italic;
	opacity: 0.7;
}

/* THE CREDIT.
   Under the quote it starts where the QUOTE starts, not flush to some other
   edge — the left inset below matches the surface's own left padding in each
   mode, so the author's name and the first word of the passage sit on one
   vertical. */
.cite {
	--qcite-align: left;
	--qcite-justify: flex-start;
	margin-top: 7px;
	padding-left: 1.2em;
}
.fq.m-plain .cite {
	padding-left: 1.05em;
}

/* …and once the room is wide enough, it HANGS in the margin the centred
   column already creates — the mockup's marginalia. Nothing shifts off
   centre to make room for it; it moves into space that was empty anyway.

   158px + 26px of gap needs ~190px of gutter a side, which a 39rem measure
   first has at about 1000px of room. Below that it stays under the quote. */
@container room (min-width: 1000px) {
	.cite {
		--qcite-align: right;
		--qcite-justify: flex-end;
		position: absolute;
		right: calc(100% + 26px);
		/* The quote's first line, not the block's top: the surface's own top
		   padding is 0.95em of the QUOTE's size (--qfs), which is what this
		   clears. In em here it would resolve against the credit's own 11px
		   and land the name above the passage it belongs to. */
		top: calc(0.95 * var(--qfs, 17px));
		width: 158px;
		margin: 0;
		padding: 0 13px 0 0;
		border-right: 1px solid var(--color-mono-800);
	}
	.fq.m-plain .cite {
		top: calc(0.1 * var(--qfs, 17px));
		padding-left: 0;
	}
	/* A full-bleed foil has no margin to hang beside — it IS the full width. */
	.fq.m-fullbleed .cite {
		--qcite-align: left;
		--qcite-justify: flex-start;
		position: static;
		width: auto;
		padding: 0 0 0 1.2em;
		border-right: none;
		margin-top: 7px;
	}
}
</style>
