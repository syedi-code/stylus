<script setup lang="ts">
import { computed } from 'vue';
import { formatMarkdown } from '../../lib/formatText';

/**
 * Shared inner rendering for a quote in any presentation context.
 *
 * Used by:
 *   - PresentationViewQuote — the standalone quote modal
 *   - EssayQuoteSlide       — quote embeds in an essay deck
 *
 * The component owns the cardless blockquote + right-aligned em-dash
 * attribution that defines the quote's visual identity, plus font / justify /
 * hyphenation styling. Surrounding chrome (modal frame, controls) belongs to
 * the host.
 */

const props = defineProps<{
    text: string;
    creator?: string;
    work?: string;
    year?: string;
    page?: string;
    /** When set, the work title becomes a clickable link to the source PDF. */
    pdfUrl?: string;
    /** Final px font size (host owns the size composable). */
    fontSize: number;
    justified: boolean;
    hyphenation: boolean;
    /** Tailwind classes from `useTypography('quote', 'presentation', length)`. */
    typographyClass?: string;
    /** Book titles in scope — italic spans matching one get a gold underline. */
    bookTitles?: string[];
}>();

const lineHeight = computed(() => {
    const t = Math.min(1, Math.max(0, (props.fontSize - 12) / 12));
    return +(1.35 - t * 0.15).toFixed(2);
});

const html = computed(() => formatMarkdown(props.text, props.bookTitles));
</script>

<template>
    <div class="w-full sm:max-w-2xl flex flex-col overflow-y-auto px-6 sm:px-4 mx-auto">
        <!-- Quote body -->
        <div class="pl-2 pr-4 pt-4 pb-0 sm:pl-3 sm:pr-5 sm:pt-5 sm:pb-0 min-h-0 overflow-y-auto scrollbar-hide flex-1">
            <blockquote
                lang="en"
                :class="[typographyClass, 'text-mono-100 border-l-4 border-accent pl-4 py-2 whitespace-pre-wrap']"
                :style="{
                    fontSize: fontSize + 'px',
                    lineHeight: lineHeight,
                    textAlign: justified ? 'justify' : 'left',
                    hyphens: hyphenation ? 'auto' : 'none',
                }"
                v-html="html"
            ></blockquote>
        </div>

        <!-- Attribution (right-aligned, em-dash, italic underlined work) -->
        <div
            v-if="creator || work"
            class="mt-2 pr-6 sm:pr-10 pb-2 text-mono-400 text-sm flex flex-col gap-0.5 shrink-0 text-right"
        >
            <span v-if="creator" class="font-medium text-mono-300">— {{ creator }}</span>
            <span v-if="work">
                <a
                    v-if="pdfUrl"
                    :href="pdfUrl"
                    target="_blank"
                    @click.stop
                    class="underline decoration-mono-600 underline-offset-2 hover:text-accent hover:decoration-accent transition-colors italic"
                >{{ work }}</a>
                <span
                    v-else
                    class="underline decoration-mono-600 underline-offset-2 italic"
                >{{ work }}</span>
                <span v-if="year" class="ml-0.5"> ({{ year }})</span>
                <span v-if="page">, p. {{ page }}</span>
            </span>
        </div>
    </div>
</template>
