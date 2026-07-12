<script setup lang="ts">
import { computed, ref, watch, nextTick, onMounted } from 'vue';
import { getSignedFileUrlCached, type Note, type Book, type Author, type Thread } from '../../lib/api';
import { formatMarkdown } from '../../lib/formatText';
import { dynamicLineHeight } from '../../composables/useTypography';
import { useViewportWidth } from '../../composables/useViewportWidth';
import AuthorPopover from '../library/AuthorPopover.vue';
import SkeletonBlock from '../shared/SkeletonBlock.vue';
import BookAttribution from '../books/BookAttribution.vue';

const props = defineProps<{
  note: Note;
  searchQuery?: string;
  isAdmin?: boolean;
  /** Resolved book for note.book_id. `undefined` = still resolving (skeleton), `null` = none. */
  book?: Book | null;
  /** Author connected directly to the note (only relevant when there is no book). */
  connectedAuthor?: Author | null;
  /** Most recently updated thread containing this note. */
  latestThread?: Thread | null;
  /** Clamp long content with a fade + expand toggle (used in search results). */
  clamp?: boolean;
  /** 'deal' = shuffle card (provenance, plaque type); 'list' = dense results. */
  variant?: 'deal' | 'list';
}>();

const emit = defineEmits<{
  (e: 'edit', note: Note): void;
  (e: 'copy', note: Note): void;
  (e: 'present', note: Note): void;
  (e: 'delete', note: Note): void;
  (e: 'viewInLibrary', authorId: string): void;
  (e: 'addToThread', note: Note): void;
  (e: 'navigateToThread', threadId: string): void;
}>();

// Signed PDF URL — shared per-path cache dedupes requests across cards
const pdfUrl = ref<string | null>(null);

const showAuthorPopover = ref(false);

// Attribution skeleton: the parent passes `undefined` while the book map /
// batched lookups are still loading, and a value (or null) once resolved.
const loadingAttribution = computed(
  () => !!props.note.book_id && props.book === undefined
);

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
  if (printPage === null || !props.book) return null;
  const offset = props.book.pdf_page_offset || 0;
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

watch(
  () => props.book,
  async (book) => {
    if (book?.pdf_url) {
      try {
        const path = book.pdf_url.replace('/files/', '');
        pdfUrl.value = await getSignedFileUrlCached(path);
      } catch (err) {
        console.error('Failed to sign PDF URL:', err);
      }
    } else {
      pdfUrl.value = null;
    }
  },
  { immediate: true }
);

const formattedDate = computed(() => {
  const dateStr = props.note.originalCreatedAt || props.note.created_at;
  return new Date(dateStr).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
});

// ============================================================================
// Deal variant: provenance (temporal distance) + length-responsive type
// ============================================================================

const isDeal = computed(() => props.variant === 'deal');

/** "16 months ago" — how far back this thought was written. */
const distanceLabel = computed(() => {
  const created = new Date(props.note.originalCreatedAt || props.note.created_at);
  const days = Math.floor((Date.now() - created.getTime()) / 86_400_000);
  if (days < 45) return `${Math.max(days, 1)} day${days === 1 ? '' : 's'} ago`;
  const months = Math.round(days / 30.44);
  if (months < 24) return `${months} months ago`;
  const years = Math.floor(months / 12);
  return `${years} year${years === 1 ? '' : 's'} ago`;
});

/** "first surfacing" | "last seen Mar 3" — shuffle history. */
const lastSeenLabel = computed(() => {
  const surfaced = props.note.last_surfaced_at;
  if (!surfaced) return 'first surfacing';
  const d = new Date(surfaced);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  const date = d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
  return `last seen ${date}`;
});

/**
 * Distance tint: hue stays on NOTE blue, saturation does the talking —
 * fresh notes sit near-gray (8%), 18-month-old notes reach full saturation.
 */
const distanceColor = computed(() => {
  const created = new Date(props.note.originalCreatedAt || props.note.created_at);
  const months = (Date.now() - created.getTime()) / (86_400_000 * 30.44);
  const t = Math.min(1, Math.max(0, months / 18));
  const sat = Math.round(8 + t * 92); // 8% → 100%
  const light = Math.round(62 + t * 6); // 62% → 68%
  return `hsl(226, ${sat}%, ${light}%)`;
});

/**
 * Aphorisms are set like plaques; longer notes step down. Size also tracks
 * the window — medium-width browser windows get a smaller cut so the
 * measure stays sensible.
 */
const vw = useViewportWidth();
const dealFontSize = computed(() => {
  const len = props.note.content?.length ?? 0;
  let base: number;
  if (len <= 200) base = 20;
  else if (len <= 450) base = 16.5;
  else base = 14.5;
  if (vw.value < 640) base *= 0.92; // phone
  else if (vw.value < 1100) base *= 0.88; // medium browser window
  else if (vw.value < 1400) base *= 0.94; // laptop
  return Math.round(base * 10) / 10;
});

