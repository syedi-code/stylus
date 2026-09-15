<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue';
import { EMBED_PARAM_SPECS } from '../../lib/contract';
import type { EmbedParams } from '../../lib/essayTokens';
import {
	useEssayBlocks,
	isEmbedBlock,
	type EmbedBlockKind,
} from '../../composables/useEssayBlocks';
import { usePresentationQuoteMode } from '../../composables/usePresentationQuoteMode';
import EssayBlock from './EssayBlock.vue';
import BlockDeleteConfirm from './blocks/BlockDeleteConfirm.vue';

/**
 * The writing surface. Blocks have two states — display and edit. The editor
 * owns every pointer gesture:
 *   - tap a text block → edit;  tap a foil → select
 *   - press-and-hold any block → select, then keep holding + drag to reorder
 *     (a directional arrow shows above/below; commit on release)
 * A selected block shows an action rail (edit · size · delete). Because display
 * text isn't a form field, holds never trigger the OS text-selection.
 */
const content = defineModel<string>('content', { required: true });

const emit = defineEmits<{
	(e: 'requestInsert', kind: 'quote' | 'book' | 'image'): void;
}>();

const {
	blocks,
	serialized,
	load,
	sync,
	indexOf,
	updateText,
	setParam,
	insertAfter,
	newTextBlock,
	newEmbedBlock,
	remove,
	move,
	split,
	merge,
} = useEssayBlocks(content);

// Writing-view quote surface toggle (textured → fullbleed → plain), shared
// across every quote foil in every essay currently open — mirrors the same
// global-preference pattern the Presentation deck already uses.
const { mode: quoteMode, cycle: cycleQuoteMode } = usePresentationQuoteMode('essay-write');

const activeBid = ref<string | null>(null);
const editingBid = ref<string | null>(null);
const replacingBid = ref<string | null>(null);
const confirmBid = ref<string | null>(null);

// ── Load / external reload ──
onMounted(() => load());
watch(content, (v) => {
	if (v !== serialized.value) {
		load();
		activeBid.value = null;
		editingBid.value = null;
	}
});

// ── Child + wrapper refs ──
type BlockInstance = { focus: (caret?: number) => void; el: () => HTMLTextAreaElement | null };
const blockRefs = new Map<string, BlockInstance>();
const blkEls = new Map<string, HTMLElement>();
function registerBlock(bid: string, el: unknown) {
	if (el) blockRefs.set(bid, el as BlockInstance);
	else blockRefs.delete(bid);
}
function registerBlkEl(bid: string, el: unknown) {
	if (el) blkEls.set(bid, el as HTMLElement);
	else blkEls.delete(bid);
}
function focusText(bid: string, caret?: number) {
	nextTick(() => blockRefs.get(bid)?.focus(caret));
}
function focusBlk(bid: string) {
	nextTick(() => blkEls.get(bid)?.focus());
}

// ── Header numbering ──
const headerLabels = computed(() => {
	const m = new Map<string, string>();
	let n = 0;
	for (const b of blocks.value) {
		if (b.kind === 'header') {
			n += 1;
			m.set(b.bid, `§${n}`);
		}
	}
	return m;
});

// ── Selection / edit state ──
function selectBlock(bid: string) {
	if (editingBid.value && editingBid.value !== bid) exitEdit(editingBid.value);
	activeBid.value = bid;
	editingBid.value = null;
	confirmBid.value = null;
	const b = blocks.value[indexOf(bid)];
	if (b && isEmbedBlock(b)) focusBlk(bid);
}
function editBlock(bid: string) {
	const b = blocks.value[indexOf(bid)];
	if (!b || isEmbedBlock(b)) return;
	activeBid.value = bid;
	editingBid.value = bid;
	confirmBid.value = null;
}
function exitEdit(bid: string) {
	if (editingBid.value === bid) editingBid.value = null;
	// Drop a paragraph left empty.
	const i = indexOf(bid);
	const b = blocks.value[i];
	if (b && b.kind === 'para' && !b.text.trim()) {
		remove(bid);
		if (activeBid.value === bid) activeBid.value = null;
	}
}
function deselectAll() {
	if (editingBid.value) exitEdit(editingBid.value);
	activeBid.value = null;
	editingBid.value = null;
	confirmBid.value = null;
}

