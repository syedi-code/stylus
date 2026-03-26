<script setup lang="ts">
import { ref, watch, nextTick, computed, onMounted, onUnmounted } from 'vue';
import { MAX_LENGTHS } from '@antisocial/core';
import { createNote, createConnectionApi, fetchConnections, type Note } from '../lib/api';
import SourceSelector from './SourceSelector.vue';
import type { SourceAttribution } from './SourceSelector.vue';

const props = defineProps<{
  note: Note | null;
  isOpen: boolean;
}>();

const emit = defineEmits(['close', 'saved']);

const content = ref('');
const loading = ref(false);
const textareaRef = ref<HTMLTextAreaElement | null>(null);
const isMobile = ref(false);
const sourceSelectorRef = ref<InstanceType<typeof SourceSelector> | null>(null);
const currentAttribution = ref<SourceAttribution>({ mode: 'none' });
const initialAttribution = ref<Partial<SourceAttribution>>({});

// Detect mobile viewport
const checkMobile = () => {
  isMobile.value = window.innerWidth < 640;
};

onMounted(() => {
  checkMobile();
  window.addEventListener('resize', checkMobile);
});

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile);
  document.body.style.overflow = '';
});

watch(() => props.note, async (newNote) => {
  if (newNote && newNote.content) {
    content.value = newNote.content;
    // Pre-populate SourceSelector based on existing data
    if (newNote.book_id) {
      initialAttribution.value = {
        mode: 'book',
        bookId: newNote.book_id,
        page: newNote.page || undefined,
      };
    } else {
      // Check for author connection
      try {
        const conns = await fetchConnections('note', newNote.id, 'author');
        if (conns.length > 0) {
          const conn = conns[0];
          const authorId = conn.a_type === 'author' ? conn.a_id : conn.b_id;
          initialAttribution.value = { mode: 'author', authorId };
        } else {
          initialAttribution.value = { mode: 'none' };
        }
      } catch {
        initialAttribution.value = { mode: 'none' };
      }
    }
  }
});

watch(() => props.isOpen, async (isOpen) => {
  if (isOpen) {
    document.body.style.overflow = 'hidden';
    await nextTick();
    textareaRef.value?.focus();
  } else {
    document.body.style.overflow = '';
  }
});

const close = () => {
  emit('close');
  content.value = '';
  sourceSelectorRef.value?.reset();
  currentAttribution.value = { mode: 'none' };
  initialAttribution.value = {};
};

const save = async () => {
  if (!props.note || !content.value.trim()) return;

  loading.value = true;
  try {
    const attr = currentAttribution.value;
    const input: any = {
      content: content.value,
      source: 'web',
      replaces: props.note.id,
      posted: props.note.posted,
      tags: props.note.tags,
    };

    // Dual-write: set book_id for legacy compatibility
    if (attr.mode === 'book' && attr.bookId) {
      input.book_id = attr.bookId;
      if (attr.page) input.page = attr.page;
    }

    const result = await createNote(input);

    // Create connections for non-book attributions
    if (sourceSelectorRef.value && result.note?.id && attr.mode === 'author') {
      const connections = sourceSelectorRef.value.buildConnections(result.note.id);
      for (const conn of connections) {
        await createConnectionApi(conn);
      }
    }

    emit('saved');
    close();
  } catch (e) {
    console.error(e);
    alert('Failed to save edit.');
  } finally {
    loading.value = false;
  }
};

const charCount = computed(() => content.value.length);
</script>

<template>
  <!-- Mobile: Full-screen overlay -->
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="isOpen && isMobile" class="fixed inset-0 z-50 bg-mono-950 flex flex-col">
        <!-- Header -->
        <div class="flex items-center justify-between px-4 py-3 border-b border-mono-800 shrink-0">
          <button @click="close" class="px-3 py-2 text-sm font-medium text-mono-400 active:text-white transition-colors" :disabled="loading">
            Cancel
          </button>
          <h3 class="text-sm font-semibold text-white uppercase tracking-wide">Edit Note</h3>
          <button @click="save" :disabled="loading || !content.trim()" class="px-3 py-2 text-sm font-semibold text-accent active:text-accent-bright transition-colors disabled:opacity-50">
            {{ loading ? 'Saving...' : 'Save' }}
          </button>
        </div>

        <!-- Content -->
        <div class="flex-1 p-4 overflow-y-auto">
          <div class="relative h-full flex flex-col gap-4">
            <textarea ref="textareaRef" v-model="content" :maxlength="MAX_LENGTHS.CONTENT" class="w-full flex-1 min-h-50 bg-transparent text-mono-100 focus:outline-none resize-none text-base leading-relaxed placeholder:text-mono-600" placeholder="Edit your note..." :disabled="loading"></textarea>
            <SourceSelector ref="sourceSelectorRef" entityType="note" :initial="initialAttribution" @update="currentAttribution = $event" />
          </div>
        </div>

        <!-- Footer -->
        <div class="px-4 py-3 border-t border-mono-800 shrink-0 pb-safe">
          <div class="text-xs text-mono-600 text-right">{{ charCount }} / {{ MAX_LENGTHS.CONTENT }}</div>
        </div>
      </div>
    </Transition>
  </Teleport>

  <!-- Desktop: Centered Modal -->
  <div v-if="isOpen && !isMobile" class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <!-- Backdrop -->
    <div class="absolute inset-0 bg-black/80 backdrop-blur-sm" @click="close"></div>

    <!-- Modal -->
    <div class="relative w-full max-w-2xl bg-mono-900 border border-mono-700 shadow-2xl rounded-xl p-5 flex flex-col gap-3">

      <h3 class="text-base font-semibold text-white uppercase tracking-wide">Edit Note</h3>

      <div class="relative">
        <textarea ref="textareaRef" v-model="content" :maxlength="MAX_LENGTHS.CONTENT" class="w-full bg-mono-950 border border-mono-800 rounded-lg p-4 min-h-50 max-h-100 text-mono-100 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent resize-none text-sm leading-relaxed" placeholder="Edit your note..." @keydown.ctrl.enter="save"></textarea>
        <div class="absolute bottom-3 right-3 text-xs text-mono-600">{{ charCount }} / {{ MAX_LENGTHS.CONTENT }}</div>
      </div>

      <!-- Source Selector -->
      <div class="mt-1">
        <label class="text-xs text-mono-400 uppercase tracking-wide mb-1.5 block">Attribution</label>
        <SourceSelector ref="sourceSelectorRef" entityType="note" :initial="initialAttribution" @update="currentAttribution = $event" />
      </div>

      <div class="flex items-center justify-between mt-2">
        <span class="text-xs text-mono-600">Ctrl+Enter to save</span>
        <div class="flex gap-2">
          <button @click="close" class="px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-mono-400 hover:text-white transition-colors cursor-pointer">
            Cancel
          </button>
          <button @click="save" :disabled="loading || !content.trim()" class="px-4 py-1.5 bg-accent hover:bg-accent-bright rounded-md text-white text-xs font-medium uppercase tracking-wide transition-colors disabled:opacity-50 cursor-pointer">
            {{ loading ? 'Saving...' : 'Save Changes' }}
          </button>
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
.pb-safe {
  padding-bottom: max(0.75rem, env(safe-area-inset-bottom));
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>
