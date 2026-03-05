import { ref, computed } from 'vue';
import axios from 'axios';

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
			const baseURL = import.meta.env.VITE_API_URL || '/api';
			const apiKey = import.meta.env.VITE_API_KEY;
			const response = await axios.get<{ user: AuthUser }>(`${baseURL}/me`, {
				headers: {
					'X-Requested-With': 'XMLHttpRequest',
					...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
				},
			});
			user.value = response.data.user;
		} catch {
			user.value = null;
		} finally {
			loading.value = false;
		}
	}

	function logout() {
		user.value = null;
		const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
		if (isLocalDev) {
			window.location.reload();
		} else {
			const teamDomain = window.location.origin;
			window.location.href = `${teamDomain}/cdn-cgi/access/logout`;
		}
	}

	return { user, isAdmin, loading, init, logout };
}
