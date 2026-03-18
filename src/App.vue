<script setup lang="ts">
import { ref, watch, computed, onMounted, onUnmounted } from 'vue';
import { fetchNotes, fetchBooks, updateNote, deleteNote, fetchQuotes, updateQuote, deleteQuote, createThought, type Note, type Quote, type Book, type Thought } from './lib/api';
import { useAuth } from './lib/auth';
import { usePagination } from './composables/usePagination';
import NoteCard from './components/NoteCard.vue';
import NoteCardSkeleton from './components/NoteCardSkeleton.vue';
import QuoteCard from './components/QuoteCard.vue';
import FilterBar from './components/FilterBar.vue';
import CaptureForm from './components/CaptureForm.vue';
import AppHeader from './components/AppHeader.vue';
import EditNoteModal from './components/EditNoteModal.vue';
import EditQuoteModal from './components/EditQuoteModal.vue';
import EditBookModal from './components/EditBookModal.vue';
import AuthorManager from './components/AuthorManager.vue';
import EditAuthorModal from './components/EditAuthorModal.vue';
import PresentationViewNote from './components/PresentationViewNote.vue';
import PresentationViewQuote from './components/PresentationViewQuote.vue';
import PresentationModeThoughts from './components/PresentationModeThoughts.vue';
import MobileNoteCapture from './components/MobileNoteCapture.vue';
import MobileQuoteCapture from './components/MobileQuoteCapture.vue';
import QuoteCaptureForm from './components/QuoteCaptureForm.vue';
import ThoughtCapture from './components/ThoughtCapture.vue';
import ThoughtsList from './components/ThoughtsList.vue';
import MobileThoughtCapture from './components/MobileThoughtCapture.vue';
import ConvertToThoughtModal from './components/ConvertToThoughtModal.vue';
import AddToThreadModal from './components/AddToThreadModal.vue';
import ThreadDetail from './components/ThreadDetail.vue';
import EditThoughtModal from './components/EditThoughtModal.vue';
import ConfirmModal from './components/ConfirmModal.vue';
import { fetchThreads, deleteThreadApi, type Thread } from './lib/api';

const { isAdmin, user: authUser, init: initAuth, logout } = useAuth();

const notesPagination = usePagination<Note, { search?: string }>({
  fetchFn: (params) => fetchNotes({ ...params }),
  pageSize: 30,
});
const { loading, error } = notesPagination;
const currentTab = ref('notes');

// Infinite scroll sentinel
const notesScrollSentinel = ref<HTMLElement | null>(null);
let notesObserver: IntersectionObserver | null = null;

// Mobile detection
const isMobile = ref(false);
const checkMobile = () => {
  isMobile.value = window.innerWidth < 640;
};

onMounted(async () => {
  checkMobile();
  window.addEventListener('resize', checkMobile);

  // Resolve auth BEFORE loading data — the first /api/me call warms the
  // Worker's JWKS cache so subsequent data requests don't get 401s.
  await initAuth();

  // Load initial data based on default tab
  if (currentTab.value === 'notes') loadNotes();
  if (currentTab.value === 'quotes') loadQuotes();

  // Set up infinite scroll observer for notes
  notesObserver = new IntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting && notesPagination.hasMore.value && !notesPagination.loadingMore.value) {
        notesPagination.loadMore();
      }
    },
    { rootMargin: '200px' }
  );
});

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile);
  notesObserver?.disconnect();
});

// Mobile quick capture
const mobileNoteOpen = ref(false);
const mobileQuoteOpen = ref(false);
const mobileThoughtOpen = ref(false);

// Thoughts tab
const thoughtsListRef = ref<InstanceType<typeof ThoughtsList> | null>(null);

// Editing
const editingNote = ref<Note | null>(null);
const editingQuote = ref<Quote | null>(null);
const editingThought = ref<Thought | null>(null);
const editingFromThreadId = ref<string | null>(null);
const threadDetailRefs = new Map<string, InstanceType<typeof ThreadDetail>>();

// Book editing
const editingBook = ref<Book | null>(null);
const showBookModal = ref(false);

