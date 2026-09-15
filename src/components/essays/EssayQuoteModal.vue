<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue';
import { createQuote, createConnectionApi, type Quote, type EssayReferenceInput } from '../../lib/api';
import { useSourceLibrary } from '../../composables/useSourceLibrary';
import { bookHue } from '../../composables/useBookHue';
import { useTypography } from '../../composables/useTypography';
import { splitQuoteInput, type QuoteDraft } from '../../lib/essayWorkspace';
import {
	quoteInputFromAttribution,
	attributionFromSplit,
	citeFromAttribution,
	type Attribution,
} from '../../lib/quoteAttribution';
import SourceSelector from '../library/SourceSelector.vue';
import EssayQuoteCite from './blocks/EssayQuoteCite.vue';

/**
 * Add a quote from inside the essay — a floating modal, centred.
 *
 * It was a bottom sheet with its own four hand-rolled text fields for author,
 * work and page. Two problems with that: a sheet is the wrong object on a
 * desktop (a drawer pinned to the bottom edge of a 1400px window), and the
 * free-text fields meant a quote written here never linked to a book or an
 * author you already have — every other capture surface in the app does.
 *
 * So attribution is `SourceSelector`, the same book / author / other picker
 * QuoteCaptureForm, MobileQuoteCapture and EditQuoteModal use, with its real
 * `BookSelector` and `AuthorSelector` searches. "Split it" still pulls a pasted
 * line apart — and now resolves the parts against the library, so a pasted
 * title you own becomes a link to that book with the page filled in.
 */
const props = defineProps<{
	isOpen: boolean;
	/** A passage already pasted into the manuscript, handed over pre-split. */
	seed?: Partial<QuoteDraft> | null;
}>();

const emit = defineEmits<{
	(e: 'close'): void;
	(e: 'select', ref: EssayReferenceInput): void;
}>();

const { quotes, books, authors, authorById, loading, ensureLoaded, registerQuote } =
	useSourceLibrary();

type Pane = 'write' | 'lib';
const pane = ref<Pane>('write');
/**
 * Declared up here, not beside the library code that uses it: the open watcher
 * below is immediate and resets it during setup, and a `const` read before its
 * declaration throws — which is exactly what a modal that mounts already open
 * (a seeded paste) did.
 */
const search = ref('');

// ─── The draft ───
const text = ref('');
const textRef = ref<HTMLTextAreaElement | null>(null);
const saving = ref(false);
const saveError = ref('');

/** What SourceSelector last reported. */
const attribution = ref<Attribution>({ mode: 'none' });
/**
 * What we PUSH into SourceSelector (its `initial`, which it watches). Kept
 * separate from `attribution` so the selector's own reports never loop back
 * in as a reset.
 */
const seededAttribution = ref<Partial<Attribution>>({ mode: 'none' });
const selectorKey = ref(0);

const authorName = computed(() =>
	attribution.value.authorId ? authorById.value.get(attribution.value.authorId)?.name : undefined
);

function applySplit(parts: Pick<QuoteDraft, 'who' | 'work' | 'page'>) {
	seededAttribution.value = attributionFromSplit(parts, books.value, authors.value);
	// Remount rather than rely on the deep watch alone: SourceSelector's
	// mode-change watcher clears fields AFTER its initial-watcher sets them,
	// so a second split in the same mode could otherwise wipe what it just set.
	selectorKey.value += 1;
}

watch(
	() => props.isOpen,
	async (open) => {
		if (!open) return;
		pane.value = 'write';
		search.value = '';
		saveError.value = '';
		text.value = props.seed?.text ?? '';
		attribution.value = { mode: 'none' };
		seededAttribution.value = { mode: 'none' };
		selectorKey.value += 1;

		await ensureLoaded();
		if (props.seed && (props.seed.who || props.seed.work)) {
			applySplit({ who: props.seed.who ?? '', work: props.seed.work ?? '', page: props.seed.page ?? '' });
		}
		await nextTick();
		textRef.value?.focus();
	},
	// Immediate: a seeded modal is already open when it mounts, so there is no
	// false → true edge to seed on. This exact watcher shape has blanked the
	// Essays tab once already.
	{ immediate: true }
);

