<script setup lang="ts">
import { ref, nextTick, watch, computed, onUnmounted } from 'vue';
import { MAX_LENGTHS } from '../../lib/contract';
import { createNote, type Book } from '../../lib/api';
import BookLinePicker from '../library/BookLinePicker.vue';

const props = defineProps<{
    isOpen: boolean;
}>();

const emit = defineEmits(['close', 'saved']);

const draft = ref('');
const textareaRef = ref<HTMLTextAreaElement | null>(null);
const loading = ref(false);
const sent = ref(false);

// Book attribution — a note always lives in a book
const selectedBook = ref<Book | null>(null);
const pageRef = ref('');

// Character count
const charCount = computed(() => draft.value.length);

// Focus textarea when opened
watch(() => props.isOpen, async (isOpen) => {
    if (isOpen) {
        document.body.style.overflow = 'hidden';
        await nextTick();
        textareaRef.value?.focus();
    } else {
        document.body.style.overflow = '';
    }
});

onUnmounted(() => {
    document.body.style.overflow = '';
});

const submit = async () => {
    if (!draft.value.trim() || loading.value) return;

    loading.value = true;
    sent.value = false;

    try {
        const input: any = {
            content: draft.value.trim(),
            source: 'web',
        };

        if (selectedBook.value) {
            input.book_id = selectedBook.value.id;
            if (pageRef.value) input.page = pageRef.value;
        }

        await createNote(input);

        sent.value = true;
        draft.value = '';
        // Keep the book — the next note is usually from the same one. Page moves on.
        pageRef.value = '';

        // Brief success feedback then close
        setTimeout(() => {
            sent.value = false;
            emit('saved');
            emit('close');
        }, 600);

    } catch (e) {
        console.error(e);
        alert('Failed to save note.');
    } finally {
        loading.value = false;
    }
};

const handleClose = () => {
    draft.value = '';
    pageRef.value = '';
    emit('close');
};
</script>

<template>
    <Teleport to="body">
        <Transition name="modal">
            <div v-if="isOpen" class="fixed inset-0 z-50 bg-mono-950 flex flex-col">
                <!-- Header -->
                <div class="flex items-center justify-between px-4 py-3 border-b border-mono-800 shrink-0">
                    <button @click="handleClose" class="p-2 -ml-2 text-mono-400 active:text-white transition-colors cursor-pointer" :disabled="loading" aria-label="Close">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M18 6 6 18" />
                            <path d="m6 6 12 12" />
                        </svg>
                    </button>

                    <span class="text-sm font-semibold text-white uppercase tracking-wide">New Note</span>

                    <button @click="submit" :disabled="loading || !draft.trim()" class="px-4 py-2 text-sm font-bold transition-all disabled:opacity-50 rounded-lg active:scale-95 cursor-pointer" :class="sent ? 'text-emerald-400 bg-emerald-500/20' : 'text-accent bg-accent/20 active:bg-accent/30'">
                        {{ loading ? '...' : sent ? '✓ Saved' : 'Capture' }}
                    </button>
                </div>

                <!-- Book line — attribution lives above the words -->
                <div class="px-4 py-2.5 border-b border-mono-800 shrink-0">
                    <BookLinePicker v-model:book="selectedBook" v-model:page="pageRef" showPage />
                </div>

                <!-- Content -->
                <div class="flex-1 p-4 overflow-y-auto">
                    <div class="relative h-full">
                        <textarea ref="textareaRef" v-model="draft" :maxlength="MAX_LENGTHS.CONTENT" class="w-full h-full min-h-50 bg-transparent text-mono-100 focus:outline-none resize-none text-base leading-[var(--content-leading)] placeholder:text-mono-600" placeholder="What's on your mind..." :disabled="loading"></textarea>
                    </div>
                </div>

                <!-- Footer -->
                <div class="px-4 py-3 border-t border-mono-800 shrink-0 pb-safe">
                    <div class="flex items-center justify-end">
                        <span class="text-xs text-mono-600">{{ charCount }} / {{ MAX_LENGTHS.CONTENT }}</span>
                    </div>
                </div>
            </div>
        </Transition>
    </Teleport>
</template>

<style scoped>
.pb-safe {
    padding-bottom: max(0.75rem, env(safe-area-inset-bottom));
}

.modal-enter-active,
.modal-leave-active {
    transition: opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
    opacity: 0;
}
</style>
