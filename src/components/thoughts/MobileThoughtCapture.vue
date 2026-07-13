<script setup lang="ts">
import { ref, nextTick, watch, computed, onUnmounted } from 'vue';
import { createThought } from '../../lib/api';
import { useMoodAutocomplete } from '../../composables/useMoodAutocomplete';

const props = defineProps<{
	isOpen: boolean;
}>();

const emit = defineEmits(['close', 'saved']);

const { getSuggestions, addCustomMood, suggestions: quickMoods, suggestionsLoading: quickMoodsLoading, refreshSuggestions } = useMoodAutocomplete();

const draft = ref('');
const textareaRef = ref<HTMLTextAreaElement | null>(null);
const loading = ref(false);
const sent = ref(false);

// Mood state
const moodScore = ref<number | null>(null);
const moodTags = ref<string[]>([]);
const showMoodPicker = ref(false);
const moodInput = ref('');

// Emoji mapping for mood score
const moodEmojis = ['😢', '😔', '😕', '😐', '🙂', '😊', '😄', '😁', '🤩', '🥳'];

const currentEmoji = computed(() => {
	if (moodScore.value === null) return '🫥';
	return moodEmojis[moodScore.value - 1] || '🫥';
});

// Filtered suggestions
const filteredSuggestions = computed(() => {
	return getSuggestions(moodInput.value, moodTags.value);
});

// Focus textarea when opened
watch(() => props.isOpen, async (isOpen) => {
	if (isOpen) {
		document.body.style.overflow = 'hidden';
		await nextTick();
		textareaRef.value?.focus();
		// Refresh quick mood suggestions on open
		refreshSuggestions(8);
	} else {
		document.body.style.overflow = '';
		// Reset mood picker on close
		showMoodPicker.value = false;
	}
});

onUnmounted(() => {
	document.body.style.overflow = '';
});

const addMoodTag = (tag: string) => {
	const normalized = tag.toLowerCase().trim();
	if (normalized && !moodTags.value.includes(normalized)) {
		moodTags.value = [...moodTags.value, normalized];
		addCustomMood(normalized);
	}
	moodInput.value = '';
};

const removeMoodTag = (tag: string) => {
	moodTags.value = moodTags.value.filter(t => t !== tag);
};

const selectMoodScore = (score: number) => {
	moodScore.value = score;
	// Haptic-like feedback via brief scale animation handled by CSS
};

const submit = async () => {
	if (!draft.value.trim() || loading.value) return;

	loading.value = true;
	sent.value = false;

	try {
		await createThought({
			content: draft.value.trim(),
			mood_score: moodScore.value ?? undefined,
			mood_tags: moodTags.value.length > 0 ? moodTags.value : undefined,
		});

		sent.value = true;
		draft.value = '';
		moodScore.value = null;
		moodTags.value = [];

		// Brief success feedback then close
		setTimeout(() => {
			sent.value = false;
			emit('saved');
			emit('close');
		}, 600);

	} catch (e) {
		console.error(e);
		alert('Failed to save thought.');
	} finally {
		loading.value = false;
	}
};

const handleClose = () => {
	draft.value = '';
	moodScore.value = null;
	moodTags.value = [];
	showMoodPicker.value = false;
	emit('close');
};
</script>

