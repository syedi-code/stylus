import axios from 'axios';

// ============================================================================
// Shared Types
// ============================================================================

export interface Note {
	id: string;
	content: string;
	creator?: string;
	work?: string;
	kind?: string;
	book_id?: string;
	page?: string;
	posted: boolean;
	tags: string[];
	replaces?: string;
	source: string;
	created_at: string;
	updated_at: string;
	/** When shuffle last dealt this note. null/undefined = never surfaced. */
	last_surfaced_at?: string | null;
	// Client-side computed (version chain)
	version?: number;
	originalCreatedAt?: string;
}

export interface NoteInput {
	content: string;
	creator?: string;
	work?: string;
	kind?: string;
	book_id?: string;
	page?: string;
	posted?: boolean;
	tags?: string[];
	replaces?: string;
	source?: string;
	connections?: ConnectionInput[];
}

export interface Quote {
	id: string;
	quote: string;
	work?: string;
	creator?: string;
	kind?: string;
	book_id?: string;
	page?: string;
	posted: boolean;
	tags: string[];
	replaces?: string;
	source: string;
	created_at: string;
	updated_at: string;
	// Client-side computed (version chain)
	version?: number;
	originalCreatedAt?: string;
}

export interface QuoteInput {
	quote: string;
	work?: string;
	creator?: string;
	kind?: string;
	book_id?: string;
	page?: string;
	posted?: boolean;
	tags?: string[];
	replaces?: string;
	source?: string;
	connections?: ConnectionInput[];
}

// ============================================================================
// Essay Types
// ============================================================================

export type EssayEntityType = 'book' | 'quote' | 'book_cover' | 'image';

export interface EssayReference {
	id: string;
	entity_type: EssayEntityType;
	entity_id: string;
	page?: string;
	position: number;
	/**
	 * Per-embed presentation overrides parsed from the inline token tail
	 * (e.g. `[[quote:UUID size=24]]` → `{ size: 24 }`). Shape is governed
	 * by EMBED_PARAM_SPECS in packages/core/database/essay-tokens.ts.
	 * Absent / undefined means "use renderer defaults."
	 */
	params?: Record<string, string | number>;
	// Joined from `books` for entity_type ∈ {book, book_cover}, or for a quote
	// whose source is a book.
	book_id?: string;
	book_title?: string;
	book_author?: string;
	book_originally_published?: string;
	book_cover_url?: string;
	// Joined from `quotes` for entity_type='quote'.
	quote_text?: string;
	quote_creator?: string;
	quote_work?: string;
	quote_page?: string;
	// Joined from `essay_images` for entity_type='image'. `image_url` is the
	// R2 path (e.g. 'essays/images/uuid-name.jpg').
	image_url?: string;
	image_caption?: string;
	image_source_url?: string;
}

export interface EssayImage {
	id: string;
	user_id: string;
	path: string;
	mime_type?: string;
	caption?: string;
	source_url?: string;
	created_at: string;
	updated_at: string;
}

export interface Essay {
	id: string;
	content: string;
	posted: boolean;
	tags: string[];
	replaces?: string;
	source: string;
	created_at: string;
	updated_at: string;
	references: EssayReference[];
	// Client-side computed
	version?: number;
}

export interface EssayReferenceInput {
	entity_type: EssayEntityType;
	entity_id: string;
	page?: string;
	position?: number;
}

export interface EssayInput {
	content: string;
	posted?: boolean;
	tags?: string[];
	replaces?: string;
	source?: string;
	references: EssayReferenceInput[];
	connections?: ConnectionInput[];
}

export interface Book {
	id: string;
	title: string;
	author: string;
	pdf_url?: string;
	cover_url?: string;
	isbn?: string;
	description?: string;
	originally_published?: string;
	pdf_page_offset?: number;
	author_id?: string;
	created_at: string;
	updated_at: string;
}

export interface BookInput {
	title: string;
	author: string;
	pdf_url?: string;
	cover_url?: string;
	isbn?: string;
	description?: string;
	originally_published?: string;
	pdf_page_offset?: number;
	author_id?: string;
}

export interface Author {
	id: string;
	name: string;
	bio?: string;
	born?: string;
	died?: string;
	created_at: string;
	updated_at: string;
}

export interface AuthorInput {
	name: string;
	bio?: string;
	born?: string;
	died?: string;
}

// ============================================================================
// Connections Types
// ============================================================================

export type EntityType =
	| 'author'
	| 'book'
	| 'media'
	| 'note'
	| 'quote'
	| 'thought';

