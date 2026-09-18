<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { fetchQuotes, deleteQuote, type Quote } from '../../lib/api';
import QuoteCard from './QuoteCard.vue';
import QuoteCaptureForm from './QuoteCaptureForm.vue';
import EditQuoteModal from './EditQuoteModal.vue';
import PresentationViewQuote from './PresentationViewQuote.vue';
import MobileQuoteCapture from './MobileQuoteCapture.vue';
import ConfirmModal from '../shared/ConfirmModal.vue';
import CaptureFab from '../shared/CaptureFab.vue';
import { keepingScroll } from '../../lib/scroll';

defineProps<{
  isAdmin?: boolean;
}>();

const emit = defineEmits<{
  (e: 'viewInLibrary', authorId: string): void;
}>();

const editingQuote = ref<Quote | null>(null);
const presentingQuote = ref<Quote | null>(null);
const captureOpen = ref(false);

const quotes = ref<Quote[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const search = ref('');

// A quote edit writes a new row pointing at the old one through `replaces`.
// Only the head of each chain is shown, carrying the chain's length as its
// version and the original's timestamp so an edit doesn't jump it to the top.
const filteredQuotes = computed(() => {
  const byId = new Map(quotes.value.map(q => [q.id, q]));
  const replaced = new Set(quotes.value.map(q => q.replaces).filter(Boolean));

  return quotes.value
    .filter(q => !replaced.has(q.id))
    .map(q => {
      let version = 1;
      let oldest = q;
      while (oldest.replaces && byId.has(oldest.replaces)) {
        version++;
        oldest = byId.get(oldest.replaces)!;
      }
      return { ...q, version, originalCreatedAt: oldest.created_at };
    })
    .sort((a, b) => b.originalCreatedAt.localeCompare(a.originalCreatedAt));
});

const load = async () => {
  loading.value = true;
  error.value = null;
  try {
    quotes.value = await fetchQuotes({
      limit: 5000,
      ...(search.value ? { search: search.value } : {}),
    });
  } catch (err) {
    console.error(err);
    error.value = 'Failed to load quotes. Check API Key and connection.';
  } finally {
    loading.value = false;
  }
};

let searchDebounce: ReturnType<typeof setTimeout>;
watch(search, () => {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(load, 300);
});

const deleting = ref<Quote | null>(null);
const confirmDelete = async () => {
  const quote = deleting.value;
  deleting.value = null;
  if (!quote) return;
  try {
    await deleteQuote(quote.id);
    quotes.value = quotes.value.filter(q => q.id !== quote.id);
  } catch (err) {
    console.error('Failed to delete quote:', err);
  }
};

const handleCopy = async (quote: Quote) => {
  if (quote.quote) await navigator.clipboard.writeText(quote.quote);
};

const handleSaved = () => {
  editingQuote.value = null;
  return keepingScroll(load);
};

onMounted(load);
</script>

<template>
  <div class="max-w-3xl mx-auto px-4 mt-4 sm:mt-8 pb-20 space-y-8">
    <!-- Desktop capture; mobile uses the FAB sheet instead -->
    <div class="hidden sm:block">
      <QuoteCaptureForm @saved="load" />
    </div>
    <div class="hidden sm:block border-t border-accent/20"></div>

    <div class="mb-6">
      <input v-model="search" type="text" placeholder="Search quotes..." class="w-full px-4 py-2.5 bg-mono-900 border border-mono-800 rounded-lg text-mono-100 placeholder-mono-600 focus:outline-none focus:border-accent transition-colors" />
    </div>

    <div class="space-y-4">
      <div v-if="loading" class="py-20 text-center text-mono-600">
        <div class="inline-block animate-spin h-6 w-6 border-2 border-accent border-t-transparent rounded-full mb-4"></div>
        <p class="text-xs tracking-widest uppercase">Loading quotes...</p>
      </div>

      <div v-else-if="error" class="p-6 border border-red-900 bg-red-950/20 text-center">
        <p class="text-red-500 font-bold uppercase text-sm mb-4">{{ error }}</p>
        <button @click="load" class="px-4 py-2 bg-red-900 hover:bg-red-800 text-white text-xs font-bold uppercase tracking-wide transition-colors cursor-pointer">
          Retry Connection
        </button>
      </div>

      <div v-else-if="filteredQuotes.length === 0" class="py-20 text-center text-mono-600 border border-dashed border-mono-800 rounded-lg">
        <p class="text-sm uppercase tracking-wide">No quotes found.</p>
      </div>

      <div v-else class="space-y-4">
        <QuoteCard
          v-for="(quote, i) in filteredQuotes"
          :key="quote.id"
          :quote="quote"
          :index="i"
          :searchQuery="search"
          :isAdmin="isAdmin"
          @edit="editingQuote = $event"
          @present="presentingQuote = $event"
          @viewInLibrary="emit('viewInLibrary', $event)"
          @copy="handleCopy"
          @delete="deleting = $event"
        />
      </div>
    </div>

    <ConfirmModal
      :isOpen="!!deleting"
      title="Delete quote"
      message="Delete this quote? This cannot be undone."
      confirmLabel="Delete"
      @confirm="confirmDelete"
      @cancel="deleting = null"
    />

    <EditQuoteModal :isOpen="!!editingQuote" :quote="editingQuote" @close="editingQuote = null" @saved="handleSaved" />
    <PresentationViewQuote :isOpen="!!presentingQuote" :quote="presentingQuote" @close="presentingQuote = null" />
    <MobileQuoteCapture :isOpen="captureOpen" @close="captureOpen = false" @saved="load" />
    <CaptureFab label="Quick Quote" class="bg-quote active:bg-quote-bright shadow-quote/30 text-quote-text" @click="captureOpen = true" />
  </div>
</template>
