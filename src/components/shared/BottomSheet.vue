<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue';

const props = defineProps<{
    isOpen: boolean;
    title?: string;
    /** Override the panel surface classes (bg / border / radius). Defaults to
     *  the standard mono-900 sheet. */
    panelClass?: string;
}>();

const emit = defineEmits(['close']);

const sheetRef = ref<HTMLElement | null>(null);
const isDragging = ref(false);
const dragStartY = ref(0);
const currentTranslateY = ref(0);

// Only handle touch on the drag handle area
const handleDragStart = (e: TouchEvent) => {
    isDragging.value = true;
    dragStartY.value = e.touches[0].clientY;
    currentTranslateY.value = 0;
};

const handleDragMove = (e: TouchEvent) => {
    if (!isDragging.value) return;

    const deltaY = e.touches[0].clientY - dragStartY.value;
    // Only allow dragging down
    if (deltaY > 0) {
        currentTranslateY.value = deltaY;
        if (sheetRef.value) {
            sheetRef.value.style.transform = `translateY(${deltaY}px)`;
            sheetRef.value.style.transition = 'none';
        }
    }
};

const handleDragEnd = () => {
    if (!isDragging.value) return;
    isDragging.value = false;

    // Reset transition
    if (sheetRef.value) {
        sheetRef.value.style.transition = '';
    }

    // If dragged more than 100px, close the sheet
    if (currentTranslateY.value > 100) {
        emit('close');
    } else {
        // Snap back
        if (sheetRef.value) {
            sheetRef.value.style.transform = '';
        }
    }
    currentTranslateY.value = 0;
};

// Prevent body scroll when sheet is open
watch(() => props.isOpen, (isOpen) => {
    if (isOpen) {
        document.body.style.overflow = 'hidden';
    } else {
        document.body.style.overflow = '';
    }
});

onUnmounted(() => {
    document.body.style.overflow = '';
});
</script>

<template>
    <Teleport to="body">
        <Transition name="sheet">
            <div v-if="isOpen" class="fixed inset-0 z-50">
                <!-- Backdrop -->
                <div class="absolute inset-0 bg-black/70 backdrop-blur-sm" @click="emit('close')"></div>

                <!-- Sheet -->
                <div ref="sheetRef" class="absolute inset-x-0 bottom-0 max-h-[90vh] flex flex-col" :class="panelClass || 'bg-mono-900 rounded-t-2xl shadow-2xl'">
                    <!-- Drag Handle - only this area handles swipe to dismiss -->
                    <div class="flex justify-center py-3 cursor-grab active:cursor-grabbing touch-none select-none" @touchstart.passive="handleDragStart" @touchmove.passive="handleDragMove" @touchend="handleDragEnd">
                        <div class="w-10 h-1 bg-mono-600 rounded-full"></div>
                    </div>

                    <!-- Header -->
                    <div v-if="title" class="px-5 pb-3 border-b border-mono-800">
                        <div class="flex items-center justify-between">
                            <h3 class="text-sm font-semibold text-white uppercase tracking-wide">{{ title }}</h3>
                            <button @click="emit('close')" class="p-2 -mr-2 text-mono-400 active:text-white transition-colors" aria-label="Close">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M18 6 6 18" />
                                    <path d="m6 6 12 12" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    <!-- Content - normal touch behavior for scrolling/input -->
                    <div class="flex-1 overflow-y-auto overscroll-contain">
                        <slot></slot>
                    </div>
                </div>
            </div>
        </Transition>
    </Teleport>
</template>

<style scoped>
.sheet-enter-active,
.sheet-leave-active {
    transition: opacity 0.2s ease;
}

.sheet-enter-active>div:last-child,
.sheet-leave-active>div:last-child {
    transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1);
}

.sheet-enter-from,
.sheet-leave-to {
    opacity: 0;
}

.sheet-enter-from>div:last-child,
.sheet-leave-to>div:last-child {
    transform: translateY(100%);
}
</style>
