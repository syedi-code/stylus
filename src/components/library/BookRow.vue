<script setup lang="ts">
import { computed } from 'vue';
import type { LibraryBook } from '../../lib/api';
import { parseAuthors } from '../../lib/bookAttribution';
import { addedLabel, highlight } from '../../lib/library';
import { usePdfOpener } from '../../composables/usePdfOpener';

const props = defineProps<{
	book: LibraryBook;
	query: string;
	/** First book of a new author under the author sort. */
	startsRun: boolean;
	/** Open in the book sheet right now. */
	open: boolean;
	/** Just added or edited — glows once as it settles into place. */
	fresh: boolean;
}>();

const emit = defineEmits<{ (e: 'open', book: LibraryBook): void }>();

const { opening, openPdf, prefetchPdf } = usePdfOpener();

const titleParts = computed(() => highlight(props.book.title, props.query));
const authors = computed(() => parseAuthors(props.book.author));
/** Author text matched by the query, marked on the whole name when it hits. */
const authorMatched = computed(() => highlight(props.book.author, props.query).some((s) => s.match));

const writing = computed(() => {
	const { quote_count: q, note_count: n } = props.book;
	const parts: string[] = [];
	if (q) parts.push(`${q} ${q === 1 ? 'quote' : 'quotes'}`);
	if (n) parts.push(`${n} ${n === 1 ? 'note' : 'notes'}`);
	return parts.join(', ');
});

const added = computed(() => addedLabel(props.book.created_at));
const pending = computed(() => opening.value === props.book.id);

function onKey(e: KeyboardEvent) {
	if (e.key === 'Enter' || e.key === ' ') {
		e.preventDefault();
		emit('open', props.book);
	}
}
</script>

<template>
	<div
		class="row"
		:class="{ open, fresh, 'starts-run': startsRun }"
		role="button"
		tabindex="0"
		:aria-label="`${book.title} by ${book.author}`"
		@click="emit('open', book)"
		@keydown="onKey"
	>
		<span class="title">
			<template v-for="(s, i) in titleParts" :key="i"><mark v-if="s.match">{{ s.text }}</mark><template v-else>{{ s.text }}</template></template>
		</span>

		<span class="author" :class="{ matched: authorMatched }">
			<template v-for="(a, i) in authors" :key="i"><span v-if="i > 0" class="fp"> &amp; </span><span class="fp">{{ a.firstParts }}</span><span class="ln" :style="{ color: a.color }">{{ a.lastName }}</span><span v-if="a.suffix" class="fp">{{ a.suffix }}</span></template>
			<span v-if="book.originally_published" class="m-year">, {{ book.originally_published }}</span>
		</span>

		<span class="year">{{ book.originally_published }}</span>

		<span class="writing">{{ writing }}</span>

		<span class="glyphs" aria-hidden="true">
			<span v-if="book.quote_count"><i>“</i>{{ book.quote_count }}</span>
			<span v-if="book.note_count"><i>¶</i>{{ book.note_count }}</span>
		</span>

		<span class="added">{{ added }}</span>

		<span class="pdf-cell">
			<button
				v-if="book.has_pdf"
				type="button"
				class="pdf"
				:class="{ pending }"
				:aria-label="`Open the PDF of ${book.title}`"
				title="Open PDF"
				@click.stop="openPdf(book.id, book.pdf_url)"
				@pointerenter="prefetchPdf(book.pdf_url)"
				@touchstart.passive="prefetchPdf(book.pdf_url)"
			>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
					<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
					<path d="M14 3v5h5" />
					<path d="M9 13h6M9 17h4" />
				</svg>
			</button>
		</span>
	</div>
</template>

<style scoped>
/* ── Mobile first: two lines, title over author, PDF to the right ───────── */
.row {
	position: relative;
	display: grid;
	grid-template-columns: minmax(0, 1fr) auto;
	grid-template-areas:
		'title pdf'
		'meta  pdf';
	align-items: center;
	column-gap: 12px;
	row-gap: 3px;
	padding: 11px 16px 12px;
	cursor: pointer;
	border-bottom: 1px solid rgb(255 255 255 / 0.045);
	transition: background-color 0.18s ease;
	-webkit-tap-highlight-color: transparent;
	outline: none;
}
@media (hover: hover) {
	.row:hover {
		background: rgb(255 255 255 / 0.025);
	}
	.pdf:hover {
		background: rgb(232 208 168 / 0.12);
	}
}
.row:active {
	background: rgb(255 255 255 / 0.045);
}
.row:focus-visible {
	box-shadow: inset 0 0 0 1px rgb(232 208 168 / 0.55);
}
.row.open {
	background: rgb(232 208 168 / 0.06);
	box-shadow: inset 2px 0 0 #e8d0a8;
}
/* A new author gets a little more air above it, so runs read as groups
   without the weight of a heading. */
