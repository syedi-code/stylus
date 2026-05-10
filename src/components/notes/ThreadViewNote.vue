<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue';
import { fetchBookById, getSignedFileUrl, fetchConnections, fetchAuthorById, type Note, type Book, type Author } from '../../lib/api';
import { formatMarkdown } from '../../lib/formatText';
import { useTypography } from '../../composables/useTypography';
import BookAttribution from '../books/BookAttribution.vue';

const props = defineProps<{
  note: Note;
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
  const printPage = parsePrintPage(props.note.page);
  if (printPage === null || !book.value) return null;
  return printPage + (book.value.pdf_page_offset || 0);
});

const pdfUrlWithPage = computed(() => {
  if (!pdfUrl.value) return null;
  const pdfPage = getPdfPage.value;
  return pdfPage !== null ? `${pdfUrl.value}#page=${pdfPage}` : pdfUrl.value;
});

const loadBook = async () => {
  if (props.note.book_id) {
    try {
      fetchedBook.value = await fetchBookById(props.note.book_id);
      if (fetchedBook.value?.pdf_url) {
        const path = fetchedBook.value.pdf_url.replace('/files/', '');
        fetchedPdfUrl.value = await getSignedFileUrl(path);
      }
    } catch { /* ignore */ }
  }
};

const loadAuthorConnection = async () => {
  if (props.note.book_id) return;
  try {
    const conns = await fetchConnections('note', props.note.id, 'author');
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

watch(() => props.note.book_id, () => {
  fetchedBook.value = null;
  fetchedPdfUrl.value = null;
  if (props.resolvedBook === undefined) {
    loadBook();
  }
});

const formattedContent = computed(() => formatMarkdown(props.note.content || ''));

const contentLength = computed(() => props.note.content?.length ?? 0);
const { baseFontSize, lineHeightClass, typographyClass } = useTypography('note', 'thread', contentLength);
</script>

<template>
  <div class="flex flex-col gap-1.5 p-3 sm:p-4 border border-accent/20 bg-mono-900 rounded-lg">
    <!-- Type badge -->
    <div class="flex items-center gap-1.5">
      <span class="bg-accent text-accent-text px-1.5 py-px text-[10px] font-bold uppercase tracking-wider">
        note
      </span>
      <span v-if="note.version && note.version > 1" class="bg-gold text-gold-text px-1.5 py-px text-[10px] font-bold uppercase tracking-wider">
        v{{ note.version }}
      </span>
    </div>

    <!-- Book Attribution -->
    <BookAttribution
      v-if="book"
      variant="note"
      :author="book.author"
      :title="book.title"
      :year="book.originally_published"
      :page="note.page"
      :title-href="pdfUrlWithPage"
    />

    <!-- Author Attribution (no book) -->
    <div v-else-if="connectedAuthor" class="text-xs text-mono-500 leading-relaxed">
      <span class="underline decoration-mono-600 underline-offset-2 text-mono-400">{{ connectedAuthor.name }}</span>
    </div>

    <!-- Free-text Attribution (no book, no author connection) -->
    <div v-else-if="note.creator || note.work" class="text-xs text-mono-500 leading-relaxed">
      <p v-if="note.creator" class="font-medium text-mono-400">{{ note.creator }}</p>
      <p v-if="note.work" class="italic">{{ note.work }}</p>
    </div>

    <!-- Content -->
    <p v-if="note.content" :class="[typographyClass, lineHeightClass, 'whitespace-pre-wrap text-mono-100']" :style="{ fontSize: baseFontSize + 'px' }" v-html="formattedContent"></p>

    <!-- Tags -->
    <div v-if="note.tags && note.tags.length" class="flex flex-wrap gap-2 mt-1">
      <span v-for="tag in note.tags" :key="tag" class="text-xs text-mono-500">
        #{{ tag }}
      </span>
    </div>
  </div>
</template>