export interface Connection {
	id: string;
	a_type: EntityType;
	a_id: string;
	b_type: EntityType;
	b_id: string;
	metadata?: string;
	created_at: string;
}

export interface ConnectionInput {
	a_type: EntityType;
	a_id: string;
	b_type: EntityType;
	b_id: string;
	metadata?: string;
}

// ============================================================================
// Threads Types
// ============================================================================

export interface Thread {
	id: string;
	name: string;
	description?: string;
	item_count?: number;
	item_types?: string[];
	created_at: string;
	updated_at: string;
}

export interface ThreadInput {
	name: string;
	description?: string;
}

export interface ThreadItem {
	id: string;
	thread_id: string;
	entity_type: string;
	entity_id: string;
	position: number;
	added_at: string;
}

// ============================================================================
// API Client
// ============================================================================

export const apiClient = axios.create({
	baseURL: import.meta.env.VITE_API_URL || '/api',
	headers: {
		'Content-Type': 'application/json',
		'X-Requested-With': 'XMLHttpRequest',
	},
	withCredentials: true,
});

// 401 interceptor: detect session expiry and redirect to login
apiClient.interceptors.response.use(
	(response) => response,
	async (error) => {
		if (error.response?.status === 401) {
			const code = error.response?.data?.code;
			if (code === 'SESSION_EXPIRED' || code === 'SESSION_MISSING') {
				const { setSessionExpired, isAuthInitializing } =
					await import('./auth');

				// Don't redirect during initial auth handshake — the session
				// cookie may not be set yet (race on first page load).
				if (isAuthInitializing()) {
					console.warn(
						`[API] Suppressed 401 redirect during auth init (${code})`
					);
					return Promise.reject(error);
				}

				setSessionExpired(
					'Your session has expired. Please log in again.'
				);
				return Promise.reject(error);
			}

			// Non-session 401 — log for debugging
			const { url, method } = error.config ?? {};
			const { hint } = error.response?.data ?? {};
			console.error(
				`[API] 401 Unauthorized — ${method?.toUpperCase()} ${url}`,
				{
					code: code ?? 'UNKNOWN',
					hint: hint ?? 'Check auth state',
				}
			);
		}
		return Promise.reject(error);
	}
);

// ============================================================================
// Normalization Helpers
// ============================================================================

function normalizeNote(raw: any): Note {
	return {
		...raw,
		posted: !!raw.posted,
		tags: raw.tags
			? typeof raw.tags === 'string'
				? JSON.parse(raw.tags)
				: raw.tags
			: [],
	};
}

function normalizeQuote(raw: any): Quote {
	return {
		...raw,
		posted: !!raw.posted,
		tags: raw.tags
			? typeof raw.tags === 'string'
				? JSON.parse(raw.tags)
				: raw.tags
			: [],
	};
}

function serializeNoteInput(input: NoteInput): Record<string, unknown> {
	const { connections, ...rest } = input;
	return {
		...rest,
		posted: input.posted ? 1 : 0,
		tags: input.tags ? JSON.stringify(input.tags) : undefined,
		connections,
	};
}

function serializeQuoteInput(input: QuoteInput): Record<string, unknown> {
	const { connections, ...rest } = input;
	return {
		...rest,
		posted: input.posted ? 1 : 0,
		tags: input.tags ? JSON.stringify(input.tags) : undefined,
		connections,
	};
}

function normalizeEssay(raw: any): Essay {
	return {
		...raw,
		posted: !!raw.posted,
		tags: raw.tags
			? typeof raw.tags === 'string'
				? JSON.parse(raw.tags)
				: raw.tags
			: [],
		references: (raw.references || []).map((r: any) => ({
			...r,
			page: r.page ?? undefined,
		})),
	};
}

function serializeEssayInput(input: EssayInput): Record<string, unknown> {
	const { connections, ...rest } = input;
	return {
		...rest,
		posted: input.posted ? 1 : 0,
		tags: input.tags ? JSON.stringify(input.tags) : undefined,
		connections,
	};
}

// ============================================================================
// Notes API
// ============================================================================

