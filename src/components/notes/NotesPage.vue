<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import {
    fetchShuffleNotes,
    fetchNotes,
    fetchNoteById,
    fetchNoteFacets,
    fetchBooks,
    fetchBookById,
    deleteNote,
    fetchThreadsForEntities,
    fetchThreadsForEntity,
    fetchConnectionsForEntities,
    fetchAuthorById,
    type Note,
    type Book,
    type Author,
    type Thread,
} from '../../lib/api';
import { usePagination } from '../../composables/usePagination';
import NoteCard from './NoteCard.vue';
import NoteCardSkeleton from './NoteCardSkeleton.vue';
import CaptureForm from '../shared/CaptureForm.vue';
import BookLinePicker from '../library/BookLinePicker.vue';

const props = defineProps<{
    isAdmin?: boolean;
}>();

const emit = defineEmits<{
    (e: 'edit', note: Note): void;
    (e: 'present', note: Note): void;
    (e: 'addToThread', note: Note): void;
    (e: 'navigateToThread', threadId: string): void;
    (e: 'viewInLibrary', authorId: string): void;
}>();

const showVersionBadge = defineModel<boolean>('showVersionBadge', { default: true });

// ============================================================================
// Mode: shuffle (default, ambient rediscovery) | search (intentional)
// ============================================================================

const mode = ref<'shuffle' | 'search'>('shuffle');

// ============================================================================
// Shuffle — the finite deal
// ============================================================================

const DEAL_SIZE = 5;
const dealNotes = ref<Note[]>([]);
const dealTotal = ref(0);
const dealLoading = ref(false);
const dealError = ref<string | null>(null);
/** Bumped per deal so the stagger animation re-runs on re-deal. */
const dealKey = ref(0);

const dealAgain = async () => {
    dealLoading.value = true;
    dealError.value = null;
    try {
        const { notes, total } = await fetchShuffleNotes(DEAL_SIZE);
        dealNotes.value = notes;
        dealTotal.value = total;
        dealKey.value++;
    } catch (err) {
        console.error('Failed to deal notes:', err);
        dealError.value = 'The deal failed. Check your connection.';
    } finally {
        dealLoading.value = false;
    }
};

/** Refresh dealt note contents in place (after edits) without re-dealing. */
const refreshDeal = async () => {
    const refreshed = await Promise.all(
        dealNotes.value.map((n) => fetchNoteById(n.id).catch(() => null))
    );
    const next: Note[] = [];
    dealNotes.value.forEach((old, i) => {
        const fresh = refreshed[i];
        if (fresh) next.push({ ...fresh, last_surfaced_at: old.last_surfaced_at });
    });
    dealNotes.value = next;
};

// ============================================================================
// Search — notes-scoped query + book filter, chronological
// ============================================================================

const searchQuery = ref('');
const bookFilter = ref<string>('all'); // 'all' | 'none' | book id
const searchTotal = ref<number | null>(null);
const searchInput = ref<HTMLInputElement | null>(null);

const pagination = usePagination<Note, { search?: string; book_id?: string }>({
    fetchFn: (params) => fetchNotes({ ...params }),
    pageSize: 30,
});

const runSearch = async () => {
    const params: { search?: string; book_id?: string } = {};
    if (searchQuery.value) params.search = searchQuery.value;
    if (bookFilter.value !== 'all') params.book_id = bookFilter.value;

    enrichedNoteIds.clear();
    await pagination.reset(params);

    try {
        const facets = await fetchNoteFacets(params);
        searchTotal.value = facets.total;
    } catch {
        searchTotal.value = null;
    }
};

let searchDebounce: ReturnType<typeof setTimeout>;
watch([searchQuery, bookFilter], () => {
    if (mode.value !== 'search') return;
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(runSearch, 300);
});

const openSearch = () => {
    mode.value = 'search';
    if (pagination.items.value.length === 0) runSearch();
};

/** Focus + select the query once the mode transition finishes inserting it. */
const onModeEntered = () => {
    if (mode.value === 'search') {
        searchInput.value?.focus();
        searchInput.value?.select();
    }
};

