import axios from 'axios';

// ============================================================================
// Shared Types
// ============================================================================

export interface Note {
	id: string;
	content: string;
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

export interface NoteInput {
	content: string;
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

// Log 401 errors with structured details to aid debugging.
// Does NOT auto-redirect or auto-logout (that caused infinite loops).
apiClient.interceptors.response.use(
	(response) => response,
	(error) => {
		if (error.response?.status === 401) {
			const { url, method } = error.config ?? {};
			const { code, hint } = error.response?.data ?? {};
			console.error(`[API] 401 Unauthorized — ${method?.toUpperCase()} ${url}`, {
				code: code ?? 'UNKNOWN',
				hint: hint ?? 'Check auth state',
			});
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
	} = {}
): Promise<{ data: Note[]; hasMore: boolean }> {
	const response = await apiClient.get<{
		notes: any[];
		hasMore?: boolean;
		error?: string;
	}>('/notes', { params });
	if (response.data.error) {
		throw new Error(response.data.error);
	}
	return {
		data: (response.data.notes || []).map(normalizeNote),
		hasMore: response.data.hasMore ?? false,
	};
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
