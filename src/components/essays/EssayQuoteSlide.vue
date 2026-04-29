<script setup lang="ts">
import { computed } from 'vue';
import type { EssayReference } from '../../lib/api';
import { useTypography } from '../../composables/useTypography';
import QuoteSlideBody from '../quotes/QuoteSlideBody.vue';

const props = defineProps<{
    reference: EssayReference;
    preferredFontSize: number;
    justified: boolean;
    hyphenation: boolean;
    bookTitles?: string[];
}>();

// Pull the shared `useTypography('quote', 'presentation', length)` styling
// so embedded quote slides match the standalone PresentationViewQuote.
const contentLength = computed(() => props.reference.quote_text?.length ?? 0);
const { typographyClass } = useTypography('quote', 'presentation', contentLength);

const text = computed(() => props.reference.quote_text || '');
const creator = computed(
    () => props.reference.book_author || props.reference.quote_creator
);
const work = computed(
    () => props.reference.book_title || props.reference.quote_work
);
const year = computed(() => props.reference.book_originally_published);
const page = computed(
    () => props.reference.page || props.reference.quote_page
);
</script>

<template>
    <div class="w-full h-full flex items-center justify-center overflow-y-auto overscroll-contain py-6">
        <QuoteSlideBody
            :text="text"
            :creator="creator || undefined"
            :work="work || undefined"
            :year="year || undefined"
            :page="page || undefined"
            :font-size="preferredFontSize"
            :justified="justified"
            :hyphenation="hyphenation"
            :typography-class="typographyClass"
            :book-titles="bookTitles"
        />
    </div>
</template>
