import { computed, watch } from 'vue';
import { endSession, ensureSession, useSession } from './session';
import { claimCache, forgetCache } from './queryClient';

const { user, status, isAdmin } = useSession();

watch(user, (current) => {
	if (current) claimCache(current.id);
});

const isLocalDev = () =>
	window.location.hostname === 'localhost' ||
	window.location.hostname === '127.0.0.1';

export function useAuth() {
	/** Starts the session; requests wait on it whether or not this is awaited. */
	async function init() {
		try {
			await ensureSession();
		} catch {
			// `status` says why; requests retry on their own once it recovers.
		}
	}

	async function logout() {
		await endSession();
		forgetCache();
		if (isLocalDev()) window.location.reload();
		else
			window.location.href = `${window.location.origin}/cdn-cgi/access/logout`;
	}

	return {
		user,
		isAdmin,
		status,
		loading: computed(() => status.value === 'starting' && !user.value),
		init,
		logout,
	};
}
