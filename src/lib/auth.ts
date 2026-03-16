import { ref, computed } from 'vue';

interface AuthUser {
	id: string;
	email: string;
	name: string | null;
	idp_type: string | null;
	role: 'admin' | 'viewer';
}

const user = ref<AuthUser | null>(null);
const loading = ref(true);

export function useAuth() {
	const isAdmin = computed(() => user.value?.role === 'admin');

	async function init() {
		try {
			// Import apiClient lazily to avoid circular dependency (api.ts imports useAuth)
			const { apiClient } = await import('./api');
			const response = await apiClient.get<{ user: AuthUser }>('/me');
			user.value = response.data.user;
		} catch {
			user.value = null;
		} finally {
			loading.value = false;
		}
	}

	function logout() {
		user.value = null;
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

	return { user, isAdmin, loading, init, logout };
}
