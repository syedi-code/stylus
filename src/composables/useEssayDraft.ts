import { ref, watch } from 'vue';
import type { SelectedBookRef } from '../components/essays/EssayLibraryBrowser.vue';

const DRAFT_KEY = 'antisocial-essay-draft';
const TAGS_KEY = 'antisocial-essay-draft-tags';
const REFS_KEY = 'antisocial-essay-draft-refs';

/**
 * Composable for localStorage-persisted essay drafts.
 * Auto-saves content, tags, and book references on change.
 * Restores on demand, clears on successful submit.
 */
export function useEssayDraft() {
	const draftContent = ref('');
	const draftTags = ref<string[]>([]);
	const draftRefs = ref<SelectedBookRef[]>([]);

	function restore() {
		const saved = localStorage.getItem(DRAFT_KEY);
		if (saved) draftContent.value = saved;

		const savedTags = localStorage.getItem(TAGS_KEY);
		if (savedTags) {
			try {
				const parsed = JSON.parse(savedTags);
				if (Array.isArray(parsed)) draftTags.value = parsed;
			} catch {
				/* ignore */
			}
		}

		const savedRefs = localStorage.getItem(REFS_KEY);
		if (savedRefs) {
			try {
				const parsed = JSON.parse(savedRefs);
				if (Array.isArray(parsed)) draftRefs.value = parsed;
			} catch {
				/* ignore */
			}
		}
	}

	watch(draftContent, (v) => {
		if (v) localStorage.setItem(DRAFT_KEY, v);
		else localStorage.removeItem(DRAFT_KEY);
	});

	watch(
		draftTags,
		(v) => {
			if (v.length) localStorage.setItem(TAGS_KEY, JSON.stringify(v));
			else localStorage.removeItem(TAGS_KEY);
		},
		{ deep: true }
	);

	watch(
		draftRefs,
		(v) => {
			if (v.length) localStorage.setItem(REFS_KEY, JSON.stringify(v));
			else localStorage.removeItem(REFS_KEY);
		},
		{ deep: true }
	);

	function clearDraft() {
		draftContent.value = '';
		draftTags.value = [];
		draftRefs.value = [];
		localStorage.removeItem(DRAFT_KEY);
		localStorage.removeItem(TAGS_KEY);
		localStorage.removeItem(REFS_KEY);
	}

	function hasDraft(): boolean {
		return !!localStorage.getItem(DRAFT_KEY);
	}

	return {
		draftContent,
		draftTags,
		draftRefs,
		restore,
		clearDraft,
		hasDraft,
	};
}
