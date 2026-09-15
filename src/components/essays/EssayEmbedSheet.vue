<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import { createQuote, type Quote, type Book, type EssayReferenceInput } from '../../lib/api';
import { bookHue } from '../../composables/useBookHue';
import { useSourceLibrary } from '../../composables/useSourceLibrary';
import { splitQuoteInput, type QuoteDraft } from '../../lib/essayWorkspace';
import { useTypography } from '../../composables/useTypography';
import BottomSheet from '../shared/BottomSheet.vue';

/**
 * The source sheet.
 *
 * It used to be a picker and only a picker: to set a quote you had not
 * captured yet you left the essay, went to the Quotes tab, wrote it there,
 * came back, reopened the sheet and searched for it. That is the slowest path
 * in the editor, and quotes are the most frequent thing in the corpus (84
 * across 49 essays).
 *
 * So the quote sheet opens on WRITE, with LIBRARY one tap away. Writing a
 * quote writes it into the library — the same store the picker reads — and
 * sets it into the essay in one motion. Paste the whole thing, attribution and
 * all, and "Split it" pulls the fields apart.
 */
const props = defineProps<{
	isOpen: boolean;
	/** Which source kind the sheet is for. */
	initialKind?: 'quote' | 'book';
	/**
	 * Pre-filled draft — a passage pasted into the manuscript that the editor
	 * already recognised as a quote, handed over rather than retyped.
	 */
	seed?: Partial<QuoteDraft> | null;
}>();

const emit = defineEmits<{
	(e: 'close'): void;
	(e: 'select', ref: EssayReferenceInput): void;
}>();

const { quotes, books, authors, loading, ensureLoaded, registerQuote } = useSourceLibrary();

type Pane = 'write' | 'lib';
const pane = ref<Pane>('write');
const search = ref('');
const selectedAuthorId = ref<string | null>(null);

const isQuote = computed(() => (props.initialKind ?? 'quote') === 'quote');

// ─── The draft ───
const blank = (): QuoteDraft => ({ text: '', who: '', work: '', page: '' });
const draft = ref<QuoteDraft>(blank());
const textRef = ref<HTMLTextAreaElement | null>(null);
const saving = ref(false);
const saveError = ref('');

watch(
	() => props.isOpen,
	async (open) => {
		if (!open) return;
		search.value = '';
		saveError.value = '';
		draft.value = { ...blank(), ...(props.seed ?? {}) };
		// A seeded draft arrived from a paste and is already filled in; an
		// empty one still wants Write, which is the whole point of the change.
		pane.value = 'write';
		await nextTick();
		if (isQuote.value) textRef.value?.focus();
		// The catalogue backs the Library pane and the foils alike. Not forced:
		// a quote written here is registered locally, so nothing goes stale.
		await ensureLoaded();
		if (authors.value.length && !selectedAuthorId.value) {
			selectedAuthorId.value = authors.value[0].id;
		}
	},
	// IMMEDIATE. A sheet that is already open when it mounts — which is what a
	// seeded one is — has no false → true edge to seed itself on. The same
	// watcher shape rendered the whole Essays tab blank once already.
	{ immediate: true }
);

const canCommit = computed(() => draft.value.text.trim().length > 0 && !saving.value);

function splitIt() {
	const parsed = splitQuoteInput(draft.value.text);
	if (!parsed) return;
	draft.value = parsed;
}

async function commit() {
	if (!canCommit.value) return;
	saving.value = true;
	saveError.value = '';
	try {
		const { quote } = await createQuote({
			quote: draft.value.text.trim(),
			creator: draft.value.who.trim() || undefined,
			work: draft.value.work.trim() || undefined,
			page: draft.value.page.trim() || undefined,
		});
		// Into the shared catalogue first, so the foil resolves the instant the
		// token lands instead of showing "quote unavailable".
		registerQuote(quote);
		emit('select', { entity_type: 'quote', entity_id: quote.id });
		emit('close');
	} catch (err: any) {
		console.error('Failed to write quote:', err?.response?.data ?? err);
		saveError.value = 'Could not save that quote. Try again.';
	} finally {
		saving.value = false;
	}
}