const cancelSearch = () => {
    mode.value = 'shuffle';
    searchQuery.value = '';
    bookFilter.value = 'all';
    searchTotal.value = null;
};

/** Version-chain dedup for search results (server already sorts newest). */
const searchNotes = computed(() => {
    const all = pagination.items.value;
    if (!all.length) return [];

    const noteMap = new Map(all.map((n) => [n.id, n]));
    const replacedIds = new Set<string>();
    all.forEach((n) => {
        if (n.replaces) replacedIds.add(n.replaces);
    });

    return all
        .filter((n) => !replacedIds.has(n.id))
        .map((n) => {
            let version = 1;
            let current = n;
            while (current.replaces && noteMap.has(current.replaces)) {
                version++;
                current = noteMap.get(current.replaces)!;
            }
            return { ...n, version, originalCreatedAt: current.created_at };
        });
});

// ============================================================================
// Book filter — BookLinePicker fed with the shared list + facet counts
// ============================================================================

const bookCounts = ref<Map<string, number>>(new Map());
const unattachedCount = ref(0);

/** Called when the picker popover opens — ensures books + counts are loaded. */
const loadBookMeta = async () => {
    await ensureFilterBooks();
    try {
        const facets = await fetchNoteFacets({});
        bookCounts.value = new Map(facets.bookCounts.map((b) => [b.book_id, b.count]));
        const attached = facets.bookCounts.reduce((sum, b) => sum + b.count, 0);
        unattachedCount.value = facets.total - attached;
    } catch (err) {
        console.error('Failed to load book counts:', err);
    }
};

const onFilterBook = (b: Book | null) => {
    bookFilter.value = b ? b.id : 'all';
};

const onFilterUnattached = (v: boolean) => {
    bookFilter.value = v ? 'none' : 'all';
};

const selectedBook = computed(() => {
    if (bookFilter.value === 'all' || bookFilter.value === 'none') return null;
    return booksById.value.get(bookFilter.value) ?? null;
});

// ============================================================================
// Settings popover (presentation options)
// ============================================================================

const settingsOpen = ref(false);
const settingsRef = ref<HTMLElement | null>(null);
const handleSettingsClickOutside = (event: MouseEvent) => {
    if (settingsOpen.value && settingsRef.value && !settingsRef.value.contains(event.target as Node)) {
        settingsOpen.value = false;
    }
};

// ============================================================================
// Capture — always visible on desktop; mobile captures via the FAB
// ============================================================================

const handleCaptureSaved = () => {
    dealTotal.value++;
    if (mode.value === 'search') runSearch();
};

// ============================================================================
// Note enrichment — shared books map + batched thread/author lookups
// ============================================================================

const filterBooks = ref<Book[]>([]);
const booksById = computed(() => new Map(filterBooks.value.map((b) => [b.id, b])));
const extraBooks = ref<Map<string, Book | null>>(new Map());
const noteThreads = ref<Map<string, Thread>>(new Map());
const noteAuthors = ref<Map<string, Author>>(new Map());
const enrichedNoteIds = new Set<string>();

let filterBooksPromise: Promise<void> | null = null;
const ensureFilterBooks = (): Promise<void> => {
    if (!filterBooksPromise) {
        filterBooksPromise = fetchBooks({ limit: 500 })
            .then((books) => {
                filterBooks.value = books;
            })
            .catch((err) => {
                console.error('Failed to load books:', err);
                filterBooksPromise = null; // allow retry
            });
    }
    return filterBooksPromise;
};

/** Resolved book for a note: undefined = still loading (skeleton), null = none. */
const bookFor = (note: Note): Book | null | undefined => {
    if (!note.book_id) return null;
    const fromList = booksById.value.get(note.book_id);
    if (fromList) return fromList;
    if (extraBooks.value.has(note.book_id)) return extraBooks.value.get(note.book_id)!;
    return undefined;
};

