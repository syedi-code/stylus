import type { Author, Book, QuoteInput } from './api';
import type { QuoteDraft } from './essayWorkspace';

/**
 * Attribution for a quote, as `SourceSelector` reports it.
 *
 * Declared structurally here rather than imported from the component, so this
 * module stays importable (and testable) without pulling a .vue file into
 * `lib/`. It is the same shape `SourceSelector` emits.
 */
export interface Attribution {
	mode: 'none' | 'book' | 'author' | 'other';
	bookId?: string;
	book?: Book | null;
	page?: string;
	authorId?: string;
	creator?: string;
	work?: string;
	kind?: string;
}

/**
 * The `createQuote` input for a line and its attribution.
 *
 * QuoteCaptureForm, MobileQuoteCapture and EditQuoteModal each carry their own
 * copy of this mapping; this is the one the essay flow uses, pulled out so the
 * rules are written down once and under test.
 *
 * One deliberate difference: an AUTHOR attribution also writes the author's
 * name into `creator`. The other surfaces leave it empty and rely on the
 * connection alone, but the essay foil credits a quote from `creator` when it
 * has no book — so without the name, a quote you just attributed to someone
 * would be set into the essay with no credit under it at all.
 */
export function quoteInputFromAttribution(
	text: string,
	attr: Attribution,
	authorName?: string
): QuoteInput {
	const input: QuoteInput = { quote: text.trim(), source: 'web' };

	if (attr.mode === 'book') {
		if (attr.bookId) input.book_id = attr.bookId;
		if (attr.book) {
			input.creator = attr.book.author || undefined;
			input.work = attr.book.title || undefined;
		}
		if (attr.bookId && attr.page) input.page = attr.page;
		input.kind = 'book';
	} else if (attr.mode === 'author') {
		if (authorName) input.creator = authorName;
	} else if (attr.mode === 'other') {
		input.creator = attr.creator || undefined;
		input.work = attr.work || undefined;
		input.kind = attr.kind || undefined;
	}
	return input;
}

const norm = (s: string | undefined | null) =>
	(s ?? '')
		.toLowerCase()
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/[^a-z0-9 ]+/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();

const surname = (name: string) => norm(name).split(' ').pop() ?? '';

/**
 * Turn a "Split it" result into an attribution that points at the LIBRARY
 * where it can.
 *
 * A pasted "— Nietzsche, Beyond Good and Evil, p. 40" should land as a link to
 * the book you already have, with the page filled in — not as free text that
 * happens to spell the same title. So: a book whose title matches exactly
 * wins (the author breaking a tie between editions); failing that, an author
 * whose name matches; failing both, the fields go in as free text, which is
 * still better than retyping them.
 *
 * Matching is exact after normalisation (case, accents, punctuation). A fuzzy
 * match that silently links the wrong book is worse than no link — the writer
 * can always pick the book by hand in the same form.
 */
export function attributionFromSplit(
	draft: Pick<QuoteDraft, 'who' | 'work' | 'page'>,
	books: Book[],
	authors: Author[]
): Attribution {
	const who = draft.who.trim();
	const work = draft.work.trim();

	if (work) {
		const hits = books.filter((b) => norm(b.title) === norm(work));
		const book =
			hits.length > 1 && who
				? (hits.find((b) => surname(b.author) === surname(who)) ?? hits[0])
				: hits[0];
		if (book) {
			return {
				mode: 'book',
				bookId: book.id,
				book,
				page: draft.page.trim() || undefined,
			};
		}
	}

	if (who && !work) {
		const exact = authors.find((a) => norm(a.name) === norm(who));
		const bySurname = authors.filter((a) => surname(a.name) === surname(who));
		const author = exact ?? (bySurname.length === 1 ? bySurname[0] : undefined);
		if (author) return { mode: 'author', authorId: author.id };
	}

	if (who || work) {
		return { mode: 'other', creator: who || undefined, work: work || undefined };
	}
	return { mode: 'none' };
}

/** What the live preview credits, in the same three parts the foil uses. */
export function citeFromAttribution(
	attr: Attribution,
	authorName?: string
): { author: string; title: string; page: string } {
	if (attr.mode === 'book' && attr.book) {
		return { author: attr.book.author ?? '', title: attr.book.title ?? '', page: attr.page ?? '' };
	}
	if (attr.mode === 'author') return { author: authorName ?? '', title: '', page: '' };
	if (attr.mode === 'other') return { author: attr.creator ?? '', title: attr.work ?? '', page: '' };
	return { author: '', title: '', page: '' };
}