export async function fetchNotes(
	params: {
		limit?: number;
		offset?: number;
		search?: string;
		posted?: number;
		book_id?: string;
		/** All tags must be present (AND semantics). */
		tags?: string[];
		sort?: 'newest' | 'oldest' | 'edited';
		/** ISO date bounds on created_at (inclusive). */
		from?: string;
		to?: string;
	} = {}
): Promise<{ data: Note[]; hasMore: boolean }> {
	const { tags, ...rest } = params;
	const response = await apiClient.get<{
		notes: any[];
		hasMore?: boolean;
		error?: string;
	}>('/notes', {
		params: {
			...rest,
			...(tags && tags.length ? { tags: tags.join(',') } : {}),
		},
	});
	if (response.data.error) {
		throw new Error(response.data.error);
	}
	return {
		data: (response.data.notes || []).map(normalizeNote),
		hasMore: response.data.hasMore ?? false,
	};
}

export interface NoteFacets {
	total: number;
	tagCounts: { tag: string; count: number }[];
	bookCounts: { book_id: string; count: number }[];
	activity: { week: string; count: number }[];
}

/** Shuffle mode: a weighted-random deal of notes from the whole corpus. */
export async function fetchShuffleNotes(
	count = 5
): Promise<{ notes: Note[]; total: number }> {
	const response = await apiClient.get<{
		notes: unknown[];
		total?: number;
		error?: string;
	}>('/notes/shuffle', { params: { count } });
	if (response.data.error) {
		throw new Error(response.data.error);
	}
	return {
		notes: (response.data.notes || []).map(normalizeNote),
		total: response.data.total ?? 0,
	};
}

export async function fetchNoteById(id: string): Promise<Note> {
	const response = await apiClient.get<{ note: unknown; error?: string }>(
		`/notes/${id}`
	);
	if (response.data.error) {
		throw new Error(response.data.error);
	}
	return normalizeNote(response.data.note);
}

export async function fetchNoteFacets(
	params: {
		search?: string;
		posted?: number;
		book_id?: string;
		tags?: string[];
		from?: string;
		to?: string;
	} = {}
): Promise<NoteFacets> {
	const { tags, ...rest } = params;
	const response = await apiClient.get<{
		facets: NoteFacets;
		error?: string;
	}>('/notes/facets', {
		params: {
			...rest,
			...(tags && tags.length ? { tags: tags.join(',') } : {}),
		},
	});
	if (response.data.error) {
		throw new Error(response.data.error);
	}
	return response.data.facets;
}

export async function createNote(
	input: NoteInput
): Promise<{ ok: boolean; note: Note }> {
	const response = await apiClient.post('/notes', serializeNoteInput(input));
	if (response.data.error) {
		throw new Error(response.data.error);
	}
	return { ok: response.data.ok, note: normalizeNote(response.data.note) };
}

export async function updateNote(
	id: string,
	updates: Partial<NoteInput>
): Promise<{ ok: boolean }> {
	const serialized: Record<string, unknown> = { ...updates };
	if (updates.posted !== undefined)
		serialized.posted = updates.posted ? 1 : 0;
	if (updates.tags) serialized.tags = JSON.stringify(updates.tags);
	const response = await apiClient.patch(`/notes/${id}`, serialized);
	if (response.data.error) {
		throw new Error(response.data.error);
	}
	return response.data;
}

export async function deleteNote(id: string): Promise<{ ok: boolean }> {
	const response = await apiClient.delete(`/notes/${id}`);
	if (response.data.error) {
		throw new Error(response.data.error);
	}
	return response.data;
}

// ============================================================================
// Quotes API
// ============================================================================

export async function fetchQuotes(
	params: {
		limit?: number;
		offset?: number;
		search?: string;
		posted?: number;
		book_id?: string;
	} = {}
): Promise<Quote[]> {
	const response = await apiClient.get<{ quotes: any[]; error?: string }>(
		'/quotes',
		{ params }
	);
	if (response.data.error) {
		throw new Error(response.data.error);
	}
	return (response.data.quotes || []).map(normalizeQuote);
}

export async function createQuote(
	input: QuoteInput
): Promise<{ ok: boolean; quote: Quote }> {
	const response = await apiClient.post(
		'/quotes',
		serializeQuoteInput(input)
	);
	if (response.data.error) {
		throw new Error(response.data.error);
	}
	return { ok: response.data.ok, quote: normalizeQuote(response.data.quote) };
}

export async function updateQuote(
	id: string,
	updates: Partial<QuoteInput>
): Promise<{ ok: boolean }> {
	const serialized: Record<string, unknown> = { ...updates };
	if (updates.posted !== undefined)
		serialized.posted = updates.posted ? 1 : 0;
	if (updates.tags) serialized.tags = JSON.stringify(updates.tags);
	const response = await apiClient.patch(`/quotes/${id}`, serialized);
	if (response.data.error) {
		throw new Error(response.data.error);
	}
	return response.data;
}