const enrichNotes = async (notes: Note[]) => {
    const newIds = notes.map((n) => n.id).filter((id) => !enrichedNoteIds.has(id));
    if (newIds.length === 0) return;
    newIds.forEach((id) => enrichedNoteIds.add(id));

    await ensureFilterBooks();

    const noteMap = new Map(notes.map((n) => [n.id, n]));
    const noBookIds = newIds.filter((id) => !noteMap.get(id)?.book_id);
    const missingBookIds = [
        ...new Set(
            newIds
                .map((id) => noteMap.get(id)?.book_id)
                .filter(
                    (bid): bid is string =>
                        !!bid && !booksById.value.has(bid) && !extraBooks.value.has(bid)
                )
        ),
    ];

    await Promise.all([
        (async () => {
            try {
                const rows = await fetchThreadsForEntities('note', newIds);
                const next = new Map(noteThreads.value);
                for (const row of rows) {
                    if (!next.has(row.entity_id)) next.set(row.entity_id, row);
                }
                noteThreads.value = next;
            } catch (err) {
                console.error('Failed to load threads for notes:', err);
            }
        })(),
        (async () => {
            if (noBookIds.length === 0) return;
            try {
                const conns = await fetchConnectionsForEntities('note', noBookIds, 'author');
                const authorIdByNote = new Map<string, string>();
                for (const conn of conns) {
                    const noteId = conn.a_type === 'note' ? conn.a_id : conn.b_id;
                    const authorId = conn.a_type === 'author' ? conn.a_id : conn.b_id;
                    if (!authorIdByNote.has(noteId)) authorIdByNote.set(noteId, authorId);
                }
                const uniqueAuthorIds = [...new Set(authorIdByNote.values())];
                const authors = await Promise.all(
                    uniqueAuthorIds.map((id) => fetchAuthorById(id).catch(() => null))
                );
                const authorById = new Map(uniqueAuthorIds.map((id, i) => [id, authors[i]]));
                const next = new Map(noteAuthors.value);
                for (const [noteId, authorId] of authorIdByNote) {
                    const author = authorById.get(authorId);
                    if (author) next.set(noteId, author);
                }
                noteAuthors.value = next;
            } catch {
                // Connections may not exist yet (pre-migration data)
            }
        })(),
        (async () => {
            if (missingBookIds.length === 0) return;
            const fetched = await Promise.all(
                missingBookIds.map((id) => fetchBookById(id).catch(() => null))
            );
            const next = new Map(extraBooks.value);
            missingBookIds.forEach((id, i) => next.set(id, fetched[i]));
            extraBooks.value = next;
        })(),
    ]);
};

watch(dealNotes, (notes) => {
    if (notes.length) enrichNotes(notes);
});
watch(pagination.items, (items) => {
    if (items.length) enrichNotes(items);
});

/** Refresh the latest-thread label for one note (after thread membership changes). */
const refreshNoteThread = async (noteId: string) => {
    try {
        const threads = await fetchThreadsForEntity('note', noteId);
        const next = new Map(noteThreads.value);
        const latest = threads.sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];
        if (latest) next.set(noteId, latest);
        else next.delete(noteId);
        noteThreads.value = next;
    } catch (err) {
        console.error('Failed to refresh note thread:', err);
    }
};

// ============================================================================
// Card actions
// ============================================================================

const handleCopy = async (note: Note) => {
    if (note.content) {
        await navigator.clipboard.writeText(note.content);
    }
};

const handleDelete = async (note: Note) => {
    if (!confirm('Are you sure you want to delete this note? This action cannot be undone.')) {
        return;
    }
    try {
        await deleteNote(note.id);
        dealNotes.value = dealNotes.value.filter((n) => n.id !== note.id);
        pagination.removeItem((n) => n.id === note.id);
        dealTotal.value = Math.max(0, dealTotal.value - 1);
    } catch (err) {
        console.error('Failed to delete note:', err);
    }
};

// ============================================================================
// Infinite scroll (search mode only)
// ============================================================================

const scrollSentinel = ref<HTMLElement | null>(null);
let observer: IntersectionObserver | null = null;

watch(scrollSentinel, (el, oldEl) => {
    if (oldEl) observer?.unobserve(oldEl);
    if (el) observer?.observe(el);
});

// ============================================================================
// Lifecycle
// ============================================================================

