import { computed, type Ref } from 'vue';
import type { Essay, EssayReference } from '../lib/api';
import { parseEssayToken, type ParsedToken } from '@antisocial/core';
import { useSourceLibrary } from './useSourceLibrary';

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
 * `position` field. Token grammar (including the optional attr-tail) is
 * owned by `essay-tokens.ts`; this composable does not re-parse.
 */
export type EssaySlide =
	| { kind: 'paragraph'; text: string; index: number }
	| { kind: 'header'; text: string; index: number }
	| { kind: 'quote'; reference: EssayReference; index: number }
	| { kind: 'bookCover'; reference: EssayReference; index: number }
	| { kind: 'image'; reference: EssayReference; index: number };

const HEADER_RE = /^#\s+(.+)$/;

export function useEssaySlides(essay: Ref<Essay | null>) {
	// Fallback resolver: an essay presented from a list (or one whose
	// server-side reference derivation is stale/missing) may carry no
	// `references`, which would silently drop its quote / book slides. We
	// resolve those tokens client-side from the shared source library — the
	// same catalogue the editor foils read — so the deck is never missing an
	// embed just because the join didn't come along.
	const { quoteById, bookById, imageUrl, ensureLoaded } = useSourceLibrary();
	ensureLoaded();

	function synthReference(parsed: ParsedToken): EssayReference | undefined {
		const base = { id: '', entity_id: parsed.id, position: 0, params: parsed.params } as const;
		if (parsed.kind === 'quote') {
			const q = quoteById.value.get(parsed.id);
			if (!q) return undefined;
			const book = q.book_id ? bookById.value.get(q.book_id) : undefined;
			return {
				...base,
				entity_type: 'quote',
				quote_text: q.quote,
				quote_creator: q.creator,
				quote_work: q.work,
				quote_page: q.page,
				book_id: q.book_id,
				book_title: book?.title,
				book_author: book?.author,
				book_originally_published: book?.originally_published,
			} as unknown as EssayReference;
		}
		if (parsed.kind === 'book') {
			const b = bookById.value.get(parsed.id);
			if (!b) return undefined;
			return {
				...base,
				entity_type: 'book_cover',
				book_title: b.title,
				book_author: b.author,
				book_originally_published: b.originally_published,
				book_cover_url: b.cover_url,
			} as unknown as EssayReference;
		}
		const url = imageUrl(parsed.id);
		if (!url) return undefined;
		return {
			...base,
			entity_type: 'image',
			image_url: url,
			image_caption: typeof parsed.params.caption === 'string' ? parsed.params.caption : undefined,
		} as unknown as EssayReference;
	}

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
			const parsed = parseEssayToken(p);
			if (parsed) {
				const refKey =
					parsed.kind === 'quote'
						? `quote:${parsed.id}`
						: parsed.kind === 'image'
							? `image:${parsed.id}`
							: `book_cover:${parsed.id}`;
				const reference = refByKey.get(refKey) ?? synthReference(parsed);
				if (!reference) continue; // unresolved even via the library — skip
				if (parsed.kind === 'quote') {
					result.push({ kind: 'quote', reference, index: cursor++ });
				} else if (parsed.kind === 'image') {
					result.push({ kind: 'image', reference, index: cursor++ });
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

		return result;
	});

	const total = computed(() => slides.value.length);
	const bodyTotal = computed(
		() => slides.value.filter((s) => s.kind === 'paragraph').length
	);

	return { slides, total, bodyTotal };
}
