import { describe, it, expect, vi, beforeEach } from 'vitest';
import { computed, ref } from 'vue';

/** alexandria refuses to sign a PDF for a member; stylus should not ask. */

const role = ref<'admin' | 'member'>('member');
const sign = vi.fn(async (path: string) => `/api/files/${path}?token=t`);

vi.mock('../lib/auth', () => ({
	useAuth: () => ({ isAdmin: computed(() => role.value === 'admin') }),
}));
vi.mock('../lib/api', () => ({
	getSignedFileUrlCached: (path: string) => sign(path),
}));

import { openPdf, prefetchPdf } from './usePdfOpener';

describe('usePdfOpener', () => {
	beforeEach(() => {
		sign.mockClear();
		vi.stubGlobal('open', vi.fn(() => null));
	});

	it('neither signs nor opens a PDF for a member', async () => {
		role.value = 'member';
		prefetchPdf('/files/books/a/book.pdf');
		await openPdf('a', '/files/books/a/book.pdf');
		expect(sign).not.toHaveBeenCalled();
		expect(window.open).not.toHaveBeenCalled();
	});

	it('opens the PDF for the admin', async () => {
		role.value = 'admin';
		await openPdf('b', '/files/books/b/book.pdf');
		expect(sign).toHaveBeenCalledWith('books/b/book.pdf');
		expect(window.open).toHaveBeenCalled();
	});
});
