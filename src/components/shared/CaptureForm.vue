<script setup lang="ts">
import { ref, nextTick, watch, onMounted, computed } from 'vue';
import { MAX_LENGTHS } from '@antisocial/core';
import { createNote, createConnectionApi } from '../../lib/api';
import { useDraft } from '../../composables/useDraft';
import SourceSelector from '../library/SourceSelector.vue';
import type { SourceAttribution } from '../library/SourceSelector.vue';

const emit = defineEmits(['saved']);

const { draft: note, clearDraft, hasDraft } = useDraft('antisocial-capture-draft');
const textareaRef = ref<HTMLTextAreaElement | null>(null);
const loading = ref(false);
const sent = ref(false);
const sourceSelectorRef = ref<InstanceType<typeof SourceSelector> | null>(null);

// Current attribution from SourceSelector
const currentAttribution = ref<SourceAttribution>({ mode: 'none' });

const charCount = computed(() => note.value.length);

// Auto-grow textarea
const autoGrow = () => {
  if (textareaRef.value) {
    textareaRef.value.style.height = 'auto';
    textareaRef.value.style.height = Math.max(120, Math.min(textareaRef.value.scrollHeight, 400)) + 'px';
  }
};

onMounted(() => {
  autoGrow();
});

watch(note, () => {
  nextTick(autoGrow);
});

const submit = async () => {
  if (!note.value.trim()) return;
  loading.value = true;
  sent.value = false;

  try {
    const attr = currentAttribution.value;

    const input: any = {
      content: note.value,
      source: 'web',
    };

    // Dual-write: set book_id for legacy compatibility
    if (attr.mode === 'book' && attr.bookId) {
      input.book_id = attr.bookId;
      if (attr.page) input.page = attr.page;
    } else if (attr.mode === 'other') {
      if (attr.creator) input.creator = attr.creator;
      if (attr.work) input.work = attr.work;
      if (attr.kind) input.kind = attr.kind;
    }

    const result = await createNote(input);

    // Create connections for non-book attributions
    // (book connections are dual-written server-side via book_id)
    if (sourceSelectorRef.value && result.note?.id && attr.mode === 'author') {
      const connections = sourceSelectorRef.value.buildConnections(result.note.id);
      for (const conn of connections) {
        await createConnectionApi(conn);
      }
    }

    sent.value = true;
    clearDraft();
    sourceSelectorRef.value?.reset();
    currentAttribution.value = { mode: 'none' };

    setTimeout(() => {
      sent.value = false;
      emit('saved');
    }, 1500);

  } catch (e) {
    console.error(e);
    alert('Failed to capture log.');
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <div class="w-full relative">

    <!-- Draft indicator -->
    <div v-if="hasDraft() && !note" class="mb-3 text-xs text-mono-500 bg-mono-900 border border-mono-800 px-3 py-2 rounded-lg">
      Draft restored from previous session
    </div>

    <div class="flex gap-4 items-start relative">

      <!-- Input Column -->
      <div class="grow flex flex-col gap-2 relative">

        <!-- Textarea Wrapper -->
        <div class="relative group">
          <textarea ref="textareaRef" v-model="note" @input="autoGrow" :maxlength="MAX_LENGTHS.CONTENT" placeholder="Log entry…" class="relative w-full bg-mono-900 border border-mono-800 rounded-xl p-4 min-h-30 text-white focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/40 transition-all duration-500 ease-out resize-none text-sm leading-normal placeholder:text-mono-600 placeholder:italic block shadow-lg shadow-black/20 z-10 origin-center" :class="[
            sent ? 'bg-accent! border-accent-bright! text-white! shadow-[0_0_40px_rgba(41,82,255,0.3)] scale-[0.98] placeholder:text-transparent' : ''
          ]" @keydown.enter.ctrl="submit"></textarea>
        </div>

        <!-- Footer: char count only while typing -->
        <div v-if="note.length > 0" class="flex justify-end items-center text-xs text-mono-600 tracking-wider pr-1 z-10 select-none tabular-nums">
          <span>{{ charCount }} / {{ MAX_LENGTHS.CONTENT }}</span>
        </div>

        <!-- Source Selector — defaults to book-linking, the app's primary axis -->
        <div class="mt-3">
          <SourceSelector ref="sourceSelectorRef" entityType="note" :initial="{ mode: 'book' }" @update="currentAttribution = $event" />
        </div>
      </div>

      <!-- Submit Button -->
      <button @click="submit" :disabled="loading || !note.trim()" class="h-12 w-12 sm:h-10 sm:w-10 rounded-full flex items-center justify-center bg-accent-bright active:bg-accent sm:hover:bg-accent text-white transition-all shadow-lg active:shadow-accent/50 sm:hover:shadow-accent/50 disabled:opacity-50 disabled:cursor-not-allowed shrink-0 relative overflow-hidden active:scale-95 mt-9" :class="{ 'scale-110 shadow-accent-bright/50 shadow-xl': sent }">
        <transition name="icon-morph" mode="out-in">
          <!-- Loading -->
          <span v-if="loading" class="animate-spin relative z-10">
            <svg class="w-5 h-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </span>

          <!-- Success -->
          <span v-else-if="sent" class="relative z-10 text-lg font-bold">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="3" stroke="currentColor" class="size-5">
              <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
          </span>

          <!-- Idle -->
          <svg v-else xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="relative z-10">
            <path d="M12 5v14" />
            <path d="M5 12h14" />
          </svg>
        </transition>
      </button>

    </div>
  </div>
</template>

<style scoped>
/* Icon Morph Transition */
.icon-morph-enter-active,
.icon-morph-leave-active {
  transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.icon-morph-enter-from {
  opacity: 0;
  transform: rotate(-90deg) scale(0.5);
}

.icon-morph-leave-to {
  opacity: 0;
  transform: rotate(90deg) scale(0.5);
}
</style>