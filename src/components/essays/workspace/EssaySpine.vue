<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Essay } from '../../../lib/api';
import { parseBlocks, isEmbedBlock, type EditorBlock } from '../../../composables/useEssayBlocks';
import { essayName, essayWordCount, relativeDate } from '../../../lib/essayDisplay';

/**
 * The spine — navigation for the whole Essays tab.
 *
 * It replaced the essay index outright, so it carries both jobs at once:
 *
 *   PIECES     every essay, with a miniature deck rail showing its shape
 *   THIS PIECE the current essay's blocks, as an outline you can jump around
 *
 * The mini rail is the idea worth keeping. An essay here IS a deck — one block
 * per slide — and the median piece in the corpus is four blocks long, so four
 * ticks describe a whole essay honestly: dim for prose, amber for a source.
 * You can see at a glance which pieces are quote-heavy and which are still a
 * paragraph of throat-clearing, which a title and a date never told you.
 *
 * Docked on a wide screen; a drawer behind a hamburger below that.
 */
const props = defineProps<{
	essays: Essay[];
	currentId?: string | null;
	/** The live block list of the open piece — outlines what is being edited,
	 *  not what was last saved. */
	currentBlocks?: EditorBlock[];
	loading?: boolean;
	loadingMore?: boolean;
	error?: string | null;
	isAdmin?: boolean;
}>();

const emit = defineEmits<{
	(e: 'open', essay: Essay): void;
	(e: 'new'): void;
	(e: 'goToBlock', bid: string): void;
	(e: 'copy', essay: Essay): void;
	(e: 'delete', essay: Essay): void;
	(e: 'addToThread', essay: Essay): void;
	(e: 'loadMore'): void;
	(e: 'retry'): void;
}>();

const filter = ref('');
const menuFor = ref<string | null>(null);

interface Row {
	essay: Essay;
	name: string;
	untitled: boolean;
	words: number;
	when: string;
	/** One tick per block: true = a source (quote/book/image). */
	ticks: boolean[];
}

const rows = computed<Row[]>(() => {
	const q = filter.value.trim().toLowerCase();
	return props.essays
		.filter((e) => !q || (e.content ?? '').toLowerCase().includes(q))
		.map((e) => {
			const n = essayName(e.content ?? '');
			// Cap the rail: past a dozen the shape reads the same and the row
			// would start to wrap.
			const blocks = parseBlocks(e.content ?? '').slice(0, 12);
			return {
				essay: e,
				name: n.name,
				untitled: n.untitled,
				words: essayWordCount(e.content ?? ''),
				when: relativeDate(e.updated_at ?? e.created_at ?? ''),
				ticks: blocks.map((b) => isEmbedBlock(b)),
			};
		});
});

