import { ref, computed } from 'vue';
import {
	fetchQuotes,
	fetchBooks,
	fetchAuthors,
	type Quote,
	type Book,
	type Author,
} from '../lib/api';
import { keys, queryClient } from '../lib/queryClient';

/**
 * Shared, lazily-loaded source library (quotes / books / authors).
 *
 * Why a module-singleton: the block editor's foil objects must show a quote's
 * actual words / a book's title *while you write* — but the server only
 * derives an essay's `references` on save, so an unsaved `[[quote:UUID]]`
 * token has nothing resolved yet. Both the block foils and `EssayEmbedSheet`
 * need the same catalogue, so we load it once here and everyone reads the
 * same maps — one network round-trip instead of one per component.
 *
 * State lives at module scope (not inside the composable) so every caller of
 * `useSourceLibrary()` shares it.
 */

const quotes = ref<Quote[]>([]);
const books = ref<Book[]>([]);
const authors = ref<Author[]>([]);
const loading = ref(false);
const loaded = ref(false);
let inflight: Promise<void> | null = null;

// Freshly-uploaded / already-resolved image URLs, keyed by essay_images id.
// Seeded from an essay's references on open and from upload responses; images
// aren't part of the fetched catalogue, they're per-essay.
const imageUrls = ref<Map<string, string>>(new Map());

const quoteById = computed(() => {
	const m = new Map<string, Quote>();
	for (const q of quotes.value) m.set(q.id, q);
	return m;
});
const bookById = computed(() => {
	const m = new Map<string, Book>();
	for (const b of books.value) m.set(b.id, b);
	return m;
});
const authorById = computed(() => {
	const m = new Map<string, Author>();
	for (const a of authors.value) m.set(a.id, a);
	return m;
});

// latest_only: superseded quote versions (rows another quote `replaces`) must
// never surface in the insert picker.
const QUOTES = { limit: 500, latest_only: 1 };
const BOOKS = { limit: 500 };
const AUTHORS = { limit: 500 };
const quotesKey = keys.quotes(QUOTES);

const fetchCatalogueQuotes = () =>
	queryClient.fetchQuery({
		queryKey: quotesKey,
		queryFn: () => fetchQuotes(QUOTES),
		staleTime: 5 * 60_000,
	});

/**
 * How old a catalogue a forced load accepts. Writes from this client mark it
 * stale at once; this bounds how long one made elsewhere can go unseen.
 */
const FORCED_MAX_AGE_MS = 30_000;

async function fetchCatalogue(maxAgeMs?: number): Promise<void> {
	if (maxAgeMs !== undefined) {
		const catalogue = [quotesKey, keys.books(BOOKS), keys.authors(AUTHORS)];
		await Promise.all(
			catalogue
				.filter(
					(queryKey) =>
						Date.now() -
							(queryClient.getQueryState(queryKey)
								?.dataUpdatedAt ?? 0) >
						maxAgeMs
				)
				.map((queryKey) =>
					queryClient.invalidateQueries({
						queryKey,
						exact: true,
						refetchType: 'none',
					})
				)
		);
	}
	const [q, b, a] = await Promise.all([
		fetchCatalogueQuotes(),
		fetchBooks(BOOKS),
		fetchAuthors(AUTHORS),
	]);
	quotes.value = q;
	books.value = b;
	authors.value = a;
	loaded.value = true;
}

/** The last visit's catalogue, if the saved cache holds all three halves of it. */
function fromSavedCache(): boolean {
	const q = queryClient.getQueryData<Quote[]>(quotesKey);
	const b = queryClient.getQueryData<Book[]>(keys.books(BOOKS));
	const a = queryClient.getQueryData<Author[]>(keys.authors(AUTHORS));
	if (!q || !b || !a) return false;
	quotes.value = q;
	books.value = b;
	authors.value = a;
	loaded.value = true;
	return true;
}

/**
 * Fetch the catalogue once (idempotent; concurrent callers share the flight).
 * A catalogue saved by the last visit answers at once and is refreshed
 * behind it, so foils resolve before the network does.
 */
async function ensureLoaded(force = false): Promise<void> {
	if (loaded.value && !force) return;
	if (inflight) return inflight;
	if (!force && fromSavedCache()) {
		inflight = fetchCatalogue(FORCED_MAX_AGE_MS)
			.catch((err) =>
				console.error('Failed to refresh source library:', err)
			)
			.finally(() => {
				inflight = null;
			});
		return;
	}
	loading.value = true;
	inflight = fetchCatalogue(force ? FORCED_MAX_AGE_MS : undefined).finally(
		() => {
			loading.value = false;
			inflight = null;
		}
	);
	return inflight;
}

/**
 * Put a quote written elsewhere in the app into the shared catalogue.
 *
 * The quote sheet can now WRITE a quote, not only pick one — and the store it
 * creates into is the store every foil and picker reads. Without this the new
 * quote's `[[quote:UUID]]` token would render "quote unavailable" until a
 * full 500-row refetch landed; with it the foil resolves on the next tick and
 * nothing has to be force-refreshed.
 */
function registerQuote(q: Quote) {
	const i = quotes.value.findIndex((x) => x.id === q.id);
	if (i >= 0) quotes.value = quotes.value.map((x, n) => (n === i ? q : x));
	// Newest first, matching the order fetchQuotes returns.
	else quotes.value = [q, ...quotes.value];
	queryClient.setQueryData(quotesKey, quotes.value);
}

/** Register a resolvable image URL for an essay_images id. */
function registerImage(id: string, url: string) {
	const next = new Map(imageUrls.value);
	next.set(id, url);
	imageUrls.value = next;
}

function imageUrl(id: string): string | undefined {
	return imageUrls.value.get(id);
}

export function useSourceLibrary() {
	return {
		quotes,
		books,
		authors,
		loading,
		loaded,
		ensureLoaded,
		quoteById,
		bookById,
		authorById,
		registerImage,
		registerQuote,
		imageUrl,
	};
}
