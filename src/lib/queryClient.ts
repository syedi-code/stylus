import axios from 'axios';
import { QueryClient } from '@tanstack/vue-query';
import {
	persistQueryClientRestore,
	persistQueryClientSubscribe,
	type PersistQueryClientOptions,
} from '@tanstack/query-persist-client-core';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

/** Bump to drop every cache a shipped client has saved, when shapes change. */
const CACHE_VERSION = '1';
const CACHE_KEY = 'stylus-cache';
const OWNER_KEY = 'stylus-cache-owner';

export const keys = {
	deal: ['deal'] as const,
	list: (kind: string, params: unknown) => ['list', kind, params] as const,
	quotes: (params: unknown) => ['quotes', params] as const,
	books: (params: unknown) => ['books', 'list', params] as const,
	book: (id: string) => ['books', 'item', id] as const,
	authors: (params: unknown) => ['authors', 'list', params] as const,
	author: (id: string) => ['authors', 'item', id] as const,
	booksByAuthor: (id: string) => ['books', 'by-author', id] as const,
	connections: (type: string, id: string, connected?: string) =>
		['connections', type, id, connected ?? null] as const,
	library: ['library', 'list'] as const,
	bookDetail: (id: string) => ['library', 'detail', id] as const,
	signedUrl: (path: string) => ['signed-url', path] as const,
};

/** Kept in memory only: a deal is dealt fresh per visit, a signed URL expires. */
const UNSAVED = new Set(['deal', 'signed-url']);

function isRetryable(error: unknown): boolean {
	if (!axios.isAxiosError(error)) return false;
	const status = error.response?.status;
	// Network failures are already retried by the HTTP layer.
	return status !== undefined && (status >= 500 || status === 429);
}

export const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: 30_000,
			gcTime: 7 * DAY,
			retry: (failures, error) => failures < 2 && isRetryable(error),
			retryDelay: (failures) => Math.min(1000 * 2 ** failures, 8000),
			refetchOnWindowFocus: true,
			refetchOnReconnect: true,
		},
	},
});

function storage(): Storage | undefined {
	try {
		return window.localStorage;
	} catch {
		return undefined;
	}
}

const persistOptions = (): PersistQueryClientOptions | null => {
	const store = storage();
	if (!store) return null;
	return {
		queryClient,
		persister: createSyncStoragePersister({
			storage: store,
			key: CACHE_KEY,
			throttleTime: 1000,
		}),
		maxAge: 7 * DAY,
		buster: CACHE_VERSION,
		dehydrateOptions: {
			shouldDehydrateQuery: (query) =>
				query.state.status === 'success' &&
				!UNSAVED.has(String(query.queryKey[0])),
		},
	};
};

/**
 * Puts what the last visit saw back in place before the first render, so the
 * app opens onto the reader's own notes rather than skeletons, and then keeps
 * the saved copy current. A storage that fails costs only the head start.
 */
export async function restoreCache(): Promise<void> {
	const options = persistOptions();
	if (!options) return;
	try {
		await persistQueryClientRestore(options);
	} catch {
		storage()?.removeItem(CACHE_KEY);
	}
	persistQueryClientSubscribe(options);
}

/** A cache saved for one reader is never shown to another on this browser. */
export function claimCache(userId: string): void {
	const store = storage();
	if (!store) return;
	if (store.getItem(OWNER_KEY) !== userId) {
		queryClient.clear();
		store.removeItem(CACHE_KEY);
		store.setItem(OWNER_KEY, userId);
	}
}

export function forgetCache(): void {
	queryClient.clear();
	storage()?.removeItem(CACHE_KEY);
	storage()?.removeItem(OWNER_KEY);
}
