<script setup lang="ts">
import { computed } from 'vue';
import type { Essay } from '../../lib/api';
import { bookGradient } from '../../composables/useBookHue';
import { formatMarkdown } from '../../lib/formatText';
import EssayReferenceChips from './EssayReferenceChips.vue';

const props = defineProps<{
  essay: Essay;
}>();

const gradient = computed(() => {
  return bookGradient(
    props.essay.references
      .map((r) => r.book_id)
      .filter((id): id is string => !!id)
  );
});
</script>

<template>
  <div class="relative flex flex-col gap-2 p-3 sm:p-4 border border-mono-800 bg-mono-900 rounded-b-lg">
    <!-- Gradient top-bar -->
    <div class="absolute top-0 left-0 right-0 h-[2px] opacity-85" :style="{ background: gradient }"></div>

    <!-- Badge -->
    <div class="flex items-center gap-2">
      <span class="bg-essay text-essay-text px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.06em] leading-[1.5]">essay</span>
      <span v-if="essay.version && essay.version > 1" class="bg-gold text-gold-text px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.06em] leading-[1.5]">v{{ essay.version }}</span>
    </div>

    <!-- Text -->
    <p class="typography-prose whitespace-pre-wrap leading-[1.25] text-sm text-mono-100" v-html="formatMarkdown(essay.content)"></p>

    <!-- References -->
    <EssayReferenceChips v-if="essay.references.length" :references="essay.references" />
  </div>
</template>
