import { describe, it, expect } from 'vitest';
import {
	matchSlashCommand,
	parsePastedQuote,
	splitQuoteInput,
	joinKind,
	joinClassMap,
	spineRow,
	filterEssays,
	outlineOf,
	MAX_RAIL_TICKS,
} from './essayWorkspace';
import { parseBlocks } from '../composables/useEssayBlocks';
import type { Essay } from './api';

/**
 * Regression tests for the Essays workspace.
 *
 * Each of these guards a decision that is easy to break and silent when
 * broken: a slash command firing inside prose, a paste offer interrupting
 * ordinary writing, the rhythm landing on the wrong join, the spine
 * mis-describing a piece.
 */

function essay(content: string, over: Partial<Essay> = {}): Essay {
	return {
		id: 'e1',
		content,
		created_at: new Date().toISOString(),
		updated_at: new Date().toISOString(),
		references: [],
		...over,
	} as unknown as Essay;
}

const QUOTE_TOKEN = '[[quote:11111111-1111-4111-8111-111111111111]]';
const BOOK_TOKEN = '[[book:22222222-2222-4222-8222-222222222222]]';

describe('matchSlashCommand', () => {
	it('fires for each command, only with the terminating space', () => {
		expect(matchSlashCommand('/quote ')).toBe('quote');
		expect(matchSlashCommand('/section ')).toBe('section');
		expect(matchSlashCommand('/book ')).toBe('book');
		expect(matchSlashCommand('/image ')).toBe('image');
		// Still being typed — firing here would eat the keystroke.
		expect(matchSlashCommand('/quote')).toBeNull();
	});

	it('never fires inside prose', () => {
		// The whole point of anchoring to the start of an empty line: ordinary
		// writing is full of slashes.
		expect(matchSlashCommand('and/or ')).toBeNull();
		expect(matchSlashCommand('He wrote /quote ')).toBeNull();
		expect(matchSlashCommand('see https://x.com/quote ')).toBeNull();
		expect(matchSlashCommand('12/4 ')).toBeNull();
		expect(matchSlashCommand('/unknown ')).toBeNull();
	});
});

describe('parsePastedQuote', () => {
	it('parses a quoted passage with a full attribution tail', () => {
		const p = parsePastedQuote(
			'"The dialectical materialist believes that everything in existence has contradictions." — Huey P. Newton, Intercommunalism, p. 14',
			true
		);
		expect(p).not.toBeNull();
		expect(p!.text).toMatch(/^The dialectical materialist/);
		expect(p!.text).not.toContain('"');
		expect(p!.creator).toBe('Huey P. Newton');
		expect(p!.work).toBe('Intercommunalism');
		expect(p!.page).toBe('14');
		expect(p!.whole).toBe(true);
	});

	it('accepts curly quotes and a bare passage with no attribution', () => {
		const p = parsePastedQuote('“A community is a small unit with institutions that serve people.”', false);
		expect(p).not.toBeNull();
		expect(p!.creator).toBeUndefined();
		expect(p!.whole).toBe(false);
	});

	it('declines anything that is not plausibly a quote', () => {
		// A false positive interrupts writing with a prompt nobody asked for,
		// which is worse than missing one.
		expect(parsePastedQuote('Just some prose I pasted in from my notes.', true)).toBeNull();
		expect(parsePastedQuote('"short"', true)).toBeNull();
		expect(parsePastedQuote('', true)).toBeNull();
		expect(parsePastedQuote(`"${'x'.repeat(2500)}"`, true)).toBeNull();
	});
});

describe('splitQuoteInput', () => {
	it('pulls the four fields out of one pasted line', () => {
		const d = splitQuoteInput(
			'\u201cThe purpose of freedom is to create it for others.\u201d \u2014 Toni Morrison, Commencement Address, p. 3'
		)!;
		expect(d.text).toBe('The purpose of freedom is to create it for others.');
		expect(d.who).toBe('Toni Morrison');
		expect(d.work).toBe('Commencement Address');
		expect(d.page).toBe('3');
	});

	it('takes the LAST dash as the boundary', () => {
		// Quotes contain dashes constantly; attributions are always at the end.
		const d = splitQuoteInput('A line \u2014 with an aside \u2014 and an end. \u2014 Someone')!;
		expect(d.text).toBe('A line \u2014 with an aside \u2014 and an end.');
		expect(d.who).toBe('Someone');
	});

	it('reads the parenthesised and italicised attribution forms too', () => {
		expect(splitQuoteInput('A line. \u2014 Emerson (The Conduct of Life)')!.work).toBe(
			'The Conduct of Life'
		);
		expect(splitQuoteInput('A line. \u2014 Emerson, *The Conduct of Life*')!.work).toBe(
			'The Conduct of Life'
		);
	});

	it('accepts a bare passage with no marks and no attribution', () => {
		// Where parsePastedQuote declines \u2014 this one only runs because you
		// pressed the button, so a half-split is better than nothing.
		const d = splitQuoteInput('Just a line I typed out myself')!;
		expect(d.text).toBe('Just a line I typed out myself');
		expect(d.who).toBe('');
		expect(splitQuoteInput('   ')).toBeNull();
	});
});

