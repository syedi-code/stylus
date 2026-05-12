<script setup lang="ts">
import { computed } from 'vue';
import { getFileUrl, type EssayReference } from '../../lib/api';
import BookAttribution from '../books/BookAttribution.vue';

const props = defineProps<{
    reference: EssayReference;
}>();

// `entity_id` for a book_cover ref IS the book id; the join populates
// book_cover_url + title/author for fallback alt text.
//
// Stored URLs look like `/files/books/{id}/cover-foo.jpg` (worker route).
// In dev we hit a separate worker origin; resolve through the api helper so
// the request lands on the worker, not the Vite dev server.
const coverUrl = computed(() => {
    const url = props.reference.book_cover_url;
    if (!url) return null;
    if (/^https?:\/\//i.test(url)) return url;
    const path = url.replace(/^\/files\//, '');
    return getFileUrl(path);
});
const title = computed(() => props.reference.book_title || '');
// Author is hidden by default on essay book-cover slides — the title is the
// focal point. Opt in per embed with `[[book:UUID author=show]]`.
const showAuthor = computed(() => props.reference.params?.author === 'show');
const author = computed(() =>
    showAuthor.value ? props.reference.book_author || '' : ''
);
const year = computed(() => props.reference.book_originally_published || '');
// Per-embed title size override (`[[book:UUID size=32]]`). Falls back to the
// bucketed prominent sizing when absent.
const titleSizePx = computed(() => {
    const v = props.reference.params?.size;
    return typeof v === 'number' ? v : null;
});
</script>

<template>
    <div class="w-full h-full flex flex-col items-center justify-center bg-mono-950 overflow-hidden px-8 py-10 gap-8">
        <!-- Image case: cover above + title/author·year metadata below.
             The carousel parent animates with translateX, which causes iOS
             Safari to rasterise child images at the layer's pre-transform
             resolution (visibly blurry on retina). Promoting the image to its
             own GPU layer (translateZ(0) + backface-visibility: hidden) keeps
             it crisp. -->
        <template v-if="coverUrl">
            <img
                :src="coverUrl"
                :alt="`${title} — ${author}`"
                loading="eager"
                decoding="async"
                class="max-h-[58%] max-w-[78%] object-contain rounded-[2px]"
                style="
                    box-shadow: 0 30px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.05);
                    transform: translateZ(0);
                    -webkit-backface-visibility: hidden;
                    backface-visibility: hidden;
                    image-rendering: auto;
                "
            />
            <BookAttribution
                class="max-w-[80%] sm:max-w-md"
                variant="presentation"
                align="center"
                prominent
                :author="author"
                :title="title"
                :year="year"
                :title-size-px="titleSizePx"
            />
        </template>

        <!-- Typographic "imagined cover" — no image uploaded. Same metadata
             stack as the with-cover case so the missing-image surface still
             reads like a book reference. -->
        <BookAttribution
            v-else
            class="max-w-[80%] sm:max-w-md"
            variant="presentation"
            align="center"
            :author="author"
            :title="title"
            :year="year"
        />
    </div>
</template>
