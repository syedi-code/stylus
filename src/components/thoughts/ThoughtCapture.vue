<script setup lang="ts">
import { ref, nextTick, watch, onMounted, computed } from 'vue';
import { createThought } from '../../lib/api';
import { useThoughtDraft } from '../../composables/useThoughtDraft';
import { useMoodAutocomplete } from '../../composables/useMoodAutocomplete';

const emit = defineEmits(['saved']);

const { draft: content, moodScore, moodTags, clearDraft, hasDraft } = useThoughtDraft();
const { getSuggestions, addCustomMood, suggestions: quickSuggestions, suggestionsLoading: quickSuggestionsLoading, refreshSuggestions } = useMoodAutocomplete();

const textareaRef = ref<HTMLTextAreaElement | null>(null);
const loading = ref(false);
const sent = ref(false);
const showConfetti = ref(false);

// Mood tag input
const moodInput = ref('');
const showMoodSuggestions = ref(false);

// Emoji mapping for mood score
const moodEmojis = ['😢', '😔', '😕', '😐', '🙂', '😊', '😄', '😁', '🤩', '🥳'];

const currentEmoji = computed(() => {
	if (moodScore.value === null) return '🫥';
	return moodEmojis[moodScore.value - 1] || '🫥';
});

// Filtered suggestions based on current input
const filteredSuggestions = computed(() => {
	return getSuggestions(moodInput.value, moodTags.value);
});

// Auto-grow textarea
const autoGrow = () => {
	if (textareaRef.value) {
		textareaRef.value.style.height = 'auto';
		textareaRef.value.style.height = Math.max(120, Math.min(textareaRef.value.scrollHeight, 400)) + 'px';
	}
};

onMounted(() => {
	autoGrow();
});

watch(content, () => {
	nextTick(autoGrow);
});

const addMoodTag = (tag: string) => {
	const normalized = tag.toLowerCase().trim();
	if (normalized && !moodTags.value.includes(normalized)) {
		moodTags.value = [...moodTags.value, normalized];
		addCustomMood(normalized);
	}
	moodInput.value = '';
	selectedSuggestionIndex.value = -1;
	// Keep dropdown open - input still has focus
};

const removeMoodTag = (tag: string) => {
	moodTags.value = moodTags.value.filter(t => t !== tag);
};

const handleMoodInputBlur = () => {
	window.setTimeout(() => {
		showMoodSuggestions.value = false;
	}, 150);
};

// Track selected suggestion index for keyboard navigation
const selectedSuggestionIndex = ref(-1);

// Reset selection when input changes
watch(moodInput, () => {
	selectedSuggestionIndex.value = -1;
});

const handleMoodInputKeydown = (e: KeyboardEvent) => {
	// Ctrl+Enter - submit the form
	if (e.key === 'Enter' && e.ctrlKey) {
		e.preventDefault();
		showMoodSuggestions.value = false;
		submit();
		return;
	}

	// Comma delimiter - add tag
	if (e.key === ',' && moodInput.value.trim()) {
		e.preventDefault();
		addMoodTag(moodInput.value.replace(/,/g, ''));
		selectedSuggestionIndex.value = -1;
		return;
	}

	// Enter - add selected suggestion or current input
	if (e.key === 'Enter') {
		e.preventDefault();
		if (showMoodSuggestions.value && selectedSuggestionIndex.value >= 0 && selectedSuggestionIndex.value < filteredSuggestions.value.length) {
			addMoodTag(filteredSuggestions.value[selectedSuggestionIndex.value]);
		} else if (moodInput.value.trim()) {
			addMoodTag(moodInput.value);
		}
		selectedSuggestionIndex.value = -1;
		return;
	}

	// Arrow Down - navigate suggestions (only when dropdown is visible)
	if (e.key === 'ArrowDown' && showMoodSuggestions.value && filteredSuggestions.value.length > 0) {
		e.preventDefault();
		selectedSuggestionIndex.value = Math.min(
			selectedSuggestionIndex.value + 1,
			filteredSuggestions.value.length - 1
		);
		return;
	}

	// Arrow Up - navigate suggestions (only when dropdown is visible)
	if (e.key === 'ArrowUp' && showMoodSuggestions.value && filteredSuggestions.value.length > 0) {
		e.preventDefault();
		selectedSuggestionIndex.value = Math.max(selectedSuggestionIndex.value - 1, -1);
		return;
	}

	// Backspace - remove last tag when input is empty
	if (e.key === 'Backspace' && !moodInput.value && moodTags.value.length > 0) {
		moodTags.value = moodTags.value.slice(0, -1);
		return;
	}

	// Escape - close suggestions
	if (e.key === 'Escape') {
		showMoodSuggestions.value = false;
		selectedSuggestionIndex.value = -1;
		return;
	}
};

const triggerConfetti = () => {
	showConfetti.value = true;
	setTimeout(() => {
		showConfetti.value = false;
	}, 1000);
};

