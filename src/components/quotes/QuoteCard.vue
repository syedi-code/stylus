<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue';
import { fetchBookById, getSignedFileUrl, fetchConnections, fetchAuthorById, type Quote, type Book, type Author } from '../../lib/api';
import { formatMarkdown } from '../../lib/formatText';
import { useTypography } from '../../composables/useTypography';
import { useDynamicContentFontSize } from '../../composables/useDynamicContentFontSize';
import { variantForSeed, textureAsset } from '../../composables/usePresentationQuoteMode';
import AuthorPopover from '../library/AuthorPopover.vue';
import EssayQuoteCite from '../essays/blocks/EssayQuoteCite.vue';

const props = defineProps<{
  quote: Quote;
  searchQuery?: string;
  isAdmin?: boolean;
  /** Position in the list — drives the staggered unfurl-in delay. */
  index?: number;
}>();

// Staggered entrance: each card unfurls 70ms after the previous, capped so a
// long list doesn't leave the tail sitting blank. Self-contained here (rather
// than via a parent scoped keyframe) so it fires reliably on every mount.
const unfurlDelay = computed(() => `${Math.min(props.index ?? 0, 12) * 70}ms`);

const emit = defineEmits<{
  (e: 'edit', quote: Quote): void;
  (e: 'copy', quote: Quote): void;
  (e: 'present', quote: Quote): void;
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

// Actions live behind the ⋯ toggle — popped up as a row at the card's foot.
const showActions = ref(false);
const toggleActions = (e: Event) => {
  e.stopPropagation();
  showActions.value = !showActions.value;
};

const highlightText = (text: string | undefined) => {
  if (!text) return '';
  let result = formatMarkdown(text);
  if (props.searchQuery && props.searchQuery.length >= 2) {
    const regex = new RegExp(`(${props.searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    result = result.replace(regex, '<mark class="search-highlight">$1</mark>');
  }
  return result;
};

const contentLength = computed(() => props.quote.quote?.length ?? 0);
const { typographyClass } = useTypography('quote', 'card', contentLength);

const quoteFontSize = useDynamicContentFontSize(contentLength, {
  mobile: [
    { maxLength: 80, size: 18.5 },
    { maxLength: 180, size: 16.5 },
    { maxLength: 320, size: 15 },
    { maxLength: 550, size: 13.5 },
    { maxLength: 850, size: 12.5 },
    { maxLength: Infinity, size: 12 },
  ],
  desktop: [
    { maxLength: 80, size: 20 },
    { maxLength: 180, size: 18 },
    { maxLength: 350, size: 16 },
    { maxLength: 600, size: 14.5 },
    { maxLength: 900, size: 13.5 },
    { maxLength: Infinity, size: 12.5 },
  ],
  desktopScaleBreaks: [
    { width: 1100, factor: 0.92 }, // medium browser window
    { width: 1400, factor: 0.96 }, // laptop
  ],
});

// Stable per-quote texture (dark textured card + gilt ring, no toggle here).
// Rendered as a real, natively lazy <img> (not a ::before background) so iOS
// Safari decodes/evicts/repaints it reliably and a long feed doesn't retain
// every off-screen card's decoded bitmap. `--gilt` tints the ring emerald for
// posted quotes.
const textureSrc = computed(() => textureAsset(variantForSeed(props.quote.id), 'card'));
const giltStyle = computed(() => (props.quote.posted ? { '--gilt': '#047857' } : {}));
</script>

<template>
  <div class="group cursor-pointer quote-in" :style="{ animationDelay: unfurlDelay }" @click="emit('present', quote)">
    <div class="is-textured" :style="giltStyle">
      <img class="tex-img" :src="textureSrc" alt="" aria-hidden="true" decoding="async" loading="lazy" />
      <div class="quote-card relative z-10 flex flex-col gap-2.5">

        <!-- Content -->
        <blockquote lang="en" :class="[typographyClass, 'qc-body whitespace-pre-wrap']" :style="{ fontSize: quoteFontSize + 'px', lineHeight: 'var(--content-leading)', hyphens: 'none' }">
          <span class="qc-mark" aria-hidden="true">&ldquo;</span><span v-html="highlightText(quote.quote)"></span><span class="qc-mark" aria-hidden="true">&rdquo;</span>
        </blockquote>

        <!-- Tags -->
        <div v-if="quote.tags && quote.tags.length" class="flex flex-wrap gap-2">
          <span v-for="tag in quote.tags" :key="tag" class="text-xs text-mono-500 hover:text-quote cursor-pointer transition-colors">
            #{{ tag }}
          </span>
        </div>

        <!-- Actions trigger — reserved footer strip, bottom-right -->
        <div class="flex items-center justify-end h-5 -mb-1 -mr-1.5">
          <button @click.stop="toggleActions" class="p-1.5 rounded-full text-mono-500 hover:text-white hover:bg-white/10 transition-colors cursor-pointer" aria-label="Quote actions">
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="5" cy="12" r="1.6" />
              <circle cx="12" cy="12" r="1.6" />
              <circle cx="19" cy="12" r="1.6" />
            </svg>
          </button>
        </div>

        <!-- Action row — revealed by ⋯ -->
        <div v-if="showActions" class="flex gap-2 pt-2.5 border-t border-white/10">
          <button @click.stop="emit('copy', quote)" class="flex-1 h-8 rounded-md bg-mono-800 hover:bg-mono-700 text-mono-300 hover:text-quote-bright flex items-center justify-center transition-colors cursor-pointer" title="Copy Quote">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
              <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
            </svg>
          </button>
          <button @click.stop="emit('edit', quote)" class="flex-1 h-8 rounded-md bg-mono-800 hover:bg-mono-700 text-mono-300 hover:text-quote-bright flex items-center justify-center transition-colors cursor-pointer" title="Edit Quote">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
              <path d="m15 5 4 4" />
            </svg>
          </button>
          <button @click.stop="emit('addToThread', quote)" class="flex-1 h-8 rounded-md bg-mono-800 hover:bg-mono-700 text-mono-300 hover:text-purple-400 flex items-center justify-center transition-colors cursor-pointer" title="Add to Thread">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8Z" />
              <path d="M12 8v8" /><path d="M8 12h8" />
            </svg>
          </button>
          <button @click.stop="emit('delete', quote)" class="flex-1 h-8 rounded-md bg-mono-800 hover:bg-red-500/20 text-mono-300 hover:text-red-400 flex items-center justify-center transition-colors cursor-pointer" title="Delete Quote">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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

    <!-- Book / author info — floats outside the card, mirroring the Essay
         Quote presentation credit (EssayQuoteCite: "— author / in title,
         p. N / published year"). -->
    <EssayQuoteCite
      v-if="book"
      class="mt-2 px-4"
      presentation
      :author="book.author"
      :title="book.title"
      :year="book.originally_published"
      :page="quote.page"
      :title-href="pdfUrlWithPage || undefined"
    />
    <!-- Fallback attribution (no book linked) -->
    <div v-else-if="connectedAuthor" class="text-sm mt-2 px-4 relative text-right">
      <button @click.stop="toggleAuthorPopover" class="inline-flex items-center gap-1.5 group/author cursor-pointer">
        <span class="font-medium text-mono-300">—</span>
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-mono-500 group-hover/author:text-quote transition-colors shrink-0">
          <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
        <span class="font-medium text-mono-300 underline decoration-mono-600 underline-offset-2 group-hover/author:text-quote group-hover/author:decoration-quote transition-colors">{{ connectedAuthor.name }}</span>
      </button>
      <AuthorPopover v-if="showAuthorPopover" :author="connectedAuthor" @close="showAuthorPopover = false" @viewInLibrary="handleViewInLibrary" />
    </div>
    <div v-else-if="quote.creator || quote.work" class="text-mono-400 text-sm mt-2 px-4 text-right space-y-0.5">
      <p v-if="quote.creator" class="font-medium text-mono-300">— {{ quote.creator }}</p>
      <p v-if="quote.work" class="italic">{{ quote.work }}</p>
    </div>

  </div>
</template>

<style scoped>
/* Cards unfurl in — mirrors the Notes deal entrance (same easing), staggered
   per card via the inline animation-delay. `both` holds the from-state before
   the delay elapses so early frames don't flash the final position. */
.quote-in {
  animation: quote-unfurl 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
}

@keyframes quote-unfurl {
  from {
    opacity: 0;
    transform: translateY(16px) scale(0.97);
  }

  to {
    opacity: 1;
    transform: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .quote-in {
    animation: none;
  }
}
</style>
