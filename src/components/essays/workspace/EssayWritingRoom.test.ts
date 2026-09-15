import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import type { Essay } from '../../../lib/api';

// The room reaches for the network on mount (source library, saving); none of
// that is what these tests are about.
vi.mock('../../../lib/api', async () => {
	const actual = await vi.importActual<Record<string, unknown>>('../../../lib/api');
	return {
		...actual,
		createEssay: vi.fn(async () => ({ ok: true, essay: {} })),
		uploadEssayImage: vi.fn(),
		getFileUrl: (u: string) => u,
	};
});
vi.mock('../../../composables/useSourceLibrary', () => ({
	useSourceLibrary: () => ({
		ensureLoaded: vi.fn(),
		registerImage: vi.fn(),
		quotes: {
			value: [{ id: 'q-1', quote: 'Quote.', creator: 'Aristotle' }],
		},
		books: { value: [] },
		quoteById: { value: new Map() },
		bookById: { value: new Map() },
		imageUrl: () => undefined,
	}),
}));

import EssayWritingRoom from './EssayWritingRoom.vue';

const ESSAY: Essay = {
	id: 'e-1',
	content: 'The colonized serve their colonizers, such is the arrangement of power.',
	tags: [],
	references: [],
	created_at: '2026-01-01T00:00:00.000Z',
	updated_at: '2026-01-01T00:00:00.000Z',
} as unknown as Essay;

function mountRoom(props: Record<string, unknown> = {}) {
	return mount(EssayWritingRoom, {
		props: { isOpen: true, inline: true, essay: ESSAY, ...props },
		global: {
			stubs: {
				// Heavy children with their own concerns; the room's own
				// initialisation is what is under test.
				EssayBlockEditor: {
					name: 'EssayBlockEditor',
					template: '<div class="stub-editor" />',
				},
				EssayEmbedSheet: true,
				EssayDeckRail: true,
			},
		},
	});
}

beforeEach(() => {
	localStorage.clear();
});

describe('EssayWritingRoom — mounted already open (the Essays tab)', () => {
	/**
	 * THE REGRESSION.
	 *
	 * The room was written for a modal, where `isOpen` goes false → true and a
	 * watcher seeds the content. Rendered inline as the Essays tab it mounts
	 * already-open, so that transition never happens — the watcher never ran,
	 * nothing seeded the content, and the tab rendered blank. It shipped.
	 */
	it('seeds its content on mount, without waiting for isOpen to change', async () => {
		const room = mountRoom();
		await flushPromises();

		expect(room.emitted('content')).toBeTruthy();
		const last = room.emitted('content')!.at(-1)![0] as string;
		expect(last).toBe(ESSAY.content);
	});

	it('shows a populated status line rather than an empty one', async () => {
		const room = mountRoom();
		await flushPromises();

		// .text() concatenates the spans with no separator ('0 slides11 words'),
		// so match the readout itself rather than relying on word boundaries.
		const status = room.find('.wr-status').text();
		expect(status).toContain('11 words');
		expect(status).not.toContain('0 words');
	});

	it('re-seeds when the piece changes, because the spine switches pieces in place', async () => {
		const room = mountRoom();
		await flushPromises();

		const other = { ...ESSAY, id: 'e-2', content: 'A wholly different piece.' } as Essay;
		await room.setProps({ essay: other });
		await flushPromises();

		const last = room.emitted('content')!.at(-1)![0] as string;
		expect(last).toBe(other.content);
	});

	it('starts empty for a new piece instead of carrying the last one over', async () => {
		const room = mountRoom({ essay: null });
		await flushPromises();

		const last = room.emitted('content')!.at(-1)![0] as string;
		expect(last).toBe('');
	});
});