const submit = async () => {
	if (!content.value.trim()) return;
	loading.value = true;
	sent.value = false;

	try {
		await createThought({
			content: content.value.trim(),
			mood_score: moodScore.value ?? undefined,
			mood_tags: moodTags.value.length > 0 ? moodTags.value : undefined,
		});

		sent.value = true;
		triggerConfetti();
		clearDraft();

		setTimeout(() => {
			sent.value = false;
			emit('saved');
		}, 1500);

	} catch (e) {
		console.error(e);
		alert('Failed to capture thought.');
	} finally {
		loading.value = false;
	}
};
</script>

<template>
	<div class="w-full relative">
		<!-- Confetti burst -->
		<div v-if="showConfetti" class="absolute inset-0 pointer-events-none overflow-hidden z-50">
			<div v-for="i in 20" :key="i" class="confetti-particle" :style="{
				'--delay': `${Math.random() * 0.3}s`,
				'--x': `${Math.random() * 100}%`,
				'--rotation': `${Math.random() * 360}deg`,
				'--color': ['#f43f5e', '#fb7185', '#fbbf24', '#34d399', '#60a5fa'][Math.floor(Math.random() * 5)]
			}"></div>
		</div>

		<!-- Draft indicator -->
		<div v-if="hasDraft() && !content" class="mb-3 text-xs text-rose-bright bg-rose/10 border border-rose/30 px-3 py-2 rounded-lg">
			💭 Draft restored from previous session
		</div>

		<div class="flex gap-4 items-start relative">
			<!-- Input Column -->
			<div class="grow flex flex-col gap-3 relative">
				<!-- Textarea Wrapper -->
				<div class="relative group">
					<textarea ref="textareaRef" v-model="content" @input="autoGrow" placeholder="What's on your mind?" class="thought-textarea relative w-full bg-mono-900 border-2 border-rose/30 rounded-xl p-4 min-h-30 text-white focus:outline-none focus:border-rose transition-all duration-300 ease-out resize-none text-sm leading-[var(--content-leading)] placeholder:text-mono-500 block shadow-xl z-10 origin-center" :class="[
						sent ? 'bg-rose/20! border-rose! text-white! shadow-[0_0_40px_rgba(244,63,94,0.4)] scale-[0.98]' : '',
						content ? 'border-rose/50' : ''
					]" @keydown.enter.ctrl="submit"></textarea>
				</div>

				<!-- Mood Score Slider -->
				<div class="flex items-center gap-3 px-2">
					<span class="text-xs text-mono-500 uppercase tracking-wide">Mood</span>
					<div class="flex-1 flex items-center gap-2">
						<button @click="moodScore = null" class="text-xl transition-transform hover:scale-125 active:scale-90 cursor-pointer" :class="moodScore === null ? 'opacity-100' : 'opacity-40'" title="Clear mood">
							🫥
						</button>
						<input type="range" min="1" max="10" :value="moodScore ?? 5" @input="moodScore = Number(($event.target as HTMLInputElement).value)" class="mood-slider flex-1 h-2 rounded-full appearance-none cursor-pointer" />
						<span class="text-2xl transition-all duration-300">
							{{ currentEmoji }}
						</span>
					</div>
					<span v-if="moodScore !== null" class="text-sm font-mono text-rose">{{ moodScore }}/10</span>
				</div>

				<!-- Quick Mood Suggestions -->
				<div v-if="quickSuggestions.length > 0" class="flex items-center gap-2 px-2 flex-wrap">
					<button v-for="mood in quickSuggestions" :key="mood" @click="addMoodTag(mood)" :disabled="moodTags.includes(mood)" class="px-2 py-1 text-xs rounded-full transition-all active:scale-95 cursor-pointer disabled:opacity-30" :class="moodTags.includes(mood) ? 'bg-rose text-white' : 'bg-mono-800 text-mono-400 hover:bg-rose/20 hover:text-rose-bright'">
						{{ mood }}
					</button>
					<button @click="refreshSuggestions()" :disabled="quickSuggestionsLoading" class="p-1 rounded-md text-mono-500 hover:text-rose-bright hover:bg-rose/10 active:scale-90 transition-all cursor-pointer disabled:opacity-40" title="Shuffle suggestions">
						<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" :class="{ 'animate-spin': quickSuggestionsLoading }">
							<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
							<path d="M21 3v5h-5" />
						</svg>
					</button>
				</div>

				<!-- Mood Tags -->
				<div class="relative px-2">
					<div class="flex flex-wrap gap-2 items-center p-2 bg-mono-900 border border-mono-800 rounded-lg min-h-10 focus-within:border-rose transition-colors">
						<!-- Existing tags -->
						<span v-for="tag in moodTags" :key="tag" class="inline-flex items-center gap-1 px-2 py-1 bg-rose/20 text-rose-bright text-xs rounded-full border border-rose/30 animate-pop-in">
							{{ tag }}
							<button @click="removeMoodTag(tag)" class="hover:text-white transition-colors ml-0.5 leading-none cursor-pointer">×</button>
						</span>

						<!-- Input -->
						<input v-model="moodInput" @focus="showMoodSuggestions = true" @blur="handleMoodInputBlur" @keydown="handleMoodInputKeydown" type="text" placeholder="Add mood tags..." class="flex-1 min-w-24 bg-transparent text-sm text-mono-100 placeholder:text-mono-600 focus:outline-none" />
					</div>

					<!-- Suggestions dropdown -->
					<Transition name="dropdown">
						<div v-if="showMoodSuggestions && filteredSuggestions.length > 0" class="mood-dropdown absolute top-full left-0 right-0 mt-1 bg-mono-900 border border-mono-700 rounded-lg shadow-xl z-20 overflow-hidden max-h-60 overflow-y-auto">
							<button v-for="(suggestion, index) in filteredSuggestions" :key="suggestion" @mousedown.prevent="addMoodTag(suggestion)" class="w-full px-3 py-2 text-left text-sm text-mono-300 hover:bg-rose/20 hover:text-rose-bright transition-colors cursor-pointer" :class="{ 'bg-rose/20 text-rose-bright': index === selectedSuggestionIndex }">
								{{ suggestion }}
							</button>
						</div>
					</Transition>
				</div>

				<!-- Footer -->
				<div class="flex justify-between items-center text-xs text-mono-500 uppercase tracking-wider px-2 z-10 select-none">
					<div class="flex items-center gap-3">
						<span class="flex items-center gap-1.5">
							<span class="w-2 h-2 rounded-full animate-pulse" :class="content ? 'bg-rose' : 'bg-mono-600'"></span>
							{{ content.length > 0 ? 'Draft saved' : 'Web Capture' }}
						</span>
					</div>
					<span class="hidden sm:inline text-mono-600">Ctrl+Enter</span>
				</div>

				<!-- Submit Button -->
				<button @click="submit" :disabled="loading || !content.trim()" class="w-full py-3 px-4 bg-rose hover:bg-rose-bright active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer text-white font-medium rounded-xl transition-all duration-200 shadow-lg shadow-rose/30 hover:shadow-rose/50 flex items-center justify-center gap-2">
					<span v-if="loading" class="animate-spin">🌀</span>
					<span v-else-if="sent">Sent!</span>
					<span v-else>Send thought.</span>
				</button>
			</div>
		</div>
	</div>
