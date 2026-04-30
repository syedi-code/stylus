<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import {
	addBookMedia,
	deleteBookMedia,
	getSignedFileUrl,
	updateBookMedia,
	uploadBookMedia,
	type BookMedia,
} from '../../lib/api';

const props = defineProps<{
	bookId: string;
	media: BookMedia[];
	coverUrl?: string;
	isAdmin?: boolean;
}>();

const emit = defineEmits<{
	(e: 'changed'): void;
	(e: 'setCover', path: string): void;
	(e: 'clearCover'): void;
}>();

const fileInput = ref<HTMLInputElement | null>(null);
const uploading = ref(false);
const uploadError = ref<string | null>(null);
const signedUrls = ref<Record<string, string>>({});

// Path stored on the book (cover_url is "/files/<path>"); we strip the prefix.
const coverPath = computed(() => {
	if (!props.coverUrl) return null;
	return props.coverUrl.replace('/files/', '');
});

// True when the cover lives at the same path as a book_media item.
function isMediaCover(m: BookMedia): boolean {
	return !!coverPath.value && m.path === coverPath.value;
}

async function ensureSignedUrl(key: string, path: string): Promise<string> {
	if (signedUrls.value[key]) return signedUrls.value[key];
	const url = await getSignedFileUrl(path);
	signedUrls.value[key] = url;
	return url;
}

async function refreshSignedUrls() {
	signedUrls.value = {};
	const tasks: Promise<string>[] = [];
	if (coverPath.value) {
		tasks.push(ensureSignedUrl('__cover__', coverPath.value));
	}
	for (const m of props.media) {
		tasks.push(ensureSignedUrl(m.id, m.path));
	}
	await Promise.all(tasks);
}

watch(
	[() => props.media.map((m) => m.id).join(','), () => props.coverUrl],
	() => refreshSignedUrls(),
	{ immediate: true }
);

async function pickFile() {
	fileInput.value?.click();
}

async function onFile(event: Event) {
	const target = event.target as HTMLInputElement;
	const files = target.files;
	if (!files || files.length === 0) return;

	uploading.value = true;
	uploadError.value = null;
	try {
		for (const file of Array.from(files)) {
			const upload = await uploadBookMedia(props.bookId, file);
			await addBookMedia(props.bookId, {
				path: upload.path,
				sort_order: props.media.length,
			});
		}
		emit('changed');
	} catch (err) {
		console.error('Upload failed:', err);
		uploadError.value =
			err instanceof Error ? err.message : 'Upload failed.';
	} finally {
		uploading.value = false;
		if (fileInput.value) fileInput.value.value = '';
	}
}

async function editCaption(m: BookMedia) {
	const next = window.prompt('Caption:', m.caption ?? '');
	if (next === null) return;
	try {
		await updateBookMedia(props.bookId, m.id, { caption: next });
		emit('changed');
	} catch (err) {
		console.error('Update caption failed:', err);
	}
}

async function remove(m: BookMedia) {
	if (!window.confirm('Delete this image?')) return;
	try {
		await deleteBookMedia(props.bookId, m.id);
		emit('changed');
	} catch (err) {
		console.error('Delete failed:', err);
	}
}

async function move(m: BookMedia, direction: -1 | 1) {
	const index = props.media.findIndex((x) => x.id === m.id);
	const swap = props.media[index + direction];
	if (!swap) return;
	try {
		await Promise.all([
			updateBookMedia(props.bookId, m.id, { sort_order: swap.sort_order }),
			updateBookMedia(props.bookId, swap.id, { sort_order: m.sort_order }),
		]);
		emit('changed');
	} catch (err) {
		console.error('Reorder failed:', err);
	}
}

function setAsCover(m: BookMedia) {
	emit('setCover', m.path);
}

function clearCover() {
	if (!window.confirm('Remove cover image?')) return;
	emit('clearCover');
}

// True when cover_url points to a path that's NOT in book_media — show a
// dedicated tile for it. If cover_url matches a media row, that row gets the
// "cover" badge instead.
const orphanCover = computed(
	() => !!coverPath.value && !props.media.some((m) => m.path === coverPath.value)
);

const totalCount = computed(
	() => props.media.length + (orphanCover.value ? 1 : 0)
);
</script>

