<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { fetchThoughts, deleteThought, type Thought } from '../lib/api';
import { usePagination } from '../composables/usePagination';
import ThoughtCard from './ThoughtCard.vue';
import ThoughtCardSkeleton from './ThoughtCardSkeleton.vue';
import EditThoughtModal from './EditThoughtModal.vue';
import PresentationModeThoughts from './PresentationModeThoughts.vue';

const emit = defineEmits<{
	(e: 'addToThread', thought: Thought): void;
}>();

const pagination = usePagination<Thought>({
	fetchFn: (params) => fetchThoughts(params),
	pageSize: 50,
});

const search = ref('');

// Infinite scroll sentinel
const thoughtsScrollSentinel = ref<HTMLElement | null>(null);
let observer: IntersectionObserver | null = null;

// Edit modal state
const editModalOpen = ref(false);
const editingThought = ref<Thought | null>(null);

// Presentation modal state
const presentingThought = ref<Thought | null>(null);

// Group thoughts by date
const groupedThoughts = computed(() => {
	const filtered = pagination.items.value.filter(t => {
		if (!search.value.trim()) return true;
		const q = search.value.toLowerCase();
		return t.content.toLowerCase().includes(q) ||
			t.mood_tags?.some(tag => tag.toLowerCase().includes(q));
	});

	const groups: { date: string; label: string; thoughts: Thought[] }[] = [];
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	const yesterday = new Date(today);
	yesterday.setDate(yesterday.getDate() - 1);

	for (const thought of filtered) {
		const thoughtDate = new Date(thought.created_at);
		thoughtDate.setHours(0, 0, 0, 0);
		const dateKey = thoughtDate.toISOString().split('T')[0];

		let label: string;
		if (thoughtDate.getTime() === today.getTime()) {
			label = 'Today';
		} else if (thoughtDate.getTime() === yesterday.getTime()) {
			label = 'Yesterday';
		} else {
			label = thoughtDate.toLocaleDateString('en-US', {
				weekday: 'long',
				month: 'short',
				day: 'numeric'
			});
		}

		const existingGroup = groups.find(g => g.date === dateKey);
		if (existingGroup) {
			existingGroup.thoughts.push(thought);
		} else {
			groups.push({ date: dateKey, label, thoughts: [thought] });
		}
	}

	return groups;
});

const loadThoughts = async () => {
	await pagination.reset();
};

const handleDelete = async (id: string) => {
	if (!confirm('Delete this thought?')) return;

	try {
		await deleteThought(id);
		pagination.removeItem((t) => t.id === id);
	} catch (err) {
		console.error(err);
		alert('Failed to delete thought.');
	}
};

const handleEdit = (thought: Thought) => {
	editingThought.value = thought;
	editModalOpen.value = true;
};

const handleEditSaved = (updatedThought: Thought) => {
	pagination.updateItem(
		(t) => t.id === updatedThought.id,
		() => updatedThought
	);
	editModalOpen.value = false;
	editingThought.value = null;
};

const handleEditClose = () => {
	editModalOpen.value = false;
	editingThought.value = null;
};

onMounted(() => {
	loadThoughts();

	observer = new IntersectionObserver(
		(entries) => {
			if (entries[0]?.isIntersecting && pagination.hasMore.value && !pagination.loadingMore.value) {
				pagination.loadMore();
			}
		},
		{ rootMargin: '200px' }
	);
});

onUnmounted(() => {
	observer?.disconnect();
});

// Watch the sentinel element and connect/disconnect the observer
watch(thoughtsScrollSentinel, (el, oldEl) => {
	if (oldEl) observer?.unobserve(oldEl);
	if (el) observer?.observe(el);
});

// Expose reload for parent to call after new thought
defineExpose({ reload: loadThoughts });
</script>

<template>
	<div class="space-y-6">
		<!-- Search -->
		<div class="relative">
			<input v-model="search" type="text" placeholder="Search thoughts..." class="w-full px-4 py-2.5 bg-mono-900 border border-rose/20 focus:border-rose rounded-xl text-mono-100 placeholder-mono-500 focus:outline-none transition-colors pl-10" />
			<svg class="absolute left-3 top-1/2 -translate-y-1/2 text-mono-500" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<circle cx="11" cy="11" r="8" />
				<path d="m21 21-4.3-4.3" />
			</svg>
		</div>

		<!-- Skeleton Loading -->
		<div v-if="pagination.loading.value" class="space-y-3">
			<ThoughtCardSkeleton v-for="i in 5" :key="i" />
		</div>

		<!-- Error -->
		<div v-else-if="pagination.error.value" class="p-6 border border-red-900 bg-red-950/20 text-center rounded-xl">
			<p class="text-red-500 font-bold uppercase text-sm mb-4">{{ pagination.error.value }}</p>
			<button @click="loadThoughts" class="px-4 py-2 bg-red-900 hover:bg-red-800 text-white text-xs font-bold uppercase tracking-wide transition-colors cursor-pointer rounded-lg">
				Retry
			</button>
		</div>

		<!-- Empty -->
		<div v-else-if="groupedThoughts.length === 0" class="py-20 text-center text-mono-500 border border-dashed border-pink/20 rounded-xl">
			<div class="text-4xl mb-4">💭</div>
			<p class="text-sm">{{ search ? 'No thoughts match your search.' : 'No thoughts yet. Capture your first one!'
			}}</p>
		</div>

		<!-- Grouped List -->
		<template v-else>
			<div v-for="group in groupedThoughts" :key="group.date" class="space-y-3">
				<h3 class="text-xs font-medium text-pink uppercase tracking-wider px-1 flex items-center gap-2">
					<span class="w-2 h-2 bg-pink rounded-full"></span>
					{{ group.label }}
				</h3>
				<div class="space-y-3">
					<ThoughtCard v-for="thought in group.thoughts" :key="thought.id" :thought="thought" @delete="handleDelete" @edit="handleEdit" @present="presentingThought = $event" @addToThread="emit('addToThread', $event)" />
				</div>
			</div>

			<!-- Scroll sentinel for infinite scroll -->
			<div ref="thoughtsScrollSentinel" class="h-1"></div>

			<!-- Loading more spinner -->
			<div v-if="pagination.loadingMore.value" class="py-6 text-center">
				<div class="inline-block animate-spin h-5 w-5 border-2 border-rose border-t-transparent rounded-full"></div>
			</div>
		</template>

		<!-- Edit Modal -->
		<EditThoughtModal :thought="editingThought" :isOpen="editModalOpen" @close="handleEditClose" @saved="handleEditSaved" />

		<!-- Presentation Modal -->
		<PresentationModeThoughts :thought="presentingThought" :isOpen="!!presentingThought" @close="presentingThought = null" />
	</div>
</template>
