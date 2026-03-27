<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { fetchBooks, type Book } from '../lib/api';

const props = defineProps<{
  modelValue: string | null;
  book?: Book | null;
  autoOpen?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string | null): void;
  (e: 'update:book', value: Book | null): void;
}>();

const isOpen = ref(false);
const search = ref('');
const books = ref<Book[]>([]);
const loading = ref(false);
const dropdownRef = ref<HTMLElement | null>(null);
const searchInputRef = ref<HTMLInputElement | null>(null);

const selectedBook = computed(() => {
  if (props.book) return props.book;
  if (!props.modelValue) return null;
  return books.value.find(b => b.id === props.modelValue) || null;
});

const filteredBooks = computed(() => {
  if (!search.value) return books.value;
  const q = search.value.toLowerCase();
  return books.value.filter(
    b => b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q)
  );
});

const loadBooks = async () => {
  loading.value = true;
  try {
    books.value = await fetchBooks({ limit: 500 });
  } catch (err) {
    console.error('Failed to load books:', err);
  } finally {
    loading.value = false;
  }
};

const selectBook = (book: Book) => {
  emit('update:modelValue', book.id);
  emit('update:book', book);
  isOpen.value = false;
  search.value = '';
};

const clearSelection = () => {
  emit('update:modelValue', null);
  emit('update:book', null);
};

const toggleDropdown = () => {
  isOpen.value = !isOpen.value;
  if (isOpen.value && books.value.length === 0) {
    loadBooks();
  }
  if (isOpen.value) {
    nextTick(() => searchInputRef.value?.focus());
  }
};

// Auto-open when prop is set (e.g. from SourceSelector mode pill)
watch(() => props.autoOpen, (val) => {
  if (val && !props.modelValue && !isOpen.value) {
    toggleDropdown();
  }
});

// Close dropdown when clicking outside
const handleClickOutside = (event: MouseEvent) => {
  if (dropdownRef.value && !dropdownRef.value.contains(event.target as Node)) {
    isOpen.value = false;
  }
};

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
  // Preload books
  loadBooks();
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});

watch(() => props.modelValue, (newId) => {
  if (newId && !selectedBook.value && books.value.length > 0) {
    const book = books.value.find(b => b.id === newId);
    if (book) {
      emit('update:book', book);
    }
  }
});
</script>

<template>
  <div ref="dropdownRef" class="relative">
    <!-- Selected Book Display / Trigger Button -->
    <div v-if="selectedBook" class="flex items-center gap-2 px-3 py-2 bg-mono-800 border border-mono-700 rounded-lg">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-accent shrink-0">
        <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20" />
      </svg>
      <div class="flex-1 min-w-0">
        <p class="text-sm font-medium text-mono-100 truncate">{{ selectedBook.title }}</p>
        <p class="text-xs text-mono-400 truncate">{{ selectedBook.author }}</p>
      </div>
      <button @click.stop="clearSelection" class="p-1 hover:bg-mono-700 rounded transition-colors" title="Remove book">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-mono-400">
          <path d="M18 6 6 18" />
          <path d="m6 6 12 12" />
        </svg>
      </button>
    </div>

    <!-- Empty State / Trigger -->
    <button v-else @click="toggleDropdown" type="button" class="w-full flex items-center gap-2 px-3 py-2 bg-mono-900 border border-mono-800 rounded-lg text-mono-500 hover:border-mono-700 hover:text-mono-400 transition-colors cursor-pointer">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0">
        <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20" />
      </svg>
      <span class="text-sm">Attach to book...</span>
    </button>

    <!-- Dropdown -->
    <transition
      enter-active-class="transition ease-out duration-100"
      enter-from-class="transform opacity-0 scale-95"
      enter-to-class="transform opacity-100 scale-100"
      leave-active-class="transition ease-in duration-75"
      leave-from-class="transform opacity-100 scale-100"
      leave-to-class="transform opacity-0 scale-95"
    >
      <div v-if="isOpen" class="absolute z-50 mt-1 w-full bg-mono-900 border border-mono-700 rounded-lg shadow-xl overflow-hidden">
        <!-- Search -->
        <div class="p-2 border-b border-mono-800">
          <input
            ref="searchInputRef"
            v-model="search"
            type="text"
            placeholder="Search books..."
            class="w-full px-3 py-2 bg-mono-950 border border-mono-800 rounded-md text-sm text-mono-100 placeholder-mono-600 focus:outline-none focus:border-accent"
            @click.stop
          />
        </div>

        <!-- Book List -->
        <div class="max-h-60 overflow-y-auto">
          <div v-if="loading" class="p-4 text-center text-mono-500 text-sm">
            Loading books...
          </div>
          <div v-else-if="filteredBooks.length === 0" class="p-4 text-center text-mono-500 text-sm">
            No books found
          </div>
          <button
            v-else
            v-for="book in filteredBooks"
            :key="book.id"
            @click="selectBook(book)"
            class="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-mono-800 transition-colors text-left cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-mono-500 shrink-0">
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20" />
            </svg>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-mono-100 truncate">{{ book.title }}</p>
              <p class="text-xs text-mono-400 truncate">{{ book.author }}</p>
            </div>
            <span v-if="book.pdf_url" class="text-[10px] text-accent uppercase tracking-wide">PDF</span>
          </button>
        </div>
      </div>
    </transition>
  </div>
</template>
