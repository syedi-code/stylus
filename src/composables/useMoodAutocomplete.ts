import { ref, computed, onMounted } from 'vue';
import { fetchMoodSuggestions, fetchRandomMoodSuggestions } from '../lib/api';

// Default mood suggestions when no history is available
const DEFAULT_MOODS = [
	'happy',
	'excited',
	'grateful',
	'calm',
	'hopeful',
	'anxious',
	'sad',
	'frustrated',
	'tired',
	'overwhelmed',
	'creative',
	'focused',
	'inspired',
	'nostalgic',
	'curious',
	'loved',
	'peaceful',
	'energetic',
	'silly',
	'cozy',
];

/**
 * Composable for mood tag autocomplete with server-fetched suggestions.
 * Falls back to default moods if server unavailable.
 */
export function useMoodAutocomplete() {
	const allMoods = ref<string[]>([...DEFAULT_MOODS]);
	const loading = ref(false);
	const loaded = ref(false);

	// Random suggestions for quick-pick chips
	const suggestions = ref<string[]>([]);
	const suggestionsLoading = ref(false);

	const loadMoodSuggestions = async () => {
		if (loaded.value) return;

		loading.value = true;
		try {
			const serverMoods = await fetchMoodSuggestions();
			if (serverMoods.length > 0) {
				// Merge server moods with defaults, removing duplicates
				const merged = new Set([...serverMoods, ...DEFAULT_MOODS]);
				allMoods.value = Array.from(merged);
			}
			loaded.value = true;
		} catch (err) {
			console.error('Failed to load mood suggestions:', err);
			// Keep default moods on error
		} finally {
			loading.value = false;
		}
	};

	/**
	 * Fetch a random handful of mood suggestions from the server
	 */
	const refreshSuggestions = async (count: number = 6) => {
		suggestionsLoading.value = true;
		try {
			const result = await fetchRandomMoodSuggestions(count);
			suggestions.value = result;
		} catch (err) {
			console.error('Failed to load random mood suggestions:', err);
			// Fall back to a random slice of defaults
			const shuffled = [...DEFAULT_MOODS].sort(() => Math.random() - 0.5);
			suggestions.value = shuffled.slice(0, count);
		} finally {
			suggestionsLoading.value = false;
		}
	};

	// Load on first use
	onMounted(() => {
		loadMoodSuggestions();
		refreshSuggestions();
	});

	/**
	 * Get mood suggestions matching a query, excluding already selected moods
	 */
	const getSuggestions = (
		query: string,
		selectedMoods: string[] = []
	): string[] => {
		const lowerQuery = query.toLowerCase().trim();
		const selectedSet = new Set(selectedMoods.map((m) => m.toLowerCase()));

		return allMoods.value.filter((mood) => {
			const lowerMood = mood.toLowerCase();
			// Exclude already selected moods
			if (selectedSet.has(lowerMood)) return false;
			// Match if query is empty or mood starts with/contains query
			if (!lowerQuery) return true;
			return lowerMood.includes(lowerQuery);
		});
		// Return all matching moods
	};

	/**
	 * Add a custom mood to the local list (will be persisted to server on thought save)
	 */
	const addCustomMood = (mood: string) => {
		const normalized = mood.toLowerCase().trim();
		if (normalized && !allMoods.value.includes(normalized)) {
			allMoods.value = [...allMoods.value, normalized];
		}
	};

	return {
		allMoods: computed(() => allMoods.value),
		loading: computed(() => loading.value),
		suggestions: computed(() => suggestions.value),
		suggestionsLoading: computed(() => suggestionsLoading.value),
		getSuggestions,
		addCustomMood,
		refreshSuggestions,
		refresh: loadMoodSuggestions,
	};
}
