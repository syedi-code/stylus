import { ref, computed } from 'vue';
import {
	fetchQuotes,
	fetchBooks,
	fetchAuthors,
	type Quote,
	type Book,
	type Author,
} from '../lib/api';

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

/** Fetch the catalogue once (idempotent; concurrent callers share the flight). */
async function ensureLoaded(force = false): Promise<void> {
	if (loaded.value && !force) return;
	if (inflight) return inflight;
	loading.value = true;
	inflight = (async () => {
		try {
			const [q, b, a] = await Promise.all([
				fetchQuotes({ limit: 500 }),
				fetchBooks({ limit: 500 }),
				fetchAuthors({ limit: 500 }),
			]);
			quotes.value = q;
			books.value = b;
			authors.value = a;
			loaded.value = true;
		} finally {
			loading.value = false;
			inflight = null;
		}
	})();
	return inflight;
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
		imageUrl,
	};
}
