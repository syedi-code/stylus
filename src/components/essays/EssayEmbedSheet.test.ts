import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { ref } from 'vue';
import type { Quote } from '../../lib/api';

/**
 * The add-quote flow.
 *
 * The sheet used to be a picker and nothing else: a quote you had not captured
 * yet meant leaving the essay for the Quotes tab and coming back to search for
 * it. These cover the path that replaced that — and the two halves of it that
 * are silent when broken: a written quote never reaching the shared library
 * (the foil renders "quote unavailable" and nothing says why), and the sheet
 * throwing away a paste it was handed pre-parsed.
 */

const WRITTEN: Quote = {
	id: 'q-new',
	quote: 'The purpose of freedom is to create it for others.',
	creator: 'Toni Morrison',
	work: 'Commencement Address',
	page: '3',
	posted: false,
	tags: [],
	source: '',
	created_at: '2026-01-01T00:00:00.000Z',
	updated_at: '2026-01-01T00:00:00.000Z',
};

const createQuote = vi.fn(async () => ({ ok: true, quote: WRITTEN }));

vi.mock('../../lib/api', async () => {
	const actual = await vi.importActual<Record<string, unknown>>('../../lib/api');
	return { ...actual, createQuote: (...a: unknown[]) => createQuote(...(a as [])) };
});

const registerQuote = vi.fn();
// Real refs, not {value}-shaped stand-ins: the template reads `loading`
// directly, and Vue only unwraps an actual ref there — a plain object is
// simply truthy, which pins the sheet on its loading state forever.
const library = {
	quotes: ref<Quote[]>([]),
	books: ref([]),
	authors: ref([]),
	loading: ref(false),
	ensureLoaded: vi.fn(async () => {}),
	registerQuote,
};
vi.mock('../../composables/useSourceLibrary', () => ({
	useSourceLibrary: () => library,
}));

// BottomSheet teleports and animates; neither is what these are about.
vi.mock('../shared/BottomSheet.vue', () => ({
	default: {
		name: 'BottomSheet',
		props: ['isOpen', 'panelClass'],
		template: '<div v-if="isOpen"><slot /></div>',
	},
}));

import EssayEmbedSheet from './EssayEmbedSheet.vue';

function mountSheet(props: Record<string, unknown> = {}) {
	return mount(EssayEmbedSheet, {
		props: { isOpen: true, initialKind: 'quote', ...props },
	});
}

beforeEach(() => {
	library.quotes.value = [];
	createQuote.mockClear();
	registerQuote.mockClear();
});

describe('EssayEmbedSheet — writing a quote', () => {
	it('opens on Write, not on the library', async () => {
		const sheet = mountSheet();
		await flushPromises();

		const tabs = sheet.findAll('.tabs button');
		expect(tabs.map((t) => t.text())).toEqual(['Write', 'Library']);
		expect(tabs[0].classes()).toContain('on');
		expect(sheet.find('.field textarea').exists()).toBe(true);
	});

	it('splits a pasted line into its four fields', async () => {
		const sheet = mountSheet();
		await flushPromises();

		await sheet.find('.field textarea').setValue(
			'"The purpose of freedom is to create it for others." — Toni Morrison, Commencement Address, p. 3'
		);
		await sheet.find('.parsebar button').trigger('click');

		const inputs = sheet.findAll('.field input');
		expect((sheet.find('.field textarea').element as HTMLTextAreaElement).value).toBe(
			'The purpose of freedom is to create it for others.'
		);
		expect((inputs[0].element as HTMLInputElement).value).toBe('Toni Morrison');
		expect((inputs[1].element as HTMLInputElement).value).toBe('Commencement Address');
		expect((inputs[2].element as HTMLInputElement).value).toBe('3');
	});

	it('writes the quote, puts it in the shared library, and sets it in', async () => {
		const sheet = mountSheet();
		await flushPromises();

		await sheet.find('.field textarea').setValue(WRITTEN.quote);
		await sheet.find('.commit').trigger('click');
		await flushPromises();

		expect(createQuote).toHaveBeenCalledTimes(1);
		// Into the catalogue BEFORE the token lands, or the foil resolves to
		// "quote unavailable" until an unrelated refetch happens to run.
		expect(registerQuote).toHaveBeenCalledWith(WRITTEN);
		expect(sheet.emitted('select')?.[0]?.[0]).toEqual({
			entity_type: 'quote',
			entity_id: 'q-new',
		});
		expect(sheet.emitted('close')).toBeTruthy();
	});

	it('will not commit an empty line', async () => {
		const sheet = mountSheet();
		await flushPromises();
		expect((sheet.find('.commit').element as HTMLButtonElement).disabled).toBe(true);
	});

	it('says so and writes nothing when the save fails', async () => {
		createQuote.mockRejectedValueOnce(new Error('offline'));
		const sheet = mountSheet();
		await flushPromises();

		await sheet.find('.field textarea').setValue('Something worth keeping.');
		await sheet.find('.commit').trigger('click');
		await flushPromises();

		expect(sheet.find('.foot .err').exists()).toBe(true);
		expect(registerQuote).not.toHaveBeenCalled();
		expect(sheet.emitted('select')).toBeFalsy();
	});

	it('arrives pre-filled from a passage already pasted into the manuscript', async () => {
		const sheet = mountSheet({
			seed: { text: 'A pasted passage.', who: 'Someone', work: 'A Book', page: '9' },
		});
		await flushPromises();

		expect((sheet.find('.field textarea').element as HTMLTextAreaElement).value).toBe(
			'A pasted passage.'
		);
		const inputs = sheet.findAll('.field input');
		expect((inputs[0].element as HTMLInputElement).value).toBe('Someone');
	});
});

describe('EssayEmbedSheet — the library', () => {
	it('offers to write what you searched for when nothing matches', async () => {
		library.quotes.value = [{ ...WRITTEN, id: 'q-1', quote: 'Something else entirely.' }];
		const sheet = mountSheet();
		await flushPromises();

		await sheet.findAll('.tabs button')[1].trigger('click');
		await sheet.find('.srch input').setValue('a line nobody has written');
		await sheet.find('.empty button').trigger('click');

		// …and it carries the search across, rather than dropping you in front
		// of an empty form holding the words you just typed.
		expect((sheet.find('.field textarea').element as HTMLTextAreaElement).value).toBe(
			'a line nobody has written'
		);
	});

	it('sets an existing quote in without writing a new one', async () => {
		library.quotes.value = [{ ...WRITTEN, id: 'q-1' }];
		const sheet = mountSheet();
		await flushPromises();

		await sheet.findAll('.tabs button')[1].trigger('click');
		await sheet.find('.qrow').trigger('click');

		expect(createQuote).not.toHaveBeenCalled();
		expect(sheet.emitted('select')?.[0]?.[0]).toMatchObject({ entity_id: 'q-1' });
	});
});
