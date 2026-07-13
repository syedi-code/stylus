import { onMounted, watch, nextTick, type Ref } from 'vue';

/**
 * Grow a textarea to fit its content (no inner scrollbar) — so a stack of
 * per-block textareas reads as one continuous document. Call `grow()` on
 * input; it also runs on mount and whenever `value` changes externally.
 */
export function useAutoGrow(el: Ref<HTMLTextAreaElement | null>, value: Ref<string>) {
	function grow() {
		const ta = el.value;
		if (!ta) return;
		ta.style.height = 'auto';
		ta.style.height = `${ta.scrollHeight}px`;
	}
	onMounted(() => nextTick(grow));
	watch(value, () => nextTick(grow));
	return { grow };
}