</template>

<style scoped>
/* Mood slider custom styles */
.mood-slider {
	background: linear-gradient(to right, var(--color-rose-muted), var(--color-rose), var(--color-rose-bright));
}

.mood-slider::-webkit-slider-thumb {
	appearance: none;
	width: 20px;
	height: 20px;
	border-radius: 50%;
	background: var(--color-rose);
	cursor: pointer;
	box-shadow: 0 0 10px rgba(244, 63, 94, 0.5);
	transition: transform 0.2s, box-shadow 0.2s;
}

.mood-slider::-webkit-slider-thumb:hover {
	transform: scale(1.2);
	box-shadow: 0 0 20px rgba(244, 63, 94, 0.7);
}

.mood-slider::-moz-range-thumb {
	width: 20px;
	height: 20px;
	border-radius: 50%;
	background: var(--color-rose);
	cursor: pointer;
	border: none;
	box-shadow: 0 0 10px rgba(244, 63, 94, 0.5);
}

/* Pop-in animation for tags */
@keyframes pop-in {
	0% {
		transform: scale(0);
		opacity: 0;
	}

	70% {
		transform: scale(1.1);
	}

	100% {
		transform: scale(1);
		opacity: 1;
	}
}

.animate-pop-in {
	animation: pop-in 0.2s ease-out;
}

/* Wiggle animation for submit button */
@keyframes wiggle {

	0%,
	100% {
		transform: rotate(0deg);
	}

	25% {
		transform: rotate(-1deg);
	}

	75% {
		transform: rotate(1deg);
	}
}

.animate-wiggle:hover {
	animation: wiggle 0.3s ease-in-out;
}

/* Confetti particles */
.confetti-particle {
	position: absolute;
	width: 10px;
	height: 10px;
	background: var(--color);
	left: var(--x);
	top: 50%;
	border-radius: 2px;
	animation: confetti-fall 1s ease-out forwards;
	animation-delay: var(--delay);
	transform: rotate(var(--rotation));
}

@keyframes confetti-fall {
	0% {
		opacity: 1;
		transform: translateY(0) rotate(0deg) scale(1);
	}

	100% {
		opacity: 0;
		transform: translateY(-200px) rotate(720deg) scale(0);
	}
}

/* Dropdown transition */
.dropdown-enter-active,
.dropdown-leave-active {
	transition: all 0.15s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
	opacity: 0;
	transform: translateY(-8px);
}

/* Hide scrollbar but keep functionality */
.mood-dropdown {
	scrollbar-width: none;
	/* Firefox */
	-ms-overflow-style: none;
	/* IE/Edge */
}

.mood-dropdown::-webkit-scrollbar {
	display: none;
	/* Chrome/Safari/Opera */
}

/* Textarea focus glow */
.thought-textarea:focus {
	box-shadow: 0 0 0 3px rgba(244, 63, 94, 0.2), 0 0 30px rgba(244, 63, 94, 0.15);
}
</style>
