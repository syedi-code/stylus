<script setup lang="ts">
import { computed, ref, onMounted } from 'vue';
import { fetchThreadsForEntity, type Thought, type Thread } from '../../lib/api';
import { formatMarkdown } from '../../lib/formatText';

const props = defineProps<{
	thought: Thought;
	isAdmin?: boolean;
}>();

const emit = defineEmits<{
	(e: 'delete', id: string): void;
	(e: 'edit', thought: Thought): void;
	(e: 'present', thought: Thought): void;
	(e: 'addToThread', thought: Thought): void;
	(e: 'navigateToThread', threadId: string): void;
}>();

const latestThread = ref<Thread | null>(null);

onMounted(async () => {
	try {
		const threads = await fetchThreadsForEntity('thought', props.thought.id);
		if (threads.length) {
			latestThread.value = threads.sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];
		}
	} catch {
		// threads may not exist
	}
});

// Emoji mapping for mood score
const moodEmojis = ['😢', '😔', '😕', '😐', '🙂', '😊', '😄', '😁', '🤩', '🥳'];

const moodEmoji = computed(() => {
	if (props.thought.mood_score === undefined || props.thought.mood_score === null) return null;
	return moodEmojis[props.thought.mood_score - 1] || null;
});

const formattedDate = computed(() => {
	const date = new Date(props.thought.created_at);
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffMins = Math.floor(diffMs / 60000);
	const diffHours = Math.floor(diffMins / 60);
	const diffDays = Math.floor(diffHours / 24);

	if (diffMins < 1) return 'Just now';
	if (diffMins < 60) return `${diffMins}m ago`;
	if (diffHours < 24) return `${diffHours}h ago`;
	if (diffDays < 7) return `${diffDays}d ago`;

	return date.toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric',
		year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
	});
});

const formattedTime = computed(() => {
	const date = new Date(props.thought.created_at);
	return date.toLocaleTimeString('en-US', {
		timeZone: 'America/Los_Angeles',
		hour: 'numeric',
		minute: '2-digit',
		hour12: true
	});
});

const formattedContent = computed(() => formatMarkdown(props.thought.content));

const handleCopy = async () => {
	await navigator.clipboard.writeText(props.thought.content);
};
</script>

<template>
	<div class="group relative bg-mono-900 border border-rose/20 hover:border-rose/40 rounded-xl p-4 transition-all duration-200 hover:shadow-lg hover:shadow-rose/10 cursor-pointer" @click="emit('present', thought)">
		<!-- Thread link (top-left, only when in a thread) -->
		<button v-if="latestThread" @click.stop="emit('navigateToThread', latestThread.id)" class="inline-flex items-baseline gap-1 cursor-pointer group/thread self-start mb-4">
			<span class="text-[10.5px] italic text-mono-500 group-hover/thread:text-mono-400 transition-colors">in</span>
			<span class="text-[11.5px] font-medium text-purple-400/45 group-hover/thread:text-purple-400 transition-colors max-w-[240px] truncate">{{ latestThread.name }}</span>
		</button>
		<!-- Content -->
		<p class="typography-prose text-mono-100 text-sm leading-[1.25] whitespace-pre-wrap wrap-break-word" v-html="formattedContent"></p>

		<!-- Mood Display -->
		<div v-if="moodEmoji || (thought.mood_tags && thought.mood_tags.length > 0)" class="flex items-center gap-2 mt-3 flex-wrap">
			<!-- Mood Score Emoji + Number -->
			<span v-if="moodEmoji" class="inline-flex items-center gap-1 text-lg" :title="`Mood: ${thought.mood_score}/10`">
				{{ moodEmoji }}
				<span class="text-xs font-mono text-rose">{{ thought.mood_score }}/10</span>
			</span>

			<!-- Mood Tags -->
			<span v-for="tag in thought.mood_tags" :key="tag" class="px-2 py-0.5 text-xs bg-rose/15 text-rose-bright rounded-full border border-rose/20">
				{{ tag }}
			</span>
		</div>

		<!-- Footer -->
		<div class="flex items-center justify-between mt-3 pt-3 border-t border-mono-800">
			<div class="flex items-center gap-2 flex-wrap flex-1">
				<span class="text-xs text-mono-500">{{ formattedDate }} · {{ formattedTime }}</span>
			</div>

			<!-- Actions -->
			<div class="flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
				<button @click.stop="emit('present', thought)" class="p-1.5 text-mono-500 hover:text-rose-bright transition-colors rounded-lg hover:bg-rose/10 cursor-pointer" title="Present">
					<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M15 3h6v6" />
						<path d="M10 14 21 3" />
						<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
					</svg>
				</button>
				<button @click.stop="emit('edit', thought)" class="p-1.5 text-mono-500 hover:text-rose-bright transition-colors rounded-lg hover:bg-rose/10 cursor-pointer" title="Edit">
					<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
						<path d="m15 5 4 4" />
					</svg>
				</button>
				<button @click.stop="handleCopy" class="p-1.5 text-mono-500 hover:text-rose-bright transition-colors rounded-lg hover:bg-rose/10 cursor-pointer" title="Copy">
					<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
						<path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
					</svg>
				</button>
				<button @click.stop="emit('addToThread', thought)" class="p-1.5 text-mono-500 hover:text-purple-400 transition-colors rounded-lg hover:bg-purple-500/10 cursor-pointer" title="Add to Thread">
					<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8Z" />
						<path d="M12 8v8" /><path d="M8 12h8" />
					</svg>
				</button>
				<button @click.stop="emit('delete', thought.id)" class="p-1.5 text-mono-500 hover:text-red-400 transition-colors rounded-lg hover:bg-red-500/10 cursor-pointer" title="Delete">
					<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M3 6h18" />
						<path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
						<path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
					</svg>
				</button>
			</div>
		</div>
	</div>
</template>
