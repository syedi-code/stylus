import axios from 'axios';
import { computed, ref } from 'vue';
import { applyContract, type ApiContract } from './contract';

/**
 * The alexandria session, and the one place that decides when to ask for it.
 *
 * Every request waits on `ensureSession()`. A session that lapses mid-use is
 * renewed from the Cloudflare Access cookie without the page noticing; only
 * when Access itself has lapsed does the status turn `signed-out`, and then
 * requests wait — they are not failed — until the reader signs in again in
 * another window. Nothing here ever navigates away from the page.
 */

export interface SessionUser {
	id: string;
	email: string;
	role: 'admin' | 'member';
}

/**
 * starting     asking alexandria for a session
 * ready        requests may go
 * signed-out   Access has lapsed; waiting for the reader to sign in again
 * unreachable  alexandria could not be reached; requests fail until it can
 */
export type SessionStatus = 'starting' | 'ready' | 'signed-out' | 'unreachable';

interface SessionResponse {
	user: { id: string; email: string };
	role: 'admin' | 'member';
	contract?: ApiContract;
}

export const API_BASE = import.meta.env.VITE_API_URL || '/api';

/** The main client's interceptors wait on this module, so /session cannot use it. */
const bare = axios.create({
	baseURL: API_BASE,
	withCredentials: true,
	headers: { 'X-Requested-With': 'XMLHttpRequest' },
});

const RETRY_DELAYS_MS = [400, 1200, 3000];
const HINT_KEY = 'stylus-session-hint';
const CHANNEL = 'stylus-session';
export const SIGNED_IN_MESSAGE = 'signed-in';

const user = ref<SessionUser | null>(null);
const status = ref<SessionStatus>('starting');

/** Bumped on every new session, so a 401 can tell whether it is already stale. */
let generation = 0;
let minting: Promise<void> | null = null;
let waiters: { resolve: () => void; reject: (error: Error) => void }[] = [];

export class SessionUnavailableError extends Error {
	constructor() {
		super('Could not reach the server.');
		this.name = 'SessionUnavailableError';
	}
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function readHint(): boolean {
	try {
		return localStorage.getItem(HINT_KEY) === '1';
	} catch {
		return false;
	}
}

function writeHint(held: boolean) {
	try {
		if (held) localStorage.setItem(HINT_KEY, '1');
		else localStorage.removeItem(HINT_KEY);
	} catch {
		// Without storage every load simply waits for its session.
	}
}

/**
 * A browser that held a session on its last visit almost always still holds
 * the cookie, so this page's first requests need not wait a round trip for
 * POST /session to confirm it. One that has lost it is answered 401, renewed
 * and resent by the HTTP layer, exactly as a lapse mid-use would be.
 */
let optimistic = readHint();

/**
 * Ends a mint. `minting` is cleared before any waiter resumes, so a request
 * that renews straight away starts a new mint rather than joining this one.
 */
function finish(next: Exclude<SessionStatus, 'starting'>) {
	minting = null;
	optimistic = false;
	status.value = next;
	if (next !== 'unreachable') writeHint(next === 'ready');
	if (next === 'signed-out') return;
	const pending = waiters;
	waiters = [];
	for (const waiter of pending) {
		if (next === 'ready') waiter.resolve();
		else waiter.reject(new SessionUnavailableError());
	}
}

async function mint(): Promise<void> {
	for (let attempt = 0; ; attempt++) {
		try {
			const { data } = await bare.post<SessionResponse>('/session');
			applyContract(data.contract);
			user.value = {
				id: data.user.id,
				email: data.user.email,
				role: data.role,
			};
			generation++;
			return finish('ready');
		} catch (error) {
			if (axios.isAxiosError(error) && error.response?.status === 401) {
				return finish('signed-out');
			}
			if (attempt >= RETRY_DELAYS_MS.length) return finish('unreachable');
			await sleep(RETRY_DELAYS_MS[attempt]);
		}
	}
}

function startMinting(): Promise<void> {
	if (!minting) {
		status.value = 'starting';
		minting = mint();
	}
	return minting;
}

function untilReady(): Promise<void> {
	if (status.value === 'ready') return Promise.resolve();
	if (status.value === 'unreachable') {
		return Promise.reject(new SessionUnavailableError());
	}
	return new Promise((resolve, reject) => waiters.push({ resolve, reject }));
}

/** Resolves once requests may go. Waits through a sign-in rather than failing. */
export function ensureSession(): Promise<void> {
	if (status.value === 'ready') return Promise.resolve();
	if (
		status.value === 'unreachable' ||
		(status.value === 'starting' && !minting)
	) {
		void startMinting();
	}
	if (optimistic && status.value === 'starting') return Promise.resolve();
	return untilReady();
}

/** The session was refused: ask for a new one, which most often just works. */
export function renewSession(): Promise<void> {
	if (status.value === 'ready') status.value = 'starting';
	void startMinting();
	return untilReady();
}

export const sessionGeneration = () => generation;

/** Opens Access in a window of its own, so this page and its unsaved work stay put. */
export function openSignIn(): void {
	const popup = window.open(
		'/signed-in.html',
		'stylus-sign-in',
		'popup,width=480,height=720'
	);
	if (!popup) window.open('/signed-in.html', '_blank');
}

/** Ends the alexandria session too: Access sign-out alone leaves it answering. */
export async function endSession(): Promise<void> {
	try {
		writeHint(false);
		await bare.delete('/session');
	} catch {
		// Signing out goes ahead regardless; the cookie expires on its own.
	}
	user.value = null;
}

let lastAttempt = 0;
function retryWhenBack() {
	if (status.value !== 'signed-out' && status.value !== 'unreachable') return;
	if (Date.now() - lastAttempt < 2000) return;
	lastAttempt = Date.now();
	void startMinting();
}

if (typeof window !== 'undefined') {
	try {
		new BroadcastChannel(CHANNEL).onmessage = (event) => {
			if (event.data === SIGNED_IN_MESSAGE) retryWhenBack();
		};
	} catch {
		// No BroadcastChannel: focus and the opener message below still work.
	}
	window.addEventListener('message', (event) => {
		if (
			event.origin === window.location.origin &&
			event.data === `stylus:${SIGNED_IN_MESSAGE}`
		) {
			retryWhenBack();
		}
	});
	window.addEventListener('focus', retryWhenBack);
	window.addEventListener('online', retryWhenBack);
	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState === 'visible') retryWhenBack();
	});
}

export function useSession() {
	return {
		user,
		status,
		isAdmin: computed(() => user.value?.role === 'admin'),
	};
}
