import type { LibraryBook } from './api';
import { splitAuthors, sliceName } from './bookAttribution';

/**
 * The library's catalogue logic: how books sort, filter and read as a list.
 *
 * Everything here runs client-side over the full catalogue, which the library
 * endpoint returns whole. That is what lets search answer on every keystroke
 * and rows glide to their new places instead of the list being thrown away and
 * refetched.
 */

export type SortKey = 'author' | 'title' | 'year' | 'writing' | 'added';
export type SortDir = 'asc' | 'desc';

export interface LibraryFilters {
	query: string;
	/** Only books with a PDF attached. */
	pdf: boolean;
	/** Only books with at least one quote or note. */
	writing: boolean;
}

/** The direction a column sorts in when first chosen. */
export const NATURAL_DIR: Record<SortKey, SortDir> = {
	author: 'asc',
	title: 'asc',
	year: 'asc',
	writing: 'desc',
	added: 'desc',
};

const MARKS = /[̀-ͯ]/g;

/** One character, folded for matching: lowercased, accents stripped. */
function foldChar(ch: string): string {
	return ch.normalize('NFD').replace(MARKS, '').toLowerCase().charAt(0) || ch;
}

/**
 * Fold a string for search. Folded per character, so an index into the folded
 * string is an index into the original — which is what lets a match be
 * highlighted in the text the user actually sees.
 */
export function fold(text: string): string {
	let out = '';
	for (const ch of text) out += foldChar(ch);
	return out;
}

/**
 * The key an author files under: surname first, as a card catalogue and every
 * bibliography does. "Michel de Montaigne" files under M, "W. G. Sebald" under
 * S, "Martin Luther King Jr." under K. Multiple authors file under the first.
 */
export function authorSortKey(author: string): string {
	const first = splitAuthors(author)[0] ?? author;
	const { firstParts, lastName } = sliceName(first);
	return fold(`${lastName} ${firstParts}`.trim());
}

const ARTICLE = /^(the|a|an)\s+/i;

/** Titles file without their leading article: *The Waves* under W. */
export function titleSortKey(title: string): string {
	return fold(title.replace(ARTICLE, '').trim());
}

function yearOf(book: LibraryBook): number | null {
	const n = parseInt(book.originally_published ?? '', 10);
	return Number.isFinite(n) ? n : null;
}

export function writingCount(book: LibraryBook): number {
	return book.quote_count + book.note_count;
}

function compareText(a: string, b: string): number {
	return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Compare two books under a sort. Each key breaks ties with the ones a reader
 * would expect next, so the order never shuffles between renders.
 */
function compare(a: LibraryBook, b: LibraryBook, key: SortKey): number {
	const byAuthor = () => compareText(authorSortKey(a.author), authorSortKey(b.author));
	const byTitle = () => compareText(titleSortKey(a.title), titleSortKey(b.title));
	const byYear = () => {
		const ya = yearOf(a);
		const yb = yearOf(b);
		// Undated books sit after dated ones in either direction.
		if (ya === null && yb === null) return 0;
		if (ya === null) return 1;
		if (yb === null) return -1;
		return ya - yb;
	};

	switch (key) {
		case 'author':
			return byAuthor() || byYear() || byTitle();
		case 'title':
			return byTitle() || byAuthor();
		case 'year':
			return byYear() || byAuthor() || byTitle();
		case 'writing':
			return writingCount(a) - writingCount(b) || -byAuthor() || -byTitle();
		case 'added':
			return compareText(a.created_at, b.created_at) || -byTitle();
	}
}

export function sortBooks(books: LibraryBook[], key: SortKey, dir: SortDir): LibraryBook[] {
	const sign = dir === 'asc' ? 1 : -1;
	return [...books].sort((a, b) => {
		// Undated books stay last even when the year sort is reversed.
		if (key === 'year') {
			const ya = yearOf(a);
			const yb = yearOf(b);
			if (ya === null && yb !== null) return 1;
			if (yb === null && ya !== null) return -1;
		}
		return sign * compare(a, b, key);
	});
}

export function matchesQuery(book: LibraryBook, query: string): boolean {
	const q = fold(query.trim());
	if (!q) return true;
	return fold(book.title).includes(q) || fold(book.author).includes(q);
}

export function filterBooks(books: LibraryBook[], filters: LibraryFilters): LibraryBook[] {
	return books.filter(
		(b) =>
			(!filters.pdf || !!b.has_pdf) &&
			(!filters.writing || writingCount(b) > 0) &&
			matchesQuery(b, filters.query)
	);
}

export interface Segment {
	text: string;
	match: boolean;
}

/**
 * Split text around the first match of the query, accent- and case-blind, so
 * the matched run can be marked in the text as displayed.
 */
export function highlight(text: string, query: string): Segment[] {
	const q = fold(query.trim());
	if (!q) return [{ text, match: false }];
	const i = fold(text).indexOf(q);
	if (i < 0) return [{ text, match: false }];
	const chars = [...text];
	return [
		{ text: chars.slice(0, i).join(''), match: false },
		{ text: chars.slice(i, i + q.length).join(''), match: true },
		{ text: chars.slice(i + q.length).join(''), match: false },
	].filter((s) => s.text);
}

export interface CatalogueRow {
	book: LibraryBook;
	/** First book of a new author, under the author sort. Gets breathing room. */
	startsRun: boolean;
}

function authorIdentity(b: LibraryBook): string {
	return b.author_id || fold(b.author);
}

export function toRows(books: LibraryBook[], key: SortKey): CatalogueRow[] {
	return books.map((book, i) => {
		const prev = books[i - 1];
		return { book, startsRun: key === 'author' && !!prev && authorIdentity(prev) !== authorIdentity(book) };
	});
}

/** "3 days ago" for the recent past, a month and year beyond that. */
export function addedLabel(iso: string, now = Date.now()): string {
	const then = new Date(iso).getTime();
	if (!Number.isFinite(then)) return '';
	const days = Math.floor((now - then) / 864e5);
	if (days < 1) return 'today';
	if (days === 1) return 'yesterday';
	if (days < 7) return `${days} days ago`;
	if (days < 30) {
		const weeks = Math.floor(days / 7);
		return weeks === 1 ? 'last week' : `${weeks} weeks ago`;
	}
	return new Date(then).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

/** Lifespan as the catalogue writes it: "1909–1943", "1950–", or nothing. */
export function lifespan(born?: string | null, died?: string | null): string {
	if (!born && !died) return '';
	return `${born ?? ''}–${died ?? ''}`;
}
