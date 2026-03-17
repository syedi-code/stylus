import { ref } from 'vue';

const STORAGE_KEY = 'presentation-justify-quote';

function loadState(): boolean {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (raw !== null) return raw === 'true';
	} catch {
		// localStorage unavailable
	}
	return false; // default: left-aligned
}

function saveState(enabled: boolean): void {
	try {
		localStorage.setItem(STORAGE_KEY, String(enabled));
	} catch {
		// localStorage unavailable
	}
}

// Shared singleton so all consumers stay in sync
const justified = ref(loadState());

export function usePresentationJustify() {
	function toggle() {
		justified.value = !justified.value;
		saveState(justified.value);
	}

	return {
		/** Whether text-align: justify is enabled */
		justified,
		toggle,
	};
}