const canSplit = computed(() => /[—–]|--|\s-\s/.test(text.value));

function splitIt() {
	const parsed = splitQuoteInput(text.value);
	if (!parsed) return;
	text.value = parsed.text;
	applySplit(parsed);
}

const canCommit = computed(() => text.value.trim().length > 0 && !saving.value);

async function commit() {
	if (!canCommit.value) return;
	saving.value = true;
	saveError.value = '';
	try {
		const attr = attribution.value;
		const { quote } = await createQuote(quoteInputFromAttribution(text.value, attr, authorName.value));

		// An author link is a connection, same as every other capture surface;
		// a book link rides on book_id and is dual-written server-side.
		if (attr.mode === 'author' && attr.authorId) {
			await createConnectionApi({
				a_type: 'author',
				a_id: attr.authorId,
				b_type: 'quote',
				b_id: quote.id,
			});
		}

		// Into the shared catalogue before the token lands, or the foil renders
		// "quote unavailable" until an unrelated refetch happens to run.
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

// ─── Live preview ───
const previewLength = computed(() => text.value.trim().length);
const { baseFontSize: pvSize, typographyClass: pvClass } = useTypography('quote', 'card', previewLength);
const pvCite = computed(() => citeFromAttribution(attribution.value, authorName.value));

// ─── Library ───
const filteredQuotes = computed(() => {
	const q = search.value.toLowerCase().trim();
	const all = quotes.value;
	if (!q) return all.slice(0, 200);
	return all
		.filter((x) => `${x.quote ?? ''} ${x.creator ?? ''} ${x.work ?? ''}`.toLowerCase().includes(q))
		.slice(0, 200);
});

function selectQuote(q: Quote) {
	emit('select', { entity_type: 'quote', entity_id: q.id });
	emit('close');
}

/** An empty search is the moment you most want to write one. */
function writeSearchAsQuote() {
	text.value = search.value.trim();
	pane.value = 'write';
	nextTick(() => textRef.value?.focus());
}

// ─── Modal behaviour ───
/** SourceSelector stacks its two free-text fields on a narrow screen. */
const narrow = ref(false);
function onResize() {
	narrow.value = window.matchMedia('(max-width: 640px)').matches;
}
function onKeydown(e: KeyboardEvent) {
	if (!props.isOpen) return;
	if (e.key === 'Escape') emit('close');
	else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && pane.value === 'write') commit();
}
onMounted(() => {
	onResize();
	window.addEventListener('resize', onResize);
	document.addEventListener('keydown', onKeydown);
});
onUnmounted(() => {
	window.removeEventListener('resize', onResize);
	document.removeEventListener('keydown', onKeydown);
	document.body.style.overflow = '';
});
watch(
	() => props.isOpen,
	(open) => {
		document.body.style.overflow = open ? 'hidden' : '';
	},
	{ immediate: true }
);
</script>

<template>
	<Teleport to="body">
		<Transition name="qm">
			<div v-if="isOpen" class="qm-root" role="dialog" aria-modal="true" aria-label="Add a quote">
				<div class="qm-scrim" @click="emit('close')"></div>

				<div class="qm-panel">
					<header class="qm-head">
						<h3>Quote</h3>
						<div class="qm-tabs" role="tablist">
							<button type="button" role="tab" :aria-selected="pane === 'write'" :class="{ on: pane === 'write' }" @click="pane = 'write'">Write</button>
							<button type="button" role="tab" :aria-selected="pane === 'lib'" :class="{ on: pane === 'lib' }" @click="pane = 'lib'">Library</button>
						</div>
						<button type="button" class="qm-x" aria-label="Close" @click="emit('close')">
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
						</button>
					</header>

					<!-- WRITE -->
					<div v-if="pane === 'write'" class="qm-body">
						<label class="qm-field">
							<span class="qm-lbl">The line</span>
							<textarea
								ref="textRef"
								v-model="text"
								rows="4"
								placeholder="Paste or type the quote…"
							></textarea>
						</label>

						<!-- Only offered when there is something that looks like an
						     attribution tail to split off. -->
						<button v-if="canSplit" type="button" class="qm-split" @click="splitIt">
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" /></svg>
							Split off the attribution
						</button>

						<div class="qm-field">
							<span class="qm-lbl">Attribution</span>
							<SourceSelector
								:key="selectorKey"
								entity-type="quote"
								:initial="seededAttribution"
								:compact="narrow"
								@update="attribution = $event"
							/>
						</div>

						<div class="qm-pv">
							<span class="qm-lbl">How it will sit in the essay</span>
							<template v-if="text.trim()">
								<blockquote class="quote-card qm-pvq" :class="pvClass" :style="{ fontSize: `${pvSize}px` }">
									<span class="qc-body"><span class="qc-mark">&ldquo;</span>{{ text.trim() }}<span class="qc-mark">&rdquo;</span></span>
								</blockquote>
								<EssayQuoteCite
									v-if="pvCite.author || pvCite.title"
									class="qm-pvc"
									compact
									:author="pvCite.author"
									:title="pvCite.title"
									:page="pvCite.page"
								/>
							</template>
							<div v-else class="qm-pv-empty">Nothing yet</div>
						</div>
					</div>

					<!-- LIBRARY -->
					<div v-else class="qm-body">
						<div class="qm-srch">
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
							<input v-model="search" placeholder="Search your quotes…" autocomplete="off" enterkeyhint="search" />
						</div>
						<div v-if="loading && !quotes.length" class="qm-empty">Loading…</div>
						<div v-else-if="!filteredQuotes.length" class="qm-empty">
							Nothing matches.
							<button type="button" @click="writeSearchAsQuote">Write it as a new quote</button>
						</div>
						<button v-for="q in filteredQuotes" :key="q.id" type="button" class="qm-row" @click="selectQuote(q)">
							<span class="tick" :style="{ background: q.book_id ? bookHue(q.book_id) : 'var(--color-essay)' }"></span>
							<span class="qm-row-b">
								<span class="qt">&ldquo;{{ q.quote }}&rdquo;</span>
								<span class="qmeta">
									<span v-if="q.creator" class="a">{{ q.creator }}</span>
									<span v-if="q.work" class="w">{{ q.work }}</span>
									<span v-if="q.page" class="p">p.&nbsp;{{ q.page }}</span>
								</span>
							</span>
						</button>
					</div>

					<footer class="qm-foot">
						<span v-if="saveError" class="err">{{ saveError }}</span>
						<span v-else class="hint">{{ pane === 'write' ? 'Saved to your library and set into the essay.' : 'Tap one to set it in.' }}</span>
						<button v-if="pane === 'write'" type="button" class="qm-commit" :disabled="!canCommit" @click="commit">
							{{ saving ? 'Saving…' : 'Set in' }}
						</button>
					</footer>
				</div>
			</div>
		</Transition>
	</Teleport>
</template>

<style scoped>
/* ── Placement ──
   Centred on a desktop. On a phone it anchors to the TOP of the safe area
   instead: a vertically centred dialog is exactly what the software keyboard
   covers the lower half of, and the lower half is where Set in lives. The
   panel is bounded by the dynamic viewport so it shrinks with the keyboard
   and its body scrolls, rather than the page scrolling behind it. */
.qm-root {
	position: fixed;
	inset: 0;
	z-index: 70;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: max(16px, env(safe-area-inset-top)) 16px max(16px, env(safe-area-inset-bottom));
}
.qm-scrim {
	position: absolute;
	inset: 0;
	background: rgb(0 0 0 / 0.72);
	backdrop-filter: blur(6px);
	-webkit-backdrop-filter: blur(6px);
}
.qm-panel {
	position: relative;
	display: flex;
	flex-direction: column;
	width: 100%;
	max-width: 560px;
	max-height: min(760px, calc(100dvh - 32px));
	background: #0b0a0e;
	border: 1px solid #231f18;
	border-radius: 18px;
	box-shadow: 0 30px 90px rgb(0 0 0 / 0.85), 0 0 0 1px rgb(255 255 255 / 0.02) inset;
	overflow: hidden;
}
@media (max-width: 640px) {
	.qm-root {
		align-items: flex-start;
		padding: max(10px, env(safe-area-inset-top)) 10px 10px;
	}
	.qm-panel {
		max-height: calc(100dvh - max(10px, env(safe-area-inset-top)) - 10px);
		border-radius: 16px;
	}
}

/* ── Head: title, the two panes, close — one row ── */
.qm-head {
	display: flex;
	align-items: center;
	gap: 10px;
	padding: 12px 12px 12px 18px;
	border-bottom: 1px solid #1c1a15;
	flex-shrink: 0;
}
.qm-head h3 {
	margin: 0;
	font-size: 15px;
	font-weight: 600;
	font-style: italic;
	color: var(--color-essay);
}
.qm-tabs {
	display: flex;
	gap: 2px;
	margin-left: auto;
	padding: 3px;
	border-radius: 999px;
	background: #141218;
	border: 1px solid #1f1d24;
}
.qm-tabs button {
	border: none;
	background: transparent;
	color: var(--color-mono-400);
	font: inherit;
	font-size: 12.5px;
	padding: 6px 14px;
	border-radius: 999px;
	cursor: pointer;
	min-height: 32px;
}
.qm-tabs button:hover {
	color: var(--color-mono-100);
}
.qm-tabs button.on {
	background: var(--color-essay);
	color: var(--color-essay-text);
	font-weight: 600;
}
.qm-x {
	width: 36px;
	height: 36px;
	display: grid;
	place-items: center;
	border: none;
	border-radius: 10px;
	background: transparent;
	color: var(--color-mono-400);
	cursor: pointer;
	flex-shrink: 0;
}
.qm-x svg {
	width: 17px;
	height: 17px;
}
.qm-x:hover {
	background: var(--color-mono-800);
	color: var(--color-mono-50);
}

/* ── Body ── */
.qm-body {
	flex: 1;
	min-height: 0;
	overflow-y: auto;
	overscroll-behavior: contain;
	padding: 16px 18px 20px;
	/* Room under the attribution dropdowns, which open downward inside this
	   scroller and would otherwise be cut off by the footer. */
	scroll-padding-bottom: 260px;
}
.qm-field {
	display: block;
	margin-bottom: 14px;
}
.qm-lbl {
	display: block;
	margin-bottom: 6px;
	font-size: 9.5px;
	font-weight: 700;
	letter-spacing: 0.16em;
	text-transform: uppercase;
	color: var(--color-mono-400);
}
.qm-field textarea {
	width: 100%;
	min-height: 110px;
	background: #07070a;
	border: 1px solid var(--color-mono-800);
	border-radius: 12px;
	padding: 11px 13px;
	font: inherit;
	/* 16px on purpose: below that, iOS Safari zooms the page on focus. */
	font-size: 16px;
	line-height: 1.5;
	color: var(--color-mono-50);
	outline: none;
	resize: vertical;
}
.qm-field textarea:focus {
	border-color: var(--color-essay);
}
.qm-field textarea::placeholder {
	color: var(--color-mono-600);
}

.qm-split {
	display: inline-flex;
	align-items: center;
	gap: 7px;
	margin: -6px 0 14px;
	padding: 7px 12px;
	border: 1px solid rgb(232 160 64 / 0.4);
	border-radius: 999px;
	background: rgb(232 160 64 / 0.07);
	color: var(--color-essay);
	font: inherit;
	font-size: 12px;
	cursor: pointer;
	min-height: 34px;
}
.qm-split svg {
	width: 13px;
	height: 13px;
}
.qm-split:hover {
	background: rgb(232 160 64 / 0.14);
}

/* SourceSelector renders with the app's Tailwind classes; its inputs need
   the same no-zoom floor on iOS. */
.qm-field :deep(input),
.qm-field :deep(select) {
	font-size: 16px;
}
@media (min-width: 641px) {
	.qm-field :deep(input),
	.qm-field :deep(select) {
		font-size: 14px;
	}
}

.qm-pv {
	margin-top: 4px;
	padding-top: 14px;
	border-top: 1px solid #1c1a15;
}
.qm-pvq {
	margin: 2px 0 0;
	padding: 0.1em 0 0.1em 1.05em;
	border-left: 1px solid rgb(232 208 168 / 0.4);
	color: var(--color-mono-100);
	line-height: var(--content-leading);
}
.qm-pvc {
	--qcite-align: left;
	--qcite-justify: flex-start;
	margin-top: 8px;
	padding-left: 1.05em;
}
.qm-pv-empty {
	padding: 8px 0;
	font-size: 12.5px;
	font-style: italic;
	color: var(--color-mono-600);
}

/* ── Library ── */
.qm-srch {
	position: relative;
	margin-bottom: 8px;
}
.qm-srch svg {
	position: absolute;
	left: 12px;
	top: 50%;
	width: 14px;
	height: 14px;
	transform: translateY(-50%);
	color: var(--color-mono-500);
}
.qm-srch input {
	width: 100%;
	padding: 10px 12px 10px 34px;
	background: #07070a;
	border: 1px solid var(--color-mono-800);
	border-radius: 12px;
	font: inherit;
	font-size: 16px;
	color: var(--color-mono-50);
	outline: none;
}
@media (min-width: 641px) {
	.qm-srch input {
		font-size: 13.5px;
	}
}
.qm-srch input:focus {
	border-color: var(--color-essay);
}
.qm-empty {
	padding: 26px 6px;
	text-align: center;
	font-size: 13px;
	color: var(--color-mono-400);
}
.qm-empty button {
	display: block;
	margin: 12px auto 0;
	border: 1px solid var(--color-essay);
	background: transparent;
	color: var(--color-essay);
	font: inherit;
	font-size: 12.5px;
	padding: 8px 15px;
	border-radius: 10px;
	cursor: pointer;
}
.qm-row {
	display: flex;
	gap: 11px;
	width: 100%;
	text-align: left;
	border: none;
	background: transparent;
	font: inherit;
	padding: 11px 10px;
	border-radius: 12px;
	cursor: pointer;
}
.qm-row:hover {
	background: #15120c;
}
.qm-row .tick {
	flex: 0 0 3px;
	align-self: stretch;
	border-radius: 2px;
}
.qm-row-b {
	flex: 1;
	min-width: 0;
}
.qt {
	display: -webkit-box;
	-webkit-line-clamp: 3;
	-webkit-box-orient: vertical;
	overflow: hidden;
	font-size: 13.5px;
	line-height: 1.45;
	color: var(--color-mono-50);
}
.qmeta {
	display: flex;
	flex-wrap: wrap;
	gap: 0 7px;
	margin-top: 5px;
	font-size: 11px;
	color: var(--color-mono-400);
}
.qmeta .a {
	color: var(--color-mono-200);
	font-weight: 500;
}
.qmeta .w {
	font-style: italic;
	color: #e8d0a8;
}

/* ── Foot ── */
.qm-foot {
	display: flex;
	align-items: center;
	gap: 12px;
	padding: 12px 14px 12px 18px;
	border-top: 1px solid #1c1a15;
	background: #09080c;
	flex-shrink: 0;
}
.qm-foot .hint {
	flex: 1;
	min-width: 0;
	font-size: 11.5px;
	line-height: 1.4;
	color: var(--color-mono-500);
}
.qm-foot .err {
	flex: 1;
	font-size: 12px;
	color: #ff8fa3;
}
.qm-commit {
	flex-shrink: 0;
	min-height: 40px;
	padding: 0 22px;
	border: none;
	border-radius: 999px;
	background: var(--color-essay);
	color: var(--color-essay-text);
	font: inherit;
	font-size: 13.5px;
	font-weight: 600;
	cursor: pointer;
	box-shadow: inset 0 1px 0 rgb(255 245 220 / 0.5);
}
.qm-commit:hover:not(:disabled) {
	background: var(--color-essay-bright);
}
.qm-commit:disabled {
	opacity: 0.4;
	cursor: not-allowed;
}

/* ── Motion ── */
.qm-enter-active,
.qm-leave-active {
	transition: opacity 0.18s ease;
}
.qm-enter-active .qm-panel,
.qm-leave-active .qm-panel {
	transition: transform 0.22s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.18s ease;
}
.qm-enter-from,
.qm-leave-to {
	opacity: 0;
}
.qm-enter-from .qm-panel,
.qm-leave-to .qm-panel {
	transform: translateY(10px) scale(0.98);
	opacity: 0;
}
@media (prefers-reduced-motion: reduce) {
	.qm-enter-active .qm-panel,
	.qm-leave-active .qm-panel {
		transition: none;
	}
}
</style>