// ─── Live preview, on the surface the essay actually uses ───
const previewLength = computed(() => draft.value.text.trim().length);
const { baseFontSize: pvSize, typographyClass: pvClass } = useTypography(
	'quote',
	'card',
	previewLength
);

// ─── Library pane ───
const filteredQuotes = computed(() => {
	const q = search.value.toLowerCase().trim();
	if (!q) return quotes.value.slice(0, 200);
	return quotes.value
		.filter((quote) =>
			`${quote.quote ?? ''} ${quote.creator ?? ''} ${quote.work ?? ''}`
				.toLowerCase()
				.includes(q)
		)
		.slice(0, 200);
});

function selectQuote(q: Quote) {
	emit('select', { entity_type: 'quote', entity_id: q.id });
	emit('close');
}

/** An empty search result is the moment you most want to write one. */
function writeSearchAsQuote() {
	draft.value = { ...blank(), text: search.value.trim() };
	pane.value = 'write';
	nextTick(() => textRef.value?.focus());
}

// ─── Books ───
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
			return (booksByAuthor.value.get(a.id) || []).some((b) =>
				b.title.toLowerCase().includes(q)
			);
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
	if (
		filteredAuthors.value.length &&
		!filteredAuthors.value.find((a) => a.id === selectedAuthorId.value)
	) {
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
			<h3>{{ isQuote ? 'Quote' : 'Book' }}</h3>
			<button type="button" class="x" aria-label="Close" @click="emit('close')">✕</button>
		</div>

		<!-- ── QUOTE ── Write first; the library is one tap away. -->
		<template v-if="isQuote">
			<div class="tabs">
				<button type="button" :class="{ on: pane === 'write' }" @click="pane = 'write'">Write</button>
				<button type="button" :class="{ on: pane === 'lib' }" @click="pane = 'lib'">Library</button>
			</div>

			<!-- WRITE -->
			<div v-if="pane === 'write'" class="body">
				<div class="parsebar">
					<span class="txt">Paste the whole thing — <b>&ldquo;line&rdquo; — Author, Work, p. 40</b> — and let it split itself.</span>
					<button type="button" :disabled="!draft.text.trim()" @click="splitIt">Split it</button>
				</div>

				<label class="field">
					<span class="lbl">The line</span>
					<textarea
						ref="textRef"
						v-model="draft.text"
						rows="4"
						placeholder="Paste or type the quote…"
					></textarea>
				</label>
				<label class="field">
					<span class="lbl">Who said it</span>
					<input v-model="draft.who" placeholder="Ralph Waldo Emerson" />
				</label>
				<div class="duo">
					<label class="field">
						<span class="lbl">Where from</span>
						<input v-model="draft.work" placeholder="The Conduct of Life" />
					</label>
					<label class="field pg">
						<span class="lbl">Page</span>
						<input v-model="draft.page" inputmode="numeric" placeholder="40" />
					</label>
				</div>

				<!-- The same surface the foil renders, at the same length-derived
				     size — so this is what it will look like, not an impression. -->
				<div class="pv">
					<span class="lbl">How it will sit in the essay</span>
					<blockquote
						v-if="draft.text.trim()"
						class="quote-card pvq"
						:class="pvClass"
						:style="{ fontSize: `${pvSize}px` }"
					>
						<span class="qc-body"><span class="qc-mark">&ldquo;</span>{{ draft.text.trim() }}<span class="qc-mark">&rdquo;</span></span>
					</blockquote>
					<div v-else class="pv-empty">Nothing yet</div>
					<div v-if="draft.text.trim() && (draft.who || draft.work)" class="pv-cite">
						<span v-if="draft.who" class="who">&mdash; {{ draft.who }}</span>
						<span v-if="draft.work" class="work">in {{ draft.work }}</span>
						<span v-if="draft.page" class="pg">p.&nbsp;{{ draft.page }}</span>
					</div>
				</div>
			</div>

			<!-- LIBRARY -->
			<div v-else class="body">
				<div class="srch">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
					<input v-model="search" placeholder="Search your quotes…" autocomplete="off" />
				</div>
				<div v-if="loading" class="empty">Loading…</div>
				<div v-else-if="!filteredQuotes.length" class="empty">
					Nothing matches.
					<button type="button" @click="writeSearchAsQuote">Write it as a new quote</button>
				</div>
				<button v-for="q in filteredQuotes" :key="q.id" type="button" class="qrow" @click="selectQuote(q)">
					<span class="tick" :style="{ background: q.book_id ? bookHue(q.book_id) : 'var(--color-essay)' }"></span>
					<span class="qrow-b">
						<span class="qt">&ldquo;{{ q.quote }}&rdquo;</span>
						<span class="qm">
							<span v-if="q.creator" class="a">{{ q.creator }}</span>
							<span v-if="q.work" class="w">{{ q.work }}</span>
							<span v-if="q.page" class="p">p.&nbsp;{{ q.page }}</span>
						</span>
					</span>
				</button>
			</div>

			<div class="foot">
				<span v-if="saveError" class="err">{{ saveError }}</span>
				<span v-else class="hint">{{ pane === 'write' ? 'Written into the library and set into the essay — no trip to the Quotes tab.' : 'Everything you have written, newest first.' }}</span>
				<button
					v-if="pane === 'write'"
					type="button"
					class="commit"
					:disabled="!canCommit"
					@click="commit"
				>{{ saving ? 'Saving…' : 'Set in' }}</button>
			</div>
		</template>

		<!-- ── BOOK ── browse by author; a cover is optional. -->
		<template v-else>
			<div class="body">
				<div class="srch">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
					<input v-model="search" placeholder="Search title or author…" autocomplete="off" />
				</div>
				<div class="bookcols">
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
		</template>
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
	width: 28px;
	height: 28px;
	border: none;
	border-radius: 8px;
	background: var(--color-mono-800);
	color: var(--color-mono-300);
	font-size: 13px;
	cursor: pointer;
}
.x:hover {
	color: var(--color-mono-50);
}

