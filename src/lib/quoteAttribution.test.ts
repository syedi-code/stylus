import { describe, it, expect } from 'vitest';
import {
	quoteInputFromAttribution,
	attributionFromSplit,
	citeFromAttribution,
} from './quoteAttribution';
import type { Author, Book } from './api';

const book = (over: Partial<Book>): Book =>
	({ id: 'b', title: 'T', author: 'A', created_at: '', updated_at: '', ...over }) as Book;
const author = (over: Partial<Author>): Author =>
	({ id: 'a', name: 'N', created_at: '', ...over }) as Author;

const BOOKS = [
	book({ id: 'bge', title: 'Beyond Good and Evil', author: 'Friedrich Nietzsche' }),
	book({ id: 'prince-a', title: 'The Prince', author: 'Niccolò Machiavelli' }),
	book({ id: 'prince-b', title: 'The Prince', author: 'Some Translator' }),
];
const AUTHORS = [
	author({ id: 'newton', name: 'Huey P. Newton' }),
	author({ id: 'morrison', name: 'Toni Morrison' }),
	author({ id: 'j-morrison', name: 'Jim Morrison' }),
];

describe('quoteInputFromAttribution', () => {
	it('links a book by id and takes creator/work from the book itself', () => {
		const input = quoteInputFromAttribution('  A line.  ', {
			mode: 'book',
			bookId: 'bge',
			book: BOOKS[0],
			page: '40',
		});
		expect(input).toMatchObject({
			quote: 'A line.',
			book_id: 'bge',
			creator: 'Friedrich Nietzsche',
			work: 'Beyond Good and Evil',
			page: '40',
			kind: 'book',
		});
	});

	it('writes the author name into creator, so the foil has something to credit', () => {
		// The other capture surfaces leave creator empty for an author link;
		// the essay foil credits from creator when there is no book, so here
		// that would set the quote in with no credit under it at all.
		const input = quoteInputFromAttribution('A line.', { mode: 'author', authorId: 'newton' }, 'Huey P. Newton');
		expect(input.creator).toBe('Huey P. Newton');
		expect(input.book_id).toBeUndefined();
	});

	it('passes free text straight through, and sends nothing for no attribution', () => {
		expect(
			quoteInputFromAttribution('A line.', { mode: 'other', creator: 'Someone', work: 'A talk' })
		).toMatchObject({ creator: 'Someone', work: 'A talk' });

		const none = quoteInputFromAttribution('A line.', { mode: 'none' });
		expect(none.creator).toBeUndefined();
		expect(none.work).toBeUndefined();
		expect(none.book_id).toBeUndefined();
	});
});

describe('attributionFromSplit', () => {
	it('resolves a pasted title to the book you already have, with the page', () => {
		const a = attributionFromSplit({ who: 'Nietzsche', work: 'beyond good & evil', page: '40' }, BOOKS, AUTHORS);
		// "&" vs "and" is NOT normalised — only case, accents and punctuation.
		expect(a.mode).toBe('other');

		const b = attributionFromSplit({ who: 'Nietzsche', work: 'Beyond Good and Evil.', page: '40' }, BOOKS, AUTHORS);
		expect(b).toMatchObject({ mode: 'book', bookId: 'bge', page: '40' });
	});

	it('lets the author break a tie between two books of the same title', () => {
		const a = attributionFromSplit({ who: 'Machiavelli', work: 'The Prince', page: '' }, BOOKS, AUTHORS);
		expect(a.bookId).toBe('prince-a');
	});

	it('resolves a bare name to an author, but never guesses between two surnames', () => {
		expect(attributionFromSplit({ who: 'huey p newton', work: '', page: '' }, BOOKS, AUTHORS)).toMatchObject({
			mode: 'author',
			authorId: 'newton',
		});
		expect(attributionFromSplit({ who: 'Newton', work: '', page: '' }, BOOKS, AUTHORS).authorId).toBe('newton');

		// Two Morrisons: a wrong link is worse than none.
		const ambiguous = attributionFromSplit({ who: 'Morrison', work: '', page: '' }, BOOKS, AUTHORS);
		expect(ambiguous).toMatchObject({ mode: 'other', creator: 'Morrison' });
	});

	it('falls back to free text, and to nothing when there is nothing', () => {
		expect(attributionFromSplit({ who: 'Someone', work: 'An Unowned Book', page: '9' }, BOOKS, AUTHORS)).toMatchObject({
			mode: 'other',
			creator: 'Someone',
			work: 'An Unowned Book',
		});
		expect(attributionFromSplit({ who: '', work: '', page: '' }, BOOKS, AUTHORS).mode).toBe('none');
	});
});

describe('citeFromAttribution', () => {
	it('credits the way the foil will', () => {
		expect(citeFromAttribution({ mode: 'book', book: BOOKS[0], page: '40' })).toEqual({
			author: 'Friedrich Nietzsche',
			title: 'Beyond Good and Evil',
			page: '40',
		});
		expect(citeFromAttribution({ mode: 'author', authorId: 'newton' }, 'Huey P. Newton').author).toBe('Huey P. Newton');
		expect(citeFromAttribution({ mode: 'none' })).toEqual({ author: '', title: '', page: '' });
	});
});