export async function deleteQuote(id: string): Promise<{ ok: boolean }> {
	const response = await apiClient.delete(`/quotes/${id}`);
	if (response.data.error) {
		throw new Error(response.data.error);
	}
	return response.data;
}

// ============================================================================
// Essays API
// ============================================================================

export async function fetchEssays(
	params: {
		limit?: number;
		offset?: number;
		search?: string;
		posted?: number;
		book_id?: string;
	} = {}
): Promise<{ data: Essay[]; hasMore: boolean }> {
	const response = await apiClient.get<{
		essays: any[];
		hasMore?: boolean;
		error?: string;
	}>('/essays', { params });
	if (response.data.error) {
		throw new Error(response.data.error);
	}
	return {
		data: (response.data.essays || []).map(normalizeEssay),
		hasMore: response.data.hasMore ?? false,
	};
}

export async function fetchEssayById(id: string): Promise<Essay> {
	const response = await apiClient.get<{ essay: any; error?: string }>(
		`/essays/${id}`
	);
	if (response.data.error) {
		throw new Error(response.data.error);
	}
	return normalizeEssay(response.data.essay);
}

export async function createEssay(
	input: EssayInput
): Promise<{ ok: boolean; essay: Essay }> {
	const response = await apiClient.post(
		'/essays',
		serializeEssayInput(input)
	);
	if (response.data.error) {
		throw new Error(response.data.error);
	}
	return { ok: response.data.ok, essay: normalizeEssay(response.data.essay) };
}

export async function updateEssay(
	id: string,
	updates: Partial<EssayInput>
): Promise<{ ok: boolean; essay: Essay }> {
	const serialized: Record<string, unknown> = { ...updates };
	if (updates.posted !== undefined)
		serialized.posted = updates.posted ? 1 : 0;
	if (updates.tags) serialized.tags = JSON.stringify(updates.tags);
	const response = await apiClient.patch(`/essays/${id}`, serialized);
	if (response.data.error) {
		throw new Error(response.data.error);
	}
	return { ok: response.data.ok, essay: normalizeEssay(response.data.essay) };
}

export async function deleteEssay(id: string): Promise<{ ok: boolean }> {
	const response = await apiClient.delete(`/essays/${id}`);
	if (response.data.error) {
		throw new Error(response.data.error);
	}
	return response.data;
}

export async function fetchEssayVersions(id: string): Promise<Essay[]> {
	const response = await apiClient.get<{
		versions: any[];
		error?: string;
	}>(`/essays/${id}/versions`);
	if (response.data.error) {
		throw new Error(response.data.error);
	}
	return (response.data.versions || []).map(normalizeEssay);
}

// ============================================================================
// Books API
// ============================================================================

export async function fetchBooks(
	params: {
		limit?: number;
		offset?: number;
		search?: string;
	} = {}
): Promise<Book[]> {
	const response = await apiClient.get<{ books: Book[]; error?: string }>(
		'/books',
		{
			params,
		}
	);
	if (response.data.error) {
		throw new Error(response.data.error);
	}
	return response.data.books;
}

export async function fetchBookById(id: string): Promise<Book> {
	const response = await apiClient.get<{ book: Book; error?: string }>(
		`/books/${id}`
	);
	if (response.data.error) {
		throw new Error(response.data.error);
	}
	return response.data.book;
}

export async function createBook(
	book: BookInput
): Promise<{ ok: boolean; book: Book }> {
	const response = await apiClient.post('/books', book);
	if (response.data.error) {
		throw new Error(response.data.error);
	}
	return response.data;
}

export async function updateBook(
	id: string,
	updates: Partial<BookInput>
): Promise<{ ok: boolean }> {
	const response = await apiClient.patch(`/books/${id}`, updates);
	if (response.data.error) {
		throw new Error(response.data.error);
	}
	return response.data;
}

export async function deleteBook(id: string): Promise<{ ok: boolean }> {
	const response = await apiClient.delete(`/books/${id}`);
	if (response.data.error) {
		throw new Error(response.data.error);
	}
	return response.data;
}

// ============================================================================
// Library API (enriched listing + detail + media attachments)
// ============================================================================

export type LibraryDecade =
	| 'pre-1900'
	| '1900s'
	| '2000s'
	| '2010s'
	| '2020s'
	| 'unknown';

export interface LibraryBook extends Book {
	quote_count: number;
	note_count: number;
	citation_count: number;
	media_count: number;
	has_pdf: 0 | 1;
	decade: LibraryDecade;
	last_activity_at: string | null;
	author_born?: string | null;
	author_died?: string | null;
}

