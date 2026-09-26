import { describe, it, expect } from 'vitest';
import { readSlash, slashItems, recentSourceIds, scoreText, todayLine, type SlashItem } from './essaySlash';
import type { Book, Quote } from './api';

const q = (id: string, quote: string, creator = '', work = ''): Quote =>
	({ id, quote, creator, work, posted: false, tags: [], source: '', created_at: '', updated_at: '' }) as Quote;
const b = (id: string, title: string, author = ''): Book => ({ id, title, author }) as Book;

const QUOTES = [
	q('q1', 'The unexamined life is not worth living.', 'Socrates', 'Apology'),
	q('q2', 'I am not free while any woman is unfree.', 'Audre Lorde', 'Sister Outsider'),
	q('q3', 'Not everything that is faced can be changed.', 'James Baldwin'),
	q('q4', 'A people without the knowledge of their past history is like a tree without roots.', 'Marcus Garvey'),
];
const BOOKS = [b('b1', 'The Fire Next Time', 'James Baldwin'), b('b2', 'Assata', 'Assata Shakur')];
const SRC = { quotes: QUOTES, books: BOOKS, recent: ['q3', 'b2', 'q1'] };

const labels = (items: SlashItem[]) =>
	items.map((i) => (i.type === 'command' ? `/${i.command.id}` : i.type === 'quote' ? i.quote.id : i.book.id));

describe('readSlash', () => {
	it('reads a slash at the start of a one-line paragraph', () => {
		expect(readSlash('/')).toEqual({ raw: '', scoped: null, term: '' });
		expect(readSlash('/baldwin')?.term).toBe('baldwin');
	});

	it('scopes a search to the verb that names it', () => {
		const r = readSlash('/quote not free');
		expect(r?.scoped?.id).toBe('quote');
		expect(r?.term).toBe('not free');
		expect(readSlash('/book fire')?.scoped?.id).toBe('book');
		// Aliases count.
		expect(readSlash('/cite lorde')?.scoped?.id).toBe('quote');
	});

	it('never opens inside prose, on a literal double slash, or across lines', () => {
		expect(readSlash('and/or')).toBeNull();
		expect(readSlash('12/4')).toBeNull();
		expect(readSlash('//comment')).toBeNull();
		expect(readSlash('/ spaced')).toBeNull();
		expect(readSlash('/quote\nsecond line')).toBeNull();
	});
});

describe('slashItems', () => {
	it('answers a bare slash with the verbs, then what was cited lately, newest first', () => {
		const items = slashItems(readSlash('/')!, SRC);
		expect(items[0]).toMatchObject({ type: 'command' });
		const lib = labels(items.filter((i) => i.type !== 'command'));
		expect(lib).toEqual(['q3', 'b2', 'q1']);
		// The verbs about the piece come after the library, not before it.
		const all = labels(items);
		expect(all.indexOf('q3')).toBeLessThan(all.indexOf('/present'));
		expect(all.indexOf('/book')).toBeLessThan(all.indexOf('q3'));
	});

	it('keeps a single letter to the verbs — searching the library on it is noise', () => {
		const items = slashItems(readSlash('/q')!, SRC);
		expect(labels(items)).toEqual(['/quote']);
	});

	it('ranks a verb it is spelling above library matches', () => {
		const items = slashItems(readSlash('/bo')!, SRC);
		expect(labels(items)[0]).toBe('/book');
	});

	it('searches the whole library when the query is not a verb', () => {
		const items = slashItems(readSlash('/baldwin')!, SRC);
		expect(labels(items)).toEqual(expect.arrayContaining(['q3', 'b1']));
		expect(items.every((i) => i.type !== 'command')).toBe(true);
	});

	it('puts a match on the name above a match in the body', () => {
		const items = slashItems(readSlash('/quote not')!, SRC);
		// "not" is in three bodies; none is a name — so recency breaks the tie.
		expect(labels(items).slice(1, 3)).toEqual(['q3', 'q1']);
		const byName = slashItems(readSlash('/quote lorde')!, SRC);
		expect(labels(byName)).toEqual(['/quote', 'q2']);
	});

	it('keeps the verb on top of a scoped search, as "write a new one"', () => {
		const items = slashItems(readSlash('/quote something nobody said')!, SRC);
		expect(labels(items)).toEqual(['/quote']);
	});

	it('requires every word, and folds accents', () => {
		expect(scoreText('james fire', 'The Fire Next Time James Baldwin', '')).toBeGreaterThan(0);
		expect(scoreText('james dune', 'The Fire Next Time James Baldwin', '')).toBe(0);
		expect(scoreText('cesaire', 'Aimé Césaire', '')).toBeGreaterThan(0);
	});
});

describe('recentSourceIds', () => {
	it('collects quotes and books, newest piece first, once each', () => {
		const ids = recentSourceIds([
			'[[quote:aaaaaaaa-0000-4000-8000-000000000001 size=16]]\n\nprose\n\n[[book:bbbbbbbb-0000-4000-8000-000000000002]]',
			'[[quote:aaaaaaaa-0000-4000-8000-000000000001]]\n\n[[image:cccccccc-0000-4000-8000-000000000003]]',
		]);
		expect(ids).toEqual(['aaaaaaaa-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000002']);
	});
});

describe('todayLine', () => {
	it('opens a line the way the corpus dates a piece', () => {
		expect(todayLine(new Date(2026, 8, 25))).toBe('September 25, 2026: ');
	});
});
