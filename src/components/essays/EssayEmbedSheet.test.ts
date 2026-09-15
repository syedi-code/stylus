import { describe, it, expect, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { ref } from 'vue';
import type { Author, Book } from '../../lib/api';

/**
 * The book picker. Quotes moved to EssayQuoteModal (see its tests); this only
 * has to find a book you own and set it in.
 */

const AUTHORS = [{ id: 'nietzsche', name: 'Friedrich Nietzsche' }] as Author[];
const BOOKS = [
	{ id: 'bge', title: 'Beyond Good and Evil', author: 'Friedrich Nietzsche', author_id: 'nietzsche' },
	{ id: 'gs', title: 'The Gay Science', author: 'Friedrich Nietzsche', author_id: 'nietzsche', cover_url: 'x' },
] as Book[];

vi.mock('../../composables/useSourceLibrary', () => ({
	useSourceLibrary: () => ({
		books: ref(BOOKS),
		authors: ref(AUTHORS),
		loading: ref(false),
		ensureLoaded: vi.fn(async () => {}),
	}),
}));
vi.mock('../shared/BottomSheet.vue', () => ({
	default: { name: 'BottomSheet', props: ['isOpen', 'panelClass'], template: '<div v-if="isOpen"><slot /></div>' },
}));

import EssayEmbedSheet from './EssayEmbedSheet.vue';

describe('EssayEmbedSheet — books', () => {
	it('is for books only now — no quote pane left behind', async () => {
		const s = mount(EssayEmbedSheet, { props: { isOpen: true } });
		await flushPromises();
		expect(s.find('h3').text()).toBe('Book');
		expect(s.find('textarea').exists()).toBe(false);
	});

	it('browses by author and sets the chosen book in', async () => {
		const s = mount(EssayEmbedSheet, { props: { isOpen: true } });
		await flushPromises();

		expect(s.findAll('.brow')).toHaveLength(2);
		await s.find('.srch input').setValue('gay');
		expect(s.findAll('.brow')).toHaveLength(1);

		await s.find('.brow').trigger('click');
		expect(s.emitted('select')?.[0]?.[0]).toEqual({ entity_type: 'book_cover', entity_id: 'gs' });
		expect(s.emitted('close')).toBeTruthy();
	});
});
