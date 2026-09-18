<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import type { Note, Book, Author } from '../../lib/api';
import { fetchBookById, getSignedFileUrl, fetchConnections, fetchAuthorById } from '../../lib/api';
import { formatMarkdown } from '../../lib/formatText';
import { usePresentationFontSize, FONT_SIZE_MIN, FONT_SIZE_MAX, FONT_SIZE_STEP } from '../../composables/usePresentationFontSize';
import { useTypography } from '../../composables/useTypography';
import { usePresentationJustify } from '../../composables/usePresentationJustify';
import { usePresentationHyphenation } from '../../composables/usePresentationHyphenation';
import { useAutoChrome } from '../../composables/useAutoChrome';
import PresentationFontControls from '../shared/PresentationFontControls.vue';
import PresentationChrome from '../shared/PresentationChrome.vue';
import BookAttribution from '../books/BookAttribution.vue';

const props = withDefaults(defineProps<{
    note: Note | null;
    isOpen: boolean;
    showVersionBadge?: boolean;
}>(), {
    showVersionBadge: false
});

const emit = defineEmits<{
    (e: 'close'): void;
}>();

const showFontControls = ref(false);
// Version metadata is hidden by default; toggled by the info button
// in the top-left chrome so the presentation surface stays minimal.
const showMeta = ref(false);
const book = ref<Book | null>(null);
const pdfUrl = ref<string | null>(null);
const connectedAuthor = ref<Author | null>(null);

const parsePrintPage = (pageStr: string | undefined): number | null => {
    if (!pageStr) return null;
    const match = pageStr.match(/^(\d+)/);
    if (match) {
        return parseInt(match[1], 10);
    }
    return null;
};

const getPdfPage = computed(() => {
    const printPage = parsePrintPage(props.note?.page);
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

const VERTICAL_MARGIN = 12;

const contentLength = computed(() => props.note?.content?.length ?? 0);
const { baseFontSize, typographyClass } = useTypography('note', 'presentation', contentLength);

const { finalFontSize, setFontSize, reset } = usePresentationFontSize('note', baseFontSize);

const { justified, toggle: toggleJustify } = usePresentationJustify('note');
const { hyphenation, toggle: toggleHyphenation } = usePresentationHyphenation('note');

// Auto-fading chrome (action buttons) — mirrors the essay deck via the shared
// useAutoChrome timer + PresentationChrome wrapper.
const { chromeVisible, poke } = useAutoChrome(2800);

// Date footer (a la Thoughts), revealed by the meta toggle alongside the
// version badge.
const formattedDate = computed(() => {
    if (!props.note) return '';
    const date = new Date(props.note.created_at);
    return date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
    });
});

const formattedTime = computed(() => {
    if (!props.note) return '';
    const date = new Date(props.note.created_at);
    return date.toLocaleTimeString('en-US', {
        timeZone: 'America/Los_Angeles',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    });
});

watch(() => props.isOpen, (isOpen) => {
    if (isOpen) {
        poke();
        loadBook();
        loadAuthorConnection();
    } else {
        book.value = null;
        pdfUrl.value = null;
        connectedAuthor.value = null;
    }
});

const loadBook = async () => {
    const bookId = props.note?.book_id;
    if (!bookId) {
        book.value = null;
        pdfUrl.value = null;
        return;
    }
    try {
        book.value = await fetchBookById(bookId);
    } catch {
        book.value = null;
        pdfUrl.value = null;
        return;
    }
    if (book.value?.pdf_url) {
        try {
            const path = book.value.pdf_url.replace('/files/', '');
            pdfUrl.value = await getSignedFileUrl(path);
        } catch {
            pdfUrl.value = null;
        }
    }
};

const loadAuthorConnection = async () => {
    if (!props.note || props.note.book_id) {
        connectedAuthor.value = null;
        return;
    }
    try {
        const conns = await fetchConnections('note', props.note.id, 'author');
        if (conns.length > 0) {
            const conn = conns[0];
            const authorId = conn.a_type === 'author' ? conn.a_id : conn.b_id;
            connectedAuthor.value = await fetchAuthorById(authorId);
        } else {
            connectedAuthor.value = null;
        }
    } catch {
        connectedAuthor.value = null;
    }
};
</script>

