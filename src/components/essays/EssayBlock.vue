<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import { useAutoGrow } from '../../composables/useAutoGrow';
import { isEmbedBlock, type EditorBlock, type EmbedBlock } from '../../composables/useEssayBlocks';
import { formatMarkdown } from '../../lib/formatText';
import FoilQuote from './blocks/FoilQuote.vue';
import FoilBook from './blocks/FoilBook.vue';
import FoilImage from './blocks/FoilImage.vue';

/**
 * One block, two states:
 *  - DISPLAY (default): non-selectable rendered text / foil object. Because the
 *    text isn't an editable field, a press-and-hold can select & drag it with
 *    no OS text-highlight collision.
 *  - EDIT (text blocks only): a real textarea with the caret. Entered by tap or
 *    the ✎ rail button; left on blur / Escape.
 *
 * The editor owns all pointer gestures (select / tap / drag) and the action
 * rail — this component just renders the right face and, when editing, the
 * textarea + its keystrokes.
 */
const props = defineProps<{
	block: EditorBlock;
	active?: boolean;
	editing?: boolean;
	hn?: string;
}>();

const emit = defineEmits<{
	(e: 'update', text: string): void;
	(e: 'enter', caret: number): void;
	(e: 'mergeBack'): void;
	(e: 'cross', dir: 'up' | 'down', caret: number): void;
	(e: 'exitEdit'): void;
	/** A keystroke landed — the modal retracts its chrome while writing. */
	(e: 'typing'): void;
	/** `/quote`, `/section`, `/book`, `/image` typed at the start of a line. */
	(e: 'slash', kind: 'quote' | 'section' | 'book' | 'image'): void;
	/** Pasted text that parses as a citable quote. */
	(e: 'pastedQuote', payload: PastedQuote): void;
}>();

export interface PastedQuote {
	text: string;
	creator?: string;
	work?: string;
	page?: string;
	/** True when the paste was the block's entire content. */
	whole: boolean;
}

const taRef = ref<HTMLTextAreaElement | null>(null);
const textValue = ref('');
const { grow } = useAutoGrow(taRef, textValue);

const rendered = computed(() => {
	if (isEmbedBlock(props.block)) return '';
	const t = props.block.text.trim();
	return t ? formatMarkdown(t) : '';
});

/**
 * Slash commands, recognised only at the very start of an empty-ish line so
 * they can never fire inside prose (dates, fractions, URLs all contain "/").
 * The command word is consumed; the editor performs the insert.
 */
const SLASH_RE = /^\/(quote|section|book|image)\s$/;

function onInput(e: Event) {
	const ta = e.target as HTMLTextAreaElement;
	const v = ta.value;

	const m = v.match(SLASH_RE);
	if (m) {
		// Swallow the command text; the block goes back to empty.
		textValue.value = '';
		emit('update', '');
		grow();
		emit('slash', m[1] as 'quote' | 'section' | 'book' | 'image');
		return;
	}

	textValue.value = v;
	emit('update', v);
	grow();
	emit('typing');
}

/**
 * Paste-to-quote. Someone copying a passage out of a book app or a PDF almost
 * always gets the words plus an attribution tail, and re-typing that into the
 * quote sheet is the slowest path in the editor. If the pasted text looks like
 *     "A line." — Someone, Some Book, p. 12
 * offer to set it as a quote instead of leaving it as prose.
 *
 * Deliberately conservative: it only fires on a paste (never on typing), and
 * only when an attribution actually parses. Anything else pastes as normal.
 */
