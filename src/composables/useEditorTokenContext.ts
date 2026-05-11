import { ref, watch, onUnmounted, type Ref } from 'vue';
import { parseEssayToken, type EmbedKind } from '@antisocial/core';

/**
 * Caret-aware embed-token context for the essay editor.
 *
 * Watches a textarea's caret and the live `content` ref. When the caret sits
 * inside a paragraph that parses as an embed token, exposes a `tokenContext`
 * describing it. When the caret leaves that paragraph (or the textarea
 * blurs), tokenContext becomes null and the param bar collapses.
 *
 * Token grammar is owned by `essay-tokens.ts`. This composable does not
 * re-roll the regex — it calls the shared `parseEssayToken`.
 */
export interface EditorTokenContext {
	kind: EmbedKind;
	id: string;
	/** Inclusive [start, end] character offsets of the token line in `content`. */
	range: [number, number];
	/** The full token paragraph text (`[[…]]` only — no surrounding blank lines). */
	text: string;
}

export function useEditorTokenContext(
	textareaRef: Ref<HTMLTextAreaElement | null>,
	content: Ref<string>
) {
	const tokenContext = ref<EditorTokenContext | null>(null);

	function refresh() {
		const ta = textareaRef.value;
		if (!ta || document.activeElement !== ta) {
			tokenContext.value = null;
			return;
		}
		const caret = ta.selectionStart;
		const value = content.value;
		// Paragraph boundaries: split on blank line (one or more empty lines).
		// We find the boundaries surrounding `caret` by scanning outward.
		const before = value.slice(0, caret);
		const after = value.slice(caret);
		const lastBoundary = before.search(/\n\n[^]*$/);
		const start = lastBoundary === -1 ? 0 : lastBoundary + 2;
		const fwdBoundary = after.search(/\n\n/);
		const end = fwdBoundary === -1 ? value.length : caret + fwdBoundary;
		const paragraph = value.slice(start, end);
		const parsed = parseEssayToken(paragraph);
		if (!parsed) {
			tokenContext.value = null;
			return;
		}
		tokenContext.value = {
			kind: parsed.kind,
			id: parsed.id,
			range: [start, end],
			text: paragraph.trim(),
		};
	}

	function onSelect() {
		refresh();
	}
	function onBlur() {
		// Don't immediately clear — clicks on the param bar momentarily blur the
		// textarea. The bar restores focus, which fires `select` and re-resolves.
		setTimeout(() => {
			if (document.activeElement !== textareaRef.value) {
				tokenContext.value = null;
			}
		}, 80);
	}

	let attached: HTMLTextAreaElement | null = null;
	function attach(ta: HTMLTextAreaElement) {
		ta.addEventListener('select', onSelect);
		ta.addEventListener('click', onSelect);
		ta.addEventListener('keyup', onSelect);
		ta.addEventListener('focus', onSelect);
		ta.addEventListener('blur', onBlur);
		document.addEventListener('selectionchange', onSelect);
		attached = ta;
	}
	function detach() {
		if (!attached) return;
		attached.removeEventListener('select', onSelect);
		attached.removeEventListener('click', onSelect);
		attached.removeEventListener('keyup', onSelect);
		attached.removeEventListener('focus', onSelect);
		attached.removeEventListener('blur', onBlur);
		document.removeEventListener('selectionchange', onSelect);
		attached = null;
	}

	watch(
		textareaRef,
		(ta) => {
			detach();
			if (ta) attach(ta);
		},
		{ immediate: true }
	);

	watch(content, () => refresh());

	onUnmounted(detach);

	return { tokenContext, refresh };
}
