<script setup lang="ts">
import { ref, watch, nextTick, computed, onMounted, onUnmounted } from 'vue';
import { MAX_LENGTHS } from '../../lib/contract';
import { updateThought, type Thought, type ThoughtInput } from '../../lib/api';
import { useMoodAutocomplete } from '../../composables/useMoodAutocomplete';

const props = defineProps<{
    thought: Thought | null;
    isOpen: boolean;
}>();

const emit = defineEmits(['close', 'saved']);

const { getSuggestions, addCustomMood } = useMoodAutocomplete();

const content = ref('');
const moodScore = ref<number | null>(null);
const moodTags = ref<string[]>([]);
const moodInput = ref('');
const showMoodSuggestions = ref(false);
const selectedSuggestionIndex = ref(-1);
const loading = ref(false);
const textareaRef = ref<HTMLTextAreaElement | null>(null);
const isMobile = ref(false);

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

// Reset selection when input changes
watch(moodInput, () => {
    selectedSuggestionIndex.value = -1;
});

// Detect mobile viewport
const checkMobile = () => {
    isMobile.value = window.innerWidth < 640;
};

onMounted(() => {
    checkMobile();
    window.addEventListener('resize', checkMobile);
});

onUnmounted(() => {
    window.removeEventListener('resize', checkMobile);
    document.body.style.overflow = '';
});

watch(() => props.thought, (newThought) => {
    if (newThought) {
        content.value = newThought.content;
        moodScore.value = newThought.mood_score ?? null;
        moodTags.value = [...(newThought.mood_tags ?? [])];
    }
});

