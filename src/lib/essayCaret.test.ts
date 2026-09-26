import { describe, it, expect } from 'vitest';
import { rawOffsetFor } from './essayCaret';

/** Where the caret lands in `raw` for a tap just before `needle` in `rendered`. */
function at(raw: string, rendered: string, needle: string) {
	return rawOffsetFor(raw, rendered, rendered.indexOf(needle));
}

describe('rawOffsetFor', () => {
	it('is the identity on plain prose', () => {
		expect(at('A plain sentence.', 'A plain sentence.', 'sentence')).toBe(2 + 'plain '.length);
	});

	it('steps over the markup the renderer ate', () => {
		const raw = 'In {1973}, three *Black Panthers* were stopped.';
		const rendered = 'In 1973, three Black Panthers were stopped.';
		expect(raw.slice(at(raw, rendered, 'were'))).toBe('were stopped.');
		expect(raw.slice(at(raw, rendered, 'Panthers'))).toBe('Panthers* were stopped.');
	});

	it('reads curly quotes back as the straight ones that were typed', () => {
		const raw = `He said "no" and didn't move.`;
		const rendered = 'He said “no” and didn’t move.';
		expect(raw.slice(at(raw, rendered, 'move'))).toBe('move.');
	});

	it('counts a smartened dash or ellipsis by its raw length', () => {
		const raw = 'Wait... then---nothing.';
		const rendered = 'Wait… then — nothing.';
		expect(raw.slice(at(raw, rendered, 'then'))).toBe('then---nothing.');
		expect(raw.slice(at(raw, rendered, 'nothing'))).toBe('nothing.');
	});

	it('reads a named thinker through its markers', () => {
		const raw = 'As ::Baldwin:: wrote';
		const rendered = 'As Baldwin wrote';
		expect(raw.slice(at(raw, rendered, 'wrote'))).toBe('wrote');
	});

	it('clamps to the ends', () => {
		expect(rawOffsetFor('abc', 'abc', 99)).toBe(3);
		expect(rawOffsetFor('abc', 'abc', -4)).toBe(0);
	});
});
