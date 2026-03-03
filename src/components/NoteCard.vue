<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue';
import { fetchBookById, getSignedFileUrl, fetchConnections, fetchAuthorById, type Note, type Book, type Author } from '../lib/api';
import { formatMarkdown } from '../lib/formatText';
import AuthorPopover from './AuthorPopover.vue';
import SkeletonBlock from './SkeletonBlock.vue';

const props = defineProps<{
  note: Note;
  searchQuery?: string;
  isAdmin?: boolean;
}>();

const emit = defineEmits<{
  (e: 'edit', note: Note): void;
  (e: 'copy', note: Note): void;
  (e: 'present', note: Note): void;
  (e: 'togglePosted', note: Note): void;
  (e: 'convertToThought', note: Note): void;
  (e: 'delete', note: Note): void;
  (e: 'viewInLibrary', authorId: string): void;
  (e: 'addToThread', note: Note): void;
}>();

// Book data for notes with book_id
const book = ref<Book | null>(null);
const pdfUrl = ref<string | null>(null);

// Author connection (when note is linked to author directly, not via book)
const connectedAuthor = ref<Author | null>(null);
const showAuthorPopover = ref(false);

// Loading state for book/author attribution
const loadingAttribution = ref(false);

const toggleAuthorPopover = (e: Event) => {
  e.stopPropagation();
  showAuthorPopover.value = !showAuthorPopover.value;
};

const handleViewInLibrary = (authorId: string) => {
  showAuthorPopover.value = false;
  emit('viewInLibrary', authorId);
};

// Parse page string to get first page number for PDF linking
const parsePrintPage = (pageStr: string | undefined): number | null => {
  if (!pageStr) return null;
  const match = pageStr.match(/^(\d+)/);
  if (match) {
    return parseInt(match[1], 10);
  }
  return null;
};

// Calculate PDF page from print page using book's offset
const getPdfPage = computed(() => {
  const printPage = parsePrintPage(props.note.page);
  if (printPage === null || !book.value) return null;
  const offset = book.value.pdf_page_offset || 0;
  return printPage + offset;
});

// Generate PDF URL with page fragment
const pdfUrlWithPage = computed(() => {
  if (!pdfUrl.value) return null;
  const pdfPage = getPdfPage.value;
  if (pdfPage !== null) {
    return `${pdfUrl.value}#page=${pdfPage}`;
  }
  return pdfUrl.value;
});

