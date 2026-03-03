import { ref, watch, onMounted } from 'vue';

const DRAFT_KEY = 'antisocial-draft-note';

/**
 * Composable for localStorage-persisted draft notes.
 * Auto-saves on change, restores on mount, clears on successful submit.
 */
export function useDraft(key: string = DRAFT_KEY) {
	const draft = ref('');

	onMounted(() => {
		const saved = localStorage.getItem(key);
		if (saved) {
			draft.value = saved;
		}
	});

	watch(draft, (newVal) => {
		if (newVal) {
			localStorage.setItem(key, newVal);
		} else {
			localStorage.removeItem(key);
		}
	});

	const clearDraft = () => {
		draft.value = '';
		localStorage.removeItem(key);
	};

	const hasDraft = () => {
		return !!localStorage.getItem(key);
	};

	return {
		draft,
		clearDraft,
		hasDraft,
	};
}
