<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import type { Book } from '../lib/api';

const props = defineProps<{
  search: string;
  showVersionBadge?: boolean;
  books?: Book[];
  bookFilter?: string;
}>();

const emit = defineEmits<{
  (e: 'update:search', value: string): void;
  (e: 'update:showVersionBadge', value: boolean): void;
  (e: 'update:bookFilter', value: string): void;
}>();

// Book picker state
const showBookPicker = ref(false);
const bookSearch = ref('');
const bookFilterRef = ref<HTMLElement | null>(null);

const selectedBook = computed(() => {
  if (!props.bookFilter || props.bookFilter === 'all' || props.bookFilter === 'no-book') return null;
  return props.books?.find(b => b.id === props.bookFilter) || null;
});

const filteredBooks = computed(() => {
  if (!props.books) return [];
  if (!bookSearch.value) return props.books;
  const q = bookSearch.value.toLowerCase();
  return props.books.filter(
    b => b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q)
  );
});

const selectBook = (bookId: string) => {
  emit('update:bookFilter', bookId);
  showBookPicker.value = false;
  bookSearch.value = '';
};

const toggleBookPicker = () => {
  showBookPicker.value = !showBookPicker.value;
  if (!showBookPicker.value) bookSearch.value = '';
};

// Close book picker when clicking outside
const handleClickOutside = (event: MouseEvent) => {
  if (showBookPicker.value && bookFilterRef.value && !bookFilterRef.value.contains(event.target as Node)) {
    showBookPicker.value = false;
    bookSearch.value = '';
  }
};

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});
</script>

<template>
  <div class="border-b border-mono-800 py-4 mb-6">
    <div class="max-w-3xl mx-auto flex flex-col gap-3 px-4 sm:px-0">

      <!-- Search Input -->
      <div class="relative">
        <input type="text" :value="search" @input="$emit('update:search', ($event.target as HTMLInputElement).value)" placeholder="SEARCH LOGS..." class="w-full pl-3 pr-10 py-2 bg-mono-900 border border-mono-800 rounded-md focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all placeholder:text-mono-600 text-sm text-white tracking-wide" />
        <div class="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-mono-600">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="size-4">
            <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
        </div>
      </div>

      <!-- Book Filter (full width row) -->
      <div v-if="books && books.length > 0" ref="bookFilterRef" class="relative">
          <!-- Active book chip / trigger -->
          <div v-if="selectedBook" class="flex items-center gap-2 px-3 py-2 bg-mono-900 border border-accent/40 rounded-lg">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-accent shrink-0">
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20" />
            </svg>
            <span class="text-sm text-mono-100 truncate flex-1">{{ selectedBook.title }}</span>
            <button @click="$emit('update:bookFilter', 'all')" class="p-1 text-mono-500 hover:text-white transition-colors cursor-pointer rounded-md hover:bg-mono-800" title="Clear book filter">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </div>

          <!-- Quick filter buttons when no specific book -->
          <div v-else class="flex gap-2">
            <button @click="toggleBookPicker" class="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-mono-900 border border-mono-800 rounded-lg text-mono-500 hover:border-mono-600 hover:text-mono-300 transition-colors cursor-pointer text-sm" :class="showBookPicker ? 'border-accent/40 text-accent' : ''">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0">
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20" />
              </svg>
              <span>{{ bookFilter === 'all' ? 'Filter by book' : 'No book' }}</span>
            </button>
            <button @click="$emit('update:bookFilter', bookFilter === 'no-book' ? 'all' : 'no-book')" class="px-3 py-2 bg-mono-900 border border-mono-800 rounded-lg transition-colors cursor-pointer text-sm shrink-0" :class="bookFilter === 'no-book' ? 'border-accent/40 text-accent' : 'text-mono-500 hover:border-mono-600 hover:text-mono-300'">
              Unattached
            </button>
          </div>

          <!-- Book picker dropdown -->
          <transition
            enter-active-class="transition ease-out duration-150"
            enter-from-class="opacity-0 -translate-y-1"
            enter-to-class="opacity-100 translate-y-0"
            leave-active-class="transition ease-in duration-100"
            leave-from-class="opacity-100 translate-y-0"
            leave-to-class="opacity-0 -translate-y-1"
          >
            <div v-if="showBookPicker" class="absolute z-50 mt-2 w-full bg-mono-900 border border-mono-700 rounded-xl shadow-2xl shadow-black/50 overflow-hidden">
              <!-- Search -->
              <div class="p-2 border-b border-mono-800">
                <input
                  v-model="bookSearch"
                  type="text"
                  placeholder="Search books..."
                  class="w-full px-3 py-2.5 bg-mono-950 border border-mono-800 rounded-lg text-sm text-mono-100 placeholder-mono-600 focus:outline-none focus:border-accent"
                  @click.stop
                />
              </div>

              <!-- Book List -->
              <div class="max-h-64 overflow-y-auto overscroll-contain">
                <button @click="selectBook('all')" class="w-full flex items-center gap-3 px-4 py-3 hover:bg-mono-800 active:bg-mono-800 transition-colors text-left cursor-pointer border-b border-mono-800/50 text-sm" :class="bookFilter === 'all' ? 'text-accent' : 'text-mono-300'">
                  All books
                </button>
                <button
                  v-for="book in filteredBooks"
                  :key="book.id"
                  @click="selectBook(book.id)"
                  class="w-full flex items-center gap-3 px-4 py-3 hover:bg-mono-800 active:bg-mono-800 transition-colors text-left cursor-pointer border-b border-mono-800/50 last:border-b-0"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-mono-500 shrink-0">
                    <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20" />
                  </svg>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-mono-100 truncate">{{ book.title }}</p>
                    <p class="text-xs text-mono-400 truncate">{{ book.author }}</p>
                  </div>
                  <span v-if="bookFilter === book.id" class="text-accent text-xs">✓</span>
                </button>
                <div v-if="filteredBooks.length === 0 && bookSearch" class="p-4 text-center text-mono-500 text-sm">No books found</div>
              </div>
            </div>
          </transition>
        </div>

      <!-- Version Badge Toggle -->
      <label class="flex items-center gap-3 cursor-pointer select-none">
        <button type="button" @click="$emit('update:showVersionBadge', !showVersionBadge)" class="relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-mono-950" :class="showVersionBadge ? 'bg-accent' : 'bg-mono-700'" role="switch" :aria-checked="showVersionBadge">
          <span class="absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200" :class="showVersionBadge ? 'translate-x-5' : 'translate-x-0'"></span>
        </button>
        <span class="text-xs text-mono-500 uppercase tracking-wide">Show version badges in Presentation?</span>
      </label>

    </div>
  </div>
</template>