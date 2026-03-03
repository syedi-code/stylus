<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import type { Quote, Book } from '../lib/api';
import { fetchBookById, getSignedFileUrl } from '../lib/api';
import { formatMarkdown } from '../lib/formatText';
import { usePresentationFontSize, FONT_SIZE_MIN, FONT_SIZE_MAX, FONT_SIZE_STEP } from '../composables/usePresentationFontSize';
import PresentationFontControls from './PresentationFontControls.vue';

const props = withDefaults(defineProps<{
    quote: Quote | null;
    isOpen: boolean;
}>(), {});

const emit = defineEmits(['close']);

const book = ref<Book | null>(null);
const pdfUrl = ref<string | null>(null);
const showFontControls = ref(false);

const VERTICAL_MARGIN = 12;

const baseFontSize = computed(() => {
    const len = props.quote?.quote?.length ?? 0;
    if (len < 80) return 22;
    if (len < 200) return 20;
    if (len < 400) return 18;
    if (len < 700) return 16;
    if (len < 1200) return 14;
    return 12;
});

const { finalFontSize, setFontSize, reset } = usePresentationFontSize('quote', baseFontSize);

const parsePrintPage = (pageStr: string | undefined): number | null => {
    if (!pageStr) return null;
    const match = pageStr.match(/^(\d+)/);
    return match ? parseInt(match[1], 10) : null;
};

const getPdfPage = computed(() => {
    const printPage = parsePrintPage(props.quote?.page);
    if (printPage === null || !book.value) return null;
    return printPage + (book.value.pdf_page_offset || 0);
});

const pdfUrlWithPage = computed(() => {
    if (!pdfUrl.value) return null;
    const pdfPage = getPdfPage.value;
    return pdfPage !== null ? `${pdfUrl.value}#page=${pdfPage}` : pdfUrl.value;
});



const loadBook = async () => {
    const bookId = props.quote?.book_id;
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

watch(() => props.isOpen, (isOpen) => {
    if (isOpen) {
        loadBook();
    } else {
        book.value = null;
        pdfUrl.value = null;
    }
});
</script>

<template>
    <Teleport to="body">
        <Transition name="presentation">
            <div v-if="isOpen && quote" class="fixed inset-0 z-50 flex flex-col items-center justify-center bg-mono-950 cursor-pointer" :style="{ padding: VERTICAL_MARGIN + 'px' }" @click="emit('close')"> <!-- Close button (mobile) -->
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

                <!-- Content card -->
                <div ref="cardRef" class="w-full max-w-2xl bg-mono-900 border border-accent/20 rounded-xl p-8 shadow-2xl overflow-hidden" :style="{ maxHeight: `calc(100vh - ${VERTICAL_MARGIN * 2 + (showFontControls ? 80 : 0)}px)` }" @click.stop>

                    <!-- Quote content -->
                    <div>
                        <blockquote lang="en" class="blockquote-typography text-mono-100 border-l-4 border-accent pl-6 py-2 leading-[1.45] text-left sm:text-justify" :style="{ fontSize: finalFontSize + 'px' }" v-html="formatMarkdown(quote.quote || '')"></blockquote>
                    </div>

                    <!-- Attribution -->
                    <div class="mt-6 text-mono-400 text-sm flex flex-col gap-1">
                        <!-- Book-resolved attribution -->
                        <template v-if="book">
                            <span class="font-medium text-mono-300">— {{ book.author }}</span>
                            <div class="pl-4 flex flex-col gap-0.5">
                                <span>
                                    <a v-if="pdfUrlWithPage" :href="pdfUrlWithPage" target="_blank" @click.stop class="underline decoration-mono-600 underline-offset-2 hover:text-accent hover:decoration-accent transition-colors italic">{{ book.title }}</a>
                                    <span v-else class="underline decoration-mono-600 underline-offset-2 italic">{{ book.title }}</span>
                                    <span v-if="book.originally_published" class="ml-0.5"> ({{ book.originally_published }})</span>
                                    <span v-if="quote.page">, p. {{ quote.page }}</span>
                                </span>
                            </div>
                        </template>
                        <!-- Free-text fallback -->
                        <template v-else-if="quote.creator || quote.work">
                            <span v-if="quote.creator" class="font-medium text-mono-300">— {{ quote.creator }}</span>
                            <div class="pl-4 flex flex-col gap-0.5">
                                <span v-if="quote.work" class="underline decoration-mono-600 underline-offset-2 italic">{{ quote.work }}</span>
                            </div>
                        </template>
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

.blockquote-typography {
    hyphens: auto;
    hanging-punctuation: first last;
    text-wrap: pretty;
    font-kerning: normal;
    font-variant-ligatures: common-ligatures;
    font-variant-numeric: oldstyle-nums;
    -webkit-font-smoothing: antialiased;
}
</style>
