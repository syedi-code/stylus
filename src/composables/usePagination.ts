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
		removeItem,
		updateItem,
		prependItem,
	};
}
