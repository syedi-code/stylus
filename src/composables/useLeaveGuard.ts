import { onBeforeUnmount, onMounted } from 'vue';
import { pendingWrites } from '../lib/http';

/** Asks before the page closes on a save that has not landed yet. */
export function useLeaveGuard() {
	const guard = (event: BeforeUnloadEvent) => {
		if (pendingWrites.value === 0) return;
		event.preventDefault();
		event.returnValue = '';
	};
	onMounted(() => window.addEventListener('beforeunload', guard));
	onBeforeUnmount(() => window.removeEventListener('beforeunload', guard));
}
