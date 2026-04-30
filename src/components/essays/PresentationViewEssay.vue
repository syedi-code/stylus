<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, toRef, nextTick } from 'vue';
import type { Essay, Thread } from '../../lib/api';
import { fetchThreadsForEntity } from '../../lib/api';
import {
    usePresentationFontSize,
    FONT_SIZE_MIN,
    FONT_SIZE_MAX,
    FONT_SIZE_STEP,
} from '../../composables/usePresentationFontSize';
import { usePresentationJustify } from '../../composables/usePresentationJustify';
import { usePresentationHyphenation } from '../../composables/usePresentationHyphenation';
import { useEssaySlides } from '../../composables/useEssaySlides';
import { useSwipeNavigation } from '../../composables/useSwipeNavigation';
import { useAutoChrome } from '../../composables/useAutoChrome';
import PresentationFontControls from '../shared/PresentationFontControls.vue';
import EssaySlide from './EssaySlide.vue';
import EssayHeaderSlide from './EssayHeaderSlide.vue';
import EssayQuoteSlide from './EssayQuoteSlide.vue';
import EssayBookCoverSlide from './EssayBookCoverSlide.vue';
import EssayEndSlide from './EssayEndSlide.vue';
import EssaySlideProgressBar from './EssaySlideProgressBar.vue';
import EssaySlideExportFrame from './EssaySlideExportFrame.vue';

const props = defineProps<{
    essay: Essay | null;
    isOpen: boolean;
}>();

const emit = defineEmits<{
    (e: 'close'): void;
    (e: 'navigateToThread', threadId: string): void;
}>();

const essayRef = toRef(props, 'essay');
const { slides, total, bodyTotal } = useEssaySlides(essayRef);

const currentIndex = ref(0);
const latestThread = ref<Thread | null>(null);

const baseFontSize = ref(12);
const { finalFontSize, setFontSize, reset } = usePresentationFontSize('essay', baseFontSize);
const { justified, toggle: toggleJustify } = usePresentationJustify('essay');
const { hyphenation, toggle: toggleHyphenation } = usePresentationHyphenation('essay');

const showFontControls = ref(false);
const { chromeVisible, poke, show: showChrome } = useAutoChrome(2800);

const exporting = ref(false);
const exportText = ref('');
const exportCounter = ref('');
const exportFontSize = ref(38);
const exportFrameRef = ref<HTMLElement | null>(null);

function goPrev() {
    if (currentIndex.value > 0) currentIndex.value -= 1;
    poke();
}
function goNext() {
    if (currentIndex.value < total.value - 1) currentIndex.value += 1;
    poke();
}
function dismiss() {
    emit('close');
}

function isInteractiveTarget(x: number, y: number): HTMLElement | null {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    if (!el) return null;
    return el.closest('button, a, [role="button"], input, textarea') as HTMLElement | null;
}

function handleTap(x: number, y: number) {
    const interactive = isInteractiveTarget(x, y);
    if (interactive) {
        interactive.click();
        return;
    }
    const w = window.innerWidth;
    if (x < w * 0.33) goPrev();
    else if (x > w * 0.67) goNext();
    else {
        if (chromeVisible.value) chromeVisible.value = false;
        else showChrome();
    }
}

const {
    isDragging,
    dragDeltaX,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onTouchCancel,
} = useSwipeNavigation({
    onPrev: goPrev,
    onNext: goNext,
    onDismiss: dismiss,
    onTap: handleTap,
});

function handleBackdropClick(e: MouseEvent) {
    const w = window.innerWidth;
    if (e.clientX < w * 0.33) goPrev();
    else if (e.clientX > w * 0.67) goNext();
    else {
        if (chromeVisible.value) chromeVisible.value = false;
        else showChrome();
    }
}

const trackStyle = computed(() => {
    const base = -currentIndex.value * 100;
    const dragPct = isDragging.value && total.value > 0
        ? (dragDeltaX.value / window.innerWidth) * 100
        : 0;
    return {
        transform: `translateX(calc(${base}% + ${dragPct}%))`,
        transition: isDragging.value ? 'none' : 'transform 260ms cubic-bezier(0.22, 0.61, 0.36, 1)',
    };
});

const counterText = computed(() => `${currentIndex.value + 1} / ${total.value}`);

function onKeydown(e: KeyboardEvent) {
    if (!props.isOpen) return;
    if (e.key === 'ArrowLeft') { goPrev(); e.preventDefault(); }
    else if (e.key === 'ArrowRight' || e.key === ' ') { goNext(); e.preventDefault(); }
    else if (e.key === 'Escape') { dismiss(); e.preventDefault(); }
}

onMounted(() => window.addEventListener('keydown', onKeydown));
onUnmounted(() => window.removeEventListener('keydown', onKeydown));

