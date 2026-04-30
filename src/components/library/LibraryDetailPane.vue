<script setup lang="ts">
import { ref, watch } from 'vue';
import {
	fetchBookDetail,
	getSignedFileUrl,
	updateBook,
	uploadCover,
	type BookDetail,
} from '../../lib/api';
import LibraryMediaSection from './LibraryMediaSection.vue';

const props = defineProps<{
	bookId: string;
	isAdmin?: boolean;
}>();

const emit = defineEmits<{
	(e: 'edit', bookId: string): void;
	(e: 'refresh'): void;
}>();

const detail = ref<BookDetail | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);

async function load() {
	loading.value = true;
	error.value = null;
	try {
		detail.value = await fetchBookDetail(props.bookId);
	} catch (err) {
		console.error('Failed to load book detail:', err);
		error.value = 'Failed to load detail.';
	} finally {
		loading.value = false;
	}
}

watch(() => props.bookId, load, { immediate: true });

// On mobile the detail pane sits above the list, so it stays compact by
// default — tap the header to expand the full body. Desktop always shows
// the full body (the pane has its own column).
const expanded = ref(false);
watch(() => props.bookId, () => {
	expanded.value = false;
});

async function openPdf() {
	if (!detail.value?.book.pdf_url) return;
	try {
		const path = detail.value.book.pdf_url.replace('/files/', '');
		const url = await getSignedFileUrl(path);
		window.open(url, '_blank');
	} catch (err) {
		console.error('Failed to sign PDF URL', err);
	}
}

const coverInput = ref<HTMLInputElement | null>(null);
const coverUploading = ref(false);

function pickCover() {
	coverInput.value?.click();
}

async function onCoverFile(event: Event) {
	const target = event.target as HTMLInputElement;
	const file = target.files?.[0];
	if (!file || !detail.value) return;

	coverUploading.value = true;
	try {
		const result = await uploadCover(file, detail.value.book.id);
		await updateBook(detail.value.book.id, { cover_url: result.url });
		await load();
		emit('refresh');
	} catch (err) {
		console.error('Cover upload failed:', err);
	} finally {
		coverUploading.value = false;
		if (coverInput.value) coverInput.value.value = '';
	}
}

async function setMediaAsCover(path: string) {
	if (!detail.value) return;
	try {
		await updateBook(detail.value.book.id, { cover_url: `/files/${path}` });
		await load();
		emit('refresh');
	} catch (err) {
		console.error('Failed to set cover:', err);
	}
}

async function clearCover() {
	if (!detail.value) return;
	try {
		await updateBook(detail.value.book.id, { cover_url: '' });
		await load();
		emit('refresh');
	} catch (err) {
		console.error('Failed to clear cover:', err);
	}
}

function formatLifespan(): string {
	const a = detail.value?.author;
	if (!a) return '';
	if (!a.born && !a.died) return '';
	return `${a.born ?? ''}–${a.died ?? ''}`;
}

function handleMediaChanged() {
	load();
	emit('refresh');
}
</script>