export interface LibraryListResponse {
	books: LibraryBook[];
	totals: { books: number; quotes: number; notes: number };
}

export interface BookMedia {
	id: string;
	book_id: string;
	path: string;
	kind: 'image';
	caption?: string;
	sort_order: number;
	created_at: string;
	updated_at: string;
}

export interface BookDetailQuote {
	id: string;
	quote: string;
	page: string | null;
	created_at: string;
}
export interface BookDetailNote {
	id: string;
	content: string;
	page: string | null;
	created_at: string;
}
export interface BookDetailEssay {
	id: string;
	title: string;
	subtitle: string | null;
	page: string | null;
}
export interface BookDetailRelated {
	id: string;
	title: string;
	author: string;
	co_citations: number;
}

export interface BookDetail {
	book: Book;
	author: Author | null;
	quotes: BookDetailQuote[];
	notes: BookDetailNote[];
	essays: BookDetailEssay[];
	related: BookDetailRelated[];
	media: BookMedia[];
	stats: { quotes: number; notes: number; essays: number; media: number };
}

export async function fetchLibraryBooks(
	params: {
		search?: string;
		decade?: LibraryDecade;
		has_pdf?: boolean;
		sort?: 'author_az' | 'recent' | 'year';
	} = {}
): Promise<LibraryListResponse> {
	const response = await apiClient.get<
		LibraryListResponse & { error?: string }
	>('/books/library', { params });
	if ((response.data as { error?: string }).error) {
		throw new Error((response.data as { error: string }).error);
	}
	return response.data;
}

export async function fetchBookDetail(id: string): Promise<BookDetail> {
	const response = await apiClient.get<BookDetail & { error?: string }>(
		`/books/${id}/detail`
	);
	if ((response.data as { error?: string }).error) {
		throw new Error((response.data as { error: string }).error);
	}
	return response.data;
}

export async function listBookMedia(bookId: string): Promise<BookMedia[]> {
	const response = await apiClient.get<{
		media: BookMedia[];
		error?: string;
	}>(`/books/${bookId}/media`);
	if (response.data.error) throw new Error(response.data.error);
	return response.data.media;
}

/**
 * Upload an essay-embedded image to R2 and create an `essay_images` row.
 * The optional `id` lets the editor mint a UUID and insert `[[image:UUID]]`
 * at the cursor before the upload resolves; pass the same id back here so
 * the row matches the token.
 */
export async function uploadEssayImage(
	file: File,
	options: { id?: string; caption?: string; source_url?: string } = {}
): Promise<{
	ok: boolean;
	id: string;
	path: string;
	url: string;
	image: EssayImage;
}> {
	const formData = new FormData();
	formData.append('file', file);
	if (options.id) formData.append('id', options.id);
	if (options.caption) formData.append('caption', options.caption);
	if (options.source_url) formData.append('source_url', options.source_url);

	const response = await apiClient.post('/upload/essay-image', formData, {
		headers: { 'Content-Type': 'multipart/form-data' },
	});
	if (response.data.error) throw new Error(response.data.error);
	return response.data;
}

export async function updateEssayImage(
	id: string,
	patch: { caption?: string | null; source_url?: string | null }
): Promise<EssayImage> {
	const response = await apiClient.patch<{
		ok: boolean;
		image: EssayImage;
		error?: string;
	}>(`/essay-images/${id}`, patch);
	if (response.data.error) throw new Error(response.data.error);
	return response.data.image;
}

export async function deleteEssayImage(id: string): Promise<void> {
	const response = await apiClient.delete<{ ok: boolean; error?: string }>(
		`/essay-images/${id}`
	);
	if (response.data.error) throw new Error(response.data.error);
}

export async function uploadBookMedia(
	bookId: string,
	file: File
): Promise<{ ok: boolean; path: string; url: string }> {
	const formData = new FormData();
	formData.append('file', file);
	formData.append('bookId', bookId);

	const response = await apiClient.post('/upload/book-media', formData, {
		headers: { 'Content-Type': 'multipart/form-data' },
	});
	if (response.data.error) throw new Error(response.data.error);
	return response.data;
}

export async function addBookMedia(
	bookId: string,
	payload: { path: string; caption?: string; sort_order?: number }
): Promise<BookMedia> {
	const response = await apiClient.post<{
		ok: boolean;
		media: BookMedia;
		error?: string;
	}>(`/books/${bookId}/media`, { kind: 'image', ...payload });
	if (response.data.error) throw new Error(response.data.error);
	return response.data.media;
}