watch(() => props.isOpen, async (isOpen) => {
    if (isOpen && props.essay) {
        currentIndex.value = 0;
        showChrome();
        poke();
        document.body.style.overflow = 'hidden';
        try {
            const threads = await fetchThreadsForEntity('essay', props.essay.id);
            latestThread.value = threads.length
                ? threads.sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0]
                : null;
        } catch {
            latestThread.value = null;
        }
    } else {
        latestThread.value = null;
        showFontControls.value = false;
        document.body.style.overflow = '';
    }
});

watch(() => props.essay?.id, () => {
    currentIndex.value = 0;
});

onUnmounted(() => {
    document.body.style.overflow = '';
});

async function handleSaveImage() {
    if (!props.essay || exporting.value) return;
    exporting.value = true;

    const slide = slides.value[currentIndex.value];
    if (slide?.kind === 'paragraph') {
        exportText.value = slide.text;
    } else {
        const firstPara = slides.value.find((s) => s.kind === 'paragraph');
        exportText.value = firstPara && firstPara.kind === 'paragraph' ? firstPara.text : (props.essay.content ?? '');
    }
    exportCounter.value = counterText.value;

    const charCount = exportText.value.length;
    exportFontSize.value = charCount < 120 ? 56 : charCount < 280 ? 46 : charCount < 500 ? 38 : charCount < 800 ? 32 : 28;

    await nextTick();
    try {
        const { toBlob } = await import('html-to-image');
        const node = exportFrameRef.value;
        if (!node) throw new Error('export frame missing');
        const blob = await toBlob(node, {
            width: 1080,
            height: 1920,
            pixelRatio: 0.75,
            cacheBust: false,
            backgroundColor: '#020202',
        });
        if (!blob) throw new Error('blob generation failed');

        const filename = `essay-${props.essay.id.slice(0, 8)}-${currentIndex.value + 1}.png`;
        const file = new File([blob], filename, { type: 'image/png' });

        const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
        if (nav.canShare && nav.canShare({ files: [file] })) {
            try {
                await navigator.share({
                    files: [file],
                    title: `Essay · ${currentIndex.value + 1} / ${total.value}`,
                });
            } catch (shareErr) {
                const name = (shareErr as { name?: string })?.name;
                if (name === 'AbortError') {
                    // user cancelled — silent
                } else if (name === 'NotAllowedError') {
                    // user-activation expired (render took too long); no retry
                    console.warn('Share denied (activation expired)');
                } else {
                    throw shareErr;
                }
            }
        } else {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.download = filename;
            link.href = url;
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 0);
        }
    } catch (err) {
        console.error('Failed to export slide', err);
    } finally {
        exporting.value = false;
    }
}

function openFontControls() {
    showFontControls.value = !showFontControls.value;
    showChrome();
}
</script>

