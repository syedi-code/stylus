import { ref, watch, onMounted } from 'vue';

const DRAFT_KEY = 'antisocial-thought-draft';

/**
 * Composable for localStorage-persisted thought drafts.
 * Auto-saves content, mood score, and mood tags on change.
 * Restores on mount, clears on successful submit.
 */
export function useThoughtDraft(key: string = DRAFT_KEY) {
	const draft = ref('');
	const moodScore = ref<number | null>(null);
	const moodTags = ref<string[]>([]);

	const scoreKey = `${key}-score`;
	const tagsKey = `${key}-tags`;

	onMounted(() => {
		// Restore draft content
		const saved = localStorage.getItem(key);
		if (saved) {
			draft.value = saved;
		}

		// Restore mood score
		const savedScore = localStorage.getItem(scoreKey);
		if (savedScore) {
			const parsed = parseInt(savedScore, 10);
			if (!isNaN(parsed) && parsed >= 1 && parsed <= 10) {
				moodScore.value = parsed;
			}
		}

		// Restore mood tags
		const savedTags = localStorage.getItem(tagsKey);
		if (savedTags) {
			try {
				const parsed = JSON.parse(savedTags);
				if (Array.isArray(parsed)) {
					moodTags.value = parsed;
				}
			} catch {
				// Ignore parse errors
			}
		}
	});

	watch(draft, (newVal) => {
		if (newVal) {
			localStorage.setItem(key, newVal);
		} else {
			localStorage.removeItem(key);
		}
	});

	watch(moodScore, (newVal) => {
		if (newVal !== null) {
			localStorage.setItem(scoreKey, String(newVal));
		} else {
			localStorage.removeItem(scoreKey);
		}
	});

	watch(
		moodTags,
		(newVal) => {
			if (newVal.length > 0) {
				localStorage.setItem(tagsKey, JSON.stringify(newVal));
			} else {
				localStorage.removeItem(tagsKey);
			}
		},
		{ deep: true }
	);

	const clearDraft = () => {
		draft.value = '';
		moodScore.value = null;
		moodTags.value = [];
		localStorage.removeItem(key);
		localStorage.removeItem(scoreKey);
		localStorage.removeItem(tagsKey);
	};

	const hasDraft = () => {
		return !!localStorage.getItem(key);
	};

	return {
		draft,
		moodScore,
		moodTags,
		clearDraft,
		hasDraft,
	};
}