// Author editing
const editingAuthor = ref<import('./lib/api').Author | null>(null);
const showAuthorModal = ref(false);
const authorManagerRef = ref<InstanceType<typeof AuthorManager> | null>(null);

const handleEditAuthor = (author: import('./lib/api').Author) => {
  editingAuthor.value = author;
  showAuthorModal.value = true;
};

const handleAddAuthor = () => {
  editingAuthor.value = null;
  showAuthorModal.value = true;
};

const handleAuthorSaved = () => {
  showAuthorModal.value = false;
  editingAuthor.value = null;
  authorManagerRef.value?.loadAuthors();
};

// Presentation mode
const presentingNote = ref<Note | null>(null);
const presentingQuote = ref<Quote | null>(null);
const presentingThought = ref<Thought | null>(null);

const handleThreadPresentItem = (entityType: string, entity: any) => {
  if (!entity) return;
  if (entityType === 'note') presentingNote.value = entity;
  else if (entityType === 'quote') presentingQuote.value = entity;
  else if (entityType === 'thought') presentingThought.value = entity;
};

const handleThreadEditItem = (threadId: string, entityType: string, entity: any) => {
  if (!entity) return;
  editingFromThreadId.value = threadId;
  if (entityType === 'note') editingNote.value = entity;
  else if (entityType === 'quote') editingQuote.value = entity;
  else if (entityType === 'thought') editingThought.value = entity;
};

const reloadEditingThread = async () => {
  const threadId = editingFromThreadId.value;
  editingFromThreadId.value = null;
  if (threadId) {
    const ref = threadDetailRefs.get(threadId);
    if (ref?.loadThread) await ref.loadThread();
  }
};

const handleThreadThoughtSaved = async (_updatedThought: Thought) => {
  editingThought.value = null;
  await reloadEditingThread();
};

const handleEditNote = (note: Note) => {
  editingNote.value = note;
};

const handleEditQuote = (quote: Quote) => {
  editingQuote.value = quote;
};

const handleCopyNote = async (note: Note) => {
  if (note.content) {
    await navigator.clipboard.writeText(note.content);
  }
};

const handleCopyQuote = async (quote: Quote) => {
  if (quote.quote) {
    await navigator.clipboard.writeText(quote.quote);
  }
};

const handleNoteSaved = async () => {
  const scrollY = window.scrollY;
  editingNote.value = null;
  await loadNotes();
  await reloadEditingThread();
  requestAnimationFrame(() => {
    window.scrollTo(0, scrollY);
  });
};

const handleQuoteSaved = async () => {
  const scrollY = window.scrollY;
  editingQuote.value = null;
  await loadQuotes();
  await reloadEditingThread();
  requestAnimationFrame(() => {
    window.scrollTo(0, scrollY);
  });
};

const handleEditBook = (book: Book) => {
  editingBook.value = book;
  showBookModal.value = true;
};

const handleAddBook = () => {
  editingBook.value = null;
  showBookModal.value = true;
};

const handleBookSaved = () => {
  showBookModal.value = false;
  editingBook.value = null;
  authorManagerRef.value?.loadAuthors();
};

const handleToggleNotePosted = async (note: Note) => {
  const newPostedStatus = !note.posted;
  try {
    await updateNote(note.id, { posted: newPostedStatus });
    notesPagination.updateItem(
      (n) => n.id === note.id,
      (n) => ({ ...n, posted: newPostedStatus })
    );
  } catch (err) {
    console.error('Failed to update posted status:', err);
  }
};

const handleToggleQuotePosted = async (quote: Quote) => {
  const newPostedStatus = !quote.posted;
  try {
    await updateQuote(quote.id, { posted: newPostedStatus });
    const idx = quotes.value.findIndex(q => q.id === quote.id);
    if (idx !== -1) {
      quotes.value[idx] = { ...quotes.value[idx], posted: newPostedStatus };
    }
  } catch (err) {
    console.error('Failed to update posted status:', err);
  }
};

// Convert to Thought modal
const convertingNote = ref<Note | null>(null);
const convertLoading = ref(false);

const handleConvertToThought = (note: Note) => {
  if (!note.content) return;
  convertingNote.value = note;
};