export async function updateBookMedia(
	bookId: string,
	mediaId: string,
	patch: { caption?: string; sort_order?: number }
): Promise<{ ok: boolean }> {
	const response = await apiClient.patch(
		`/books/${bookId}/media/${mediaId}`,
		patch
	);
	if (response.data.error) throw new Error(response.data.error);
	return response.data;
}

export async function deleteBookMedia(
	bookId: string,
	mediaId: string
): Promise<{ ok: boolean }> {
	const response = await apiClient.delete(
		`/books/${bookId}/media/${mediaId}`
	);
	if (response.data.error) throw new Error(response.data.error);
	return response.data;
}

// ============================================================================
// Authors API
// ============================================================================

export async function fetchAuthors(
	params: {
		limit?: number;
		offset?: number;
		search?: string;
	} = {}
): Promise<Author[]> {
	const response = await apiClient.get<{ authors: Author[]; error?: string }>(
		'/authors',
		{
			params,
		}
	);
	if (response.data.error) {
		throw new Error(response.data.error);
	}
	return response.data.authors;
}

export async function fetchAuthorById(id: string): Promise<Author> {
	const response = await apiClient.get<{ author: Author; error?: string }>(
		`/authors/${id}`
	);
	if (response.data.error) {
		throw new Error(response.data.error);
	}
	return response.data.author;
}

export async function createAuthor(
	author: AuthorInput
): Promise<{ ok: boolean; author: Author }> {
	const response = await apiClient.post('/authors', author);
	if (response.data.error) {
		throw new Error(response.data.error);
	}
	return response.data;
}

export async function updateAuthor(
	id: string,
	updates: Partial<AuthorInput>
): Promise<{ ok: boolean }> {
	const response = await apiClient.patch(`/authors/${id}`, updates);
	if (response.data.error) {
		throw new Error(response.data.error);
	}
	return response.data;
}

export async function deleteAuthor(id: string): Promise<{ ok: boolean }> {
	const response = await apiClient.delete(`/authors/${id}`);
	if (response.data.error) {
		throw new Error(response.data.error);
	}
	return response.data;
}

export async function fetchBooksByAuthorId(authorId: string): Promise<Book[]> {
	const response = await apiClient.get<{ books: Book[]; error?: string }>(
		`/authors/${authorId}/books`
	);
	if (response.data.error) {
		throw new Error(response.data.error);
	}
	return response.data.books;
}

// ============================================================================
// Connections API
// ============================================================================

export async function fetchConnections(
	entityType: EntityType,
	entityId: string,
	connectedType?: EntityType
): Promise<Connection[]> {
	const params: Record<string, string> = { type: entityType, id: entityId };
	if (connectedType) params.connected_type = connectedType;
	const response = await apiClient.get<{
		connections: Connection[];
		error?: string;
	}>('/connections', { params });
	if (response.data.error) {
		throw new Error(response.data.error);
	}
	return response.data.connections;
}

/**
 * Batched variant of fetchConnections: all connections between the given
 * entities and connectedType in a single request (max 100 ids).
 */
export async function fetchConnectionsForEntities(
	entityType: EntityType,
	entityIds: string[],
	connectedType: EntityType
): Promise<Connection[]> {
	if (entityIds.length === 0) return [];
	const response = await apiClient.get<{
		connections: Connection[];
		error?: string;
	}>('/connections/for-entities', {
		params: {
			type: entityType,
			ids: entityIds.join(','),
			connected_type: connectedType,
		},
	});
	if (response.data.error) {
		throw new Error(response.data.error);
	}
	return response.data.connections;
}

export async function createConnectionApi(
	input: ConnectionInput
): Promise<{ ok: boolean; connection: Connection }> {
	const response = await apiClient.post('/connections', input);
	if (response.data.error) {
		throw new Error(response.data.error);
	}
	return response.data;
}

export async function deleteConnectionApi(
	id: string
): Promise<{ ok: boolean }> {
	const response = await apiClient.delete(`/connections/${id}`);
	if (response.data.error) {
		throw new Error(response.data.error);
	}
	return response.data;
}

/**
 * Helper: Given a connection and the entity type/id you already know,
 * return the "other side" of the connection.
 */
export function getConnectedEntity(
	conn: Connection,
	myType: EntityType,
	myId: string
): { type: EntityType; id: string } {
	if (conn.a_type === myType && conn.a_id === myId) {
		return { type: conn.b_type, id: conn.b_id };
	}
	return { type: conn.a_type, id: conn.a_id };
}

