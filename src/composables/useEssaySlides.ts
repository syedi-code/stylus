import { computed, type Ref } from 'vue';
import type { Essay, EssayReference } from '../lib/api';

/**
 * Slide kinds in an essay deck.
 *
 * Slides are derived entirely from `essay.content`:
 * - prose paragraphs become `paragraph` slides;
 * - paragraphs starting with `# ` become `header` slides;
 * - paragraphs that are an inline embed token become `quote` or `bookCover`;
 * - if any references resolved, an `end` slide closes the deck.
 *
 * `essay.references` is consulted only as a lookup table — the *order* of
 * embeds comes from where their tokens sit in the prose, not from any
 * `position` field.
 */
export type EssaySlide =
	| { kind: 'paragraph'; text: string; index: number }
	| { kind: 'header'; text: string; index: number }
	| { kind: 'quote'; reference: EssayReference; index: number }
	| { kind: 'bookCover'; reference: EssayReference; index: number }
	| { kind: 'end'; index: number };

const TOKEN_RE = /^\[\[(quote|book):([0-9a-fA-F-]{36})\]\]$/;
const HEADER_RE = /^#\s+(.+)$/;

export function useEssaySlides(essay: Ref<Essay | null>) {
	const slides = computed<EssaySlide[]>(() => {
		const e = essay.value;
		if (!e) return [];

		// Index references by entity_id for token resolution. There's at most
		// one reference per entity_id per essay (unique constraint), and we
		// look up by entity_type + entity_id since the same id could appear in
		// theory under different types.
		const refByKey = new Map<string, EssayReference>();
		for (const r of e.references ?? []) {
			refByKey.set(`${r.entity_type}:${r.entity_id}`, r);
		}

		const paragraphs = e.content
			.split(/\n{2,}/)
			.map((p) => p.trim())
			.filter((p) => p.length > 0);

		const result: EssaySlide[] = [];
		let cursor = 0;

		for (const p of paragraphs) {
			const tokenMatch = p.match(TOKEN_RE);
			if (tokenMatch) {
				const kind = tokenMatch[1] as 'quote' | 'book';
				const id = tokenMatch[2];
				const refKey =
					kind === 'quote' ? `quote:${id}` : `book_cover:${id}`;
				const reference = refByKey.get(refKey);
				if (!reference) continue; // token without resolved ref — skip silently
				if (kind === 'quote') {
					result.push({ kind: 'quote', reference, index: cursor++ });
				} else {
					result.push({ kind: 'bookCover', reference, index: cursor++ });
				}
				continue;
			}

			const headerMatch = p.match(HEADER_RE);
			if (headerMatch) {
				result.push({
					kind: 'header',
					text: headerMatch[1].trim(),
					index: cursor++,
				});
				continue;
			}

			result.push({ kind: 'paragraph', text: p, index: cursor++ });
		}

		// End slide whenever the essay has any references (citations exist).
		if ((e.references ?? []).length) {
			result.push({ kind: 'end', index: cursor++ });
		}

		return result;
	});

	const total = computed(() => slides.value.length);
	const bodyTotal = computed(
		() => slides.value.filter((s) => s.kind === 'paragraph').length
	);

	return { slides, total, bodyTotal };
}