<template>
    <Teleport to="body">
        <Transition name="presentation">
            <div v-if="isOpen && note" class="fixed inset-0 z-50 flex flex-col items-center justify-center bg-mono-950 cursor-pointer" :style="{ paddingTop: VERTICAL_MARGIN + 'px', paddingBottom: VERTICAL_MARGIN + 'px' }" @click="emit('close')" @pointermove="poke" @touchstart.passive="poke">
                <!-- Auto-fading chrome: close + action buttons hide after inactivity. -->
                <PresentationChrome :visible="chromeVisible">
                    <!-- Close button (mobile) -->
                    <button @click="emit('close')" class="absolute top-3 right-3 z-10 p-2 text-mono-500 hover:text-mono-200 transition-colors cursor-pointer sm:hidden" aria-label="Close">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M18 6 6 18" />
                            <path d="m6 6 12 12" />
                        </svg>
                    </button>

                    <!-- Top-left controls -->
                    <div class="absolute top-3 left-3 z-10 flex items-center gap-1">
                        <!-- Font size toggle button -->
                        <button @click.stop="showFontControls = !showFontControls" class="p-2 text-mono-500 hover:text-mono-200 transition-colors cursor-pointer" :class="showFontControls ? 'text-accent' : ''" aria-label="Toggle font size controls">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M4 7V4h16v3" />
                                <path d="M9 20h6" />
                                <path d="M12 4v16" />
                            </svg>
                        </button>

                        <!-- Justify toggle button -->
                        <button @click.stop="toggleJustify()" class="p-2 text-mono-500 hover:text-mono-200 transition-colors cursor-pointer" :class="justified ? 'text-accent' : ''" :aria-label="justified ? 'Disable justified text' : 'Enable justified text'">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M3 6h18" />
                                <path d="M3 12h18" />
                                <path d="M3 18h18" />
                            </svg>
                        </button>

                        <!-- Hyphenation toggle button -->
                        <button @click.stop="toggleHyphenation()" class="p-2 text-mono-500 hover:text-mono-200 transition-colors cursor-pointer" :class="hyphenation ? 'text-accent' : ''" :aria-label="hyphenation ? 'Disable hyphenation' : 'Enable hyphenation'">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M3 6h18" />
                                <path d="M3 12h8" />
                                <path d="M12 12h1.5" />
                                <path d="M3 18h18" />
                            </svg>
                        </button>

                        <!-- Meta toggle: reveals the version badge + the
                         created-at date footer. Tag icon reads as
                         "show labels/badges". -->
                        <button @click.stop="showMeta = !showMeta" class="p-2 text-mono-500 hover:text-mono-200 transition-colors cursor-pointer" :class="showMeta ? 'text-accent' : ''" :aria-label="showMeta ? 'Hide note metadata' : 'Show note metadata'">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z" />
                                <circle cx="7.5" cy="7.5" r=".5" fill="currentColor" />
                            </svg>
                        </button>
                    </div>
                </PresentationChrome>

                <div ref="cardRef" class="w-full max-w-xl flex flex-col overflow-y-auto px-6 sm:px-8 -translate-y-[2vh]" :style="{ maxHeight: `calc(100vh - ${VERTICAL_MARGIN * 2 + (showFontControls ? 80 : 0)}px)` }" @click.stop>
                    <!-- Type badge. The version badge is hidden by default;
                         the tag toggle in the top chrome reveals it. Book
                         attribution below is independent and always shown
                         when a book is linked. -->
                    <div class="mb-1.5 flex items-center gap-2">
                        <span class="bg-accent text-accent-text px-2 py-0.5 text-xs font-bold uppercase tracking-wider">
                            note
                        </span>
                    </div>

                    <!-- Book Attribution -->
                    <BookAttribution v-if="book" class="mb-5" variant="note" muted-title :author="book.author" :title="book.title" :year="book.originally_published" :page="note.page" :title-href="pdfUrlWithPage" />

                    <!-- Author Attribution (no book, connected via connections table) -->
                    <div v-else-if="connectedAuthor" class="mb-5 text-xs text-mono-500 leading-relaxed">
                        <span class="underline decoration-mono-600 underline-offset-2 text-mono-400">{{ connectedAuthor.name }}</span>
                    </div>

                    <!-- Free-text Attribution (no book, no author connection) -->
                    <div v-else-if="note.creator || note.work" class="mb-5 text-xs text-mono-500 leading-relaxed">
                        <p v-if="note.creator" class="font-medium text-mono-400">{{ note.creator }}</p>
                        <p v-if="note.work" class="italic">{{ note.work }}</p>
                    </div>
                    <p v-if="note.content" :class="[typographyClass, 'whitespace-pre-wrap text-white']" :style="{ fontSize: finalFontSize + 'px', lineHeight: 'var(--content-leading)', textAlign: justified ? 'justify' : 'left', hyphens: hyphenation ? 'auto' : 'none' }" v-html="formatMarkdown(note.content)"></p>

                    <!-- Date footer (a la Thoughts) — revealed by the meta toggle. -->
                    <div v-show="showMeta" class="mt-4 pt-3 text-xs text-mono-500">
                        {{ formattedDate }} · {{ formattedTime }}
                    </div>
                </div>

                <!-- Font size controls -->
                <PresentationFontControls v-show="showFontControls" :fontSize="finalFontSize" :min="FONT_SIZE_MIN" :max="FONT_SIZE_MAX" :step="FONT_SIZE_STEP" color="accent" @change="setFontSize" @reset="reset" />
            </div>
        </Transition>
    </Teleport>
</template>

<style scoped>
.presentation-enter-active,
.presentation-leave-active {
    transition: opacity 0.15s ease;
}

.presentation-enter-from,
.presentation-leave-to {
    opacity: 0;
}
</style>
