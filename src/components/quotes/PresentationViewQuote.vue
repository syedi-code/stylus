<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import type { Quote, Book } from '../../lib/api';
import { fetchBookById, getSignedFileUrl } from '../../lib/api';
import { formatMarkdown } from '../../lib/formatText';
import { usePresentationFontSize, FONT_SIZE_MIN, FONT_SIZE_MAX, FONT_SIZE_STEP } from '../../composables/usePresentationFontSize';
import { useTypography } from '../../composables/useTypography';
import { usePresentationJustify } from '../../composables/usePresentationJustify';
import { usePresentationHyphenation } from '../../composables/usePresentationHyphenation';
import PresentationFontControls from '../shared/PresentationFontControls.vue';

const props = withDefaults(defineProps<{
    quote: Quote | null;
    isOpen: boolean;
}>(), {});

const emit = defineEmits(['close']);

const book = ref<Book | null>(null);
const pdfUrl = ref<string | null>(null);
const showFontControls = ref(false);

const VERTICAL_MARGIN = 12;

const contentLength = computed(() => props.quote?.quote?.length ?? 0);
const { baseFontSize, typographyClass } = useTypography('quote', 'presentation', contentLength);

const { finalFontSize, setFontSize, reset } = usePresentationFontSize('quote', baseFontSize);

// Line-height that tightens as font size grows: 12px → 1.35, 24px → 1.20
const lineHeight = computed(() => {
    const t = Math.min(1, Math.max(0, (finalFontSize.value - 12) / 12));
    return +(1.35 - t * 0.15).toFixed(2);
});

const { justified, toggle: toggleJustify } = usePresentationJustify();

const { hyphenation, toggle: toggleHyphenation } = usePresentationHyphenation();

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
                </div>

                <!-- Content card -->
                <div ref="cardRef" class="w-full sm:max-w-2xl bg-mono-900 border border-accent/20 rounded-xl p-4 sm:p-8 shadow-2xl flex flex-col" :style="{ maxHeight: `calc(100vh - ${VERTICAL_MARGIN * 2 + (showFontControls ? 80 : 0)}px)` }" @click.stop>

                    <!-- Quote content (scrollable) -->
                    <div class="bg-mono-950/60 rounded-lg pl-2 pr-4 pt-4 pb-0 sm:pl-3 sm:pr-5 sm:pt-5 sm:pb-0 min-h-0 overflow-y-auto scrollbar-hide flex-1">
                        <blockquote lang="en" :class="[typographyClass, 'text-mono-100 border-l-4 border-accent pl-4 py-2 whitespace-pre-wrap']" :style="{ fontSize: finalFontSize + 'px', lineHeight: lineHeight, textAlign: justified ? 'justify' : 'left', hyphens: hyphenation ? 'auto' : 'none' }" v-html="formatMarkdown(quote.quote || '')"></blockquote>
                    </div>

                    <!-- Attribution (always visible, right-aligned) -->
                    <div class="mt-2 pr-6 sm:pr-10 pb-2 text-mono-400 text-sm flex flex-col gap-0.5 shrink-0 text-right">
                        <!-- Book-resolved attribution -->
                        <template v-if="book">
                            <span class="font-medium text-mono-300">— {{ book.author }}</span>
                            <span>
                                <a v-if="pdfUrlWithPage" :href="pdfUrlWithPage" target="_blank" @click.stop class="underline decoration-mono-600 underline-offset-2 hover:text-accent hover:decoration-accent transition-colors italic">{{ book.title }}</a>
                                <span v-else class="underline decoration-mono-600 underline-offset-2 italic">{{ book.title }}</span>
                                <span v-if="book.originally_published" class="ml-0.5"> ({{ book.originally_published }})</span>
                                <span v-if="quote.page">, p. {{ quote.page }}</span>
                            </span>
                        </template>
                        <!-- Free-text fallback -->
                        <template v-else-if="quote.creator || quote.work">
                            <span v-if="quote.creator" class="font-medium text-mono-300">— {{ quote.creator }}</span>
                            <span v-if="quote.work" class="underline decoration-mono-600 underline-offset-2 italic">{{ quote.work }}</span>
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

</style>
