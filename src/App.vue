<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { fetchBookById, type Note, type Quote, type Book } from './lib/api';
import { useAuth } from './lib/auth';
import AppHeader from './components/shared/AppHeader.vue';
import NotesPage from './components/notes/NotesPage.vue';
import QuotesPage from './components/quotes/QuotesPage.vue';
import ThoughtCapture from './components/thoughts/ThoughtCapture.vue';
import ThoughtsList from './components/thoughts/ThoughtsList.vue';
import LibraryPage from './components/library/LibraryPage.vue';
import EssaysWorkspace from './components/essays/workspace/EssaysWorkspace.vue';
import EditNoteModal from './components/notes/EditNoteModal.vue';
import EditQuoteModal from './components/quotes/EditQuoteModal.vue';
import EditBookModal from './components/library/EditBookModal.vue';
import PresentationViewNote from './components/notes/PresentationViewNote.vue';
import PresentationViewQuote from './components/quotes/PresentationViewQuote.vue';
import PresentationViewEssay from './components/essays/PresentationViewEssay.vue';
import MobileNoteCapture from './components/notes/MobileNoteCapture.vue';
import MobileQuoteCapture from './components/quotes/MobileQuoteCapture.vue';
import MobileThoughtCapture from './components/thoughts/MobileThoughtCapture.vue';
import TextureDebugOverlay from './components/shared/TextureDebugOverlay.vue';
import { warmTextures } from './composables/useTextureBlob';
import { allTextureAssets } from './composables/usePresentationQuoteMode';
import type { Essay } from './lib/api';

const { isAdmin, user: authUser, init: initAuth, logout } = useAuth();

const currentTab = ref('notes');

// NotesPage is only mounted after auth resolves so its initial load
// doesn't race the JWKS warm-up.
const authReady = ref(false);

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
  authReady.value = true;

  // Warm the texture blob cache once the browser is idle, so transient fetch
  // failures (and their retries) happen before any quote is ever opened.
  const warm = () => { warmTextures(allTextureAssets()); };
  if ('requestIdleCallback' in window) requestIdleCallback(warm);
  else setTimeout(warm, 2000);
});

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile);
});

const notesPageRef = ref<InstanceType<typeof NotesPage> | null>(null);
const quotesPageRef = ref<InstanceType<typeof QuotesPage> | null>(null);
const thoughtsListRef = ref<InstanceType<typeof ThoughtsList> | null>(null);
const libraryPageRef = ref<InstanceType<typeof LibraryPage> | null>(null);
const essaysRef = ref<InstanceType<typeof EssaysWorkspace> | null>(null);

// Editing and presenting. Thoughts are absent on purpose: ThoughtsList owns
// its own edit and presentation modals. These are the ones whose overlay
// covers the whole app rather than the tab that opened it.
const editingNote = ref<Note | null>(null);
const editingQuote = ref<Quote | null>(null);
const editingBook = ref<Book | null>(null);
const showBookModal = ref(false);

const presentingNote = ref<Note | null>(null);
const presentingQuote = ref<Quote | null>(null);
const presentingEssay = ref<Essay | null>(null);

// Presentation settings (shared between the NotesPage filter bar and the modal)
const showVersionBadgeInPresentation = ref(true);

// Mobile quick capture
const mobileNoteOpen = ref(false);
const mobileQuoteOpen = ref(false);
const mobileThoughtOpen = ref(false);

/**
 * Saving a note or quote re-sorts its list, which moves the scroll position
 * out from under you. Restore it after the reload settles.
 */
const reloadKeepingScroll = async (reload: () => Promise<void> | undefined) => {
  const scrollY = window.scrollY;
  await reload();
  requestAnimationFrame(() => window.scrollTo(0, scrollY));
};

const handleNoteSaved = async (replaced?: { oldId: string; note: Note }) => {
  editingNote.value = null;
  await reloadKeepingScroll(() => notesPageRef.value?.reload(replaced));
};

const handleQuoteSaved = async () => {
  editingQuote.value = null;
  await reloadKeepingScroll(() => quotesPageRef.value?.reload());
};

