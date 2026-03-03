<script setup lang="ts">
import { ref, watch, nextTick, computed } from 'vue';
import type { Thought } from '../lib/api';
import { formatMarkdown } from '../lib/formatText';
import { usePresentationFontSize, FONT_SIZE_MIN, FONT_SIZE_MAX, FONT_SIZE_STEP } from '../composables/usePresentationFontSize';
import PresentationFontControls from './PresentationFontControls.vue';

const props = defineProps<{
    thought: Thought | null;
    isOpen: boolean;
}>();

const emit = defineEmits(['close']);

const contentRef = ref<HTMLElement | null>(null);
const cardRef = ref<HTMLElement | null>(null);
const fontSize = ref(18);
const showFontControls = ref(false);

const VERTICAL_MARGIN = 12;

const { finalFontSize, setFontSize, reset } = usePresentationFontSize('thought', fontSize);

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

const calculateFontSize = async () => {
    if (window.innerWidth >= 640) {
        fontSize.value = 18;
        return;
    }

    await nextTick();

    if (!contentRef.value || !cardRef.value) return;

    const availableHeight = window.innerHeight - (VERTICAL_MARGIN * 2) - 48 - 80;

    let min = 12;
    let max = 18;
    let optimal = 14;

    fontSize.value = max;
    await nextTick();

    while (min <= max) {
        const mid = Math.floor((min + max) / 2);
        fontSize.value = mid;
        await nextTick();

        const contentHeight = contentRef.value.scrollHeight;

        if (contentHeight <= availableHeight) {
            optimal = mid;
            min = mid + 1;
        } else {
            max = mid - 1;
        }
    }

    fontSize.value = optimal;
};

watch(() => props.isOpen, (isOpen) => {
    if (isOpen) {
        calculateFontSize();
    }
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
                <div ref="cardRef" class="w-full max-w-xl bg-mono-900 border border-rose/30 rounded-xl p-6 shadow-2xl overflow-hidden flex flex-col" :style="{ maxHeight: `calc(100vh - ${VERTICAL_MARGIN * 2 + (showFontControls ? 80 : 0)}px)` }" @click.stop>

                    <!-- THOUGHT badge -->
                    <div class="mb-4">
                        <span class="bg-rose text-white px-2 pb-0.5 pt-1 text-xs font-bold uppercase tracking-wider rounded-sm">
                            Thought
                        </span>
                    </div>

                    <!-- Content -->
                    <div ref="contentRef" class="flex-1 min-h-0">
                        <p class="whitespace-pre-wrap leading-relaxed text-mono-100 break-words" :style="{ fontSize: finalFontSize + 'px' }" v-html="formattedContent"></p>
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
