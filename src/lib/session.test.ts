import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const bare = vi.hoisted(() => ({ post: vi.fn(), delete: vi.fn() }));

vi.mock('axios', async (importOriginal) => {
	const actual = await importOriginal<typeof import('axios')>();
	return {
		...actual,
		default: {
			...actual.default,
			create: () => bare,
			isAxiosError: actual.default.isAxiosError,
		},
	};
});

const refused = () =>
	Object.assign(new Error('401'), {
		isAxiosError: true,
		response: { status: 401, data: { code: 'JWT_VERIFICATION_FAILED' } },
	});
const unreachable = () =>
	Object.assign(new Error('Network Error'), { isAxiosError: true });
const granted = (email = 'reader@example.test') => ({
	data: { user: { id: 'u1', email }, role: 'admin' },
});

/** A fresh copy of the module, since its state is module-level by design. */
async function load() {
	vi.resetModules();
	return import('./session');
}

beforeEach(() => {
	localStorage.clear();
	bare.post.mockReset();
	bare.delete.mockReset();
});

afterEach(() => vi.useRealTimers());

describe('ensureSession', () => {
	it('asks once, however many requests wait on it', async () => {
		bare.post.mockResolvedValue(granted());
		const { ensureSession, useSession } = await load();
		await Promise.all([ensureSession(), ensureSession(), ensureSession()]);
		expect(bare.post).toHaveBeenCalledTimes(1);
		expect(useSession().status.value).toBe('ready');
		expect(useSession().isAdmin.value).toBe(true);
	});

	it('holds requests while signed out, and lets them go once signed in again', async () => {
		bare.post
			.mockRejectedValueOnce(refused())
			.mockResolvedValueOnce(granted());
		const { ensureSession, renewSession, useSession } = await load();

		let released = false;
		const waiting = ensureSession().then(() => (released = true));
		await vi.waitFor(() =>
			expect(useSession().status.value).toBe('signed-out')
		);
		expect(released).toBe(false);

		await renewSession();
		await waiting;
		expect(released).toBe(true);
		expect(useSession().status.value).toBe('ready');
	});

	it('retries a server it cannot reach, then fails the waiting requests', async () => {
		vi.useFakeTimers();
		bare.post.mockRejectedValue(unreachable());
		const { ensureSession, useSession, SessionUnavailableError } =
			await load();

		const outcome = ensureSession().catch((error) => error);
		await vi.runAllTimersAsync();
		expect(await outcome).toBeInstanceOf(SessionUnavailableError);
		expect(bare.post).toHaveBeenCalledTimes(4);
		expect(useSession().status.value).toBe('unreachable');
	});

	it('tries again for a request made after the server was unreachable', async () => {
		vi.useFakeTimers();
		bare.post.mockRejectedValue(unreachable());
		const { ensureSession } = await load();
		const first = ensureSession().catch(() => {});
		await vi.runAllTimersAsync();
		await first;

		bare.post.mockResolvedValue(granted());
		await expect(ensureSession()).resolves.toBeUndefined();
	});
});

describe('a returning browser', () => {
	it('sends its first requests without waiting for the session to be confirmed', async () => {
		localStorage.setItem('stylus-session-hint', '1');
		let answer!: (value: unknown) => void;
		bare.post.mockReturnValueOnce(new Promise((r) => (answer = r)));
		const { ensureSession, useSession } = await load();

		await expect(ensureSession()).resolves.toBeUndefined();
		expect(useSession().status.value).toBe('starting');

		answer(granted());
		await vi.waitFor(() => expect(useSession().status.value).toBe('ready'));
	});

	it('waits like any other once that guess has been tested', async () => {
		localStorage.setItem('stylus-session-hint', '1');
		bare.post.mockRejectedValueOnce(refused());
		const { ensureSession, useSession } = await load();
		void ensureSession();
		await vi.waitFor(() =>
			expect(useSession().status.value).toBe('signed-out')
		);

		let released = false;
		void ensureSession().then(() => (released = true));
		await Promise.resolve();
		expect(released).toBe(false);
		expect(localStorage.getItem('stylus-session-hint')).toBeNull();
	});
});

describe('renewSession', () => {
	it('starts a new generation, so stale refusals can tell', async () => {
		bare.post.mockResolvedValue(granted());
		const { ensureSession, renewSession, sessionGeneration } = await load();
		await ensureSession();
		const before = sessionGeneration();
		await renewSession();
		expect(sessionGeneration()).toBe(before + 1);
	});
});

describe('signing in again elsewhere', () => {
	it('is noticed when the sign-in window says so', async () => {
		// Persistent: copies of the module from earlier tests listen too.
		bare.post.mockRejectedValueOnce(refused()).mockResolvedValue(granted());
		const { ensureSession, useSession } = await load();
		const waiting = ensureSession();
		await vi.waitFor(() =>
			expect(useSession().status.value).toBe('signed-out')
		);

		window.dispatchEvent(
			new MessageEvent('message', {
				data: 'stylus:signed-in',
				origin: window.location.origin,
			})
		);
		await waiting;
		expect(useSession().status.value).toBe('ready');
	});
});