const handleEditBookById = async (bookId: string) => {
  try {
    editingBook.value = await fetchBookById(bookId);
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
  libraryPageRef.value?.reload();
};

const showLibrary = () => {
  currentTab.value = 'library';
};

// The mobile quick-capture FAB, one per tab that has one. Essays is not here:
// it uses a pencil rather than a plus, sits higher to clear the editor's
// insert rail, and hides once the room is already on a blank piece.
const fabs = [
  { tab: 'notes', label: 'Quick Note', open: mobileNoteOpen, class: 'bg-accent active:bg-accent-bright shadow-accent/30 text-white' },
  { tab: 'quotes', label: 'Quick Quote', open: mobileQuoteOpen, class: 'bg-quote active:bg-quote-bright shadow-quote/30 text-quote-text' },
  { tab: 'thoughts', label: 'Quick Thought', open: mobileThoughtOpen, class: 'bg-rose active:bg-rose-bright shadow-rose/30 text-white' },
];
</script>

<template>
  <div class="min-h-screen bg-mono-950 text-mono-100 selection:bg-accent selection:text-white">

    <AppHeader v-model:currentTab="currentTab" :userEmail="authUser?.email ?? null" @logout="logout" />

    <main class="w-full">
      <!-- Notes — outside the narrow wrapper so the masonry grid can go full-width -->
      <transition name="fade" mode="out-in">
        <NotesPage
          v-if="currentTab === 'notes' && authReady"
          ref="notesPageRef"
          :isAdmin="isAdmin"
          v-model:showVersionBadge="showVersionBadgeInPresentation"
          @edit="editingNote = $event"
          @present="presentingNote = $event"
          @viewInLibrary="showLibrary"
        />
      </transition>

      <div v-if="currentTab === 'quotes' || currentTab === 'thoughts'" class="max-w-3xl mx-auto px-4 mt-4 sm:mt-8 pb-20">
        <transition name="fade" mode="out-in">
          <QuotesPage
            v-if="currentTab === 'quotes'"
            ref="quotesPageRef"
            :isAdmin="isAdmin"
            @edit="editingQuote = $event"
            @present="presentingQuote = $event"
            @viewInLibrary="showLibrary"
          />

          <div v-else class="space-y-8">
            <div class="hidden sm:block">
              <ThoughtCapture @saved="thoughtsListRef?.reload()" />
            </div>
            <div class="hidden sm:block border-t border-rose/20"></div>
            <ThoughtsList ref="thoughtsListRef" :isAdmin="isAdmin" />
          </div>
        </transition>
      </div>

      <!-- Library — outside the narrow wrapper so the three-pane layout has room.
           Fills from below the header to the bottom edge, no trailing footer gap. -->
      <transition name="fade" mode="out-in">
        <div v-if="currentTab === 'library'" class="w-full flex flex-col" style="min-height: calc(100vh - 56px);">
          <LibraryPage ref="libraryPageRef" :isAdmin="isAdmin" @addBook="handleAddBook" @editBook="handleEditBookById" />
        </div>
      </transition>

      <!-- Essays — the manuscript itself. No index: the spine inside the
           workspace is how you move between pieces. -->
      <transition name="fade" mode="out-in">
        <EssaysWorkspace
          v-if="currentTab === 'essays'"
          ref="essaysRef"
          :isAdmin="isAdmin"
          @present="presentingEssay = $event"
        />
      </transition>

      <EditNoteModal :isOpen="!!editingNote" :note="editingNote" @close="editingNote = null" @saved="handleNoteSaved" />
      <EditQuoteModal :isOpen="!!editingQuote" :quote="editingQuote" @close="editingQuote = null" @saved="handleQuoteSaved" />
      <EditBookModal :isOpen="showBookModal" :book="editingBook" @close="showBookModal = false; editingBook = null" @saved="handleBookSaved" />

      <PresentationViewNote :isOpen="!!presentingNote" :note="presentingNote" :showVersionBadge="showVersionBadgeInPresentation" @close="presentingNote = null" />
      <PresentationViewQuote :isOpen="!!presentingQuote" :quote="presentingQuote" @close="presentingQuote = null" />
      <PresentationViewEssay :isOpen="!!presentingEssay" :essay="presentingEssay" @close="presentingEssay = null" />

      <MobileNoteCapture :isOpen="mobileNoteOpen" @close="mobileNoteOpen = false" @saved="notesPageRef?.reload()" />
      <MobileQuoteCapture :isOpen="mobileQuoteOpen" @close="mobileQuoteOpen = false" @saved="quotesPageRef?.reload()" />
      <MobileThoughtCapture :isOpen="mobileThoughtOpen" @close="mobileThoughtOpen = false" @saved="thoughtsListRef?.reload()" />
    </main>

    <!-- Mobile quick-capture FAB -->
    <template v-for="fab in fabs" :key="fab.tab">
      <button
        v-if="isMobile && currentTab === fab.tab"
        @click="fab.open.value = true"
        class="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all active:scale-95"
        :class="fab.class"
        :aria-label="fab.label"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </svg>
      </button>
    </template>

    <!-- Essays "write" FAB. Hidden once the room is already on a blank piece —
         tapping it then does nothing visible, and it sits on top of the
         editor's own insert rail. Lifted clear of that rail while it shows,
         so it never covers the Quote/Book/Image/Header pills. -->
    <button v-if="isMobile && currentTab === 'essays' && !essaysRef?.isNewPiece" @click="essaysRef?.newEssay()" class="fixed right-5 z-40 w-14 h-14 bg-essay active:bg-essay-bright rounded-full shadow-lg shadow-essay/30 flex items-center justify-center text-black transition-all active:scale-95" style="bottom: calc(4.75rem + env(safe-area-inset-bottom))" aria-label="New Essay">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
        <path d="m15 5 4 4" />
      </svg>
    </button>

    <!-- Opt-in texture-load debug readout (?texdebug=1) — see the component. -->
    <TextureDebugOverlay />

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