// ── Text editing intents ──
function onUpdate(bid: string, text: string) {
	updateText(bid, text);
}
function onEnter(bid: string, caret: number) {
	const nb = split(bid, caret);
	if (nb) {
		activeBid.value = nb;
		editingBid.value = nb;
		focusText(nb, 0);
	}
}
function onMergeBack(bid: string) {
	const r = merge(bid);
	if (r.type === 'merged') {
		activeBid.value = r.bid;
		editingBid.value = r.bid;
		focusText(r.bid, r.caret);
	} else if (r.type === 'selectEmbed') {
		selectBlock(r.bid);
	}
}
function onCross(bid: string, dir: 'up' | 'down', caret: number) {
	const i = indexOf(bid);
	const neighbour = blocks.value[i + (dir === 'up' ? -1 : 1)];
	if (!neighbour) return;
	if (isEmbedBlock(neighbour)) {
		selectBlock(neighbour.bid);
	} else {
		activeBid.value = neighbour.bid;
		editingBid.value = neighbour.bid;
		focusText(neighbour.bid, dir === 'up' ? undefined : Math.min(caret, neighbour.text.length));
	}
}

// Keyboard delete on a selected foil (desktop).
function onBlkKeydown(bid: string, e: KeyboardEvent) {
	const b = blocks.value[indexOf(bid)];
	if (!b || !isEmbedBlock(b)) return;
	if (e.key === 'Backspace' || e.key === 'Delete') {
		e.preventDefault();
		confirmBid.value = bid;
	} else if (e.key === 'Escape') {
		deselectAll();
	}
}

// ── Action rail ──
function railEdit(bid: string) {
	const b = blocks.value[indexOf(bid)];
	if (!b) return;
	if (isEmbedBlock(b)) {
		replacingBid.value = bid;
		emit('requestInsert', b.kind === 'image' ? 'image' : b.kind);
	} else {
		editBlock(bid);
	}
}
function railDelete(bid: string) {
	confirmBid.value = bid;
}
function confirmDelete(bid: string) {
	const i = indexOf(bid);
	remove(bid);
	confirmBid.value = null;
	if (activeBid.value === bid) activeBid.value = null;
	// nudge selection to a neighbour text block
	const near = blocks.value[i] ?? blocks.value[i - 1];
	if (near && !isEmbedBlock(near)) {
		activeBid.value = near.bid;
	}
}

function sizeOf(bid: string): number {
	const b = blocks.value[indexOf(bid)];
	if (!b || !isEmbedBlock(b)) return 0;
	const spec = EMBED_PARAM_SPECS[b.kind].find((s) => s.key === 'size');
	const def = typeof spec?.default === 'number' ? spec.default : 24;
	return Number(b.params.size ?? def);
}
function stepSize(bid: string, dir: 1 | -1) {
	const b = blocks.value[indexOf(bid)];
	if (!b || !isEmbedBlock(b)) return;
	const spec = EMBED_PARAM_SPECS[b.kind].find((s) => s.key === 'size');
	if (!spec) return;
	const min = spec.min ?? 12;
	const max = spec.max ?? 64;
	const next = Math.min(max, Math.max(min, sizeOf(bid) + dir * 2));
	setParam(bid, 'size', next);
}
function hasSize(bid: string): boolean {
	const b = blocks.value[indexOf(bid)];
	return !!b && isEmbedBlock(b) && b.kind !== 'image';
}

// ── Inline formatting (called by the modal's bottom bar) ──
function wrapActiveSelection(before: string, after: string) {
	const bid = editingBid.value;
	if (!bid) return;
	const b = blocks.value[indexOf(bid)];
	if (!b || isEmbedBlock(b)) return;
	const ta = blockRefs.get(bid)?.el() ?? null;
	if (!ta) return;
	const { selectionStart: s, selectionEnd: e, value } = ta;
	const selected = value.slice(s, e);
	const next = `${value.slice(0, s)}${before}${selected}${after}${value.slice(e)}`;
	updateText(bid, next);
	nextTick(() => {
		ta.focus();
		if (selected.length > 0) ta.setSelectionRange(s + before.length, s + before.length + selected.length);
		else {
			const c = s + before.length;
			ta.setSelectionRange(c, c);
		}
	});
}

