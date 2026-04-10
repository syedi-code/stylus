<script setup lang="ts">
import { ref, watch, computed, nextTick, onUnmounted } from 'vue';
import { fetchAuthors, fetchBooks, createEssay, type Author, type Book, type EssayInput } from '../../lib/api';
import { bookHue, bookGradient } from '../../composables/useBookHue';

interface SelectedRef {
  book_id: string;
  book_title: string;
  book_author: string;
  page?: string;
}

const props = defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'saved'): void;
}>();

const content = ref('');
const selectedRefs = ref<SelectedRef[]>([]);
const tagInput = ref('');
const tags = ref<string[]>([]);
const loading = ref(false);
const sent = ref(false);
const textareaRef = ref<HTMLTextAreaElement | null>(null);
const showSheet = ref(false);
const sheetSearch = ref('');

// Library data
const authors = ref<Author[]>([]);
const books = ref<Book[]>([]);
const libraryLoaded = ref(false);
const libraryError = ref(false);

const MAX_CHARS = 3000;
const charCount = computed(() => content.value.length);

const gradient = computed(() => {
  const ids = selectedRefs.value.map(r => r.book_id);
  return bookGradient(ids);
});

// Lock body scroll when open
watch(() => props.isOpen, async (open) => {
  if (open) {
    document.body.style.overflow = 'hidden';
    await nextTick();
    textareaRef.value?.focus();
    if (!libraryLoaded.value) {
      libraryError.value = false;
      try {
        const [a, b] = await Promise.all([
          fetchAuthors({ limit: 500 }),
          fetchBooks({ limit: 500 }),
        ]);
        authors.value = a;
        books.value = b;
        libraryLoaded.value = true;
      } catch (err) {
        console.error('Failed to load library:', err);
        libraryError.value = true;
      }
    }
  } else {
    document.body.style.overflow = '';
  }
});

onUnmounted(() => {
  document.body.style.overflow = '';
});

// Group books by author
const booksByAuthor = computed(() => {
  const map = new Map<string, { author: Author; books: Book[] }>();
  for (const book of books.value) {
    if (book.author_id) {
      const a = authors.value.find(a => a.id === book.author_id);
      if (a) {
        if (!map.has(a.id)) map.set(a.id, { author: a, books: [] });
        map.get(a.id)!.books.push(book);
      }
    }
  }
  return map;
});

// Filtered groups for bottom sheet search
const filteredGroups = computed(() => {
  const q = sheetSearch.value.toLowerCase();
  const groups: { author: Author; books: Book[] }[] = [];
  for (const [, group] of booksByAuthor.value) {
    const matchedBooks = q
      ? group.books.filter(b => b.title.toLowerCase().includes(q) || group.author.name.toLowerCase().includes(q))
      : group.books;
    if (matchedBooks.length) {
      groups.push({ author: group.author, books: matchedBooks });
    }
  }
  return groups.sort((a, b) => a.author.name.localeCompare(b.author.name));
});

const selectedIds = computed(() => new Set(selectedRefs.value.map(r => r.book_id)));

const toggleBook = (book: Book) => {
  if (selectedIds.value.has(book.id)) {
    selectedRefs.value = selectedRefs.value.filter(r => r.book_id !== book.id);
  } else {
    const author = authors.value.find(a => a.id === book.author_id);
    selectedRefs.value = [...selectedRefs.value, {
      book_id: book.id,
      book_title: book.title,
      book_author: author?.name || book.author,
    }];
  }
};

const updatePage = (bookId: string, page: string) => {
  selectedRefs.value = selectedRefs.value.map(r =>
    r.book_id === bookId ? { ...r, page: page || undefined } : r
  );
};

const submit = async () => {
  if (!content.value.trim() || loading.value) return;
  loading.value = true;
  sent.value = false;

  try {
    const input: EssayInput = {
      content: content.value.trim(),
      tags: tags.value.length ? tags.value : undefined,
      source: 'web-mobile',
      references: selectedRefs.value.map((r, i) => ({
        book_id: r.book_id,
        page: r.page,
        position: i,
      })),
    };
    await createEssay(input);
    sent.value = true;
    content.value = '';
    selectedRefs.value = [];
    tags.value = [];
    setTimeout(() => {
      sent.value = false;
      emit('saved');
      emit('close');
    }, 600);
  } catch (err) {
    console.error('Failed to save essay:', err);
  } finally {
    loading.value = false;
  }
};

