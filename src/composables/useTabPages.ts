import { defineAsyncComponent } from 'vue';
import { pendingWrites } from '../lib/http';

const RELOADED_KEY = 'stylus-reloaded-for-chunks';

/**
 * A tab's chunk is gone when a deploy has replaced the build this page was
 * loaded from. Reloading picks up the new one — once, and never over a save
 * still in flight; otherwise the error stands and the tab stays put.
 */
function reloadForNewBuild(): boolean {
	if (pendingWrites.value > 0 || !navigator.onLine) return false;
	try {
		const last = Number(sessionStorage.getItem(RELOADED_KEY) ?? 0);
		if (Date.now() - last < 60_000) return false;
		sessionStorage.setItem(RELOADED_KEY, String(Date.now()));
	} catch {
		return false;
	}
	window.location.reload();
	return true;
}

const lazily =
	<T>(load: () => Promise<T>) =>
	() =>
		load().catch((error: unknown) => {
			reloadForNewBuild();
			throw error;
		});

/**
 * Every tab but Notes, the one the app opens on, loads as its own chunk,
 * fetched shortly after boot so switching to one never waits on the network.
 */
const loaders = {
	thoughts: lazily(() => import('../components/thoughts/ThoughtsPage.vue')),
	quotes: lazily(() => import('../components/quotes/QuotesPage.vue')),
	essays: lazily(
		() => import('../components/essays/workspace/EssaysWorkspace.vue')
	),
	library: lazily(() => import('../components/library/LibraryPage.vue')),
};

export const ThoughtsPage = defineAsyncComponent(loaders.thoughts);
export const QuotesPage = defineAsyncComponent(loaders.quotes);
export const EssaysWorkspace = defineAsyncComponent(loaders.essays);
export const LibraryPage = defineAsyncComponent(loaders.library);

export function prefetchTabPages(): void {
	for (const load of Object.values(loaders)) void load().catch(() => {});
}

if (typeof window !== 'undefined') {
	window.addEventListener('vite:preloadError', (event) => {
		if (reloadForNewBuild()) event.preventDefault();
	});
}
