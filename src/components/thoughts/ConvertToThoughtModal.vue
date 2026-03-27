<script setup lang="ts">
import { computed, watch } from 'vue';
import type { Note } from '../lib/api';

const props = defineProps<{
  note: Note | null;
  isOpen: boolean;
  loading?: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'confirm'): void;
}>();

// Lock body scroll when open
watch(() => props.isOpen, (isOpen) => {
  document.body.style.overflow = isOpen ? 'hidden' : '';
});

const truncatedContent = computed(() => {
  const content = props.note?.content || '';
  if (content.length > 150) {
    return content.slice(0, 150) + '...';
  }
  return content;
});

const formattedDate = computed(() => {
  if (!props.note?.created_at) return '';
  const date = new Date(props.note.created_at);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
});

const close = () => {
  if (!props.loading) {
    emit('close');
  }
};

const confirm = () => {
  emit('confirm');
};
</script>

<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/80 backdrop-blur-sm" @click="close"></div>

        <!-- Modal -->
        <Transition name="modal-scale" appear>
          <div v-if="isOpen" class="relative w-full max-w-md overflow-hidden">
            <!-- Gradient border effect -->
            <div class="absolute inset-0 bg-gradient-to-r from-accent via-purple-500 to-rose rounded-2xl opacity-60 blur-sm"></div>
            
            <div class="relative bg-mono-900 rounded-2xl p-6 border border-mono-700">
              <!-- Header with transformation icon -->
              <div class="flex items-center justify-center gap-4 mb-6">
                <!-- Note icon (blue) -->
                <div class="flex items-center justify-center w-12 h-12 rounded-xl bg-accent/20 border border-accent/30">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-accent">
                    <path d="M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8Z" />
                    <path d="M15 3v4a2 2 0 0 0 2 2h4" />
                  </svg>
                </div>

                <!-- Arrow animation -->
                <div class="flex items-center gap-1">
                  <div class="w-2 h-2 rounded-full bg-accent animate-pulse" style="animation-delay: 0ms;"></div>
                  <div class="w-2 h-2 rounded-full bg-purple-500 animate-pulse" style="animation-delay: 150ms;"></div>
                  <div class="w-2 h-2 rounded-full bg-rose animate-pulse" style="animation-delay: 300ms;"></div>
                </div>

                <!-- Thought icon (rose) -->
                <div class="flex items-center justify-center w-12 h-12 rounded-xl bg-rose/20 border border-rose/30">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-rose">
                    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
                  </svg>
                </div>
              </div>

              <!-- Title -->
              <h3 class="text-lg font-semibold text-white text-center mb-2">Convert to Thought</h3>
              <p class="text-sm text-mono-400 text-center mb-6">
                This will transform your note into a thought and <span class="text-red-400">delete the original note</span>.
              </p>

              <!-- Preview card -->
              <div class="relative mb-6">
                <!-- From: Note preview -->
                <div class="p-4 bg-mono-950 rounded-xl border border-accent/20 mb-3">
                  <div class="flex items-center gap-2 mb-2">
                    <span class="text-[10px] font-bold uppercase tracking-wider text-accent bg-accent/20 px-1.5 py-0.5 rounded">Note</span>
                    <span class="text-[10px] text-mono-500">{{ formattedDate }}</span>
                  </div>
                  <p class="text-sm text-mono-300 leading-relaxed">{{ truncatedContent }}</p>
                </div>

                <!-- To: Thought preview -->
                <div class="p-4 bg-mono-950 rounded-xl border border-rose/20">
                  <div class="flex items-center gap-2 mb-2">
                    <span class="text-[10px] font-bold uppercase tracking-wider text-rose bg-rose/20 px-1.5 py-0.5 rounded">Thought</span>
                    <span class="text-[10px] text-mono-500">{{ formattedDate }}</span>
                  </div>
                  <p class="text-sm text-mono-300 leading-relaxed">{{ truncatedContent }}</p>
                </div>

                <!-- Connecting line -->
                <div class="absolute left-1/2 top-[calc(50%-8px)] -translate-x-1/2 w-px h-4 bg-gradient-to-b from-accent to-rose"></div>
              </div>

              <!-- Actions -->
              <div class="flex gap-3">
                <button 
                  @click="close" 
                  :disabled="loading"
                  class="flex-1 px-4 py-2.5 text-sm font-medium text-mono-400 hover:text-white bg-mono-800 hover:bg-mono-700 rounded-xl transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button 
                  @click="confirm" 
                  :disabled="loading"
                  class="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-rose hover:bg-rose-bright rounded-xl transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <template v-if="loading">
                    <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Converting...
                  </template>
                  <template v-else>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M5 12h14" />
                      <path d="m12 5 7 7-7 7" />
                    </svg>
                    Convert
                  </template>
                </button>
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.2s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-scale-enter-active {
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.modal-scale-leave-active {
  transition: all 0.2s ease;
}

.modal-scale-enter-from {
  opacity: 0;
  transform: scale(0.9);
}

.modal-scale-leave-to {
  opacity: 0;
  transform: scale(0.95);
}
</style>