// ── Add-block picker ──
const showAdd = ref(false);
function chooseBlock(kind: 'text' | 'header' | 'quote' | 'book' | 'image') {
	showAdd.value = false;
	if (kind === 'text') {
		const nb = insertAfter(activeBid.value, newTextBlock('para', ''));
		editBlock(nb);
		focusText(nb, 0);
	} else if (kind === 'header') {
		insertHeaderBlock();
	} else {
		emit('requestInsert', kind);
	}
}

// ── Methods the modal drives ──
function insertHeaderBlock() {
	const nb = insertAfter(activeBid.value, newTextBlock('header', ''));
	editBlock(nb);
	focusText(nb, 0);
}
function insertEmbed(kind: EmbedBlockKind, id: string, params: EmbedParams = {}) {
	if (replacingBid.value) {
		const b = blocks.value[indexOf(replacingBid.value)];
		replacingBid.value = null;
		if (b && isEmbedBlock(b)) {
			b.kind = kind;
			b.id = id;
			b.params = { ...params };
			sync();
			activeBid.value = b.bid;
		}
		return;
	}
	const nb = insertAfter(activeBid.value, newEmbedBlock(kind, id, params));
	activeBid.value = nb;
}

defineExpose({ insertHeaderBlock, insertEmbed, wrapActiveSelection, activeBid });

// ── Pointer gestures (tap / long-press / drag) ──
const dragBid = ref<string | null>(null);
const dragDy = ref(0);
const dragDir = ref<'up' | 'down' | null>(null);
let dropTarget = -1;
let g = { bid: '', x: 0, y: 0, pid: -1, timer: 0, moved: false, dragging: false };

function onPointerDown(bid: string, e: PointerEvent) {
	if (editingBid.value === bid) return; // editing → native text handling
	if ((e.target as HTMLElement)?.closest('.rail')) return;
	g = { bid, x: e.clientX, y: e.clientY, pid: e.pointerId, timer: 0, moved: false, dragging: false };
	g.timer = setTimeout(() => {
		if (!g.moved) startDrag(bid, e.clientY);
	}, 300);
	window.addEventListener('pointermove', onPointerMove);
	window.addEventListener('pointerup', onPointerUp);
	window.addEventListener('pointercancel', onPointerUp);
}
function onPointerMove(e: PointerEvent) {
	if (e.pointerId !== g.pid) return;
	if (g.dragging) {
		dragTo(e.clientY);
		return;
	}
	if (Math.hypot(e.clientX - g.x, e.clientY - g.y) > 10) {
		g.moved = true; // pre-drag movement = a scroll; abandon (no tap, no drag)
		clearTimeout(g.timer);
	}
}
function onPointerUp(e: PointerEvent) {
	if (e.pointerId !== g.pid && e.type !== 'pointercancel') return;
	clearTimeout(g.timer);
	window.removeEventListener('pointermove', onPointerMove);
	window.removeEventListener('pointerup', onPointerUp);
	window.removeEventListener('pointercancel', onPointerUp);
	window.removeEventListener('touchmove', preventTouch);
	if (g.dragging) endDrag();
	else if (!g.moved) onTap(g.bid);
	g.dragging = false;
}
function onTap(bid: string) {
	const b = blocks.value[indexOf(bid)];
	if (!b) return;
	if (isEmbedBlock(b)) selectBlock(bid);
	else editBlock(bid);
}
function preventTouch(e: TouchEvent) {
	if (g.dragging) e.preventDefault();
}
// Cached static midpoints of every block, captured at drag start. Only the
// dragged block moves during a drag, so the rest stay valid — no per-move
// getBoundingClientRect (that layout thrash is what jank an old iPhone).
let dragMids: number[] = [];
let dragFrom = -1;
function startDrag(bid: string, clientY: number) {
	selectBlock(bid);
	g.dragging = true;
	g.y = clientY;
	dragBid.value = bid;
	dragDy.value = 0;
	dragDir.value = null;
	dragFrom = indexOf(bid);
	dropTarget = dragFrom;
	dragMids = blocks.value.map((b) => {
		const el = blkEls.get(b.bid);
		if (!el) return Number.POSITIVE_INFINITY;
		const r = el.getBoundingClientRect();
		return r.top + r.height / 2;
	});
	if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(8);
	window.addEventListener('touchmove', preventTouch, { passive: false });
}
function dragTo(clientY: number) {
	dragDy.value = clientY - g.y;
	// Insertion index = how many OTHER blocks sit above the finger (cached).
	// Excluding the dragged block is what makes downward work — it follows the
	// finger, so counting it stalls the target on its own slot.
	let to = 0;
	for (let i = 0; i < dragMids.length; i++) {
		if (i === dragFrom) continue;
		if (dragMids[i] < clientY) to += 1;
	}
	to = Math.max(0, Math.min(blocks.value.length - 1, to));
	dropTarget = to;
	dragDir.value = to < dragFrom ? 'up' : to > dragFrom ? 'down' : null;
}
function endDrag() {
	window.removeEventListener('touchmove', preventTouch);
	const bid = dragBid.value;
	dragBid.value = null;
	dragDy.value = 0;
	const dir = dragDir.value;
	dragDir.value = null;
	if (bid === null || dropTarget < 0) return;
	const from = indexOf(bid);
	if (dropTarget !== from && dir) {
		move(from, dropTarget);
		activeBid.value = bid;
	}
	dropTarget = -1;
}
</script>