<template>
	<div class="px-5 py-5 pb-7">
		<div v-if="loading" class="py-12 text-center text-mono-600 text-xs uppercase tracking-widest">
			Loading…
		</div>
		<div v-else-if="error" class="py-12 text-center text-sm text-rose-bright">
			{{ error }}
		</div>
		<template v-else-if="detail">
			<!-- Head — tap to expand body on mobile. On lg the chevron is hidden
			     and the body is always visible. -->
			<button
				type="button"
				@click="expanded = !expanded"
				class="w-full text-left lg:mb-4 cursor-pointer lg:cursor-default flex items-center gap-3"
			>
				<div class="flex-1 min-w-0">
					<div class="text-[13px] text-mono-300 font-medium mb-1">
						{{ detail.book.author }}
						<span v-if="formatLifespan()" class="text-mono-500 font-normal">
							· {{ formatLifespan() }}
						</span>
					</div>
					<h2
						class="text-[22px] italic text-mono-50 leading-tight m-0 tracking-tight"
					>
						{{ detail.book.title }}
					</h2>
					<div
						v-if="detail.book.originally_published"
						class="text-[13px] font-medium tabular-nums leading-none mt-1"
						style="color: rgba(232, 200, 130, 0.85);"
					>
						{{ detail.book.originally_published }}
					</div>
				</div>
				<svg
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					class="lg:hidden shrink-0 self-center text-mono-400 transition-transform"
					:class="expanded ? 'rotate-180' : ''"
				>
					<path d="m6 9 6 6 6-6" />
				</svg>
			</button>

			<div :class="[expanded ? 'block mt-4' : 'hidden', 'lg:block lg:mt-0']">

			<!-- Stats -->
			<div class="grid grid-cols-3 gap-3.5 mb-4">
				<div class="bg-mono-800 rounded-md px-3 py-2.5">
					<div class="text-[22px] text-mono-100 tracking-tight tabular-nums leading-tight">
						{{ detail.stats.quotes }}
					</div>
					<div class="text-[9.5px] tracking-[0.16em] uppercase text-mono-500 mt-1">
						Quotes
					</div>
				</div>
				<div class="bg-mono-800 rounded-md px-3 py-2.5">
					<div class="text-[22px] text-mono-100 tracking-tight tabular-nums leading-tight">
						{{ detail.stats.notes }}
					</div>
					<div class="text-[9.5px] tracking-[0.16em] uppercase text-mono-500 mt-1">
						Notes
					</div>
				</div>
				<div class="bg-mono-800 rounded-md px-3 py-2.5">
					<div class="text-[22px] text-mono-100 tracking-tight tabular-nums leading-tight">
						{{ detail.stats.essays }}
					</div>
					<div class="text-[9.5px] tracking-[0.16em] uppercase text-mono-500 mt-1">
						Cited in
					</div>
				</div>
			</div>

			<!-- Actions -->
			<div class="flex gap-1.5 flex-wrap mb-4">
				<button
					v-if="detail.book.pdf_url"
					@click="openPdf"
					class="px-2.5 py-1 text-[11.5px] border border-mono-700 rounded text-mono-200 hover:bg-mono-800 hover:text-mono-50 cursor-pointer"
				>
					Open PDF
				</button>
				<button
					v-if="isAdmin"
					@click="pickCover"
					:disabled="coverUploading"
					class="px-2.5 py-1 text-[11.5px] border border-mono-700 rounded text-mono-200 hover:bg-mono-800 hover:text-mono-50 cursor-pointer disabled:opacity-50"
				>
					{{
						coverUploading
							? 'Uploading…'
							: detail.book.cover_url
								? 'Replace cover'
								: 'Add cover image'
					}}
				</button>
				<input
					ref="coverInput"
					type="file"
					accept="image/jpeg,image/png,image/webp"
					class="hidden"
					@change="onCoverFile"
				/>
				<button
					v-if="isAdmin"
					@click="emit('edit', detail.book.id)"
					class="px-2.5 py-1 text-[11.5px] border border-mono-700 rounded text-mono-200 hover:bg-mono-800 hover:text-mono-50 cursor-pointer"
				>
					Edit…
				</button>
			</div>

			<!-- Media gallery (any number of images) -->
			<LibraryMediaSection
				:book-id="detail.book.id"
				:media="detail.media"
				:cover-url="detail.book.cover_url"
				:is-admin="isAdmin"
				@changed="handleMediaChanged"
				@set-cover="setMediaAsCover"
				@clear-cover="clearCover"
			/>

			<!-- Latest quotes -->
			<section
				v-if="detail.quotes.length > 0"
				class="pt-4 mt-4 border-t border-mono-800"
			>
				<h5
					class="text-[10.5px] tracking-[0.18em] uppercase text-mono-500 m-0 mb-2.5 font-medium"
				>
					Latest quotes · {{ detail.stats.quotes }}
				</h5>
				<div
					v-for="q in detail.quotes.slice(0, 3)"
					:key="q.id"
					class="flex gap-2 px-2.5 py-1.5 rounded-md text-[12.5px] leading-snug text-mono-300 hover:bg-mono-800 hover:text-mono-100 cursor-pointer"
				>
					<div class="w-0.5 self-stretch shrink-0 bg-accent" />
					<div class="flex-1 min-w-0">
						<span class="italic">"{{ q.quote }}"</span>
						<span
							v-if="q.page"
							class="text-[10.5px] text-mono-600 ml-1 tabular-nums"
						>
							p. {{ q.page }}
						</span>
					</div>
				</div>
				<div
					v-if="detail.quotes.length > 3"
					class="text-[11px] text-mono-500 italic px-2.5 py-1.5"
				>
					+ {{ detail.quotes.length - 3 }} more quotes
				</div>
			</section>

			<!-- Cited in essays -->
			<section
				v-if="detail.essays.length > 0"
				class="pt-4 mt-4 border-t border-mono-800"
			>
				<h5
					class="text-[10.5px] tracking-[0.18em] uppercase text-mono-500 m-0 mb-2.5 font-medium"
				>
					Cited in essays · {{ detail.stats.essays }}
				</h5>
				<div
					v-for="e in detail.essays.slice(0, 3)"
					:key="e.id"
					class="flex gap-2 px-2.5 py-1.5 rounded-md text-[12.5px] leading-snug text-mono-300 hover:bg-mono-800 hover:text-mono-100 cursor-pointer"
				>
					<div class="w-0.5 self-stretch shrink-0 bg-essay" />
					<div class="flex-1 min-w-0 truncate">
						{{ e.title }}
					</div>
				</div>
				<div
					v-if="detail.essays.length > 3"
					class="text-[11px] text-mono-500 italic px-2.5 py-1.5"
				>
					+ {{ detail.essays.length - 3 }} more essays
				</div>
			</section>

			<!-- Related -->
			<section
				v-if="detail.related.length > 0"
				class="pt-4 mt-4 border-t border-mono-800"
			>
				<h5
					class="text-[10.5px] tracking-[0.18em] uppercase text-mono-500 m-0 mb-2.5 font-medium"
				>
					Related books
				</h5>
				<div
					v-for="r in detail.related"
					:key="r.id"
					class="flex gap-2 px-2.5 py-1.5 rounded-md text-[12.5px] leading-snug text-mono-300 hover:bg-mono-800 hover:text-mono-100 cursor-pointer"
				>
					<div class="w-0.5 self-stretch shrink-0 bg-mono-600" />
					<div class="flex-1 min-w-0">
						<span class="italic text-mono-200">{{ r.title }}</span>
						<span class="text-mono-500"> · co-cited {{ r.co_citations }}×</span>
					</div>
				</div>
			</section>
			</div>
		</template>
	</div>
</template>
