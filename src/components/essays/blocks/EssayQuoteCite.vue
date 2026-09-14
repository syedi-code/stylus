<script setup lang="ts">
import { computed } from 'vue';
import { parseAuthors } from '../../../lib/bookAttribution';

/**
 * Quote credit (mockup 06/09 · variant V2), shared by the writing-view foil and
 * the presentation slide so they read identically:
 *
 *   {Author}
 *   in {Book} published {Year}
 *
 * Author surname takes the app's deterministic color-hash; "in" / "published"
 * are quiet italic connectives; the book title is gold, the year white.
 */
const props = defineProps<{
	author?: string;
	title?: string;
	year?: string | number;
	page?: string;
	/** Larger type for presentation slides. */
	presentation?: boolean;
	/**
	 * One wrapping line instead of three stacked ones. For the writing view,
	 * where quotes are frequent (84 across the corpus, against 221 prose
	 * paragraphs) and a three-line credit under each one costs more column
	 * than some of the paragraphs do.
	 */
	compact?: boolean;
	/** When set, the work title becomes a clickable link to the source PDF. */
	titleHref?: string;
}>();

const authors = computed(() => parseAuthors(props.author));
const hasYear = computed(() => props.year !== undefined && props.year !== null && `${props.year}` !== '');
</script>

<template>
	<div class="qcite" :class="{ pres: presentation, compact }">
		<div v-if="authors.length" class="name">
			<span class="conn">&mdash;&nbsp;</span><template v-for="(a, i) in authors" :key="i">
				<span v-if="i > 0"> &amp; </span><span class="given">{{ a.firstParts }}</span><span class="surname" :style="{ color: a.color }">{{ a.lastName }}</span><span v-if="a.suffix" class="given">{{ a.suffix }}</span>
			</template>
		</div>
		<div v-if="title" class="row"><span class="conn">in </span><a v-if="titleHref" :href="titleHref" target="_blank" rel="noopener noreferrer" class="work" @click.stop>{{ title }}</a><span v-else class="work">{{ title }}</span><template v-if="page"><span class="pg">, p.&nbsp;</span><span class="pgn">{{ page }}</span></template></div>
		<div v-if="hasYear" class="row"><span class="conn">published </span><span class="yr">{{ year }}</span></div>
	</div>
</template>

<style scoped>
.qcite {
	text-align: right;
}

/* Compact — the three lines run together as one wrapping line. */
.qcite.compact {
	display: flex;
	flex-wrap: wrap;
	justify-content: flex-end;
	align-items: baseline;
	gap: 0 6px;
}
.qcite.compact .name,
.qcite.compact .row {
	font-size: 11px;
	line-height: 1.35;
}
.name {
	font-size: 12.5px;
	line-height: 1.2;
}
.given {
	color: var(--color-mono-300);
}
.surname {
	font-weight: 400;
}
.row {
	font-size: 12px;
	line-height: 1.25;
}
.conn {
	font-style: italic;
	color: var(--color-mono-500);
}
.work {
	font-style: italic;
	color: #e8d0a8;
	text-decoration: none;
}
.work[href]:hover {
	text-decoration: underline;
}
.yr {
	color: #fff;
	margin-left: 0.15em;
	font-variant-numeric: lining-nums;
}
.pg {
	color: var(--color-mono-500);
}
.pgn {
	color: #fff;
	font-variant-numeric: lining-nums;
}

/* presentation scale */
.pres .name {
	font-size: 17px;
	line-height: 1.2;
}
.pres .row {
	font-size: 13px;
	line-height: 1.3;
}
</style>
