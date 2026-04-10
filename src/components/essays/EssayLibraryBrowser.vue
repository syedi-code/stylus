<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { fetchAuthors, fetchBooks, type Author, type Book } from '../../lib/api';
import { bookHue } from '../../composables/useBookHue';

export interface SelectedBookRef {
  book_id: string;
  book_title: string;
  book_author: string;
  page?: string;
}

const props = defineProps<{
  modelValue: SelectedBookRef[];
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: SelectedBookRef[]): void;
}>();

const authors = ref<Author[]>([]);
const books = ref<Book[]>([]);
const loading = ref(false);
const search = ref('');
const selectedAuthorId = ref<string | null>(null);

onMounted(async () => {
  loading.value = true;
  try {
    const [a, b] = await Promise.all([
      fetchAuthors({ limit: 500 }),
      fetchBooks({ limit: 500 }),
    ]);
    authors.value = a;
    books.value = b;
    if (a.length) selectedAuthorId.value = a[0].id;
  } finally {
    loading.value = false;
  }
});

// Group books by author_id for counts
const booksByAuthor = computed(() => {
  const map = new Map<string, Book[]>();
  for (const book of books.value) {
    if (book.author_id) {
      const list = map.get(book.author_id) || [];
      list.push(book);
      map.set(book.author_id, list);
    }
  }
  return map;
});

// Authors with at least one book, filtered by search
const filteredAuthors = computed(() => {
  const q = search.value.toLowerCase();
  return authors.value
    .filter(a => booksByAuthor.value.has(a.id))
    .filter(a => {
      if (!q) return true;
      if (a.name.toLowerCase().includes(q)) return true;
      const authorBooks = booksByAuthor.value.get(a.id) || [];
      return authorBooks.some(b => b.title.toLowerCase().includes(q));
    });
});

// Books for selected author, filtered by search
const filteredBooks = computed(() => {
  if (!selectedAuthorId.value) return [];
  const authorBooks = booksByAuthor.value.get(selectedAuthorId.value) || [];
  const q = search.value.toLowerCase();
  if (!q) return authorBooks;
  return authorBooks.filter(b => b.title.toLowerCase().includes(q));
});

// Auto-select first matching author when search changes
watch(search, () => {
  if (filteredAuthors.value.length && !filteredAuthors.value.find(a => a.id === selectedAuthorId.value)) {
    selectedAuthorId.value = filteredAuthors.value[0].id;
  }
});

const selectedBookIds = computed(() => new Set(props.modelValue.map(r => r.book_id)));

const isSelected = (bookId: string) => selectedBookIds.value.has(bookId);

const toggleBook = (book: Book) => {
  if (isSelected(book.id)) {
    emit('update:modelValue', props.modelValue.filter(r => r.book_id !== book.id));
  } else {
    const author = authors.value.find(a => a.id === book.author_id);
    emit('update:modelValue', [
      ...props.modelValue,
      {
        book_id: book.id,
        book_title: book.title,
        book_author: author?.name || book.author,
        page: undefined,
      },
    ]);
  }
};
</script>

<template>
  <div class="flex flex-col gap-2.5">
    <span class="font-mono text-[10px] tracking-[0.08em] uppercase text-mono-500">References</span>

    <!-- Search (per mockup 03) -->
    <div class="relative">
      <svg class="absolute left-2.5 top-1/2 -translate-y-1/2 text-mono-500" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
      <input
        v-model="search"
        type="text"
        placeholder="Search library…"
        class="w-full py-[7px] pl-[30px] pr-3 bg-mono-800 border border-mono-700 rounded-md font-body text-xs text-mono-100 outline-none transition-colors focus:border-essay placeholder:text-mono-500"
      />
    </div>

    <!-- Two-column browser (per mockup 03: author list left, book list right) -->
    <div v-if="!loading" class="flex gap-px bg-mono-800 border border-mono-800 rounded-md overflow-hidden h-[180px]">
      <!-- Left: Author list -->
      <div class="w-[160px] shrink-0 bg-mono-900 overflow-y-auto scrollbar-hide">
        <button
          v-for="author in filteredAuthors"
          :key="author.id"
          @click="selectedAuthorId = author.id"
          class="w-full flex items-center gap-1.5 px-3 py-2 text-xs text-left border-b border-mono-800 last:border-b-0 cursor-pointer transition-all"
          :class="selectedAuthorId === author.id
            ? 'bg-mono-800 text-mono-100 font-medium'
            : 'text-mono-400 hover:bg-mono-800 hover:text-mono-200'"
        >
          <span class="truncate">{{ author.name }}</span>
          <span class="font-mono text-[9px] text-mono-600 ml-auto shrink-0">{{ (booksByAuthor.get(author.id) || []).length }}</span>
        </button>
      </div>

      <!-- Right: Book list for selected author -->
      <div class="flex-1 bg-mono-900 overflow-y-auto scrollbar-hide">
        <button
          v-for="book in filteredBooks"
          :key="book.id"
          @click="toggleBook(book)"
          class="w-full flex items-center gap-2 px-3 py-2 border-b border-mono-800 last:border-b-0 cursor-pointer transition-all text-left"
          :class="isSelected(book.id) ? 'bg-essay-muted' : 'hover:bg-mono-800'"
        >
          <!-- Color bar (3px wide, per mockup) -->
          <div class="w-[3px] h-7 rounded-sm shrink-0" :style="{ background: bookHue(book.id) }"></div>
          <!-- Info -->
          <div class="flex flex-col gap-px min-w-0 flex-1">
            <span class="text-xs italic text-mono-100 truncate">{{ book.title }}</span>
            <span v-if="book.originally_published" class="font-mono text-[10px] text-mono-500">{{ book.originally_published }}</span>
          </div>
          <!-- Checkmark -->
          <span v-if="isSelected(book.id)" class="text-essay shrink-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </span>
        </button>
        <div v-if="filteredBooks.length === 0" class="flex items-center justify-center h-full text-xs text-mono-600">
          No books found
        </div>
      </div>
    </div>

    <!-- Loading state -->
    <div v-else class="flex items-center justify-center h-[180px] border border-mono-800 rounded-md bg-mono-900">
      <div class="animate-spin h-5 w-5 border-2 border-essay border-t-transparent rounded-full"></div>
    </div>
  </div>
</template>
