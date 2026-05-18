<script setup lang="ts">
import { ref, watch, computed, nextTick, onMounted, onUnmounted } from 'vue';
import { updateQuote, createConnectionApi, fetchConnections, type Quote } from '../../lib/api';
import SourceSelector from '../library/SourceSelector.vue';
import type { SourceAttribution } from '../library/SourceSelector.vue';

const props = defineProps<{
  quote: Quote | null;
  isOpen: boolean;
}>();

const emit = defineEmits(['close', 'saved']);

const quoteText = ref('');
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

// Lock body scroll when open
watch(() => props.isOpen, async (isOpen) => {
  if (isOpen) {
    document.body.style.overflow = 'hidden';
    await nextTick();
    textareaRef.value?.focus();
  } else {
    document.body.style.overflow = '';
  }
});

// Derive creator / work from attribution for the quote row
const effectiveCreator = computed(() => {
  const attr = currentAttribution.value;
  if (attr.mode === 'book' && attr.book) return attr.book.author;
  if (attr.mode === 'other') return attr.creator;
  return undefined;
});

const effectiveWork = computed(() => {
  const attr = currentAttribution.value;
  if (attr.mode === 'book' && attr.book) return attr.book.title;
  if (attr.mode === 'other') return attr.work;
  return undefined;
});

const effectiveKind = computed(() => {
  const attr = currentAttribution.value;
  if (attr.mode === 'book') return 'book';
  if (attr.mode === 'other') return attr.kind;
  return undefined;
});

watch(() => props.quote, async (newQuote) => {
  if (newQuote) {
    quoteText.value = newQuote.quote || '';
    // Pre-populate SourceSelector
    if (newQuote.book_id) {
      initialAttribution.value = {
        mode: 'book',
        bookId: newQuote.book_id,
        page: newQuote.page || undefined,
      };
    } else if (newQuote.creator || newQuote.work) {
      // Check if there's an author connection first
      try {
        const conns = await fetchConnections('quote', newQuote.id, 'author');
        if (conns.length > 0) {
          const conn = conns[0];
          const authorId = conn.a_type === 'author' ? conn.a_id : conn.b_id;
          initialAttribution.value = { mode: 'author', authorId };
        } else {
          initialAttribution.value = {
            mode: 'other',
            creator: newQuote.creator || undefined,
            work: newQuote.work || undefined,
            kind: newQuote.kind || undefined,
          };
        }
      } catch {
        initialAttribution.value = {
          mode: 'other',
          creator: newQuote.creator || undefined,
          work: newQuote.work || undefined,
          kind: newQuote.kind || undefined,
        };
      }
    } else {
      initialAttribution.value = { mode: 'none' };
    }
  }
});

const close = () => {
  emit('close');
  quoteText.value = '';
  sourceSelectorRef.value?.reset();
  currentAttribution.value = { mode: 'none' };
  initialAttribution.value = {};
};

const save = async () => {
  if (!props.quote || !quoteText.value.trim()) return;

  loading.value = true;
  try {
    const attr = currentAttribution.value;
    const input: any = {
      quote: quoteText.value,
      creator: effectiveCreator.value || undefined,
      work: effectiveWork.value || undefined,
      kind: effectiveKind.value || undefined,
    };

    // Dual-write: set book_id for legacy compatibility
    if (attr.mode === 'book' && attr.bookId) {
      input.book_id = attr.bookId;
      if (attr.page) input.page = attr.page;
    }

    // Mutate the existing row in place so essay_references (and every
    // other link by UUID) keep pointing at the edited content.
    await updateQuote(props.quote.id, input);

    // Create connections for non-book attributions
    if (sourceSelectorRef.value && attr.mode === 'author') {
      const connections = sourceSelectorRef.value.buildConnections(props.quote.id);
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

const charCount = computed(() => quoteText.value.length);
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
          <h3 class="text-sm font-semibold text-white uppercase tracking-wide">Edit Quote</h3>
          <button @click="save" :disabled="loading || !quoteText.trim()" class="px-3 py-2 text-sm font-semibold text-quote active:text-quote-bright transition-colors disabled:opacity-50">
            {{ loading ? 'Saving...' : 'Save' }}
          </button>
        </div>

        <!-- Content -->
        <div class="flex-1 p-4 overflow-y-auto">
          <div class="relative h-full flex flex-col gap-4">
            <textarea ref="textareaRef" v-model="quoteText" class="w-full flex-1 min-h-50 bg-transparent text-mono-100 focus:outline-none resize-none text-base leading-relaxed placeholder:text-mono-600" placeholder="Enter the quote..." :disabled="loading"></textarea>
            <div class="flex flex-col gap-1.5">
              <label class="text-xs text-mono-400 uppercase tracking-wide">Attribution</label>
              <SourceSelector ref="sourceSelectorRef" entityType="quote" :initial="initialAttribution" @update="currentAttribution = $event" />
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="px-4 py-3 border-t border-mono-800 shrink-0 pb-safe">
          <div class="text-xs text-mono-600 text-right">{{ charCount }} characters</div>
        </div>
      </div>
    </Transition>
  </Teleport>

  <!-- Desktop: Centered Modal -->
  <div v-if="isOpen && !isMobile" class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <!-- Backdrop -->
    <div class="absolute inset-0 bg-black/80 backdrop-blur-sm" @click="close"></div>

    <!-- Modal -->
    <div class="relative w-full max-w-2xl bg-mono-900 border border-mono-700 shadow-2xl rounded-xl p-5 flex flex-col gap-4">

      <h3 class="text-base font-semibold text-white uppercase tracking-wide">Edit Quote</h3>

      <!-- Quote text -->
      <div class="flex flex-col gap-1.5">
        <label class="text-xs text-mono-400 uppercase tracking-wide">Quote <span class="text-quote">*</span></label>
        <div class="relative">
          <textarea ref="textareaRef" v-model="quoteText" class="w-full bg-mono-950 border border-mono-800 rounded-lg p-4 min-h-32 max-h-100 text-mono-100 focus:outline-none focus:border-quote focus:ring-1 focus:ring-quote resize-none text-sm leading-relaxed" placeholder="Enter the quote..." @keydown.ctrl.enter="save"></textarea>
          <div class="absolute bottom-3 right-3 text-xs text-mono-600">{{ charCount }}</div>
        </div>
      </div>

      <!-- Source Selector -->
      <div class="flex flex-col gap-1.5">
        <label class="text-xs text-mono-400 uppercase tracking-wide">Attribution</label>
        <SourceSelector ref="sourceSelectorRef" entityType="quote" :initial="initialAttribution" @update="currentAttribution = $event" />
      </div>

      <div class="flex items-center justify-between pt-2">
        <span class="text-xs text-mono-600">Ctrl+Enter to save</span>
        <div class="flex gap-2">
          <button @click="close" class="px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-mono-400 hover:text-white transition-colors cursor-pointer">
            Cancel
          </button>
          <button @click="save" :disabled="loading || !quoteText.trim()" class="px-4 py-1.5 bg-quote hover:bg-quote-bright rounded-md text-quote-text text-xs font-medium uppercase tracking-wide transition-colors disabled:opacity-50 cursor-pointer">
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
