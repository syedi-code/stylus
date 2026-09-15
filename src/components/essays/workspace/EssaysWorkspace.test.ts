import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { ref } from 'vue';
import type { Essay } from '../../../lib/api';

/**
 * The Essays tab's own shell.
 *
 * THE REGRESSION THIS FILE EXISTS FOR: the tab rendered blank on the first
 * click and came right on any window resize. The room's height was measured
 * from this element's own offset in onMounted — and App.vue gives each tab a
 * separate `<transition>`, so `mode="out-in"` coordinates nothing between
 * them: the outgoing tab is still in the DOM, mid-fade, when this one mounts.
 * The offset came back as the height of the feed being replaced,
 * `calc(100dvh - that)` clamped to nothing, and an `overflow: hidden` root
 * showed an empty screen. A resize re-measured it, which is why it "fixed
 * itself" and why it looked intermittent.
 *
 * The height is CSS now, off a variable the header publishes, so there is no
 * moment at which it can be measured wrongly. These assert that the component
 * takes no measurement of its own.
 */

const ESSAYS: Essay[] = [
	{
		id: 'e-1',
		content: 'The first piece.',
		tags: [],
		references: [],
		created_at: '2026-01-01T00:00:00.000Z',
		updated_at: '2026-01-01T00:00:00.000Z',
	} as unknown as Essay,
];

const items = ref<Essay[]>([]);
vi.mock('../../../composables/usePagination', () => ({
	usePagination: () => ({
		items,
		loading: ref(false),
		loadingMore: ref(false),
		error: ref(''),
		loadInitial: vi.fn(async () => {
			items.value = ESSAYS;
		}),
		loadMore: vi.fn(),
		removeItem: vi.fn(),
	}),
}));
vi.mock('../../../lib/api', async () => {
	const actual = await vi.importActual<Record<string, unknown>>('../../../lib/api');
	return { ...actual, fetchEssays: vi.fn(async () => []), deleteEssay: vi.fn() };
});

import EssaysWorkspace from './EssaysWorkspace.vue';

function mountWorkspace() {
	return mount(EssaysWorkspace, {
		global: {
			stubs: {
				EssayWritingRoom: {
					name: 'EssayWritingRoom',
					props: ['essay', 'isOpen', 'inline'],
					template: '<div class="stub-room"><slot name="spine" /></div>',
				},
				EssaySpine: { name: 'EssaySpine', template: '<div class="stub-spine" />' },
			},
		},
	});
}

beforeEach(() => {
	items.value = [];
});

describe('EssaysWorkspace — the height', () => {
	it('never writes an inline height, however the tab was mounted', async () => {
		const ws = mountWorkspace();
		await flushPromises();

		// An inline `style="height: calc(100dvh - Npx)"` is the old measured
		// height and the whole of the bug: N was read at the one instant the
		// element was laid out below an outgoing tab.
		const root = ws.find('.ws-root');
		expect(root.attributes('style')).toBeUndefined();
	});

	it('takes no measurement of its own position', async () => {
		// Nothing in this component may depend on where it happens to sit when
		// it mounts — that is exactly what could not be trusted.
		const spy = vi.spyOn(Element.prototype, 'getBoundingClientRect');
		mountWorkspace();
		await flushPromises();
		expect(spy).not.toHaveBeenCalled();
		spy.mockRestore();
	});

	it('does not hang the layout on a window resize listener', async () => {
		const spy = vi.spyOn(window, 'addEventListener');
		mountWorkspace();
		await flushPromises();
		expect(spy.mock.calls.map((c) => c[0])).not.toContain('resize');
		spy.mockRestore();
	});
});

describe('EssaysWorkspace — which piece is open', () => {
	it('lands in the most recent piece rather than an empty state', async () => {
		const ws = mountWorkspace();
		await flushPromises();

		expect(ws.findComponent({ name: 'EssayWritingRoom' }).props('essay')).toMatchObject({
			id: 'e-1',
		});
		expect(ws.vm.isNewPiece).toBe(false);
	});

	it('reports a fresh piece, so the mobile write button can stand down', async () => {
		const ws = mountWorkspace();
		await flushPromises();

		ws.vm.newEssay();
		await flushPromises();

		// The tab IS the editor; once it is already showing a blank piece the
		// floating button has nothing left to do and sits on the insert rail.
		expect(ws.vm.isNewPiece).toBe(true);
		expect(ws.findComponent({ name: 'EssayWritingRoom' }).props('essay')).toBeNull();
	});
});
