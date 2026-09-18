<script setup lang="ts">
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue';
import { getSignedFileUrlCached, updateBook, uploadPdf, type LibraryBook } from '../../lib/api';
import { parseAuthors } from '../../lib/bookAttribution';
import { lifespan } from '../../lib/library';
import { useLibrary } from '../../composables/useLibrary';
import { usePdfOpener } from '../../composables/usePdfOpener';
import BookWriting from './BookWriting.vue';
import BookImages from './BookImages.vue';
import BookForm from './BookForm.vue';

/**
 * One book, opened. A drawer from the right on a wide screen — the catalogue
 * stays in view beside it — and a sheet from the bottom on a phone, dismissed
 * by pulling it back down.
 *
 * It opens with what the row already knows and never waits to show a title:
 * only the writing, the images and the author's dates arrive afterwards.
 */
const props = defineProps<{
	/** The book to show, or null with `mode: 'new'` to add one. */
	book: LibraryBook | null;
	mode: 'view' | 'edit' | 'new' | null;
	isAdmin?: boolean;
	/** Title to start a new book with. */
	initialTitle?: string;
}>();

const emit = defineEmits<{
	(e: 'close'): void;
	(e: 'mode', mode: 'view' | 'edit'): void;
	(e: 'saved', bookId: string, patch: Partial<LibraryBook>, created: boolean): void;
}>();

const { details, loadDetail, patchBook } = useLibrary();
const { opening, openPdf, prefetchPdf } = usePdfOpener();

const isOpen = computed(() => props.mode !== null);
const detail = computed(() => (props.book ? details.value.get(props.book.id) ?? null : null));
const authors = computed(() => parseAuthors(props.book?.author));
const dates = computed(() =>
	detail.value?.author
		? lifespan(detail.value.author.born, detail.value.author.died)
		: lifespan(props.book?.author_born, props.book?.author_died)
);

// Detail: shown from cache at once when we have it, refreshed regardless.
watch(
	() => props.book?.id,
	(id) => {
		if (id && props.mode !== 'new') loadDetail(id);
	},
	{ immediate: true }
);

