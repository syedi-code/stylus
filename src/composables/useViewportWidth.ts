import { ref, type Ref } from 'vue';

// Module-scoped singleton — one resize listener shared by every consumer
// (NoteCard renders 30+ instances; per-instance listeners would be waste).
const width = ref(typeof window !== 'undefined' ? window.innerWidth : 1280);
let bound = false;

/** Reactive viewport width for JS-side responsive sizing (px-based type). */
export function useViewportWidth(): Ref<number> {
	if (!bound && typeof window !== 'undefined') {
		bound = true;
		window.addEventListener(
			'resize',
			() => {
				width.value = window.innerWidth;
			},
			{ passive: true }
		);
	}
	return width;
}
