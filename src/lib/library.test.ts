import { describe, it, expect } from 'vitest';
import type { LibraryBook } from './api';
import {
	addedLabel,
	authorSortKey,
	filterBooks,
	fold,
	highlight,
	sortBooks,
	titleSortKey,
	toRows,
} from './library';

function book(id: string, title: string, author: string, extra: Partial<LibraryBook> = {}): LibraryBook {
	return {
		id,
		title,
		author,
		author_id: `a:${author}`,
		originally_published: '1950',
		created_at: '2026-01-01T00:00:00.000Z',
		updated_at: '2026-01-01T00:00:00.000Z',
		quote_count: 0,
		note_count: 0,
		citation_count: 0,
		media_count: 0,
		has_pdf: 0,
		decade: '1900s',
		last_activity_at: null,
		...extra,
	};
}

const titles = (bs: LibraryBook[]) => bs.map((b) => b.title);

describe('filing', () => {
	it('files authors under their surname, the way a catalogue does', () => {
		expect(authorSortKey('Michel de Montaigne')).toBe('montaigne michel de');
		expect(authorSortKey('W. G. Sebald').startsWith('sebald')).toBe(true);
		expect(authorSortKey('Martin Luther King Jr.').startsWith('king')).toBe(true);
		expect(authorSortKey('Plato')).toBe('plato');
	});

	it('files titles without a leading article', () => {
		expect(titleSortKey('The Waves')).toBe('waves');
		expect(titleSortKey('A Room of One’s Own')).toBe('room of one’s own');
		expect(titleSortKey('Anthem')).toBe('anthem');
	});

	it('folds accents so Césaire and Cesaire are one person to search', () => {
		expect(fold('Aimé Césaire')).toBe('aime cesaire');
		expect(fold('Søren').length).toBe('Søren'.length);
	});
});

describe('sortBooks', () => {
	const shelf = [
		book('1', 'Beloved', 'Toni Morrison', { originally_published: '1987' }),
		book('2', 'Discourse on Colonialism', 'Aimé Césaire', { originally_published: '1950' }),
		book('3', 'Symposium', 'Plato', { originally_published: '' }),
		book('4', 'Essays', 'Michel de Montaigne', { originally_published: '1580', quote_count: 40 }),
	];

	it('sorts by surname, not by the first word of the name', () => {
		expect(titles(sortBooks(shelf, 'author', 'asc'))).toEqual([
			'Discourse on Colonialism', // Césaire
			'Essays', // Montaigne
			'Beloved', // Morrison
			'Symposium', // Plato
		]);
	});

	it('keeps undated books last in either year direction', () => {
		expect(titles(sortBooks(shelf, 'year', 'asc')).at(-1)).toBe('Symposium');
		expect(titles(sortBooks(shelf, 'year', 'desc')).at(-1)).toBe('Symposium');
		expect(titles(sortBooks(shelf, 'year', 'desc'))[0]).toBe('Beloved');
	});

	it('puts the most written-about book first under writing', () => {
		expect(titles(sortBooks(shelf, 'writing', 'desc'))[0]).toBe('Essays');
	});
});

describe('filterBooks', () => {
	const shelf = [
		book('1', 'Discourse on Colonialism', 'Aimé Césaire', { has_pdf: 1 }),
		book('2', 'Beloved', 'Toni Morrison', { note_count: 2 }),
	];

	it('matches author or title without caring about accents or case', () => {
		expect(titles(filterBooks(shelf, { query: 'cesaire', pdf: false, writing: false }))).toEqual([
			'Discourse on Colonialism',
		]);
		expect(titles(filterBooks(shelf, { query: 'BELOV', pdf: false, writing: false }))).toEqual(['Beloved']);
	});

	it('narrows to books with a PDF, or with writing attached', () => {
		expect(titles(filterBooks(shelf, { query: '', pdf: true, writing: false }))).toEqual([
			'Discourse on Colonialism',
		]);
		expect(titles(filterBooks(shelf, { query: '', pdf: false, writing: true }))).toEqual(['Beloved']);
	});
});

describe('highlight', () => {
	it('marks the match in the text as displayed, accents intact', () => {
		expect(highlight('Aimé Césaire', 'cesa')).toEqual([
			{ text: 'Aimé ', match: false },
			{ text: 'Césa', match: true },
			{ text: 'ire', match: false },
		]);
	});

	it('returns the text whole when nothing matches', () => {
		expect(highlight('Beloved', 'zz')).toEqual([{ text: 'Beloved', match: false }]);
	});
});

describe('toRows', () => {
	const shelf = sortBooks(
		[
			book('1', 'The Fire Next Time', 'James Baldwin'),
			book('2', 'Giovanni’s Room', 'James Baldwin'),
			book('3', 'Beloved', 'Toni Morrison'),
		],
		'author',
		'asc'
	);

	it('starts a run at each new author under the author sort', () => {
		expect(toRows(shelf, 'author').map((r) => r.startsRun)).toEqual([false, false, true]);
	});

	it('never starts a run under any other sort', () => {
		expect(toRows(shelf, 'title').some((r) => r.startsRun)).toBe(false);
	});
});

describe('addedLabel', () => {
	const now = new Date('2026-09-18T12:00:00Z').getTime();
	it('speaks about the recent past in words', () => {
		expect(addedLabel('2026-09-18T08:00:00Z', now)).toBe('today');
		expect(addedLabel('2026-09-17T08:00:00Z', now)).toBe('yesterday');
		expect(addedLabel('2026-09-14T08:00:00Z', now)).toBe('4 days ago');
		expect(addedLabel('2026-09-04T08:00:00Z', now)).toBe('2 weeks ago');
	});
});
