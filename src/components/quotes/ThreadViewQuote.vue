<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue';
import { fetchBookById, getSignedFileUrl, fetchConnections, fetchAuthorById, type Quote, type Book, type Author } from '../../lib/api';
import { formatMarkdown } from '../../lib/formatText';
import { useTypography } from '../../composables/useTypography';
import BookAttribution from '../books/BookAttribution.vue';

const props = defineProps<{
  quote: Quote;
  resolvedBook?: Book | null;
  resolvedPdfUrl?: string | null;
  resolvedAuthor?: Author | null;
}>();

const fetchedBook = ref<Book | null>(null);
const fetchedPdfUrl = ref<string | null>(null);
const fetchedAuthor = ref<Author | null>(null);

// Use pre-resolved data from ThreadDetail if provided, otherwise fall back to fetched
const book = computed(() => props.resolvedBook !== undefined ? props.resolvedBook : fetchedBook.value);
const pdfUrl = computed(() => props.resolvedPdfUrl !== undefined ? props.resolvedPdfUrl : fetchedPdfUrl.value);
const connectedAuthor = computed(() => props.resolvedAuthor !== undefined ? props.resolvedAuthor : fetchedAuthor.value);

const parsePrintPage = (pageStr: string | undefined): number | null => {
  if (!pageStr) return null;
  const match = pageStr.match(/^(\d+)/);
  return match ? parseInt(match[1], 10) : null;
};

const getPdfPage = computed(() => {
  const printPage = parsePrintPage(props.quote.page);
  if (printPage === null || !book.value) return null;
  return printPage + (book.value.pdf_page_offset || 0);
});

const pdfUrlWithPage = computed(() => {
  if (!pdfUrl.value) return null;
  const pdfPage = getPdfPage.value;
  return pdfPage !== null ? `${pdfUrl.value}#page=${pdfPage}` : pdfUrl.value;
});

const loadBook = async () => {
  if (props.quote.book_id) {
    try {
      fetchedBook.value = await fetchBookById(props.quote.book_id);
      if (fetchedBook.value?.pdf_url) {
        const path = fetchedBook.value.pdf_url.replace('/files/', '');
        fetchedPdfUrl.value = await getSignedFileUrl(path);
      }
    } catch { /* ignore */ }
  }
};

const loadAuthorConnection = async () => {
  if (props.quote.book_id || props.quote.creator) return;
  try {
    const conns = await fetchConnections('quote', props.quote.id, 'author');
    if (conns.length > 0) {
      const conn = conns[0];
      const authorId = conn.a_type === 'author' ? conn.a_id : conn.b_id;
      fetchedAuthor.value = await fetchAuthorById(authorId);
    }
  } catch { /* ignore */ }
};

onMounted(() => {
  // Skip fetching if pre-resolved data was provided (e.g., from ThreadDetail)
  if (props.resolvedBook === undefined && props.resolvedAuthor === undefined) {
    loadBook();
    loadAuthorConnection();
  }
});

watch(() => props.quote.book_id, () => {
  fetchedBook.value = null;
  fetchedPdfUrl.value = null;
  if (props.resolvedBook === undefined) {
    loadBook();
  }
});

const formattedQuote = computed(() => formatMarkdown(props.quote.quote || ''));

const contentLength = computed(() => props.quote.quote?.length ?? 0);
const { baseFontSize, lineHeightClass, typographyClass } = useTypography('quote', 'thread', contentLength);
</script>

<template>
  <div class="flex flex-col gap-1.5 p-3 sm:p-4 border border-accent/20 bg-mono-900 rounded-lg">
    <!-- Content -->
    <blockquote lang="en" :class="[typographyClass, lineHeightClass, 'text-mono-100 border-l-4 border-accent pl-4 sm:pr-2 py-2 whitespace-pre-wrap']" :style="{ fontSize: baseFontSize + 'px' }" v-html="formattedQuote"></blockquote>

    <!-- Book attribution -->
    <BookAttribution
      v-if="book"
      variant="thread"
      dash
      :author="book.author"
      :title="book.title"
      :year="book.originally_published"
      :page="quote.page"
      :title-href="pdfUrlWithPage"
    />

    <!-- Connected author attribution -->
    <div v-else-if="connectedAuthor" class="text-xs flex items-center gap-1.5">
      <span class="font-medium text-mono-300">—</span>
      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-mono-500 shrink-0">
        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
      <span class="font-medium text-mono-300">{{ connectedAuthor.name }}</span>
    </div>

    <!-- Fallback attribution -->
    <div v-else-if="quote.creator || quote.work" class="text-mono-400 text-xs space-y-0.5">
      <p v-if="quote.creator" class="font-medium text-mono-300">— {{ quote.creator }}</p>
      <p v-if="quote.work" class="italic">{{ quote.work }}</p>
    </div>

    <!-- Tags -->
    <div v-if="quote.tags && quote.tags.length" class="flex flex-wrap gap-2 mt-1">
      <span v-for="tag in quote.tags" :key="tag" class="text-xs text-mono-500">
        #{{ tag }}
      </span>
    </div>
  </div>
</template>