// ============================================================================
// File Upload API
// ============================================================================

export async function uploadPdf(
	file: File,
	bookId?: string
): Promise<{ ok: boolean; path: string; url: string }> {
	const formData = new FormData();
	formData.append('file', file);
	if (bookId) {
		formData.append('bookId', bookId);
	}

	const response = await apiClient.post('/upload/pdf', formData, {
		headers: {
			'Content-Type': 'multipart/form-data',
		},
	});

	if (response.data.error) {
		throw new Error(response.data.error);
	}
	return response.data;
}

export async function uploadCover(
	file: File,
	bookId?: string
): Promise<{ ok: boolean; path: string; url: string }> {
	const formData = new FormData();
	formData.append('file', file);
	if (bookId) {
		formData.append('bookId', bookId);
	}

	const response = await apiClient.post('/upload/cover', formData, {
		headers: {
			'Content-Type': 'multipart/form-data',
		},
	});

	if (response.data.error) {
		throw new Error(response.data.error);
	}
	return response.data;
}

export function getFileUrl(path: string): string {
	const baseUrl = import.meta.env.VITE_API_URL || '/api';
	return `${baseUrl}/files/${path}`;
}

// Get a signed URL for secure file access
export async function getSignedFileUrl(
	path: string,
	expiresIn: number = 3600
): Promise<string> {
	const response = await apiClient.post('/files/sign', { path, expiresIn });
	if (response.data.error) {
		throw new Error(response.data.error);
	}
	const baseUrl = import.meta.env.VITE_API_URL || '/api';
	return `${baseUrl}/files/${path}?token=${encodeURIComponent(response.data.token)}`;
}

// Signed-URL cache: many cards can reference the same book PDF, so share
// one in-flight/settled promise per path. Entries expire before the signed
// token does (45 min vs 60 min TTL).
const signedUrlCache = new Map<
	string,
	{ promise: Promise<string>; expiresAt: number }
>();
const SIGNED_URL_CACHE_MS = 45 * 60 * 1000;

export function getSignedFileUrlCached(path: string): Promise<string> {
	const cached = signedUrlCache.get(path);
	if (cached && cached.expiresAt > Date.now()) {
		return cached.promise;
	}
	const promise = getSignedFileUrl(path).catch((err) => {
		// Don't cache failures
		signedUrlCache.delete(path);
		throw err;
	});
	signedUrlCache.set(path, {
		promise,
		expiresAt: Date.now() + SIGNED_URL_CACHE_MS,
	});
	return promise;
}

// ============================================================================
// Thoughts API
// ============================================================================

export interface Thought {
	id: string;
	content: string;
	author: string;
	created_at: string;
	x?: number;
	y?: number;
	mood_score?: number;
	mood_tags?: string[];
}

export interface ThoughtInput {
	content: string;
	author?: string;
	/** Optional created_at to preserve original date (e.g., when converting from note) */
	created_at?: string;
	mood_score?: number;
	mood_tags?: string[];
}

export interface GetThoughtsResponse {
	thoughts: Thought[];
	error?: string;
}

export interface GetMoodsResponse {
	moods: string[];
	error?: string;
}

export async function fetchThoughts(
	params: { limit?: number; offset?: number } = {}
): Promise<{ data: Thought[]; hasMore: boolean }> {
	const response = await apiClient.get<GetThoughtsResponse>('/thoughts', {
		params,
	});
	if (response.data.error) {
		throw new Error(response.data.error);
	}
	return {
		data: response.data.thoughts,
		hasMore: (response.data as any).hasMore ?? false,
	};
}

export async function createThought(
	input: ThoughtInput
): Promise<{ ok: boolean; thought: Thought }> {
	const response = await apiClient.post('/thoughts', input);
	if (response.data.error) {
		throw new Error(response.data.error);
	}
	return response.data;
}

export async function deleteThought(id: string): Promise<{ ok: boolean }> {
	const response = await apiClient.delete(`/thoughts/${id}`);
	if (response.data.error) {
		throw new Error(response.data.error);
	}
	return response.data;
}

export async function updateThought(
	id: string,
	input: Partial<ThoughtInput>
): Promise<{ ok: boolean; thought: Thought }> {
	const response = await apiClient.patch(`/thoughts/${id}`, input);
	if (response.data.error) {
		throw new Error(response.data.error);
	}
	return response.data;
}

export async function fetchMoodSuggestions(): Promise<string[]> {
	const response = await apiClient.get<GetMoodsResponse>('/thoughts/moods');
	if (response.data.error) {
		throw new Error(response.data.error);
	}
	return response.data.moods;
}

