<script setup lang="ts">
import { computed } from 'vue';
import { useSourceLibrary } from '../../../composables/useSourceLibrary';
import type { EmbedBlock } from '../../../composables/useEssayBlocks';

/**
 * Image block — presentational. Centered figure + optional caption. Selection
 * / delete are handled by the editor's action rail.
 */
const props = defineProps<{ block: EmbedBlock }>();

const { imageUrl } = useSourceLibrary();

const url = computed(() => imageUrl(props.block.id));
const caption = computed(() => {
	const c = props.block.params.caption;
	return typeof c === 'string' && c.length ? c : '';
});
</script>

<template>
	<div class="fi">
		<img v-if="url" :src="url" :alt="caption || 'Essay image'" loading="lazy" decoding="async" class="img" />
		<div v-else class="placeholder">image uploading…</div>
		<p v-if="caption" class="cap">{{ caption }}</p>
	</div>
</template>

<style scoped>
.fi {
	position: relative;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 8px;
	padding: 4px 0;
	-webkit-user-select: none;
	user-select: none;
	-webkit-touch-callout: none;
}
.img {
	max-height: 300px;
	max-width: 100%;
	object-fit: contain;
	border-radius: 4px;
	box-shadow: 0 8px 20px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.04);
	-webkit-user-drag: none;
	pointer-events: none;
}
.placeholder {
	width: 190px;
	aspect-ratio: 4 / 3;
	display: grid;
	place-items: center;
	background: #0d0b08;
	border: 1px solid var(--color-mono-800);
	border-radius: 4px;
	color: var(--color-mono-600);
	font-size: 12px;
	font-style: italic;
}
.cap {
	font-style: italic;
	color: var(--color-mono-300);
	font-size: 12px;
	line-height: 1.35;
	text-align: center;
	max-width: 85%;
	margin: 0;
}
</style>
