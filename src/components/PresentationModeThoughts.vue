<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import type { Thought } from '../lib/api';
import { formatMarkdown } from '../lib/formatText';
import { usePresentationFontSize, FONT_SIZE_MIN, FONT_SIZE_MAX, FONT_SIZE_STEP } from '../composables/usePresentationFontSize';
import { useTypography } from '../composables/useTypography';
import PresentationFontControls from './PresentationFontControls.vue';

const props = defineProps<{
    thought: Thought | null;
    isOpen: boolean;
}>();

const emit = defineEmits(['close']);

const showFontControls = ref(false);

const VERTICAL_MARGIN = 12;

const contentLength = computed(() => props.thought?.content?.length ?? 0);
const { baseFontSize, lineHeightClass, typographyClass } = useTypography('thought', 'presentation', contentLength);

const { finalFontSize, setFontSize, reset } = usePresentationFontSize('thought', baseFontSize);

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

watch(() => props.isOpen, () => {
    // no-op — font size is now purely reactive via useTypography
});
</script>

<template>
    <Teleport to="body">
        <Transition name="presentation">
            <div v-if="isOpen && thought" class="fixed inset-0 z-50 flex flex-col items-center justify-center bg-mono-950 cursor-pointer" :style="{ padding: VERTICAL_MARGIN + 'px' }" @click="emit('close')">
                <!-- Close button (mobile) -->
                <button @click="emit('close')" class="absolute top-3 right-3 z-10 p-2 text-mono-500 hover:text-mono-200 transition-colors cursor-pointer sm:hidden" aria-label="Close">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M18 6 6 18" />
                        <path d="m6 6 12 12" />
                    </svg>
                </button>

                <!-- Font size toggle button -->
                <button @click.stop="showFontControls = !showFontControls" class="absolute top-3 left-3 z-10 p-2 text-mono-500 hover:text-mono-200 transition-colors cursor-pointer" :class="showFontControls ? 'text-rose' : ''" aria-label="Toggle font size controls">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M4 7V4h16v3" />
                        <path d="M9 20h6" />
                        <path d="M12 4v16" />
                    </svg>
                </button>

                <!-- Content card -->
                <div class="w-full max-w-xl bg-mono-900 border border-rose/30 rounded-xl p-6 shadow-2xl overflow-hidden flex flex-col" :style="{ maxHeight: `calc(100vh - ${VERTICAL_MARGIN * 2 + (showFontControls ? 80 : 0)}px)` }" @click.stop>

                    <!-- THOUGHT badge -->
                    <div class="mb-4">
                        <span class="bg-rose text-white px-2 pb-0.5 pt-1 text-xs font-bold uppercase tracking-wider rounded-sm">
                            Thought
                        </span>
                    </div>

                    <!-- Content -->
                    <div class="flex-1 min-h-0">
                        <p lang="en" :class="[typographyClass, lineHeightClass, 'whitespace-pre-wrap text-mono-100 wrap-break-word']" :style="{ fontSize: finalFontSize + 'px' }" v-html="formattedContent"></p>
                    </div>

                    <!-- Date footer -->
                    <div class="mt-4 pt-3 border-t border-mono-800 text-xs text-mono-500">
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