export interface GetMoodSuggestionsResponse {
	suggestions: string[];
	error?: string;
}

export async function fetchRandomMoodSuggestions(
	count: number = 6
): Promise<string[]> {
	const response = await apiClient.get<GetMoodSuggestionsResponse>(
		'/thoughts/moods/suggestions',
		{
			params: { count },
		}
	);
	if (response.data.error) {
		throw new Error(response.data.error);
	}
	return response.data.suggestions;
}

export async function updateThoughtPosition(
	id: string,
	x: number,
	y: number
): Promise<{ ok: boolean }> {
	const response = await apiClient.patch(`/thoughts/${id}/position`, {
		x,
		y,
	});
	if (response.data.error) {
		throw new Error(response.data.error);
	}
	return response.data;
}

// ============================================================================
// Threads API
// ============================================================================

export async function fetchThreads(
	params: { limit?: number; offset?: number; search?: string } = {}
): Promise<Thread[]> {
	const response = await apiClient.get<{ threads: Thread[]; error?: string }>(
		'/threads',
		{ params }
	);
	if (response.data.error) {
		throw new Error(response.data.error);
	}
	return response.data.threads;
}

export async function fetchThread(
	id: string
): Promise<{ thread: Thread; items: ThreadItem[] }> {
	const response = await apiClient.get<{
		thread: Thread;
		items: ThreadItem[];
		error?: string;
	}>(`/threads/${id}`);
	if (response.data.error) {
		throw new Error(response.data.error);
	}
	return { thread: response.data.thread, items: response.data.items };
}

export async function createThreadApi(
	input: ThreadInput
): Promise<{ ok: boolean; thread: Thread }> {
	const response = await apiClient.post('/threads', input);
	if (response.data.error) {
		throw new Error(response.data.error);
	}
	return response.data;
}

export async function updateThreadApi(
	id: string,
	input: Partial<ThreadInput>
): Promise<{ ok: boolean }> {
	const response = await apiClient.patch(`/threads/${id}`, input);
	if (response.data.error) {
		throw new Error(response.data.error);
	}
	return response.data;
}

export async function deleteThreadApi(id: string): Promise<{ ok: boolean }> {
	const response = await apiClient.delete(`/threads/${id}`);
	if (response.data.error) {
		throw new Error(response.data.error);
	}
	return response.data;
}

export async function addThreadItemApi(
	threadId: string,
	entityType: string,
	entityId: string
): Promise<{ ok: boolean; item: ThreadItem }> {
	const response = await apiClient.post(`/threads/${threadId}/items`, {
		entity_type: entityType,
		entity_id: entityId,
	});
	if (response.data.error) {
		throw new Error(response.data.error);
	}
	return response.data;
}

export async function removeThreadItemApi(
	threadId: string,
	itemId: string
): Promise<{ ok: boolean }> {
	const response = await apiClient.delete(
		`/threads/${threadId}/items/${itemId}`
	);
	if (response.data.error) {
		throw new Error(response.data.error);
	}
	return response.data;
}

export async function reorderThreadItemsApi(
	threadId: string,
	items: { entity_type: string; entity_id: string; position: number }[]
): Promise<{ ok: boolean }> {
	const response = await apiClient.put(`/threads/${threadId}/items/reorder`, {
		items,
	});
	if (response.data.error) {
		throw new Error(response.data.error);
	}
	return response.data;
}

export async function fetchThreadsForEntity(
	entityType: string,
	entityId: string
): Promise<Thread[]> {
	const response = await apiClient.get<{
		threads: Thread[];
		error?: string;
	}>('/threads/for-entity', {
		params: { type: entityType, id: entityId },
	});
	if (response.data.error) {
		throw new Error(response.data.error);
	}
	return response.data.threads;
}

/**
 * Batched reverse lookup: threads containing any of the given entities in a
 * single request (max 100 ids). Returns one row per (thread, entity) pair;
 * group by entity_id on the client.
 */
export async function fetchThreadsForEntities(
	entityType: string,
	entityIds: string[]
): Promise<(Thread & { entity_id: string })[]> {
	if (entityIds.length === 0) return [];
	const response = await apiClient.get<{
		threads: (Thread & { entity_id: string })[];
		error?: string;
	}>('/threads/for-entities', {
		params: { type: entityType, ids: entityIds.join(',') },
	});
	if (response.data.error) {
		throw new Error(response.data.error);
	}
	return response.data.threads;
}
