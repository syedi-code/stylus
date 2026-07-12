<script setup lang="ts">
import { ref, watch, computed, onMounted } from 'vue';
import type { Book, ConnectionInput, EntityType } from '../../lib/api';
import BookSelector from './BookSelector.vue';
import AuthorSelector from './AuthorSelector.vue';

export type SourceMode = 'none' | 'book' | 'author' | 'other';

export interface SourceAttribution {
  mode: SourceMode;
  // Book mode
  bookId?: string;
  book?: Book | null;
  page?: string;
  // Author mode
  authorId?: string;
  // Other mode (free-text)
  creator?: string;
  work?: string;
  kind?: string;
}

const props = withDefaults(defineProps<{
  /** Which entity type is the "owner" (note, quote) — used to build connections */
  entityType: EntityType;
  /** UUID of the entity being created/edited — if known (for edit flows) */
  entityId?: string;
  /** Initial attribution to pre-populate (for edit flows) */
  initial?: Partial<SourceAttribution>;
  /** Compact mode for mobile */
  compact?: boolean;
}>(), {
  compact: false,
});

const emit = defineEmits<{
  (e: 'update', value: SourceAttribution): void;
}>();

const mode = ref<SourceMode>(props.initial?.mode ?? 'none');

// Book mode state
const selectedBookId = ref<string | null>(props.initial?.bookId ?? null);
const selectedBook = ref<Book | null>(props.initial?.book ?? null);
const pageRef = ref(props.initial?.page ?? '');

// Author mode state
const selectedAuthorId = ref(props.initial?.authorId ?? '');

// Other mode state
const otherCreator = ref(props.initial?.creator ?? '');
const otherWork = ref(props.initial?.work ?? '');
const otherKind = ref(props.initial?.kind ?? '');

// Auto-open flags for smooth UX on mode pill click
const autoOpenBook = ref(false);
const autoOpenAuthor = ref(false);

const kindOptions = ['book', 'article', 'podcast', 'video', 'movie', 'tv', 'game', 'song'];

// Emit initial state on mount so the parent's currentAttribution is
// correctly set even when the user never interacts with this component.
onMounted(() => {
  emitUpdate();
});

// Watch initial prop for edit flows
watch(() => props.initial, (newVal) => {
  if (newVal) {
    mode.value = newVal.mode ?? 'none';
    selectedBookId.value = newVal.bookId ?? null;
    selectedBook.value = newVal.book ?? null;
    pageRef.value = newVal.page ?? '';
    selectedAuthorId.value = newVal.authorId ?? '';
    otherCreator.value = newVal.creator ?? '';
    otherWork.value = newVal.work ?? '';
    otherKind.value = newVal.kind ?? '';
  }
}, { deep: true });

// Clear irrelevant state when mode changes
watch(mode, (newMode, oldMode) => {
  if (newMode !== oldMode) {
    if (newMode !== 'book') {
      selectedBookId.value = null;
      selectedBook.value = null;
      pageRef.value = '';
      autoOpenBook.value = false;
    }
    if (newMode !== 'author') {
      selectedAuthorId.value = '';
      autoOpenAuthor.value = false;
    }
    if (newMode !== 'other') {
      otherCreator.value = '';
      otherWork.value = '';
      otherKind.value = '';
    }
    // Trigger auto-open for the newly selected mode
    if (newMode === 'book' && !selectedBookId.value) {
      autoOpenBook.value = true;
    }
    if (newMode === 'author' && !selectedAuthorId.value) {
      autoOpenAuthor.value = true;
    }
    emitUpdate();
  }
});

// Clear page ref when book is deselected
watch(selectedBookId, (newId) => {
  if (!newId) {
    pageRef.value = '';
  }
  emitUpdate();
});

watch([selectedAuthorId, otherCreator, otherWork, otherKind, pageRef], () => {
  emitUpdate();
});

const attribution = computed<SourceAttribution>(() => ({
  mode: mode.value,
  bookId: mode.value === 'book' ? (selectedBookId.value ?? undefined) : undefined,
  book: mode.value === 'book' ? selectedBook.value : undefined,
  page: mode.value === 'book' ? pageRef.value || undefined : undefined,
  authorId: mode.value === 'author' ? selectedAuthorId.value || undefined : undefined,
  creator: mode.value === 'other' ? otherCreator.value || undefined : undefined,
  work: mode.value === 'other' ? otherWork.value || undefined : undefined,
  kind: mode.value === 'other' ? otherKind.value || undefined : undefined,
}));

function emitUpdate() {
  emit('update', attribution.value);
}

/**
 * Build ConnectionInput[] for the current attribution state.
 * Called by parent form when creating/saving an entity.
 */
function buildConnections(entityId: string): ConnectionInput[] {
  const entityType = props.entityType;
  if (mode.value === 'book' && selectedBookId.value) {
    const metadata = pageRef.value ? JSON.stringify({ page: pageRef.value }) : undefined;
    return [{
      a_type: entityType < 'book' ? entityType : 'book',
      a_id: entityType < 'book' ? entityId : selectedBookId.value,
      b_type: entityType < 'book' ? 'book' : entityType,
      b_id: entityType < 'book' ? selectedBookId.value : entityId,
      metadata,
    }];
  }
  if (mode.value === 'author' && selectedAuthorId.value) {
    return [{
      a_type: entityType < 'author' ? entityType : 'author',
      a_id: entityType < 'author' ? entityId : selectedAuthorId.value,
      b_type: entityType < 'author' ? 'author' : entityType,
      b_id: entityType < 'author' ? selectedAuthorId.value : entityId,
    }];
  }
  // 'other' and 'none' produce no connections (other uses free-text fields on the entity row)
  return [];
}

