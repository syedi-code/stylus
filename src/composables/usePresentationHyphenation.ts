import { ref, type Ref } from 'vue';

const BASE_KEY = 'presentation-hyphenation';
const instances = new Map<string, Ref<boolean>>();

function loadState(key: string, defaultValue: boolean): boolean {
	try {
		const raw = localStorage.getItem(key);
		if (raw !== null) return raw === 'true';
	} catch {
		// localStorage unavailable
	}
	return defaultValue;
}

function saveState(key: string, enabled: boolean): void {
	try {
		localStorage.setItem(key, String(enabled));
	} catch {
		// localStorage unavailable
	}
}

export function usePresentationHyphenation(entity: string = 'quote') {
	const storageKey = `${BASE_KEY}-${entity}`;
	// Quotes default to hyphenation on; everything else defaults to off
	const defaultValue = entity === 'quote';

	if (!instances.has(storageKey)) {
		instances.set(storageKey, ref(loadState(storageKey, defaultValue)));
	}
	const hyphenation = instances.get(storageKey)!;

	function toggle() {
		hyphenation.value = !hyphenation.value;
		saveState(storageKey, hyphenation.value);
	}

	return {
		/** Whether CSS hyphens: auto is enabled */
		hyphenation,
		toggle,
	};
}
