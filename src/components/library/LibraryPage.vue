<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import {
	fetchLibraryBooks,
	type LibraryBook,
	type LibraryDecade,
} from '../../lib/api';
import LibraryDetailPane from './LibraryDetailPane.vue';

const props = defineProps<{
	isAdmin?: boolean;
	initialBookId?: string;
}>();

const emit = defineEmits<{
	(e: 'addBook'): void;
	(e: 'editBook', bookId: string): void;
}>();

type DecadeFilter = LibraryDecade | 'any';
type PdfFilter = 'any' | 'yes' | 'no';
type ViewMode = 'author' | 'decade';
type Sort = 'author_az' | 'recent' | 'year';

const search = ref('');
const decade = ref<DecadeFilter>('any');
const pdf = ref<PdfFilter>('any');
const sort = ref<Sort>('author_az');
const view = ref<ViewMode>('author');
const selectedBookId = ref<string | null>(props.initialBookId ?? null);

const books = ref<LibraryBook[]>([]);
const totals = ref({ books: 0, quotes: 0, notes: 0 });
const loading = ref(false);
const error = ref<string | null>(null);

let searchTimer: ReturnType<typeof setTimeout> | null = null;
const debouncedSearch = ref('');
watch(search, (v) => {
	if (searchTimer) clearTimeout(searchTimer);
	searchTimer = setTimeout(() => {
		debouncedSearch.value = v;
	}, 250);
});

async function load() {
	loading.value = true;
	error.value = null;
	try {
		const params: Parameters<typeof fetchLibraryBooks>[0] = { sort: sort.value };
		if (debouncedSearch.value) params.search = debouncedSearch.value;
		if (decade.value !== 'any') params.decade = decade.value;
		if (pdf.value === 'yes') params.has_pdf = true;
		if (pdf.value === 'no') params.has_pdf = false;

		const result = await fetchLibraryBooks(params);
		books.value = result.books;
		totals.value = result.totals;

		if (
			selectedBookId.value &&
			!result.books.find((b) => b.id === selectedBookId.value)
		) {
			selectedBookId.value = result.books[0]?.id ?? null;
		} else if (!selectedBookId.value && result.books.length > 0) {
			selectedBookId.value = result.books[0].id;
		}
	} catch (err) {
		console.error('Failed to load library:', err);
		error.value = 'Failed to load library.';
	} finally {
		loading.value = false;
	}
}

watch([debouncedSearch, decade, pdf, sort], load);
onMounted(load);

interface Group {
	key: string;
	label: string;
	sublabel?: string;
	count: number;
	items: LibraryBook[];
}

const groups = computed<Group[]>(() => {
	if (view.value === 'author') {
		const map = new Map<string, Group>();
		for (const b of books.value) {
			const key = b.author_id || `name:${b.author}`;
			if (!map.has(key)) {
				const lifespan =
					b.author_born || b.author_died
						? `${b.author_born ?? ''}–${b.author_died ?? ''}`
						: undefined;
				map.set(key, {
					key,
					label: b.author,
					sublabel: lifespan,
					count: 0,
					items: [],
				});
			}
			const g = map.get(key)!;
			g.items.push(b);
			g.count += 1;
		}
		return Array.from(map.values());
	}
	const order: LibraryDecade[] = [
		'pre-1900',
		'1900s',
		'2000s',
		'2010s',
		'2020s',
		'unknown',
	];
	const map = new Map<string, Group>();
	for (const d of order)
		map.set(d, { key: d, label: d, count: 0, items: [] });
	for (const b of books.value) {
		const g = map.get(b.decade) ?? map.get('unknown')!;
		g.items.push(b);
		g.count += 1;
	}
	return Array.from(map.values()).filter((g) => g.count > 0);
});

const selectedBook = computed(() =>
	selectedBookId.value
		? books.value.find((b) => b.id === selectedBookId.value) ?? null
		: null
);

function formatYear(b: LibraryBook): string {
	return b.originally_published || '—';
}

function formatActivity(b: LibraryBook): string {
	if (b.citation_count > 0) return `cited ${b.citation_count}× in essays`;
	const created = new Date(b.created_at);
	return `added ${created.toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric',
	})}`;
}

