<script setup lang="ts">
import { computed } from 'vue';
import { formatMarkdown } from '../../lib/formatText';
import BookAttribution from '../books/BookAttribution.vue';

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
    /** When true, wrap the quote text in gold curly quotation marks. */
    withQuotationMarks?: boolean;
}>();

const lineHeight = computed(() => {
    const t = Math.min(1, Math.max(0, (props.fontSize - 12) / 12));
    return +(1.35 - t * 0.15).toFixed(2);
});

const html = computed(() => formatMarkdown(props.text));
</script>

<template>
    <div class="w-full sm:max-w-2xl flex flex-col overflow-y-auto px-6 sm:px-4 mx-auto -translate-y-[2vh]">
        <!-- Quote body -->
        <div class="pl-2 pr-4 pt-4 pb-0 sm:pl-3 sm:pr-5 sm:pt-5 sm:pb-0 min-h-0 overflow-y-auto scrollbar-hide flex-1">
            <blockquote lang="en" :class="[typographyClass, 'text-white py-2 whitespace-pre-wrap']" :style="{
                fontSize: fontSize + 'px',
                lineHeight: lineHeight,
                textAlign: justified ? 'justify' : 'left',
                hyphens: hyphenation ? 'auto' : 'none',
            }">
                <span v-if="withQuotationMarks" style="color: #e8d0a8" aria-hidden="true">&ldquo;</span><span v-html="html"></span><span v-if="withQuotationMarks" style="color: #e8d0a8" aria-hidden="true">&rdquo;</span>
            </blockquote>
        </div>

        <!-- Attribution (right-aligned, em-dash). Free-text and book-backed
             quotes share this rendering — BookAttribution handles either. -->
        <BookAttribution v-if="creator || work" class="pr-6 sm:pr-10 pb-2 shrink-0 max-w-[92%] ml-auto" variant="presentation" align="end" dash muted-title :author="creator" :title="work" :year="year" :page="page" :title-href="pdfUrl" />
    </div>
</template>