<template>
	<section class="pt-4 mt-4 border-t border-mono-800">
		<div class="flex items-center justify-between mb-2.5">
			<h5
				class="text-[10.5px] tracking-[0.18em] uppercase text-mono-500 m-0 font-medium"
			>
				Visual media · {{ totalCount }}
			</h5>
			<button
				v-if="isAdmin"
				@click="pickFile"
				:disabled="uploading"
				class="text-[11px] text-essay hover:text-essay-bright cursor-pointer disabled:opacity-50"
			>
				+ {{ uploading ? 'Uploading…' : 'Add image' }}
			</button>
			<input
				ref="fileInput"
				type="file"
				accept="image/jpeg,image/png,image/webp"
				multiple
				class="hidden"
				@change="onFile"
			/>
		</div>

		<div
			v-if="uploadError"
			class="text-[11px] text-rose-bright mb-2"
		>
			{{ uploadError }}
		</div>

		<div
			v-if="totalCount === 0"
			class="text-[11.5px] text-mono-600 italic px-1 py-1"
		>
			No images attached.
		</div>

		<div v-else class="grid grid-cols-2 gap-2 items-start">
			<!-- Synthetic cover tile (only when cover_url has no matching media row) -->
			<div
				v-if="orphanCover"
				class="group relative bg-mono-800 rounded-md overflow-hidden border border-essay/60"
			>
				<img
					v-if="signedUrls['__cover__']"
					:src="signedUrls['__cover__']"
					alt="Cover"
					class="block w-full h-auto"
				/>
				<div
					v-else
					class="w-full h-32 flex items-center justify-center text-[11px] text-mono-600"
				>
					loading…
				</div>
				<div
					class="absolute top-1 left-1 px-1.5 py-0.5 bg-essay text-essay-text text-[9px] font-bold uppercase tracking-wider rounded"
				>
					Cover
				</div>
				<div
					v-if="isAdmin"
					class="absolute top-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
				>
					<button
						@click.stop="clearCover"
						class="px-1.5 py-0.5 bg-mono-900/80 text-rose-bright hover:text-rose rounded text-[10px]"
						title="Remove cover"
					>
						✕
					</button>
				</div>
			</div>

			<!-- Regular media items -->
			<div
				v-for="(m, i) in media"
				:key="m.id"
				class="group relative bg-mono-800 rounded-md overflow-hidden border"
				:class="isMediaCover(m) ? 'border-essay/60' : 'border-mono-700'"
			>
				<img
					v-if="signedUrls[m.id]"
					:src="signedUrls[m.id]"
					:alt="m.caption ?? ''"
					:class="
						isMediaCover(m)
							? 'block w-full h-auto'
							: 'block w-full h-32 object-cover'
					"
				/>
				<div
					v-else
					class="w-full h-32 flex items-center justify-center text-[11px] text-mono-600"
				>
					loading…
				</div>
				<div
					v-if="isMediaCover(m)"
					class="absolute top-1 left-1 px-1.5 py-0.5 bg-essay text-essay-text text-[9px] font-bold uppercase tracking-wider rounded"
				>
					Cover
				</div>
				<div
					v-if="m.caption"
					class="px-2 py-1 text-[11px] text-mono-300 truncate"
					:title="m.caption"
				>
					{{ m.caption }}
				</div>

				<div
					v-if="isAdmin"
					class="absolute top-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
				>
					<button
						v-if="!isMediaCover(m)"
						@click.stop="setAsCover(m)"
						class="px-1.5 py-0.5 bg-mono-900/80 text-essay hover:text-essay-bright rounded text-[10px]"
						title="Set as cover"
					>
						★
					</button>
					<button
						@click.stop="move(m, -1)"
						:disabled="i === 0"
						class="px-1.5 py-0.5 bg-mono-900/80 text-mono-200 hover:text-mono-50 rounded text-[10px] disabled:opacity-30"
						title="Move up"
					>
						↑
					</button>
					<button
						@click.stop="move(m, 1)"
						:disabled="i === media.length - 1"
						class="px-1.5 py-0.5 bg-mono-900/80 text-mono-200 hover:text-mono-50 rounded text-[10px] disabled:opacity-30"
						title="Move down"
					>
						↓
					</button>
					<button
						@click.stop="editCaption(m)"
						class="px-1.5 py-0.5 bg-mono-900/80 text-mono-200 hover:text-mono-50 rounded text-[10px]"
						title="Caption"
					>
						✎
					</button>
					<button
						@click.stop="remove(m)"
						class="px-1.5 py-0.5 bg-mono-900/80 text-rose-bright hover:text-rose rounded text-[10px]"
						title="Delete"
					>
						✕
					</button>
				</div>
			</div>
		</div>
	</section>
</template>
