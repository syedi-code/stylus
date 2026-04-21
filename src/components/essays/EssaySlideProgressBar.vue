<script setup lang="ts">
defineProps<{
    total: number;
    current: number;
}>();
</script>

<template>
    <div class="flex items-center gap-1 w-full">
        <div
            v-for="i in total"
            :key="i"
            class="flex-1 h-[2px] rounded-full overflow-hidden bg-mono-700/70"
        >
            <div
                class="h-full transition-all duration-300 ease-out"
                :class="i - 1 < current ? 'bg-essay' : i - 1 === current ? 'bg-essay' : 'bg-transparent'"
                :style="{ width: i - 1 <= current ? '100%' : '0%' }"
            ></div>
        </div>
    </div>
</template>
