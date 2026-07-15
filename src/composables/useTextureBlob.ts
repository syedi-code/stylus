import { ref, watch, type Ref } from 'vue';

/**
 * Texture URLs resolve exactly once per page lifetime into `blob:` URLs.
 *
 * Why: in prod the whole site (textures included) sits behind Cloudflare
 * Access, and Pages serves assets with revalidating cache-control — so every
 * repaint of a texture `url(...)` sends iOS WebKit back over the network
 * through the Access gate. If any re-request/revalidation comes back as a
 * non-image (Access bounce to the HTML login page, failed 304), WebKit
 * poisons its per-page cache entry for that URL and every later paint
 * silently no-ops → the fullbleed surface degrades to its dark base = black
 * screen until reload. Painting from a document-lifetime blob: URL takes the
 * network, Access, and the HTTP cache out of the repaint path entirely.
 *
 * Blob URLs are deliberately never revoked: ≤18 textures ≈ a few MB
 * compressed, and revoking would reintroduce the re-fetch we're avoiding.
 *
 * Fetches retry with backoff (Safari 18 sometimes fails a fetch on a stale
 * keep-alive connection instead of retrying it), and only successes are
 * memoized — a transient failure must never pin a texture to the raw-URL
 * fallback for the rest of the session.
 */

export interface TextureLoadEvent {
    at: string;
    /** Pathname only, for the debug overlay. */
    url: string;
    status?: number;
    redirected?: boolean;
    finalOrigin?: string;
    contentType?: string;
    /** Response cache-control — proves the _headers change deployed. */
    cacheControl?: string;
    bytes?: number;
    decode?: 'ok' | 'fail';
    error?: string;
    /** 1-based fetch attempt this event describes (retries bump it). */
    attempt?: number;
    /** For 'summary' events — the whole line. */
    note?: string;
    outcome: 'blob' | 'fallback-raw' | 'cache-hit' | 'retry' | 'summary';
}

/** Ring buffer for TextureDebugOverlay — newest first, capped. */
export const textureLog = ref<TextureLoadEvent[]>([]);
/** Set when a fetch looks like a Cloudflare Access bounce (session expired). */
export const textureAccessBounce = ref(false);

const LOG_CAP = 30;

function logEvent(event: Omit<TextureLoadEvent, 'at'>) {
    const at = new Date().toTimeString().slice(0, 8);
    textureLog.value = [{ at, ...event }, ...textureLog.value].slice(0, LOG_CAP);
}

function shortUrl(url: string) {
    try {
        return new URL(url, location.href).pathname;
    } catch {
        return url;
    }
}

/** One fetch per URL per page lifetime; settles even if the caller unmounts. */
const pending = new Map<string, Promise<string>>();
/** Synchronous fast path — avoids a one-frame dark flash on re-entry. */
const resolved = new Map<string, string>();

