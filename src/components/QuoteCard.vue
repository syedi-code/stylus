<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue';
import { fetchBookById, getSignedFileUrl, fetchConnections, fetchAuthorById, type Quote, type Book, type Author } from '../lib/api';
import { formatMarkdown } from '../lib/formatText';
import { useTypography } from '../composables/useTypography';
import AuthorPopover from './AuthorPopover.vue';

const props = defineProps<{
  quote: Quote;
  searchQuery?: string;
}>();

const emit = defineEmits<{
  (e: 'edit', quote: Quote): void;
  (e: 'copy', quote: Quote): void;
  (e: 'present', quote: Quote): void;
  (e: 'togglePosted', quote: Quote): void;
  (e: 'viewInLibrary', authorId: string): void;
  (e: 'addToThread', quote: Quote): void;
  (e: 'delete', quote: Quote): void;
}>();

// Book data for quotes with book_id
const book = ref<Book | null>(null);
const pdfUrl = ref<string | null>(null);

// Author connection (when quote is linked to author directly, not via book)
const connectedAuthor = ref<Author | null>(null);
const showAuthorPopover = ref(false);

const toggleAuthorPopover = (e: Event) => {
  e.stopPropagation();
  showAuthorPopover.value = !showAuthorPopover.value;
};

const handleViewInLibrary = (authorId: string) => {
  showAuthorPopover.value = false;
  emit('viewInLibrary', authorId);
};

const parsePrintPage = (pageStr: string | undefined): number | null => {
  if (!pageStr) return null;
  const match = pageStr.match(/^(\d+)/);
  if (match) {
    return parseInt(match[1], 10);
  }
  return null;
};

const getPdfPage = computed(() => {
  const printPage = parsePrintPage(props.quote.page);
  if (printPage === null || !book.value) return null;
  const offset = book.value.pdf_page_offset || 0;
  return printPage + offset;
});

const pdfUrlWithPage = computed(() => {
  if (!pdfUrl.value) return null;
  const pdfPage = getPdfPage.value;
  if (pdfPage !== null) {
    return `${pdfUrl.value}#page=${pdfPage}`;
  }
  return pdfUrl.value;
});

const loadBook = async () => {
  if (props.quote.book_id && !book.value) {
    try {
      book.value = await fetchBookById(props.quote.book_id);
      if (book.value?.pdf_url) {
        const path = book.value.pdf_url.replace('/files/', '');
        pdfUrl.value = await getSignedFileUrl(path);
      }
    } catch (err) {
      console.error('Failed to load book:', err);
    }
  }
};

const loadAuthorConnection = async () => {
  // Only check when there's no book and no creator/work on the row
  if (props.quote.book_id || props.quote.creator || connectedAuthor.value) return;
  try {
    const conns = await fetchConnections('quote', props.quote.id, 'author');
    if (conns.length > 0) {
      const conn = conns[0];
      const authorId = conn.a_type === 'author' ? conn.a_id : conn.b_id;
      connectedAuthor.value = await fetchAuthorById(authorId);
    }
  } catch (err) {
    // Connections may not exist yet
  }
};

onMounted(() => {
  loadBook();
  loadAuthorConnection();
});

watch(() => props.quote.book_id, () => {
  book.value = null;
  pdfUrl.value = null;
  loadBook();
});