<template>
    <Teleport to="body">
        <Transition name="presentation">
            <div
                v-if="isOpen && essay"
                class="fixed inset-0 z-50 bg-mono-950 flex flex-col select-none"
                @pointermove="poke"
                @click="handleBackdropClick"
                @touchstart.passive="onTouchStart"
                @touchmove.passive="onTouchMove"
                @touchend="(e) => onTouchEnd(e)"
                @touchcancel="onTouchCancel"
            >
                <!-- Top chrome -->
                <div
                    class="absolute top-0 left-0 right-0 z-20 transition-opacity duration-300 pointer-events-none"
                    :class="chromeVisible ? 'opacity-100' : 'opacity-0'"
                >
                    <div class="flex items-center gap-2 px-3 pt-3 pb-2 pointer-events-auto" @click.stop>
                        <EssaySlideProgressBar :total="total" :current="currentIndex" />
                    </div>
                    <div class="flex items-center justify-between px-3 pb-1 pointer-events-auto" @click.stop>
                        <div class="flex items-center gap-1">
                            <button
                                @click.stop="openFontControls"
                                class="p-2 text-mono-500 hover:text-mono-200 transition-colors cursor-pointer"
                                :class="showFontControls ? 'text-essay' : ''"
                                aria-label="Font size"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M4 7V4h16v3" /><path d="M9 20h6" /><path d="M12 4v16" />
                                </svg>
                            </button>
                            <button
                                @click.stop="toggleJustify(); poke()"
                                class="p-2 text-mono-500 hover:text-mono-200 transition-colors cursor-pointer"
                                :class="justified ? 'text-essay' : ''"
                                aria-label="Justify"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M3 6h18" /><path d="M3 12h18" /><path d="M3 18h18" />
                                </svg>
                            </button>
                            <button
                                @click.stop="toggleHyphenation(); poke()"
                                class="p-2 text-mono-500 hover:text-mono-200 transition-colors cursor-pointer"
                                :class="hyphenation ? 'text-essay' : ''"
                                aria-label="Hyphenation"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M3 6h18" /><path d="M3 12h8" /><path d="M12 12h1.5" /><path d="M3 18h18" />
                                </svg>
                            </button>
                            <button
                                v-if="slides[currentIndex]?.kind === 'paragraph'"
                                @click.stop="handleSaveImage(); poke()"
                                :disabled="exporting"
                                class="p-2 text-mono-500 hover:text-mono-200 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-wait"
                                aria-label="Save slide as image"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                    <polyline points="7 10 12 15 17 10" />
                                    <line x1="12" x2="12" y1="15" y2="3" />
                                </svg>
                            </button>
                        </div>

                        <div class="flex items-center gap-3">
                            <button
                                @click.stop="dismiss"
                                class="p-2 text-mono-500 hover:text-mono-200 transition-colors cursor-pointer"
                                aria-label="Close"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Carousel track -->
                <div class="flex-1 overflow-hidden relative" @click.stop="handleBackdropClick">
                    <div class="absolute inset-0 flex" :style="trackStyle">
                        <div
                            v-for="slide in slides"
                            :key="slide.index"
                            class="shrink-0 w-full h-full"
                            @click.stop="handleBackdropClick"
                        >
                            <EssaySlide
                                v-if="slide.kind === 'paragraph'"
                                :text="slide.text"
                                :preferred-font-size="finalFontSize"
                                :justified="justified"
                                :hyphenation="hyphenation"
                                :active="slide.index === currentIndex"
                                :version="essay.version"
                                :latest-thread="latestThread"
                                :current="slide.index"
                                :total="bodyTotal"
                                @navigate-to-thread="(id) => emit('navigateToThread', id)"
                            />
                            <EssayHeaderSlide
                                v-else-if="slide.kind === 'header'"
                                :text="slide.text"
                            />
                            <EssayQuoteSlide
                                v-else-if="slide.kind === 'quote'"
                                :reference="slide.reference"
                                :preferred-font-size="finalFontSize"
                                :justified="justified"
                                :hyphenation="hyphenation"
                            />
                            <EssayBookCoverSlide
                                v-else-if="slide.kind === 'bookCover'"
                                :reference="slide.reference"
                            />
                            <EssayEndSlide
                                v-else-if="slide.kind === 'end' && essay"
                                :essay="essay"
                            />
                        </div>
                    </div>

                    <!-- Desktop arrow buttons -->
                    <button
                        v-if="currentIndex > 0"
                        @click.stop="goPrev"
                        class="hidden sm:flex absolute left-2 top-1/2 -translate-y-1/2 items-center justify-center w-10 h-10 rounded-full bg-mono-900/60 hover:bg-mono-800 text-mono-300 hover:text-mono-100 transition-all cursor-pointer z-10"
                        :class="chromeVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'"
                        aria-label="Previous"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="m15 18-6-6 6-6" />
                        </svg>
                    </button>
                    <button
                        v-if="currentIndex < total - 1"
                        @click.stop="goNext"
                        class="hidden sm:flex absolute right-2 top-1/2 -translate-y-1/2 items-center justify-center w-10 h-10 rounded-full bg-mono-900/60 hover:bg-mono-800 text-mono-300 hover:text-mono-100 transition-all cursor-pointer z-10"
                        :class="chromeVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'"
                        aria-label="Next"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="m9 18 6-6-6-6" />
                        </svg>
                    </button>
                </div>

                <!-- Font controls -->
                <div
                    v-show="showFontControls"
                    class="absolute left-0 right-0 bottom-0 z-30 pb-[calc(env(safe-area-inset-bottom,0px)+16px)] pt-3 bg-gradient-to-t from-mono-950 via-mono-950/90 to-transparent"
                    @click.stop
                    @touchstart.stop
                    @touchmove.stop
                    @touchend.stop
                >
                    <PresentationFontControls
                        :font-size="finalFontSize"
                        :min="FONT_SIZE_MIN"
                        :max="FONT_SIZE_MAX"
                        :step="FONT_SIZE_STEP"
                        color="essay"
                        @change="(size: number) => { setFontSize(size); poke(); }"
                        @reset="() => { reset(); poke(); }"
                    />
                </div>

                <!-- Offscreen export frame -->
                <div
                    v-if="exporting"
                    class="fixed pointer-events-none"
                    style="top: -99999px; left: -99999px;"
                    aria-hidden="true"
                >
                    <div ref="exportFrameRef">
                        <EssaySlideExportFrame
                            :text="exportText"
                            :counter="exportCounter"
                            :font-size="exportFontSize"
                        />
                    </div>
                </div>
            </div>
        </Transition>
    </Teleport>
</template>

<style scoped>
.presentation-enter-active,
.presentation-leave-active {
    transition: opacity 0.2s ease;
}
.presentation-enter-from,
.presentation-leave-to {
    opacity: 0;
}
</style>
