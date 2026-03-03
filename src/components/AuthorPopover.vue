<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue';
import { fetchBooksByAuthorId, getSignedFileUrl, type Author, type Book } from '../lib/api';

const props = defineProps<{
  author: Author;
}>();

const emit = defineEmits<{
  (e: 'viewInLibrary', authorId: string): void;
  (e: 'close'): void;
}>();

const books = ref<Book[]>([]);
const loadingBooks = ref(true);
const popoverRef = ref<HTMLElement | null>(null);

const loadAuthorBooks = async () => {
  try {
    books.value = await fetchBooksByAuthorId(props.author.id);
  } catch {
    // Not critical
  } finally {
    loadingBooks.value = false;
  }
};

const openBookPdf = async (book: Book) => {
  if (!book.pdf_url) return;
  try {
    const url = await getSignedFileUrl(book.pdf_url);
    window.open(url, '_blank');
  } catch {
    // fallback: ignore
  }
};

const handleClickOutside = (e: MouseEvent) => {
  if (popoverRef.value && !popoverRef.value.contains(e.target as Node)) {
    emit('close');
  }
};

onMounted(() => {
  loadAuthorBooks();
  nextTick(() => {
    document.addEventListener('click', handleClickOutside, true);
  });
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside, true);
});
</script>

<template>
  <div ref="popoverRef" class="absolute z-30 mt-1 w-72 bg-mono-800 border border-mono-700 rounded-xl shadow-2xl shadow-black/50 overflow-hidden animate-in" @click.stop>
    <!-- Author header -->
    <div class="px-4 pt-4 pb-3">
      <div class="flex items-start gap-3">
        <div class="w-9 h-9 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-accent">
            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </div>
        <div class="flex-1 min-w-0">
          <h4 class="font-semibold text-mono-100 text-sm leading-tight">{{ author.name }}</h4>
          <p v-if="author.born || author.died" class="text-xs text-mono-500 mt-0.5">
            {{ author.born || '?' }} – {{ author.died || 'present' }}
          </p>
        </div>
      </div>
      <p v-if="author.bio" class="text-xs text-mono-400 mt-2 leading-relaxed line-clamp-3">{{ author.bio }}</p>
    </div>

    <!-- Linked books -->
    <div v-if="!loadingBooks && books.length > 0" class="border-t border-mono-700/50 px-3 py-2">
      <p class="text-[10px] text-mono-500 uppercase tracking-wider mb-1.5 px-1">Books</p>
      <div class="flex flex-col gap-0.5">
        <component :is="book.pdf_url ? 'button' : 'div'" v-for="book in books.slice(0, 4)" :key="book.id" @click.stop="book.pdf_url && openBookPdf(book)" class="flex items-center gap-2 px-1.5 py-1 rounded text-xs text-mono-300 text-left" :class="book.pdf_url ? 'hover:bg-mono-700/50 transition-colors group/book cursor-pointer' : ''">
          <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-mono-600 shrink-0">
            <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20" />
          </svg>
          <span class="truncate" :class="book.pdf_url ? 'underline decoration-mono-600 underline-offset-2 group-hover/book:decoration-accent group-hover/book:text-accent transition-colors' : ''">{{ book.title }}</span>
          <span v-if="book.originally_published" class="text-mono-600 shrink-0">{{ book.originally_published }}</span>
        </component>
        <p v-if="books.length > 4" class="text-[10px] text-mono-500 px-1.5 mt-0.5">+{{ books.length - 4 }} more</p>
      </div>
    </div>

    <!-- Footer -->
    <div class="border-t border-mono-700/50 px-4 py-2.5">
      <button @click.stop="emit('viewInLibrary', author.id)" class="w-full flex items-center justify-center gap-1.5 text-xs font-medium text-accent hover:text-accent-bright transition-colors py-1">
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          <polyline points="15 3 21 3 21 9" />
          <line x1="10" x2="21" y1="14" y2="3" />
        </svg>
        View in Library
      </button>
    </div>
  </div>
</template>

<style scoped>
.animate-in {
  animation: popover-in 0.15s ease-out;
}

@keyframes popover-in {
  from {
    opacity: 0;
    transform: translateY(-4px) scale(0.97);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.line-clamp-3 {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
