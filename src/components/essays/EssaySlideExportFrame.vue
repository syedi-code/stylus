<script setup lang="ts">
import { computed } from 'vue';
import { formatMarkdown } from '../../lib/formatText';

const props = defineProps<{
    text: string;
    counter: string;
    fontSize?: number;
}>();

const html = computed(() => formatMarkdown(props.text));
const size = computed(() => props.fontSize ?? 38);
const lineHeight = computed(() => {
    const t = Math.min(1, Math.max(0, (size.value - 24) / 36));
    return +(1.4 - t * 0.1).toFixed(2);
});
</script>

<template>
    <div
        class="bg-mono-950 text-mono-100 flex flex-col"
        :style="{ width: '1080px', height: '1920px', padding: '120px 100px' }"
    >
        <div class="flex items-center justify-between" style="margin-bottom: 80px">
            <span
                class="bg-essay text-essay-text font-bold uppercase"
                style="font-size: 28px; padding: 10px 18px; letter-spacing: 0.08em; line-height: 1"
            >essay</span>
            <span
                class="text-mono-500 font-medium"
                style="font-size: 26px; letter-spacing: 0.06em"
            >{{ counter }}</span>
        </div>

        <div class="flex-1 flex items-center">
            <div
                class="typography-prose w-full"
                :style="{
                    fontSize: size + 'px',
                    lineHeight: lineHeight,
                    textAlign: 'left',
                }"
                v-html="html"
            ></div>
        </div>

        <div class="flex items-center justify-between" style="margin-top: 80px">
            <span
                class="text-mono-600"
                style="font-size: 22px; letter-spacing: 0.12em; text-transform: uppercase"
            >antisocial.media</span>
            <div class="h-[3px] bg-essay" style="width: 120px"></div>
        </div>
    </div>
</template>