.row.starts-run {
	margin-top: 6px;
}
/* The one moment of colour: a book you just saved glows as it lands. */
.row.fresh {
	animation: land 2.2s cubic-bezier(0.22, 1, 0.36, 1);
}
@keyframes land {
	0%,
	25% {
		background: rgb(232 208 168 / 0.16);
	}
	100% {
		background: transparent;
	}
}

.title {
	grid-area: title;
	font-size: 16px;
	font-style: italic;
	line-height: 1.25;
	color: #fff;
	letter-spacing: -0.005em;
	display: -webkit-box;
	-webkit-line-clamp: 2;
	-webkit-box-orient: vertical;
	overflow: hidden;
}
mark {
	background: none;
	color: #e8d0a8;
	text-decoration: underline;
	text-decoration-color: rgb(232 208 168 / 0.45);
	text-underline-offset: 3px;
}

/* Mobile meta line: author, year, then the writing glyphs pushed right. */
.author,
.year,
.glyphs {
	grid-area: meta;
	font-size: 13px;
	line-height: 1.35;
}
.author {
	min-width: 0;
	overflow: hidden;
	white-space: nowrap;
	text-overflow: ellipsis;
	padding-right: 64px;
}
.fp {
	color: var(--color-mono-300);
}
.ln {
	font-weight: 500;
}
.author.matched .fp,
.author.matched .ln {
	text-decoration: underline;
	text-decoration-color: rgb(232 208 168 / 0.45);
	text-underline-offset: 3px;
}
.year {
	display: none;
}
.m-year {
	color: var(--color-mono-500);
	font-variant-numeric: lining-nums tabular-nums;
}
.glyphs {
	justify-self: end;
	display: flex;
	gap: 10px;
	color: var(--color-mono-400);
	font-variant-numeric: lining-nums tabular-nums;
	font-size: 12px;
}
.glyphs i {
	font-style: normal;
	color: var(--color-mono-600);
	margin-right: 2px;
}
.writing,
.added {
	display: none;
}

.pdf-cell {
	grid-area: pdf;
	display: flex;
	justify-content: flex-end;
	width: 44px;
}
.pdf {
	width: 44px;
	height: 44px;
	margin: -6px -8px -6px 0;
	display: grid;
	place-items: center;
	border-radius: 10px;
	color: #e8d0a8;
	background: transparent;
	border: none;
	cursor: pointer;
	transition:
		background-color 0.18s ease,
		color 0.18s ease;
}
.pdf svg {
	width: 20px;
	height: 20px;
}
.pdf:active {
	background: rgb(232 208 168 / 0.16);
}
.pdf:focus-visible {
	outline: 1px solid rgb(232 208 168 / 0.7);
}
.pdf.pending svg {
	animation: breathe 0.9s ease-in-out infinite alternate;
}
@keyframes breathe {
	to {
		opacity: 0.35;
	}
}

/* ── Desktop: one line, a catalogue index ─────────────────────────────── */
@media (min-width: 768px) {
	.row {
		grid-template-columns: var(--lib-cols);
		grid-template-areas: none;
		column-gap: var(--lib-gap);
		padding: 10px 14px;
		align-items: baseline;
	}
	.row.starts-run {
		margin-top: 0;
		border-top: 1px solid rgb(255 255 255 / 0.06);
	}
	.title,
	.author,
	.year,
	.writing,
	.added,
	.pdf-cell {
		grid-area: auto;
	}
	.title {
		display: block;
		white-space: nowrap;
		text-overflow: ellipsis;
		font-size: 15.5px;
	}
	.author {
		align-self: center;
		padding-right: 0;
		font-size: 14px;
	}
	.year {
		display: block;
		font-size: 13px;
		color: var(--color-mono-400);
		font-variant-numeric: lining-nums tabular-nums;
	}
	.glyphs,
	.m-year {
		display: none;
	}
	.writing {
		display: block;
		font-size: 12.5px;
		color: var(--color-mono-400);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.added {
		display: block;
		font-size: 12.5px;
		color: var(--color-mono-500);
		white-space: nowrap;
	}
	.pdf-cell {
		align-self: center;
		width: auto;
	}
	.pdf {
		width: 32px;
		height: 32px;
		margin: -6px -6px -6px 0;
		border-radius: 8px;
	}
	.pdf svg {
		width: 17px;
		height: 17px;
	}
}

@media (prefers-reduced-motion: reduce) {
	.row.fresh,
	.pdf.pending svg {
		animation: none;
	}
}
</style>
