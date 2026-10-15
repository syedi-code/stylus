import { onMounted } from 'vue';
import { useAuth } from '../lib/auth';
import { warmTextures } from './useTextureBlob';
import { allTextureAssets } from './usePresentationQuoteMode';
import { prefetchTabPages } from './useTabPages';
import { useLeaveGuard } from './useLeaveGuard';

const whenIdle = (task: () => void, timeout: number) => {
	if ('requestIdleCallback' in window) requestIdleCallback(task, { timeout });
	else setTimeout(task, timeout);
};

/**
 * Everything the app does once, on the way up. Nothing here holds the first
 * render: requests wait on the session themselves, and a tab paints its
 * cached rows or its skeleton straight away.
 */
export function useAppBoot() {
	const { isAdmin, user, init, logout } = useAuth();
	useLeaveGuard();

	onMounted(() => {
		// The other tabs' code, once the first notes have had the bandwidth to
		// themselves.
		void init().then(() => setTimeout(prefetchTabPages, 1000));

		// Warm the texture blob cache well after the first data has landed, so
		// several megabytes of imagery never compete with it — and transient
		// fetch failures (and their retries) still happen before any quote is
		// opened.
		setTimeout(
			() => whenIdle(() => warmTextures(allTextureAssets()), 10_000),
			5000
		);
	});

	return { isAdmin, user, logout };
}
