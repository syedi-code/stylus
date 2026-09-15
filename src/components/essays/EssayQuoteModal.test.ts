import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { ref, computed } from 'vue';
import type { Author, Book, Quote } from '../../lib/api';

/**
 * Adding a quote from inside the essay.
 *
 * What these guard: it is a centred modal (not a bottom sheet), attribution
 * goes through the app's shared SourceSelector rather than hand-rolled text
 * fields, a pasted attribution resolves to a book you own, an author link
 * writes its connection, and a written quote reaches the shared library
 * before its token lands in the essay.
 */

const WRITTEN: Quote = {
	id: 'q-new',
	quote: 'Whoever fights monsters should see to it that he does not become one.',
	posted: false,
	tags: [],
	source: 'web',
	created_at: '',
	updated_at: '',
};

const createQuote = vi.fn(async (_input: unknown) => ({ ok: true, quote: WRITTEN }));
const createConnectionApi = vi.fn(async (_input: unknown) => ({ ok: true }));
vi.mock('../../lib/api', async () => {
	const actual = await vi.importActual<Record<string, unknown>>('../../lib/api');
	return {
		...actual,
		createQuote: (i: unknown) => createQuote(i),
		createConnectionApi: (i: unknown) => createConnectionApi(i),
	};
});

const BGE = { id: 'bge', title: 'Beyond Good and Evil', author: 'Friedrich Nietzsche' } as Book;
const NEWTON = { id: 'newton', name: 'Huey P. Newton' } as Author;

const registerQuote = vi.fn();
const quotes = ref<Quote[]>([]);
const books = ref<Book[]>([BGE]);
const authors = ref<Author[]>([NEWTON]);
vi.mock('../../composables/useSourceLibrary', () => ({
	useSourceLibrary: () => ({
		quotes,
		books,
		authors,
		authorById: computed(() => new Map(authors.value.map((a) => [a.id, a]))),
		loading: ref(false),
		ensureLoaded: vi.fn(async () => {}),
		registerQuote,
	}),
}));

/**
 * SourceSelector stand-in. The real one fetches books and authors on mount;
 * what matters here is the contract — it receives `initial`, and reports an
 * attribution through `update`.
 */
// vi.mock is hoisted above every top-level statement, so the stub has to be
// built inside the factory and share state through vi.hoisted.
const lastInitial = vi.hoisted(() => ({ value: null as unknown }));
vi.mock('../library/SourceSelector.vue', async () => {
	const { defineComponent, h } = await import('vue');
	return {
		default: defineComponent({
			name: 'SourceSelector',
			props: ['initial', 'entityType', 'compact'],
			emits: ['update'],
			setup(props, { emit, expose }) {
				lastInitial.value = props.initial;
				expose({ report: (a: unknown) => emit('update', a) });
				return () => h('div', { class: 'stub-source' });
			},
		}),
	};
});

import EssayQuoteModal from './EssayQuoteModal.vue';

function mountModal(props: Record<string, unknown> = {}) {
	return mount(EssayQuoteModal, {
		props: { isOpen: true, ...props },
		attachTo: document.body,
		global: { stubs: { Teleport: true, Transition: false } },
	});
}

beforeEach(() => {
	createQuote.mockClear();
	createConnectionApi.mockClear();
	registerQuote.mockClear();
	quotes.value = [];
	lastInitial.value = null;
	document.body.innerHTML = '';
});

describe('EssayQuoteModal — the object', () => {
	it('is a centred dialog, not a bottom sheet', async () => {
		const m = mountModal();
		await flushPromises();
		expect(m.find('[role="dialog"]').exists()).toBe(true);
		expect(m.find('.qm-panel').exists()).toBe(true);
		expect(m.findComponent({ name: 'BottomSheet' }).exists()).toBe(false);
	});

	it('attributes through the shared SourceSelector, not free-text fields', async () => {
		const m = mountModal();
		await flushPromises();
		expect(m.findComponent({ name: 'SourceSelector' }).exists()).toBe(true);
		// The old sheet's four hand-rolled inputs are gone.
		expect(m.findAll('.qm-body input')).toHaveLength(0);
	});

	it('closes on Escape and on the scrim', async () => {
		const m = mountModal();
		await flushPromises();
		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
		expect(m.emitted('close')).toHaveLength(1);
		await m.find('.qm-scrim').trigger('click');
		expect(m.emitted('close')).toHaveLength(2);
	});
});