const confirmConvertToThought = async () => {
  const note = convertingNote.value;
  if (!note?.content) return;

  convertLoading.value = true;
  try {
    await createThought({
      content: note.content,
      author: 'web',
      created_at: note.originalCreatedAt || note.created_at,
    });

    await deleteNote(note.id);

    convertingNote.value = null;
    await loadNotes();
  } catch (err) {
    console.error('Failed to convert note to thought:', err);
  } finally {
    convertLoading.value = false;
  }
};

const handleDeleteNote = async (note: Note) => {
  if (!confirm('Are you sure you want to delete this note? This action cannot be undone.')) {
    return;
  }

  try {
    await deleteNote(note.id);
    notesPagination.removeItem((n) => n.id === note.id);
  } catch (err) {
    console.error('Failed to delete note:', err);
  }
};

const handleDeleteQuote = async (quote: Quote) => {
  if (!confirm('Are you sure you want to delete this quote? This action cannot be undone.')) {
    return;
  }

  try {
    await deleteQuote(quote.id);
    quotes.value = quotes.value.filter(q => q.id !== quote.id);
  } catch (err) {
    console.error('Failed to delete quote:', err);
  }
};

// Filters
const search = ref('');
const postedFilter = ref<'all' | 'posted' | 'unposted'>('all');
const showVersionBadgeInPresentation = ref(true);
const bookFilter = ref('all');
const filterBooks = ref<Book[]>([]);

// Threads tab state
const threads = ref<Thread[]>([]);
const threadsLoading = ref(false);
const threadsError = ref<string | null>(null);
const threadsSearch = ref('');
const showNewThreadForm = ref(false);
const newThreadName = ref('');
const newThreadDesc = ref('');

// Add to Thread modal
const threadModalOpen = ref(false);
const threadModalEntityType = ref('');
const threadModalEntityId = ref('');

// Quotes tab state
const quotes = ref<Quote[]>([]);
const quotesLoading = ref(false);
const quotesError = ref<string | null>(null);
const quotesSearch = ref('');

// Computed
const filteredNotes = computed(() => {
  const allNotes = notesPagination.items.value;
  if (!allNotes.length) return [];

  const noteMap = new Map(allNotes.map(n => [n.id, n]));
  const replacedIds = new Set<string>();

  allNotes.forEach(n => {
    if (n.replaces) replacedIds.add(n.replaces);
  });

  let processed = allNotes
    .filter(n => !replacedIds.has(n.id))
    .map(n => {
      let version = 1;
      let current = n;
      while (current.replaces && noteMap.has(current.replaces)) {
        version++;
        current = noteMap.get(current.replaces)!;
      }
      return {
        ...n,
        version,
        originalCreatedAt: current.created_at
      };
    });

  // Apply posted filter
  if (postedFilter.value === 'posted') {
    processed = processed.filter(n => n.posted === true);
  } else if (postedFilter.value === 'unposted') {
    processed = processed.filter(n => !n.posted);
  }

  // Apply book filter
  if (bookFilter.value === 'no-book') {
    processed = processed.filter(n => !n.book_id);
  } else if (bookFilter.value !== 'all') {
    processed = processed.filter(n => n.book_id === bookFilter.value);
  }

  // Sort by original creation date (newest first)
  return processed.sort((a, b) =>
    new Date(b.originalCreatedAt!).getTime() - new Date(a.originalCreatedAt!).getTime()
  );
});

// Debounce timer
let debounceTimer: ReturnType<typeof setTimeout>;

const loadNotes = async () => {
  const params: any = {};
  if (search.value) params.search = search.value;

  await notesPagination.reset(params);

  if (filterBooks.value.length === 0) {
    try {
      filterBooks.value = await fetchBooks({ limit: 500 });
    } catch (err) {
      console.error('Failed to load books for filter:', err);
    }
  }
};

