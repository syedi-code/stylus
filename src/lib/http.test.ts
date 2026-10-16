import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
	AxiosError,
	AxiosHeaders,
	type InternalAxiosRequestConfig,
} from 'axios';

const session = vi.hoisted(() => ({ generation: 1, renewals: 0 }));

vi.mock('./session', () => ({
	API_BASE: '/api',
	SessionUnavailableError: class extends Error {},
	ensureSession: vi.fn(async () => {}),
	renewSession: vi.fn(async () => {
		session.renewals++;
		session.generation++;
	}),
	sessionGeneration: () => session.generation,
}));

import { apiClient, apiErrorMessage, pendingWrites } from './http';

type Reply = { status: number; data?: unknown } | 'network';

/** Answers each request with the next reply, recording what was asked. */
function replyWith(...replies: Reply[]) {
	const calls: string[] = [];
	apiClient.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
		calls.push(`${config.method?.toUpperCase()} ${config.url}`);
		const reply = replies.shift() ?? { status: 200, data: {} };
		if (reply === 'network') {
			throw new AxiosError(
				'Network Error',
				AxiosError.ERR_NETWORK,
				config
			);
		}
		const response = {
			data: reply.data ?? {},
			status: reply.status,
			statusText: '',
			headers: new AxiosHeaders(),
			config,
		};
		if (reply.status >= 400) {
			throw new AxiosError(
				'failed',
				AxiosError.ERR_BAD_RESPONSE,
				config,
				null,
				response
			);
		}
		return response;
	};
	return calls;
}

beforeEach(() => {
	session.generation = 1;
	session.renewals = 0;
	pendingWrites.value = 0;
	vi.useRealTimers();
});

describe('a lapsed session', () => {
	it('is renewed and the request sent again, unseen by the caller', async () => {
		const calls = replyWith(
			{ status: 401, data: { code: 'SESSION_EXPIRED' } },
			{ status: 200, data: { ok: true } }
		);
		const response = await apiClient.patch('/essays/e1', { content: 'x' });
		expect(response.data).toEqual({ ok: true });
		expect(calls).toEqual(['PATCH /essays/e1', 'PATCH /essays/e1']);
		expect(session.renewals).toBe(1);
	});

	it('is renewed once however many requests found it lapsed', async () => {
		let release!: () => void;
		const gate = new Promise<void>((r) => (release = r));
		apiClient.defaults.adapter = async (config) => {
			if (session.generation === 1) {
				await gate;
				throw new AxiosError(
					'failed',
					AxiosError.ERR_BAD_RESPONSE,
					config,
					null,
					{
						data: { code: 'SESSION_MISSING' },
						status: 401,
						statusText: '',
						headers: new AxiosHeaders(),
						config,
					}
				);
			}
			return {
				data: { url: config.url },
				status: 200,
				statusText: '',
				headers: new AxiosHeaders(),
				config,
			};
		};
		const both = Promise.all([
			apiClient.get('/notes'),
			apiClient.get('/quotes'),
		]);
		release();
		const [notes, quotes] = await both;
		expect(notes.data.url).toBe('/notes');
		expect(quotes.data.url).toBe('/quotes');
		expect(session.renewals).toBe(1);
	});

	it('is not renewed twice for the same request', async () => {
		replyWith(
			{ status: 401, data: { code: 'SESSION_EXPIRED' } },
			{ status: 401, data: { code: 'SESSION_EXPIRED' } }
		);
		await expect(apiClient.get('/notes')).rejects.toMatchObject({
			response: { status: 401 },
		});
		expect(session.renewals).toBe(1);
	});

	it('leaves other refusals alone', async () => {
		replyWith({ status: 403, data: { error: 'Admin access required' } });
		await expect(apiClient.post('/books', {})).rejects.toMatchObject({
			response: { status: 403 },
		});
		expect(session.renewals).toBe(0);
	});
});

describe('a dropped connection', () => {
	it('is retried for a request that is safe to send twice', async () => {
		const calls = replyWith('network', { status: 200, data: { ok: true } });
		const response = await apiClient.patch('/notes/n1', { posted: 1 });
		expect(response.data).toEqual({ ok: true });
		expect(calls).toHaveLength(2);
	});

	it('is not retried for a create, which might have landed', async () => {
		const calls = replyWith('network', { status: 201 });
		await expect(
			apiClient.post('/notes', { content: 'x' })
		).rejects.toThrow('Network Error');
		expect(calls).toHaveLength(1);
	});
});

describe('pendingWrites', () => {
	it('counts a write until it settles, either way', async () => {
		replyWith({ status: 200 }, { status: 500 });
		const saving = apiClient.patch('/essays/e1', {});
		await Promise.resolve();
		expect(pendingWrites.value).toBe(1);
		await saving;
		expect(pendingWrites.value).toBe(0);

		await expect(apiClient.delete('/notes/n1')).rejects.toBeTruthy();
		expect(pendingWrites.value).toBe(0);
	});

	it('does not count reads, nor a write twice across a renewal', async () => {
		replyWith(
			{ status: 401, data: { code: 'SESSION_EXPIRED' } },
			{ status: 200 }
		);
		await apiClient.get('/notes');
		expect(pendingWrites.value).toBe(0);

		replyWith(
			{ status: 401, data: { code: 'SESSION_EXPIRED' } },
			{ status: 200 }
		);
		await apiClient.post('/notes', {});
		expect(pendingWrites.value).toBe(0);
	});
});

describe('apiErrorMessage', () => {
	it('speaks to the reader, not in status codes', () => {
		const config = {
			headers: new AxiosHeaders(),
		} as InternalAxiosRequestConfig;
		const offline = new AxiosError(
			'Network Error',
			AxiosError.ERR_NETWORK,
			config
		);
		expect(apiErrorMessage(offline)).toMatch(/connection/);

		const server = new AxiosError('x', 'x', config, null, {
			data: {},
			status: 503,
			statusText: '',
			headers: new AxiosHeaders(),
			config,
		});
		expect(apiErrorMessage(server)).toMatch(/server had a problem/);
		expect(apiErrorMessage(new Error('?'), 'Fallback.')).toBe('Fallback.');
	});
});