<template>
	<div class="blocks" @click.self="deselectAll">
		<TransitionGroup name="blk" tag="div" class="blk-list">
			<div
				v-for="block in blocks"
				:key="block.bid"
				:ref="(el) => registerBlkEl(block.bid, el)"
				class="blk"
				:class="[
					`k-${block.kind}`,
					{ act: activeBid === block.bid, editing: editingBid === block.bid, drag: dragBid === block.bid },
				]"
				:style="dragBid === block.bid ? { transform: `translateY(${dragDy}px)`, zIndex: 20 } : undefined"
				:tabindex="isEmbedBlock(block) ? 0 : undefined"
				@pointerdown="onPointerDown(block.bid, $event)"
				@keydown="isEmbedBlock(block) ? onBlkKeydown(block.bid, $event) : undefined"
			>
				<!-- directional drag arrows -->
				<div v-if="dragBid === block.bid && dragDir === 'up'" class="dragind up" aria-hidden="true">▲</div>

				<div class="blk-inner">
					<EssayBlock
						:ref="(el) => registerBlock(block.bid, el)"
						:block="block"
						:active="activeBid === block.bid"
						:editing="editingBid === block.bid"
						:hn="headerLabels.get(block.bid)"
						@update="(t) => onUpdate(block.bid, t)"
						@enter="(c) => onEnter(block.bid, c)"
						@merge-back="onMergeBack(block.bid)"
						@cross="(d, c) => onCross(block.bid, d, c)"
						@exit-edit="exitEdit(block.bid)"
					/>
				</div>

				<div v-if="dragBid === block.bid && dragDir === 'down'" class="dragind down" aria-hidden="true">▼</div>

				<!-- action rail (selected, not editing) -->
				<div
					v-if="activeBid === block.bid && editingBid !== block.bid && dragBid !== block.bid"
					class="rail"
				>
					<button type="button" class="ra" title="Edit" @click.stop="railEdit(block.bid)">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></svg>
					</button>
					<div v-if="hasSize(block.bid)" class="ra-size">
						<button type="button" class="rs" title="Smaller" @click.stop="stepSize(block.bid, -1)">−</button>
						<span class="rv">{{ sizeOf(block.bid) }}</span>
						<button type="button" class="rs" title="Larger" @click.stop="stepSize(block.bid, 1)">+</button>
					</div>
					<button
						v-if="block.kind === 'quote'"
						type="button"
						class="ra"
						:class="{ active: quoteMode !== 'plain' }"
						:title="`Surface: ${quoteMode} — tap to change`"
						@click.stop="cycleQuoteMode()"
					>
						<svg v-if="quoteMode === 'textured'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="1.6" fill="currentColor" stroke="none" /><path d="m21 15-4.5-4.5L7 20" /></svg>
						<svg v-else-if="quoteMode === 'fullbleed'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3" /><path d="M16 3h3a2 2 0 0 1 2 2v3" /><path d="M21 16v3a2 2 0 0 1-2 2h-3" /><path d="M3 16v3a2 2 0 0 0 2 2h3" /></svg>
						<svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16" /><path d="M4 12h16" /><path d="M4 18h10" /></svg>
					</button>
					<button type="button" class="ra danger" title="Delete" @click.stop="railDelete(block.bid)">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14" /></svg>
					</button>

					<BlockDeleteConfirm
						v-if="confirmBid === block.bid"
						:label="isEmbedBlock(block) ? 'Remove this source?' : 'Delete this block?'"
						@confirm="confirmDelete(block.bid)"
						@cancel="confirmBid = null"
					/>
				</div>
			</div>
		</TransitionGroup>

		<button type="button" class="addblk" @click="showAdd = true">＋ Add block</button>

		<!-- keeps the last block + Add above the keyboard / bottom bar -->
		<div class="tail" aria-hidden="true"></div>
	</div>

	<!-- add-block type picker -->
	<Teleport to="body">
		<div v-if="showAdd" class="add-scrim" @click="showAdd = false">
			<div class="add-sheet" @click.stop>
				<div class="add-title">Add a block</div>
				<div class="add-grid">
					<button type="button" class="ab" @click="chooseBlock('text')"><span class="ab-g">¶</span>Text</button>
					<button type="button" class="ab" @click="chooseBlock('header')"><span class="ab-g">＃</span>Header</button>
					<button type="button" class="ab" @click="chooseBlock('quote')"><span class="ab-g">❝</span>Quote</button>
					<button type="button" class="ab" @click="chooseBlock('book')"><span class="ab-g">▤</span>Book</button>
					<button type="button" class="ab" @click="chooseBlock('image')"><span class="ab-g">▦</span>Image</button>
				</div>
			</div>
		</div>
	</Teleport>