const coverUrl = ref<string | null>(null);
const coverShown = ref(false);
watch(
	() => props.book?.cover_url,
	async (url) => {
		coverUrl.value = null;
		coverShown.value = false;
		if (!url) return;
		try {
			coverUrl.value = await getSignedFileUrlCached(url.replace(/^\/files\//, ''));
		} catch {
			// No cover shown is better than a broken one.
		}
	},
	{ immediate: true }
);

// ── Attach a PDF straight from the sheet ─────────────────────────────────
const pdfInput = ref<HTMLInputElement | null>(null);
const attaching = ref(false);
const attachError = ref<string | null>(null);
async function onPdf(e: Event) {
	const file = (e.target as HTMLInputElement).files?.[0];
	const book = props.book;
	if (!file || !book) return;
	attaching.value = true;
	attachError.value = null;
	try {
		const { url } = await uploadPdf(file, book.id);
		await updateBook(book.id, { pdf_url: url });
		patchBook(book.id, { pdf_url: url, has_pdf: 1 });
	} catch (err) {
		console.error('PDF upload failed:', err);
		attachError.value = 'The PDF didn’t upload. Try again.';
	} finally {
		attaching.value = false;
		if (pdfInput.value) pdfInput.value.value = '';
	}
}

function onSaved(bookId: string, patch: Partial<LibraryBook>) {
	emit('saved', bookId, patch, props.mode === 'new');
}

function onMediaChanged() {
	if (props.book) loadDetail(props.book.id);
}

function onCoverChanged(url: string | undefined) {
	if (!props.book) return;
	patchBook(props.book.id, { cover_url: url });
	loadDetail(props.book.id);
}

// ── Opening and closing: focus, scroll lock, Esc ─────────────────────────
const panel = ref<HTMLElement | null>(null);
let returnFocus: HTMLElement | null = null;

watch(isOpen, (open) => {
	if (open) {
		returnFocus = document.activeElement as HTMLElement | null;
		document.documentElement.style.overflow = 'hidden';
		document.addEventListener('keydown', onKey);
		nextTick(() => panel.value?.focus({ preventScroll: true }));
	} else {
		document.documentElement.style.overflow = '';
		document.removeEventListener('keydown', onKey);
		returnFocus?.focus?.({ preventScroll: true });
		returnFocus = null;
	}
}, { immediate: true });

onBeforeUnmount(() => {
	document.documentElement.style.overflow = '';
	document.removeEventListener('keydown', onKey);
});

function onKey(e: KeyboardEvent) {
	if (e.key !== 'Escape') return;
	// Esc inside the form backs out of editing first, then closes.
	if (props.mode === 'edit') emit('mode', 'view');
	else emit('close');
}

// ── Pull down to dismiss, on the phone sheet ─────────────────────────────
const drag = ref(0);
let startY: number | null = null;
let startT = 0;

function dragStart(e: TouchEvent) {
	// Only from the top of the sheet, and only when its content is scrolled to the top.
	const body = panel.value?.querySelector('.body');
	if (body && body.scrollTop > 0) return;
	startY = e.touches[0].clientY;
	startT = performance.now();
}
function dragMove(e: TouchEvent) {
	if (startY === null) return;
	drag.value = Math.max(0, e.touches[0].clientY - startY);
}
function dragEnd() {
	if (startY === null) return;
	const velocity = drag.value / Math.max(1, performance.now() - startT);
	const shouldClose = drag.value > 140 || (drag.value > 40 && velocity > 0.6);
	startY = null;
	if (shouldClose) emit('close');
	drag.value = 0;
}

const panelStyle = computed(() =>
	drag.value ? { transform: `translateY(${drag.value}px)`, transition: 'none' } : undefined
);
</script>

<template>
	<Teleport to="body">
		<Transition name="scrim">
			<div v-if="isOpen" class="scrim" @click="emit('close')"></div>
		</Transition>

		<Transition name="sheet">
			<aside
				v-if="isOpen"
				ref="panel"
				class="sheet"
				role="dialog"
				aria-modal="true"
				:aria-label="mode === 'new' ? 'Add a book' : book?.title"
				tabindex="-1"
				:style="panelStyle"
			>
				<div class="top" @touchstart.passive="dragStart" @touchmove.passive="dragMove" @touchend="dragEnd">
					<span class="grab" aria-hidden="true"></span>
					<span class="top-title">{{ mode === 'new' ? 'Add a book' : mode === 'edit' ? 'Edit details' : '' }}</span>
					<button type="button" class="close" aria-label="Close" @click="emit('close')">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
					</button>
				</div>

				<div class="body">
					<!-- Adding or editing -->
					<BookForm
						v-if="mode === 'new' || mode === 'edit'"
						:key="mode === 'new' ? 'new' : book?.id"
						:book="mode === 'edit' ? book : null"
						:initial-title="initialTitle"
						@saved="onSaved"
						@cancel="mode === 'edit' ? emit('mode', 'view') : emit('close')"
					/>

					<!-- The book -->
					<template v-else-if="book">
						<header class="hero">
							<!-- The box is held from the start, so the title never shifts when the image lands. -->
							<span v-if="book.cover_url" class="cover">
								<img v-if="coverUrl" :src="coverUrl" alt="" :class="{ shown: coverShown }" @load="coverShown = true" />
							</span>
							<div class="ident">
								<p class="by">
									<template v-for="(a, i) in authors" :key="i"><span v-if="i > 0" class="fp"> &amp; </span><span class="fp">{{ a.firstParts }}</span><span class="ln" :style="{ color: a.color }">{{ a.lastName }}</span><span v-if="a.suffix" class="fp">{{ a.suffix }}</span></template>
									<span v-if="dates" class="dates">{{ dates }}</span>
								</p>
								<h2 class="title">{{ book.title }}</h2>
								<p v-if="book.originally_published" class="year">{{ book.originally_published }}</p>
							</div>
						</header>

						<div class="actions">
							<button
								v-if="book.has_pdf"
								type="button"
								class="primary"
								:class="{ pending: opening === book.id }"
								@click="openPdf(book.id, book.pdf_url)"
								@pointerenter="prefetchPdf(book.pdf_url)"
								@touchstart.passive="prefetchPdf(book.pdf_url)"
							>
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" /><path d="M14 3v5h5" /><path d="M9 13h6M9 17h4" /></svg>
								Open the PDF
							</button>
							<button v-else-if="isAdmin" type="button" class="secondary" :disabled="attaching" @click="pdfInput?.click()">
								{{ attaching ? 'Uploading…' : 'Attach a PDF' }}
							</button>
							<button v-if="isAdmin" type="button" class="secondary" @click="emit('mode', 'edit')">Edit details</button>
							<input ref="pdfInput" type="file" accept="application/pdf" class="hidden" @change="onPdf" />
						</div>
						<p v-if="attachError" class="error">{{ attachError }}</p>
						<p v-if="book.description" class="description">{{ book.description }}</p>

						<BookWriting :book="book" :detail="detail" />

						<BookImages
							v-if="detail"
							class="images"
							:book-id="book.id"
							:media="detail.media"
							:cover-url="book.cover_url"
							:is-admin="isAdmin"
							@changed="onMediaChanged"
							@cover-changed="onCoverChanged"
						/>
					</template>
				</div>
			</aside>
		</Transition>
	</Teleport>
</template>

<style scoped>
.scrim {
	position: fixed;
	inset: 0;
	z-index: 49;
	background: rgb(0 0 0 / 0.55);
	backdrop-filter: blur(2px);
}

/* ── The phone sheet ──────────────────────────────────────────────────── */
.sheet {
	position: fixed;
	z-index: 50;
	left: 0;
	right: 0;
	bottom: 0;
	height: 92dvh;
	display: flex;
	flex-direction: column;
	background: #0a0a0c;
	border-top: 1px solid rgb(255 255 255 / 0.08);
	border-radius: 18px 18px 0 0;
	box-shadow: 0 -24px 60px rgb(0 0 0 / 0.6);
	outline: none;
	transition: transform 0.42s cubic-bezier(0.22, 1, 0.36, 1);
	will-change: transform;
}
.top {
	position: relative;
	flex-shrink: 0;
	display: flex;
	align-items: center;
	justify-content: center;
	height: 52px;
	padding: 0 12px;
	touch-action: none;
}
.grab {
	position: absolute;
	top: 8px;
	left: 50%;
	width: 38px;
	height: 4px;
	margin-left: -19px;
	border-radius: 2px;
	background: rgb(255 255 255 / 0.18);
}
.top-title {
	font-size: 15px;
	color: #fff;
}
.close {
	position: absolute;
	right: 8px;
	top: 6px;
	width: 40px;
	height: 40px;
	display: grid;
	place-items: center;
	border: none;
	border-radius: 10px;
	background: none;
	color: var(--color-mono-400);
	cursor: pointer;
}
.close svg {
	width: 19px;
	height: 19px;
}
.close:hover {
	color: #fff;
	background: rgb(255 255 255 / 0.06);
}
.body {
	flex: 1;
	min-height: 0;
	overflow-y: auto;
	overscroll-behavior: contain;
	padding: 4px 20px calc(32px + env(safe-area-inset-bottom));
}

/* ── The desktop drawer ───────────────────────────────────────────────── */
@media (min-width: 768px) {
	.sheet {
		left: auto;
		top: 0;
		width: min(540px, 92vw);
		height: auto;
		border-top: none;
		border-left: 1px solid rgb(255 255 255 / 0.07);
		border-radius: 0;
		box-shadow: -30px 0 80px rgb(0 0 0 / 0.55);
	}
	.scrim {
		background: rgb(0 0 0 / 0.35);
		backdrop-filter: none;
	}
	.top {
		justify-content: flex-start;
		height: 56px;
		padding: 0 20px;
	}
	.grab {
		display: none;
	}
	.close {
		top: 8px;
		right: 12px;
	}
	.body {
		padding: 0 32px 40px;
	}
}

/* ── The book ─────────────────────────────────────────────────────────── */
.hero {
	display: flex;
	gap: 20px;
	align-items: flex-end;
	padding-top: 6px;
}
.cover {
	width: 84px;
	height: 126px;
	flex-shrink: 0;
	overflow: hidden;
	border-radius: 3px;
	background: rgb(255 255 255 / 0.04);
	box-shadow:
		0 14px 30px rgb(0 0 0 / 0.55),
		0 0 0 1px rgb(255 255 255 / 0.06);
}
.cover img {
	width: 100%;
	height: 100%;
	object-fit: cover;
	display: block;
	opacity: 0;
	transition: opacity 0.4s ease;
}
.cover img.shown {
	opacity: 1;
}
.ident {
	min-width: 0;
}
.by {
	margin: 0 0 6px;
	font-size: 15px;
	line-height: 1.3;
}
.fp {
	color: var(--color-mono-200);
}
.ln {
	font-weight: 500;
}
.dates {
	margin-left: 10px;
	font-size: 13px;
	font-style: italic;
	color: var(--color-mono-500);
	font-variant-numeric: lining-nums;
}
.title {
	margin: 0;
	font-size: 28px;
	font-weight: 400;
	font-style: italic;
	line-height: 1.1;
	letter-spacing: -0.02em;
	color: #fff;
	text-wrap: balance;
}
.year {
	margin: 8px 0 0;
	font-size: 14px;
	color: #e8d0a8;
	font-variant-numeric: lining-nums;
}

.actions {
	display: flex;
	flex-wrap: wrap;
	gap: 10px;
	margin: 22px 0 8px;
}
.primary,
.secondary {
	display: inline-flex;
	align-items: center;
	gap: 9px;
	min-height: 44px;
	padding: 0 18px;
	border-radius: 10px;
	font: inherit;
	font-size: 15px;
	cursor: pointer;
	transition:
		background-color 0.18s ease,
		border-color 0.18s ease,
		transform 0.12s ease;
}
.primary {
	border: none;
	background: #e8d0a8;
	color: #1a1408;
	font-weight: 600;
}
.primary svg {
	width: 18px;
	height: 18px;
}
.primary:hover {
	background: #f0dcbb;
}
.primary:active,
.secondary:active {
	transform: scale(0.98);
}
.primary.pending {
	opacity: 0.7;
}
.secondary {
	border: 1px solid var(--color-mono-700);
	background: none;
	color: var(--color-mono-100);
}
.secondary:hover {
	border-color: var(--color-mono-500);
}
.secondary:disabled {
	opacity: 0.5;
	cursor: default;
}
.error {
	margin: 4px 0 0;
	font-size: 13.5px;
	color: #fda4af;
}
.description {
	margin: 14px 0 0;
	font-size: 15px;
	line-height: 1.5;
	color: var(--color-mono-300);
}
.writing {
	margin-top: 26px;
}
.images {
	margin-top: 34px;
}

/* ── Motion ───────────────────────────────────────────────────────────── */
.scrim-enter-active,
.scrim-leave-active {
	transition: opacity 0.3s ease;
}
.scrim-enter-from,
.scrim-leave-to {
	opacity: 0;
}
.sheet-enter-from,
.sheet-leave-to {
	transform: translateY(100%);
}
.sheet-leave-active {
	transition: transform 0.28s cubic-bezier(0.4, 0, 1, 1);
}
@media (min-width: 768px) {
	.sheet-enter-from,
	.sheet-leave-to {
		transform: translateX(100%);
	}
}
@media (prefers-reduced-motion: reduce) {
	.sheet,
	.sheet-leave-active,
	.scrim-enter-active,
	.scrim-leave-active {
		transition: none;
	}
}
</style>
