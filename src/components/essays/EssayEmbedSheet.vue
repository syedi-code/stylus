<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { type Quote, type Book, type EssayReferenceInput } from '../../lib/api';
import { bookHue } from '../../composables/useBookHue';
import { useSourceLibrary } from '../../composables/useSourceLibrary';
import BottomSheet from '../shared/BottomSheet.vue';

const props = defineProps<{
    isOpen: boolean;
    /** Default tab when opened. */
    initialKind?: 'quote' | 'book';
}>();

const emit = defineEmits<{
    (e: 'close'): void;
    (e: 'select', ref: EssayReferenceInput): void;
}>();

type Tab = 'quote' | 'book';
const activeTab = ref<Tab>(props.initialKind ?? 'quote');

const search = ref('');
const { quotes, books, authors, loading, ensureLoaded } = useSourceLibrary();
const selectedAuthorId = ref<string | null>(null);

watch(
    () => props.isOpen,
    async (open) => {
        if (!open) return;
        activeTab.value = props.initialKind ?? 'quote';
        search.value = '';
        // Force-refresh: quotes captured or edited since the catalogue first
        // loaded must show up in the picker (concurrent opens share a flight).
        await ensureLoaded(true);
        if (authors.value.length && !selectedAuthorId.value) {
            selectedAuthorId.value = authors.value[0].id;
        }
    },
    { immediate: false }
);

// ─── Quote tab ───
const filteredQuotes = computed(() => {
    const q = search.value.toLowerCase().trim();
    if (!q) return quotes.value.slice(0, 200);
    return quotes.value
        .filter((quote) => {
            const hay = `${quote.quote ?? ''} ${quote.creator ?? ''} ${quote.work ?? ''}`.toLowerCase();
            return hay.includes(q);
        })
        .slice(0, 200);
});

function selectQuote(q: Quote) {
    emit('select', { entity_type: 'quote', entity_id: q.id });
    emit('close');
}

// ─── Book cover tab ───
// Books are eligible iff they have a cover_url. The picker greys non-eligible
// rows; selecting one is a no-op.
const booksByAuthor = computed(() => {
    const map = new Map<string, Book[]>();
    for (const book of books.value) {
        if (!book.author_id) continue;
        const list = map.get(book.author_id) || [];
        list.push(book);
        map.set(book.author_id, list);
    }
    return map;
});

const filteredAuthors = computed(() => {
    const q = search.value.toLowerCase().trim();
    return authors.value
        .filter((a) => booksByAuthor.value.has(a.id))
        .filter((a) => {
            if (!q) return true;
            if (a.name.toLowerCase().includes(q)) return true;
            const list = booksByAuthor.value.get(a.id) || [];
            return list.some((b) => b.title.toLowerCase().includes(q));
        });
});

const filteredBooks = computed(() => {
    if (!selectedAuthorId.value) return [];
    const list = booksByAuthor.value.get(selectedAuthorId.value) || [];
    const q = search.value.toLowerCase().trim();
    if (!q) return list;
    return list.filter((b) => b.title.toLowerCase().includes(q));
});

watch(search, () => {
    if (
        filteredAuthors.value.length &&
        !filteredAuthors.value.find((a) => a.id === selectedAuthorId.value)
    ) {
        selectedAuthorId.value = filteredAuthors.value[0].id;
    }
});

function selectBook(b: Book) {
    // Books without uploaded covers are still embeddable — they just render
    // as text-only on the cover slide in presentation. The picker hints
    // "no cover" so the author knows what to expect.
    emit('select', { entity_type: 'book_cover', entity_id: b.id });
    emit('close');
}

const sheetTitle = computed(() =>
    activeTab.value === 'quote' ? 'Insert quote' : 'Insert book'
);
</script>

