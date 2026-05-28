<script setup lang="ts">
import { ref, computed } from 'vue';
import { formatMarkdown } from '../../lib/formatText';
import { useAutoFitFontSize } from '../../composables/useAutoFitFontSize';

const props = defineProps<{
    text: string;
    preferredFontSize: number;
    justified: boolean;
    hyphenation: boolean;
    active: boolean;
    version?: number;
    /** First-line `# Header` of the essay, surfaced next to the ESSAY badge. */
    essayHeader?: string | null;
    current: number;
    total: number;
}>();

const containerRef = ref<HTMLElement | null>(null);
const textRef = ref<HTMLElement | null>(null);

const preferred = computed(() => props.preferredFontSize);
const { fittedSize } = useAutoFitFontSize(containerRef, textRef, preferred);

const lineHeight = computed(() => {
    const t = Math.min(1, Math.max(0, (fittedSize.value - 12) / 12));
    return +(1.35 - t * 0.15).toFixed(2);
});

const html = computed(() => formatMarkdown(props.text));
</script>

<template>
    <div
        ref="containerRef"
        class="w-full h-full flex items-center justify-center overflow-y-auto overscroll-contain"
    >
        <div class="w-full max-w-xl px-6 sm:px-8 py-4 flex flex-col gap-4 -translate-y-[2vh]">
            <!-- Badge row: ESSAY · {first-line header, if any} -->
            <div class="flex items-center gap-2 flex-wrap">
                <span class="bg-essay text-essay-text px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.06em] leading-[1.5]">
                    essay
                </span>
                <span v-if="version && version > 1" class="bg-gold text-gold-text px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.06em] leading-[1.5]">
                    v{{ version }}
                </span>
                <span v-if="essayHeader" class="inline-flex items-baseline gap-1 min-w-0">
                    <span class="text-mono-500">·</span>
                    <span class="font-body italic font-semibold text-[12.5px] text-essay tracking-[-0.005em] truncate">{{ essayHeader }}</span>
                </span>
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
        </div>
    </div>
</template>
