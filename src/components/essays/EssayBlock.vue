<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import { useAutoGrow } from '../../composables/useAutoGrow';
import { isEmbedBlock, type EditorBlock, type EmbedBlock } from '../../composables/useEssayBlocks';
import { formatMarkdown } from '../../lib/formatText';
import { parsePastedQuote, shouldSplitPaste, type PastedQuote } from '../../lib/essayWorkspace';
import { readSlash } from '../../lib/essaySlash';
import { rawOffsetFor, renderedOffsetAt } from '../../lib/essayCaret';
import type { EditKind } from '../../lib/essayHistory';
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
	/** The last block in the piece — it carries the hint that teaches `/`. */
	last?: boolean;
	/** The only block — the blank page's first line. */
	only?: boolean;
	/** The slash menu is open on this block and wants the arrow keys. */
	menuOpen?: boolean;
}>();

const emit = defineEmits<{
	(e: 'update', text: string, kind: EditKind): void;
	(e: 'enter', caret: number): void;
	(e: 'mergeBack'): void;
	(e: 'cross', dir: 'up' | 'down', caret: number): void;
	(e: 'exitEdit'): void;
	/** A keystroke landed — the modal retracts its chrome while writing. */
	(e: 'typing'): void;
	/** The block's text as a slash query, or null when it stops being one. */
	(e: 'slashQuery', text: string | null): void;
	/** Navigation keys, while the slash menu is open. */
	(e: 'menuKey', key: string): void;
	/** Pasted text that parses as a citable quote. */
	(e: 'pastedQuote', payload: PastedQuote): void;
	/** A paste of several paragraphs (or tokens): the block's whole new text. */
	(e: 'pasteBlocks', combined: string, tailLength: number): void;
	(e: 'wrap', before: string, after: string): void;
	(e: 'history', dir: 'undo' | 'redo'): void;
	/** `# ` typed at the start turns prose into a section, Backspace turns it back. */
	(e: 'convert', kind: 'para' | 'header', text: string): void;
}>();

const taRef = ref<HTMLTextAreaElement | null>(null);
const viewRef = ref<HTMLElement | null>(null);
const textValue = ref('');
const { grow } = useAutoGrow(taRef, textValue);

const rendered = computed(() => {
	if (isEmbedBlock(props.block)) return '';
	const t = props.block.text.trim();
	return t ? formatMarkdown(t) : '';
});

const placeholder = computed(() => {
	if (props.only) return 'Begin anywhere. Type / to set in a quote, a book, anything.';
	return props.last ? 'Keep writing — or type / to set something in' : 'Write…';
});

function onInput(e: Event) {
	const ta = e.target as HTMLTextAreaElement;
	const v = ta.value;

	// `# ` at the very start of a paragraph: it asked to be a section.
	if (props.block.kind === 'para' && v.startsWith('# ') && ta.selectionStart === 2) {
		emit('convert', 'header', v.slice(2));
		return;
	}

	textValue.value = v;
	const data = (e as InputEvent).data;
	emit('update', v, data && /\s/.test(data) ? 'word' : 'typing');
	grow();
	emit('typing');
	if (props.block.kind === 'para') emit('slashQuery', readSlash(v) ? v : null);
}

/** Markers that wrap a selection when typed over it, instead of replacing it. */
const WRAPPERS: Record<string, [string, string]> = {
	'*': ['*', '*'],
	'{': ['{', '}'],
	'<': ['<', '>'],
};

function onPaste(e: ClipboardEvent) {
	const ta = taRef.value;
	if (!ta) return;
	const raw = e.clipboardData?.getData('text/plain') ?? '';
	if (!raw) return;

	// Several paragraphs arrive as several blocks, not one block holding
	// blank lines that only come apart on the next reload.
	if (shouldSplitPaste(raw)) {
		e.preventDefault();
		const before = ta.value.slice(0, ta.selectionStart);
		const after = ta.value.slice(ta.selectionEnd);
		const prefix = props.block.kind === 'header' ? '# ' : '';
		const pasted = raw.replace(/\r\n?/g, '\n');
		emit('pasteBlocks', `${prefix}${before}${pasted}${after}`, after.trim().length);
		return;
	}

	const whole = ta.selectionStart === 0 && ta.selectionEnd === ta.value.length;
	const parsed = parsePastedQuote(raw, whole && ta.value.trim() === raw.trim() ? true : whole);
	if (parsed) emit('pastedQuote', parsed);
	// Never preventDefault: the paste lands as prose either way, and the offer
	// is a suggestion the writer can ignore.
}

