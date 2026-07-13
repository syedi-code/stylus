<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import type { Thought, Thread } from '../../lib/api';
import { fetchThreadsForEntity } from '../../lib/api';
import { formatMarkdown } from '../../lib/formatText';
import { usePresentationFontSize, FONT_SIZE_MIN, FONT_SIZE_MAX, FONT_SIZE_STEP } from '../../composables/usePresentationFontSize';
import { useTypography } from '../../composables/useTypography';
import { usePresentationJustify } from '../../composables/usePresentationJustify';
import { usePresentationHyphenation } from '../../composables/usePresentationHyphenation';
import { useAutoChrome } from '../../composables/useAutoChrome';
import PresentationFontControls from '../shared/PresentationFontControls.vue';
import PresentationChrome from '../shared/PresentationChrome.vue';

const props = defineProps<{
    thought: Thought | null;
    isOpen: boolean;
}>();

const emit = defineEmits<{
    (e: 'close'): void;
    (e: 'navigateToThread', threadId: string): void;
}>();

const showFontControls = ref(false);
const latestThread = ref<Thread | null>(null);

const VERTICAL_MARGIN = 12;

const contentLength = computed(() => props.thought?.content?.length ?? 0);
const { baseFontSize, typographyClass } = useTypography('thought', 'presentation', contentLength);

const { finalFontSize, setFontSize, reset } = usePresentationFontSize('thought', baseFontSize);

const { justified, toggle: toggleJustify } = usePresentationJustify('thought');
const { hyphenation, toggle: toggleHyphenation } = usePresentationHyphenation('thought');

// Auto-fading chrome (action buttons) — mirrors the essay deck via the shared
// useAutoChrome timer + PresentationChrome wrapper.
const { chromeVisible, poke } = useAutoChrome(2800);

const formattedContent = computed(() => {
    if (!props.thought) return '';
    return formatMarkdown(props.thought.content);
});

const formattedDate = computed(() => {
    if (!props.thought) return '';
    const date = new Date(props.thought.created_at);
    return date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
    });
});

const formattedTime = computed(() => {
    if (!props.thought) return '';
    const date = new Date(props.thought.created_at);
    return date.toLocaleTimeString('en-US', {
        timeZone: 'America/Los_Angeles',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    });
});

watch(() => props.isOpen, async (isOpen) => {
    if (isOpen && props.thought) {
        poke();
        try {
            const threads = await fetchThreadsForEntity('thought', props.thought.id);
            latestThread.value = threads.length
                ? threads.sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0]
                : null;
        } catch {
            latestThread.value = null;
        }
    } else {
        latestThread.value = null;
    }
});
</script>

<template>
    <Teleport to="body">
        <Transition name="presentation">
            <div v-if="isOpen && thought" class="fixed inset-0 z-50 flex flex-col items-center justify-center bg-mono-950 cursor-pointer" :style="{ paddingTop: VERTICAL_MARGIN + 'px', paddingBottom: VERTICAL_MARGIN + 'px' }" @click="emit('close')" @pointermove="poke" @touchstart.passive="poke">
                <!-- Auto-fading chrome: close + action buttons hide after inactivity. -->
                <PresentationChrome :visible="chromeVisible">
                <!-- Close button (mobile) -->
                <button @click="emit('close')" class="absolute top-3 right-3 z-10 p-2 text-mono-500 hover:text-mono-200 transition-colors cursor-pointer sm:hidden" aria-label="Close">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M18 6 6 18" />
                        <path d="m6 6 12 12" />
                    </svg>
                </button>

                <!-- Top-left controls -->
                <div class="absolute top-3 left-3 z-10 flex items-center gap-1">
                    <!-- Font size toggle button -->
                    <button @click.stop="showFontControls = !showFontControls" class="p-2 text-mono-500 hover:text-mono-200 transition-colors cursor-pointer" :class="showFontControls ? 'text-rose' : ''" aria-label="Toggle font size controls">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M4 7V4h16v3" />
                            <path d="M9 20h6" />
                            <path d="M12 4v16" />
                        </svg>
                    </button>

                    <!-- Justify toggle button -->
                    <button @click.stop="toggleJustify()" class="p-2 text-mono-500 hover:text-mono-200 transition-colors cursor-pointer" :class="justified ? 'text-rose' : ''" :aria-label="justified ? 'Disable justified text' : 'Enable justified text'">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M3 6h18" />
                            <path d="M3 12h18" />
                            <path d="M3 18h18" />
                        </svg>
                    </button>

                    <!-- Hyphenation toggle button -->
                    <button @click.stop="toggleHyphenation()" class="p-2 text-mono-500 hover:text-mono-200 transition-colors cursor-pointer" :class="hyphenation ? 'text-rose' : ''" :aria-label="hyphenation ? 'Disable hyphenation' : 'Enable hyphenation'">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M3 6h18" />
                            <path d="M3 12h8" />
                            <path d="M12 12h1.5" />
                            <path d="M3 18h18" />
                        </svg>
                    </button>
                </div>
                </PresentationChrome>

                <!-- Content card -->
                <div class="w-full max-w-xl flex flex-col overflow-y-auto px-6 sm:px-8" :style="{ maxHeight: `calc(100vh - ${VERTICAL_MARGIN * 2 + (showFontControls ? 80 : 0)}px)` }" @click.stop>

                    <!-- THOUGHT badge -->
                    <div class="mb-4 flex items-center gap-2">
                        <span class="bg-rose text-white px-2 pb-0.5 pt-1 text-xs font-bold uppercase tracking-wider rounded-sm">
                            Thought
                        </span>
                        <button v-if="latestThread" @click.stop="emit('navigateToThread', latestThread.id)" class="inline-flex items-baseline gap-1 cursor-pointer group/thread">
                            <span class="text-[10.5px] italic text-mono-500 group-hover/thread:text-mono-400 transition-colors">in</span>
                            <span class="text-[11.5px] font-medium text-thread-muted group-hover/thread:text-thread transition-colors max-w-[240px] truncate">{{ latestThread.name }}</span>
                        </button>
                    </div>

                    <!-- Content -->
                    <div class="flex-1 min-h-0">
                        <p :class="[typographyClass, 'whitespace-pre-wrap text-mono-100 wrap-break-word']" :style="{ fontSize: finalFontSize + 'px', lineHeight: 'var(--content-leading)', textAlign: justified ? 'justify' : 'left', hyphens: hyphenation ? 'auto' : 'none' }" v-html="formattedContent"></p>
                    </div>

                    <!-- Date footer -->
                    <div class="mt-4 pt-3 text-xs text-mono-500">
                        {{ formattedDate }} · {{ formattedTime }}
                    </div>
                </div>

                <!-- Font size controls -->
                <PresentationFontControls v-show="showFontControls" :fontSize="finalFontSize" :min="FONT_SIZE_MIN" :max="FONT_SIZE_MAX" :step="FONT_SIZE_STEP" color="rose" @change="setFontSize" @reset="reset" />
            </div>
        </Transition>
    </Teleport>
</template>

<style scoped>
.presentation-enter-active,
.presentation-leave-active {
    transition: opacity 0.15s ease;
}

.presentation-enter-from,
.presentation-leave-to {
    opacity: 0;
}
</style>
