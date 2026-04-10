<script setup lang="ts">
import { computed, ref, onMounted } from 'vue';
import { bookGradient } from '../../composables/useBookHue';
import { fetchThreadsForEntity, type Essay, type Thread } from '../../lib/api';
import EssayReferenceChips from './EssayReferenceChips.vue';

const props = defineProps<{
  essay: Essay;
  isAdmin?: boolean;
}>();

const emit = defineEmits<{
  (e: 'edit', essay: Essay): void;
  (e: 'copy', essay: Essay): void;
  (e: 'present', essay: Essay): void;
  (e: 'delete', essay: Essay): void;
  (e: 'addToThread', essay: Essay): void;
  (e: 'navigateToThread', threadId: string): void;
}>();

const latestThread = ref<Thread | null>(null);

onMounted(async () => {
  try {
    const threads = await fetchThreadsForEntity('essay', props.essay.id);
    if (threads.length) {
      latestThread.value = threads.sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];
    }
  } catch {
    // Thread lookup is non-critical
  }
});

const gradient = computed(() => {
  const bookIds = props.essay.references.map(r => r.book_id);
  return bookGradient(bookIds);
});

const formattedDate = computed(() => {
  return new Date(props.essay.created_at).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
});
</script>

<template>
  <div
    class="essay-card group relative flex flex-col gap-2.5 p-4 border bg-mono-900 rounded-b-lg cursor-pointer transition-colors hover:border-mono-600"
    :class="essay.posted ? 'border-emerald-700' : 'border-mono-800'"
    @click="emit('present', essay)"
  >
    <!-- Book-hue gradient bar (2px top, per mockup) -->
    <div
      class="absolute top-0 left-0 right-0 h-[2px] opacity-85"
      :style="{ background: gradient }"
    ></div>

    <!-- Header: badges + date + actions -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2 min-w-0 flex-1 mr-2">
        <!-- ESSAY badge — warm amber #e8a040 bg, black text -->
        <span class="bg-essay text-essay-text px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.06em] leading-[1.5] shrink-0">
          essay
        </span>
        <!-- Version badge — gold bg, black text -->
        <span v-if="essay.version && essay.version > 1" class="bg-gold text-gold-text px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.06em] leading-[1.5] shrink-0">
          v{{ essay.version }}
        </span>
        <!-- Thread link — purple accent -->
        <button v-if="latestThread" @click.stop="emit('navigateToThread', latestThread.id)" class="inline-flex items-baseline gap-1 cursor-pointer group/thread min-w-0">
          <span class="text-[10.5px] italic text-mono-500 group-hover/thread:text-mono-400 transition-colors shrink-0">in</span>
          <span class="text-[11.5px] font-medium text-thread-muted group-hover/thread:text-thread transition-colors truncate">{{ latestThread.name }}</span>
        </button>
      </div>

      <div class="flex items-center gap-2 sm:gap-3 relative">
        <!-- Desktop: Date shown by default, hidden on hover -->
        <time :datetime="essay.created_at" class="hidden sm:inline sm:group-hover:opacity-0 sm:group-hover:invisible text-xs text-mono-500 font-medium py-1.5">{{ formattedDate }}</time>

        <!-- Action buttons (visible on hover, per mockup) -->
        <div class="flex items-center gap-2 sm:absolute sm:right-0 sm:hidden sm:group-hover:flex">
          <!-- Copy -->
          <button @click.stop="emit('copy', essay)" class="p-1.5 bg-accent active:bg-accent-bright sm:hover:bg-accent-bright text-white rounded cursor-pointer transition-all active:scale-95" title="Copy Essay">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" class="sm:w-3.5 sm:h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
              <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
            </svg>
          </button>
          <!-- Edit -->
          <button @click.stop="emit('edit', essay)" class="p-1.5 bg-accent active:bg-accent-bright sm:hover:bg-accent-bright text-white rounded cursor-pointer transition-all active:scale-95" title="Edit Essay">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" class="sm:w-3.5 sm:h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
              <path d="m15 5 4 4" />
            </svg>
          </button>
          <!-- Add to Thread (ghost style, purple hover per mockup) -->
          <button @click.stop="emit('addToThread', essay)" class="flex p-1.5 text-mono-500 hover:text-purple-400 hover:bg-purple-500/10 rounded cursor-pointer transition-all active:scale-95" title="Add to Thread">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8Z" />
              <path d="M12 8v8" /><path d="M8 12h8" />
            </svg>
          </button>
          <!-- Delete (admin only, per NoteCard pattern) -->
          <button v-if="isAdmin" @click.stop="emit('delete', essay)" class="hidden sm:flex p-1.5 text-mono-500 hover:text-red-400 hover:bg-red-500/10 rounded cursor-pointer transition-all active:scale-95" title="Delete Essay">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 6h18" />
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
              <line x1="10" x2="10" y1="11" y2="17" />
              <line x1="14" x2="14" y1="11" y2="17" />
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Essay body — tight article typography per mockup -->
    <div class="mt-1">
      <p class="typography-prose whitespace-pre-wrap leading-[1.25] text-sm text-mono-100">{{ essay.content }}</p>
    </div>

    <!-- Reference chips -->
    <EssayReferenceChips v-if="essay.references.length" :references="essay.references" />

    <!-- Tags -->
    <div v-if="essay.tags && essay.tags.length" class="flex flex-wrap gap-2 mt-0.5">
      <span v-for="tag in essay.tags" :key="tag" class="text-xs text-mono-500 hover:text-accent cursor-pointer transition-colors">
        #{{ tag }}
      </span>
    </div>

    <!-- Mobile date footer -->
    <time :datetime="essay.created_at" class="sm:hidden text-xs text-mono-500 font-medium pt-1.5 border-t border-mono-800">{{ formattedDate }}</time>
  </div>
</template>

<style scoped>
.essay-card {
  /* Ensure the gradient bar is visible above the card background */
  overflow: visible;
}
</style>