const decadeChips: { key: DecadeFilter; label: string }[] = [
	{ key: 'any', label: 'Any' },
	{ key: 'pre-1900', label: 'pre-1900' },
	{ key: '1900s', label: '1900s' },
	{ key: '2000s', label: '2000s' },
	{ key: '2010s', label: '2010s' },
	{ key: '2020s', label: '2020s' },
];
const pdfChips: { key: PdfFilter; label: string }[] = [
	{ key: 'any', label: 'Any' },
	{ key: 'yes', label: 'Yes' },
	{ key: 'no', label: 'No' },
];
const sortLabels: Record<Sort, string> = {
	author_az: 'Author A→Z',
	recent: 'Recently added',
	year: 'Year',
};

function cycleSort() {
	const order: Sort[] = ['author_az', 'recent', 'year'];
	const i = order.indexOf(sort.value);
	sort.value = order[(i + 1) % order.length];
}

function handleDetailRefresh() {
	load();
}

defineExpose({ reload: load });
</script>

<template>
	<div class="lib-shell bg-mono-900 text-mono-100 flex-1 flex flex-col min-h-0">
		<!-- Hero -->
		<div class="px-7 pt-6 pb-4 border-b border-mono-800 flex flex-col gap-3.5">
			<div class="flex items-center justify-between gap-6">
				<h1 class="text-[22px] font-medium tracking-tight m-0">
					Library
					<span class="text-xs text-mono-500 ml-3 font-normal tabular-nums">
						{{ totals.books }} books · {{ totals.quotes }} quotes ·
						{{ totals.notes }} notes
					</span>
				</h1>
				<div v-if="isAdmin" class="flex gap-2 items-center">
					<button
						class="px-3 py-1.5 border border-mono-700 rounded-md text-xs text-mono-200 hover:bg-mono-800 hover:text-mono-50 cursor-pointer"
					>
						Import…
					</button>
					<button
						class="px-3 py-1.5 bg-essay text-essay-text rounded-md text-xs font-medium hover:bg-essay-bright cursor-pointer"
						@click="emit('addBook')"
					>
						+ Add book
					</button>
				</div>
			</div>

			<!-- Search bar -->
			<div
				class="flex gap-2 items-center bg-mono-800 border border-mono-700 rounded-lg px-3 py-2 focus-within:border-essay"
			>
				<svg
					width="14"
					height="14"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					class="text-mono-500 shrink-0"
				>
					<circle cx="11" cy="11" r="8" />
					<path d="m21 21-4.3-4.3" />
				</svg>
				<input
					v-model="search"
					placeholder="Search title or author…"
					class="flex-1 bg-transparent border-none outline-none text-mono-100 text-sm font-[inherit]"
				/>
				<span
					class="text-[11px] text-mono-500 px-1.5 py-0.5 bg-mono-700 rounded-sm"
				>
					title + author
				</span>
			</div>

			<!-- Filter row -->
			<div class="flex gap-1.5 flex-wrap items-center">
				<span
					class="text-[10.5px] tracking-[0.14em] uppercase text-mono-600 px-1.5"
				>
					Decade
				</span>
				<div
					class="flex gap-0.5 items-center bg-mono-800 border border-mono-800 rounded-md p-0.5"
				>
					<button
						v-for="chip in decadeChips"
						:key="chip.key"
						@click="decade = chip.key"
						class="px-2.5 py-1 text-[11.5px] rounded text-mono-400 cursor-pointer tabular-nums"
						:class="
							decade === chip.key
								? 'bg-mono-700 text-mono-100'
								: 'hover:text-mono-200'
						"
					>
						{{ chip.label }}
					</button>
				</div>

				<span
					class="text-[10.5px] tracking-[0.14em] uppercase text-mono-600 ml-3 px-1.5"
				>
					PDF
				</span>
				<div
					class="flex gap-0.5 items-center bg-mono-800 border border-mono-800 rounded-md p-0.5"
				>
					<button
						v-for="chip in pdfChips"
						:key="chip.key"
						@click="pdf = chip.key"
						class="px-2.5 py-1 text-[11.5px] rounded text-mono-400 cursor-pointer"
						:class="
							pdf === chip.key
								? 'bg-mono-700 text-mono-100'
								: 'hover:text-mono-200'
						"
					>
						{{ chip.label }}
					</button>
				</div>

				<button
					@click="cycleSort"
					class="ml-auto text-[11.5px] text-mono-400 hover:text-mono-200 cursor-pointer"
				>
					sort:
					<b class="text-mono-100 font-medium">{{ sortLabels[sort] }}</b> ▾
				</button>
			</div>
		</div>

		<!-- Three-pane body -->
		<div class="grid lg:grid-cols-[240px_1fr_360px] grid-cols-1 flex-1 min-h-0">
			<!-- Left rail -->
			<aside
				class="border-r border-mono-800 py-3.5 hidden lg:block min-h-0 overflow-y-auto"
			>
				<h4
					class="text-[10.5px] tracking-[0.18em] uppercase text-mono-500 mt-0 mx-3.5 mb-2 font-medium"
				>
					View
				</h4>
				<div
					@click="view = 'author'"
					class="flex items-center gap-2.5 px-4 py-1.5 text-[13px] cursor-pointer border-l-2"
					:class="
						view === 'author'
							? 'bg-mono-800 text-mono-50 border-essay font-medium'
							: 'text-mono-300 border-transparent hover:bg-mono-800 hover:text-mono-100'
					"
				>
					By author
					<span class="ml-auto text-[10.5px] text-mono-600 tabular-nums">
						{{ books.length }}
					</span>
				</div>
				<div
					@click="view = 'decade'"
					class="flex items-center gap-2.5 px-4 py-1.5 text-[13px] cursor-pointer border-l-2"
					:class="
						view === 'decade'
							? 'bg-mono-800 text-mono-50 border-essay font-medium'
							: 'text-mono-300 border-transparent hover:bg-mono-800 hover:text-mono-100'
					"
				>
					By decade
					<span class="ml-auto text-[10.5px] text-mono-600 tabular-nums">
						{{ books.length }}
					</span>
				</div>
			</aside>

			<!-- Center list -->
			<main class="py-1 min-h-0 overflow-y-auto">
				<div
					v-if="loading && books.length === 0"
					class="py-16 text-center text-mono-600 text-sm uppercase tracking-widest"
				>
					Loading library…
				</div>
				<div
					v-else-if="error"
					class="py-16 text-center text-rose-bright text-sm"
				>
					{{ error }}
				</div>
				<div
					v-else-if="books.length === 0"
					class="py-16 text-center text-mono-600 text-sm"
				>
					No books match.
				</div>

				<div
					v-for="g in groups"
					:key="g.key"
					class="border-b border-mono-800"
				>
					<div class="flex items-baseline gap-3.5 px-7 pt-4 pb-1.5">
						<span class="text-[17px] font-medium tracking-tight text-mono-100">
							{{ g.label }}
						</span>
						<span
							v-if="g.sublabel"
							class="text-[11px] text-mono-500 italic tabular-nums"
						>
							{{ g.sublabel }}
						</span>
						<span
							class="ml-auto text-[11px] text-mono-600 tabular-nums"
						>
							{{ g.count }}
							{{ g.count === 1 ? 'book' : 'books' }}
						</span>
					</div>
					<div
						v-for="b in g.items"
						:key="b.id"
						@click="selectedBookId = b.id"
						class="grid grid-cols-[56px_1fr_auto_auto] items-baseline gap-3.5 px-7 py-2 cursor-pointer border-l-[3px] transition-colors"
						:class="
							selectedBookId === b.id
								? 'bg-mono-800 border-essay'
								: 'border-transparent hover:bg-mono-800'
						"
					>
						<span class="text-xs text-mono-500 tabular-nums">
							{{ formatYear(b) }}
						</span>
						<span
							class="text-[14.5px] italic text-mono-100 truncate"
							:title="b.title"
						>
							{{ b.title }}
						</span>
						<span
							class="flex gap-2 items-center text-[10.5px] text-mono-500 tabular-nums"
						>
							<span>{{ b.quote_count }} q</span>
							<span>{{ b.note_count }} n</span>
							<span
								v-if="b.has_pdf"
								class="text-highlight"
								>PDF</span
							>
							<span v-else class="text-mono-700 italic">no pdf</span>
							<span
								v-if="b.media_count > 0"
								class="text-mono-400"
								:title="`${b.media_count} attached image(s)`"
							>
								{{ b.media_count }}🖼
							</span>
						</span>
						<span class="text-[10px] text-mono-700 tabular-nums italic">
							{{ formatActivity(b) }}
						</span>
					</div>
				</div>
			</main>

			<!-- Right detail -->
			<aside
				class="border-l border-mono-800 min-h-0 overflow-y-auto"
			>
				<LibraryDetailPane
					v-if="selectedBookId"
					:book-id="selectedBookId"
					:is-admin="isAdmin"
					@edit="emit('editBook', $event)"
					@refresh="handleDetailRefresh"
				/>
				<div
					v-else
					class="py-16 px-6 text-center text-mono-600 text-sm"
				>
					Select a book to see its detail.
				</div>
			</aside>
		</div>
	</div>
</template>
