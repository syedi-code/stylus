<script setup lang="ts">
defineProps<{
    isOpen: boolean;
    title?: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'danger' | 'warning';
}>();

const emit = defineEmits<{
    (e: 'confirm'): void;
    (e: 'cancel'): void;
}>();
</script>

<template>
    <Teleport to="body">
        <Transition name="fade">
            <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div class="absolute inset-0 bg-black/80 backdrop-blur-sm" @click="emit('cancel')"></div>
                <div class="relative w-full max-w-sm bg-mono-900 border border-mono-700 shadow-2xl rounded-xl p-5 flex flex-col gap-4">
                    <h3 v-if="title" class="text-base font-semibold tracking-tight text-white">{{ title }}</h3>
                    <p class="text-sm text-mono-300 leading-relaxed">{{ message }}</p>
                    <div class="flex items-center gap-3 pt-1">
                        <button @click="emit('confirm')" class="flex-1 py-2.5 text-sm font-semibold tracking-tight text-white rounded-lg transition-colors cursor-pointer" :class="variant === 'warning'
                            ? 'bg-amber-600 hover:bg-amber-500'
                            : 'bg-red-600 hover:bg-red-500'">
                            {{ confirmLabel || 'Delete' }}
                        </button>
                        <button @click="emit('cancel')" class="px-4 py-2.5 text-sm font-semibold tracking-tight text-mono-400 hover:text-mono-200 transition-colors cursor-pointer">
                            {{ cancelLabel || 'Cancel' }}
                        </button>
                    </div>
                </div>
            </div>
        </Transition>
    </Teleport>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}
</style>
