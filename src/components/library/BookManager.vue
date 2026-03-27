<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { fetchBooks, deleteBook, getSignedFileUrl, type Book } from '../../lib/api';

const emit = defineEmits<{
  (e: 'edit', book: Book): void;
  (e: 'add'): void;
}>();

const books = ref<Book[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const search = ref('');
const confirmDelete = ref<string | null>(null);

const filteredBooks = computed(() => {
  if (!search.value) return books.value;
  const q = search.value.toLowerCase();
  return books.value.filter(
    b => b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q)
  );
});

const loadBooks = async () => {
  loading.value = true;
  error.value = null;
  try {
    books.value = await fetchBooks({ limit: 500 });
  } catch (err) {
    console.error('Failed to load books:', err);
    error.value = 'Failed to load books.';
  } finally {
    loading.value = false;
  }
};

const handleDelete = async (book: Book) => {
  if (confirmDelete.value !== book.id) {
    confirmDelete.value = book.id;
    return;
  }

  try {
    await deleteBook(book.id);
    books.value = books.value.filter(b => b.id !== book.id);
    confirmDelete.value = null;
  } catch (err) {
    console.error('Failed to delete book:', err);
    alert('Failed to delete book.');
  }
};

const openPdf = async (book: Book) => {
  if (book.pdf_url) {
    try {
      const path = book.pdf_url.replace('/files/', '');
      const signedUrl = await getSignedFileUrl(path);
      window.open(signedUrl, '_blank');
    } catch (err) {
      console.error('Failed to get signed URL:', err);
      alert('Failed to open PDF.');
    }
  }
};

onMounted(() => {
  loadBooks();
});

defineExpose({ loadBooks });
</script>

<template>
  <div class="w-full">
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-lg font-semibold text-white uppercase tracking-wide flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-accent">
          <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20" />
        </svg>
        Library
      </h2>
      <button @click="emit('add')" class="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-bright text-white text-sm font-medium rounded-lg transition-colors cursor-pointer">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </svg>
        Add Book
      </button>
    </div>

    <!-- Search -->
    <div class="mb-6">
      <input v-model="search" type="text" placeholder="Search by title or author..." class="w-full px-4 py-2.5 bg-mono-900 border border-mono-800 rounded-lg text-mono-100 placeholder-mono-600 focus:outline-none focus:border-accent transition-colors" />
    </div>

    <!-- Loading -->
    <div v-if="loading" class="py-20 text-center text-mono-600">
      <div class="inline-block animate-spin h-6 w-6 border-2 border-accent border-t-transparent rounded-full mb-4"></div>
      <p class="text-xs tracking-widest uppercase">Loading library...</p>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="p-6 border border-red-900 bg-red-950/20 text-center rounded-lg">
      <p class="text-red-500 font-bold uppercase text-sm mb-4">{{ error }}</p>
      <button @click="loadBooks" class="px-4 py-2 bg-red-900 hover:bg-red-800 text-white text-xs font-bold uppercase tracking-wide transition-colors cursor-pointer">
        Retry
      </button>
    </div>

    <!-- Empty -->
    <div v-else-if="filteredBooks.length === 0" class="py-20 text-center text-mono-600 border border-dashed border-mono-800 rounded-lg">
      <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" class="mx-auto mb-4 text-mono-700">
        <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20" />
      </svg>
      <p class="text-sm uppercase tracking-wide mb-4">{{ search ? 'No books match your search.' : 'No books in library.' }}</p>
      <button v-if="!search" @click="emit('add')" class="px-4 py-2 bg-accent hover:bg-accent-bright text-white text-xs font-bold uppercase tracking-wide transition-colors cursor-pointer">
        Add your first book
      </button>
    </div>

    <!-- Books List -->
    <div v-else class="flex flex-col gap-2">
      <div v-for="book in filteredBooks" :key="book.id" class="group flex items-center gap-4 bg-mono-900 border border-mono-800 rounded-lg px-4 py-3 hover:border-mono-600 transition-colors">
        <!-- Book Info -->
        <div class="flex-1 min-w-0">
          <div class="flex items-baseline gap-2">
            <h3 class="font-medium text-mono-100 truncate">{{ book.title }}</h3>
            <span v-if="book.originally_published" class="text-xs text-mono-500">({{ book.originally_published }})</span>
            <span v-if="book.pdf_url" class="text-[10px] text-accent uppercase tracking-wide bg-accent/10 px-1.5 py-0.5 rounded shrink-0">PDF</span>
          </div>
          <p class="text-sm text-mono-400 truncate">{{ book.author }}<span v-if="book.isbn" class="text-mono-500"> · {{ book.isbn }}</span></p>
        </div>

        <!-- Actions -->
        <div class="flex items-center gap-2 shrink-0">
          <button v-if="book.pdf_url" @click="openPdf(book)" class="p-1.5 bg-mono-800 hover:bg-mono-700 text-mono-400 hover:text-white rounded transition-colors cursor-pointer" title="Open PDF">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" x2="21" y1="14" y2="3" />
            </svg>
          </button>
          <button @click="emit('edit', book)" class="p-1.5 bg-mono-800 hover:bg-mono-700 text-mono-400 hover:text-white rounded transition-colors cursor-pointer" title="Edit">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
              <path d="m15 5 4 4" />
            </svg>
          </button>
          <button @click="handleDelete(book)" class="p-1.5 rounded transition-colors cursor-pointer" :class="confirmDelete === book.id ? 'bg-red-600 text-white' : 'bg-mono-800 hover:bg-red-900 text-mono-400 hover:text-red-400'" :title="confirmDelete === book.id ? 'Click again to confirm' : 'Delete'">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 6h18" />
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