const QUOTED_RE = /^\s*[“"'‘]([\s\S]+?)[”"'’]\s*(?:[—–-]+\s*(.+))?$/;
const ATTR_RE = /^([^,]+?)(?:,\s*([^,]+?))?(?:,\s*p+\.?\s*([0-9ivxlc]+))?\.?$/i;

function parsePastedQuote(raw: string, whole: boolean): PastedQuote | null {
	const text = raw.trim();
	if (text.length < 24 || text.length > 2000) return null;
	const q = text.match(QUOTED_RE);
	if (!q) return null;
	const body = q[1].trim();
	if (!body) return null;
	const out: PastedQuote = { text: body, whole };
	const tail = (q[2] || '').trim();
	if (tail) {
		const a = tail.match(ATTR_RE);
		if (a) {
			out.creator = (a[1] || '').trim() || undefined;
			out.work = (a[2] || '').trim() || undefined;
			out.page = (a[3] || '').trim() || undefined;
		}
	}
	return out;
}

function onPaste(e: ClipboardEvent) {
	const ta = taRef.value;
	if (!ta) return;
	const raw = e.clipboardData?.getData('text/plain') ?? '';
	if (!raw) return;
	const whole = ta.selectionStart === 0 && ta.selectionEnd === ta.value.length;
	const parsed = parsePastedQuote(raw, whole && ta.value.trim() === raw.trim() ? true : whole);
	if (parsed) emit('pastedQuote', parsed);
	// Never preventDefault: the paste lands as prose either way, and the offer
	// is a suggestion the writer can ignore.
}

function onKeydown(e: KeyboardEvent) {
	const ta = taRef.value;
	if (!ta) return;
	if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') return; // bubble → publish
	const caret = ta.selectionStart;
	const end = ta.selectionEnd;
	const value = ta.value;
	if (e.key === 'Enter' && !e.shiftKey) {
		e.preventDefault();
		emit('enter', caret);
	} else if (e.key === 'Backspace' && caret === 0 && end === 0) {
		e.preventDefault();
		emit('mergeBack');
	} else if (e.key === 'ArrowUp' && !value.slice(0, caret).includes('\n')) {
		e.preventDefault();
		emit('cross', 'up', caret);
	} else if (e.key === 'ArrowDown' && !value.slice(caret).includes('\n')) {
		e.preventDefault();
		emit('cross', 'down', caret);
	} else if (e.key === 'Escape') {
		e.preventDefault();
		emit('exitEdit');
	}
}

function focus(caret?: number) {
	const ta = taRef.value;
	if (!ta) return;
	ta.focus();
	const pos = caret ?? ta.value.length;
	const clamped = Math.max(0, Math.min(pos, ta.value.length));
	ta.setSelectionRange(clamped, clamped);
}

function embed(): EmbedBlock {
	return props.block as EmbedBlock;
}

// When entering edit, seed + focus the textarea.
watch(
	() => props.editing,
	(ed) => {
		if (ed && !isEmbedBlock(props.block)) {
			textValue.value = props.block.text;
			nextTick(() => {
				grow();
				focus();
			});
		}
	}
);

// Keep the auto-grow mirror aligned when text changes externally (merge/split).
watch(
	() => (isEmbedBlock(props.block) ? '' : props.block.text),
	(v) => {
		textValue.value = v;
		if (props.editing) nextTick(grow);
	},
	{ immediate: true }
);

defineExpose({ focus, el: () => taRef.value });
</script>

<template>
	<!-- ── Header ── -->
	<div v-if="block.kind === 'header'" class="hwrap">
		<textarea
			v-if="editing"
			ref="taRef"
			class="htx"
			rows="1"
			:value="block.text"
			placeholder="Section title"
			@input="onInput"
			@keydown="onKeydown"
			@paste="onPaste"
			@blur="emit('exitEdit')"
		></textarea>
		<div v-else class="hbadge foil" :data-empty="!block.text.trim()">
			<span v-if="hn" class="hn">{{ hn }}</span>
			<span class="htext">{{ block.text.trim() || 'Section title' }}</span>
		</div>
	</div>

	<!-- ── Prose ── -->
	<template v-else-if="block.kind === 'para'">
		<textarea
			v-if="editing"
			ref="taRef"
			class="para"
			rows="1"
			:value="block.text"
			placeholder="Write…"
			@input="onInput"
			@keydown="onKeydown"
			@paste="onPaste"
			@blur="emit('exitEdit')"
		></textarea>
		<div v-else class="para-view" :class="{ empty: !rendered }">
			<span v-if="rendered" v-html="rendered"></span>
			<span v-else class="ph">Empty paragraph</span>
		</div>
	</template>

	<!-- ── Foil objects (presentational) ── -->
	<FoilQuote v-else-if="block.kind === 'quote'" :block="embed()" />
	<FoilBook v-else-if="block.kind === 'book'" :block="embed()" />
	<FoilImage v-else-if="block.kind === 'image'" :block="embed()" />
</template>

<style scoped>
/* prose — display + edit share type metrics so entering edit doesn't reflow */
.para,
.para-view {
	width: 100%;
	font: inherit;
	line-height: var(--content-leading);
	color: var(--color-mono-100);
	padding: 4px 2px;
}
.para {
	background: transparent;
	border: none;
	outline: none;
	resize: none;
	overflow: hidden;
}
.para::placeholder {
	color: var(--color-mono-700);
}
.para-view {
	white-space: pre-wrap;
	word-break: break-word;
	-webkit-user-select: none;
	user-select: none;
	-webkit-touch-callout: none;
	cursor: text;
}
.para-view.empty .ph {
	color: var(--color-mono-700);
	font-style: italic;
}

/* header — a gold stamp that hugs its text tightly */
.hwrap {
	display: flex;
	justify-content: center;
	padding: 4px 0;
}
.hbadge {
	display: inline-flex;
	align-items: center;
	gap: 10px;
	max-width: 100%;
	width: fit-content;
	border-radius: 9px;
	padding: 7px 11px;
	background: var(--color-essay);
	background-image: linear-gradient(138deg, #f0c477 0%, var(--color-essay) 46%, #b9761f 124%);
	box-shadow: inset 0 1px 0 rgba(255, 245, 220, 0.5), inset 0 -1.5px 0 rgba(120, 70, 20, 0.42);
	-webkit-user-select: none;
	user-select: none;
	-webkit-touch-callout: none;
	cursor: text;
}
.hbadge .hn {
	flex: 0 0 auto;
	font-size: 10px;
	font-weight: 700;
	letter-spacing: 0.14em;
	color: rgba(20, 13, 3, 0.5);
	font-variant-numeric: lining-nums;
}
.hbadge .htext {
	font-size: 17px;
	font-weight: 600;
	letter-spacing: -0.01em;
	color: #140d03;
	line-height: 1.24;
	text-wrap: balance;
}
.hbadge[data-empty='true'] .htext {
	color: rgba(20, 13, 3, 0.45);
}

/* header edit field — kept visually close to the badge */
.htx {
	background: transparent;
	border: none;
	outline: none;
	resize: none;
	overflow: hidden;
	font: inherit;
	font-size: 17px;
	font-weight: 600;
	letter-spacing: -0.01em;
	color: var(--color-mono-50);
	line-height: 1.24;
	text-align: center;
	width: 100%;
	field-sizing: content;
}
.htx::placeholder {
	color: var(--color-mono-600);
}
</style>
