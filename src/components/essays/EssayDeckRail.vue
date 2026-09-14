<script setup lang="ts">
import { computed } from 'vue';
import type { EditorBlock } from '../../composables/useEssayBlocks';

/**
 * The deck rail — EssaySlideProgressBar, brought into the writing room.
 *
 * An essay IS a deck: `useEssaySlides` turns one block into one slide, so the
 * segmented bar the reader sees at the top of PresentationViewEssay describes
 * the thing being written just as exactly as the thing being read. Putting it
 * in the editor means the shape of the deck is visible while you author it.
 *
 * It earns the 2px on its own: across the 49 essays in the corpus the median
 * piece is four blocks long, so the rail is a complete, glanceable outline of
 * almost every essay — and each segment taps to its block.
 *
 * Segment colours follow the presentation bar (filled amber up to and
 * including the current slide, `bg-mono-700/70` after it).
 */
const props = defineProps<{
	blocks: EditorBlock[];
	/** Block id of the selected / editing block, if any. */
	activeBid?: string | null;
}>();

const emit = defineEmits<{ (e: 'jump', bid: string): void }>();

const activeIndex = computed(() =>
	props.activeBid ? props.blocks.findIndex((b) => b.bid === props.activeBid) : -1
);

function label(block: EditorBlock, i: number): string {
	return `Slide ${i + 1} of ${props.blocks.length} — ${block.kind}`;
}
</script>

<template>
	<div v-if="blocks.length > 1" class="deck" role="list">
		<button
			v-for="(block, i) in blocks"
			:key="block.bid"
			type="button"
			role="listitem"
			class="seg"
			:class="{
				on: activeIndex === -1 ? false : i <= activeIndex,
				now: i === activeIndex,
			}"
			:title="label(block, i)"
			:aria-label="label(block, i)"
			@click="emit('jump', block.bid)"
		>
			<i></i>
		</button>
	</div>
</template>

<style scoped>
.deck {
	display: flex;
	align-items: center;
	gap: 4px;
	padding: 0 12px;
}
.seg {
	flex: 1;
	min-width: 0;
	/* The bar is 2px; the button is 16px so it is actually tappable. */
	padding: 7px 0;
	border: none;
	background: none;
	cursor: pointer;
	display: block;
}
.seg i {
	display: block;
	height: 2px;
	border-radius: 999px;
	background: rgb(39 39 42 / 0.7);
	transition: background 0.25s ease, box-shadow 0.25s ease;
}
.seg.on i {
	background: var(--color-essay);
}
.seg.now i {
	background: var(--color-essay-bright);
	box-shadow: 0 0 7px rgb(232 160 64 / 0.6);
}
@media (hover: hover) {
	.seg:hover i {
		background: var(--color-essay-bright);
	}
}
</style>
