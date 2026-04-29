import { computed, type Ref } from 'vue';
import type { Essay } from '../lib/api';

export type EssaySlide =
	| { kind: 'paragraph'; text: string; index: number }
	| { kind: 'end'; index: number };

export function useEssaySlides(essay: Ref<Essay | null>) {
	const slides = computed<EssaySlide[]>(() => {
		const e = essay.value;
		if (!e) return [];
		const paragraphs = e.content
			.split(/\n{2,}/)
			.map((p) => p.trim())
			.filter((p) => p.length > 0);
		const result: EssaySlide[] = paragraphs.map((text, index) => ({
			kind: 'paragraph',
			text,
			index,
		}));
		if (e.references?.length) {
			result.push({ kind: 'end', index: result.length });
		}
		return result;
	});

	const total = computed(() => slides.value.length);
	const bodyTotal = computed(
		() => slides.value.filter((s) => s.kind === 'paragraph').length
	);

	return { slides, total, bodyTotal };
}