/** Reset all state */
function reset() {
  // Return to the configured default mode (not hard 'none') so capture
  // surfaces that default to book-linking stay in book mode after a save.
  mode.value = props.initial?.mode ?? 'none';
  selectedBookId.value = null;
  selectedBook.value = null;
  pageRef.value = '';
  selectedAuthorId.value = '';
  otherCreator.value = '';
  otherWork.value = '';
  otherKind.value = '';
  autoOpenBook.value = false;
  autoOpenAuthor.value = false;
}

defineExpose({ attribution, buildConnections, reset, mode, selectedBook, selectedBookId, pageRef, selectedAuthorId, otherCreator, otherWork, otherKind });
</script>

<template>
  <div class="flex flex-col gap-2">
    <!-- Header + mode selector -->
    <div class="flex items-center justify-center gap-2">
      <!-- Link icon -->
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-mono-500 shrink-0">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      </svg>

      <!-- Mode selector — one contained segmented control: joined options
           read as a single mutually-exclusive choice (common region), and the
           selected segment is a fill, not just an outline, so state is
           legible without comparing borders. Sentence case for readability. -->
      <div class="inline-flex items-stretch rounded-lg border border-mono-800 bg-mono-900/60 overflow-hidden">
        <button type="button" @click="mode = 'none'" class="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold leading-none transition-colors duration-150 cursor-pointer" :class="mode === 'none' ? 'bg-mono-700 text-white' : 'text-mono-500 hover:text-mono-300 hover:bg-mono-800/60'">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="m18.84 12.25 1.72-1.71h-.02a5.004 5.004 0 0 0-.12-7.07 5.006 5.006 0 0 0-6.95 0l-1.72 1.71" />
            <path d="m5.17 11.75-1.71 1.71a5.004 5.004 0 0 0 .12 7.07 5.006 5.006 0 0 0 6.95 0l1.71-1.71" />
            <line x1="8" x2="8" y1="2" y2="5" />
            <line x1="2" x2="5" y1="8" y2="8" />
            <line x1="16" x2="16" y1="19" y2="22" />
            <line x1="19" x2="22" y1="16" y2="16" />
          </svg>
          None
        </button>
        <button type="button" @click="mode = 'book'" class="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold leading-none transition-colors duration-150 cursor-pointer border-l border-mono-800" :class="mode === 'book' ? 'bg-mono-700 text-white' : 'text-mono-500 hover:text-mono-300 hover:bg-mono-800/60'">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" :class="mode === 'book' ? 'text-gold' : ''">
            <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20" />
          </svg>
          Book
        </button>
        <button type="button" @click="mode = 'author'" class="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold leading-none transition-colors duration-150 cursor-pointer border-l border-mono-800" :class="mode === 'author' ? 'bg-mono-700 text-white' : 'text-mono-500 hover:text-mono-300 hover:bg-mono-800/60'">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" :class="mode === 'author' ? 'text-accent-bright' : ''">
            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          Author
        </button>
        <button type="button" @click="mode = 'other'" class="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold leading-none transition-colors duration-150 cursor-pointer border-l border-mono-800" :class="mode === 'other' ? 'bg-mono-700 text-white' : 'text-mono-500 hover:text-mono-300 hover:bg-mono-800/60'">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="1" />
            <circle cx="19" cy="12" r="1" />
            <circle cx="5" cy="12" r="1" />
          </svg>
          Other
        </button>
      </div>
    </div>

    <!-- Active mode content with left accent border -->
    <div v-if="mode !== 'none'" class="pl-3 border-l-2 border-accent/30 ml-1.5 flex flex-col gap-2">
      <!-- Book mode -->
      <template v-if="mode === 'book'">
        <BookSelector v-model="selectedBookId" v-model:book="selectedBook" :autoOpen="autoOpenBook" />
        <div v-if="selectedBookId" class="flex items-center gap-2">
          <span class="text-xs text-mono-500 uppercase tracking-wide shrink-0">Page(s)</span>
          <input v-model="pageRef" type="text" placeholder="e.g., 42, 42-45, xiv" class="flex-1 bg-mono-900 border border-mono-800 rounded-lg px-3 py-1.5 text-sm text-mono-100 placeholder:text-mono-600 focus:outline-none focus:border-accent" />
        </div>
      </template>

      <!-- Author mode -->
      <template v-if="mode === 'author'">
        <AuthorSelector v-model="selectedAuthorId" :autoOpen="autoOpenAuthor" />
      </template>

      <!-- Other mode (free-text) -->
      <template v-if="mode === 'other'">
        <div class="grid gap-3" :class="compact ? 'grid-cols-1' : 'grid-cols-2'">
          <input v-model="otherCreator" type="text" placeholder="Creator / Author" class="bg-mono-900 border border-mono-800 rounded-lg px-3 py-2 text-sm text-mono-100 placeholder:text-mono-600 focus:outline-none focus:border-accent" />
          <input v-model="otherWork" type="text" placeholder="Work / Source" class="bg-mono-900 border border-mono-800 rounded-lg px-3 py-2 text-sm text-mono-100 placeholder:text-mono-600 focus:outline-none focus:border-accent" />
        </div>
        <select v-model="otherKind" class="bg-mono-900 border border-mono-800 rounded-lg px-3 py-2 text-sm text-mono-100 focus:outline-none focus:border-accent w-fit">
          <option value="">Kind (optional)</option>
          <option v-for="k in kindOptions" :key="k" :value="k">{{ k }}</option>
        </select>
      </template>
    </div>
  </div>
</template>
