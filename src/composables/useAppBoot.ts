import { ref, onMounted } from 'vue';
import { useAuth } from '../lib/auth';
import { warmTextures } from './useTextureBlob';
import { allTextureAssets } from './usePresentationQuoteMode';

/**
 * Everything the app does once, on the way up.
 *
 * `ready` flips only after auth resolves: the first /api/me call warms the
 * Worker's JWKS cache, and a tab that fetches before then races it into 401s.
 * NotesPage, which loads on mount, is held back on this.
 */
export function useAppBoot() {
	const { isAdmin, user, init, logout } = useAuth();
	const ready = ref(false);

	onMounted(async () => {
		await init();
		ready.value = true;

		// Warm the texture blob cache once the browser is idle, so transient
		// fetch failures (and their retries) happen before any quote is opened.
		const warm = () => warmTextures(allTextureAssets());
		if ('requestIdleCallback' in window) requestIdleCallback(warm);
		else setTimeout(warm, 2000);
	});

	return { isAdmin, user, logout, ready };
}
