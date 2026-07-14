<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import type { Quote, Book } from '../../lib/api';
import { fetchBookById, getSignedFileUrl } from '../../lib/api';
import { usePresentationFontSize, FONT_SIZE_MIN, FONT_SIZE_MAX, FONT_SIZE_STEP } from '../../composables/usePresentationFontSize';
import { useTypography } from '../../composables/useTypography';
import { usePresentationJustify } from '../../composables/usePresentationJustify';
import { usePresentationHyphenation } from '../../composables/usePresentationHyphenation';
import { usePresentationQuoteMode, textureAsset, variantForSeed } from '../../composables/usePresentationQuoteMode';
import { usePresentationTextureDarkness, DARKNESS_MIN, DARKNESS_MAX, DARKNESS_STEP } from '../../composables/usePresentationTextureDarkness';
import { useAutoChrome } from '../../composables/useAutoChrome';
import PresentationFontControls from '../shared/PresentationFontControls.vue';
import PresentationDarknessControl from '../shared/PresentationDarknessControl.vue';
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
const showDarkness = ref(false);

// Font and darkness panels share the bottom slot — opening one closes the other.
function toggleFontControls() {
    showFontControls.value = !showFontControls.value;
    if (showFontControls.value) showDarkness.value = false;
}
function toggleDarkness() {
    showDarkness.value = !showDarkness.value;
    if (showDarkness.value) showFontControls.value = false;
}

const VERTICAL_MARGIN = 12;

const contentLength = computed(() => props.quote?.quote?.length ?? 0);
const { baseFontSize, typographyClass } = useTypography('quote', 'presentation', contentLength);

const { finalFontSize, setFontSize, reset } = usePresentationFontSize('quote', baseFontSize);

const { justified, toggle: toggleJustify } = usePresentationJustify();

const { hyphenation, toggle: toggleHyphenation } = usePresentationHyphenation();

const { mode: quoteMode, cycle: cycleQuoteMode } = usePresentationQuoteMode('quote');

const { darkness, setDarkness, reset: resetDarkness } = usePresentationTextureDarkness();

// Resolve the texture asset for this quote: card mode uses tex-*, full-bleed
// uses the larger fb-*; plain has no texture. Seeded by the quote id, so the
// texture is stable across surface toggles and matches the same quote's
// Quotes-tab card (see variantForSeed in usePresentationQuoteMode).
const textureUrl = computed(() => {
    if (quoteMode.value === 'plain' || !props.quote) return undefined;
    return textureAsset(variantForSeed(props.quote.id), quoteMode.value === 'fullbleed' ? 'fullbleed' : 'card');
});