.tabs {
	display: flex;
	gap: 4px;
	padding: 0 14px 10px;
}
.tabs button {
	padding: 6px 14px;
	border: 1px solid transparent;
	border-radius: 999px;
	background: transparent;
	color: var(--color-mono-400);
	font: inherit;
	font-size: 12.5px;
	cursor: pointer;
}
.tabs button:hover {
	color: var(--color-mono-100);
}
.tabs button.on {
	background: var(--color-essay);
	color: var(--color-essay-text);
	font-weight: 600;
}

.body {
	max-height: 58vh;
	overflow-y: auto;
	padding: 0 14px 12px;
}

/* ── Write ── */
.parsebar {
	display: flex;
	align-items: center;
	gap: 10px;
	padding: 9px 11px;
	margin-bottom: 12px;
	border: 1px solid var(--color-mono-800);
	border-left: 2px solid var(--color-essay);
	border-radius: 10px;
	background: var(--color-mono-900);
}
.parsebar .txt {
	flex: 1;
	min-width: 0;
	font-size: 11.5px;
	line-height: 1.45;
	color: var(--color-mono-400);
}
.parsebar .txt b {
	color: var(--color-mono-200);
	font-weight: 500;
	font-style: italic;
}
.parsebar button {
	flex: 0 0 auto;
	border: 1px solid var(--color-mono-700);
	background: transparent;
	color: var(--color-mono-100);
	font: inherit;
	font-size: 11.5px;
	padding: 6px 11px;
	border-radius: 8px;
	cursor: pointer;
}
.parsebar button:hover:not(:disabled) {
	border-color: var(--color-essay);
	color: var(--color-essay);
}
.parsebar button:disabled {
	opacity: 0.4;
	cursor: default;
}

.field {
	display: block;
	margin-bottom: 10px;
}
.duo {
	display: flex;
	gap: 10px;
}
.duo .field {
	flex: 1;
}
.duo .field.pg {
	flex: 0 0 84px;
}
.lbl {
	display: block;
	margin-bottom: 5px;
	font-size: 9px;
	font-weight: 600;
	letter-spacing: 0.16em;
	text-transform: uppercase;
	color: var(--color-mono-500);
}
.field textarea,
.field input {
	width: 100%;
	background: #0b0a0e;
	border: 1px solid var(--color-mono-800);
	border-radius: 10px;
	padding: 9px 11px;
	font: inherit;
	font-size: 13.5px;
	line-height: 1.5;
	color: var(--color-mono-50);
	outline: none;
	resize: vertical;
}
.field textarea:focus,
.field input:focus {
	border-color: var(--color-essay);
}
.field textarea::placeholder,
.field input::placeholder {
	color: var(--color-mono-600);
}

