<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import {
	addBookMedia,
	deleteBookMedia,
	getSignedFileUrlCached,
	updateBook,
	updateBookMedia,
	uploadBookMedia,
	type BookMedia,
} from '../../lib/api';
import ConfirmModal from '../shared/ConfirmModal.vue';

/**
 * Images attached to a book. Select one to act on it: the actions sit in view
 * beneath the strip rather than behind a hover no touchscreen can reach.
 */
const props = defineProps<{
	bookId: string;
	media: BookMedia[];
	coverUrl?: string;
	isAdmin?: boolean;
}>();

const emit = defineEmits<{
	(e: 'changed'): void;
	(e: 'coverChanged', coverUrl: string | undefined): void;
}>();

const urls = ref<Record<string, string>>({});
watch(
	() => props.media.map((m) => m.id).join(),
	() => {
		for (const m of props.media) {
			if (urls.value[m.id]) continue;
			getSignedFileUrlCached(m.path)
				.then((u) => (urls.value = { ...urls.value, [m.id]: u }))
				.catch(() => {});
		}
	},
	{ immediate: true }
);

const selectedId = ref<string | null>(null);
const selected = computed(() => props.media.find((m) => m.id === selectedId.value) ?? null);
const isCover = (m: BookMedia) => !!props.coverUrl && props.coverUrl.replace(/^\/files\//, '') === m.path;

const caption = ref('');
watch(selected, (m) => (caption.value = m?.caption ?? ''));

const fileInput = ref<HTMLInputElement | null>(null);
const uploading = ref(false);
const error = ref<string | null>(null);
const confirmingRemove = ref(false);

async function onFiles(e: Event) {
	const files = Array.from((e.target as HTMLInputElement).files ?? []);
	if (!files.length) return;
	uploading.value = true;
	error.value = null;
	try {
		for (const [i, file] of files.entries()) {
			const up = await uploadBookMedia(props.bookId, file);
			await addBookMedia(props.bookId, { path: up.path, sort_order: props.media.length + i });
		}
		emit('changed');
	} catch (err) {
		console.error('Image upload failed:', err);
		error.value = 'An image didn’t upload. Try again, or try a smaller file.';
	} finally {
		uploading.value = false;
		if (fileInput.value) fileInput.value.value = '';
	}
}

async function useAsCover() {
	const m = selected.value;
	if (!m) return;
	const next = isCover(m) ? '' : `/files/${m.path}`;
	try {
		await updateBook(props.bookId, { cover_url: next });
		emit('coverChanged', next || undefined);
	} catch (err) {
		console.error('Failed to set cover:', err);
	}
}

async function saveCaption() {
	const m = selected.value;
	if (!m || caption.value === (m.caption ?? '')) return;
	try {
		await updateBookMedia(props.bookId, m.id, { caption: caption.value });
		emit('changed');
	} catch (err) {
		console.error('Failed to save caption:', err);
	}
}

async function remove() {
	const m = selected.value;
	confirmingRemove.value = false;
	if (!m) return;
	try {
		await deleteBookMedia(props.bookId, m.id);
		if (isCover(m)) emit('coverChanged', undefined);
		selectedId.value = null;
		emit('changed');
	} catch (err) {
		console.error('Failed to remove image:', err);
	}
}
</script>

<template>
	<section v-if="media.length || isAdmin" class="images">
		<h3 class="heading">Images</h3>

		<div class="strip">
			<button
				v-for="m in media"
				:key="m.id"
				type="button"
				class="thumb"
				:class="{ sel: selectedId === m.id }"
				:aria-pressed="selectedId === m.id"
				:aria-label="m.caption || 'Image'"
				@click="selectedId = selectedId === m.id ? null : m.id"
			>
				<img v-if="urls[m.id]" :src="urls[m.id]" :alt="m.caption ?? ''" loading="lazy" />
				<span v-if="isCover(m)" class="badge">Cover</span>
			</button>

			<button v-if="isAdmin" type="button" class="thumb add" :disabled="uploading" @click="fileInput?.click()">
				<span>{{ uploading ? 'Uploading…' : 'Add' }}</span>
			</button>
			<input ref="fileInput" type="file" accept="image/jpeg,image/png,image/webp" multiple class="hidden" @change="onFiles" />
		</div>

		<p v-if="error" class="error">{{ error }}</p>
		<p v-if="!media.length && !uploading" class="empty">No images yet — covers, plates, marginalia.</p>

		<Transition name="drawer">
			<div v-if="selected && isAdmin" class="tools">
				<input
					v-model="caption"
					class="caption"
					placeholder="Caption"
					@keydown.enter.prevent="($event.target as HTMLInputElement).blur()"
					@blur="saveCaption"
				/>
				<div class="tool-row">
					<button type="button" class="tool" @click="useAsCover">{{ isCover(selected) ? 'Stop using as cover' : 'Use as cover' }}</button>
					<button type="button" class="tool danger" @click="confirmingRemove = true">Remove</button>
				</div>
			</div>
			<p v-else-if="selected?.caption" class="shown-caption">{{ selected.caption }}</p>
		</Transition>

		<ConfirmModal
			:isOpen="confirmingRemove"
			title="Remove this image"
			message="The image is deleted from the book. This can’t be undone."
			confirmLabel="Remove"
			@confirm="remove"
			@cancel="confirmingRemove = false"
		/>
	</section>
</template>

<style scoped>
.heading {
	margin: 0 0 12px;
	font-size: 15px;
	font-weight: 400;
	color: #fff;
}
.strip {
	display: flex;
	gap: 10px;
	overflow-x: auto;
	padding-bottom: 4px;
	scrollbar-width: none;
	-webkit-overflow-scrolling: touch;
}
.strip::-webkit-scrollbar {
	display: none;
}
.thumb {
	position: relative;
	flex-shrink: 0;
	width: 72px;
	height: 104px;
	padding: 0;
	border-radius: 5px;
	overflow: hidden;
	border: 1px solid var(--color-mono-800);
	background: var(--color-mono-900);
	cursor: pointer;
	transition:
		border-color 0.18s ease,
		transform 0.18s ease;
}
.thumb img {
	width: 100%;
	height: 100%;
	object-fit: cover;
	display: block;
}
.thumb.sel {
	border-color: #e8d0a8;
	transform: translateY(-2px);
}
.thumb.add {
	display: grid;
	place-items: center;
	border-style: dashed;
	border-color: var(--color-mono-700);
	color: var(--color-mono-400);
	font: inherit;
	font-size: 13px;
}
.thumb.add:hover {
	color: #e8d0a8;
	border-color: rgb(232 208 168 / 0.5);
}
.badge {
	position: absolute;
	left: 4px;
	bottom: 4px;
	padding: 1px 6px;
	border-radius: 4px;
	background: rgb(5 5 5 / 0.78);
	color: #e8d0a8;
	font-size: 11px;
}
.empty,
.shown-caption {
	margin: 10px 0 0;
	font-size: 13.5px;
	font-style: italic;
	color: var(--color-mono-500);
}
.error {
	margin: 10px 0 0;
	font-size: 13.5px;
	color: #fda4af;
}
.tools {
	margin-top: 12px;
	display: flex;
	flex-direction: column;
	gap: 10px;
}
.caption {
	padding: 9px 12px;
	background: var(--color-mono-900);
	border: 1px solid var(--color-mono-700);
	border-radius: 9px;
	color: #fff;
	font: inherit;
	font-size: 14px;
	outline: none;
}
.caption:focus {
	border-color: rgb(232 208 168 / 0.7);
}
.caption::placeholder {
	color: var(--color-mono-600);
	font-style: italic;
}
.tool-row {
	display: flex;
	gap: 8px;
	flex-wrap: wrap;
}
.tool {
	padding: 8px 13px;
	border: 1px solid var(--color-mono-700);
	border-radius: 9px;
	background: none;
	font: inherit;
	font-size: 13.5px;
	color: var(--color-mono-200);
	cursor: pointer;
}
.tool:hover {
	border-color: var(--color-mono-500);
	color: #fff;
}
.tool.danger {
	color: #fda4af;
}
.tool.danger:hover {
	border-color: rgb(253 164 175 / 0.5);
}
.drawer-enter-active,
.drawer-leave-active {
	transition:
		opacity 0.22s ease,
		transform 0.22s ease;
}
.drawer-enter-from,
.drawer-leave-to {
	opacity: 0;
	transform: translateY(-4px);
}
</style>