</template>

<style scoped>
.blocks {
	position: relative;
	padding: 12px 8px 2px;
}
@media (min-width: 640px) {
	.blk-list {
		max-width: 680px;
		margin: 0 auto;
	}
}

.blk {
	position: relative;
	padding: 2px 6px;
	margin: 8px 0;
	border-radius: 12px;
	outline: none;
	transition: background 0.18s ease;
}
.blk.act {
	background: rgba(232, 160, 64, 0.05);
}
.blk.drag {
	background: transparent;
	will-change: transform;
	cursor: grabbing;
}

/* content wrapper — carries the select "expand" so it never collides with the
   drag translateY (on .blk) or the FLIP move transform (also on .blk) */
.blk-inner {
	transform: translateZ(0);
	transition: transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
	transform-origin: center;
}
.blk.act.k-quote .blk-inner,
.blk.act.k-book .blk-inner,
.blk.act.k-image .blk-inner {
	transform: scale(1.03);
}

/* directional drag arrows */
.dragind {
	position: absolute;
	left: 50%;
	transform: translateX(-50%);
	color: var(--color-essay);
	font-size: 12px;
	text-shadow: 0 0 8px rgba(232, 160, 64, 0.6);
	pointer-events: none;
	z-index: 25;
}
.dragind.up {
	top: -14px;
}
.dragind.down {
	bottom: -14px;
}

