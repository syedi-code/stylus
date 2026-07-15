<script setup lang="ts">
import { computed } from 'vue';
import { useSourceLibrary } from '../../../composables/useSourceLibrary';
import { usePresentationQuoteMode, variantForSeed, textureAsset } from '../../../composables/usePresentationQuoteMode';
import { formatMarkdown } from '../../../lib/formatText';
import type { EmbedBlock } from '../../../composables/useEssayBlocks';
import EssayQuoteCite from './EssayQuoteCite.vue';

/**
 * Quote foil — presentational. Surface follows the shared writing-view quote
 * mode (textured dark card → fullbleed texture → plain, no surface at all),
 * cycled from the block's action rail (see EssayBlockEditor.vue); the shared
 * V2 credit sits beneath on the dark ground in every mode.
 */
const props = defineProps<{ block: EmbedBlock }>();

const { quoteById, bookById } = useSourceLibrary();
const { mode } = usePresentationQuoteMode('essay-write');

const quote = computed(() => quoteById.value.get(props.block.id));
const book = computed(() =>
	quote.value?.book_id ? bookById.value.get(quote.value.book_id) : undefined
);
const html = computed(() => (quote.value ? formatMarkdown(quote.value.quote) : ''));
const author = computed(() => book.value?.author ?? quote.value?.creator ?? '');
const title = computed(() => book.value?.title ?? quote.value?.work ?? '');
const year = computed(() => book.value?.originally_published ?? '');
const page = computed(() => quote.value?.page ?? '');

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
	<div class="fq" :class="{ 'fq-fullbleed': mode === 'fullbleed' }">
		<div v-if="mode === 'fullbleed'" class="qsb-fullbleed tex-bg" :style="textureStyle">
			<div class="fb-inner">
				<blockquote class="quote-card fb-quote qbody">
					<template v-if="quote"><span class="qc-body"><span class="qc-mark">&ldquo;</span><span v-html="html"></span><span class="qc-mark">&rdquo;</span></span></template>
					<span v-else class="missing">quote unavailable</span>
				</blockquote>
			</div>
		</div>
		<blockquote v-else class="quote-card qbody" :class="mode === 'textured' ? 'is-textured tex-bg' : ''" :style="mode === 'textured' ? textureStyle : undefined">
			<template v-if="quote"><span class="qc-body"><span class="qc-mark">&ldquo;</span><span v-html="html"></span><span class="qc-mark">&rdquo;</span></span></template>
			<span v-else class="missing">quote unavailable</span>
		</blockquote>

		<EssayQuoteCite class="cite" :author="author" :title="title" :year="year" :page="page" />
	</div>
</template>

<style scoped>
.fq {
	-webkit-user-select: none;
	user-select: none;
	-webkit-touch-callout: none;
}
.fq-fullbleed {
	position: relative;
	min-height: 180px;
}
.qbody {
	margin: 0;
	padding: 14px 18px;
	font-size: 15px;
	font-weight: 500;
	line-height: var(--content-leading);
	text-wrap: pretty;
}
.qbody .missing {
	font-style: italic;
	opacity: 0.7;
}
.cite {
	margin: 8px 4px 0;
}
</style>
