<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import type { Book, EssayReferenceInput } from '../../lib/api';
import { bookHue } from '../../composables/useBookHue';
import { useSourceLibrary } from '../../composables/useSourceLibrary';
import BottomSheet from '../shared/BottomSheet.vue';

/**
 * The book picker sheet.
 *
 * Quotes used to share this sheet; they moved to EssayQuoteModal, a centred
 * dialog that writes a quote and attributes it through the app's shared
 * SourceSelector. What is left here only picks a book you already have, which
 * a sheet does well — browse by author, cover optional.
 */
const props = defineProps<{
	isOpen: boolean;
	/** Kept for the room's call site; the sheet only handles books now. */
	initialKind?: 'book';
}>();

const emit = defineEmits<{
	(e: 'close'): void;
	(e: 'select', ref: EssayReferenceInput): void;
}>();

const { books, authors, loading, ensureLoaded } = useSourceLibrary();

const search = ref('');
const selectedAuthorId = ref<string | null>(null);

watch(
	() => props.isOpen,
	async (open) => {
		if (!open) return;
		search.value = '';
		await ensureLoaded();
		if (authors.value.length && !selectedAuthorId.value) {
			selectedAuthorId.value = authors.value[0].id;
		}
	},
	// Immediate: an already-open sheet has no false → true edge to load on.
	{ immediate: true }
);

const booksByAuthor = computed(() => {
	const map = new Map<string, Book[]>();
	for (const book of books.value) {
		if (!book.author_id) continue;
		const list = map.get(book.author_id) || [];
		list.push(book);
		map.set(book.author_id, list);
	}
	return map;
});

const filteredAuthors = computed(() => {
	const q = search.value.toLowerCase().trim();
	return authors.value
		.filter((a) => booksByAuthor.value.has(a.id))
		.filter((a) => {
			if (!q) return true;
			if (a.name.toLowerCase().includes(q)) return true;
			return (booksByAuthor.value.get(a.id) || []).some((b) => b.title.toLowerCase().includes(q));
		});
});

const filteredBooks = computed(() => {
	if (!selectedAuthorId.value) return [];
	const list = booksByAuthor.value.get(selectedAuthorId.value) || [];
	const q = search.value.toLowerCase().trim();
	if (!q) return list;
	return list.filter((b) => b.title.toLowerCase().includes(q));
});

watch(search, () => {
	if (filteredAuthors.value.length && !filteredAuthors.value.find((a) => a.id === selectedAuthorId.value)) {
		selectedAuthorId.value = filteredAuthors.value[0].id;
	}
});

function selectBook(b: Book) {
	emit('select', { entity_type: 'book_cover', entity_id: b.id });
	emit('close');
}
</script>

<template>
	<BottomSheet
		:is-open="isOpen"
		panel-class="bg-black rounded-t-[22px] border border-b-0 border-mono-800 shadow-[0_-28px_80px_rgba(0,0,0,0.9)]"
		@close="emit('close')"
	>
		<div class="sh">
			<h3>Book</h3>
			<button type="button" class="x" aria-label="Close" @click="emit('close')">✕</button>
		</div>

		<div class="body">
			<div class="srch">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
				<input v-model="search" placeholder="Search title or author…" autocomplete="off" />
			</div>
			<div v-if="loading && !books.length" class="empty">Loading…</div>
			<div v-else class="bookcols">
				<div class="authors">
					<button
						v-for="a in filteredAuthors"
						:key="a.id"
						type="button"
						class="arow"
						:class="{ on: selectedAuthorId === a.id }"
						@click="selectedAuthorId = a.id"
					>
						<span class="an">{{ a.name }}</span>
						<span class="ac">{{ (booksByAuthor.get(a.id) || []).length }}</span>
					</button>
				</div>
				<div class="bookl">
					<button v-for="b in filteredBooks" :key="b.id" type="button" class="brow" @click="selectBook(b)">
						<span class="tick" :style="{ background: bookHue(b.id) }"></span>
						<span class="bb">
							<span class="bt">{{ b.title }}</span>
							<span v-if="b.originally_published" class="by">{{ b.originally_published }}</span>
						</span>
						<span v-if="!b.cover_url" class="nocov" title="No cover uploaded; renders as text on the slide">text only</span>
					</button>
					<div v-if="!filteredBooks.length" class="empty">No books</div>
				</div>
			</div>
		</div>
	</BottomSheet>
</template>

<style scoped>
.sh {
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 4px 14px 8px;
}
.sh h3 {
	flex: 1;
	margin: 0;
	font-size: 15px;
	font-weight: 500;
	color: var(--color-mono-50);
}
.x {
	width: 32px;
	height: 32px;
	border: none;
	border-radius: 8px;
	background: var(--color-mono-800);
	color: var(--color-mono-300);
	font-size: 13px;
	cursor: pointer;
}
.body {
	max-height: 62vh;
	overflow-y: auto;
	padding: 0 14px calc(14px + env(safe-area-inset-bottom));
}
.srch {
	position: relative;
	margin-bottom: 8px;
}
.srch svg {
	position: absolute;
	left: 11px;
	top: 50%;
	transform: translateY(-50%);
	width: 13px;
	height: 13px;
	color: var(--color-mono-500);
}
.srch input {
	width: 100%;
	padding: 9px 11px 9px 32px;
	background: #0b0a0e;
	border: 1px solid var(--color-mono-800);
	border-radius: 10px;
	font: inherit;
	font-size: 16px;
	color: var(--color-mono-50);
	outline: none;
}
@media (min-width: 641px) {
	.srch input {
		font-size: 13px;
	}
}
.srch input:focus {
	border-color: var(--color-essay);
}
.empty {
	padding: 22px 6px;
	text-align: center;
	font-size: 12.5px;
	color: var(--color-mono-500);
}
.bookcols {
	display: flex;
	min-height: 260px;
}
.authors {
	flex: 0 0 142px;
	border-right: 1px solid var(--color-mono-800);
	padding-right: 6px;
}
.arow {
	display: flex;
	align-items: center;
	gap: 6px;
	width: 100%;
	text-align: left;
	border: none;
	background: transparent;
	font: inherit;
	font-size: 12px;
	color: var(--color-mono-300);
	padding: 8px 9px;
	border-radius: 9px;
	cursor: pointer;
}
.arow:hover,
.arow.on {
	background: #14100a;
	color: var(--color-mono-50);
}
.arow .an {
	flex: 1;
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}
.arow .ac {
	flex: 0 0 auto;
	font-size: 9px;
	color: var(--color-mono-500);
}
.bookl {
	flex: 1;
	min-width: 0;
	padding-left: 6px;
}
.brow {
	display: flex;
	align-items: center;
	gap: 9px;
	width: 100%;
	text-align: left;
	border: none;
	background: transparent;
	font: inherit;
	padding: 9px;
	border-radius: 9px;
	cursor: pointer;
}
.brow:hover {
	background: #14100a;
}
.brow .tick {
	flex: 0 0 3px;
	height: 28px;
	border-radius: 2px;
}
.bb {
	flex: 1;
	min-width: 0;
	display: flex;
	flex-direction: column;
}
.bt {
	font-size: 12.5px;
	font-style: italic;
	color: var(--color-mono-50);
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}
.by {
	font-size: 10px;
	color: var(--color-mono-500);
}
.nocov {
	flex: 0 0 auto;
	font-size: 9px;
	letter-spacing: 0.1em;
	text-transform: uppercase;
	color: var(--color-mono-600);
}
</style>
