import { ref, onMounted, onUnmounted } from 'vue';

/**
 * Reactive on-screen-keyboard offset, used to pin floating UI (the essay
 * param bar) directly above the soft keyboard on mobile.
 *
 * Reads `window.visualViewport` — the same API messaging composers use.
 * When the keyboard is up, `visualViewport.height` shrinks while
 * `window.innerHeight` stays the same; the difference is roughly the
 * keyboard height (plus any browser bottom chrome).
 *
 * On desktop / when no visualViewport is available, `keyboardOffset`
 * stays at 0 and callers fall back to inline placement above the textarea.
 */
export function useKeyboardAnchor() {
	const keyboardOffset = ref(0);

	function update() {
		const vv = window.visualViewport;
		if (!vv) {
			keyboardOffset.value = 0;
			return;
		}
		const diff = window.innerHeight - (vv.height + vv.offsetTop);
		keyboardOffset.value = diff > 80 ? diff : 0;
	}

	onMounted(() => {
		if (typeof window === 'undefined' || !window.visualViewport) return;
		window.visualViewport.addEventListener('resize', update);
		window.visualViewport.addEventListener('scroll', update);
		update();
	});

	onUnmounted(() => {
		if (typeof window === 'undefined' || !window.visualViewport) return;
		window.visualViewport.removeEventListener('resize', update);
		window.visualViewport.removeEventListener('scroll', update);
	});

	return { keyboardOffset };
}
