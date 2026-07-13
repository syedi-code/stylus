<script setup lang="ts">
import { ref, watch, computed, onMounted, onUnmounted } from 'vue';
import { MAX_LENGTHS } from '@antisocial/core';
import { fetchBookById, deleteQuote, fetchQuotes, fetchEssays, deleteEssay as deleteEssayApi, type Note, type Quote, type Book, type Thought, type Essay } from './lib/api';
import { useAuth } from './lib/auth';
import { usePagination } from './composables/usePagination';
import NotesPage from './components/notes/NotesPage.vue';
import QuoteCard from './components/quotes/QuoteCard.vue';
import AppHeader from './components/shared/AppHeader.vue';
import EditNoteModal from './components/notes/EditNoteModal.vue';
import EditQuoteModal from './components/quotes/EditQuoteModal.vue';
import EditBookModal from './components/library/EditBookModal.vue';
import AuthorManager from './components/library/AuthorManager.vue';
import EditAuthorModal from './components/library/EditAuthorModal.vue';
import LibraryPage from './components/library/LibraryPage.vue';
import PresentationViewNote from './components/notes/PresentationViewNote.vue';
import PresentationViewQuote from './components/quotes/PresentationViewQuote.vue';
import PresentationModeThoughts from './components/thoughts/PresentationModeThoughts.vue';
import MobileNoteCapture from './components/notes/MobileNoteCapture.vue';
import MobileQuoteCapture from './components/quotes/MobileQuoteCapture.vue';
import QuoteCaptureForm from './components/quotes/QuoteCaptureForm.vue';
import ThoughtCapture from './components/thoughts/ThoughtCapture.vue';
import ThoughtsList from './components/thoughts/ThoughtsList.vue';
import MobileThoughtCapture from './components/thoughts/MobileThoughtCapture.vue';
import AddToThreadModal from './components/threads/AddToThreadModal.vue';
import ThreadDetail from './components/threads/ThreadDetail.vue';
import ThreadList from './components/threads/ThreadList.vue';
import EditThoughtModal from './components/thoughts/EditThoughtModal.vue';
import ConfirmModal from './components/shared/ConfirmModal.vue';
import EssaysIndex from './components/essays/EssaysIndex.vue';
import EditEssayModal from './components/essays/EditEssayModal.vue';
import PresentationViewEssay from './components/essays/PresentationViewEssay.vue';
import { fetchThreads, deleteThreadApi, type Thread } from './lib/api';

const { isAdmin, user: authUser, init: initAuth, logout } = useAuth();

const notesPageRef = ref<InstanceType<typeof NotesPage> | null>(null);

const essaysPagination = usePagination<Essay, { search?: string }>({ 
  fetchFn: (params) => fetchEssays({ ...params }),
  pageSize: 30,
});

const currentTab = ref('notes');

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

  // NotesPage loads its own data on mount; other tabs load via the tab watcher.
  authReady.value = true;
  if (currentTab.value === 'quotes') loadQuotes();
});

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile);
});

// NotesPage is only mounted after auth resolves so its initial load
// doesn't race the JWKS warm-up.
const authReady = ref(false);

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
const libraryPageRef = ref<InstanceType<typeof LibraryPage> | null>(null);

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
  else if (entityType === 'essay') presentingEssay.value = entity;
};

