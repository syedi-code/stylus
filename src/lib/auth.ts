import { ref, computed } from 'vue';

interface AuthUser {
	id: string;
	email: string;
	name: string | null;
	idp_type: string | null;
	role: 'admin' | 'member';
}

const AUTH_FAILURE_KEY = 'auth_failure_count';
const MAX_AUTH_FAILURES = 2;

const user = ref<AuthUser | null>(null);
const loading = ref(true);
const authError = ref<string | null>(null);

export function useAuth() {
	const isAdmin = computed(() => user.value?.role === 'admin');

	async function init() {
		// Guard against infinite retry loops
		const failureCount = parseInt(
			sessionStorage.getItem(AUTH_FAILURE_KEY) ?? '0',
			10
		);
		if (failureCount >= MAX_AUTH_FAILURES) {
			authError.value = `Authentication failed after ${MAX_AUTH_FAILURES} attempts. Please reload or re-authenticate.`;
			loading.value = false;
			return;
		}

		try {
			// Import apiClient lazily to avoid circular dependency (api.ts imports useAuth)
			const { apiClient } = await import('./api');
			const response = await apiClient.post<{
				user: { id: string; email: string };
				role: 'admin' | 'member';
			}>('/session');
			user.value = {
				id: response.data.user.id,
				email: response.data.user.email,
				name: null,
				idp_type: null,
				role: response.data.role,
			};
			authError.value = null;
			sessionStorage.removeItem(AUTH_FAILURE_KEY);
		} catch (err: unknown) {
			user.value = null;
			const status = (err as { response?: { status?: number } })?.response
				?.status;
			const code = (err as { response?: { data?: { code?: string } } })
				?.response?.data?.code;
			const message =
				status === 401
					? `Authentication failed (${code ?? 'UNAUTHORIZED'}): your session may have expired`
					: status === 500
						? 'Server configuration error — check Worker environment variables'
						: `Auth error: ${(err as Error)?.message ?? 'Unknown error'}`;

			console.error(
				`[Auth] init() failed — status=${status ?? 'network'} code=${code ?? 'N/A'}`,
				err
			);
			authError.value = message;

			// Increment failure counter to prevent infinite loops
			sessionStorage.setItem(AUTH_FAILURE_KEY, String(failureCount + 1));
		} finally {
			loading.value = false;
		}
	}

	function logout() {
		user.value = null;
		authError.value = null;
		sessionStorage.removeItem(AUTH_FAILURE_KEY);
		const isLocalDev =
			window.location.hostname === 'localhost' ||
			window.location.hostname === '127.0.0.1';
		if (isLocalDev) {
			window.location.reload();
		} else {
			const teamDomain = window.location.origin;
			window.location.href = `${teamDomain}/cdn-cgi/access/logout`;
		}
	}

	return { user, isAdmin, loading, authError, init, logout };
}

/**
 * Called by the API interceptor when a CF Access token refresh fails,
 * indicating the session is truly expired. Sets the error message
 * and triggers the logout/redirect flow.
 */
export function setSessionExpired(message: string) {
	authError.value = message;
	user.value = null;
	sessionStorage.removeItem(AUTH_FAILURE_KEY);
	const isLocalDev =
		window.location.hostname === 'localhost' ||
		window.location.hostname === '127.0.0.1';
	if (isLocalDev) {
		window.location.reload();
	} else {
		const teamDomain = window.location.origin;
		window.location.href = `${teamDomain}/cdn-cgi/access/logout`;
	}
}
