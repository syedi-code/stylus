<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { fetchAuthors, fetchBooks, deleteAuthor, getSignedFileUrl, type Author, type Book } from '../lib/api';

defineProps<{
  isAdmin?: boolean;
}>();

const emit = defineEmits<{
  (e: 'edit', author: Author): void;
  (e: 'editBook', book: Book): void;
  (e: 'add'): void;
  (e: 'addBook'): void;
}>();

const authors = ref<Author[]>([]);
const books = ref<Book[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const search = ref('');
const confirmDelete = ref<string | null>(null);

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

const filteredAuthors = computed(() => {
  if (!search.value) return authors.value;
  const q = search.value.toLowerCase();
  return authors.value.filter(
    a => a.name.toLowerCase().includes(q) || (a.bio && a.bio.toLowerCase().includes(q))
  );
});

const loadAuthors = async () => {
  loading.value = true;
  error.value = null;
  try {
    const [authorsData, booksData] = await Promise.all([
      fetchAuthors({ limit: 500 }),
      fetchBooks({ limit: 500 }),
    ]);
    authors.value = authorsData;
    books.value = booksData;
  } catch (err) {
    console.error('Failed to load authors:', err);
    error.value = 'Failed to load authors.';
  } finally {
    loading.value = false;
  }
};

const handleDelete = async (author: Author) => {
  if (confirmDelete.value !== author.id) {
    confirmDelete.value = author.id;
    return;
  }

  try {
    await deleteAuthor(author.id);
    authors.value = authors.value.filter(a => a.id !== author.id);
    confirmDelete.value = null;
  } catch (err) {
    console.error('Failed to delete author:', err);
    alert('Failed to delete author.');
  }
};

onMounted(() => {
  loadAuthors();
});

defineExpose({ loadAuthors });
</script>

<template>
  <div class="w-full">
    <!-- Header -->
    <div class="flex items-center justify-center gap-4 mb-6">
      <h2 class="text-lg font-semibold tracking-tight text-white">library</h2>
      <div v-if="isAdmin" class="flex items-center gap-2">
        <button @click="emit('addBook')" class="px-3 py-1.5 text-xs font-semibold tracking-tight text-accent border border-accent/30 hover:bg-accent/10 rounded-lg transition-colors cursor-pointer">
          + book
        </button>
        <button @click="emit('add')" class="px-3 py-1.5 text-xs font-semibold tracking-tight text-accent border border-accent/30 hover:bg-accent/10 rounded-lg transition-colors cursor-pointer">
          + author
        </button>
      </div>
    </div>

    <!-- Search -->
    <div class="mb-6">
      <input v-model="search" type="text" placeholder="Search by name..." class="w-full px-4 py-2.5 bg-mono-900 border border-mono-800 rounded-lg text-mono-100 placeholder-mono-600 focus:outline-none focus:border-accent transition-colors" />
    </div>

    <!-- Loading -->
    <div v-if="loading" class="py-20 text-center text-mono-600">
      <div class="inline-block animate-spin h-6 w-6 border-2 border-accent border-t-transparent rounded-full mb-4"></div>
      <p class="text-xs tracking-widest uppercase">Loading authors...</p>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="p-6 border border-red-900 bg-red-950/20 text-center rounded-lg">
      <p class="text-red-500 font-bold uppercase text-sm mb-4">{{ error }}</p>
      <button @click="loadAuthors" class="px-4 py-2 bg-red-900 hover:bg-red-800 text-white text-xs font-bold uppercase tracking-wide transition-colors cursor-pointer">
        Retry
      </button>
    </div>

    <!-- Empty -->
    <div v-else-if="filteredAuthors.length === 0" class="py-20 text-center text-mono-600 border border-dashed border-mono-800 rounded-lg">
      <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" class="mx-auto mb-4 text-mono-700">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
      <p class="text-sm uppercase tracking-wide mb-4">{{ search ? 'No authors match your search.' : 'No authors yet.' }}</p>
      <button v-if="!search && isAdmin" @click="emit('add')" class="px-4 py-2 bg-accent hover:bg-accent-bright text-white text-xs font-bold uppercase tracking-wide transition-colors cursor-pointer">
        Add your first author
      </button>
    </div>

    <!-- Authors List -->
    <div v-else class="flex flex-col gap-2">
      <div v-for="author in filteredAuthors" :key="author.id" class="group bg-mono-900 border border-mono-800 rounded-lg px-4 py-3 hover:border-mono-600 transition-colors">
        <div class="flex items-center gap-4">
          <!-- Author Info -->
          <div class="flex-1 min-w-0">
            <div class="flex items-baseline gap-2 flex-wrap">
              <h3 class="font-medium text-mono-100 truncate">{{ author.name }}</h3>
              <span v-if="author.born || author.died" class="text-xs text-mono-500">({{ author.born || '?' }} – {{ author.died || 'present' }})</span>
            </div>
            <p v-if="author.bio" class="text-sm text-mono-400 truncate">{{ author.bio }}</p>
          </div>

          <!-- Actions (admin only) -->
          <div v-if="isAdmin" class="flex items-center gap-2 shrink-0">
            <button @click="emit('edit', author)" class="p-1.5 bg-mono-800 hover:bg-mono-700 text-mono-400 hover:text-white rounded transition-colors cursor-pointer" title="Edit">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                <path d="m15 5 4 4" />
              </svg>
            </button>
            <button @click="handleDelete(author)" class="p-1.5 rounded transition-colors cursor-pointer" :class="confirmDelete === author.id ? 'bg-red-600 text-white' : 'bg-mono-800 hover:bg-red-900 text-mono-400 hover:text-red-400'" :title="confirmDelete === author.id ? 'Click again to confirm' : 'Delete'">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 6h18" />
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
              </svg>
            </button>
          </div>
        </div>

        <!-- Linked Books -->
        <div v-if="booksByAuthor.get(author.id)?.length" class="mt-3 pt-3 border-t border-mono-800/50 flex flex-col gap-1">
          <div v-for="book in booksByAuthor.get(author.id)" :key="book.id" class="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md hover:bg-mono-800/50 transition-colors group/book">
            <!-- Book icon -->
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-mono-600 shrink-0">
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20" />
            </svg>
            <span v-if="book.pdf_url" class="flex-1 text-sm text-mono-300 truncate underline decoration-mono-600 underline-offset-2 hover:text-accent hover:decoration-accent transition-colors cursor-pointer" @click.stop="openPdf(book)">{{ book.title }}</span>
            <span v-else class="flex-1 text-sm text-mono-300 truncate">{{ book.title }}</span>
            <span v-if="book.originally_published" class="text-xs text-mono-600 shrink-0 hidden sm:inline">{{ book.originally_published }}</span>
            <!-- Action icons -->
            <div class="flex items-center gap-1 shrink-0">
              <button v-if="book.pdf_url" @click="openPdf(book)" class="p-1.5 hover:bg-mono-700 text-accent rounded transition-colors cursor-pointer" title="Open PDF">
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" x2="21" y1="14" y2="3" />
                </svg>
              </button>
              <button v-if="isAdmin" @click="emit('editBook', book)" class="p-1.5 hover:bg-mono-700 text-mono-500 hover:text-white rounded transition-colors cursor-pointer" title="Edit book">
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                  <path d="m15 5 4 4" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