/** Waits before retry attempts 2 and 3; a bounce or offline never retries. */
const RETRY_DELAYS_MS = [250, 1000];

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function loadTexture(url: string, quiet = false): Promise<string> {
    for (let attempt = 1; ; attempt++) {
        const retryDelay = RETRY_DELAYS_MS[attempt - 1];
        let res: Response;
        try {
            res = await fetch(url, { credentials: 'same-origin' });
        } catch (err) {
            const error = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
            // Two rejection causes share this "TypeError: Load failed"
            // signature: Safari 18 reusing a dead keep-alive connection
            // without retrying it (transient — a fresh attempt succeeds),
            // and a cross-origin redirect to the Access login page (no ACAO
            // header). Retry while online; only call it a bounce once the
            // retry budget is spent. Offline rejections look identical too.
            if (retryDelay !== undefined && navigator.onLine) {
                logEvent({ url: shortUrl(url), attempt, error, outcome: 'retry' });
                await sleep(retryDelay);
                continue;
            }
            if (navigator.onLine) textureAccessBounce.value = true;
            logEvent({ url: shortUrl(url), attempt, error, outcome: 'fallback-raw' });
            return url;
        }

        const contentType = res.headers.get('content-type') ?? undefined;
        const cacheControl = res.headers.get('cache-control') ?? undefined;
        let finalOrigin: string | undefined;
        try {
            finalOrigin = new URL(res.url).origin;
        } catch { /* opaque/empty res.url */ }
        const crossOrigin = finalOrigin !== undefined && finalOrigin !== location.origin;

        if (!res.ok || res.redirected || crossOrigin || !contentType?.startsWith('image/')) {
            const isBounce = res.redirected || crossOrigin;
            // An off-origin redirect is the Access gate — retrying can't
            // help. Anything else (5xx, wrong content-type) gets the budget.
            if (!isBounce && retryDelay !== undefined) {
                logEvent({ url: shortUrl(url), attempt, status: res.status, contentType, outcome: 'retry' });
                await sleep(retryDelay);
                continue;
            }
            if (isBounce) textureAccessBounce.value = true;
            logEvent({
                url: shortUrl(url),
                attempt,
                status: res.status,
                redirected: res.redirected,
                finalOrigin,
                contentType,
                cacheControl,
                outcome: 'fallback-raw',
            });
            return url;
        }

        let blob: Blob;
        try {
            blob = await res.blob();
        } catch (err) {
            // Connection died mid-body — same transient class as above.
            const error = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
            if (retryDelay !== undefined && navigator.onLine) {
                logEvent({ url: shortUrl(url), attempt, error, outcome: 'retry' });
                await sleep(retryDelay);
                continue;
            }
            logEvent({ url: shortUrl(url), attempt, error, outcome: 'fallback-raw' });
            return url;
        }
        const blobUrl = URL.createObjectURL(blob);

        // Diagnostic only: iOS decode() false-rejects under memory pressure
        // while the CSS paint still succeeds, so never gate the return on it.
        let decode: 'ok' | 'fail' = 'ok';
        try {
            const img = new Image();
            img.src = blobUrl;
            await img.decode();
        } catch {
            decode = 'fail';
        }

        if (!quiet) {
            logEvent({
                url: shortUrl(url),
                attempt,
                status: res.status,
                contentType,
                cacheControl,
                bytes: blob.size,
                decode,
                outcome: 'blob',
            });
        }
        return blobUrl;
    }
}

export function resolveTexture(url: string, quiet = false): Promise<string> {
    let p = pending.get(url);
    if (!p) {
        p = loadTexture(url, quiet).then((final) => {
            if (final.startsWith('blob:')) {
                resolved.set(url, final);
            } else {
                // Failed load: forget it, so the next request refetches
                // instead of pinning the broken raw URL all session.
                pending.delete(url);
            }
            return final;
        });
        pending.set(url, p);
    }
    return p;
}

/**
 * Idle prefetch: resolve every texture up front so transient fetch failures
 * (and their retries) happen before any quote is opened. Sequential, so it
 * never competes with data requests. Failures get one delayed second pass.
 * Individual successes load quietly; one summary line hits the debug log.
 */
export async function warmTextures(urls: string[]): Promise<void> {
    const isWarm = (final: string) => final.startsWith('blob:');
    let failed: string[] = [];
    for (const url of urls) {
        if (!isWarm(await resolveTexture(url, true))) failed.push(url);
    }
    if (failed.length) {
        await sleep(10_000);
        const secondPass = failed;
        failed = [];
        for (const url of secondPass) {
            if (!isWarm(await resolveTexture(url, true))) failed.push(url);
        }
    }
    logEvent({
        url: '',
        note: failed.length
            ? `warmed ${urls.length - failed.length}/${urls.length} textures — ${failed.length} failed`
            : `all ${urls.length} textures warmed`,
        outcome: 'summary',
    });
}

/**
 * Maps a (possibly changing) texture URL to its blob-URL equivalent.
 * `undefined` in → `undefined` out, so hosts that window which slides hold a
 * texture (PresentationViewEssay) keep working unchanged.
 */
export function useTextureBlob(source: Ref<string | undefined>): Ref<string | undefined> {
    const display = ref<string | undefined>(undefined);
    let token = 0;
    watch(source, (url) => {
        const my = ++token;
        if (!url) {
            display.value = undefined;
            return;
        }
        const hit = resolved.get(url);
        if (hit !== undefined) {
            display.value = hit;
            logEvent({ url: shortUrl(url), outcome: 'cache-hit' });
            return;
        }
        display.value = undefined;
        resolveTexture(url).then((final) => {
            if (my === token) display.value = final;
        });
    }, { immediate: true });
    return display;
}
