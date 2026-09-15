import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref } from 'vue';
import type { Quote } from '../../../lib/api';

/**
 * The quote surface in the writing view.
 *
 * All three of these are choices that look like accidents once they regress:
 * a texture and a gilt ring behind every quote (the manuscript becomes a
 * scrapbook), and a credit that right-aligns under the passage instead of
 * starting where the passage starts.
 */

const QUOTE: Quote = {
	id: 'q-1',
	quote: 'A community is a small unit with institutions that serve the people who live there.',
	creator: 'Huey P. Newton',
	work: 'Intercommunalism',
	page: '14',
	posted: false,
	tags: [],
	source: '',
	created_at: '2026-01-01T00:00:00.000Z',
	updated_at: '2026-01-01T00:00:00.000Z',
};

vi.mock('../../../composables/useSourceLibrary', () => ({
	useSourceLibrary: () => ({
		quoteById: ref(new Map([[QUOTE.id, QUOTE]])),
		bookById: ref(new Map()),
	}),
}));

import FoilQuote from './FoilQuote.vue';
import { usePresentationQuoteMode } from '../../../composables/usePresentationQuoteMode';

function mountFoil() {
	return mount(FoilQuote, {
		props: { block: { bid: 'b1', kind: 'quote', id: QUOTE.id, params: {} } as never },
	});
}

describe('FoilQuote — the resting surface', () => {
	it('paints no texture and no gilt ring', () => {
		const foil = mountFoil();
		const q = foil.find('blockquote');

		// `.is-textured` is what carries BOTH the baked grain and the 1px inset
		// gilt ring; `.tex-bg` is what actually loads an image.
		expect(q.classes()).not.toContain('is-textured');
		expect(q.classes()).not.toContain('tex-bg');
		expect(foil.html()).not.toContain('/textures/');
		expect(foil.find('.fq').classes()).toContain('m-plain');
	});

	it('still renders the quote, its marks and its credit', () => {
		const foil = mountFoil();
		expect(foil.text()).toContain('A community is a small unit');
		expect(foil.findAll('.qc-mark')).toHaveLength(2);
		expect(foil.find('.cite').exists()).toBe(true);
		expect(foil.text()).toContain('Newton');
		expect(foil.text()).toContain('Intercommunalism');
	});

	it('publishes the quote size so the hanging credit can line up with it', () => {
		// The credit hangs at the surface's top padding, which is em-relative
		// to the QUOTE. Read as an em on the 11px credit it would land the
		// author's name above the passage it belongs to.
		expect(mountFoil().find('.fq').attributes('style')).toMatch(/--qfs:\s*\d+px/);
	});

	it('rests on plain but keeps the textured card reachable', () => {
		const { mode, cycle, reset } = usePresentationQuoteMode('essay-write-v2', 'plain');
		expect(mode.value).toBe('plain');
		cycle();
		expect(mode.value).toBe('textured');
		reset();
		expect(mode.value).toBe('plain');
	});
});
