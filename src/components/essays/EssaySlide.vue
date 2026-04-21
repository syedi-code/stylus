<script setup lang="ts">
import { ref, computed } from 'vue';
import { formatMarkdown } from '../../lib/formatText';
import { useAutoFitFontSize } from '../../composables/useAutoFitFontSize';
import type { Thread } from '../../lib/api';

const props = defineProps<{
    text: string;
    preferredFontSize: number;
    justified: boolean;
    hyphenation: boolean;
    active: boolean;
    version?: number;
    latestThread: Thread | null;
    current: number;
    total: number;
}>();

const emit = defineEmits<{
    (e: 'navigateToThread', threadId: string): void;
}>();

const containerRef = ref<HTMLElement | null>(null);
const textRef = ref<HTMLElement | null>(null);

const preferred = computed(() => props.preferredFontSize);
const { fittedSize } = useAutoFitFontSize(containerRef, textRef, preferred);

const lineHeight = computed(() => {
    const t = Math.min(1, Math.max(0, (fittedSize.value - 12) / 12));
    return +(1.45 - t * 0.1).toFixed(2);
});

const html = computed(() => formatMarkdown(props.text));
</script>

<template>
    <div
        ref="containerRef"
        class="w-full h-full flex items-center justify-center overflow-y-auto overscroll-contain"
    >
        <div class="w-full max-w-xl px-6 sm:px-8 py-4 flex flex-col gap-4">
            <!-- Badge row: ESSAY + in {thread} -->
            <div class="flex items-center gap-2 flex-wrap">
                <span class="bg-essay text-essay-text px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.06em] leading-[1.5]">
                    essay
                </span>
                <span v-if="version && version > 1" class="bg-gold text-gold-text px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.06em] leading-[1.5]">
                    v{{ version }}
                </span>
                <button
                    v-if="latestThread"
                    @click.stop="emit('navigateToThread', latestThread.id)"
                    class="inline-flex items-baseline gap-1 cursor-pointer group/thread min-w-0"
                >
                    <span class="text-[10.5px] italic text-mono-500 group-hover/thread:text-mono-400 transition-colors">in</span>
                    <span class="text-[11.5px] font-medium text-thread-muted group-hover/thread:text-thread transition-colors truncate">{{ latestThread.name }}</span>
                </button>
            </div>

            <!-- Text -->
            <div
                ref="textRef"
                class="typography-prose text-mono-100 select-text"
                :class="{ 'opacity-100': active, 'opacity-95': !active }"
                :style="{
                    fontSize: fittedSize + 'px',
                    lineHeight: lineHeight,
                    textAlign: justified ? 'justify' : 'left',
                    hyphens: hyphenation ? 'auto' : 'none',
                }"
                v-html="html"
            ></div>

            <!-- Counter immediately below body -->
            <div class="text-center">
                <span class="font-mono text-[11px] text-gold tracking-[0.12em]">{{ current + 1 }} / {{ total }}</span>
            </div>
        </div>
    </div>
</template>
