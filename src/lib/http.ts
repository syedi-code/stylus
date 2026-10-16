import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { ref } from 'vue';
import {
	API_BASE,
	SessionUnavailableError,
	ensureSession,
	renewSession,
	sessionGeneration,
} from './session';

interface StylusRequestConfig extends InternalAxiosRequestConfig {
	/** The session this request was sent under. */
	_generation?: number;
	_renewed?: boolean;
	_attempt?: number;
	/** Counted in `pendingWrites` until it settles. */
	_write?: boolean;
}

const SESSION_CODES = new Set(['SESSION_MISSING', 'SESSION_EXPIRED']);
/** Safe to send twice if the first attempt's fate is unknown. */
const IDEMPOTENT = new Set([
	'get',
	'head',
	'options',
	'put',
	'patch',
	'delete',
]);
const NETWORK_RETRY_DELAYS_MS = [400, 1500];

/** Writes in flight. Leaving the page while this is above zero loses them. */
export const pendingWrites = ref(0);

export const apiClient = axios.create({
	baseURL: API_BASE,
	headers: {
		'Content-Type': 'application/json',
		'X-Requested-With': 'XMLHttpRequest',
	},
	withCredentials: true,
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const whenOnline = () =>
	new Promise<void>((resolve) =>
		window.addEventListener('online', () => resolve(), { once: true })
	);

function release(config: StylusRequestConfig) {
	if (config._write) {
		config._write = false;
		pendingWrites.value--;
	}
}

apiClient.interceptors.request.use(async (config: StylusRequestConfig) => {
	const method = (config.method ?? 'get').toLowerCase();
	if (method !== 'get' && !config._write) {
		config._write = true;
		pendingWrites.value++;
	}
	try {
		await ensureSession();
	} catch (error) {
		release(config);
		throw error;
	}
	config._generation = sessionGeneration();
	return config;
});

apiClient.interceptors.response.use(
	(response) => {
		release(response.config as StylusRequestConfig);
		return response;
	},
	async (error: AxiosError) => {
		const config = error.config as StylusRequestConfig | undefined;
		if (!config || axios.isCancel(error)) {
			if (config) release(config);
			throw error;
		}

		try {
			const status = error.response?.status;
			const code = (error.response?.data as { code?: string } | undefined)
				?.code;

			// The session lapsed. Renew it — unless another request already
			// has — and send this one again. A sign-in, if one is needed,
			// happens in between; this request simply waits for it.
			if (
				status === 401 &&
				code &&
				SESSION_CODES.has(code) &&
				!config._renewed
			) {
				config._renewed = true;
				if (config._generation === sessionGeneration())
					await renewSession();
				return await apiClient.request(config);
			}

			if (!error.response) {
				// Offline, the request never left: send it once we are back.
				if (!navigator.onLine) {
					await whenOnline();
					return await apiClient.request(config);
				}
				const attempt = config._attempt ?? 0;
				const method = (config.method ?? 'get').toLowerCase();
				if (
					IDEMPOTENT.has(method) &&
					attempt < NETWORK_RETRY_DELAYS_MS.length
				) {
					config._attempt = attempt + 1;
					await sleep(NETWORK_RETRY_DELAYS_MS[attempt]);
					return await apiClient.request(config);
				}
			}
		} catch (retryError) {
			release(config);
			throw retryError;
		}

		release(config);
		throw error;
	}
);

/** What to tell the reader about a failed request, in their words, not axios's. */
export function apiErrorMessage(
	error: unknown,
	fallback = 'Something went wrong.'
): string {
	if (error instanceof SessionUnavailableError) return error.message;
	if (axios.isAxiosError(error)) {
		if (!error.response)
			return 'Could not reach the server. Check your connection.';
		const status = error.response.status;
		const message = (error.response.data as { error?: string } | undefined)
			?.error;
		if (status >= 500)
			return 'The server had a problem. Try again in a moment.';
		if (status === 403) return message ?? 'You do not have access to that.';
		if (status === 404)
			return 'That could not be found. It may have been deleted.';
		if (message) return message;
	}
	return fallback;
}