// Card-tier (tex-*) URL of the same variant — the instant placeholder / decode
// fallback for the heavier full-bleed tier (see useTextureImage).
const fallbackTextureUrl = computed(() =>
    props.quote ? textureAsset(variantForSeed(props.quote.id), 'card') : undefined,
);

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
        // Keep the persisted surface mode across reopens (no forced reset).
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
            <div v-if="isOpen && quote" class="fixed inset-0 z-50 flex flex-col items-center justify-center bg-mono-950 cursor-pointer touch-manipulation" :style="{ paddingTop: (quoteMode === 'fullbleed' ? 0 : VERTICAL_MARGIN) + 'px', paddingBottom: (quoteMode === 'fullbleed' ? 0 : VERTICAL_MARGIN) + 'px' }" @click="emit('close')" @pointermove="poke" @touchstart.passive="poke">
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
                    <button @click.stop="toggleFontControls()" class="p-2 text-mono-500 hover:text-mono-200 transition-colors cursor-pointer" :class="showFontControls ? 'text-quote' : ''" aria-label="Toggle font size controls">
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

                    <!-- Quote surface toggle — the glyph reflects the current
                         surface (card / full-bleed / plain); lit while a texture
                         is showing. Cycles textured → fullbleed → plain. -->
                    <button @click.stop="cycleQuoteMode(); poke()" class="p-2 text-mono-500 hover:text-mono-200 transition-colors cursor-pointer" :class="quoteMode !== 'plain' ? 'text-quote' : ''" :aria-label="`Surface: ${quoteMode} — tap to change`" :title="`Surface: ${quoteMode} — tap to change`">
                        <!-- textured: framed picture (card over a texture) -->
                        <svg v-if="quoteMode === 'textured'" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="3" y="3" width="18" height="18" rx="2" />
                            <circle cx="9" cy="9" r="1.6" fill="currentColor" stroke="none" />
                            <path d="m21 15-4.5-4.5L7 20" />
                        </svg>
                        <!-- fullbleed: texture bleeds to the edges (maximize) -->
                        <svg v-else-if="quoteMode === 'fullbleed'" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M8 3H5a2 2 0 0 0-2 2v3" />
                            <path d="M16 3h3a2 2 0 0 1 2 2v3" />
                            <path d="M21 16v3a2 2 0 0 1-2 2h-3" />
                            <path d="M3 16v3a2 2 0 0 0 2 2h3" />
                        </svg>
                        <!-- plain: no surface — text lines only -->
                        <svg v-else xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M4 6h16" /><path d="M4 12h16" /><path d="M4 18h10" />
                        </svg>
                    </button>

                    <!-- Texture darkness slider toggle — only meaningful when a
                         texture is showing (textured / fullbleed). -->
                    <button v-if="quoteMode !== 'plain'" @click.stop="toggleDarkness()" class="p-2 text-mono-500 hover:text-mono-200 transition-colors cursor-pointer" :class="showDarkness ? 'text-quote' : ''" aria-label="Toggle texture darkness">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="9" />
                            <path d="M12 3v18a9 9 0 0 0 0-18z" fill="currentColor" stroke="none" />
                        </svg>
                    </button>
                </div>
                </PresentationChrome>

                <!-- Content card — shared body component owns the cardless
                     blockquote + right-aligned em-dash attribution.
                     Full-bleed renders an absolute inset:0 texture, so its host
                     must be positioned. It fills the entire fixed root (edge to
                     edge, ignoring the vertical margin) so the texture truly
                     bleeds; the font slider floats on top of it. Textured/plain
                     size to content and sit centered. -->
                <div
                    ref="cardRef"
                    class="flex flex-col"
                    :class="quoteMode === 'fullbleed' ? 'absolute inset-0 overflow-hidden' : 'w-full sm:max-w-2xl overflow-y-auto'"
                    :style="quoteMode === 'fullbleed' ? undefined : { maxHeight: `calc(100vh - ${VERTICAL_MARGIN * 2 + (showFontControls || showDarkness ? 80 : 0)}px)` }"
                    @click.stop
                >
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
                        :mode="quoteMode"
                        :texture-url="textureUrl"
                        :fallback-texture-url="fallbackTextureUrl"
                        :darkness="darkness"
                    />
                </div>

                <!-- Font size controls. In full-bleed the texture fills the
                     whole root, so the slider floats over it at the bottom
                     (above the texture, with a safe bottom inset); in other
                     modes it flows below the centered card. -->
                <div :class="quoteMode === 'fullbleed' ? 'absolute inset-x-0 bottom-0 z-20 flex justify-center pb-8' : 'contents'" @click.stop>
                    <PresentationFontControls v-show="showFontControls" :fontSize="finalFontSize" :min="FONT_SIZE_MIN" :max="FONT_SIZE_MAX" :step="FONT_SIZE_STEP" color="quote" @change="setFontSize" @reset="reset" />
                    <PresentationDarknessControl v-show="showDarkness && quoteMode !== 'plain'" :darkness="darkness" :min="DARKNESS_MIN" :max="DARKNESS_MAX" :step="DARKNESS_STEP" color="quote" @change="setDarkness" @reset="resetDarkness" />
                </div>
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