// Quotes filtered computed
const filteredQuotes = computed(() => {
  if (!quotes.value.length) return [];

  const quoteMap = new Map(quotes.value.map(q => [q.id, q]));
  const replacedIds = new Set<string>();

  quotes.value.forEach(q => {
    if (q.replaces) replacedIds.add(q.replaces);
  });

  let processed = quotes.value
    .filter(q => !replacedIds.has(q.id))
    .map(q => {
      let version = 1;
      let current = q;
      while (current.replaces && quoteMap.has(current.replaces)) {
        version++;
        current = quoteMap.get(current.replaces)!;
      }
      return {
        ...q,
        version,
        originalCreatedAt: current.created_at
      };
    });

  // Sort by original creation date (newest first)
  return processed.sort((a, b) =>
    new Date(b.originalCreatedAt!).getTime() - new Date(a.originalCreatedAt!).getTime()
  );
});

const loadQuotes = async () => {
  quotesLoading.value = true;
  quotesError.value = null;

  try {
    const params: any = { limit: 5000 };
    if (quotesSearch.value) params.search = quotesSearch.value;

    quotes.value = await fetchQuotes(params);
  } catch (err) {
    console.error(err);
    quotesError.value = 'Failed to load quotes. Check API Key and connection.';
  } finally {
    quotesLoading.value = false;
  }
};

// Debounce timer for quotes search
let quotesDebounceTimer: ReturnType<typeof setTimeout>;

watch([quotesSearch], () => {
  clearTimeout(quotesDebounceTimer);
  quotesDebounceTimer = setTimeout(() => {
    if (currentTab.value === 'quotes') loadQuotes();
  }, 300);
});

watch([search], () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    if (currentTab.value === 'notes') loadNotes();
  }, 300);
});

// Watch the sentinel element and connect/disconnect the observer
watch(notesScrollSentinel, (el, oldEl) => {
  if (oldEl) notesObserver?.unobserve(oldEl);
  if (el) notesObserver?.observe(el);
});

watch(currentTab, (newTab) => {
  if (newTab === 'notes') {
    loadNotes();
  }
  if (newTab === 'quotes') {
    loadQuotes();
  }
  if (newTab === 'threads') {
    loadThreads();
  }
});

const handleViewInLibrary = (_authorId: string) => {
  currentTab.value = 'library';
};

// ============================================================================
// Threads
// ============================================================================

const loadThreads = async () => {
  threadsLoading.value = true;
  threadsError.value = null;
  try {
    const params: any = { limit: 500 };
    if (threadsSearch.value) params.search = threadsSearch.value;
    threads.value = await fetchThreads(params);
  } catch (err) {
    console.error('Failed to load threads:', err);
    threadsError.value = 'Failed to load threads.';
  } finally {
    threadsLoading.value = false;
  }
};

const handleCreateNewThread = async () => {
  if (!newThreadName.value.trim()) return;
  try {
    const { createThreadApi } = await import('./lib/api');
    await createThreadApi({
      name: newThreadName.value.trim(),
      description: newThreadDesc.value.trim() || undefined,
    });
    newThreadName.value = '';
    newThreadDesc.value = '';
    showNewThreadForm.value = false;
    await loadThreads();
  } catch (err) {
    console.error('Failed to create thread:', err);
  }
};

const deletingThread = ref<Thread | null>(null);

const handleDeleteThread = (thread: Thread) => {
  deletingThread.value = thread;
};

const confirmDeleteThread = async () => {
  const thread = deletingThread.value;
  if (!thread) return;
  deletingThread.value = null;
  try {
    await deleteThreadApi(thread.id);
    threads.value = threads.value.filter(t => t.id !== thread.id);
  } catch (err) {
    console.error('Failed to delete thread:', err);
  }
};

const openAddToThread = (entityType: string, entityId: string) => {
  threadModalEntityType.value = entityType;
  threadModalEntityId.value = entityId;
  threadModalOpen.value = true;
};

const handleAddNoteToThread = (note: Note) => openAddToThread('note', note.id);
const handleAddQuoteToThread = (quote: Quote) => openAddToThread('quote', quote.id);
const handleAddThoughtToThread = (thought: any) => openAddToThread('thought', thought.id);

const handleNavigateToThread = (_threadId: string) => {
  threadModalOpen.value = false;
  currentTab.value = 'threads';
  loadThreads();
};

