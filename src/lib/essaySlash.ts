import type { Book, Quote } from './api';

/**
 * The slash menu's brain: what a `/…` line is asking for, and what answers it.
 *
 * The old grammar was four exact words terminated by a space. It was safe, and
 * it was also a thing you had to already know: nothing appeared until the
 * command was spelled in full, and every one of them only opened another
 * dialog. The corpus says what the slash is FOR — 84 quotes and 43 books set
 * into 51 pieces, the same quote cited again and again across them — so the
 * menu is a search over the library first and a list of verbs second.
 *
 *   /            the verbs, then what you have cited lately
 *   /q           verbs starting "q" (Quote), then quotes matching "q"
 *   /quote plato quotes matching "plato", with "write a new one" on top
 *   /book dune   books matching "dune"
 *   /baldwin     anything in the library matching "baldwin"
 */

export type SlashCommandId =
	| 'quote'
	| 'book'
	| 'image'
	| 'section'
	| 'today'
	| 'present'
	| 'focus'
	| 'save'
	| 'new';

export interface SlashCommandSpec {
	id: SlashCommandId;
	label: string;
	hint: string;
	glyph: string;
	/** Extra words it answers to, besides its own name. */
	aliases: readonly string[];
	/** Takes an argument that searches the library (`/quote plato`). */
	searches?: 'quote' | 'book';
	/** Verbs about the piece rather than its contents — listed after the library. */
	more?: boolean;
}

export const SLASH_COMMANDS: readonly SlashCommandSpec[] = [
	{ id: 'quote', label: 'Quote', hint: 'Write or paste a new one', glyph: '❝', aliases: ['cite', 'q'], searches: 'quote' },
	{ id: 'book', label: 'Book', hint: 'Set a work in as its own slide', glyph: '▤', aliases: ['work', 'cover'], searches: 'book' },
	{ id: 'image', label: 'Image', hint: 'Upload a picture', glyph: '▦', aliases: ['picture', 'photo', 'img'] },
	{ id: 'section', label: 'Section', hint: 'A heading — also type # and a space', glyph: '§', aliases: ['heading', 'header', 'title', 'h'] },
	{ id: 'today', label: 'Today’s date', hint: 'Opens the line with the date', glyph: '◷', aliases: ['date', 'now'], more: true },
	{ id: 'present', label: 'Present', hint: 'Play it as a deck', glyph: '▶', aliases: ['play', 'deck', 'slides'], more: true },
	{ id: 'focus', label: 'Focus', hint: 'Dim everything but the paragraph', glyph: '◐', aliases: ['zen', 'dim'], more: true },
	{ id: 'save', label: 'Save now', hint: 'It saves itself — this is for peace of mind', glyph: '✓', aliases: ['publish'], more: true },
	{ id: 'new', label: 'New piece', hint: 'Start a blank one', glyph: '+', aliases: ['blank', 'fresh'], more: true },
];

export type SlashItem =
	| { type: 'command'; key: string; command: SlashCommandSpec }
	| { type: 'quote'; key: string; quote: Quote; recent: boolean }
	| { type: 'book'; key: string; book: Book; recent: boolean };

export interface SlashQuery {
	/** Everything after the slash, as typed. */
	raw: string;
	/** A command named by the first word, when its argument searches. */
	scoped: SlashCommandSpec | null;
	/** What to search the library for. */
	term: string;
}

/**
 * A block is asking the slash menu something when its whole text is a slash
 * followed by one line. Mid-prose slashes (and/or, 3/4, dates) never qualify:
 * the menu only ever opens from the start of an otherwise empty paragraph.
 */
export function readSlash(text: string): SlashQuery | null {
	if (!text.startsWith('/') || text.includes('\n') || text.length > 80) return null;
	const raw = text.slice(1);
	// "//" is a writer typing a literal slash, not asking for the menu.
	if (raw.startsWith('/') || raw.startsWith(' ')) return null;

	const space = raw.indexOf(' ');
	if (space > 0) {
		const head = raw.slice(0, space).toLowerCase();
		const cmd = SLASH_COMMANDS.find((c) => c.searches && (c.id === head || c.aliases.includes(head)));
		if (cmd) return { raw, scoped: cmd, term: raw.slice(space + 1).trim() };
	}
	return { raw, scoped: null, term: raw.trim() };
}

function words(s: string): string[] {
	return s
		.toLowerCase()
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.split(/[^a-z0-9]+/)
		.filter(Boolean);
}

function fold(s: string): string {
	return words(s).join(' ');
}

/**
 * Every query word must appear somewhere; a hit on the name (creator, title)
 * outranks one buried in the body, and a word-start outranks a mid-word hit.
 * Returns 0 for no match.
 */
export function scoreText(term: string, name: string, body: string): number {
	const q = words(term);
	if (!q.length) return 0;
	const n = ` ${fold(name)}`;
	const b = ` ${fold(body)}`;
	let score = 0;
	for (const w of q) {
		if (n.includes(` ${w}`)) score += 6;
		else if (n.includes(w)) score += 4;
		else if (b.includes(` ${w}`)) score += 2;
		else if (b.includes(w)) score += 1;
		else return 0;
	}
	return score;
}

