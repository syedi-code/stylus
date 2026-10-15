import { describe, it, expect, vi, beforeEach } from 'vitest';
import { nextTick } from 'vue';
import { usePagination } from './usePagination';
import { queryClient } from '../lib/queryClient';

interface Row {
	id: string;
}

const rows = (...ids: string[]): Row[] => ids.map((id) => ({ id }));

function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((r) => (resolve = r));
	return { promise, resolve };
}

beforeEach(() => queryClient.clear());

describe('usePagination', () => {
	it('never lets an older response overwrite a newer query', async () => {
		const slow = deferred<{ data: Row[]; hasMore: boolean }>();
		const fetchFn = vi
			.fn()
			.mockReturnValueOnce(slow.promise)
			.mockResolvedValueOnce({ data: rows('new'), hasMore: false });
		const list = usePagination<Row, { q?: string }>({
			fetchFn,
			pageSize: 10,
		});

		const first = list.reset({ q: 'old' });
		await list.reset({ q: 'new' });
		slow.resolve({ data: rows('old'), hasMore: false });
		await first;

		expect(list.items.value).toEqual(rows('new'));
		expect(list.loading.value).toBe(false);
	});

	it('reopens a cached list at once and revalidates behind it', async () => {
		const fetchFn = vi
			.fn()
			.mockResolvedValue({ data: rows('a', 'b'), hasMore: false });
		const first = usePagination<Row, { q?: string }>({
			fetchFn,
			pageSize: 10,
			key: (r) => r.id,
			cacheAs: 'rows',
		});
		await first.reset({});
		await nextTick();

		const fresher = deferred<{ data: Row[]; hasMore: boolean }>();
		fetchFn.mockReturnValueOnce(fresher.promise);
		const second = usePagination<Row, { q?: string }>({
			fetchFn,
			pageSize: 10,
			key: (r) => r.id,
			cacheAs: 'rows',
		});
		const reopening = second.reset({});
		expect(second.items.value).toEqual(rows('a', 'b'));
		expect(second.loading.value).toBe(false);

		fresher.resolve({ data: rows('c', 'a', 'b'), hasMore: false });
		await reopening;
		expect(second.items.value).toEqual(rows('c', 'a', 'b'));
	});

	it('does not cache a list that failed to load', async () => {
		const fetchFn = vi.fn().mockRejectedValue(new Error('down'));
		const list = usePagination<Row>({
			fetchFn,
			pageSize: 10,
			cacheAs: 'broken',
		});
		await list.reset();
		await nextTick();
		expect(list.error.value).toBeTruthy();
		expect(
			queryClient.getQueryData(['list', 'broken', {}])
		).toBeUndefined();
	});

	it('drops rows a later page repeats after a write shifted the offsets', async () => {
		const fetchFn = vi
			.fn()
			.mockResolvedValueOnce({ data: rows('a', 'b'), hasMore: true })
			.mockResolvedValueOnce({ data: rows('b', 'c'), hasMore: false });
		const list = usePagination<Row>({
			fetchFn,
			pageSize: 2,
			key: (r) => r.id,
		});
		await list.reset();
		await list.loadMore();
		expect(list.items.value).toEqual(rows('a', 'b', 'c'));
	});
});