const bodyClass = computed(() =>
  isDeal.value ? '' : 'text-sm leading-[1.25]'
);

/** Deal variant: px sizing + the shared presentation line-height curve. */
const bodyStyle = computed(() => {
  if (!isDeal.value) return {};
  return {
    fontSize: `${dealFontSize.value}px`,
    lineHeight: String(dynamicLineHeight(dealFontSize.value)),
  };
});

// Mobile: actions live behind the ⋯ toggle
const showMobileActions = ref(false);
const toggleMobileActions = (e: Event) => {
  e.stopPropagation();
  showMobileActions.value = !showMobileActions.value;
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

// ============================================================================
// Content clamping (grid view): clamp long notes, show fade + expand toggle
// only when the content actually overflows the line clamp.
// ============================================================================

const bodyEl = ref<HTMLElement | null>(null);
const expanded = ref(false);
const clampable = ref(false);

const checkClampable = async () => {
  if (!props.clamp) {
    clampable.value = false;
    return;
  }
  await nextTick();
  const el = bodyEl.value;
  if (el) {
    // +2px tolerance for sub-pixel rounding
    clampable.value = el.scrollHeight > el.clientHeight + 2;
  }
};

onMounted(checkClampable);
watch(() => [props.clamp, props.note.content], () => {
  expanded.value = false;
  checkClampable();
});

const toggleExpand = (e: Event) => {
  e.stopPropagation();
  expanded.value = !expanded.value;
};
</script>

<template>
  <div class="group relative flex flex-col gap-2.5 p-4 border bg-mono-900 rounded-lg hover:border-mono-600 transition-colors cursor-pointer" :class="note.posted ? 'border-emerald-700' : 'border-mono-800'" @click="emit('present', note)">

    <!-- Header: Type & Provenance/Date -->
    <div class="flex items-center justify-between" :class="isDeal ? 'sm:mb-1' : ''">
      <div class="flex items-baseline gap-2 min-w-0 flex-1 mr-2">
        <span class="bg-accent text-accent-text px-2 py-0.5 text-xs font-bold uppercase tracking-wider shrink-0">
          note
        </span>
        <span v-if="note.version && note.version > 1" class="bg-gold text-gold-text px-2 py-0.5 text-xs font-bold uppercase tracking-wider shrink-0">
          v{{ note.version }}
        </span>
        <!-- Deal: provenance — distance + shuffle history -->
        <span v-if="isDeal" class="text-[11.5px] truncate">
          <span :style="{ color: distanceColor }">{{ distanceLabel }}</span><span class="text-mono-500"> · <span :class="note.last_surfaced_at ? '' : 'text-mono-400'">{{ lastSeenLabel }}</span></span>
        </span>
      </div>

      <div class="flex items-center gap-2 sm:gap-3 relative">
        <!-- Desktop: Date shown by default (list variant), invisible on hover -->
        <time v-if="!isDeal" :datetime="note.created_at" class="hidden sm:inline sm:group-hover:opacity-0 sm:group-hover:invisible text-xs text-mono-500 font-medium py-1.5">{{ formattedDate }}</time>

        <!-- Mobile: actions live behind ⋯ — negative margins keep the tap
             target 44px-ish without inflating the header row height, so the
             badge→attribution gap matches the presentation view (mb-1.5). -->
        <button @click="toggleMobileActions" class="sm:hidden p-1.5 -my-1.5 -mr-1 text-mono-600 active:text-mono-300 transition-colors" aria-label="Note actions">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" />
          </svg>
        </button>

        <!-- Desktop hover actions -->
        <div class="hidden sm:absolute sm:right-0 sm:group-hover:flex items-center gap-2">
          <button @click.stop="emit('copy', note)" class="p-1.5 bg-accent hover:bg-accent-bright text-white rounded cursor-pointer transition-all active:scale-95" title="Copy Note">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" class="sm:w-3.5 sm:h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
              <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
            </svg>
          </button>
          <button @click.stop="emit('edit', note)" class="p-1.5 bg-accent hover:bg-accent-bright text-white rounded cursor-pointer transition-all active:scale-95" title="Edit Note">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" class="sm:w-3.5 sm:h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
              <path d="m15 5 4 4" />
            </svg>
          </button>
          <button @click.stop="emit('addToThread', note)" class="flex p-1.5 text-mono-500 hover:text-purple-400 hover:bg-purple-500/10 rounded cursor-pointer transition-all active:scale-95" title="Add to Thread">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8Z" />
              <path d="M12 8v8" /><path d="M8 12h8" />
            </svg>
          </button>
          <button @click.stop="emit('delete', note)" class="flex p-1.5 text-mono-500 hover:text-red-400 hover:bg-red-500/10 rounded cursor-pointer transition-all active:scale-95" title="Delete Note">
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
    <!-- Content — on mobile, pull up so badge→attribution spacing mirrors
         the presentation view's mb-1.5 (card root gap is 10px; -mt-1 ≈ 6px). -->
    <div class="text-mono-100" :class="isDeal ? 'max-sm:-mt-1' : 'max-sm:-mt-1 sm:-mt-1.5'">
      <!-- Attribution Loading Skeleton -->
      <div v-if="loadingAttribution && (note.book_id)" class="mb-3.5 space-y-1.5">
        <SkeletonBlock widthClass="w-24" heightClass="h-3" />
        <SkeletonBlock widthClass="w-48" heightClass="h-3" />
      </div>
      <!-- Book Attribution -->
      <BookAttribution
        v-else-if="book"
        class="mb-3.5"
        variant="note"
        muted-title
        :author="book.author"
        :title="book.title"
        :year="book.originally_published"
        :page="note.page"
        :title-href="pdfUrlWithPage"
      />
      <!-- Author Attribution (no book, connected via connections table) -->
      <div v-else-if="connectedAuthor" class="mb-3.5 text-xs text-mono-500 leading-relaxed relative">
        <button @click="toggleAuthorPopover" class="underline decoration-mono-600 underline-offset-2 hover:text-accent hover:decoration-accent transition-colors cursor-pointer">{{ connectedAuthor.name }}</button>
        <AuthorPopover v-if="showAuthorPopover" :author="connectedAuthor" @close="showAuthorPopover = false" @viewInLibrary="handleViewInLibrary" />
      </div>
      <!-- Free-text Attribution (no book, no author connection) -->
      <div v-else-if="note.creator || note.work" class="mb-3.5 text-xs text-mono-500 leading-relaxed">
        <p v-if="note.creator" class="font-medium text-mono-400">{{ note.creator }}</p>
        <p v-if="note.work" class="italic">{{ note.work }}</p>
      </div>
      <div v-if="note.content" class="relative">
        <p ref="bodyEl" class="typography-prose whitespace-pre-wrap text-white" :class="[bodyClass, clamp && !expanded ? 'line-clamp-8 sm:line-clamp-12' : '']" :style="bodyStyle" v-html="highlightText(note.content)"></p>
        <div v-if="clamp && clampable && !expanded" class="absolute inset-x-0 bottom-0 h-10 bg-linear-to-b from-transparent to-mono-900 pointer-events-none"></div>
      </div>
      <button v-if="clamp && clampable" @click="toggleExpand" class="block mt-1.5 text-[10.5px] uppercase tracking-wide text-accent-bright hover:text-accent transition-colors cursor-pointer">
        {{ expanded ? '↑ collapse' : '↕ expand' }}
      </button>
    </div>

    <!-- Mobile action row — revealed by ⋯, inline, thumb-height -->
    <div v-if="showMobileActions" class="sm:hidden flex gap-2 pt-2.5 mt-0.5 border-t border-mono-800">
      <button @click.stop="emit('present', note)" class="flex-1 h-8 rounded-md bg-mono-800 text-mono-300 flex items-center justify-center active:bg-mono-700 transition-colors" title="Present">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="6 3 20 12 6 21 6 3" /></svg>
      </button>
      <button @click.stop="emit('edit', note)" class="flex-1 h-8 rounded-md bg-mono-800 text-mono-300 flex items-center justify-center active:bg-mono-700 transition-colors" title="Edit">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></svg>
      </button>
      <button @click.stop="emit('copy', note)" class="flex-1 h-8 rounded-md bg-mono-800 text-mono-300 flex items-center justify-center active:bg-mono-700 transition-colors" title="Copy">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></svg>
      </button>
      <button @click.stop="emit('addToThread', note)" class="flex-1 h-8 rounded-md bg-mono-800 text-mono-300 flex items-center justify-center active:bg-mono-700 transition-colors" title="Add to Thread">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8Z" /><path d="M12 8v8" /><path d="M8 12h8" /></svg>
      </button>
      <button @click.stop="emit('delete', note)" class="flex-1 h-8 rounded-md bg-mono-800 text-mono-500 flex items-center justify-center active:bg-red-500/10 active:text-red-400 transition-colors" title="Delete">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /><line x1="10" x2="10" y1="11" y2="17" /><line x1="14" x2="14" y1="11" y2="17" /></svg>
      </button>
    </div>

    <!-- Footer: Tags -->
    <div v-if="note.tags && note.tags.length" class="mt-2 flex flex-wrap gap-2">
      <span v-for="tag in note.tags" :key="tag" class="text-xs text-mono-500 hover:text-accent cursor-pointer transition-colors">
        #{{ tag }}
      </span>
    </div>

    <!-- Mobile Date Footer (list variant only — deal shows provenance up top) -->
    <time v-if="!isDeal" :datetime="note.created_at" class="sm:hidden text-xs text-mono-500 font-medium pt-1.5 border-t border-mono-800">{{ formattedDate }}</time>

  </div>
</template>