function commandScore(cmd: SlashCommandSpec, q: string): number {
	if (!q) return 1;
	const names = [cmd.id, cmd.label.toLowerCase(), ...cmd.aliases];
	if (names.some((n) => n === q)) return 4;
	if (names.some((n) => n.startsWith(q))) return 3;
	if (names.some((n) => n.includes(q))) return 1;
	return 0;
}

export interface SlashSources {
	quotes: readonly Quote[];
	books: readonly Book[];
	/** Ids cited in the writer's pieces, most recent first. */
	recent: readonly string[];
}

/**
 * The name a quote answers to. A fifth of the library carries its author only
 * through the book it was taken from, so the book's title and author count.
 */
function quoteName(q: Quote, bookById: Map<string, Book>): string {
	const bk = q.book_id ? bookById.get(q.book_id) : undefined;
	return [q.creator, q.work, bk?.title, bk?.author].filter(Boolean).join(' ');
}

const LIBRARY_LIMIT = 7;

/**
 * The ranked menu for a query. Commands first when the query could still be
 * spelling one; the library after them — or alone, once the query can only be
 * a search.
 */
export function slashItems(query: SlashQuery, src: SlashSources): SlashItem[] {
	const recentRank = new Map(src.recent.map((id, i) => [id, i]));
	const bookById = new Map(src.books.map((b) => [b.id, b]));
	const out: SlashItem[] = [];

	const quoteItems = (term: string, onlyRecent: boolean): SlashItem[] => {
		const pool = onlyRecent ? src.quotes.filter((q) => recentRank.has(q.id)) : src.quotes;
		return pool
			.map((q) => ({
				q,
				s: onlyRecent ? 1 : scoreText(term, quoteName(q, bookById), q.quote ?? ''),
			}))
			.filter((x) => x.s > 0)
			.sort((a, b) => b.s - a.s || (recentRank.get(a.q.id) ?? 1e9) - (recentRank.get(b.q.id) ?? 1e9))
			.slice(0, LIBRARY_LIMIT)
			.map(({ q }) => ({ type: 'quote', key: `q:${q.id}`, quote: q, recent: recentRank.has(q.id) }));
	};
	const bookItems = (term: string, onlyRecent: boolean): SlashItem[] => {
		const pool = onlyRecent ? src.books.filter((b) => recentRank.has(b.id)) : src.books;
		return pool
			.map((b) => ({ b, s: onlyRecent ? 1 : scoreText(term, `${b.title} ${b.author ?? ''}`, '') }))
			.filter((x) => x.s > 0)
			.sort((a, b) => b.s - a.s || (recentRank.get(a.b.id) ?? 1e9) - (recentRank.get(b.b.id) ?? 1e9))
			.slice(0, LIBRARY_LIMIT)
			.map(({ b }) => ({ type: 'book', key: `b:${b.id}`, book: b, recent: recentRank.has(b.id) }));
	};

	if (query.scoped) {
		// `/quote …` — the verb itself stays on top, as "write a new one".
		out.push({ type: 'command', key: `c:${query.scoped.id}`, command: query.scoped });
		const recentOnly = !query.term;
		out.push(...(query.scoped.searches === 'quote' ? quoteItems(query.term, recentOnly) : bookItems(query.term, recentOnly)));
		return out;
	}

	const head = query.term.toLowerCase();
	const single = !head.includes(' ');
	if (single) {
		const cmds = SLASH_COMMANDS.map((c) => ({ c, s: commandScore(c, head) }))
			.filter((x) => x.s > 0)
			.sort((a, b) => b.s - a.s);
		out.push(...cmds.map(({ c }) => ({ type: 'command' as const, key: `c:${c.id}`, command: c })));
	}

	if (!head) {
		// A bare slash: the things that get set in, then what you have been
		// citing — because you cite it again — then the verbs about the piece.
		const recent = [...quoteItems('', true), ...bookItems('', true)]
			.sort((a, b) => (recentRank.get(idOf(a)) ?? 1e9) - (recentRank.get(idOf(b)) ?? 1e9))
			.slice(0, 5);
		const isMore = (i: SlashItem) => i.type === 'command' && !!i.command.more;
		return [...out.filter((i) => !isMore(i)), ...recent, ...out.filter(isMore)];
	}

	// One letter is still spelling a verb; searching the library on it is noise.
	if (head.length < 2) return out;

	const lib = [...quoteItems(head, false), ...bookItems(head, false)];
	out.push(...lib.slice(0, LIBRARY_LIMIT + 2));
	return out;
}

function idOf(item: SlashItem): string {
	return item.type === 'quote' ? item.quote.id : item.type === 'book' ? item.book.id : item.command.id;
}

const TOKEN_RE = /\[\[(quote|book):([0-9a-f-]{8,})/gi;

/** Quote and book ids cited across pieces, most recent piece first. */
export function recentSourceIds(contents: readonly string[], limit = 40): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const c of contents) {
		for (const m of c.matchAll(TOKEN_RE)) {
			const id = m[2];
			if (seen.has(id)) continue;
			seen.add(id);
			out.push(id);
			if (out.length >= limit) return out;
		}
	}
	return out;
}

/** "September 25, 2026: " — the way the corpus opens a dated piece. */
export function todayLine(now = new Date()): string {
	const d = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
	return `${d}: `;
}
