<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import type { Note, Book, Author } from '../lib/api';
import { fetchBookById, getSignedFileUrl, fetchConnections, fetchAuthorById } from '../lib/api';
import { formatMarkdown } from '../lib/formatText';
import { usePresentationFontSize, FONT_SIZE_MIN, FONT_SIZE_MAX, FONT_SIZE_STEP } from '../composables/usePresentationFontSize';
import { useTypography } from '../composables/useTypography';
import PresentationFontControls from './PresentationFontControls.vue';

const props = withDefaults(defineProps<{
    note: Note | null;
    isOpen: boolean;
    showVersionBadge?: boolean;
}>(), {
    showVersionBadge: false
});

const emit = defineEmits(['close']);

const showFontControls = ref(false);
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
const { baseFontSize, lineHeightClass, typographyClass } = useTypography('note', 'presentation', contentLength);

const { finalFontSize, setFontSize, reset } = usePresentationFontSize('note', baseFontSize);

watch(() => props.isOpen, (isOpen) => {
    if (isOpen) {
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
        if (book.value?.pdf_url) {
            pdfUrl.value = await getSignedFileUrl(book.value.pdf_url);
        }
    } catch {
        book.value = null;
        pdfUrl.value = null;
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
            <div v-if="isOpen && note" class="fixed inset-0 z-50 flex flex-col items-center justify-center bg-mono-950 cursor-pointer" :style="{ padding: VERTICAL_MARGIN + 'px' }" @click="emit('close')">
                <!-- Close button (mobile) -->
                <button @click="emit('close')" class="absolute top-3 right-3 z-10 p-2 text-mono-500 hover:text-mono-200 transition-colors cursor-pointer sm:hidden" aria-label="Close">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M18 6 6 18" />
                        <path d="m6 6 12 12" />
                    </svg>
                </button>

                <!-- Font size toggle button -->
                <button @click.stop="showFontControls = !showFontControls" class="absolute top-3 left-3 z-10 p-2 text-mono-500 hover:text-mono-200 transition-colors cursor-pointer" :class="showFontControls ? 'text-accent' : ''" aria-label="Toggle font size controls">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M4 7V4h16v3" />
                        <path d="M9 20h6" />
                        <path d="M12 4v16" />
                    </svg>
                </button>

                <div ref="cardRef" class="w-full max-w-xl bg-mono-900 border border-accent/20 rounded-xl p-6 shadow-2xl overflow-hidden" :style="{ maxHeight: `calc(100vh - ${VERTICAL_MARGIN * 2 + (showFontControls ? 80 : 0)}px)` }" @click.stop>
                    <!-- Type badge -->
                    <div class="mb-4 flex items-center gap-2">
                        <span class="bg-accent text-accent-text px-2 py-0.5 text-xs font-bold uppercase tracking-wider">
                            note
                        </span>
                        <span v-if="showVersionBadge && note.version && note.version > 1" class="bg-gold text-gold-text px-2 py-0.5 text-xs font-bold uppercase tracking-wider">
                            v{{ note.version }}
                        </span>
                    </div>

                    <!-- Book Attribution -->
                    <div v-if="book" class="mb-3 text-xs text-mono-500 leading-relaxed">
                        <a v-if="pdfUrlWithPage" :href="pdfUrlWithPage" target="_blank" @click.stop class="hover:text-accent transition-colors">{{ book.author }}</a>
                        <span v-else>{{ book.author }}</span>
                        <br />
                        <template v-if="pdfUrlWithPage">
                            <a :href="pdfUrlWithPage" target="_blank" @click.stop class="italic underline hover:text-accent transition-colors">{{ book.title }}</a><span v-if="book.originally_published"> ({{ book.originally_published }})</span><span v-if="note.page">, p. {{ note.page }}</span>
                        </template>
                        <template v-else>
                            <span><span class="italic">{{ book.title }}</span><span v-if="book.originally_published"> ({{ book.originally_published }})</span><span v-if="note.page">, p. {{ note.page }}</span></span>
                        </template>
                    </div>

                    <!-- Author Attribution (no book, connected via connections table) -->
                    <div v-else-if="connectedAuthor" class="mb-3 text-xs text-mono-500 leading-relaxed">
                        <span class="underline decoration-mono-600 underline-offset-2 text-mono-400">{{ connectedAuthor.name }}</span>
                    </div>
                    <p v-if="note.content" :class="[typographyClass, lineHeightClass, 'whitespace-pre-wrap text-mono-100']" :style="{ fontSize: finalFontSize + 'px' }" v-html="formatMarkdown(note.content)"></p>
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
