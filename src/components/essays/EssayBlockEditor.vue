<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue';
import { EMBED_PARAM_SPECS, type EmbedParams } from '@antisocial/core';
import {
	useEssayBlocks,
	isEmbedBlock,
	type EmbedBlockKind,
} from '../../composables/useEssayBlocks';
import { usePresentationQuoteMode } from '../../composables/usePresentationQuoteMode';
import EssayBlock from './EssayBlock.vue';
import { joinClassMap, type PastedQuote } from '../../lib/essayWorkspace';
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
	/** Keystrokes are landing — the modal retracts its chrome while writing. */
	(e: 'typing'): void;
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

/** How each block joins the one above it — see lib/essayWorkspace. */
const joinClasses = computed(() => joinClassMap(blocks.value));

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

/**
 * The insert seam.
 *
 * Before this, a new block could only be added after the SELECTED block, so
 * putting a quote between two existing paragraphs meant selecting the right
 * one first and hoping. The seam makes the gap itself the target: every join
 * between two blocks (and the two ends) is a hit area that opens the insert
 * rail aimed at exactly that position.
 *
 * `seamIndex` is the index the new block takes, i.e. the number of blocks
 * above the seam. null means no seam is open and inserts go after the
 * selection as before.
 */
const seamIndex = ref<number | null>(null);

function openSeam(i: number) {
	seamIndex.value = seamIndex.value === i ? null : i;
	activeBid.value = null;
	editingBid.value = null;
}
function closeSeam() {
	seamIndex.value = null;
}
/** Where a new block should land, honouring an open seam. */
function insertAt(): string | null {
	if (seamIndex.value === null) return activeBid.value;
	const i = seamIndex.value;
	// insertAfter(null) prepends; otherwise after the block above the seam.
	return i === 0 ? null : (blocks.value[i - 1]?.bid ?? null);
}

// ── Slash commands ──
function onSlash(bid: string, kind: 'quote' | 'section' | 'book' | 'image') {
	// The command was typed into this block, so the new thing belongs here.
	activeBid.value = bid;
	seamIndex.value = null;
	if (kind === 'section') {
		const b = blocks.value[indexOf(bid)];
		// An empty paragraph that asked to be a header just becomes one.
		if (b && !isEmbedBlock(b) && !b.text.trim()) {
			b.kind = 'header';
			sync();
			editBlock(bid);
			focusText(bid, 0);
			return;
		}
		insertHeaderBlock();
		return;
	}
	emit('requestInsert', kind);
}

// ── Paste-to-quote ──
/** The pending offer: set the pasted passage as a real quote instead of prose. */
const pasted = ref<{ bid: string; payload: PastedQuote } | null>(null);
function onPastedQuote(bid: string, payload: PastedQuote) {
	pasted.value = { bid, payload };
}
function dismissPaste() {
	pasted.value = null;
}
/** Hand the parsed passage to the embed sheet, pre-filled. */
function acceptPaste() {
	const p = pasted.value;
	pasted.value = null;
	if (!p) return;
	activeBid.value = p.bid;
	emit('requestInsert', 'quote');
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
		const nb = insertAfter(insertAt(), newTextBlock('para', ''));
		closeSeam();
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
	const nb = insertAfter(insertAt(), newTextBlock('header', ''));
	closeSeam();
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
	const nb = insertAfter(insertAt(), newEmbedBlock(kind, id, params));
	closeSeam();
	activeBid.value = nb;
}

/**
 * Scroll a block into view and select it. The deck rail in the modal header
 * drives this — tapping a segment goes to its slide.
 */