const highlightText = (text: string | undefined) => {
  if (!text) return '';
  let result = formatMarkdown(text);
  if (props.searchQuery && props.searchQuery.length >= 2) {
    const regex = new RegExp(`(${props.searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    result = result.replace(regex, '<mark class="search-highlight">$1</mark>');
  }
  return result;
};

const quoteFontSize = computed(() => {
  const len = props.quote.quote?.length ?? 0;
  if (len < 100) return 18;   // text-lg equivalent
  if (len < 250) return 16;
  if (len < 500) return 15;
  if (len < 800) return 14;
  if (len < 1200) return 13;
  return 12;
});

const contentLength = computed(() => props.quote.quote?.length ?? 0);
const { lineHeightClass, typographyClass } = useTypography('quote', 'card', contentLength);
</script>

<template>
  <div class="group relative flex flex-col gap-2.5 p-4 border bg-mono-900 rounded-lg hover:border-mono-600 transition-colors cursor-pointer" :class="quote.posted ? 'border-emerald-700' : 'border-mono-800'" @click="emit('present', quote)">

    <!-- Header -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <span class="bg-accent text-accent-text px-2 py-0.5 text-xs font-bold uppercase tracking-wider">
          quote
        </span>
        <span v-if="quote.version && quote.version > 1" class="bg-gold text-gold-text px-2 py-0.5 text-xs font-bold uppercase tracking-wider">
          v{{ quote.version }}
        </span>
      </div>

      <div class="flex items-center gap-2 sm:gap-3 relative">
        <!-- Action buttons -->
        <div class="flex items-center gap-2 sm:absolute sm:right-0 sm:hidden sm:group-hover:flex">
          <button @click.stop="emit('togglePosted', quote)" class="p-1.5 rounded cursor-pointer transition-all active:scale-95" :class="quote.posted ? 'bg-emerald-600 active:bg-emerald-500 sm:hover:bg-emerald-500 text-white' : 'bg-mono-700 active:bg-mono-600 sm:hover:bg-mono-600 text-mono-300'" :title="quote.posted ? 'Mark as Unposted' : 'Mark as Posted'">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" class="sm:w-3.5 sm:h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </button>
          <button @click.stop="emit('copy', quote)" class="p-1.5 bg-accent active:bg-accent-bright sm:hover:bg-accent-bright text-white rounded cursor-pointer transition-all active:scale-95" title="Copy Quote">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" class="sm:w-3.5 sm:h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
              <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
            </svg>
          </button>
          <button @click.stop="emit('edit', quote)" class="p-1.5 bg-accent active:bg-accent-bright sm:hover:bg-accent-bright text-white rounded cursor-pointer transition-all active:scale-95" title="Edit Quote">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" class="sm:w-3.5 sm:h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
              <path d="m15 5 4 4" />
            </svg>
          </button>
          <button @click.stop="emit('addToThread', quote)" class="flex p-1.5 text-mono-500 hover:text-purple-400 hover:bg-purple-500/10 rounded cursor-pointer transition-all active:scale-95" title="Add to Thread">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8Z" />
              <path d="M12 8v8" /><path d="M8 12h8" />
            </svg>
          </button>
          <button @click.stop="emit('delete', quote)" class="flex p-1.5 text-mono-500 hover:text-red-400 hover:bg-red-500/10 rounded cursor-pointer transition-all active:scale-95" title="Delete Quote">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 6h18" />
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
              <line x1="10" x2="10" y1="11" y2="17" />
              <line x1="14" x2="14" y1="11" y2="17" />
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Content -->
    <div class="mt-1 text-mono-100">
      <blockquote lang="en" :class="[typographyClass, lineHeightClass, 'text-mono-100 border-l-4 border-accent pl-4 py-1']" :style="{ fontSize: quoteFontSize + 'px' }" v-html="highlightText(quote.quote)"></blockquote>
      <!-- Book attribution (when linked to book) -->
      <div v-if="book" class="text-mono-400 text-sm mt-3 space-y-0.5">
        <p class="font-medium text-mono-300">— {{ book.author }}</p>
        <p class="flex items-center gap-1.5 flex-wrap">
          <template v-if="pdfUrlWithPage">
            <a :href="pdfUrlWithPage" target="_blank" @click.stop class="italic underline hover:text-accent transition-colors">{{ book.title }}</a>
          </template>
          <template v-else>
            <span class="italic">{{ book.title }}</span>
          </template>
          <span v-if="book.originally_published" class="text-mono-500">({{ book.originally_published }})</span>
          <span v-if="quote.page" class="text-mono-500">p. {{ quote.page }}</span>
        </p>
      </div>
      <!-- Fallback attribution (no book linked) -->
      <div v-else-if="connectedAuthor" class="text-sm mt-3 relative">
        <button @click.stop="toggleAuthorPopover" class="inline-flex items-center gap-1.5 group/author cursor-pointer">
          <span class="font-medium text-mono-300">—</span>
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-mono-500 group-hover/author:text-accent transition-colors shrink-0">
            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          <span class="font-medium text-mono-300 underline decoration-mono-600 underline-offset-2 group-hover/author:text-accent group-hover/author:decoration-accent transition-colors">{{ connectedAuthor.name }}</span>
        </button>
        <AuthorPopover v-if="showAuthorPopover" :author="connectedAuthor" @close="showAuthorPopover = false" @viewInLibrary="handleViewInLibrary" />
      </div>
      <div v-else-if="quote.creator || quote.work" class="text-mono-400 text-sm mt-3 space-y-0.5">
        <p v-if="quote.creator" class="font-medium text-mono-300">— {{ quote.creator }}</p>
        <p v-if="quote.work" class="italic">{{ quote.work }}</p>
      </div>
    </div>

    <!-- Footer: Tags -->
    <div v-if="quote.tags && quote.tags.length" class="mt-2 flex flex-wrap gap-2">
      <span v-for="tag in quote.tags" :key="tag" class="text-xs text-mono-500 hover:text-accent cursor-pointer transition-colors">
        #{{ tag }}
      </span>
    </div>

  </div>
</template>
