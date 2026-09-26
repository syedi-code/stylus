/**
 * Hold the phone's keyboard open across a remount.
 *
 * iOS raises the software keyboard only for a focus() made inside the tap's
 * own handler. "New piece" remounts the writing room, so the textarea that
 * should take the caret does not exist until a tick later — by which time the
 * gesture is spent, and the blank page opened with no keyboard under it.
 *
 * Focusing this offscreen field synchronously in the tap raises the keyboard;
 * moving focus from it to the real textarea afterwards keeps it up.
 */
let keeper: HTMLTextAreaElement | null = null;
let sink: ((text: string) => void) | null = null;

/**
 * Where keystrokes go if they land in the keeper — a fast typist can beat the
 * handoff to the real textarea, and those letters must not vanish.
 */
export function onHeldInput(fn: ((text: string) => void) | null) {
	sink = fn;
}

export function holdKeyboard() {
	if (typeof document === 'undefined') return;
	if (!keeper) {
		keeper = document.createElement('textarea');
		keeper.setAttribute('aria-hidden', 'true');
		keeper.tabIndex = -1;
		// 16px, or iOS zooms the page to the field it just focused.
		keeper.style.cssText =
			'position:fixed;top:40%;left:0;width:1px;height:1px;opacity:0;font-size:16px;padding:0;border:0;pointer-events:none;';
		keeper.addEventListener('input', () => {
			const k = keeper!;
			const text = k.value;
			k.value = '';
			if (text) sink?.(text);
		});
		document.body.appendChild(keeper);
	}
	keeper.focus({ preventScroll: true });
}
