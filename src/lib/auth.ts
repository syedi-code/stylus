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
			const response = await axios.get<{ user: AuthUser }>(`${baseURL}/me`, {
				headers: { 'X-Requested-With': 'XMLHttpRequest' },
				withCredentials: true,
			});
			user.value = response.data.user;
		} catch {
			// Redirect to worker domain to trigger CF Access login
			const baseURL = import.meta.env.VITE_API_URL || '/api';
			const workerOrigin = baseURL.replace(/\/api$/, '');
			const loginUrl = `${workerOrigin}/auth/login?redirect=${encodeURIComponent(window.location.href)}`;
			window.location.href = loginUrl;
			return;
		} finally {
			loading.value = false;
		}
	}

	return { user, isAdmin, loading, init };
}
