<script setup lang="ts">
import { computed } from 'vue';
import { getFileUrl, type EssayReference } from '../../lib/api';

const props = defineProps<{
    reference: EssayReference;
}>();

// `image_url` is the R2 path stored in essay_images.path (e.g.
// 'essays/images/uuid-name.jpg'). Resolve through getFileUrl so the request
// lands on the worker in dev, not on the Vite dev server.
const imageUrl = computed(() => {
    const url = props.reference.image_url;
    if (!url) return null;
    if (/^https?:\/\//i.test(url)) return url;
    const path = url.replace(/^\/files\//, '');
    return getFileUrl(path);
});

// Per-embed caption override (`[[image:UUID caption="..."]]`). Empty string is
// the explicit "hide caption" signal — distinct from undefined which means
// "fall back to the image record's caption."
const caption = computed(() => {
    const override = props.reference.params?.caption;
    if (typeof override === 'string') return override;
    return props.reference.image_caption || '';
});
const sourceUrl = computed(() => props.reference.image_source_url || '');

// Per-embed background. `dark` = current behavior, `light` = inverted slide,
// `none` = transparent (lets the carousel's own bg show through).
const bg = computed(() => {
    const v = props.reference.params?.bg;
    return v === 'light' || v === 'none' ? v : 'dark';
});

const slideBgClass = computed(() => {
    if (bg.value === 'light') return 'bg-mono-50';
    if (bg.value === 'none') return 'bg-transparent';
    return 'bg-mono-950';
});

const captionTextClass = computed(() =>
    bg.value === 'light' ? 'text-mono-800' : 'text-mono-200'
);
const sourceTextClass = computed(() =>
    bg.value === 'light'
        ? 'text-mono-600 hover:text-mono-900 decoration-mono-400'
        : 'text-mono-500 hover:text-mono-300 decoration-mono-700'
);
</script>

<template>
    <div
        class="w-full h-full flex flex-col items-center justify-center overflow-hidden px-6 py-10 gap-6"
        :class="slideBgClass"
    >
        <img
            v-if="imageUrl"
            :src="imageUrl"
            :alt="caption || 'Essay image'"
            loading="eager"
            decoding="async"
            class="max-h-[75%] max-w-[92%] object-contain rounded-[2px]"
            style="
                box-shadow: 0 30px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.05);
                transform: translateZ(0);
                -webkit-backface-visibility: hidden;
                backface-visibility: hidden;
                image-rendering: auto;
            "
        />
        <div
            v-else
            class="flex items-center justify-center w-[60%] aspect-[4/3] bg-mono-900 border border-mono-800 rounded-sm text-mono-600 text-sm italic"
        >
            image missing
        </div>

        <div
            v-if="caption || sourceUrl"
            class="max-w-[80%] sm:max-w-md text-center flex flex-col gap-1"
        >
            <p
                v-if="caption"
                class="font-body italic text-[14px] sm:text-[15px] leading-[1.35]"
                :class="captionTextClass"
            >
                {{ caption }}
            </p>
            <a
                v-if="sourceUrl"
                :href="sourceUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="font-body text-[11px] sm:text-[12px] transition-colors underline underline-offset-2"
                :class="sourceTextClass"
                @click.stop
            >source</a>
        </div>
    </div>
</template>