onMounted(() => {
    dealAgain();
    ensureFilterBooks();

    observer = new IntersectionObserver(
        (entries) => {
            if (entries[0]?.isIntersecting && pagination.hasMore.value && !pagination.loadingMore.value) {
                pagination.loadMore();
            }
        },
        { rootMargin: '200px' }
    );

    document.addEventListener('click', handleSettingsClickOutside);
});

onUnmounted(() => {
    observer?.disconnect();
    document.removeEventListener('click', handleSettingsClickOutside);
});

defineExpose({
    reload: async () => {
        if (mode.value === 'search') await runSearch();
        await refreshDeal();
    },
    refreshNoteThread,
});
</script>

<template>
    <div class="w-full max-w-2xl xl:max-w-3xl mx-auto px-4 mt-1 sm:mt-6 pb-20">
        <transition name="mode" mode="out-in" @after-enter="onModeEntered">
            <!-- ══════════════ SHUFFLE ══════════════ -->
            <div v-if="mode === 'shuffle'" key="shuffle">
                <!-- Capture — always present; the tab opens ready to receive -->
                <div class="hidden sm:block">
                    <CaptureForm @saved="handleCaptureSaved" />
                </div>

                <!-- The seam between capturing and remembering -->
                <div class="relative h-px mt-6 sm:mt-8 mb-4 sm:mb-5 hidden sm:block">
                    <div class="absolute inset-0 bg-linear-to-r from-transparent via-accent/70 to-transparent"></div>
                </div>

                <!-- Header: Notes wordmark + action cluster, count beneath — centered -->
                <div class="pt-0 sm:pt-1 flex flex-col items-center text-center">
                    <div class="flex items-center gap-4">
                        <h2 class="font-display text-white tracking-tight select-none" style="font-weight: 600; font-size: 26px; letter-spacing: -0.025em;">Notes</h2>
                        <div class="flex items-center gap-1 -translate-y-px">
                            <button @click="dealAgain" class="p-2 rounded-lg text-mono-500 hover:text-accent-bright hover:bg-accent/10 transition-colors cursor-pointer" title="Shuffle — deal a new hand" aria-label="Shuffle notes">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                                    <path d="M21 3v5h-5" />
                                </svg>
                            </button>
                            <button @click="openSearch" class="p-2 rounded-lg text-mono-500 hover:text-accent-bright hover:bg-accent/10 transition-colors cursor-pointer" title="Search notes" aria-label="Search notes">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <circle cx="11" cy="11" r="7" />
                                    <path d="m21 21-4.3-4.3" />
                                </svg>
                            </button>
                            <!-- Settings popover -->
                            <div ref="settingsRef" class="relative hidden sm:block">
                                <button @click="settingsOpen = !settingsOpen" class="p-2 rounded-lg text-mono-500 hover:text-mono-200 hover:bg-mono-800 transition-colors cursor-pointer" title="View settings" aria-label="View settings">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                                        <circle cx="12" cy="12" r="3" />
                                    </svg>
                                </button>
                                <div v-if="settingsOpen" class="absolute left-0 top-full mt-2 w-64 bg-mono-900 border border-mono-700 rounded-xl shadow-2xl shadow-black/50 p-3.5 z-50">
                                    <label class="flex items-center gap-3 cursor-pointer select-none">
                                        <button type="button" @click="showVersionBadge = !showVersionBadge" class="relative w-9 h-5 rounded-full transition-colors duration-200 shrink-0" :class="showVersionBadge ? 'bg-accent' : 'bg-mono-700'" role="switch" :aria-checked="showVersionBadge">
                                            <span class="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200" :class="showVersionBadge ? 'translate-x-4' : 'translate-x-0'"></span>
                                        </button>
                                        <span class="text-xs text-mono-400">Version badges in presentation</span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>
                    <p v-if="dealTotal" class="mt-2 text-[11px] tabular-nums select-none">
                        <span class="text-accent-bright font-semibold">{{ dealTotal.toLocaleString() }}</span>
                        <span class="text-mono-600 uppercase tracking-[0.14em] text-[9.5px] ml-1.5">notes</span>
                    </p>
                </div>

                <!-- The deal -->
                <div class="mt-4 sm:mt-5 space-y-4 sm:space-y-5">
                    <!-- Loading -->
                    <template v-if="dealLoading">
                        <NoteCardSkeleton v-for="i in 3" :key="i" />
                    </template>

                    <!-- Error -->
                    <div v-else-if="dealError" class="p-6 border border-red-900 bg-red-950/20 text-center rounded-lg">
                        <p class="text-red-500 font-bold uppercase text-sm mb-4">{{ dealError }}</p>
                        <button @click="dealAgain" class="px-4 py-2 bg-red-900 hover:bg-red-800 text-white text-xs font-bold uppercase tracking-wide transition-colors cursor-pointer">
                            Retry
                        </button>
                    </div>

                    <!-- Empty corpus -->
                    <div v-else-if="dealNotes.length === 0" class="py-20 text-center text-mono-600 border border-dashed border-mono-800 rounded-lg">
                        <p class="text-sm uppercase tracking-wide">Nothing to deal yet — write your first note.</p>
                    </div>

                    <!-- Dealt cards -->
                    <template v-else>
                        <NoteCard v-for="(note, i) in dealNotes" :key="`${dealKey}-${note.id}`" :note="note" :isAdmin="isAdmin" :book="bookFor(note)" :connectedAuthor="noteAuthors.get(note.id) ?? null" :latestThread="noteThreads.get(note.id) ?? null" variant="deal" class="deal-in" :style="{ animationDelay: `${i * 60}ms` }" @edit="emit('edit', $event)" @copy="handleCopy" @present="emit('present', $event)" @delete="handleDelete" @viewInLibrary="emit('viewInLibrary', $event)" @addToThread="emit('addToThread', $event)" @navigateToThread="emit('navigateToThread', $event)" />

                        <!-- End of the deal — finite by design -->
                        <div class="flex flex-col items-center gap-3 pt-2 pb-4">
                            <span class="text-[11.5px] italic text-mono-600 tracking-wide">— that's the deal —</span>
                            <button @click="dealAgain" class="px-6 py-2 text-[12.5px] font-semibold text-accent-bright border border-accent/40 rounded-lg hover:bg-accent/10 transition-colors cursor-pointer tracking-wide">
                                deal again
                            </button>
                        </div>
                    </template>
                </div>
            </div>

            <!-- ══════════════ SEARCH ══════════════ -->
            <div v-else key="search">
                <!-- Search bar -->
                <div class="flex items-center gap-2 py-2">
                    <!-- Back to the deal — named destination, not "cancel" -->
                    <button @click="cancelSearch" class="flex items-center gap-1.5 pl-1 pr-2.5 py-2 rounded-lg text-mono-500 hover:text-mono-200 hover:bg-mono-800 transition-colors cursor-pointer shrink-0" title="Back to your deal">
                        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="m12 19-7-7 7-7" />
                            <path d="M19 12H5" />
                        </svg>
                        <span class="text-[12.5px]">shuffle</span>
                    </button>

                    <div class="flex-1 relative">
                        <input ref="searchInput" v-model="searchQuery" type="text" placeholder="Search notes…" class="w-full pl-9 pr-3 py-2 bg-mono-900 border border-mono-800 rounded-lg focus:outline-none focus:border-accent transition-colors placeholder:text-mono-600 placeholder:italic text-sm text-white" />
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="absolute left-3 top-1/2 -translate-y-1/2 text-mono-600 pointer-events-none">
                            <circle cx="11" cy="11" r="7" />
                            <path d="m21 21-4.3-4.3" />
                        </svg>
                    </div>
                </div>

                <!-- Book filter — compact line + popover, composable with search -->
                <div class="mt-2 px-0.5">
                    <BookLinePicker :book="selectedBook" placeholder="filter by book…" :books="filterBooks" :counts="bookCounts" allowUnattached :unattached="bookFilter === 'none'" :unattachedCount="unattachedCount" @update:book="onFilterBook" @update:unattached="onFilterUnattached" @open="loadBookMeta" />
                </div>

                <!-- Result count -->
                <div class="flex items-center justify-end pt-2 pb-1">
                    <span v-if="searchTotal !== null && !pagination.loading.value" class="text-[11px] text-mono-500 tabular-nums">
                        <b class="text-mono-300 font-semibold">{{ searchNotes.length < searchTotal ? searchNotes.length + ' of ' : '' }}{{ searchTotal.toLocaleString() }}</b> notes
                    </span>
                </div>

                <!-- Results -->
                <div class="mt-3 space-y-3">
                    <template v-if="pagination.loading.value">
                        <NoteCardSkeleton v-for="i in 5" :key="i" />
                    </template>

                    <div v-else-if="pagination.error.value" class="p-6 border border-red-900 bg-red-950/20 text-center rounded-lg">
                        <p class="text-red-500 font-bold uppercase text-sm mb-4">{{ pagination.error.value }}</p>
                        <button @click="runSearch" class="px-4 py-2 bg-red-900 hover:bg-red-800 text-white text-xs font-bold uppercase tracking-wide transition-colors cursor-pointer">
                            Retry Connection
                        </button>
                    </div>

                    <div v-else-if="searchNotes.length === 0" class="py-20 text-center text-mono-600 border border-dashed border-mono-800 rounded-lg">
                        <p class="text-sm uppercase tracking-wide mb-3">No notes found matching criteria.</p>
                        <button v-if="searchQuery || bookFilter !== 'all'" @click="searchQuery = ''; bookFilter = 'all'" class="text-xs text-accent-bright hover:text-accent transition-colors cursor-pointer underline underline-offset-4 decoration-dotted">
                            clear filters
                        </button>
                    </div>

                    <template v-else>
                        <NoteCard v-for="note in searchNotes" :key="note.id" :note="note" :searchQuery="searchQuery" :isAdmin="isAdmin" :book="bookFor(note)" :connectedAuthor="noteAuthors.get(note.id) ?? null" :latestThread="noteThreads.get(note.id) ?? null" clamp @edit="emit('edit', $event)" @copy="handleCopy" @present="emit('present', $event)" @delete="handleDelete" @viewInLibrary="emit('viewInLibrary', $event)" @addToThread="emit('addToThread', $event)" @navigateToThread="emit('navigateToThread', $event)" />

                        <!-- Infinite scroll sentinel -->
                        <div ref="scrollSentinel" class="h-1"></div>

                        <div v-if="pagination.loadingMore.value" class="py-6 text-center">
                            <div class="inline-block animate-spin h-5 w-5 border-2 border-accent border-t-transparent rounded-full"></div>
                        </div>
                    </template>
                </div>
            </div>
        </transition>
    </div>
