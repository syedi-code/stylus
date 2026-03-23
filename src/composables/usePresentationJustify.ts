import { ref, type Ref } from 'vue';

const BASE_KEY = 'presentation-justify';
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

export function usePresentationJustify(entity: string = 'quote') {
	const storageKey = `${BASE_KEY}-${entity}`;
	// Quotes default to justified; everything else defaults to left-aligned
	const defaultValue = entity === 'quote';

	if (!instances.has(storageKey)) {
		instances.set(storageKey, ref(loadState(storageKey, defaultValue)));
	}
	const justified = instances.get(storageKey)!;

	function toggle() {
		justified.value = !justified.value;
		saveState(storageKey, justified.value);
	}

	return {
		/** Whether text-align: justify is enabled */
		justified,
		toggle,
	};
}
