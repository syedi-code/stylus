import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import EssaySpine from './EssaySpine.vue';
import { parseBlocks } from '../../../composables/useEssayBlocks';
import type { Essay } from '../../../lib/api';

/**
 * The spine replaced the essay index, so it is now the ONLY way to reach a
 * piece or to copy / delete one. These cover the things whose loss
 * would be silent: a row per piece, the shape rail, which piece reads as open,
 * and the actions that used to live on index rows.
 */

const QUOTE = '[[quote:11111111-1111-4111-8111-111111111111]]';

function essay(id: string, content: string): Essay {
	return {
		id,
		content,
		tags: [],
		references: [],
		created_at: '2026-01-01T00:00:00.000Z',
		updated_at: '2026-01-01T00:00:00.000Z',
	} as unknown as Essay;
}

const ESSAYS = [
	essay('a', ['Opening words of the first piece.', QUOTE].join('\n\n')),
	essay('b', '# A titled piece\n\nWith some prose in it.'),
];

function mountSpine(props: Record<string, unknown> = {}) {
	return mount(EssaySpine, {
		props: { essays: ESSAYS, currentId: 'a', ...props },
	});
}

describe('EssaySpine — pieces', () => {
	it('renders one row per piece', () => {
		expect(mountSpine().findAll('.piece')).toHaveLength(2);
	});

	it('draws the shape of each piece: one tick per block, amber for a source', () => {
		const rows = mountSpine().findAll('.piece');
		const ticks = rows[0].findAll('.rail i');
		expect(ticks).toHaveLength(2);
		expect(ticks[0].classes()).not.toContain('src'); // prose
		expect(ticks[1].classes()).toContain('src'); // the quote
	});

	it('marks the open piece, and only that one', () => {
		const rows = mountSpine().findAll('.piece');
		expect(rows[0].classes()).toContain('here');
		expect(rows[1].classes()).not.toContain('here');
	});

	it('names an untitled piece by its opening words and a titled one by its header', () => {
		const rows = mountSpine().findAll('.piece');
		expect(rows[0].find('.pt').text()).toMatch(/^Opening words/);
		expect(rows[0].find('.pt').classes()).toContain('untitled');
		expect(rows[1].find('.pt').text()).toBe('A titled piece');
		expect(rows[1].find('.pt').classes()).not.toContain('untitled');
	});

	it('opens a piece when its row is clicked', async () => {
		const spine = mountSpine();
		await spine.findAll('.piece')[1].trigger('click');
		expect(spine.emitted('open')?.[0]?.[0]).toMatchObject({ id: 'b' });
	});

	it('filters on the piece text', async () => {
		const spine = mountSpine();
		await spine.find('.filter').setValue('titled');
		const rows = spine.findAll('.piece');
		expect(rows).toHaveLength(1);
		expect(rows[0].find('.pt').text()).toBe('A titled piece');
	});
});

describe('EssaySpine — the actions the index used to own', () => {
	it('offers copy, and hides delete from non-admins', async () => {
		const spine = mountSpine({ isAdmin: false });
		await spine.findAll('.piece')[0].find('.kebab').trigger('click');

		const items = spine.findAll('.menu button').map((b) => b.text());
		expect(items).toContain('Copy text');
		expect(items).not.toContain('Delete');
	});

	it('offers delete to an admin, and emits the piece', async () => {
		const spine = mountSpine({ isAdmin: true });
		await spine.findAll('.piece')[0].find('.kebab').trigger('click');

		const del = spine.findAll('.menu button').find((b) => b.text() === 'Delete');
		expect(del).toBeTruthy();
		await del!.trigger('click');
		expect(spine.emitted('delete')?.[0]?.[0]).toMatchObject({ id: 'a' });
	});

	it('asks for a new piece', async () => {
		const spine = mountSpine();
		await spine.find('.newbtn').trigger('click');
		expect(spine.emitted('new')).toBeTruthy();
	});
});

describe('EssaySpine — this piece', () => {
	it('outlines the open piece and jumps to a block', async () => {
		const blocks = parseBlocks(['# A section', 'Some prose.', QUOTE].join('\n\n'));
		const spine = mountSpine({ currentBlocks: blocks });

		const items = spine.findAll('.oitem');
		expect(items).toHaveLength(3);
		expect(items[0].text()).toContain('A section');
		expect(items[2].classes()).toContain('quote');

		await items[2].trigger('click');
		expect(spine.emitted('goToBlock')?.[0]?.[0]).toBe(blocks[2].bid);
	});

	it('shows no outline section when nothing is open', () => {
		expect(mountSpine({ currentBlocks: [] }).findAll('.oitem')).toHaveLength(0);
	});
});

describe('EssaySpine — states', () => {
	it('surfaces an error with a retry rather than an empty rail', async () => {
		const spine = mountSpine({ essays: [], error: 'Network down' });
		expect(spine.find('.hint.err').text()).toContain('Network down');
		await spine.find('.hint.err button').trigger('click');
		expect(spine.emitted('retry')).toBeTruthy();
	});

	it('says so when there are no pieces, and when a filter matches none', async () => {
		expect(mountSpine({ essays: [] }).find('.hint').text()).toContain('No pieces yet');

		const spine = mountSpine();
		await spine.find('.filter').setValue('zzzz-no-match');
		expect(spine.find('.hint').text()).toContain('Nothing matches');
	});
});
