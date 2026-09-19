<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue';
import type { LibraryBook } from '../../lib/api';
import { NATURAL_DIR, filterBooks, sortBooks, toRows, type SortDir, type SortKey } from '../../lib/library';
import { useLibrary } from '../../composables/useLibrary';
import BookRow from './BookRow.vue';
import BookSheet from './BookSheet.vue';

defineProps<{
	isAdmin?: boolean;
}>();

const { books, totals, cold, loading, error, truncated, pendingAuthorId, load, patchBook } = useLibrary();

// ── Finding a book ───────────────────────────────────────────────────────
const query = ref('');
const pdfOnly = ref(false);
const writingOnly = ref(false);

const SORT_KEY = 'stylus.library.sort';
function readSort(): { key: SortKey; dir: SortDir } {
	try {
		const saved = JSON.parse(localStorage.getItem(SORT_KEY) ?? 'null');
		if (saved && saved.key in NATURAL_DIR && (saved.dir === 'asc' || saved.dir === 'desc')) return saved;
	} catch {
		// Fall through to the default.
	}
	return { key: 'author', dir: 'asc' };
}
const sort = ref(readSort());
watch(sort, (s) => {
	try {
		localStorage.setItem(SORT_KEY, JSON.stringify(s));
	} catch {
		// A private window just forgets the choice.
	}
});

function sortBy(key: SortKey) {
	sort.value =
		sort.value.key === key
			? { key, dir: sort.value.dir === 'asc' ? 'desc' : 'asc' }
			: { key, dir: NATURAL_DIR[key] };
}

const SORTS: { key: SortKey; label: string }[] = [
	{ key: 'author', label: 'Author' },
	{ key: 'title', label: 'Title' },
	{ key: 'year', label: 'Year' },
	{ key: 'writing', label: 'Writing' },
	{ key: 'added', label: 'Added' },
];
/** The desk's column heads, in the order a row lays its cells out. */
const COLUMNS = (['title', 'author', 'year', 'writing', 'added'] as const).map((k) => SORTS.find((s) => s.key === k)!);

const visible = computed(() =>
	sortBooks(filterBooks(books.value, { query: query.value, pdf: pdfOnly.value, writing: writingOnly.value }), sort.value.key, sort.value.dir)
);
const rows = computed(() => toRows(visible.value, sort.value.key));
const filtering = computed(() => !!query.value.trim() || pdfOnly.value || writingOnly.value);

function clearFilters() {
	query.value = '';
	pdfOnly.value = false;
	writingOnly.value = false;
}

// ── The book sheet ───────────────────────────────────────────────────────
const sheetId = ref<string | null>(null);
const sheetMode = ref<'view' | 'edit' | 'new' | null>(null);
const newTitle = ref('');
const sheetBook = computed(() => books.value.find((b) => b.id === sheetId.value) ?? null);

function openBook(book: LibraryBook) {
	sheetId.value = book.id;
	sheetMode.value = 'view';
}

function addBook(title = '') {
	sheetId.value = null;
	newTitle.value = title;
	sheetMode.value = 'new';
}

function closeSheet() {
	sheetMode.value = null;
}

/** The row that just changed, glowing as it settles. */
const freshId = ref<string | null>(null);
let freshTimer: ReturnType<typeof setTimeout>;