describe('EssayQuoteModal — writing', () => {
	it('splits a pasted attribution off and resolves it to a book you own', async () => {
		const m = mountModal();
		await flushPromises();

		await m.find('textarea').setValue(
			'"Whoever fights monsters should see to it that he does not become one." — Nietzsche, Beyond Good and Evil, p. 89'
		);
		await m.find('.qm-split').trigger('click');
		await flushPromises();

		expect((m.find('textarea').element as HTMLTextAreaElement).value).toBe(
			'Whoever fights monsters should see to it that he does not become one.'
		);
		expect(lastInitial.value).toMatchObject({ mode: 'book', bookId: 'bge', page: '89' });
	});

	it('does not offer to split a line with no attribution tail', async () => {
		const m = mountModal();
		await flushPromises();
		await m.find('textarea').setValue('Just a line on its own.');
		expect(m.find('.qm-split').exists()).toBe(false);
	});

	it('writes a book-linked quote, registers it, and sets it in', async () => {
		const m = mountModal();
		await flushPromises();

		await m.find('textarea').setValue(WRITTEN.quote);
		(m.findComponent({ name: 'SourceSelector' }).vm as any).report({
			mode: 'book',
			bookId: 'bge',
			book: BGE,
			page: '89',
		});
		await flushPromises();
		await m.find('.qm-commit').trigger('click');
		await flushPromises();

		expect(createQuote.mock.calls[0][0]).toMatchObject({ book_id: 'bge', page: '89', work: 'Beyond Good and Evil' });
		expect(createConnectionApi).not.toHaveBeenCalled();
		expect(registerQuote).toHaveBeenCalledWith(WRITTEN);
		expect(m.emitted('select')?.[0]?.[0]).toEqual({ entity_type: 'quote', entity_id: 'q-new' });
	});

	it('links an author with a connection, and credits them by name', async () => {
		const m = mountModal();
		await flushPromises();

		await m.find('textarea').setValue(WRITTEN.quote);
		(m.findComponent({ name: 'SourceSelector' }).vm as any).report({ mode: 'author', authorId: 'newton' });
		await flushPromises();

		// The preview credits the author before anything is saved.
		expect(m.find('.qm-pv').text()).toContain('Newton');

		await m.find('.qm-commit').trigger('click');
		await flushPromises();

		expect(createQuote.mock.calls[0][0]).toMatchObject({ creator: 'Huey P. Newton' });
		expect(createConnectionApi).toHaveBeenCalledWith({
			a_type: 'author',
			a_id: 'newton',
			b_type: 'quote',
			b_id: 'q-new',
		});
	});

	it('says so and sets nothing in when the save fails', async () => {
		createQuote.mockRejectedValueOnce(new Error('offline'));
		const m = mountModal();
		await flushPromises();

		await m.find('textarea').setValue('Something worth keeping.');
		await m.find('.qm-commit').trigger('click');
		await flushPromises();

		expect(m.find('.qm-foot .err').exists()).toBe(true);
		expect(registerQuote).not.toHaveBeenCalled();
		expect(m.emitted('select')).toBeFalsy();
	});

	it('arrives pre-filled from a paste, with the attribution already resolved', async () => {
		const m = mountModal({ seed: { text: 'A pasted passage.', who: 'Huey P. Newton', work: '', page: '' } });
		await flushPromises();

		expect((m.find('textarea').element as HTMLTextAreaElement).value).toBe('A pasted passage.');
		expect(lastInitial.value).toMatchObject({ mode: 'author', authorId: 'newton' });
	});
});

describe('EssayQuoteModal — the library', () => {
	it('offers to write what you searched for when nothing matches', async () => {
		quotes.value = [{ ...WRITTEN, id: 'q-1', quote: 'Something else entirely.' }];
		const m = mountModal();
		await flushPromises();

		await m.findAll('.qm-tabs button')[1].trigger('click');
		await m.find('.qm-srch input').setValue('a line nobody has written');
		await m.find('.qm-empty button').trigger('click');

		expect((m.find('textarea').element as HTMLTextAreaElement).value).toBe('a line nobody has written');
	});

	it('sets an existing quote in without writing a new one', async () => {
		quotes.value = [{ ...WRITTEN, id: 'q-1' }];
		const m = mountModal();
		await flushPromises();

		await m.findAll('.qm-tabs button')[1].trigger('click');
		await m.find('.qm-row').trigger('click');

		expect(createQuote).not.toHaveBeenCalled();
		expect(m.emitted('select')?.[0]?.[0]).toMatchObject({ entity_id: 'q-1' });
	});
});
