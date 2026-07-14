<script setup lang="ts">
defineProps<{
    darkness: number;
    min: number;
    max: number;
    step: number;
    color?: 'accent' | 'rose' | 'essay' | 'quote';
}>();

const emit = defineEmits<{
    change: [darkness: number];
    reset: [];
}>();
</script>

<template>
    <div
        class="flex items-center gap-3 w-[70vw] max-w-xs mx-auto mt-8 shrink-0"
        :class="color === 'rose' ? 'dark-controls-rose' : color === 'essay' ? 'dark-controls-essay' : color === 'quote' ? 'dark-controls-quote' : 'dark-controls-accent'"
        style="touch-action: manipulation"
        @click.stop
        @dblclick.stop="emit('reset')"
    >
        <!-- Sun (lighter) -->
        <svg class="opacity-40 select-none shrink-0" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>

        <!-- Range slider (higher = darker) -->
        <input
            type="range"
            :min="min"
            :max="max"
            :step="step"
            :value="darkness"
            @input="emit('change', Number(($event.target as HTMLInputElement).value))"
            class="dark-slider flex-1 h-[2px] appearance-none rounded-full outline-none cursor-pointer"
            aria-label="Texture darkness"
        />

        <!-- Moon (darker) -->
        <svg class="opacity-40 select-none shrink-0" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true">
            <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
    </div>
</template>

<style scoped>
/* Color theming via parent class (mirrors PresentationFontControls). */
.dark-controls-accent { color: var(--color-accent-bright); }
.dark-controls-rose { color: var(--color-rose-bright); }
.dark-controls-essay { color: var(--color-essay-bright); }
.dark-controls-quote { color: var(--color-quote-bright); }

/* Track */
.dark-controls-accent .dark-slider { background: color-mix(in srgb, var(--color-accent) 25%, transparent); }
.dark-controls-rose .dark-slider { background: color-mix(in srgb, var(--color-rose) 25%, transparent); }
.dark-controls-essay .dark-slider { background: color-mix(in srgb, var(--color-essay) 25%, transparent); }
.dark-controls-quote .dark-slider { background: color-mix(in srgb, var(--color-quote) 25%, transparent); }

/* Webkit thumb */
.dark-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    border: none;
    cursor: pointer;
    box-shadow: 0 0 10px currentColor;
}
.dark-controls-accent .dark-slider::-webkit-slider-thumb { background: var(--color-accent-bright); }
.dark-controls-rose .dark-slider::-webkit-slider-thumb { background: var(--color-rose-bright); }
.dark-controls-essay .dark-slider::-webkit-slider-thumb { background: var(--color-essay-bright); }
.dark-controls-quote .dark-slider::-webkit-slider-thumb { background: var(--color-quote-bright); }
.dark-slider::-webkit-slider-thumb:active { transform: scale(1.15); }

/* Firefox thumb */
.dark-slider::-moz-range-thumb {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    border: none;
    cursor: pointer;
    box-shadow: 0 0 10px currentColor;
}
.dark-controls-accent .dark-slider::-moz-range-thumb { background: var(--color-accent-bright); }
.dark-controls-rose .dark-slider::-moz-range-thumb { background: var(--color-rose-bright); }
.dark-controls-essay .dark-slider::-moz-range-thumb { background: var(--color-essay-bright); }
.dark-controls-quote .dark-slider::-moz-range-thumb { background: var(--color-quote-bright); }
.dark-slider::-moz-range-thumb:active { transform: scale(1.15); }

/* Firefox track */
.dark-controls-accent .dark-slider::-moz-range-track { height: 2px; background: color-mix(in srgb, var(--color-accent) 25%, transparent); border-radius: 9999px; }
.dark-controls-rose .dark-slider::-moz-range-track { height: 2px; background: color-mix(in srgb, var(--color-rose) 25%, transparent); border-radius: 9999px; }
.dark-controls-essay .dark-slider::-moz-range-track { height: 2px; background: color-mix(in srgb, var(--color-essay) 25%, transparent); border-radius: 9999px; }
.dark-controls-quote .dark-slider::-moz-range-track { height: 2px; background: color-mix(in srgb, var(--color-quote) 25%, transparent); border-radius: 9999px; }
</style>