watch(() => props.isOpen, async (isOpen) => {
    if (isOpen) {
        document.body.style.overflow = 'hidden';
        await nextTick();
        textareaRef.value?.focus();
    } else {
        document.body.style.overflow = '';
    }
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

const handleMoodInputKeydown = (e: KeyboardEvent) => {
    // Ctrl+Enter - save the form
    if (e.key === 'Enter' && e.ctrlKey) {
        e.preventDefault();
        showMoodSuggestions.value = false;
        save();
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

const close = () => {
    emit('close');
    content.value = '';
    moodScore.value = null;
    moodTags.value = [];
    moodInput.value = '';
};

const save = async () => {
    if (!props.thought || !content.value.trim()) return;

    loading.value = true;
    try {
        const input: Partial<ThoughtInput> = {
            content: content.value.trim(),
            mood_score: moodScore.value ?? undefined,
            mood_tags: moodTags.value.length > 0 ? moodTags.value : undefined,
        };

        const result = await updateThought(props.thought.id, input);
        emit('saved', result.thought);
        close();
    } catch (e) {
        console.error(e);
        alert('Failed to save edit.');
    } finally {
        loading.value = false;
    }
};

const charCount = computed(() => content.value.length);
</script>

<template>
    <!-- Mobile: Full-screen overlay -->
    <Teleport to="body">
        <Transition name="modal">
            <div v-if="isOpen && isMobile" class="fixed inset-0 z-50 bg-mono-950 flex flex-col">
                <!-- Header -->
                <div class="flex items-center justify-between px-4 py-3 border-b border-mono-800 shrink-0">
                    <button @click="close" class="px-3 py-2 text-sm font-medium text-mono-400 active:text-white transition-colors cursor-pointer" :disabled="loading">
                        Cancel
                    </button>
                    <h3 class="text-sm font-semibold text-white uppercase tracking-wide">Edit Thought</h3>
                    <button @click="save" :disabled="loading || !content.trim()" class="px-3 py-2 text-sm font-semibold text-rose active:text-rose-bright transition-colors disabled:opacity-50 cursor-pointer">
                        {{ loading ? 'Saving...' : 'Save' }}
                    </button>
                </div>

                <!-- Content -->
                <div class="flex-1 p-4 overflow-y-auto">
                    <div class="relative h-full flex flex-col gap-4">
                        <textarea ref="textareaRef" v-model="content" :maxlength="MAX_LENGTHS.CONTENT" class="w-full flex-1 min-h-40 bg-transparent text-mono-100 focus:outline-none resize-none text-base leading-[var(--content-leading)] placeholder:text-mono-600" placeholder="What's on your mind?" :disabled="loading"></textarea>

                        <!-- Mood Score Slider -->
                        <div class="flex items-center gap-3">
                            <span class="text-xs text-mono-500 uppercase tracking-wide">Mood</span>
                            <div class="flex-1 flex items-center gap-2">
                                <button @click="moodScore = null" class="text-xl transition-transform active:scale-90 cursor-pointer" :class="moodScore === null ? 'opacity-100' : 'opacity-40'" title="Clear mood">
                                    🫥
                                </button>
                                <input type="range" min="1" max="10" :value="moodScore ?? 5" @input="moodScore = Number(($event.target as HTMLInputElement).value)" class="mood-slider flex-1 h-2 rounded-full appearance-none cursor-pointer" />
                                <span class="text-2xl">{{ currentEmoji }}</span>
                            </div>
                            <span v-if="moodScore !== null" class="text-sm font-mono text-rose">{{ moodScore }}/10</span>
                        </div>

                        <!-- Mood Tags -->
                        <div class="relative">
                            <div class="flex flex-wrap gap-2 items-center p-2 bg-mono-900 border border-mono-800 rounded-lg min-h-10 focus-within:border-rose transition-colors">
                                <span v-for="tag in moodTags" :key="tag" class="inline-flex items-center gap-1 px-2 py-1 bg-rose/20 text-rose-bright text-xs rounded-full border border-rose/30">
                                    {{ tag }}
                                    <button @click="removeMoodTag(tag)" class="hover:text-white transition-colors ml-0.5 leading-none cursor-pointer">×</button>
                                </span>
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
                    </div>
                </div>

                <!-- Footer -->
                <div class="px-4 py-3 border-t border-mono-800 shrink-0 pb-safe">
                    <div class="text-xs text-mono-600 text-right">{{ charCount }} / {{ MAX_LENGTHS.CONTENT }}</div>
                </div>
            </div>
        </Transition>
    </Teleport>

    <!-- Desktop: Centered Modal -->
    <div v-if="isOpen && !isMobile" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/80 backdrop-blur-sm" @click="close"></div>

        <!-- Modal -->
        <div class="relative w-full max-w-2xl bg-mono-900 border border-rose/30 shadow-2xl rounded-xl p-5 flex flex-col gap-4">

            <h3 class="text-base font-semibold text-white uppercase tracking-wide">Edit Thought</h3>

            <div class="relative">
                <textarea ref="textareaRef" v-model="content" :maxlength="MAX_LENGTHS.CONTENT" class="w-full bg-mono-950 border border-mono-800 rounded-lg p-4 min-h-40 max-h-80 text-mono-100 focus:outline-none focus:border-rose focus:ring-1 focus:ring-rose resize-none text-sm leading-[var(--content-leading)]" placeholder="What's on your mind?" @keydown.ctrl.enter="save"></textarea>
                <div class="absolute bottom-3 right-3 text-xs text-mono-600">{{ charCount }} / {{ MAX_LENGTHS.CONTENT }}</div>
            </div>

            <!-- Mood Score Slider -->
            <div class="flex items-center gap-3 px-1">
                <span class="text-xs text-mono-500 uppercase tracking-wide">Mood</span>
                <div class="flex-1 flex items-center gap-2">
                    <button @click="moodScore = null" class="text-xl transition-transform hover:scale-125 active:scale-90 cursor-pointer" :class="moodScore === null ? 'opacity-100' : 'opacity-40'" title="Clear mood">
                        🫥
                    </button>
                    <input type="range" min="1" max="10" :value="moodScore ?? 5" @input="moodScore = Number(($event.target as HTMLInputElement).value)" class="mood-slider flex-1 h-2 rounded-full appearance-none cursor-pointer" />
                    <span class="text-2xl transition-all duration-300">{{ currentEmoji }}</span>
                </div>
                <span v-if="moodScore !== null" class="text-sm font-mono text-rose">{{ moodScore }}/10</span>
            </div>

            <!-- Mood Tags -->
            <div class="relative px-1">
                <div class="flex flex-wrap gap-2 items-center p-2 bg-mono-950 border border-mono-800 rounded-lg min-h-10 focus-within:border-rose transition-colors">
                    <span v-for="tag in moodTags" :key="tag" class="inline-flex items-center gap-1 px-2 py-1 bg-rose/20 text-rose-bright text-xs rounded-full border border-rose/30">
                        {{ tag }}
                        <button @click="removeMoodTag(tag)" class="hover:text-white transition-colors ml-0.5 leading-none cursor-pointer">×</button>
                    </span>
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

            <div class="flex items-center justify-between mt-2">
                <span class="text-xs text-mono-600">Ctrl+Enter to save</span>
                <div class="flex gap-2">
                    <button @click="close" class="px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-mono-400 hover:text-white transition-colors cursor-pointer">
                        Cancel
                    </button>
                    <button @click="save" :disabled="loading || !content.trim()" class="px-4 py-1.5 bg-rose hover:bg-rose-bright rounded-md text-white text-xs font-medium uppercase tracking-wide transition-colors disabled:opacity-50 cursor-pointer">
                        {{ loading ? 'Saving...' : 'Save Changes' }}
                    </button>
                </div>
            </div>

        </div>
    </div>
</template>

<style scoped>
.pb-safe {
    padding-bottom: max(0.75rem, env(safe-area-inset-bottom));
}

.modal-enter-active,
.modal-leave-active {
    transition: opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
    opacity: 0;
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
</style>