async function onSaved(bookId: string, patch: Partial<LibraryBook>, created: boolean) {
	if (created) {
		sheetMode.value = null;
		// A new book lands where it belongs, not where the search left it.
		clearFilters();
	} else {
		patchBook(bookId, patch);
		sheetMode.value = 'view';
	}
	await load();
	freshId.value = bookId;
	clearTimeout(freshTimer);
	freshTimer = setTimeout(() => (freshId.value = null), 2400);
	await nextTick();
	document.querySelector(`[data-book="${bookId}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

// ── Loading: a skeleton once, a reveal once, silent after that ───────────
const revealing = ref(false);
watch(cold, (isCold, wasCold) => {
	if (wasCold && !isCold) {
		revealing.value = true;
		setTimeout(() => (revealing.value = false), 900);
	}
});

onMounted(() => {
	load();
	document.addEventListener('keydown', onGlobalKey);
});
onBeforeUnmount(() => document.removeEventListener('keydown', onGlobalKey));

// Another tab asked to land on an author: search for them.
watch(
	[pendingAuthorId, books],
	([authorId]) => {
		if (!authorId || !books.value.length) return;
		const match = books.value.find((b) => b.author_id === authorId);
		if (match) {
			clearFilters();
			query.value = match.author;
		}
		pendingAuthorId.value = null;
	},
	{ immediate: true }
);

// ── Keys: / to search, Esc to clear, Enter to open the only match ────────
const searchEl = ref<HTMLInputElement | null>(null);

function onGlobalKey(e: KeyboardEvent) {
	if (e.key !== '/' || sheetMode.value) return;
	const t = e.target as HTMLElement | null;
	if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
	e.preventDefault();
	searchEl.value?.focus();
}

function onSearchKey(e: KeyboardEvent) {
	if (e.key === 'Escape') {
		if (query.value) query.value = '';
		else searchEl.value?.blur();
	} else if (e.key === 'Enter' && rows.value.length === 1) {
		searchEl.value?.blur();
		openBook(rows.value[0].book);
	}
}

// ── Words ────────────────────────────────────────────────────────────────
const plural = (n: number, one: string, many: string) => `${n.toLocaleString()} ${n === 1 ? one : many}`;
</script>

<template>
	<div class="lib">
		<!-- Front desk -->
		<header class="head">
			<div class="mast">
				<h2 class="wordmark">Library</h2>
				<button v-if="isAdmin" type="button" class="add" @click="addBook()">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
					Add a book
				</button>
			</div>
			<p class="census" :class="{ ready: !cold }">
				<template v-if="!cold">
					<b>{{ plural(totals.books, 'book', 'books') }}</b>, holding
					<b>{{ plural(totals.quotes, 'quote', 'quotes') }}</b> and
					<b>{{ plural(totals.notes, 'note', 'notes') }}</b>
				</template>
				<template v-else>&nbsp;</template>
			</p>
		</header>

		<!-- Search and sort: stays with you down the list -->
		<div class="bar">
			<div class="bar-inner">
				<label class="search">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
					<input
						ref="searchEl"
						v-model="query"
						type="search"
						placeholder="Search by title or author"
						aria-label="Search the library"
						autocomplete="off"
						enterkeyhint="search"
						@keydown="onSearchKey"
					/>
					<button v-if="query" type="button" class="clear" aria-label="Clear search" @click="query = ''; searchEl?.focus()">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M7 7l10 10M17 7 7 17" /></svg>
					</button>
					<kbd v-else class="slash" aria-hidden="true">/</kbd>
				</label>

				<div class="controls">
					<!-- Phone: the OS picker for the sort, and a turn for its direction.
					     On a desk the column heads do both. -->
					<div class="sorter">
						<label class="picker">
							<span class="picker-label">{{ SORTS.find((s) => s.key === sort.key)?.label }}</span>
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m7 10 5 5 5-5" /></svg>
							<select :value="sort.key" aria-label="Sort by" @change="sortBy(($event.target as HTMLSelectElement).value as SortKey)">
								<option v-for="s in SORTS" :key="s.key" :value="s.key">{{ s.label }}</option>
							</select>
						</label>
						<button
							type="button"
							class="turn"
							:aria-label="sort.dir === 'asc' ? 'Ascending — reverse' : 'Descending — reverse'"
							@click="sortBy(sort.key)"
						>
							<span class="dir" :class="sort.dir" aria-hidden="true"></span>
						</button>
					</div>
					<span class="spacer"></span>
					<button type="button" class="chip" :class="{ on: pdfOnly }" :aria-pressed="pdfOnly" @click="pdfOnly = !pdfOnly">Has a PDF</button>
					<button type="button" class="chip" :class="{ on: writingOnly }" :aria-pressed="writingOnly" @click="writingOnly = !writingOnly">Has writing</button>
				</div>
			</div>
			<span class="refresh" :class="{ on: loading && !cold }" aria-hidden="true"></span>
		</div>

		<main class="shelf">
			<!-- Column heads: the sort, on a wide screen -->
			<div class="cols" role="group" aria-label="Sort by">
				<button
					v-for="s in COLUMNS"
					:key="s.key"
					type="button"
					class="col"
					:class="[`col-${s.key}`, { on: sort.key === s.key }]"
					:aria-pressed="sort.key === s.key"
					@click="sortBy(s.key)"
				>
					{{ s.label }}<span v-if="sort.key === s.key" class="dir" :class="sort.dir" aria-hidden="true"></span>
				</button>
				<span class="col col-pdf">PDF</span>
			</div>

			<p v-if="filtering && !cold && rows.length" class="tally">
				{{ rows.length === books.length ? 'All' : rows.length }} of {{ plural(books.length, 'book', 'books') }}
			</p>
			<p v-if="truncated && query" class="note">Search covers the first {{ books.length.toLocaleString() }} books.</p>
			<p v-if="error && !cold" class="note">
				Showing the library as it was — it couldn’t be refreshed.
				<button type="button" class="inline" @click="load()">Try again</button>
			</p>

			<!-- First load only: rows in outline -->
			<div v-if="cold && !error" class="skeleton" aria-busy="true" aria-label="Loading the library">
				<div v-for="i in 12" :key="i" class="ghost" :style="{ '--w': `${[62, 48, 71, 55, 40, 66, 52, 74, 45, 58, 69, 50][i - 1]}%` }">
					<span class="g-title"></span>
					<span class="g-author"></span>
					<span class="g-year"></span>
					<span class="g-writing"></span>
					<span class="g-added"></span>
				</div>
			</div>

			<div v-else-if="cold && error" class="empty">
				<p>{{ error }} Check your connection, then try again.</p>
				<button type="button" class="action" @click="load()">Try again</button>
			</div>

			<div v-else-if="!books.length" class="empty">
				<p>Your library is empty. Add the first book you’re reading.</p>
				<button v-if="isAdmin" type="button" class="action" @click="addBook()">Add a book</button>
			</div>

			<div v-else-if="!rows.length" class="empty">
				<p v-if="query.trim()">Nothing matches “{{ query.trim() }}”{{ pdfOnly || writingOnly ? ' with these filters' : '' }}.</p>
				<p v-else>No books match these filters.</p>
				<div class="empty-actions">
					<button v-if="isAdmin && query.trim()" type="button" class="action" @click="addBook(query.trim())">Add “{{ query.trim() }}” as a book</button>
					<button type="button" class="inline" @click="clearFilters()">Clear {{ query.trim() && (pdfOnly || writingOnly) ? 'search and filters' : query.trim() ? 'search' : 'filters' }}</button>
				</div>
			</div>

			<TransitionGroup v-else tag="div" name="glide" class="rows" :class="{ revealing }">
				<BookRow
					v-for="(r, i) in rows"
					:key="r.book.id"
					:data-book="r.book.id"
					:book="r.book"
					:query="query"
					:starts-run="r.startsRun"
					:open="sheetMode !== null && sheetId === r.book.id"
					:fresh="freshId === r.book.id"
					:style="revealing ? { animationDelay: `${Math.min(i, 16) * 26}ms` } : undefined"
					@open="openBook"
				/>
			</TransitionGroup>
		</main>

		<BookSheet
			:book="sheetBook"
			:mode="sheetMode"
			:is-admin="isAdmin"
			:initial-title="newTitle"
			@close="closeSheet"
			@mode="(m) => (sheetMode = m)"
			@saved="onSaved"
		/>
	</div>
</template>

<style scoped>
.lib {
	--lib-cols: minmax(0, 2.3fr) minmax(0, 1.5fr) 52px 150px 100px 32px;
	--lib-gap: 22px;
	--parchment: #e8d0a8;
	width: 100%;
	max-width: 1120px;
	margin: 0 auto;
	padding-bottom: calc(80px + env(safe-area-inset-bottom));
}

/* ── Front desk: the Notes wordmark, with a census beneath ────────────── */
.head {
	display: flex;
	flex-direction: column;
	align-items: center;
	text-align: center;
	padding: 12px 16px 0;
}
.mast {
	display: flex;
	align-items: center;
	gap: 14px;
}
.wordmark {
	margin: 0;
	font-size: 26px;
	font-weight: 600;
	letter-spacing: -0.025em;
	color: #fff;
	user-select: none;
}
.add {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	padding: 6px 11px 6px 9px;
	border: 1px solid rgb(232 208 168 / 0.3);
	border-radius: 9px;
	background: none;
	font: inherit;
	font-size: 13.5px;
	color: var(--parchment);
	cursor: pointer;
	transition:
		background-color 0.18s ease,
		border-color 0.18s ease;
}
.add svg {
	width: 14px;
	height: 14px;
}
@media (hover: hover) {
.add:hover {
	background: rgb(232 208 168 / 0.08);
	border-color: rgb(232 208 168 / 0.55);
}
}
.census {
	margin: 8px 0 0;
	min-height: 1.4em;
	font-size: 13.5px;
	font-style: italic;
	color: var(--color-mono-400);
	opacity: 0;
	transition: opacity 0.5s ease;
}
.census.ready {
	opacity: 1;
}
.census b {
	font-style: normal;
	font-weight: 500;
	color: var(--parchment);
	font-variant-numeric: lining-nums;
}

/* ── The bar ──────────────────────────────────────────────────────────── */
.bar {
	position: sticky;
	top: 0;
	z-index: 20;
	padding: 12px 16px 8px;
	background: linear-gradient(to bottom, var(--color-mono-950) calc(100% - 10px), rgb(5 5 5 / 0));
}
.bar-inner {
	max-width: 680px;
	margin: 0 auto;
}
.search {
	display: flex;
	align-items: center;
	gap: 10px;
	height: 46px;
	padding: 0 8px 0 14px;
	background: var(--color-mono-900);
	border: 1px solid var(--color-mono-800);
	border-radius: 12px;
	transition:
		border-color 0.2s ease,
		box-shadow 0.2s ease;
}
.search:focus-within {
	border-color: rgb(232 208 168 / 0.55);
	box-shadow: 0 0 0 4px rgb(232 208 168 / 0.07);
}
.search > svg {
	width: 17px;
	height: 17px;
	flex-shrink: 0;
	color: var(--color-mono-500);
}
.search input {
	flex: 1;
	min-width: 0;
	height: 100%;
	border: none;
	outline: none;
	background: none;
	font: inherit;
	font-size: 16px;
	color: #fff;
}
.search input::placeholder {
	color: var(--color-mono-500);
	font-style: italic;
}
.search input::-webkit-search-cancel-button {
	display: none;
}
.clear {
	width: 32px;
	height: 32px;
	display: grid;
	place-items: center;
	border: none;
	border-radius: 8px;
	background: none;
	color: var(--color-mono-400);
	cursor: pointer;
}
.clear svg {
	width: 16px;
	height: 16px;
}
.clear:hover {
	color: #fff;
	background: rgb(255 255 255 / 0.06);
}
.slash {
	display: none;
	margin-right: 6px;
	padding: 1px 7px;
	border: 1px solid var(--color-mono-700);
	border-radius: 5px;
	font: inherit;
	font-size: 12px;
	color: var(--color-mono-500);
}

.controls {
	display: flex;
	align-items: center;
	gap: 6px;
	margin-top: 10px;
	overflow-x: auto;
	scrollbar-width: none;
	-webkit-overflow-scrolling: touch;
	mask-image: linear-gradient(to right, #000 92%, transparent);
}
.controls::-webkit-scrollbar {
	display: none;
}
.spacer {
	flex: 1;
	min-width: 6px;
}
.sorter {
	display: flex;
	align-items: center;
	flex-shrink: 0;
	height: 34px;
	border-radius: 999px;
	background: rgb(255 255 255 / 0.07);
}
.picker {
	position: relative;
	display: inline-flex;
	align-items: center;
	gap: 4px;
	height: 100%;
	padding: 0 6px 0 13px;
	font-size: 14px;
	color: #fff;
}
.picker svg {
	width: 14px;
	height: 14px;
	color: var(--color-mono-400);
}
.picker select {
	position: absolute;
	inset: 0;
	width: 100%;
	opacity: 0;
	font-size: 16px;
	cursor: pointer;
}
.turn {
	display: grid;
	place-items: center;
	width: 34px;
	height: 100%;
	padding: 0;
	border: none;
	border-left: 1px solid rgb(255 255 255 / 0.08);
	background: none;
	color: #fff;
	cursor: pointer;
}
.chip {
	flex-shrink: 0;
	display: inline-flex;
	align-items: center;
	height: 34px;
	padding: 0 12px;
	border-radius: 999px;
	border: 1px solid transparent;
	background: none;
	font: inherit;
	font-size: 14px;
	color: rgb(255 255 255 / 0.55);
	cursor: pointer;
	white-space: nowrap;
	transition:
		color 0.2s ease,
		background-color 0.2s ease,
		border-color 0.2s ease;
}
@media (hover: hover) {
	.chip:hover {
		color: #fff;
	}
}
.chip {
	border-color: var(--color-mono-800);
}
.chip.on {
	color: var(--parchment);
	border-color: rgb(232 208 168 / 0.45);
	background: rgb(232 208 168 / 0.08);
}
.dir {
	width: 0;
	height: 0;
	border-left: 3.5px solid transparent;
	border-right: 3.5px solid transparent;
	border-top: 4.5px solid currentColor;
	opacity: 0.7;
	transition: transform 0.25s ease;
}
.dir.asc {
	transform: rotate(180deg);
}

/* Revalidating behind a list you can already use: one quiet line. */
.refresh {
	position: absolute;
	left: 50%;
	bottom: 2px;
	width: 120px;
	height: 1px;
	margin-left: -60px;
	opacity: 0;
	background: linear-gradient(90deg, transparent, var(--parchment), transparent);
	transition: opacity 0.3s ease;
}
.refresh.on {
	opacity: 0.55;
	animation: sweep 1.2s ease-in-out infinite;
}
@keyframes sweep {
	from {
		transform: translateX(-160px);
	}
	to {
		transform: translateX(160px);
	}
}

/* ── The shelf ────────────────────────────────────────────────────────── */
.shelf {
	position: relative;
}
.cols {
	display: none;
}
.tally,
.note {
	margin: 2px 16px 8px;
	font-size: 13px;
	font-style: italic;
	color: var(--color-mono-500);
}
.rows {
	position: relative;
}

/* Rows glide to their new places; arrivals fade up; departures step out of
   the flow so the rest can close ranks around them. */
.rows :deep(.glide-move) {
	transition:
		transform 0.5s cubic-bezier(0.22, 1, 0.36, 1),
		background-color 0.18s ease;
}
.rows :deep(.glide-enter-active) {
	transition:
		opacity 0.35s ease,
		transform 0.45s cubic-bezier(0.22, 1, 0.36, 1),
		background-color 0.18s ease;
}
.rows :deep(.glide-enter-from) {
	opacity: 0;
	transform: translateY(6px);
}
.rows :deep(.glide-leave-active) {
	position: absolute;
	left: 0;
	right: 0;
	transition: opacity 0.2s ease;
}
.rows :deep(.glide-leave-to) {
	opacity: 0;
}
/* The first reveal, once: rows arrive top to bottom. */
.rows.revealing :deep(.row) {
	animation: rise 0.55s cubic-bezier(0.22, 1, 0.36, 1) both;
}
@keyframes rise {
	from {
		opacity: 0;
		transform: translateY(8px);
	}
}

/* ── Outline while the first load is out ──────────────────────────────── */
.ghost {
	display: grid;
	grid-template-columns: 1fr;
	gap: 8px;
	padding: 14px 16px;
	border-bottom: 1px solid rgb(255 255 255 / 0.045);
}
.ghost span {
	display: block;
	height: 12px;
	border-radius: 4px;
	background: linear-gradient(90deg, rgb(255 255 255 / 0.045) 0%, rgb(255 255 255 / 0.085) 50%, rgb(255 255 255 / 0.045) 100%);
	background-size: 200% 100%;
	animation: sheen 1.6s ease-in-out infinite;
}
.g-title {
	width: var(--w);
	height: 14px !important;
}
.g-author {
	width: calc(var(--w) * 0.55);
}
.g-year,
.g-writing,
.g-added {
	display: none !important;
}
@keyframes sheen {
	from {
		background-position: 100% 0;
	}
	to {
		background-position: -100% 0;
	}
}

/* ── When there is nothing to show ────────────────────────────────────── */
.empty {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 16px;
	padding: 64px 24px;
	text-align: center;
}
.empty p {
	margin: 0;
	max-width: 36ch;
	font-size: 16px;
	font-style: italic;
	line-height: 1.45;
	color: var(--color-mono-300);
}
.empty-actions {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 12px;
}
.action {
	min-height: 44px;
	padding: 0 18px;
	border: none;
	border-radius: 10px;
	background: var(--parchment);
	color: #1a1408;
	font: inherit;
	font-size: 15px;
	font-weight: 600;
	cursor: pointer;
}
.inline {
	padding: 0;
	border: none;
	background: none;
	font: inherit;
	font-size: inherit;
	font-style: normal;
	color: var(--parchment);
	cursor: pointer;
	text-decoration: underline;
	text-decoration-color: rgb(232 208 168 / 0.35);
	text-underline-offset: 3px;
}

/* ── A desk: the catalogue as an index ────────────────────────────────── */
@media (min-width: 768px) {
	.head {
		padding-top: 30px;
	}
	.bar {
		padding: 18px 32px 12px;
	}
	.slash {
		display: inline-block;
	}
	.sorter {
		display: none;
	}
	.controls {
		justify-content: center;
		mask-image: none;
	}
	.spacer {
		display: none;
	}
	.shelf {
		padding: 0 32px;
	}
	.cols {
		display: grid;
		grid-template-columns: var(--lib-cols);
		column-gap: var(--lib-gap);
		padding: 14px 14px 8px;
		border-bottom: 1px solid rgb(255 255 255 / 0.08);
	}
	.col {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 0;
		border: none;
		background: none;
		font: inherit;
		font-size: 13px;
		color: var(--color-mono-500);
		cursor: pointer;
		text-align: left;
		transition: color 0.2s ease;
	}
	.col:hover,
	.col.on {
		color: #fff;
	}
	.col-pdf {
		cursor: default;
		justify-content: flex-end;
		color: var(--color-mono-600);
	}
	.col-pdf:hover {
		color: var(--color-mono-600);
	}
	.tally,
	.note {
		margin: 10px 14px 4px;
	}
	.ghost {
		grid-template-columns: var(--lib-cols);
		column-gap: var(--lib-gap);
		align-items: center;
		padding: 13px 14px;
	}
	.g-title {
		width: var(--w);
	}
	.g-author {
		width: 60%;
	}
	.g-year {
		display: block !important;
		width: 34px;
	}
	.g-writing {
		display: block !important;
		width: 70%;
	}
	.g-added {
		display: block !important;
		width: 60%;
	}
}

@media (prefers-reduced-motion: reduce) {
	.rows.revealing :deep(.row),
	.ghost span,
	.refresh.on {
		animation: none;
	}
	.rows :deep(.glide-move),
	.rows :deep(.glide-enter-active) {
		transition: none;
	}
}
</style>
