<script setup lang="ts">
import { ref, watch } from 'vue';
import { MAX_LENGTHS } from '@antisocial/core';
import {
  fetchThreads,
  fetchThreadsForEntity,
  addThreadItemApi,
  removeThreadItemApi,
  createThreadApi,
  type Thread,
} from '../../lib/api';

const props = defineProps<{
  entityType: string;
  entityId: string;
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'updated'): void;
  (e: 'navigateToThread', threadId: string): void;
}>();

const allThreads = ref<Thread[]>([]);
const entityThreadIds = ref<Set<string>>(new Set());
const loading = ref(false);
const saving = ref(false);

// New thread inline creation
const showNewThread = ref(false);
const newThreadName = ref('');
const newThreadDesc = ref('');

watch(
  () => props.isOpen,
  async (isOpen) => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    if (isOpen) {
      await loadData();
    }
  }
);

async function loadData() {
  loading.value = true;
  try {
    const [threads, entityThreads] = await Promise.all([
      fetchThreads({ limit: 500 }),
      fetchThreadsForEntity(props.entityType, props.entityId),
    ]);
    allThreads.value = threads;
    entityThreadIds.value = new Set(entityThreads.map((t) => t.id));
  } catch (err) {
    console.error('Failed to load threads:', err);
  } finally {
    loading.value = false;
  }
}

async function toggleThread(thread: Thread) {
  saving.value = true;
  try {
    if (entityThreadIds.value.has(thread.id)) {
      // Need to find the item ID — fetch thread items to find it
      const { fetchThread } = await import('../../lib/api');
      const { items } = await fetchThread(thread.id);
      const item = items.find(
        (i) => i.entity_type === props.entityType && i.entity_id === props.entityId
      );
      if (item) {
        await removeThreadItemApi(thread.id, item.id);
      }
      entityThreadIds.value.delete(thread.id);
    } else {
      await addThreadItemApi(thread.id, props.entityType, props.entityId);
      entityThreadIds.value.add(thread.id);
      emit('navigateToThread', thread.id);
      emit('close');
      return;
    }
    emit('updated');
  } catch (err) {
    console.error('Failed to toggle thread:', err);
  } finally {
    saving.value = false;
  }
}

async function handleCreateThread() {
  if (!newThreadName.value.trim()) return;
  saving.value = true;
  try {
    const { thread } = await createThreadApi({
      name: newThreadName.value.trim(),
      description: newThreadDesc.value.trim() || undefined,
    });
    // Add entity to the new thread
    await addThreadItemApi(thread.id, props.entityType, props.entityId);
    allThreads.value.unshift({ ...thread, item_count: 1 });
    entityThreadIds.value.add(thread.id);
    newThreadName.value = '';
    newThreadDesc.value = '';
    showNewThread.value = false;
    emit('navigateToThread', thread.id);
    emit('close');
  } catch (err) {
    console.error('Failed to create thread:', err);
  } finally {
    saving.value = false;
  }
}

function close() {
  if (!saving.value) {
    emit('close');
  }
}
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
            <div class="relative bg-mono-900 rounded-2xl p-6 border border-mono-700">
              <!-- Header -->
              <div class="flex items-center justify-between mb-4">
                <h2 class="text-lg font-semibold text-white">Add to Thread</h2>
                <button @click="close" class="p-1.5 text-mono-400 hover:text-white transition-colors cursor-pointer">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                  </svg>
                </button>
              </div>

              <!-- Loading -->
              <div v-if="loading" class="py-8 text-center text-mono-500">
                <div class="inline-block animate-spin h-5 w-5 border-2 border-accent border-t-transparent rounded-full mb-2"></div>
                <p class="text-xs uppercase tracking-wide">Loading threads...</p>
              </div>

              <!-- Thread List -->
              <div v-else class="space-y-2 max-h-64 overflow-y-auto">
                <div v-if="allThreads.length === 0 && !showNewThread" class="py-6 text-center text-mono-500 text-sm">
                  No threads yet. Create one below.
                </div>

                <label
                  v-for="thread in allThreads"
                  :key="thread.id"
                  class="flex items-center gap-3 p-3 rounded-lg border border-mono-800 hover:border-mono-600 transition-colors cursor-pointer"
                  :class="entityThreadIds.has(thread.id) ? 'bg-accent/10 border-accent/30' : 'bg-mono-900'"
                >
                  <input
                    type="checkbox"
                    :checked="entityThreadIds.has(thread.id)"
                    :disabled="saving"
                    @change="toggleThread(thread)"
                    class="w-4 h-4 rounded border-mono-600 text-accent focus:ring-accent cursor-pointer accent-accent"
                  />
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-white truncate">{{ thread.name }}</p>
                    <p v-if="thread.description" class="text-xs text-mono-500 truncate">{{ thread.description }}</p>
                  </div>
                  <span class="text-xs text-mono-500">{{ thread.item_count ?? 0 }} items</span>
                </label>
              </div>

              <!-- New Thread Section -->
              <div class="mt-4 pt-4 border-t border-mono-800">
                <button
                  v-if="!showNewThread"
                  @click="showNewThread = true"
                  class="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-dashed border-mono-700 text-mono-400 hover:text-white hover:border-mono-500 transition-colors cursor-pointer text-sm"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 5v14" /><path d="M5 12h14" />
                  </svg>
                  New Thread
                </button>

                <div v-else class="space-y-3">
                  <input
                    v-model="newThreadName"
                    type="text"
                    placeholder="Thread name"
                    :maxlength="MAX_LENGTHS.TITLE"
                    class="w-full px-3 py-2 bg-mono-800 border border-mono-700 rounded-lg text-white placeholder-mono-600 focus:outline-none focus:border-accent text-sm"
                    @keydown.enter="handleCreateThread"
                  />
                  <input
                    v-model="newThreadDesc"
                    type="text"
                    placeholder="Description (optional)"
                    :maxlength="MAX_LENGTHS.CONTENT"
                    class="w-full px-3 py-2 bg-mono-800 border border-mono-700 rounded-lg text-white placeholder-mono-600 focus:outline-none focus:border-accent text-sm"
                    @keydown.enter="handleCreateThread"
                  />
                  <div class="flex gap-2">
                    <button
                      @click="showNewThread = false; newThreadName = ''; newThreadDesc = ''"
                      class="flex-1 px-3 py-2 text-sm text-mono-400 hover:text-white border border-mono-700 rounded-lg transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      @click="handleCreateThread"
                      :disabled="!newThreadName.trim() || saving"
                      class="flex-1 px-3 py-2 text-sm font-medium text-white bg-accent hover:bg-accent-bright rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                    >
                      Create & Add
                    </button>
                  </div>
                </div>
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
  transition: all 0.2s ease;
}
.modal-scale-enter-from {
  opacity: 0;
  transform: scale(0.95);
}
</style>
