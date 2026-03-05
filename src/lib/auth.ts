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
			});
			user.value = response.data.user;
		} catch {
			user.value = null;
		} finally {
			loading.value = false;
		}
	}

	return { user, isAdmin, loading, init };
}
