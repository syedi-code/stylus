<script setup lang="ts">
import { computed } from 'vue';
import { getFileUrl, type EssayReference } from '../../lib/api';

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
const author = computed(() => props.reference.book_author || '');
const year = computed(() => props.reference.book_originally_published || '');
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
                class="max-h-[40%] max-w-[55%] sm:max-h-[58%] sm:max-w-[78%] object-contain rounded-[2px]"
                style="
                    box-shadow: 0 30px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.05);
                    transform: translateZ(0);
                    -webkit-backface-visibility: hidden;
                    backface-visibility: hidden;
                    image-rendering: auto;
                "
            />
            <div class="flex flex-col items-center text-center max-w-[80%] sm:max-w-md gap-2">
                <h1
                    class="font-body italic font-semibold text-[22px] sm:text-[26px] text-essay leading-[1.15] tracking-[-0.005em] m-0"
                    style="text-wrap: balance;"
                >{{ title }}</h1>
                <div class="font-body text-[14px] text-mono-200 leading-[1.4]">
                    <span>{{ author }}</span>
                    <span v-if="year" class="text-mono-400"> &middot; {{ year }}</span>
                </div>
            </div>
        </template>

        <!-- Typographic "imagined cover" — no image uploaded -->
        <div
            v-else
            class="relative flex flex-col items-center justify-center text-center px-4 py-4 max-w-[80%] sm:max-w-md"
        >
            <span class="font-mono text-[10.5px] text-gold/70 tracking-[0.32em] uppercase mb-10">A book</span>
            <h1
                class="font-body italic font-semibold text-[36px] sm:text-[44px] text-gold leading-[1.05] tracking-[-0.01em] m-0"
                style="text-wrap: balance;"
            >{{ title }}</h1>
            <div class="my-8 w-12 h-px bg-gold/60"></div>
            <div class="text-[11px] uppercase tracking-[0.36em] text-mono-300">
                <span>{{ author }}</span>
                <span v-if="year" class="text-mono-500"> &middot; {{ year }}</span>
            </div>
        </div>
    </div>
</template>
