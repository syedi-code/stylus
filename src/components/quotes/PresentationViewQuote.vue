<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import type { Quote, Book } from '../../lib/api';
import { fetchBookById, getSignedFileUrl } from '../../lib/api';
import { usePresentationFontSize, FONT_SIZE_MIN, FONT_SIZE_MAX, FONT_SIZE_STEP } from '../../composables/usePresentationFontSize';
import { useTypography } from '../../composables/useTypography';
import { usePresentationJustify } from '../../composables/usePresentationJustify';
import { usePresentationHyphenation } from '../../composables/usePresentationHyphenation';
import { useAutoChrome } from '../../composables/useAutoChrome';
import PresentationFontControls from '../shared/PresentationFontControls.vue';
import PresentationChrome from '../shared/PresentationChrome.vue';
import QuoteSlideBody from './QuoteSlideBody.vue';

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

const { justified, toggle: toggleJustify } = usePresentationJustify();

const { hyphenation, toggle: toggleHyphenation } = usePresentationHyphenation();

// Auto-fading chrome (action buttons) — mirrors the essay deck via the shared
// useAutoChrome timer + PresentationChrome wrapper.
const { chromeVisible, poke } = useAutoChrome(2800);

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
        poke();
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
            <div v-if="isOpen && quote" class="fixed inset-0 z-50 flex flex-col items-center justify-center bg-mono-950 cursor-pointer" :style="{ paddingTop: VERTICAL_MARGIN + 'px', paddingBottom: VERTICAL_MARGIN + 'px' }" @click="emit('close')" @pointermove="poke" @touchstart.passive="poke">
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
                    <button @click.stop="showFontControls = !showFontControls" class="p-2 text-mono-500 hover:text-mono-200 transition-colors cursor-pointer" :class="showFontControls ? 'text-quote' : ''" aria-label="Toggle font size controls">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M4 7V4h16v3" />
                            <path d="M9 20h6" />
                            <path d="M12 4v16" />
                        </svg>
                    </button>

                    <!-- Justify toggle button -->
                    <button @click.stop="toggleJustify()" class="p-2 text-mono-500 hover:text-mono-200 transition-colors cursor-pointer" :class="justified ? 'text-quote' : ''" :aria-label="justified ? 'Disable justified text' : 'Enable justified text'">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M3 6h18" />
                            <path d="M3 12h18" />
                            <path d="M3 18h18" />
                        </svg>
                    </button>

                    <!-- Hyphenation toggle button -->
                    <button @click.stop="toggleHyphenation()" class="p-2 text-mono-500 hover:text-mono-200 transition-colors cursor-pointer" :class="hyphenation ? 'text-quote' : ''" :aria-label="hyphenation ? 'Disable hyphenation' : 'Enable hyphenation'">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M3 6h18" />
                            <path d="M3 12h8" />
                            <path d="M12 12h1.5" />
                            <path d="M3 18h18" />
                        </svg>
                    </button>
                </div>
                </PresentationChrome>

                <!-- Content card — shared body component owns the cardless
                     blockquote + right-aligned em-dash attribution. -->
                <div ref="cardRef" class="w-full sm:max-w-2xl flex flex-col overflow-y-auto" :style="{ maxHeight: `calc(100vh - ${VERTICAL_MARGIN * 2 + (showFontControls ? 80 : 0)}px)` }" @click.stop>
                    <QuoteSlideBody
                        :text="quote.quote || ''"
                        :creator="book ? book.author : (quote.creator || undefined)"
                        :work="book ? book.title : (quote.work || undefined)"
                        :year="book?.originally_published || undefined"
                        :page="quote.page || undefined"
                        :pdf-url="pdfUrlWithPage || undefined"
                        :font-size="finalFontSize"
                        :justified="justified"
                        :hyphenation="hyphenation"
                        :typography-class="typographyClass"
                        with-quotation-marks
                    />
                </div>

                <!-- Font size controls -->
                <PresentationFontControls v-show="showFontControls" :fontSize="finalFontSize" :min="FONT_SIZE_MIN" :max="FONT_SIZE_MAX" :step="FONT_SIZE_STEP" color="quote" @change="setFontSize" @reset="reset" />
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