const handleThreadEditItem = (threadId: string, entityType: string, entity: any) => {
  if (!entity) return;
  editingFromThreadId.value = threadId;
  if (entityType === 'note') editingNote.value = entity;
  else if (entityType === 'quote') editingQuote.value = entity;
  else if (entityType === 'thought') editingThought.value = entity;
  else if (entityType === 'essay') editingEssay.value = entity;
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

const handleCopyQuote = async (quote: Quote) => {
  if (quote.quote) {
    await navigator.clipboard.writeText(quote.quote);
  }
};

const handleNoteSaved = async (replaced?: { oldId: string; note: Note }) => {
  const scrollY = window.scrollY;
  editingNote.value = null;
  await notesPageRef.value?.reload(replaced);
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

const handleEditBookById = async (bookId: string) => {
  try {
    const book = await fetchBookById(bookId);
    editingBook.value = book;
    showBookModal.value = true;
  } catch (err) {
    console.error('Failed to load book for edit:', err);
  }
};

const handleAddBook = () => {
  editingBook.value = null;
  showBookModal.value = true;
};

const handleBookSaved = () => {
  showBookModal.value = false;
  editingBook.value = null;
  authorManagerRef.value?.loadAuthors();
  libraryPageRef.value?.reload();
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

// Presentation settings (shared between NotesPage filter bar and the modal)
const showVersionBadgeInPresentation = ref(true);

const handleThreadModalUpdated = () => {
  threadModalOpen.value = false;
  if (threadModalEntityType.value === 'note' && threadModalEntityId.value) {
    notesPageRef.value?.refreshNoteThread(threadModalEntityId.value);
  }
};

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

watch(currentTab, (newTab) => {
  if (newTab === 'quotes') {
    loadQuotes();
  }
  if (newTab === 'essays') {
    essaysPagination.loadInitial();
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
const handleAddEssayToThread = (essay: Essay) => openAddToThread('essay', essay.id);

// ============================================================================
// Essays
// ============================================================================

const editingEssay = ref<Essay | null>(null);
const presentingEssay = ref<Essay | null>(null);
const showNewEssayModal = ref(false);

const handleEditEssay = (essay: Essay) => {
  editingEssay.value = essay;
};

const handleCopyEssay = async (essay: Essay) => {
  if (essay.content) {
    await navigator.clipboard.writeText(essay.content);
  }
};

const handlePresentEssay = (essay: Essay) => {
  presentingEssay.value = essay;
};

const handleDeleteEssay = async (essay: Essay) => {
  if (!confirm('Are you sure you want to delete this essay? This action cannot be undone.')) {
    return;
  }
  try {
    await deleteEssayApi(essay.id);
    essaysPagination.removeItem((e) => e.id === essay.id);
  } catch (err) {
    console.error('Failed to delete essay:', err);
  }
};

const handleEssaySaved = async () => {
  editingEssay.value = null;
  showNewEssayModal.value = false;
  await essaysPagination.loadInitial();
  await reloadEditingThread();
};

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
      <!-- Notes Tab — rendered outside the narrow wrapper so the masonry grid can go full-width -->
      <transition name="fade" mode="out-in">
        <NotesPage
          v-if="currentTab === 'notes' && authReady"
          ref="notesPageRef"
          :isAdmin="isAdmin"
          v-model:showVersionBadge="showVersionBadgeInPresentation"
          @edit="handleEditNote"
          @present="presentingNote = $event"
          @addToThread="handleAddNoteToThread"
          @navigateToThread="handleNavigateToThread"
          @viewInLibrary="handleViewInLibrary"
        />
      </transition>

      <div v-if="currentTab !== 'library' && currentTab !== 'notes' && currentTab !== 'essays'" class="max-w-3xl mx-auto px-4 mt-4 sm:mt-8 pb-20">

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
                <QuoteCard v-for="(quote, i) in filteredQuotes" :key="quote.id" :quote="quote" :index="i" :searchQuery="quotesSearch" :isAdmin="isAdmin" @edit="handleEditQuote" @copy="handleCopyQuote" @present="presentingQuote = $event" @viewInLibrary="handleViewInLibrary" @addToThread="handleAddQuoteToThread" @delete="handleDeleteQuote" />
              </div>
            </div>
          </div>
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
            <ThoughtsList ref="thoughtsListRef" :isAdmin="isAdmin" @addToThread="handleAddThoughtToThread" @navigateToThread="handleNavigateToThread" />
          </div>
        </transition>

        <!-- Threads Tab -->
        <transition name="fade" mode="out-in">
          <div v-if="currentTab === 'threads'">
            <ThreadList
              :threads="threads"
              :loading="threadsLoading"
              :error="threadsError"
              :search="threadsSearch"
              :expandedThreads="expandedThreads"
              :isAdmin="isAdmin"
              :threadDetailRefs="threadDetailRefs"
              @update:search="threadsSearch = $event"
              @toggleThread="toggleThread"
              @deleteThread="handleDeleteThread"
              @renamedThread="(id: string, name: string) => { const t = threads.find(t => t.id === id); if (t) t.name = name; }"
              @newThread="showNewThreadForm = true"
              @retry="loadThreads"
              @presentItem="handleThreadPresentItem"
              @editItem="(threadId: string, type: string, entity: any) => handleThreadEditItem(threadId, type, entity)"
            />
          </div>
        </transition>
      </div>

      <!-- Library Tab — rendered outside the narrow max-w-3xl wrapper so the three-pane layout has room.
           Fills viewport from below the header down to the bottom edge, no trailing footer gap. -->
      <transition name="fade" mode="out-in">
        <div v-if="currentTab === 'library'" class="w-full flex flex-col" style="min-height: calc(100vh - 56px);">
          <LibraryPage ref="libraryPageRef" :isAdmin="isAdmin" @addBook="handleAddBook" @editBook="handleEditBookById" />
        </div>
      </transition>

      <!-- Essays Tab — "the gilded index", rendered edge-to-edge on black. -->
      <transition name="fade" mode="out-in">
        <EssaysIndex
          v-if="currentTab === 'essays'"
          :essays="essaysPagination.items.value"
          :loading="essaysPagination.loading.value"
          :loadingMore="essaysPagination.loadingMore.value"
          :error="essaysPagination.error.value"
          :isAdmin="isAdmin"
          @new="showNewEssayModal = true"
          @edit="handleEditEssay"
          @copy="handleCopyEssay"
          @present="handlePresentEssay"
          @delete="handleDeleteEssay"
          @addToThread="handleAddEssayToThread"
          @navigateToThread="handleNavigateToThread"
          @retry="essaysPagination.loadInitial()"
        />
      </transition>

      <EditNoteModal :isOpen="!!editingNote" :note="editingNote" @close="editingNote = null" @saved="handleNoteSaved" />

      <EditQuoteModal :isOpen="!!editingQuote" :quote="editingQuote" @close="editingQuote = null" @saved="handleQuoteSaved" />

      <EditThoughtModal :isOpen="!!editingThought" :thought="editingThought" @close="editingThought = null" @saved="handleThreadThoughtSaved" />

      <EditEssayModal :isOpen="showNewEssayModal || !!editingEssay" :essay="editingEssay" @close="showNewEssayModal = false; editingEssay = null" @saved="handleEssaySaved" @present="handlePresentEssay" />

      <EditBookModal :isOpen="showBookModal" :book="editingBook" @close="showBookModal = false; editingBook = null" @saved="handleBookSaved" />

      <EditAuthorModal :isOpen="showAuthorModal" :author="editingAuthor" @close="showAuthorModal = false; editingAuthor = null" @saved="handleAuthorSaved" />

<PresentationViewNote :isOpen="!!presentingNote" :note="presentingNote" :showVersionBadge="showVersionBadgeInPresentation" @close="presentingNote = null" @navigateToThread="(id) => { presentingNote = null; handleNavigateToThread(id); }" />

      <PresentationViewQuote :isOpen="!!presentingQuote" :quote="presentingQuote" @close="presentingQuote = null" />

      <PresentationModeThoughts :isOpen="!!presentingThought" :thought="presentingThought" @close="presentingThought = null" @navigateToThread="(id) => { presentingThought = null; handleNavigateToThread(id); }" />

      <PresentationViewEssay :isOpen="!!presentingEssay" :essay="presentingEssay" @close="presentingEssay = null" />

      <AddToThreadModal :isOpen="threadModalOpen" :entityType="threadModalEntityType" :entityId="threadModalEntityId" @close="threadModalOpen = false" @updated="handleThreadModalUpdated" @navigateToThread="handleNavigateToThread" />

      <ConfirmModal :isOpen="!!deletingThread" title="Delete thread" :message="`Delete thread &quot;${deletingThread?.name}&quot;? Items will not be deleted.`" confirmLabel="Delete" @confirm="confirmDeleteThread" @cancel="deletingThread = null" />

      <!-- Mobile Quick Capture FAB -->
      <MobileNoteCapture :isOpen="mobileNoteOpen" @close="mobileNoteOpen = false" @saved="notesPageRef?.reload()" />

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
                <input v-model="newThreadName" type="text" :maxlength="MAX_LENGTHS.TITLE" class="w-full bg-mono-950 border border-mono-800 rounded-lg px-4 py-2.5 text-mono-100 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 text-sm placeholder-mono-600" placeholder="Thread name" @keydown.enter="handleCreateNewThread" />
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="text-xs text-mono-400 tracking-wide">description</label>
                <input v-model="newThreadDesc" type="text" :maxlength="MAX_LENGTHS.CONTENT" class="w-full bg-mono-950 border border-mono-800 rounded-lg px-4 py-2.5 text-mono-100 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 text-sm placeholder-mono-600" placeholder="Optional description" @keydown.enter="handleCreateNewThread" />
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

    <!-- Verdigris FAB for quotes tab -->
    <button v-if="isMobile && currentTab === 'quotes'" @click="mobileQuoteOpen = true" class="fixed bottom-6 right-6 z-40 w-14 h-14 bg-quote active:bg-quote-bright rounded-full shadow-lg shadow-quote/30 flex items-center justify-center text-quote-text transition-all active:scale-95" aria-label="Quick Quote">
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

    <!-- Amber FAB for essays tab -->
    <button v-if="isMobile && currentTab === 'essays'" @click="showNewEssayModal = true" class="fixed bottom-6 right-6 z-40 w-14 h-14 bg-essay active:bg-essay-bright rounded-full shadow-lg shadow-essay/30 flex items-center justify-center text-black transition-all active:scale-95" aria-label="New Essay">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
        <path d="m15 5 4 4" />
      </svg>
    </button>

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
