<script setup lang="ts">
defineProps<{
    text: string;
}>();
</script>

<template>
    <div class="w-full h-full flex items-center justify-center overflow-y-auto overscroll-contain">
        <div class="w-full max-w-xl px-8 py-12 flex flex-col items-center text-center gap-6">
            <h2 class="text-mono-50 text-[30px] sm:text-[34px] font-semibold leading-[1.15] tracking-[-0.01em] m-0 typography-prose"
                style="text-wrap: balance;">
                {{ text }}
            </h2>
        </div>
    </div>
</template>
