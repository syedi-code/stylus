import { ref, type Ref } from 'vue';

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
}

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

	const loadInitial = async (params?: P) => {
		if (params) currentParams.value = params;
		loading.value = true;
		error.value = null;
		offset.value = 0;
		items.value = [];

		try {
			const result = await options.fetchFn({
				...currentParams.value,
				limit: options.pageSize,
				offset: 0,
			});
			items.value = result.data;
			hasMore.value = result.hasMore;
			offset.value = result.data.length;
		} catch (err) {
			console.error(err);
			error.value = String(err);
		} finally {
			loading.value = false;
		}
	};

	const loadMore = async () => {
		if (loadingMore.value || !hasMore.value) return;
		loadingMore.value = true;

		try {
			const result = await options.fetchFn({
				...currentParams.value,
				limit: options.pageSize,
				offset: offset.value,
			});
			items.value = [...items.value, ...result.data];
			hasMore.value = result.hasMore;
			offset.value += result.data.length;
		} catch (err) {
			console.error(err);
			error.value = String(err);
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
		try {
			const result = await options.fetchFn({
				...currentParams.value,
				limit: options.pageSize,
				offset: 0,
			});
			const keyOf = options.key ?? ((item: T) => JSON.stringify(item));
			const fresh = new Set(result.data.map(keyOf));
			const tail = items.value.slice(options.pageSize).filter((item) => !fresh.has(keyOf(item)));
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