<template>
    <BottomSheet
        :is-open="isOpen"
        panel-class="bg-black rounded-t-[22px] border border-b-0 border-mono-800 shadow-[0_-28px_80px_rgba(0,0,0,0.9)]"
        @close="emit('close')"
    >
        <div class="flex items-baseline justify-between px-4 pt-1 pb-3">
            <h3 class="text-[15px] font-medium text-mono-100">{{ sheetTitle }}</h3>
        </div>

        <!-- Tabs — foil pill for the active source kind -->
        <div class="flex gap-1 px-4 pb-2.5">
            <button
                @click="activeTab = 'quote'"
                class="px-3.5 py-1.5 text-[12.5px] rounded-full transition-colors cursor-pointer"
                :class="activeTab === 'quote' ? 'bg-essay text-black font-semibold' : 'text-mono-400 hover:text-mono-200'"
            >Quote</button>
            <button
                @click="activeTab = 'book'"
                class="px-3.5 py-1.5 text-[12.5px] rounded-full transition-colors cursor-pointer"
                :class="activeTab === 'book' ? 'bg-essay text-black font-semibold' : 'text-mono-400 hover:text-mono-200'"
            >Book</button>
        </div>

        <!-- Search -->
        <div class="px-4 pb-3">
            <div class="relative">
                <svg class="absolute left-3 top-1/2 -translate-y-1/2 text-mono-500" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="11" cy="11" r="8"/>
                    <path d="m21 21-4.3-4.3"/>
                </svg>
                <input
                    v-model="search"
                    type="text"
                    :placeholder="activeTab === 'quote' ? 'Search quote text, author…' : 'Search title or author…'"
                    class="w-full py-2.5 pl-9 pr-3 bg-[#0d0b08] border border-mono-800 rounded-xl text-[13px] text-mono-100 outline-none focus:border-essay placeholder:text-mono-500"
                />
            </div>
        </div>

        <!-- Quote list -->
        <div v-if="activeTab === 'quote'" class="min-h-[280px] max-h-[60vh] overflow-y-auto px-2.5 pb-3.5">
            <div v-if="loading" class="p-6 text-center text-mono-500 text-sm">Loading…</div>
            <div v-else-if="filteredQuotes.length === 0" class="p-6 text-center text-mono-600 text-sm italic">No quotes found</div>
            <button
                v-for="q in filteredQuotes"
                :key="q.id"
                @click="selectQuote(q)"
                class="w-full text-left flex gap-3 px-3 py-3 rounded-[13px] hover:bg-[#14100a] transition-colors cursor-pointer"
            >
                <div class="w-[3px] flex-shrink-0 self-stretch rounded-sm" :style="{ background: q.book_id ? bookHue(q.book_id) : 'var(--color-accent)' }"></div>
                <div class="flex-1 min-w-0">
                    <div class="text-[13px] italic text-mono-100 leading-[1.45] line-clamp-3">“{{ q.quote }}”</div>
                    <div class="mt-1.5 text-[10.5px] text-mono-500 italic">
                        <span v-if="q.creator" class="text-mono-300 not-italic font-medium">— {{ q.creator }}</span>
                        <span v-if="q.work" class="ml-1 text-mono-400">{{ q.work }}</span>
                        <span v-if="q.page" class="ml-2 not-italic">p. {{ q.page }}</span>
                    </div>
                </div>
            </button>
        </div>

        <!-- Book list (two-column author/book; only books with cover_url are selectable) -->
        <div v-else class="min-h-[280px] max-h-[60vh] flex">
            <!-- Authors -->
            <div class="w-[140px] flex-shrink-0 overflow-y-auto border-r border-mono-800 py-1.5 px-1.5">
                <button
                    v-for="a in filteredAuthors"
                    :key="a.id"
                    @click="selectedAuthorId = a.id"
                    class="w-full flex items-center gap-1.5 px-2.5 py-2 text-xs text-left rounded-[10px] cursor-pointer transition-all"
                    :class="selectedAuthorId === a.id
                        ? 'bg-[#14100a] text-mono-100 font-medium'
                        : 'text-mono-400 hover:bg-[#14100a] hover:text-mono-200'"
                >
                    <span class="truncate">{{ a.name }}</span>
                    <span class="text-[9px] text-mono-600 ml-auto shrink-0">{{ (booksByAuthor.get(a.id) || []).length }}</span>
                </button>
            </div>

            <!-- Books -->
            <div class="flex-1 overflow-y-auto py-1.5 px-1.5">
                <button
                    v-for="b in filteredBooks"
                    :key="b.id"
                    @click="selectBook(b)"
                    class="w-full flex items-center gap-2 px-2.5 py-2 rounded-[10px] text-left cursor-pointer hover:bg-[#14100a] transition-colors"
                >
                    <div class="w-[3px] h-7 rounded-sm shrink-0" :style="{ background: bookHue(b.id) }"></div>
                    <div class="flex flex-col gap-px min-w-0 flex-1">
                        <span class="text-xs italic text-mono-100 truncate">{{ b.title }}</span>
                        <span v-if="b.originally_published" class="text-[10px] text-mono-500">{{ b.originally_published }}</span>
                    </div>
                    <span v-if="!b.cover_url" class="text-[9px] uppercase tracking-[0.1em] text-mono-600 shrink-0" title="No cover uploaded; will render as text on the slide">text only</span>
                </button>
                <div v-if="filteredBooks.length === 0" class="p-6 text-center text-mono-600 text-sm italic">No books</div>
            </div>
        </div>
    </BottomSheet>
</template>