/* action rail */
.rail {
	position: absolute;
	top: -15px;
	right: 4px;
	z-index: 30;
	display: inline-flex;
	align-items: center;
	gap: 2px;
	padding: 3px;
	background: #0d0b08;
	border: 1px solid #241d12;
	border-radius: 10px;
	box-shadow: 0 8px 22px rgba(0, 0, 0, 0.55);
}
.ra {
	width: 30px;
	height: 30px;
	display: grid;
	place-items: center;
	border: none;
	background: transparent;
	color: var(--color-mono-300);
	border-radius: 7px;
	cursor: pointer;
	transition: background 0.15s, color 0.15s;
}
.ra svg {
	width: 15px;
	height: 15px;
}
.ra:hover {
	background: var(--color-mono-800);
	color: var(--color-essay);
}
.ra.danger:hover {
	color: var(--color-rose);
	background: rgba(244, 63, 94, 0.12);
}
.ra.active {
	color: var(--color-essay);
}
.ra-size {
	display: inline-flex;
	align-items: center;
	gap: 1px;
	padding: 0 2px;
	border-left: 1px solid #241d12;
	border-right: 1px solid #241d12;
	margin: 0 1px;
}
.rs {
	width: 26px;
	height: 30px;
	display: grid;
	place-items: center;
	border: none;
	background: transparent;
	color: var(--color-mono-400);
	font-size: 16px;
	cursor: pointer;
	border-radius: 6px;
	transition: color 0.15s, background 0.15s;
}
.rs:hover {
	color: var(--color-essay);
	background: var(--color-mono-800);
}
.rv {
	min-width: 22px;
	text-align: center;
	font-size: 12px;
	font-weight: 700;
	color: var(--color-mono-100);
	font-variant-numeric: lining-nums;
}

.addblk {
	display: flex;
	align-items: center;
	gap: 8px;
	margin: 14px auto 0;
	padding: 10px 16px;
	font-size: 13px;
	color: var(--color-mono-400);
	border: 1px dashed var(--color-mono-700);
	border-radius: 12px;
	cursor: pointer;
	width: fit-content;
	background: transparent;
	transition: color 0.15s, border-color 0.15s;
}
.addblk:hover {
	color: var(--color-essay);
	border-color: var(--color-essay);
}
.tail {
	height: 40vh;
}

/* FLIP glide on reorder */
.blk-move {
	transition: transform 0.28s cubic-bezier(0.2, 0.8, 0.2, 1);
}

/* add-block picker */
.add-scrim {
	position: fixed;
	inset: 0;
	z-index: 60;
	background: rgba(0, 0, 0, 0.66);
	display: flex;
	align-items: flex-end;
	justify-content: center;
}
@media (min-width: 640px) {
	.add-scrim {
		align-items: center;
	}
}
.add-sheet {
	width: 100%;
	max-width: 440px;
	background: #0d0b08;
	border: 1px solid #241d12;
	border-radius: 20px 20px 0 0;
	padding: 16px 16px calc(20px + env(safe-area-inset-bottom));
	box-shadow: 0 -20px 60px rgba(0, 0, 0, 0.7);
}
@media (min-width: 640px) {
	.add-sheet {
		border-radius: 18px;
		margin-bottom: 0;
	}
}
.add-title {
	font-size: 12px;
	letter-spacing: 0.1em;
	text-transform: uppercase;
	color: var(--color-mono-500);
	margin-bottom: 12px;
	text-align: center;
}
.add-grid {
	display: grid;
	grid-template-columns: repeat(5, 1fr);
	gap: 8px;
}
@media (max-width: 400px) {
	.add-grid {
		grid-template-columns: repeat(3, 1fr);
	}
}
.ab {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 6px;
	padding: 14px 6px;
	background: #15110a;
	border: 1px solid #241d12;
	border-radius: 13px;
	color: var(--color-mono-200);
	font-size: 12px;
	cursor: pointer;
	transition: border-color 0.15s, color 0.15s, background 0.15s;
}
.ab:hover {
	border-color: var(--color-essay);
	color: var(--color-essay);
	background: #1e1810;
}
.ab-g {
	font-size: 20px;
	color: var(--color-mono-500);
	line-height: 1;
}
.ab:hover .ab-g {
	color: var(--color-essay);
}
</style>