describe('the rhythm of the surface', () => {
	const blocks = parseBlocks(
		['First paragraph.', QUOTE_TOKEN, BOOK_TOKEN, 'Prose after the objects.'].join('\n\n')
	);

	it('distinguishes the three kinds of join', () => {
		expect(blocks).toHaveLength(4);
		expect(joinKind(blocks[0], blocks[1])).toBe('j-after-text');
		// Two objects in a row tuck together — essays here open on three
		// quotes routinely.
		expect(joinKind(blocks[1], blocks[2])).toBe('j-stacked');
		expect(joinKind(blocks[2], blocks[3])).toBe('j-after-embed');
	});

	it('leaves the first block without a join', () => {
		const m = joinClassMap(blocks);
		expect(m.has(blocks[0].bid)).toBe(false);
		expect(m.size).toBe(blocks.length - 1);
	});
});

describe('spineRow', () => {
	it('describes a piece by its shape, not just its name', () => {
		const r = spineRow(essay(['Opening line of the piece.', QUOTE_TOKEN, BOOK_TOKEN].join('\n\n')));
		expect(r.blockCount).toBe(3);
		// dim, amber, amber — prose then two sources.
		expect(r.ticks).toEqual([false, true, true]);
		expect(r.words).toBeGreaterThan(0);
	});

	it('names an untitled piece by its opening words, and a titled one by its header', () => {
		const untitled = spineRow(essay('Are we all Platonists? Doctrinal beings, ever distant.'));
		expect(untitled.untitled).toBe(true);
		expect(untitled.name).toMatch(/^Are we all Platonists/);

		const titled = spineRow(essay('# On keeping a commonplace book\n\nThe habit is older.'));
		expect(titled.untitled).toBe(false);
		expect(titled.name).toBe('On keeping a commonplace book');
	});

	it('caps the rail but still reports the true block count', () => {
		const many = Array.from({ length: 20 }, (_, i) => `Paragraph ${i}.`).join('\n\n');
		const r = spineRow(essay(many));
		expect(r.ticks).toHaveLength(MAX_RAIL_TICKS);
		expect(r.blockCount).toBe(20);
	});
});

describe('filterEssays', () => {
	const all = [essay('Newton and intercommunalism', { id: 'a' }), essay('Plato and the forms', { id: 'b' })];

	it('matches on the piece text, case-insensitively', () => {
		expect(filterEssays(all, 'NEWTON').map((e) => e.id)).toEqual(['a']);
		expect(filterEssays(all, 'forms').map((e) => e.id)).toEqual(['b']);
		expect(filterEssays(all, 'nothing here')).toEqual([]);
	});

	it('returns everything for an empty filter, without aliasing the input', () => {
		const out = filterEssays(all, '   ');
		expect(out).toHaveLength(2);
		expect(out).not.toBe(all);
	});
});

describe('outlineOf', () => {
	it('labels objects by kind and prose by its opening', () => {
		const blocks = parseBlocks(
			['# A section', 'Some prose here.', QUOTE_TOKEN].join('\n\n')
		);
		const o = outlineOf(blocks);
		expect(o.map((x) => x.kind)).toEqual(['header', 'para', 'quote']);
		expect(o[0].label).toBe('A section');
		expect(o[1].label).toBe('Some prose here.');
		expect(o[2].label).toBe('quote');
		expect(o.map((x) => x.n)).toEqual([1, 2, 3]);
	});

	it('gives empty blocks a readable placeholder rather than a blank row', () => {
		const o = outlineOf(parseBlocks('# \n\n'));
		expect(o.every((x) => x.label.trim().length > 0)).toBe(true);
	});
});
