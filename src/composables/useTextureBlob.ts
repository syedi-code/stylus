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
    outcome: 'blob' | 'fallback-raw' | 'cache-hit';
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

async function loadTexture(url: string): Promise<string> {
    let res: Response;
    try {
        res = await fetch(url, { credentials: 'same-origin' });
    } catch (err) {
        // A cross-origin redirect to the Access login page (no ACAO header)
        // rejects the fetch with a TypeError — this is the primary bounce
        // signature. Offline rejections look identical, so gate on onLine.
        if (navigator.onLine) textureAccessBounce.value = true;
        logEvent({
            url: shortUrl(url),
            error: err instanceof Error ? `${err.name}: ${err.message}` : String(err),
            outcome: 'fallback-raw',
        });
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
        if (res.redirected || crossOrigin) textureAccessBounce.value = true;
        logEvent({
            url: shortUrl(url),
            status: res.status,
            redirected: res.redirected,
            finalOrigin,
            contentType,
            cacheControl,
            outcome: 'fallback-raw',
        });
        return url;
    }

    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);

    // Diagnostic only: iOS decode() false-rejects under memory pressure while
    // the CSS paint still succeeds, so never gate the return on it.
    let decode: 'ok' | 'fail' = 'ok';
    try {
        const img = new Image();
        img.src = blobUrl;
        await img.decode();
    } catch {
        decode = 'fail';
    }

    logEvent({
        url: shortUrl(url),
        status: res.status,
        contentType,
        cacheControl,
        bytes: blob.size,
        decode,
        outcome: 'blob',
    });
    return blobUrl;
}

export function resolveTexture(url: string): Promise<string> {
    let p = pending.get(url);
    if (!p) {
        p = loadTexture(url).then((final) => {
            resolved.set(url, final);
            return final;
        });
        pending.set(url, p);
    }
    return p;
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
