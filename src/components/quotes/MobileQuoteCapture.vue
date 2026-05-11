<script setup lang="ts">
import { ref, nextTick, watch, computed, onUnmounted } from 'vue';
import { MAX_LENGTHS } from '@antisocial/core';
import { createQuote, createConnectionApi } from '../../lib/api';
import SourceSelector from '../library/SourceSelector.vue';
import type { SourceAttribution } from '../library/SourceSelector.vue';

const props = defineProps<{
    isOpen: boolean;
}>();

const emit = defineEmits(['close', 'saved']);

const draft = ref('');
const textareaRef = ref<HTMLTextAreaElement | null>(null);
const loading = ref(false);
const sent = ref(false);
const sourceSelectorRef = ref<InstanceType<typeof SourceSelector> | null>(null);
const currentAttribution = ref<SourceAttribution>({ mode: 'none' });

// Character count
const charCount = computed(() => draft.value.length);

// Derive creator / work from attribution
const effectiveCreator = computed(() => {
  const attr = currentAttribution.value;
  if (attr.mode === 'book' && attr.book) return attr.book.author;
  if (attr.mode === 'other') return attr.creator;
  return undefined;
});

const effectiveWork = computed(() => {
  const attr = currentAttribution.value;
  if (attr.mode === 'book' && attr.book) return attr.book.title;
  if (attr.mode === 'other') return attr.work;
  return undefined;
});

const effectiveKind = computed(() => {
  const attr = currentAttribution.value;
  if (attr.mode === 'book') return 'book';
  if (attr.mode === 'other') return attr.kind;
  return undefined;
});

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
        const attr = currentAttribution.value;

        const input: any = {
            quote: draft.value.trim(),
            creator: effectiveCreator.value || undefined,
            work: effectiveWork.value || undefined,
            kind: effectiveKind.value || undefined,
            source: 'web',
        };

        // Dual-write: set book_id for legacy compatibility
        if (attr.mode === 'book' && attr.bookId) {
            input.book_id = attr.bookId;
            if (attr.page) input.page = attr.page;
        }

        const result = await createQuote(input);

        // Create connections for non-book attributions
        if (sourceSelectorRef.value && result.quote?.id && attr.mode === 'author') {
            const connections = sourceSelectorRef.value.buildConnections(result.quote.id);
            for (const conn of connections) {
                await createConnectionApi(conn);
            }
        }

        sent.value = true;
        draft.value = '';
        sourceSelectorRef.value?.reset();
        currentAttribution.value = { mode: 'none' };

        // Brief success feedback then close
        setTimeout(() => {
            sent.value = false;
            emit('saved');
            emit('close');
        }, 600);

    } catch (e) {
        console.error(e);
        alert('Failed to save quote.');
    } finally {
        loading.value = false;
    }
};

const handleClose = () => {
    draft.value = '';
    sourceSelectorRef.value?.reset();
    currentAttribution.value = { mode: 'none' };
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

                    <span class="text-sm font-semibold text-white uppercase tracking-wide">New Quote</span>

                    <button @click="submit" :disabled="loading || !draft.trim()" class="px-4 py-2 text-sm font-bold transition-all disabled:opacity-50 rounded-lg active:scale-95 cursor-pointer" :class="sent ? 'text-emerald-400 bg-emerald-500/20' : 'text-quote bg-quote/20 active:bg-quote/30'">
                        {{ loading ? '...' : sent ? '✓ Saved' : 'Capture' }}
                    </button>
                </div>

                <!-- Source Selector -->
                <div class="px-4 py-3 border-b border-mono-800 shrink-0">
                    <SourceSelector
                        ref="sourceSelectorRef"
                        entityType="quote"
                        :compact="true"
                        @update="currentAttribution = $event"
                    />
                </div>

                <!-- Content -->
                <div class="flex-1 p-4 overflow-y-auto">
                    <div class="relative h-full">
                        <textarea ref="textareaRef" v-model="draft" :maxlength="MAX_LENGTHS.CONTENT" class="w-full h-full min-h-50 bg-transparent text-mono-100 italic focus:outline-none resize-none text-base leading-relaxed placeholder:text-mono-600" placeholder="Enter quote..." :disabled="loading"></textarea>
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
