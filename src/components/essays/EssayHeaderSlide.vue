<script setup lang="ts">
defineProps<{
    text: string;
}>();
</script>

<template>
    <div class="w-full h-full flex items-center justify-center overflow-y-auto overscroll-contain">
        <div class="w-full max-w-xl px-8 py-12 flex flex-col items-center text-center gap-6">
            <!-- Match the styling used for Essay titles in the slide badge and
                 Book titles in EssayBookCoverSlide: italic, semibold, essay-amber. -->
            <h2 class="font-body italic font-semibold text-essay text-[30px] sm:text-[34px] leading-[1.15] tracking-[-0.005em] m-0"
                style="text-wrap: balance;">
                {{ text }}
            </h2>
        </div>
    </div>
</template>
