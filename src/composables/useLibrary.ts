import { ref, computed } from 'vue';
import {
	fetchBookDetail,
	fetchLibraryBooks,
	type BookDetail,
	type LibraryBook,
	type LibraryListResponse,
} from '../lib/api';

/**
 * The library catalogue, held at module scope.
 *
 * Leaving the Library tab unmounts it; the catalogue stays. Coming back shows
 * the books you left immediately and revalidates behind them, so the tab never
 * opens onto a spinner twice. Book details are cached the same way, which is
 * what lets a book you have opened before reopen with its writing in place.
 */

const books = ref<LibraryBook[]>([]);
const totals = ref<LibraryListResponse['totals']>({ books: 0, quotes: 0, notes: 0 });
/** True until the first successful load — the only time a skeleton shows. */
const cold = ref(true);
const loading = ref(false);
const error = ref<string | null>(null);
let inflight: Promise<void> | null = null;

const details = ref(new Map<string, BookDetail>());

/** An author another tab asked to land on; consumed by the Library page. */
const pendingAuthorId = ref<string | null>(null);

async function load(): Promise<void> {
	if (inflight) return inflight;
	loading.value = true;
	inflight = (async () => {
		try {
			const result = await fetchLibraryBooks();
			books.value = result.books;
			totals.value = result.totals;
			cold.value = false;
			error.value = null;
		} catch (err) {
			console.error('Failed to load library:', err);
			error.value = 'Couldn’t reach the library.';
		} finally {
			loading.value = false;
			inflight = null;
		}
	})();
	return inflight;
}

async function loadDetail(bookId: string): Promise<BookDetail | null> {
	try {
		const detail = await fetchBookDetail(bookId);
		details.value = new Map(details.value).set(bookId, detail);
		return detail;
	} catch (err) {
		console.error('Failed to load book detail:', err);
		return null;
	}
}

/** Apply a known change to a row now; the next load confirms it. */
function patchBook(bookId: string, patch: Partial<LibraryBook>) {
	books.value = books.value.map((b) => (b.id === bookId ? { ...b, ...patch } : b));
}

/**
 * The library endpoint returns up to 500 rows. Past that, client-side search
 * would silently miss books, so the page says so rather than pretend.
 */
const truncated = computed(() => totals.value.books > books.value.length);

export function showAuthorInLibrary(authorId: string) {
	pendingAuthorId.value = authorId;
}

export function useLibrary() {
	return {
		books,
		totals,
		cold,
		loading,
		error,
		truncated,
		details,
		pendingAuthorId,
		load,
		loadDetail,
		patchBook,
	};
}