describe('EssayWritingRoom — chrome', () => {
	it('offers the hamburger and hides Close when it IS the tab', async () => {
		const room = mountRoom({ inline: true });
		await flushPromises();

		expect(room.find('.burger').exists()).toBe(true);
		// Nothing to close to when the room is the whole tab.
		expect(room.text()).not.toContain('Close');
	});

	it('keeps Close when it is a modal over something else', async () => {
		const room = mountRoom({ inline: false });
		await flushPromises();

		expect(room.text()).toContain('Close');
	});

	it('retracts the chrome while writing and restores it on scroll', async () => {
		const room = mountRoom();
		await flushPromises();

		expect(room.find('.edchrome').classes()).not.toContain('writing');

		await room.findComponent({ name: 'EssayBlockEditor' }).vm.$emit('typing');
		await flushPromises();
		expect(room.find('.edchrome').classes()).toContain('writing');

		await room.find('.wr-scroll').trigger('scroll');
		expect(room.find('.edchrome').classes()).not.toContain('writing');
	});
});

describe('EssayWritingRoom \u2014 the rail', () => {
	it('names every insert once \u2014 no two pills reading the same word', async () => {
		const room = mountRoom();
		await flushPromises();

		// .text() runs each pill's glyph into its label, so compare the words.
		const labels = room.findAll('.pill').map((p) => p.text().replace(/[^A-Za-z]/g, ''));
		expect(labels).toEqual(['Quote', 'Book', 'Image', 'Header']);
		// The rail used to carry two "recent quote" chips labelled with the
		// quote's own opening words \u2014 so beside the Quote button it read
		// "Quote / Book / Quote\u2026 / Quote\u2026", and the duplicates were the feature.
		expect(room.findAll('.pill.recent')).toHaveLength(0);
	});

	it('keeps all four formatting controls in a cluster that cannot be cropped', async () => {
		const room = mountRoom();
		await flushPromises();

		// `.fmt` was declared twice in this component's stylesheet: once as the
		// container, and again \u2014 later, so it won \u2014 as a 30x30 grid cell. The
		// four buttons were being laid out inside a box narrower than two of
		// them, which is why B/I/U/H vanished off the bottom-right on a small
		// window. One declaration now, and the cluster never shrinks.
		const fmt = room.find('.wr-foot .fmt');
		expect(fmt.exists()).toBe(true);
		expect(fmt.findAll('.fmt-b').map((b) => b.text())).toEqual(['B', 'I', 'U', 'H']);
	});
});

describe('EssayWritingRoom \u2014 the header', () => {
	it('leads with the piece, and ends with exactly one filled control', async () => {
		const room = mountRoom();
		await flushPromises();

		const top = room.find('.edtop');
		// Identity first: the badge and the name are the start of the row, not
		// the tail end of a pile of buttons in the far corner.
		expect(top.find('.edbadge').text()).toBe('essay');
		expect(top.find('.ednm .t').exists()).toBe(true);
		// Tags and Present are quiet glyphs; Save is the only filled control.
		expect(top.findAll('.wr-btn.gold')).toHaveLength(1);
		expect(top.findAll('.itg').length).toBeGreaterThanOrEqual(1);
	});
});

describe('EssayWritingRoom \u2014 starting a new piece', () => {
	it('says that a new piece started, because nothing else visibly happens', async () => {
		// The room is always open, so "new essay" used to look identical to the
		// text disappearing \u2014 which reads as a fault, not as a beginning. On a
		// phone the button that does it is at the far end of the screen from the
		// only thing that changed.
		const room = mountRoom({ essay: null });
		await flushPromises();

		const flash = room.find('.newflash');
		expect(flash.exists()).toBe(true);
		expect(flash.text()).toContain('New piece');
	});

	it('says nothing when an existing piece is opened', async () => {
		const room = mountRoom();
		await flushPromises();
		expect(room.find('.newflash').exists()).toBe(false);
	});

	it('gets out of the way as soon as writing starts', async () => {
		const room = mountRoom({ essay: null });
		await flushPromises();
		expect(room.find('.newflash').exists()).toBe(true);

		await room.findComponent({ name: 'EssayBlockEditor' }).vm.$emit('typing');
		await flushPromises();
		expect(room.find('.newflash').exists()).toBe(false);
	});
});
