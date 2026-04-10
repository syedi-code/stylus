<script setup lang="ts">
import { bookHue } from '../../composables/useBookHue';
import type { EssayReference } from '../../lib/api';

defineProps<{
  references: EssayReference[];
}>();
</script>

<template>
  <div class="flex flex-wrap gap-1.5 mt-1 pt-2.5 border-t border-mono-800">
    <span
      v-for="ref in references"
      :key="ref.id"
      class="inline-flex items-baseline gap-[5px] py-[3px] pl-1.5 pr-2.5 rounded-sm text-[11px] text-mono-300 bg-mono-800 leading-[1.5] cursor-pointer transition-colors duration-[120ms] hover:bg-mono-700"
    >
      <span
        class="w-1.5 h-1.5 rounded-full shrink-0 self-center"
        :style="{ background: bookHue(ref.book_id) }"
      ></span>
      <span class="font-medium text-mono-400">{{ ref.book_author }}</span>
      <span class="italic">{{ ref.book_title }}</span>
      <span v-if="ref.page" class="text-mono-500">p.&nbsp;{{ ref.page }}</span>
    </span>
  </div>
</template>
