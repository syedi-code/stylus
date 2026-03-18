import { ref } from 'vue';

const STORAGE_KEY = 'presentation-hyphenation-quote';

function loadState(): boolean {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (raw !== null) return raw === 'true';
	} catch {
		// localStorage unavailable
	}
	return true; // default: hyphenation on
}

function saveState(enabled: boolean): void {
	try {
		localStorage.setItem(STORAGE_KEY, String(enabled));
	} catch {
		// localStorage unavailable
	}
}

// Shared singleton so all consumers stay in sync
const hyphenation = ref(loadState());

export function usePresentationHyphenation() {
	function toggle() {
		hyphenation.value = !hyphenation.value;
		saveState(hyphenation.value);
	}

	return {
		/** Whether CSS hyphens: auto is enabled */
		hyphenation,
		toggle,
	};
}