/** The open piece's outline. Embeds show what they are; prose shows its opening. */
const outline = computed(() =>
	(props.currentBlocks ?? []).map((b, i) => ({
		bid: b.bid,
		n: i + 1,
		kind: b.kind,
		label: isEmbedBlock(b)
			? b.kind
			: (b.text.replace(/[*_`#<>{}]/g, '').trim() || (b.kind === 'header' ? 'Untitled section' : 'Empty')),
	}))
);

const GLYPH: Record<string, string> = {
	quote: '❝',
	book: '▤',
	image: '▦',
	header: '＃',
	para: '¶',
};

function toggleMenu(id: string) {
	menuFor.value = menuFor.value === id ? null : id;
}
function act(fn: () => void) {
	menuFor.value = null;
	fn();
}
</script>

<template>
	<aside class="spine" @click="menuFor = null">
		<!-- Wordmark + new -->
		<div class="sp-top">
			<span class="mark">Essays</span>
			<span class="ct">{{ essays.length }}</span>
			<button type="button" class="newbtn" title="Write a new essay" @click.stop="emit('new')">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14" /><path d="M5 12h14" /></svg>
				<span>Write</span>
			</button>
		</div>

		<input v-model="filter" class="filter" placeholder="Filter pieces…" @click.stop />

		<!-- ── Pieces ── -->
		<div class="sec"><span>Pieces</span></div>

		<div v-if="loading" class="hint">Loading…</div>
		<div v-else-if="error" class="hint err">
			{{ error }}
			<button type="button" @click.stop="emit('retry')">Retry</button>
		</div>
		<div v-else-if="!rows.length" class="hint">
			{{ filter ? 'Nothing matches.' : 'No pieces yet.' }}
		</div>

		<button
			v-for="r in rows"
			:key="r.essay.id"
			type="button"
			class="piece"
			:class="{ here: r.essay.id === currentId }"
			@click.stop="emit('open', r.essay)"
		>
			<span class="pt" :class="{ untitled: r.untitled }">{{ r.name }}</span>

			<!-- The shape of the piece, one tick per slide. -->
			<span class="rail" aria-hidden="true">
				<i v-for="(src, i) in r.ticks" :key="i" :class="{ src }"></i>
			</span>

			<span class="pm">
				<span>{{ r.ticks.length }} {{ r.ticks.length === 1 ? 'slide' : 'slides' }}</span>
				<span class="dot"></span>
				<span>{{ r.words }}w</span>
				<span class="dot"></span>
				<span>{{ r.when }}</span>
			</span>

			<span class="kebab" title="More" @click.stop="toggleMenu(r.essay.id)">⋯</span>

			<span v-if="menuFor === r.essay.id" class="menu" @click.stop>
				<button type="button" @click="act(() => emit('copy', r.essay))">Copy text</button>
				<button type="button" @click="act(() => emit('addToThread', r.essay))">Add to thread…</button>
				<button v-if="isAdmin" type="button" class="danger" @click="act(() => emit('delete', r.essay))">Delete</button>
			</span>
		</button>

		<button v-if="!loading && rows.length && !filter" type="button" class="more" :disabled="loadingMore" @click.stop="emit('loadMore')">
			{{ loadingMore ? 'Loading…' : 'Load more' }}
		</button>

		<!-- ── This piece ── -->
		<template v-if="outline.length">
			<div class="sec"><span>This piece</span></div>
			<button
				v-for="o in outline"
				:key="o.bid"
				type="button"
				class="oitem"
				:class="o.kind"
				@click.stop="emit('goToBlock', o.bid)"
			>
				<span class="g">{{ GLYPH[o.kind] ?? '¶' }}</span>
				<span class="lbl">{{ o.label }}</span>
				<span class="n">{{ o.n }}</span>
			</button>
		</template>
	</aside>
</template>

<style scoped>
.spine {
	width: 100%;
	height: 100%;
	min-height: 0;
	overflow-y: auto;
	background: #08070b;
	border-right: 1px solid var(--color-mono-800);
	padding: 12px 10px 28px;
	scrollbar-width: none;
}
.spine::-webkit-scrollbar {
	display: none;
}

.sp-top {
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 2px 6px 10px;
}
.mark {
	font-size: 13px;
	font-weight: 600;
	font-style: italic;
	color: var(--color-essay);
	letter-spacing: -0.01em;
}
.ct {
	font-size: 10px;
	color: var(--color-mono-600);
	font-variant-numeric: lining-nums;
}
.newbtn {
	margin-left: auto;
	display: inline-flex;
	align-items: center;
	gap: 5px;
	padding: 5px 10px;
	border-radius: 999px;
	border: none;
	background: var(--color-essay);
	color: var(--color-essay-text);
	font: inherit;
	font-size: 11px;
	font-weight: 600;
	cursor: pointer;
	box-shadow: inset 0 1px 0 rgb(255 245 220 / 0.5);
}
.newbtn svg {
	width: 12px;
	height: 12px;
}
.newbtn:hover {
	background: var(--color-essay-bright);
}

.filter {
	width: 100%;
	margin-bottom: 4px;
	padding: 7px 10px;
	border-radius: 9px;
	border: 1px solid var(--color-mono-800);
	background: #0c0b10;
	color: var(--color-mono-200);
	font: inherit;
	font-size: 12px;
	outline: none;
}
.filter:focus {
	border-color: var(--color-essay);
}
.filter::placeholder {
	color: var(--color-mono-600);
	font-style: italic;
}

.sec {
	display: flex;
	align-items: center;
	gap: 9px;
	padding: 16px 6px 7px;
	font-size: 9px;
	font-weight: 600;
	letter-spacing: 0.18em;
	text-transform: uppercase;
	color: var(--color-mono-600);
}
.sec::after {
	content: '';
	flex: 1;
	height: 1px;
	background: var(--color-mono-800);
}

.hint {
	padding: 8px 6px;
	font-size: 11.5px;
	font-style: italic;
	color: var(--color-mono-600);
}
.hint.err {
	color: #ff8fa3;
	font-style: normal;
}
.hint button {
	margin-left: 8px;
	border: none;
	background: transparent;
	color: var(--color-essay);
	font: inherit;
	font-size: 11.5px;
	cursor: pointer;
	text-decoration: underline;
}

/* ── A piece ── */
.piece {
	position: relative;
	display: block;
	width: 100%;
	text-align: left;
	border: none;
	background: transparent;
	cursor: pointer;
	font: inherit;
	padding: 8px 26px 9px 10px;
	border-radius: 10px;
	color: inherit;
}
.piece:hover {
	background: #0e0d12;
}
/* The open piece wears the amber thread. */
.piece.here {
	background: rgb(232 160 64 / 0.06);
	box-shadow: inset 2px 0 0 var(--color-essay);
}
.pt {
	display: block;
	font-size: 12.5px;
	line-height: 1.3;
	color: var(--color-mono-200);
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}
.piece.here .pt {
	color: var(--color-mono-50);
}
.pt.untitled {
	font-style: italic;
	color: var(--color-mono-400);
}

/* The mini deck rail — the shape of the piece at a glance. */
.rail {
	display: flex;
	gap: 2px;
	margin: 6px 0 5px;
}
.rail i {
	flex: 1;
	max-width: 14px;
	height: 2px;
	border-radius: 999px;
	background: var(--color-mono-700);
}
.rail i.src {
	background: var(--color-essay);
}

.pm {
	display: flex;
	align-items: center;
	gap: 6px;
	font-size: 10px;
	color: var(--color-mono-600);
	font-variant-numeric: lining-nums;
}
.pm .dot {
	width: 2px;
	height: 2px;
	border-radius: 50%;
	background: var(--color-mono-700);
}

.kebab {
	position: absolute;
	top: 6px;
	right: 4px;
	width: 22px;
	height: 22px;
	display: grid;
	place-items: center;
	border-radius: 6px;
	color: var(--color-mono-600);
	font-size: 14px;
	opacity: 0;
	transition: opacity 0.15s;
}
.piece:hover .kebab,
.piece.here .kebab {
	opacity: 1;
}
.kebab:hover {
	background: var(--color-mono-800);
	color: var(--color-mono-100);
}
/* No hover on touch — always reachable there. */
@media (hover: none) {
	.kebab {
		opacity: 1;
	}
}

.menu {
	position: absolute;
	top: 26px;
	right: 4px;
	z-index: 30;
	display: flex;
	flex-direction: column;
	min-width: 150px;
	padding: 4px;
	border-radius: 10px;
	border: 1px solid var(--color-mono-800);
	background: #131218;
	box-shadow: 0 14px 34px rgb(0 0 0 / 0.6);
}
.menu button {
	text-align: left;
	border: none;
	background: transparent;
	color: var(--color-mono-300);
	font: inherit;
	font-size: 12px;
	padding: 7px 9px;
	border-radius: 7px;
	cursor: pointer;
}
.menu button:hover {
	background: var(--color-mono-800);
	color: var(--color-mono-50);
}
.menu button.danger:hover {
	background: rgb(244 63 94 / 0.16);
	color: #ff8fa3;
}

.more {
	width: 100%;
	margin-top: 8px;
	padding: 8px;
	border: 1px solid var(--color-mono-800);
	border-radius: 9px;
	background: transparent;
	color: var(--color-mono-400);
	font: inherit;
	font-size: 11.5px;
	cursor: pointer;
}
.more:hover:not(:disabled) {
	border-color: var(--color-mono-600);
	color: var(--color-mono-100);
}
.more:disabled {
	opacity: 0.5;
	cursor: default;
}

/* ── Outline of the open piece ── */
.oitem {
	display: flex;
	align-items: baseline;
	gap: 8px;
	width: 100%;
	text-align: left;
	border: none;
	background: transparent;
	cursor: pointer;
	font: inherit;
	font-size: 11.5px;
	color: var(--color-mono-400);
	padding: 5px 8px;
	border-radius: 7px;
}
.oitem:hover {
	background: #0e0d12;
	color: var(--color-mono-100);
}
.oitem .g {
	flex: 0 0 auto;
	width: 12px;
	color: var(--color-mono-600);
	font-size: 10px;
}
.oitem .lbl {
	flex: 1;
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}
.oitem .n {
	flex: 0 0 auto;
	font-size: 9px;
	color: var(--color-mono-700);
	font-variant-numeric: lining-nums;
}
/* Sources carry the amber; prose stays quiet. */
.oitem.quote .g,
.oitem.book .g,
.oitem.image .g {
	color: var(--color-essay);
}
.oitem.quote .lbl,
.oitem.book .lbl,
.oitem.image .lbl {
	font-style: italic;
	text-transform: capitalize;
}
.oitem.header .lbl {
	color: var(--color-mono-200);
	font-weight: 500;
}
</style>