// Thread accordion expansion state
const expandedThreads = ref<Set<string>>(new Set());
const toggleThread = (id: string) => {
  const next = new Set(expandedThreads.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  expandedThreads.value = next;
};



let threadsDebounceTimer: ReturnType<typeof setTimeout>;
watch([threadsSearch], () => {
  clearTimeout(threadsDebounceTimer);
  threadsDebounceTimer = setTimeout(() => {
    if (currentTab.value === 'threads') loadThreads();
  }, 300);
});
</script>

<template>
  <div class="min-h-screen bg-mono-950 text-mono-100 selection:bg-accent selection:text-white">

    <AppHeader v-model:currentTab="currentTab" :userEmail="authUser?.email ?? null" @logout="logout" />

    <main class="w-full">
      <div class="max-w-3xl mx-auto px-4 mt-4 sm:mt-8 pb-20">

        <!-- Notes Tab -->
        <transition name="fade" mode="out-in">
          <div v-if="currentTab === 'notes'" class="space-y-8">
            <!-- Desktop Capture Form -->
            <div class="hidden sm:block">
              <CaptureForm @saved="loadNotes" />
            </div>

            <!-- Divider -->
            <div class="hidden sm:block border-t border-accent/20"></div>

            <FilterBar v-model:search="search" v-model:showVersionBadge="showVersionBadgeInPresentation" v-model:bookFilter="bookFilter" :books="filterBooks" />

            <div class="space-y-4">
              <!-- Skeleton Loading -->
              <div v-if="loading" class="space-y-3">
                <NoteCardSkeleton v-for="i in 5" :key="i" />
              </div>

              <!-- Error -->
              <div v-else-if="error" class="p-6 border border-red-900 bg-red-950/20 text-center">
                <p class="text-red-500 font-bold uppercase text-sm mb-4">{{ error }}</p>
                <button @click="loadNotes" class="px-4 py-2 bg-red-900 hover:bg-red-800 text-white text-xs font-bold uppercase tracking-wide transition-colors">
                  Retry Connection
                </button>
              </div>

              <!-- Empty -->
              <div v-else-if="filteredNotes.length === 0" class="py-20 text-center text-mono-600 border border-dashed border-mono-800">
                <p class="text-sm uppercase tracking-wide">No logs found matching criteria.</p>
              </div>

              <!-- List -->
              <div v-else class="space-y-3">
                <NoteCard v-for="note in filteredNotes" :key="note.id" :note="note" :searchQuery="search" :isAdmin="isAdmin" @edit="handleEditNote" @copy="handleCopyNote" @present="presentingNote = $event" @togglePosted="handleToggleNotePosted" @convertToThought="handleConvertToThought" @delete="handleDeleteNote" @viewInLibrary="handleViewInLibrary" @addToThread="handleAddNoteToThread" />

                <!-- Scroll sentinel for infinite scroll -->
                <div ref="notesScrollSentinel" class="h-1"></div>

                <!-- Loading more spinner -->
                <div v-if="notesPagination.loadingMore.value" class="py-6 text-center">
                  <div class="inline-block animate-spin h-5 w-5 border-2 border-accent border-t-transparent rounded-full"></div>
                </div>
              </div>
            </div>
          </div>
        </transition>

        <!-- Quotes Tab -->
        <transition name="fade" mode="out-in">
          <div v-if="currentTab === 'quotes'" class="space-y-8">
            <!-- Desktop Quote Capture Form -->
            <div class="hidden sm:block">
              <QuoteCaptureForm @saved="loadQuotes" />
            </div>

            <!-- Divider -->
            <div class="hidden sm:block border-t border-accent/20"></div>

            <!-- Search bar for quotes -->
            <div class="mb-6">
              <input v-model="quotesSearch" type="text" placeholder="Search quotes..." class="w-full px-4 py-2.5 bg-mono-900 border border-mono-800 rounded-lg text-mono-100 placeholder-mono-600 focus:outline-none focus:border-accent transition-colors" />
            </div>

            <div class="space-y-4">
              <!-- Loading -->
              <div v-if="quotesLoading" class="py-20 text-center text-mono-600">
                <div class="inline-block animate-spin h-6 w-6 border-2 border-accent border-t-transparent rounded-full mb-4"></div>
                <p class="text-xs tracking-widest uppercase">Loading quotes...</p>
              </div>

              <!-- Error -->
              <div v-else-if="quotesError" class="p-6 border border-red-900 bg-red-950/20 text-center">
                <p class="text-red-500 font-bold uppercase text-sm mb-4">{{ quotesError }}</p>
                <button @click="loadQuotes" class="px-4 py-2 bg-red-900 hover:bg-red-800 text-white text-xs font-bold uppercase tracking-wide transition-colors cursor-pointer">
                  Retry Connection
                </button>
              </div>

              <!-- Empty -->
              <div v-else-if="filteredQuotes.length === 0" class="py-20 text-center text-mono-600 border border-dashed border-mono-800 rounded-lg">
                <p class="text-sm uppercase tracking-wide">No quotes found.</p>
              </div>

              <!-- Quotes List -->
              <div v-else class="space-y-4">
                <QuoteCard v-for="quote in filteredQuotes" :key="quote.id" :quote="quote" :searchQuery="quotesSearch" :isAdmin="isAdmin" @edit="handleEditQuote" @copy="handleCopyQuote" @present="presentingQuote = $event" @togglePosted="handleToggleQuotePosted" @viewInLibrary="handleViewInLibrary" @addToThread="handleAddQuoteToThread" @delete="handleDeleteQuote" />
              </div>
            </div>
          </div>
        </transition>

        <!-- Library Tab -->
        <transition name="fade" mode="out-in">
          <AuthorManager v-if="currentTab === 'library'" ref="authorManagerRef" :isAdmin="isAdmin" @edit="handleEditAuthor" @editBook="handleEditBook" @add="handleAddAuthor" @addBook="handleAddBook" />
        </transition>

        <!-- Thoughts Tab -->
        <transition name="fade" mode="out-in">
          <div v-if="currentTab === 'thoughts'" class="space-y-8">
            <!-- Desktop Capture Form -->
            <div class="hidden sm:block">
              <ThoughtCapture @saved="thoughtsListRef?.reload()" />
            </div>

            <!-- Divider -->
            <div class="hidden sm:block border-t border-rose/20"></div>

            <!-- Thoughts List -->
            <ThoughtsList ref="thoughtsListRef" :isAdmin="isAdmin" @addToThread="handleAddThoughtToThread" />
          </div>
        </transition>

        <!-- Threads Tab -->
        <transition name="fade" mode="out-in">
          <div v-if="currentTab === 'threads'" class="space-y-6">
            <!-- Header -->
            <div class="flex items-center justify-center gap-4">
              <h2 class="text-lg font-semibold tracking-tight text-white">threads</h2>
              <button @click="showNewThreadForm = true" class="px-3 py-1.5 text-xs font-semibold tracking-tight text-purple-300 border border-purple-500/30 hover:bg-purple-500/10 rounded-lg transition-colors cursor-pointer">
                + new thread
              </button>
            </div>

            <!-- Search -->
            <div>
              <input v-model="threadsSearch" type="text" placeholder="Search threads..." class="w-full px-4 py-2.5 bg-mono-900 border border-mono-800 rounded-lg text-mono-100 placeholder-mono-600 focus:outline-none focus:border-purple-500 transition-colors" />
            </div>

            <!-- Loading -->
            <div v-if="threadsLoading" class="py-20 text-center text-mono-600">
              <div class="inline-block animate-spin h-6 w-6 border-2 border-purple-500 border-t-transparent rounded-full mb-4"></div>
              <p class="text-xs tracking-widest uppercase">Loading threads...</p>
            </div>

            <!-- Error -->
            <div v-else-if="threadsError" class="p-6 border border-red-900 bg-red-950/20 text-center rounded-lg">
              <p class="text-red-500 font-bold uppercase text-sm mb-4">{{ threadsError }}</p>
              <button @click="loadThreads" class="px-4 py-2 bg-red-900 hover:bg-red-800 text-white text-xs font-bold uppercase tracking-wide transition-colors cursor-pointer">Retry</button>
            </div>

            <!-- Empty -->
            <div v-else-if="threads.length === 0" class="py-20 text-center text-mono-600 border border-dashed border-mono-800 rounded-lg">
              <p class="text-sm uppercase tracking-wide">No threads yet.</p>
              <p class="text-xs text-mono-700 mt-1">Create a thread to organize notes, quotes, thoughts, and books.</p>
            </div>

            <!-- Thread Accordion List -->
            <div v-else class="divide-y divide-mono-800/30">
              <div v-for="thread in threads" :key="thread.id" class="group/thread">

                <!-- Header Row -->
                <div class="flex items-center px-4 py-4 cursor-pointer" @click="toggleThread(thread.id)">
                  <!-- Left zone: delete button (appears on hover, admin only) -->
                  <div class="w-7 shrink-0">
                    <button @click.stop="handleDeleteThread(thread)" class="p-1 rounded-md text-mono-700 hover:text-red-500 cursor-pointer transition-colors" title="Delete Thread">
                      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M3 6h18" />
                        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                      </svg>
                    </button>
                  </div>

                  <!-- Center: name + item count + chevron -->
                  <div class="flex-1 flex items-center justify-center gap-2">
                    <span class="text-sm font-semibold tracking-tight lowercase transition-colors" :class="expandedThreads.has(thread.id) ? 'text-purple-300' : 'text-mono-300 group-hover/thread:text-purple-300'">
                      {{ thread.name.toLowerCase() }}
                    </span>
                    <svg class="w-3.5 h-3.5 shrink-0 transition-transform duration-300" :class="expandedThreads.has(thread.id) ? 'rotate-180 text-purple-400/60' : 'text-mono-600'" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </div>

                  <!-- Right spacer (mirrors left zone to keep center truly centered) -->
                  <div class="w-7 shrink-0"></div>
                </div>

                <!-- Expandable content -->
                <div v-if="expandedThreads.has(thread.id)">
                  <div class="pt-3 pb-8">
                    <ThreadDetail :ref="(el: any) => { if (el) threadDetailRefs.set(thread.id, el); else threadDetailRefs.delete(thread.id); }" :threadId="thread.id" :showHeader="false" :isAdmin="isAdmin" @presentItem="handleThreadPresentItem" @editItem="(type: string, entity: any) => handleThreadEditItem(thread.id, type, entity)" />
                  </div>
                </div>

              </div>
            </div>
          </div>
        </transition>
      </div>

      <EditNoteModal :isOpen="!!editingNote" :note="editingNote" @close="editingNote = null" @saved="handleNoteSaved" />

      <EditQuoteModal :isOpen="!!editingQuote" :quote="editingQuote" @close="editingQuote = null" @saved="handleQuoteSaved" />

      <EditThoughtModal :isOpen="!!editingThought" :thought="editingThought" @close="editingThought = null" @saved="handleThreadThoughtSaved" />

      <EditBookModal :isOpen="showBookModal" :book="editingBook" @close="showBookModal = false; editingBook = null" @saved="handleBookSaved" />

      <EditAuthorModal :isOpen="showAuthorModal" :author="editingAuthor" @close="showAuthorModal = false; editingAuthor = null" @saved="handleAuthorSaved" />

      <ConvertToThoughtModal :isOpen="!!convertingNote" :note="convertingNote" :loading="convertLoading" @close="convertingNote = null" @confirm="confirmConvertToThought" />

      <PresentationViewNote :isOpen="!!presentingNote" :note="presentingNote" :showVersionBadge="showVersionBadgeInPresentation" @close="presentingNote = null" />

      <PresentationViewQuote :isOpen="!!presentingQuote" :quote="presentingQuote" @close="presentingQuote = null" />

      <PresentationModeThoughts :isOpen="!!presentingThought" :thought="presentingThought" @close="presentingThought = null" />

      <AddToThreadModal :isOpen="threadModalOpen" :entityType="threadModalEntityType" :entityId="threadModalEntityId" @close="threadModalOpen = false" @updated="threadModalOpen = false" @navigateToThread="handleNavigateToThread" />

      <ConfirmModal :isOpen="!!deletingThread" title="Delete thread" :message="`Delete thread &quot;${deletingThread?.name}&quot;? Items will not be deleted.`" confirmLabel="Delete" @confirm="confirmDeleteThread" @cancel="deletingThread = null" />

      <!-- Mobile Quick Capture FAB -->
      <MobileNoteCapture :isOpen="mobileNoteOpen" @close="mobileNoteOpen = false" @saved="currentTab === 'notes' && loadNotes()" />

      <!-- Mobile Quote Capture -->
      <MobileQuoteCapture :isOpen="mobileQuoteOpen" @close="mobileQuoteOpen = false" @saved="loadQuotes()" />

      <!-- Mobile Thought Capture -->
      <MobileThoughtCapture :isOpen="mobileThoughtOpen" @close="mobileThoughtOpen = false" @saved="thoughtsListRef?.reload()" />

      <!-- New Thread Modal -->
      <Teleport to="body">
        <Transition name="fade">
          <div v-if="showNewThreadForm" class="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div class="absolute inset-0 bg-black/80 backdrop-blur-sm" @click="showNewThreadForm = false; newThreadName = ''; newThreadDesc = '';"></div>
            <div class="relative w-full max-w-sm bg-mono-900 border border-mono-700 shadow-2xl rounded-xl p-5 flex flex-col gap-4">
              <h3 class="text-base font-semibold tracking-tight text-white">new thread</h3>
              <div class="flex flex-col gap-1.5">
                <label class="text-xs text-mono-400 tracking-wide">name <span class="text-purple-400">*</span></label>
                <input v-model="newThreadName" type="text" class="w-full bg-mono-950 border border-mono-800 rounded-lg px-4 py-2.5 text-mono-100 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 text-sm placeholder-mono-600" placeholder="Thread name" @keydown.enter="handleCreateNewThread" />
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="text-xs text-mono-400 tracking-wide">description</label>
                <input v-model="newThreadDesc" type="text" class="w-full bg-mono-950 border border-mono-800 rounded-lg px-4 py-2.5 text-mono-100 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 text-sm placeholder-mono-600" placeholder="Optional description" @keydown.enter="handleCreateNewThread" />
              </div>
              <div class="flex items-center gap-3 pt-1">
                <button @click="handleCreateNewThread" :disabled="!newThreadName.trim()" class="flex-1 py-2.5 text-sm font-semibold tracking-tight text-white bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
                  create
                </button>
                <button @click="showNewThreadForm = false; newThreadName = ''; newThreadDesc = '';" class="px-4 py-2.5 text-sm font-semibold tracking-tight text-mono-400 hover:text-mono-200 transition-colors cursor-pointer">
                  cancel
                </button>
              </div>
            </div>
          </div>
        </Transition>
      </Teleport>
    </main>

    <!-- Floating Action Button for mobile -->
    <!-- Blue FAB for notes tab -->
    <button v-if="isMobile && currentTab === 'notes'" @click="mobileNoteOpen = true" class="fixed bottom-6 right-6 z-40 w-14 h-14 bg-accent active:bg-accent-bright rounded-full shadow-lg shadow-accent/30 flex items-center justify-center text-white transition-all active:scale-95" aria-label="Quick Note">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 5v14" />
        <path d="M5 12h14" />
      </svg>
    </button>

    <!-- Blue FAB for quotes tab -->
    <button v-if="isMobile && currentTab === 'quotes'" @click="mobileQuoteOpen = true" class="fixed bottom-6 right-6 z-40 w-14 h-14 bg-accent active:bg-accent-bright rounded-full shadow-lg shadow-accent/30 flex items-center justify-center text-white transition-all active:scale-95" aria-label="Quick Quote">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 5v14" />
        <path d="M5 12h14" />
      </svg>
    </button>

    <!-- Rose FAB for thoughts tab -->
    <button v-if="isMobile && currentTab === 'thoughts'" @click="mobileThoughtOpen = true" class="fixed bottom-6 right-6 z-40 w-14 h-14 bg-rose active:bg-rose-bright rounded-full shadow-lg shadow-rose/30 flex items-center justify-center text-white transition-all active:scale-95" aria-label="Quick Thought">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 5v14" />
        <path d="M5 12h14" />
      </svg>
    </button>

    <footer class="mt-20 py-8 text-center text-xs text-mono-700 uppercase tracking-widest border-t border-mono-900">
      System Online • {{ new Date().getFullYear() }}
    </footer>

  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
