<script setup lang="ts">
import { computed } from 'vue';
import { useSourceLibrary } from '../../../composables/useSourceLibrary';
import { formatMarkdown } from '../../../lib/formatText';
import type { EmbedBlock } from '../../../composables/useEssayBlocks';
import EssayQuoteCite from './EssayQuoteCite.vue';

/**
 * Quote foil — presentational. A solid gold-gradient bubble with black text;
 * beneath, on the dark ground, the shared V2 credit.
 */
const props = defineProps<{ block: EmbedBlock }>();

const { quoteById, bookById } = useSourceLibrary();

const quote = computed(() => quoteById.value.get(props.block.id));
const book = computed(() =>
	quote.value?.book_id ? bookById.value.get(quote.value.book_id) : undefined
);
const html = computed(() => (quote.value ? formatMarkdown(quote.value.quote) : ''));
const author = computed(() => book.value?.author ?? quote.value?.creator ?? '');
const title = computed(() => book.value?.title ?? quote.value?.work ?? '');
const year = computed(() => book.value?.originally_published ?? '');
const page = computed(() => quote.value?.page ?? '');
</script>

<template>
	<div class="fq">
		<blockquote class="foil-bubble foil-text qbody">
			<template v-if="quote">&ldquo;<span v-html="html"></span>&rdquo;</template>
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
.qbody {
	margin: 0;
	padding: 14px 18px;
	font-size: 15px;
	font-weight: 500;
	line-height: 1.2;
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
