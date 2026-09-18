<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { fetchNotes, fetchQuotes, type BookDetail, type LibraryBook } from '../../lib/api';
import { formatMarkdown } from '../../lib/formatText';

/**
 * Everything written from one book: its quotes and its notes.
 *
 * The counts come from the catalogue row, so the switch between them is there
 * the moment the sheet opens; the entries stream in beneath it. The detail
 * endpoint returns the fifty most recent of each — past that, the rest load on
 * request rather than on every open.
 */
const props = defineProps<{
	book: LibraryBook;
	detail: BookDetail | null;
}>();

type Kind = 'quotes' | 'notes';
interface Entry {
	id: string;
	html: string;
	page: string | null;
	date: string;
}

const kind = ref<Kind>(props.book.quote_count || !props.book.note_count ? 'quotes' : 'notes');
watch(
	() => props.book.id,
	() => {
		kind.value = props.book.quote_count || !props.book.note_count ? 'quotes' : 'notes';
		full.value = { quotes: null, notes: null };
	}
);

const full = ref<{ quotes: Entry[] | null; notes: Entry[] | null }>({ quotes: null, notes: null });
const loadingAll = ref(false);

function dateOf(iso: string): string {
	return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const counts = computed(() => ({
	quotes: props.detail?.stats.quotes ?? props.book.quote_count,
	notes: props.detail?.stats.notes ?? props.book.note_count,
}));

const entries = computed<Entry[] | null>(() => {
	if (full.value[kind.value]) return full.value[kind.value];
	if (!props.detail) return null;
	return kind.value === 'quotes'
		? props.detail.quotes.map((q) => ({ id: q.id, html: formatMarkdown(q.quote), page: q.page, date: dateOf(q.created_at) }))
		: props.detail.notes.map((n) => ({ id: n.id, html: formatMarkdown(n.content), page: n.page, date: dateOf(n.created_at) }));
});

const hiddenCount = computed(() => {
	if (!entries.value || full.value[kind.value]) return 0;
	return Math.max(0, counts.value[kind.value] - entries.value.length);
});

async function loadAll() {
	loadingAll.value = true;
	try {
		if (kind.value === 'quotes') {
			const quotes = await fetchQuotes({ book_id: props.book.id, latest_only: 1, limit: 2000 });
			full.value.quotes = quotes.map((q) => ({ id: q.id, html: formatMarkdown(q.quote), page: q.page ?? null, date: dateOf(q.created_at) }));
		} else {
			const { data } = await fetchNotes({ book_id: props.book.id, limit: 2000 });
			// An edited note is a new row that `replaces` the old one; show only
			// the latest of each, as everywhere else.
			const replaced = new Set(data.map((n) => n.replaces).filter(Boolean));
			full.value.notes = data
				.filter((n) => !replaced.has(n.id))
				.map((n) => ({ id: n.id, html: formatMarkdown(n.content), page: n.page ?? null, date: dateOf(n.created_at) }));
		}
	} catch (err) {
		console.error('Failed to load all writing:', err);
	} finally {
		loadingAll.value = false;
	}
}

const copied = ref<string | null>(null);
let copiedTimer: ReturnType<typeof setTimeout>;
async function copy(entry: Entry) {
	const text = new DOMParser().parseFromString(entry.html, 'text/html').body.textContent ?? '';
	try {
		await navigator.clipboard.writeText(text);
		copied.value = entry.id;
		clearTimeout(copiedTimer);
		copiedTimer = setTimeout(() => (copied.value = null), 1400);
	} catch (err) {
		console.error('Copy failed:', err);
	}
}
</script>

<template>
	<section class="writing">
		<div class="switch" role="tablist" aria-label="Writing from this book">
			<button
				v-for="k in (['quotes', 'notes'] as const)"
				:key="k"
				type="button"
				role="tab"
				:aria-selected="kind === k"
				class="tab"
				:class="{ on: kind === k }"
				@click="kind = k"
			>
				{{ k === 'quotes' ? 'Quotes' : 'Notes' }}<span class="n">{{ counts[k] }}</span>
			</button>
		</div>

		<!-- Entries, or their outline while they arrive -->
		<div v-if="entries === null" class="list" aria-busy="true">
			<div v-for="i in Math.min(3, Math.max(1, counts[kind]))" :key="i" class="entry ghost">
				<span class="bar" style="width: 94%"></span>
				<span class="bar" style="width: 78%"></span>
				<span class="bar short" style="width: 22%"></span>
			</div>
		</div>

		<p v-else-if="entries.length === 0" class="empty">
			{{ kind === 'quotes' ? 'No quotes from this book yet.' : 'No notes on this book yet.' }}
		</p>

		<TransitionGroup v-else tag="div" name="entry" class="list">
			<article v-for="e in entries" :key="e.id" class="entry" :class="kind">
				<p class="text typography-prose" v-html="e.html"></p>
				<footer class="meta">
					<span v-if="e.page">p. {{ e.page }}</span>
					<span>{{ e.date }}</span>
					<button type="button" class="copy" :aria-label="copied === e.id ? 'Copied' : 'Copy'" @click="copy(e)">
						{{ copied === e.id ? 'Copied' : 'Copy' }}
					</button>
				</footer>
			</article>
		</TransitionGroup>

		<button v-if="hiddenCount" type="button" class="all" :disabled="loadingAll" @click="loadAll">
			{{ loadingAll ? 'Loading…' : `Show ${hiddenCount} older ${kind === 'quotes' ? (hiddenCount === 1 ? 'quote' : 'quotes') : (hiddenCount === 1 ? 'note' : 'notes')}` }}
		</button>
	</section>
</template>

<style scoped>
.switch {
	display: flex;
	gap: 22px;
	border-bottom: 1px solid rgb(255 255 255 / 0.07);
	margin-bottom: 4px;
}
.tab {
	position: relative;
	padding: 10px 0 11px;
	border: none;
	background: none;
	font: inherit;
	font-size: 15px;
	color: rgb(255 255 255 / 0.5);
	cursor: pointer;
	transition: color 0.2s ease;
}
.tab:hover,
.tab.on {
	color: #fff;
}
.tab::after {
	content: '';
	position: absolute;
	left: 0;
	right: 0;
	bottom: -1px;
	height: 2px;
	border-radius: 1px;
	background: #e8d0a8;
	transform: scaleX(0);
	transition: transform 0.32s cubic-bezier(0.22, 1, 0.36, 1);
}
.tab.on::after {
	transform: scaleX(1);
}
.n {
	margin-left: 7px;
	font-size: 12.5px;
	color: var(--color-mono-500);
	font-variant-numeric: lining-nums tabular-nums;
}
.tab.on .n {
	color: #e8d0a8;
}

.list {
	display: flex;
	flex-direction: column;
}
.entry {
	padding: 16px 0 14px;
	border-bottom: 1px solid rgb(255 255 255 / 0.045);
}
.text {
	margin: 0;
	font-size: 15.5px;
	line-height: 1.45;
	color: #fff;
	overflow-wrap: break-word;
}
/* Quotes are someone else's words: hung between marks, a shade softer. */
.entry.quotes .text {
	color: var(--color-mono-100);
}
.entry.quotes .text::before {
	content: '“';
	color: #e8d0a8;
	margin-left: -0.45em;
	padding-right: 0.05em;
}
.entry.quotes .text::after {
	content: '”';
	color: #e8d0a8;
}
.meta {
	display: flex;
	align-items: baseline;
	gap: 14px;
	margin-top: 8px;
	font-size: 12.5px;
	color: var(--color-mono-500);
	font-variant-numeric: lining-nums tabular-nums;
}
.copy {
	margin-left: auto;
	padding: 4px 0 4px 12px;
	border: none;
	background: none;
	font: inherit;
	font-size: 12.5px;
	color: var(--color-mono-500);
	cursor: pointer;
}
.copy:hover {
	color: #e8d0a8;
}

.ghost {
	display: flex;
	flex-direction: column;
	gap: 9px;
}
.bar {
	display: block;
	height: 12px;
	border-radius: 4px;
	background: linear-gradient(90deg, rgb(255 255 255 / 0.05) 0%, rgb(255 255 255 / 0.09) 50%, rgb(255 255 255 / 0.05) 100%);
	background-size: 200% 100%;
	animation: sheen 1.6s ease-in-out infinite;
}
.bar.short {
	height: 9px;
	margin-top: 3px;
}
@keyframes sheen {
	from {
		background-position: 100% 0;
	}
	to {
		background-position: -100% 0;
	}
}

.empty {
	margin: 0;
	padding: 28px 0;
	font-style: italic;
	color: var(--color-mono-500);
	font-size: 14.5px;
}

.all {
	margin-top: 14px;
	padding: 9px 14px;
	border: 1px solid rgb(232 208 168 / 0.35);
	border-radius: 9px;
	background: none;
	font: inherit;
	font-size: 14px;
	color: #e8d0a8;
	cursor: pointer;
}
.all:hover {
	background: rgb(232 208 168 / 0.08);
}

.entry-enter-active {
	transition:
		opacity 0.35s ease,
		transform 0.35s cubic-bezier(0.22, 1, 0.36, 1);
}
.entry-enter-from {
	opacity: 0;
	transform: translateY(6px);
}

@media (prefers-reduced-motion: reduce) {
	.bar {
		animation: none;
	}
	.entry-enter-active {
		transition: none;
	}
}
</style>
