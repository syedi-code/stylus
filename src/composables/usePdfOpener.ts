import { ref } from 'vue';
import { getSignedFileUrlCached } from '../lib/api';

/**
 * Opening a book's PDF in one gesture.
 *
 * A PDF lives behind a signed URL, and signing is a round trip. Awaiting it
 * inside a click and only then calling `window.open` loses the user gesture,
 * and Safari blocks the tab as a popup. So signing starts early — on hover or
 * the first touch — and the click opens synchronously when the URL is ready.
 * If it is not ready yet, a tab is opened inside the gesture and pointed at the
 * PDF once the signature lands.
 */

// Signatures last 45 minutes (see getSignedFileUrlCached); trust ours for 40.
const FRESH_MS = 40 * 60 * 1000;
const ready = new Map<string, { url: string; at: number }>();

function readyUrl(path: string): string | null {
	const hit = ready.get(path);
	return hit && Date.now() - hit.at < FRESH_MS ? hit.url : null;
}

function remember(path: string, url: string) {
	ready.set(path, { url, at: Date.now() });
}
/** The book whose PDF is being fetched, for a pending state on its button. */
const opening = ref<string | null>(null);

function pathOf(pdfUrl: string): string {
	return pdfUrl.replace(/^\/files\//, '');
}

export function prefetchPdf(pdfUrl?: string) {
	if (!pdfUrl) return;
	const path = pathOf(pdfUrl);
	if (readyUrl(path)) return;
	getSignedFileUrlCached(path)
		.then((url) => remember(path, url))
		.catch(() => {});
}

export async function openPdf(bookId: string, pdfUrl?: string) {
	if (!pdfUrl) return;
	const path = pathOf(pdfUrl);
	const known = readyUrl(path);
	if (known) {
		window.open(known, '_blank', 'noopener');
		return;
	}

	const tab = window.open('about:blank', '_blank');
	opening.value = bookId;
	try {
		const url = await getSignedFileUrlCached(path);
		remember(path, url);
		if (tab) tab.location.href = url;
		else window.open(url, '_blank', 'noopener');
	} catch (err) {
		console.error('Failed to open PDF:', err);
		tab?.close();
	} finally {
		opening.value = null;
	}
}

export function usePdfOpener() {
	return { opening, openPdf, prefetchPdf };
}