<template>
	<Teleport to="body">
		<Transition name="modal">
			<div v-if="isOpen" class="fixed inset-0 z-50 bg-mono-950 flex flex-col">
				<!-- Header -->
				<div class="flex items-center justify-between px-4 py-3 border-b border-rose/20 shrink-0 bg-rose/5">
					<button @click="handleClose" class="p-2 -ml-2 text-rose-bright/70 active:text-rose-bright transition-colors cursor-pointer" :disabled="loading" aria-label="Close">
						<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<path d="M18 6 6 18" />
							<path d="m6 6 12 12" />
						</svg>
					</button>

					<!-- Mood indicator/toggle in center -->
					<button @click="showMoodPicker = !showMoodPicker" class="flex items-center gap-2 px-4 py-2 rounded-full transition-all text-sm font-medium active:scale-95 cursor-pointer" :class="showMoodPicker ? 'bg-rose text-white' : 'bg-rose/20 text-rose-bright'">
						<span class="text-xl">{{ currentEmoji }}</span>
						<span class="text-xs uppercase tracking-wide">{{ moodScore ? `${moodScore}/10` : 'Mood'
						}}</span>
					</button>

					<button @click="submit" :disabled="loading || !draft.trim()" class="px-4 py-2 text-sm font-bold transition-all disabled:opacity-50 rounded-lg active:scale-95 cursor-pointer" :class="sent ? 'text-emerald-400 bg-emerald-500/20' : 'text-rose-bright bg-rose/20 active:bg-rose/30'">
						{{ loading ? '...' : sent ? '✨' : 'Post' }}
					</button>
				</div>

				<!-- Mood Picker Panel -->
				<Transition name="slide">
					<div v-if="showMoodPicker" class="border-b border-rose/20 bg-rose/5 overflow-hidden">
						<!-- Emoji Mood Selector -->
						<div class="p-4">
							<p class="text-xs text-mono-500 uppercase tracking-wide mb-3 text-center">How are you
								feeling?</p>
							<div class="flex justify-center gap-1 flex-wrap">
								<button v-for="(emoji, index) in moodEmojis" :key="index" @click="selectMoodScore(index + 1)" class="w-12 h-12 text-2xl rounded-xl transition-all active:scale-90 cursor-pointer" :class="moodScore === index + 1 ? 'bg-rose scale-110 shadow-lg shadow-rose/50' : 'bg-mono-800 hover:bg-mono-700'">
									{{ emoji }}
								</button>
							</div>
							<button v-if="moodScore !== null" @click="moodScore = null" class="mt-2 w-full text-xs text-mono-500 py-1 hover:text-rose-bright transition-colors cursor-pointer">
								Clear mood score
							</button>
						</div>

						<!-- Quick Mood Tags -->
						<div class="px-4 pb-4">
							<div class="flex items-center justify-between mb-2">
							<p class="text-xs text-mono-500 uppercase tracking-wide">Quick tags</p>
							<button @click="refreshSuggestions(8)" :disabled="quickMoodsLoading" class="p-1 rounded-md text-mono-500 hover:text-rose-bright hover:bg-rose/10 active:scale-90 transition-all cursor-pointer disabled:opacity-40" title="Shuffle suggestions">
								<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" :class="{ 'animate-spin': quickMoodsLoading }">
									<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
									<path d="M21 3v5h-5" />
								</svg>
							</button>
						</div>
							<div class="flex flex-wrap gap-2">
								<button v-for="mood in quickMoods" :key="mood" @click="addMoodTag(mood)" :disabled="moodTags.includes(mood)" class="px-3 py-1.5 text-xs rounded-full transition-all active:scale-95 disabled:opacity-30 cursor-pointer" :class="moodTags.includes(mood) ? 'bg-rose text-white' : 'bg-mono-800 text-mono-300 hover:bg-rose/30 hover:text-rose-bright'">
									{{ mood }}
								</button>
							</div>

							<!-- Selected Tags -->
							<div v-if="moodTags.length > 0" class="flex flex-wrap gap-2 mt-3">
								<span v-for="tag in moodTags" :key="tag" class="inline-flex items-center gap-1 px-2 py-1 bg-rose/30 text-rose-bright text-xs rounded-full">
									{{ tag }}
									<button @click="removeMoodTag(tag)" class="hover:text-white ml-0.5 cursor-pointer">×</button>
								</span>
							</div>

							<!-- Custom tag input -->
							<div class="mt-3">
								<input v-model="moodInput" @keydown.enter.prevent="addMoodTag(moodInput)" type="text" placeholder="Add custom mood..." class="w-full px-3 py-2 bg-mono-900 border border-mono-700 rounded-lg text-sm text-mono-100 placeholder:text-mono-600 focus:outline-none focus:border-rose" />
								<div v-if="moodInput && filteredSuggestions.length > 0" class="flex flex-wrap gap-1 mt-2">
									<button v-for="suggestion in filteredSuggestions.slice(0, 5)" :key="suggestion" @click="addMoodTag(suggestion)" class="px-2 py-1 text-xs bg-mono-800 text-mono-400 rounded-full hover:bg-rose/20 hover:text-rose-bright transition-colors cursor-pointer">
										{{ suggestion }}
									</button>
								</div>
							</div>
						</div>
					</div>
				</Transition>

				<!-- Content -->
				<div class="flex-1 p-4 overflow-y-auto">
					<div class="relative h-full">
						<textarea ref="textareaRef" v-model="draft" class="w-full h-full min-h-40 bg-transparent text-mono-100 focus:outline-none resize-none text-lg leading-[var(--content-leading)] placeholder:text-mono-500" placeholder="What's on your mind? 💭" :disabled="loading"></textarea>
					</div>
				</div>

				<!-- Footer -->
				<div class="px-4 py-3 border-t border-rose/20 shrink-0 pb-safe bg-rose/5">
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-2">
							<span class="w-2 h-2 rounded-full animate-pulse" :class="draft ? 'bg-rose' : 'bg-mono-600'"></span>
							<span class="text-xs text-mono-500">{{ draft ? 'Draft' : 'Ready' }}</span>
						</div>
					</div>
				</div>
			</div>
		</Transition>
	</Teleport>
</template>

<style scoped>
.pb-safe {
	padding-bottom: max(0.75rem, env(safe-area-inset-bottom));
}

.modal-enter-active,
.modal-leave-active {
	transition: opacity 0.2s ease, transform 0.2s ease;
}

.modal-enter-from {
	opacity: 0;
	transform: translateY(100%);
}

.modal-leave-to {
	opacity: 0;
	transform: translateY(20px);
}

.slide-enter-active,
.slide-leave-active {
	transition: all 0.25s ease;
	max-height: 400px;
}

.slide-enter-from,
.slide-leave-to {
	opacity: 0;
	max-height: 0;
	padding-top: 0;
	padding-bottom: 0;
}
</style>