.pv {
	margin-top: 14px;
	padding-top: 12px;
	border-top: 1px solid var(--color-mono-800);
}
.pvq {
	color: var(--color-mono-100);
	line-height: var(--content-leading);
	padding: 0.95em 0;
}
.pv-empty {
	padding: 12px 0;
	font-size: 12px;
	font-style: italic;
	color: var(--color-mono-600);
}
.pv-cite {
	display: flex;
	flex-wrap: wrap;
	gap: 0 7px;
	margin-top: 8px;
	font-size: 11px;
	color: var(--color-mono-400);
}
.pv-cite .work {
	font-style: italic;
	color: #e8d0a8;
}
.pv-cite .pg {
	color: var(--color-mono-500);
}

/* ── Library ── */
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
	font-size: 13px;
	color: var(--color-mono-50);
	outline: none;
}
.srch input:focus {
	border-color: var(--color-essay);
}
.srch input::placeholder {
	color: var(--color-mono-600);
}

.empty {
	padding: 22px 6px;
	text-align: center;
	font-size: 12.5px;
	color: var(--color-mono-500);
}
.empty button {
	display: block;
	margin: 10px auto 0;
	border: 1px solid var(--color-essay);
	background: transparent;
	color: var(--color-essay);
	font: inherit;
	font-size: 12px;
	padding: 7px 14px;
	border-radius: 9px;
	cursor: pointer;
}

.qrow {
	display: flex;
	gap: 11px;
	width: 100%;
	text-align: left;
	border: none;
	background: transparent;
	font: inherit;
	padding: 10px;
	border-radius: 12px;
	cursor: pointer;
}
.qrow:hover {
	background: #14100a;
}
.qrow .tick {
	flex: 0 0 3px;
	align-self: stretch;
	border-radius: 2px;
}
.qrow-b {
	flex: 1;
	min-width: 0;
}
.qt {
	display: -webkit-box;
	-webkit-line-clamp: 3;
	-webkit-box-orient: vertical;
	overflow: hidden;
	font-size: 13px;
	font-style: italic;
	line-height: 1.45;
	color: var(--color-mono-100);
}
.qm {
	display: flex;
	flex-wrap: wrap;
	gap: 0 7px;
	margin-top: 5px;
	font-size: 10.5px;
	color: var(--color-mono-500);
}
.qm .a {
	color: var(--color-mono-300);
	font-weight: 500;
}
.qm .w {
	font-style: italic;
	color: #e8d0a8;
}

/* ── Books ── */
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
	color: var(--color-mono-400);
	padding: 7px 9px;
	border-radius: 9px;
	cursor: pointer;
}
.arow:hover {
	background: #14100a;
	color: var(--color-mono-100);
}
.arow.on {
	background: #14100a;
	color: var(--color-mono-50);
	font-weight: 500;
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
	color: var(--color-mono-600);
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
	padding: 8px 9px;
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

/* ── Foot ── */
.foot {
	display: flex;
	align-items: center;
	gap: 12px;
	padding: 10px 14px calc(12px + env(safe-area-inset-bottom));
	border-top: 1px solid var(--color-mono-800);
}
.foot .hint {
	flex: 1;
	min-width: 0;
	font-size: 11px;
	line-height: 1.4;
	color: var(--color-mono-500);
}
.foot .err {
	flex: 1;
	font-size: 11.5px;
	color: #ff8fa3;
}
.commit {
	flex: 0 0 auto;
	border: none;
	background: var(--color-essay);
	color: var(--color-essay-text);
	font: inherit;
	font-size: 13px;
	font-weight: 600;
	padding: 9px 20px;
	border-radius: 999px;
	cursor: pointer;
	box-shadow: inset 0 1px 0 rgb(255 245 220 / 0.5);
}
.commit:hover:not(:disabled) {
	background: var(--color-essay-bright);
}
.commit:disabled {
	opacity: 0.4;
	cursor: not-allowed;
}
</style>
