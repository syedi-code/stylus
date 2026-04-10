<script setup lang="ts">
defineProps<{
    fontSize: number;
    min: number;
    max: number;
    step: number;
    color?: 'accent' | 'rose' | 'essay';
}>();

const emit = defineEmits<{
    change: [size: number];
    reset: [];
}>();
</script>

<template>
    <div
        class="flex items-center gap-3 w-[70vw] max-w-xs mx-auto mt-8 shrink-0"
        :class="color === 'rose' ? 'font-controls-rose' : color === 'essay' ? 'font-controls-essay' : 'font-controls-accent'"
        style="touch-action: manipulation"
        @click.stop
    >
        <!-- Small A label -->
        <span class="text-[10px] font-semibold opacity-40 select-none">A</span>

        <!-- Range slider -->
        <input
            type="range"
            :min="min"
            :max="max"
            :step="step"
            :value="fontSize"
            @input="emit('change', Number(($event.target as HTMLInputElement).value))"
            class="font-slider flex-1 h-[2px] appearance-none rounded-full outline-none cursor-pointer"
            aria-label="Font size"
        />

        <!-- Large A label -->
        <span class="text-lg font-semibold opacity-40 select-none">A</span>
    </div>
</template>

<style scoped>
/* Color theming via parent class */
.font-controls-accent {
    color: var(--color-accent-bright);
}
.font-controls-rose {
    color: var(--color-rose-bright);
}
.font-controls-essay {
    color: var(--color-essay-bright);
}

/* Track */
.font-controls-accent .font-slider {
    background: color-mix(in srgb, var(--color-accent) 25%, transparent);
}
.font-controls-rose .font-slider {
    background: color-mix(in srgb, var(--color-rose) 25%, transparent);
}
.font-controls-essay .font-slider {
    background: color-mix(in srgb, var(--color-essay) 25%, transparent);
}

/* Webkit thumb */
.font-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    border: none;
    cursor: pointer;
    box-shadow: 0 0 10px currentColor;
}
.font-controls-accent .font-slider::-webkit-slider-thumb {
    background: var(--color-accent-bright);
}
.font-controls-rose .font-slider::-webkit-slider-thumb {
    background: var(--color-rose-bright);
}
.font-controls-essay .font-slider::-webkit-slider-thumb {
    background: var(--color-essay-bright);
}
.font-slider::-webkit-slider-thumb:active {
    transform: scale(1.15);
}

/* Firefox thumb */
.font-slider::-moz-range-thumb {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    border: none;
    cursor: pointer;
    box-shadow: 0 0 10px currentColor;
}
.font-controls-accent .font-slider::-moz-range-thumb {
    background: var(--color-accent-bright);
}
.font-controls-rose .font-slider::-moz-range-thumb {
    background: var(--color-rose-bright);
}
.font-controls-essay .font-slider::-moz-range-thumb {
    background: var(--color-essay-bright);
}
.font-slider::-moz-range-thumb:active {
    transform: scale(1.15);
}

/* Firefox track */
.font-controls-accent .font-slider::-moz-range-track {
    height: 2px;
    background: color-mix(in srgb, var(--color-accent) 25%, transparent);
    border-radius: 9999px;
}
.font-controls-rose .font-slider::-moz-range-track {
    height: 2px;
    background: color-mix(in srgb, var(--color-rose) 25%, transparent);
    border-radius: 9999px;
}
.font-controls-essay .font-slider::-moz-range-track {
    height: 2px;
    background: color-mix(in srgb, var(--color-essay) 25%, transparent);
    border-radius: 9999px;
}
</style>