const loadBook = async () => {
  if (props.note.book_id && !book.value) {
    try {
      book.value = await fetchBookById(props.note.book_id);
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
  // Only check for author connections when there's no book_id
  if (props.note.book_id || connectedAuthor.value) return;
  try {
    const conns = await fetchConnections('note', props.note.id, 'author');
    if (conns.length > 0) {
      const conn = conns[0];
      // Resolve which side is the author
      const authorId = conn.a_type === 'author' ? conn.a_id : conn.b_id;
      connectedAuthor.value = await fetchAuthorById(authorId);
    }
  } catch (err) {
    // Connections may not exist yet (pre-migration data)
  }
};

onMounted(async () => {
  if (props.note.book_id || !props.note.book_id) {
    loadingAttribution.value = true;
  }
  try {
    await Promise.all([loadBook(), loadAuthorConnection()]);
  } finally {
    loadingAttribution.value = false;
  }
});

watch(() => props.note.book_id, () => {
  book.value = null;
  pdfUrl.value = null;
  loadBook();
});

const formattedDate = computed(() => {
  const dateStr = props.note.originalCreatedAt || props.note.created_at;
  return new Date(dateStr).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
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
</script>

<template>
  <div class="group relative flex flex-col gap-2.5 p-4 border bg-mono-900 rounded-lg hover:border-mono-600 transition-colors cursor-pointer" :class="note.posted ? 'border-emerald-700' : 'border-mono-800'" @click="emit('present', note)">

    <!-- Header: Type & Date -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <span class="bg-accent text-accent-text px-2 py-0.5 text-xs font-bold uppercase tracking-wider">
          note
        </span>
        <span v-if="note.version && note.version > 1" class="bg-gold text-gold-text px-2 py-0.5 text-xs font-bold uppercase tracking-wider">
          v{{ note.version }}
        </span>
      </div>

      <div class="flex items-center gap-2 sm:gap-3 relative">
        <!-- Desktop: Date shown by default, invisible on hover -->
        <time :datetime="note.created_at" class="hidden sm:inline sm:group-hover:opacity-0 sm:group-hover:invisible text-xs text-mono-500 font-medium py-1.5">{{ formattedDate }}</time>

        <!-- Action buttons -->
        <div class="flex items-center gap-2 sm:absolute sm:right-0 sm:hidden sm:group-hover:flex">
          <button @click.stop="emit('togglePosted', note)" class="p-1.5 rounded cursor-pointer transition-all active:scale-95" :class="note.posted ? 'bg-emerald-600 active:bg-emerald-500 sm:hover:bg-emerald-500 text-white' : 'bg-mono-700 active:bg-mono-600 sm:hover:bg-mono-600 text-mono-300'" :title="note.posted ? 'Mark as Unposted' : 'Mark as Posted'">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" class="sm:w-3.5 sm:h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </button>
          <button @click.stop="emit('copy', note)" class="p-1.5 bg-accent active:bg-accent-bright sm:hover:bg-accent-bright text-white rounded cursor-pointer transition-all active:scale-95" title="Copy Note">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" class="sm:w-3.5 sm:h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
              <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
            </svg>
          </button>
          <button v-if="props.isAdmin" @click.stop="emit('edit', note)" class="p-1.5 bg-accent active:bg-accent-bright sm:hover:bg-accent-bright text-white rounded cursor-pointer transition-all active:scale-95" title="Edit Note">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" class="sm:w-3.5 sm:h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
              <path d="m15 5 4 4" />
            </svg>
          </button>
          <button @click.stop="emit('convertToThought', note)" class="flex p-1.5 text-mono-500 hover:text-rose-bright hover:bg-rose/10 rounded cursor-pointer transition-all active:scale-95" title="Convert to Thought">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </button>
          <button @click.stop="emit('addToThread', note)" class="flex p-1.5 text-mono-500 hover:text-purple-400 hover:bg-purple-500/10 rounded cursor-pointer transition-all active:scale-95" title="Add to Thread">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8Z" />
              <path d="M12 8v8" /><path d="M8 12h8" />
            </svg>
          </button>
          <button v-if="props.isAdmin" @click.stop="emit('delete', note)" class="hidden sm:flex p-1.5 text-mono-500 hover:text-red-400 hover:bg-red-500/10 rounded cursor-pointer transition-all active:scale-95" title="Delete Note">
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
      <!-- Attribution Loading Skeleton -->
      <div v-if="loadingAttribution && (note.book_id)" class="mb-2 space-y-1.5">
        <SkeletonBlock widthClass="w-24" heightClass="h-3" />
        <SkeletonBlock widthClass="w-48" heightClass="h-3" />
      </div>
      <!-- Book Attribution -->
      <div v-else-if="book" class="mb-2 text-xs text-mono-500 leading-relaxed">
        <a v-if="pdfUrlWithPage" :href="pdfUrlWithPage" target="_blank" @click.stop class="hover:text-accent transition-colors">{{ book.author }}</a>
        <span v-else>{{ book.author }}</span>
        <br />
        <template v-if="pdfUrlWithPage">
          <a :href="pdfUrlWithPage" target="_blank" @click.stop class="underline hover:text-accent transition-colors">{{ book.title }}</a><span v-if="book.originally_published"> ({{ book.originally_published }})</span><span v-if="note.page">, p. {{ note.page }}</span>
        </template>
        <template v-else>
          <span>{{ book.title }}<span v-if="book.originally_published"> ({{ book.originally_published }})</span><span v-if="note.page">, p. {{ note.page }}</span></span>
        </template>
      </div>
      <!-- Author Attribution (no book, connected via connections table) -->
      <div v-else-if="connectedAuthor" class="mb-2 text-xs text-mono-500 leading-relaxed relative">
        <button @click="toggleAuthorPopover" class="underline decoration-mono-600 underline-offset-2 hover:text-accent hover:decoration-accent transition-colors cursor-pointer">{{ connectedAuthor.name }}</button>
        <AuthorPopover v-if="showAuthorPopover" :author="connectedAuthor" @close="showAuthorPopover = false" @viewInLibrary="handleViewInLibrary" />
      </div>
      <p v-if="note.content" class="typography-prose whitespace-pre-wrap leading-relaxed text-sm" v-html="highlightText(note.content)"></p>
    </div>

    <!-- Footer: Tags -->
    <div v-if="note.tags && note.tags.length" class="mt-2 flex flex-wrap gap-2">
      <span v-for="tag in note.tags" :key="tag" class="text-xs text-mono-500 hover:text-accent cursor-pointer transition-colors">
        #{{ tag }}
      </span>
    </div>

    <!-- Mobile Date Footer -->
    <time :datetime="note.created_at" class="sm:hidden text-xs text-mono-500 font-medium pt-1.5 border-t border-mono-800">{{ formattedDate }}</time>

  </div>
</template>