function onKeydown(e: KeyboardEvent) {
	const ta = taRef.value;
	if (!ta) return;
	const mod = e.ctrlKey || e.metaKey;

	if (props.menuOpen && ['ArrowUp', 'ArrowDown', 'Enter', 'Tab', 'Escape'].includes(e.key) && !mod) {
		e.preventDefault();
		emit('menuKey', e.key);
		return;
	}

	if (mod && e.key === 'Enter') return; // bubble → save
	if (mod && !e.altKey) {
		const k = e.key.toLowerCase();
		if (k === 'z' || k === 'y') {
			e.preventDefault();
			emit('history', k === 'y' || e.shiftKey ? 'redo' : 'undo');
			return;
		}
		const fmt: Record<string, [string, string]> = {
			b: ['**', '**'],
			i: ['*', '*'],
			u: ['<', '>'],
			e: ['{', '}'],
		};
		if (fmt[k] && !e.shiftKey) {
			e.preventDefault();
			emit('wrap', fmt[k][0], fmt[k][1]);
			return;
		}
	}

	const caret = ta.selectionStart;
	const end = ta.selectionEnd;
	const value = ta.value;

	if (caret !== end && WRAPPERS[e.key] && !mod) {
		e.preventDefault();
		emit('wrap', WRAPPERS[e.key][0], WRAPPERS[e.key][1]);
		return;
	}

	if (e.key === 'Enter' && !e.shiftKey) {
		e.preventDefault();
		emit('enter', caret);
	} else if (e.key === 'Backspace' && caret === 0 && end === 0) {
		e.preventDefault();
		if (props.block.kind === 'header') emit('convert', 'para', value);
		else emit('mergeBack');
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
	ta.focus({ preventScroll: true });
	const pos = caret ?? ta.value.length;
	const clamped = Math.max(0, Math.min(pos, ta.value.length));
	ta.setSelectionRange(clamped, clamped);
}

/** The markdown offset under a point on the rendered text — see essayCaret. */
function caretFromPoint(x: number, y: number): number | null {
	if (isEmbedBlock(props.block)) return null;
	const view = viewRef.value;
	if (!view) return null;
	const off = renderedOffsetAt(view, x, y);
	if (off === null) return null;
	return rawOffsetFor(props.block.text.trim(), view.textContent ?? '', off);
}

function embed(): EmbedBlock {
	return props.block as EmbedBlock;
}

// When entering edit, seed + focus the textarea — unless the editor already
// placed the caret (a tap, a merge), in which case landing at the end would
// throw that placement away.
watch(
	() => props.editing,
	(ed) => {
		if (ed && !isEmbedBlock(props.block)) {
			textValue.value = props.block.text;
			nextTick(() => {
				grow();
				if (document.activeElement !== taRef.value) focus();
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

defineExpose({ focus, caretFromPoint, el: () => taRef.value });
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
		<div v-else class="hbadge" :data-empty="!block.text.trim()">
			<span ref="viewRef" class="htext">{{ block.text.trim() || 'Section title' }}</span>
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
			:placeholder="placeholder"
			@input="onInput"
			@keydown="onKeydown"
			@paste="onPaste"
			@blur="emit('exitEdit')"
		></textarea>
		<div v-else class="para-view" :class="{ empty: !rendered }">
			<span v-if="rendered" ref="viewRef" v-html="rendered"></span>
			<span v-else class="ph">Empty paragraph</span>
		</div>
	</template>

	<!-- ── Foil objects (presentational) ── -->
	<FoilQuote v-else-if="block.kind === 'quote'" :block="embed()" />
	<FoilBook v-else-if="block.kind === 'book'" :block="embed()" />
	<FoilImage v-else-if="block.kind === 'image'" :block="embed()" />
</template>

<style scoped>
/* prose — display + edit share type metrics so entering edit doesn't reflow.
   Set explicitly rather than inherited: the manuscript's body size is a
   decision (17px, the mockup's), and `font: inherit` quietly took whatever
   the surrounding app happened to be at. */
.para,
.para-view {
	width: 100%;
	font: inherit;
	font-size: 17px;
	line-height: var(--content-leading);
	letter-spacing: -0.003em;
	color: #e8e6e1;
	padding: 3px 0;
	text-wrap: pretty;
}
@media (max-width: 640px) {
	.para,
	.para-view {
		font-size: 16px;
	}
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
/* A section header is a LINE OF PROSE, not an object.
   It used to be a gold foil stamp with an etched number, centred in the
   column — which made the one block type nobody in the corpus has ever used
   the loudest thing on the page. Foils are for things that become slides.
   Type only, in the flow, at the same 17px/1.24 the deck sets a header. */
.hwrap {
	display: flex;
	padding: 2px 0;
}
/* A header opens a section, so it takes more air above than a paragraph
   does — the join classes on .blk cannot know that, they only see kinds. */
:global(.blk.k-header:not(:first-child)) {
	margin-top: 30px;
}
.hbadge {
	max-width: 100%;
	-webkit-user-select: none;
	user-select: none;
	-webkit-touch-callout: none;
	cursor: text;
}
.hbadge .htext {
	font-size: 17px;
	font-weight: 600;
	letter-spacing: -0.01em;
	color: #faf8f4;
	line-height: 1.24;
	text-wrap: balance;
}
.hbadge[data-empty='true'] .htext {
	color: var(--color-mono-600);
	font-style: italic;
	font-weight: 400;
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
	width: 100%;
	field-sizing: content;
}
.htx::placeholder {
	color: var(--color-mono-600);
}
</style>
