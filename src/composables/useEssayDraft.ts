import { ref, watch } from 'vue';

const DRAFT_KEY = 'antisocial-essay-draft';
const TAGS_KEY = 'antisocial-essay-draft-tags';
// Legacy keys (no longer used; cleaned up on restore so old drafts don't
// linger in localStorage forever).
const LEGACY_REFS_KEY = 'antisocial-essay-draft-refs';
const LEGACY_EMBEDS_KEY = 'antisocial-essay-draft-embeds';

/**
 * Composable for localStorage-persisted essay drafts.
 *
 * Embeds are inline tokens in `content` itself, so the draft only needs to
 * persist content + tags. References are derived server-side from content
 * tokens; nothing client-side needs to track them separately.
 */
export function useEssayDraft() {
	const draftContent = ref('');
	const draftTags = ref<string[]>([]);

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

		// Garbage-collect old draft shapes — no migration; tokens already live
		// in content for any draft that happened mid-rewrite.
		localStorage.removeItem(LEGACY_REFS_KEY);
		localStorage.removeItem(LEGACY_EMBEDS_KEY);
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

	function clearDraft() {
		draftContent.value = '';
		draftTags.value = [];
		localStorage.removeItem(DRAFT_KEY);
		localStorage.removeItem(TAGS_KEY);
		localStorage.removeItem(LEGACY_REFS_KEY);
		localStorage.removeItem(LEGACY_EMBEDS_KEY);
	}

	function hasDraft(): boolean {
		return !!localStorage.getItem(DRAFT_KEY);
	}

	return {
		draftContent,
		draftTags,
		restore,
		clearDraft,
		hasDraft,
	};
}