const handleClose = () => {
  content.value = '';
  selectedRefs.value = [];
  tags.value = [];
  tagInput.value = '';
  emit('close');
};
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="isOpen" class="fixed inset-0 z-50 bg-mono-950 flex flex-col">
        <!-- Gradient top-bar (2px, per mockup) -->
        <div
          class="absolute top-0 left-0 right-0 h-[2px] z-10 rounded-t-[20px] transition-opacity"
          :class="selectedRefs.length > 0 ? 'opacity-100' : 'opacity-85'"
          :style="{ background: gradient }"
        ></div>

        <!-- Header (per mockup 03 mobile: close, title, publish action) -->
        <div class="flex items-center justify-between px-4 py-3 border-b border-mono-800 shrink-0">
          <div class="flex items-center gap-1">
            <button @click="handleClose" class="p-2 -ml-2 text-mono-400 active:text-white transition-colors cursor-pointer" :disabled="loading">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 6 6 18" /><path d="m6 6 12 12" />
              </svg>
            </button>
            <span class="text-[13px] font-semibold text-white uppercase tracking-[0.06em]">New Essay</span>
          </div>
          <button
            @click="submit"
            :disabled="loading || !content.trim()"
            class="px-4 py-2 text-[13px] font-bold rounded-lg transition-all disabled:opacity-50 active:scale-95 cursor-pointer"
            :class="sent ? 'text-emerald-400 bg-emerald-500/20' : 'text-essay-bright bg-essay/20 active:bg-essay/30'"
          >
            {{ loading ? '...' : sent ? '✓ Saved' : 'Publish' }}
          </button>
        </div>

        <!-- Reference chips bar (horizontally scrollable, per mockup 03) -->
        <div class="flex items-center gap-2 px-4 py-2.5 border-b border-mono-800 shrink-0 overflow-x-auto scrollbar-hide">
          <!-- "+ Add book" button -->
          <button
            @click="showSheet = true"
            class="flex items-center gap-[5px] py-1.5 px-3 bg-mono-800 border border-dashed border-mono-600 rounded-md text-mono-400 text-xs cursor-pointer whitespace-nowrap shrink-0 transition-all font-body"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
            Add book
          </button>
          <!-- Selected ref chips -->
          <span
            v-for="ref in selectedRefs"
            :key="ref.book_id"
            class="inline-flex items-center gap-[5px] py-[5px] px-2 rounded-md bg-mono-800 text-xs text-mono-300 whitespace-nowrap shrink-0 cursor-pointer"
            @click="showSheet = true"
          >
            <span class="w-1.5 h-1.5 rounded-full shrink-0" :style="{ background: bookHue(ref.book_id) }"></span>
            <span class="font-medium text-mono-400 text-[11px]">{{ ref.book_author }}</span>
            <span class="italic text-[11px]">{{ ref.book_title }}</span>
            <span v-if="ref.page" class="font-mono text-[9px] text-mono-500 py-px px-1 bg-mono-700 rounded-[3px]">p. {{ ref.page }}</span>
          </span>
        </div>

        <!-- Textarea (fills remaining space, per mockup) -->
        <div class="flex-1 p-4 overflow-y-auto">
          <textarea
            ref="textareaRef"
            v-model="content"
            placeholder="Begin writing…"
            :disabled="loading"
            class="w-full h-full min-h-[200px] bg-transparent border-none outline-none resize-none font-body text-base leading-[1.45] text-mono-100 placeholder:text-mono-600"
            style="font-variant-ligatures: common-ligatures; font-variant-numeric: oldstyle-nums;"
          ></textarea>
        </div>

        <!-- Footer (per mockup 03: draft indicator left, char count right) -->
        <div class="flex items-center justify-between px-4 py-2.5 border-t border-mono-800 shrink-0 pb-safe">
          <div class="flex items-center gap-1.5">
            <span class="w-1.5 h-1.5 rounded-full bg-essay"></span>
            <span class="text-[11px] text-mono-500">Draft</span>
          </div>
          <span class="font-mono text-[10px]" :class="charCount > MAX_CHARS ? 'text-red-400' : 'text-mono-600'">{{ charCount }}</span>
        </div>

        <!-- Bottom Sheet: Library browser (per mockup 03) -->
        <Transition name="sheet">
          <div v-if="showSheet" class="absolute inset-0 z-20 flex flex-col justify-end">
            <!-- Backdrop -->
            <div class="absolute inset-0 bg-black/50" @click="showSheet = false"></div>

            <!-- Sheet -->
            <div class="relative bg-mono-900 border-t border-mono-700 rounded-t-2xl flex flex-col max-h-[75%]">
              <!-- Drag handle -->
              <div class="flex justify-center py-2.5 shrink-0">
                <span class="w-9 h-1 rounded-sm bg-mono-600"></span>
              </div>

              <!-- Header -->
              <div class="flex items-center justify-between px-4 pb-3 shrink-0">
                <span class="font-mono text-[11px] tracking-[0.06em] uppercase text-mono-400 font-medium">Select books</span>
                <button @click="showSheet = false" class="py-1.5 px-3.5 bg-essay border-none rounded-md text-xs font-semibold text-black cursor-pointer font-body hover:bg-essay-bright transition-colors">
                  Done
                </button>
              </div>

              <!-- Search -->
              <div class="px-4 pb-2.5 shrink-0 relative">
                <svg class="absolute left-7 top-1/2 -translate-y-1/2 text-mono-500" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                <input
                  v-model="sheetSearch"
                  type="text"
                  placeholder="Search books…"
                  class="w-full py-2.5 pl-9 pr-3 bg-mono-800 border border-mono-700 rounded-lg font-body text-sm text-mono-100 outline-none placeholder:text-mono-500 focus:border-essay"
                />
              </div>

              <!-- Book list (grouped by author, per mockup 03: sticky author headers, 48px tap targets) -->
              <div class="flex-1 overflow-y-auto scrollbar-hide">
                <template v-for="group in filteredGroups" :key="group.author.id">
                  <!-- Author group header (sticky) -->
                  <div class="sticky top-0 z-[1] px-4 py-2 pt-2 font-mono text-[10px] tracking-[0.06em] uppercase text-mono-500 bg-mono-900">
                    {{ group.author.name }}
                  </div>
                  <!-- Book rows -->
                  <button
                    v-for="book in group.books"
                    :key="book.id"
                    @click="toggleBook(book)"
                    class="w-full flex items-center gap-3 px-4 py-3 min-h-[48px] border-b border-mono-800 cursor-pointer transition-colors text-left"
                    :class="selectedIds.has(book.id) ? 'bg-essay-muted' : 'active:bg-mono-800'"
                  >
                    <div class="w-1 h-8 rounded-sm shrink-0" :style="{ background: bookHue(book.id) }"></div>
                    <div class="flex flex-col gap-0.5 flex-1 min-w-0">
                      <span class="text-sm italic text-mono-100 truncate">{{ book.title }}</span>
                      <span v-if="book.originally_published" class="text-[11px] text-mono-500">{{ book.originally_published }}</span>
                    </div>
                    <!-- Checkbox -->
                    <div class="w-6 h-6 rounded-md flex items-center justify-center shrink-0 transition-all" :class="selectedIds.has(book.id) ? 'bg-essay text-black' : 'border-[1.5px] border-mono-600'">
                      <svg v-if="selectedIds.has(book.id)" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    </div>
                  </button>
                  <!-- Page input (inline, per mockup 03) -->
                  <div v-for="book in group.books.filter(b => selectedIds.has(b.id))" :key="'page-' + book.id" class="flex items-center gap-2 px-4 py-1.5 pl-8 bg-essay-muted border-b border-mono-800">
                    <span class="text-xs text-mono-400 shrink-0">Page:</span>
                    <input
                      :value="selectedRefs.find(r => r.book_id === book.id)?.page || ''"
                      @input="updatePage(book.id, ($event.target as HTMLInputElement).value)"
                      placeholder=""
                      class="w-20 py-1.5 px-2.5 bg-mono-800 border border-mono-700 rounded-md font-mono text-[13px] text-mono-100 outline-none focus:border-essay"
                    />
                  </div>
                </template>
                <div v-if="libraryError" class="flex flex-col items-center justify-center py-12 gap-3">
                  <span class="text-xs text-red-400">Failed to load books</span>
                  <button @click="libraryLoaded = false; libraryError = false;" class="text-xs text-essay underline cursor-pointer">Retry</button>
                </div>
                <div v-else-if="filteredGroups.length === 0" class="flex items-center justify-center py-12 text-xs text-mono-600">
                  No books found
                </div>
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.pb-safe {
  padding-bottom: max(0.625rem, env(safe-area-inset-bottom));
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.sheet-enter-active,
.sheet-leave-active {
  transition: opacity 0.25s ease;
}
.sheet-enter-active .relative,
.sheet-leave-active .relative {
  transition: transform 0.25s ease;
}
.sheet-enter-from,
.sheet-leave-to {
  opacity: 0;
}
.sheet-enter-from .relative,
.sheet-leave-to .relative {
  transform: translateY(100%);
}
</style>
