<script setup lang="ts">
import { ref, watch, nextTick, computed, onMounted, onUnmounted } from 'vue';
import { MAX_LENGTHS } from '../../lib/contract';
import { createNote, createConnectionApi, fetchConnections, fetchBookById, type Note, type Book } from '../../lib/api';
import BookLinePicker from '../library/BookLinePicker.vue';

const props = defineProps<{
  note: Note | null;
  isOpen: boolean;
}>();

const emit = defineEmits(['close', 'saved']);

const content = ref('');
const loading = ref(false);
const textareaRef = ref<HTMLTextAreaElement | null>(null);
const isMobile = ref(false);

// Book attribution — a note always lives in a book
const selectedBook = ref<Book | null>(null);
const pageRef = ref('');
/** Author connection carried over from the old version (legacy attribution). */
const preservedAuthorId = ref<string | null>(null);

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
    pageRef.value = newNote.page || '';
    selectedBook.value = null;
    preservedAuthorId.value = null;
    if (newNote.book_id) {
      try {
        selectedBook.value = await fetchBookById(newNote.book_id);
      } catch (err) {
        console.error('Failed to load book for note:', err);
      }
    } else if (!newNote.creator && !newNote.work) {
      // Legacy author attribution — carry it over to the new version on save
      try {
        const conns = await fetchConnections('note', newNote.id, 'author');
        if (conns.length > 0) {
          const conn = conns[0];
          preservedAuthorId.value = conn.a_type === 'author' ? conn.a_id : conn.b_id;
        }
      } catch {
        preservedAuthorId.value = null;
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
  selectedBook.value = null;
  pageRef.value = '';
  preservedAuthorId.value = null;
};

const save = async () => {
  if (!props.note || !content.value.trim()) return;

  loading.value = true;
  try {
    const input: any = {
      content: content.value,
      source: 'web',
      replaces: props.note.id,
      posted: props.note.posted,
      tags: props.note.tags,
    };

    if (selectedBook.value) {
      input.book_id = selectedBook.value.id;
      if (pageRef.value) input.page = pageRef.value;
    } else if (props.note.creator || props.note.work) {
      // Preserve legacy non-book attribution when no book is chosen
      if (props.note.creator) input.creator = props.note.creator;
      if (props.note.work) input.work = props.note.work;
      if (props.note.kind) input.kind = props.note.kind;
    }

    const result = await createNote(input);

    // Carry over the legacy author connection when no book is chosen
    if (result.note?.id && !selectedBook.value && preservedAuthorId.value) {
      await createConnectionApi({
        a_type: 'author',
        a_id: preservedAuthorId.value,
        b_type: 'note',
        b_id: result.note.id,
      });
    }

    emit('saved', { oldId: props.note.id, note: result.note });
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

        <!-- Book line — attribution lives above the words -->
        <div class="px-4 py-2.5 border-b border-mono-800 shrink-0">
          <BookLinePicker v-model:book="selectedBook" v-model:page="pageRef" showPage />
        </div>

        <!-- Content -->
        <div class="flex-1 p-4 overflow-y-auto">
          <div class="relative h-full">
            <textarea ref="textareaRef" v-model="content" :maxlength="MAX_LENGTHS.CONTENT" class="w-full h-full min-h-50 bg-transparent text-mono-100 focus:outline-none resize-none text-base leading-[var(--content-leading)] placeholder:text-mono-600" placeholder="Edit your note..." :disabled="loading"></textarea>
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

      <!-- Book line — attribution lives above the words -->
      <BookLinePicker v-model:book="selectedBook" v-model:page="pageRef" showPage class="mb-0.5" />

      <div class="relative">
        <textarea ref="textareaRef" v-model="content" :maxlength="MAX_LENGTHS.CONTENT" class="w-full bg-mono-950 border border-mono-800 rounded-lg p-4 min-h-50 max-h-100 text-mono-100 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent resize-none text-sm leading-[var(--content-leading)]" placeholder="Edit your note..." @keydown.ctrl.enter="save"></textarea>
        <div class="absolute bottom-3 right-3 text-xs text-mono-600">{{ charCount }} / {{ MAX_LENGTHS.CONTENT }}</div>
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
