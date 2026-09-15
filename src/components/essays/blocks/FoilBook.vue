<script setup lang="ts">
import { computed } from 'vue';
import { useSourceLibrary } from '../../../composables/useSourceLibrary';
import { parseAuthors } from '../../../lib/bookAttribution';
import type { EmbedBlock } from '../../../composables/useEssayBlocks';

/**
 * Book embed (writing view) — presentational. A small gilt-edged book (dark
 * leather cover, gold spine + page edge) beside the title in gold italic and
 * its author, on the dark ground. No gold slab — it reads as a book, not a
 * stick of butter.
 */
const props = defineProps<{ block: EmbedBlock }>();

const { bookById } = useSourceLibrary();

const book = computed(() => bookById.value.get(props.block.id));
const title = computed(() => book.value?.title ?? 'book unavailable');
const authors = computed(() => parseAuthors(book.value?.author));
</script>

<template>
	<div class="fb">
		<div class="tome" aria-hidden="true">
			<span class="spine"></span>
			<span class="edge"></span>
		</div>
		<div class="meta">
			<div class="btitle">{{ title }}</div>
			<div v-if="authors.length" class="bau">
				<template v-for="(a, i) in authors" :key="i">
					<span v-if="i > 0"> &amp; </span><span class="fp">{{ a.firstParts }}</span><span class="ln" :style="{ color: a.color }">{{ a.lastName }}</span><span v-if="a.suffix" class="fp">{{ a.suffix }}</span>
				</template>
			</div>
		</div>
	</div>
</template>

<style scoped>
.fb {
	display: inline-flex;
	align-items: center;
	gap: 13px;
	padding: 4px 2px;
	-webkit-user-select: none;
	user-select: none;
	-webkit-touch-callout: none;
}

/* a small gilt-edged book */
.tome {
	position: relative;
	flex: 0 0 auto;
	width: 30px;
	height: 40px;
	border-radius: 2px 3px 3px 2px;
	background: linear-gradient(120deg, #3a2410 0%, #241207 60%, #150a04 100%);
	box-shadow: inset 0 0 0 1px rgba(232, 176, 96, 0.4), 0 4px 10px rgba(0, 0, 0, 0.55);
}
.tome .spine {
	position: absolute;
	left: 3px;
	top: 3px;
	bottom: 3px;
	width: 2.5px;
	border-radius: 1px;
	background: linear-gradient(180deg, #f8d38a, #b9761f);
	box-shadow: 0 0 4px rgba(232, 160, 64, 0.4);
}
.tome .edge {
	position: absolute;
	right: 0;
	top: 3px;
	bottom: 3px;
	width: 2px;
	border-radius: 0 2px 2px 0;
	background: linear-gradient(90deg, rgba(240, 224, 190, 0.15), rgba(240, 224, 190, 0.6));
}

.meta {
	min-width: 0;
}
.btitle {
	font-size: 15px;
	font-style: italic;
	font-weight: 500;
	/* Gold italic, unlined. The underline is the app's convention for a book
	   title sitting INSIDE a sentence, where it needs to be picked out of
	   prose; a book foil is already its own object beside its own cover, and
	   a rule dragged under a title as long as some of these looked like a
	   mistake. Same #e8d0a8 the credit gives a work. */
	color: #e8d0a8;
	line-height: 1.25;
}
.bau {
	font-size: 12px;
	color: var(--color-mono-400);
	margin-top: 3px;
}
.bau .fp {
	color: var(--color-mono-300);
}
.bau .ln {
	font-weight: 600;
}
</style>