function goToBlock(bid: string) {
	const el = blkEls.get(bid);
	if (!el) return;
	activeBid.value = bid;
	el.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

defineExpose({
	insertHeaderBlock,
	insertEmbed,
	wrapActiveSelection,
	activeBid,
	blocks,
	goToBlock,
	seamIndex,
	closeSeam,
});

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
			<template v-for="(block, i) in blocks" :key="block.bid">
			<!-- The gap ABOVE each block is itself an insert target, so a
			     quote can land between two existing paragraphs without first
			     selecting the right one and hoping. -->
			<div
				class="seam"
				:class="{ open: seamIndex === i }"
				role="button"
				:aria-label="`Insert before block ${i + 1}`"
				@click.stop="openSeam(i)"
			>
				<span class="ln"></span>
				<span class="plus">＋</span>
			</div>
			<div
				:ref="(el) => registerBlkEl(block.bid, el)"
				class="blk"
				:class="[
					`k-${block.kind}`,
					joinClasses.get(block.bid),
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
						:last="i === blocks.length - 1"
						@update="(t) => onUpdate(block.bid, t)"
						@enter="(c) => onEnter(block.bid, c)"
						@merge-back="onMergeBack(block.bid)"
						@cross="(d, c) => onCross(block.bid, d, c)"
						@exit-edit="exitEdit(block.bid)"
						@typing="emit('typing')"
						@slash="(k) => onSlash(block.bid, k)"
						@pasted-quote="(pq) => onPastedQuote(block.bid, pq)"
					/>
				</div>

				<div v-if="dragBid === block.bid && dragDir === 'down'" class="dragind down" aria-hidden="true">▼</div>

				<!-- Action rail — EMBEDS ONLY. Prose never gets a floating
				     toolbar: it is the per-block chrome that made this feel
				     like data entry, and reordering paragraphs by drag is a
				     thing people almost never want and often trigger by
				     accident. Prose reorders from the spine instead. -->
				<div
					v-if="isEmbedBlock(block) && activeBid === block.bid && editingBid !== block.bid && dragBid !== block.bid"
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

				<!-- Paste-to-quote. Pasting a passage with its attribution is
				     how most quotes arrive; retyping it into the sheet was the
				     slowest path in the editor. -->
				<div v-if="pasted && pasted.bid === block.bid" class="pq">
					<span class="pq-txt">
						That looks like a quote<template v-if="pasted.payload.creator">
						by <b>{{ pasted.payload.creator }}</b></template>. Set it as one?
					</span>
					<button type="button" class="pq-yes" @click.stop="acceptPaste">Set it in</button>
					<button type="button" class="pq-no" @click.stop="dismissPaste">Keep as prose</button>
				</div>
			</div>
			</template>

			<!-- …and one at the foot, so you can always add to the end. -->
			<div
				key="seam-end"
				class="seam"
				:class="{ open: seamIndex === blocks.length }"
				role="button"
				aria-label="Insert at the end"
				@click.stop="openSeam(blocks.length)"
			>
				<span class="ln"></span>
				<span class="plus">＋</span>
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
/* THE MEASURE.
   The surface had no column at all — blocks ran the full width of whatever
   contained them, which at desk width is a 900px line of 17px prose, roughly
   twice a readable measure. One centred column now, opening in steps as the
   room widens, and the room is a query container so docking the spine
   re-tunes it instead of squashing it. */
.blocks {
	position: relative;
	container-type: inline-size;
	container-name: room;
	padding: 18px 8px 2px;
}
.blk-list {
	max-width: 33rem;
	margin: 0 auto;
	padding: 0 12px;
}
@container room (min-width: 700px) {
	.blk-list {
		max-width: 35rem;
	}
}
@container room (min-width: 900px) {
	.blk-list {
		max-width: 37rem;
	}
}
@media (min-width: 640px) {
	.blk-list {
		max-width: 680px;
		margin: 0 auto;
	}
}

/* ── The insert seam ──
   16px of hit area collapsed into a 0-height gap (negative margins), so it
   costs no rhythm until it is used. The rule and the ＋ only appear on hover
   or once opened — on touch there is no hover, so the ＋ is always faintly
   present at phone width (see below). */
.seam {
	position: relative;
	height: 16px;
	margin: -8px 0;
	z-index: 5;
	cursor: pointer;
}
.seam .ln {
	position: absolute;
	left: 6px;
	right: 6px;
	top: 50%;
	height: 1px;
	background: linear-gradient(90deg, var(--color-essay), rgb(232 160 64 / 0.12) 55%, transparent);
	opacity: 0;
	transition: opacity 0.16s ease;
}
.seam .plus {
	position: absolute;
	left: -2px;
	top: 50%;
	transform: translateY(-50%) scale(0.72);
	width: 23px;
	height: 23px;
	border-radius: 50%;
	display: grid;
	place-items: center;
	background: var(--color-mono-800);
	border: 1px solid var(--line);
	color: var(--color-essay);
	font-size: 14px;
	line-height: 1;
	opacity: 0;
	transition: opacity 0.16s ease, transform 0.16s cubic-bezier(0.2, 0.8, 0.2, 1);
}
@media (hover: hover) {
	.seam:hover .ln,
	.seam:hover .plus {
		opacity: 1;
	}
	.seam:hover .plus {
		transform: translateY(-50%) scale(1);
	}
}
/* No hover on a phone — keep the ＋ quietly visible instead of invisible. */
@media (hover: none) {
	.seam .plus {
		opacity: 0.4;
	}
}
.seam.open .ln,
.seam.open .plus {
	opacity: 1;
}
.seam.open .plus {
	transform: translateY(-50%) scale(1);
	border-color: var(--color-essay);
	background: var(--color-mono-900);
}

/* ── Paste-to-quote offer ── */
.pq {
	display: flex;
	align-items: center;
	gap: 8px;
	flex-wrap: wrap;
	margin: 8px 6px 0;
	padding: 8px 10px;
	border: 1px solid var(--line);
	border-left: 2px solid var(--color-essay);
	border-radius: 9px;
	background: var(--color-mono-900);
}
.pq-txt {
	flex: 1;
	min-width: 160px;
	font-size: 11.5px;
	line-height: 1.4;
	color: var(--color-mono-400);
}
.pq-txt b {
	color: var(--color-mono-200);
	font-weight: 500;
}
.pq button {
	border: none;
	font: inherit;
	font-size: 11.5px;
	padding: 5px 10px;
	border-radius: 7px;
	cursor: pointer;
	flex: 0 0 auto;
}
.pq-yes {
	background: var(--color-essay);
	color: var(--color-essay-text);
	font-weight: 600;
}
.pq-no {
	background: transparent;
	color: var(--color-mono-400);
}

/* PROSE HAS NO CHROME.
   Every block used to be a rounded card that tinted gold when selected — the
   CMS look this rework exists to get rid of. A paragraph is now just text on
   the page; the only things that look like objects are the objects. */
.blk {
	position: relative;
	padding: 2px 6px;
	margin: 0;
	outline: none;
}
/* The rhythm. Prose is set tight (--content-leading), so the air lives at the
   joins rather than inside the paragraph — which is also how the deck reads.
   See `joinClasses` for why the three cases differ. */
.blk.j-after-text {
	margin-top: 20px;
}
.blk.j-after-embed {
	margin-top: 22px;
}
.blk.j-stacked {
	margin-top: 8px;
}
/* Selection reads on the OBJECT, never on prose: an embed lifts slightly
   (see .blk-inner below); a paragraph you are editing just has a caret. */
.blk.act.k-quote,
.blk.act.k-book,
.blk.act.k-image {
	background: rgb(232 160 64 / 0.05);
	border-radius: 14px;
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
