import { ref, watch, type Ref } from 'vue';
import { queryClient, keys } from '../lib/queryClient';
import { apiErrorMessage } from '../lib/http';

export interface PaginatedResponse<T> {
	data: T[];
	hasMore: boolean;
}

export interface UsePaginationOptions<T, P extends Record<string, unknown>> {
	/** The fetch function that returns paginated data */
	fetchFn: (
		params: P & { limit: number; offset: number }
	) => Promise<PaginatedResponse<T>>;
	/** Number of items per page */
	pageSize: number;
	/** What identifies an item, so `refresh` can merge without duplicates. */
	key?: (item: T) => string;
	/**
	 * Names the list in the shared cache. A list seen before reopens with its
	 * rows at once — on a tab switch or a fresh visit — and revalidates behind
	 * them instead of showing a skeleton.
	 */
	cacheAs?: string;
}

interface CachedPage<T> {
	items: T[];
	hasMore: boolean;
}

/** Enough to reopen onto a full screen; the rest reloads as it scrolls. */
const CACHED_ITEMS = 60;

export function usePagination<
	T,
	P extends Record<string, unknown> = Record<string, never>,
>(options: UsePaginationOptions<T, P>) {
	const items: Ref<T[]> = ref([]) as Ref<T[]>;
	const loading = ref(false);
	const loadingMore = ref(false);
	const hasMore = ref(false);
	const error = ref<string | null>(null);
	const offset = ref(0);
	const currentParams = ref<P>({} as P) as Ref<P>;

	/** Bumped by every new query, so an older response can never land on a newer list. */
	let generation = 0;

	const cacheKey = () =>
		options.cacheAs
			? keys.list(options.cacheAs, currentParams.value)
			: null;

	const fetchFirstPage = () =>
		options.fetchFn({
			...currentParams.value,
			limit: options.pageSize,
			offset: 0,
		});

	if (options.cacheAs) {
		watch([items, hasMore, loading], () => {
			const key = cacheKey();
			if (!key || loading.value || error.value) return;
			queryClient.setQueryData<CachedPage<T>>(key, {
				items: items.value.slice(0, CACHED_ITEMS),
				hasMore: hasMore.value || items.value.length > CACHED_ITEMS,
			});
		});
	}

	const loadInitial = async (params?: P) => {
		if (params) currentParams.value = params;
		const mine = ++generation;
		error.value = null;
		offset.value = 0;

		const key = cacheKey();
		const cached = key
			? queryClient.getQueryData<CachedPage<T>>(key)
			: undefined;
		if (cached) {
			seed(cached.items, cached.hasMore);
			loading.value = false;
			await refresh();
			return;
		}

		loading.value = true;
		items.value = [];
		try {
			const result = await fetchFirstPage();
			if (mine !== generation) return;
			items.value = result.data;
			hasMore.value = result.hasMore;
			offset.value = result.data.length;
		} catch (err) {
			if (mine !== generation) return;
			console.error(err);
			error.value = apiErrorMessage(err, 'Could not load this list.');
		} finally {
			if (mine === generation) loading.value = false;
		}
	};

	const loadMore = async () => {
		if (loadingMore.value || !hasMore.value) return;
		const mine = generation;
		loadingMore.value = true;
		try {
			const result = await options.fetchFn({
				...currentParams.value,
				limit: options.pageSize,
				offset: offset.value,
			});
			if (mine !== generation) return;
			// Rows shift under an offset when something is written meanwhile.
			const seen = options.key
				? new Set(items.value.map(options.key))
				: null;
			const next = seen
				? result.data.filter((item) => !seen.has(options.key!(item)))
				: result.data;
			items.value = [...items.value, ...next];
			hasMore.value = result.hasMore;
			offset.value += result.data.length;
		} catch (err) {
			if (mine !== generation) return;
			console.error(err);
			error.value = apiErrorMessage(err, 'Could not load more.');
		} finally {
			loadingMore.value = false;
		}
	};

	const reset = async (params?: P) => {
		return loadInitial(params);
	};

	/**
	 * Revalidate the first page without emptying the list first. `loadInitial`
	 * clears `items` before it fetches, which is right for a new query and
	 * wrong for a refresh: anything rendered from the list vanishes for the
	 * length of the request. Items past the first page are kept.
	 */
	const refresh = async () => {
		const mine = generation;
		try {
			const result = await fetchFirstPage();
			if (mine !== generation) return;
			const keyOf = options.key ?? ((item: T) => JSON.stringify(item));
			const fresh = new Set(result.data.map(keyOf));
			const tail = items.value
				.slice(options.pageSize)
				.filter((item) => !fresh.has(keyOf(item)));
			items.value = [...result.data, ...tail];
			if (!tail.length) {
				hasMore.value = result.hasMore;
				offset.value = result.data.length;
			}
			error.value = null;
		} catch (err) {
			console.error(err);
		}
	};

	/** Start from items already known — a cached list — without a fetch. */
	const seed = (known: T[], more: boolean) => {
		items.value = known;
		hasMore.value = more;
		offset.value = known.length;
	};

	/**
	 * Remove an item from the loaded items list (optimistic delete).
	 */
	const removeItem = (predicate: (item: T) => boolean) => {
		items.value = items.value.filter((item) => !predicate(item));
	};

	/**
	 * Update an item in the loaded items list (optimistic update).
	 */
	const updateItem = (
		predicate: (item: T) => boolean,
		updater: (item: T) => T
	) => {
		items.value = items.value.map((item) =>
			predicate(item) ? updater(item) : item
		);
	};

	/**
	 * Prepend a new item to the beginning of the list (e.g. after creating).
	 */
	const prependItem = (item: T) => {
		items.value = [item, ...items.value];
		offset.value += 1;
	};

	return {
		items,
		loading,
		loadingMore,
		hasMore,
		error,
		loadInitial,
		loadMore,
		reset,
		refresh,
		seed,
		removeItem,
		updateItem,
		prependItem,
	};
}
