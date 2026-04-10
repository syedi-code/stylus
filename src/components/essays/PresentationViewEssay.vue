<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import type { Essay, Thread } from '../../lib/api';
import { fetchThreadsForEntity } from '../../lib/api';
import { usePresentationFontSize, FONT_SIZE_MIN, FONT_SIZE_MAX, FONT_SIZE_STEP } from '../../composables/usePresentationFontSize';
import { usePresentationJustify } from '../../composables/usePresentationJustify';
import { usePresentationHyphenation } from '../../composables/usePresentationHyphenation';
import PresentationFontControls from '../shared/PresentationFontControls.vue';
import EssayReferenceChips from './EssayReferenceChips.vue';

const props = defineProps<{
  essay: Essay | null;
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'navigateToThread', threadId: string): void;
}>();

const showFontControls = ref(false);
const latestThread = ref<Thread | null>(null);

const baseFontSize = ref(14);
const { finalFontSize, setFontSize, reset } = usePresentationFontSize('essay', baseFontSize);

// Dynamic line-height: tightens as font size grows (per mockup: 1.30 base)
const lineHeight = computed(() => {
  const t = Math.min(1, Math.max(0, (finalFontSize.value - 12) / 12));
  return +(1.35 - t * 0.05).toFixed(2);
});

const { justified, toggle: toggleJustify } = usePresentationJustify('essay');
const { hyphenation, toggle: toggleHyphenation } = usePresentationHyphenation('essay');

watch(() => props.isOpen, async (isOpen) => {
  if (isOpen && props.essay) {
    try {
      const threads = await fetchThreadsForEntity('essay', props.essay.id);
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
      <div
        v-if="isOpen && essay"
        class="fixed inset-0 z-50 flex flex-col items-center justify-center bg-mono-950 cursor-pointer p-3"
        @click="emit('close')"
      >
        <!-- Close button (top-right, per mockup 02) -->
        <button @click="emit('close')" class="absolute top-3 right-3 z-10 p-2 text-mono-500 hover:text-mono-200 transition-colors cursor-pointer" aria-label="Close">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 6 6 18" /><path d="m6 6 12 12" />
          </svg>
        </button>

        <!-- Top-left controls (per mockup 02: font size, justify, hyphenation) -->
        <div class="absolute top-3 left-3 z-10 flex items-center gap-1">
          <!-- Font size toggle -->
          <button @click.stop="showFontControls = !showFontControls" class="p-2 text-mono-500 hover:text-mono-200 transition-colors cursor-pointer" :class="showFontControls ? 'text-essay' : ''" aria-label="Toggle font size controls">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 7V4h16v3" /><path d="M9 20h6" /><path d="M12 4v16" />
            </svg>
          </button>
          <!-- Justify toggle -->
          <button @click.stop="toggleJustify()" class="p-2 text-mono-500 hover:text-mono-200 transition-colors cursor-pointer" :class="justified ? 'text-essay' : ''">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 6h18" /><path d="M3 12h18" /><path d="M3 18h18" />
            </svg>
          </button>
          <!-- Hyphenation toggle -->
          <button @click.stop="toggleHyphenation()" class="p-2 text-mono-500 hover:text-mono-200 transition-colors cursor-pointer" :class="hyphenation ? 'text-essay' : ''">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 6h18" /><path d="M3 12h8" /><path d="M12 12h1.5" /><path d="M3 18h18" />
            </svg>
          </button>
        </div>

        <!-- Presentation content (per mockup 02: no card border, text on black, max-w-xl) -->
        <div class="w-full max-w-xl flex flex-col overflow-y-auto px-6 sm:px-4" :style="{ maxHeight: `calc(100vh - ${showFontControls ? 120 : 48}px)` }" @click.stop>

          <!-- Badge row (per mockup 02) -->
          <div class="mb-4 flex items-center gap-2">
            <span class="bg-essay text-essay-text px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.06em] leading-[1.5]">
              essay
            </span>
            <span v-if="essay.version && essay.version > 1" class="bg-gold text-gold-text px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.06em] leading-[1.5]">
              v{{ essay.version }}
            </span>
            <button v-if="latestThread" @click.stop="emit('navigateToThread', latestThread.id)" class="inline-flex items-baseline gap-1 cursor-pointer group/thread">
              <span class="text-[10.5px] italic text-mono-500 group-hover/thread:text-mono-400 transition-colors">in</span>
              <span class="text-[11.5px] font-medium text-thread-muted group-hover/thread:text-thread transition-colors max-w-[240px] truncate">{{ latestThread.name }}</span>
            </button>
          </div>

          <!-- Essay text (article-style reading margins, per mockup 02: line-height 1.30, old-style numerals, ligatures, text-indent on continuation paragraphs, text-wrap: pretty) -->
          <div
            class="typography-prose whitespace-pre-wrap text-mono-100"
            :style="{
              fontSize: finalFontSize + 'px',
              lineHeight: lineHeight,
              textAlign: justified ? 'justify' : 'left',
              hyphens: hyphenation ? 'auto' : 'none',
            }"
          >{{ essay.content }}</div>

          <!-- Reference chips (only if references exist) -->
          <div v-if="essay.references.length" class="mt-5">
            <EssayReferenceChips :references="essay.references" />
          </div>
        </div>

        <!-- Font size controls (essay amber accent) -->
        <PresentationFontControls v-show="showFontControls" :fontSize="finalFontSize" :min="FONT_SIZE_MIN" :max="FONT_SIZE_MAX" :step="FONT_SIZE_STEP" color="essay" @change="setFontSize" @reset="reset" />
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
