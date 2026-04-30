import { ref, watch } from 'vue';

const NEW_DRAFT_KEY = 'antisocial-essay-draft';
const NEW_TAGS_KEY = 'antisocial-essay-draft-tags';
// Legacy keys (no longer used; cleaned up on restore so old drafts don't
// linger in localStorage forever).
const LEGACY_REFS_KEY = 'antisocial-essay-draft-refs';
const LEGACY_EMBEDS_KEY = 'antisocial-essay-draft-embeds';

export type EssayDraftScope = { kind: 'edit'; id: string } | undefined;

function keysFor(scope: EssayDraftScope): { content: string; tags: string } {
	if (scope?.kind === 'edit') {
		return {
			content: `antisocial-essay-draft:edit:${scope.id}`,
			tags: `antisocial-essay-draft-tags:edit:${scope.id}`,
		};
	}
	return { content: NEW_DRAFT_KEY, tags: NEW_TAGS_KEY };
}

/**
 * Composable for localStorage-persisted essay drafts.
 *
 * Embeds are inline tokens in `content` itself, so the draft only needs to
 * persist content + tags. References are derived server-side from content
 * tokens; nothing client-side needs to track them separately.
 *
 * `getScope` returns the active storage namespace:
 * - returns `undefined` → single global slot for the new-essay draft.
 * - returns `{ kind: 'edit', id }` → per-essay slot keyed by id, so revisions
 *   of an existing essay are cached without colliding with other in-flight
 *   edits.
 *
 * The getter form lets a single instance change scope between opens (e.g. the
 * editor modal opening different essays for edit) without leaking watchers.
 */
export function useEssayDraft(getScope: () => EssayDraftScope = () => undefined) {
	const draftContent = ref('');
	const draftTags = ref<string[]>([]);

	function restore() {
		const { content: contentKey, tags: tagsKey } = keysFor(getScope());
		const saved = localStorage.getItem(contentKey);
		draftContent.value = saved ?? '';

		const savedTags = localStorage.getItem(tagsKey);
		if (savedTags) {
			try {
				const parsed = JSON.parse(savedTags);
				draftTags.value = Array.isArray(parsed) ? parsed : [];
			} catch {
				draftTags.value = [];
			}
		} else {
			draftTags.value = [];
		}

		// Garbage-collect old draft shapes — no migration; tokens already live
		// in content for any draft that happened mid-rewrite.
		localStorage.removeItem(LEGACY_REFS_KEY);
		localStorage.removeItem(LEGACY_EMBEDS_KEY);
	}

	watch(draftContent, (v) => {
		const { content: contentKey } = keysFor(getScope());
		if (v) localStorage.setItem(contentKey, v);
		else localStorage.removeItem(contentKey);
	});

	watch(
		draftTags,
		(v) => {
			const { tags: tagsKey } = keysFor(getScope());
			if (v.length) localStorage.setItem(tagsKey, JSON.stringify(v));
			else localStorage.removeItem(tagsKey);
		},
		{ deep: true }
	);

	function clearDraft() {
		const { content: contentKey, tags: tagsKey } = keysFor(getScope());
		draftContent.value = '';
		draftTags.value = [];
		localStorage.removeItem(contentKey);
		localStorage.removeItem(tagsKey);
		localStorage.removeItem(LEGACY_REFS_KEY);
		localStorage.removeItem(LEGACY_EMBEDS_KEY);
	}

	function hasDraft(): boolean {
		const { content: contentKey } = keysFor(getScope());
		return !!localStorage.getItem(contentKey);
	}

	return {
		draftContent,
		draftTags,
		restore,
		clearDraft,
		hasDraft,
	};
}