</template>

<style scoped>
/* Cards are dealt, not loaded — 60ms stagger via inline animation-delay */
.deal-in {
    animation: dealt 0.45s cubic-bezier(0.16, 1, 0.3, 1) both;
}

@keyframes dealt {
    from {
        opacity: 0;
        transform: translateY(14px) scale(0.985);
    }

    to {
        opacity: 1;
        transform: none;
    }
}

/* Mode switch: outgoing view blurs away, incoming rises into focus */
.mode-enter-active {
    transition:
        opacity 0.28s cubic-bezier(0.16, 1, 0.3, 1),
        transform 0.28s cubic-bezier(0.16, 1, 0.3, 1),
        filter 0.28s cubic-bezier(0.16, 1, 0.3, 1);
}

.mode-leave-active {
    transition:
        opacity 0.16s ease-in,
        transform 0.16s ease-in,
        filter 0.16s ease-in;
}

.mode-enter-from {
    opacity: 0;
    transform: translateY(14px) scale(0.99);
    filter: blur(5px);
}

.mode-leave-to {
    opacity: 0;
    transform: translateY(-10px) scale(0.995);
    filter: blur(5px);
}

@media (prefers-reduced-motion: reduce) {
    .deal-in {
        animation: none;
    }

    .mode-enter-active,
    .mode-leave-active {
        transition: opacity 0.15s ease;
    }

    .mode-enter-from,
    .mode-leave-to {
        transform: none;
        filter: none;
    }
}
</style>
