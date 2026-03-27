<script setup lang="ts">
import type { Thread } from '../../lib/api';
import ThreadCard from './ThreadCard.vue';
import ThreadDetail from './ThreadDetail.vue';

const props = defineProps<{
  threads: Thread[];
  loading: boolean;
  error: string | null;
  search: string;
  expandedThreads: Set<string>;
  isAdmin?: boolean;
  threadDetailRefs: Map<string, InstanceType<typeof ThreadDetail>>;
}>();

const emit = defineEmits<{
  (e: 'update:search', value: string): void;
  (e: 'toggleThread', id: string): void;
  (e: 'deleteThread', thread: Thread): void;
  (e: 'renamedThread', id: string, name: string): void;
  (e: 'newThread'): void;
  (e: 'retry'): void;
  (e: 'presentItem', entityType: string, entity: any): void;
  (e: 'editItem', threadId: string, entityType: string, entity: any): void;
}>();
</script>

<template>
  <div class="space-y-5">
    <!-- Top bar -->
    <div class="flex items-baseline justify-between px-1">
      <h2
        class="font-display text-white tracking-tight"
        style="font-weight: 600; font-size: 26px; letter-spacing: -0.025em;"
      >Threads</h2>
      <button
        class="font-display text-xs font-semibold text-purple-300 border border-purple-500/30 bg-transparent px-3 py-1.5 rounded-lg hover:bg-purple-500/10 transition-colors cursor-pointer"
        @click="emit('newThread')"
      >+ new</button>
    </div>

    <!-- Search -->
    <div>
      <input
        :value="search"
        @input="emit('update:search', ($event.target as HTMLInputElement).value)"
        type="text"
        placeholder="Search threads..."
        class="w-full font-display text-sm text-mono-100 bg-mono-900 border border-mono-800 rounded-xl px-4 py-2.5 sm:py-2.5 outline-none placeholder-mono-600 focus:border-purple-500 transition-colors"
      />
    </div>

    <!-- Loading -->
    <div v-if="loading" class="py-20 text-center text-mono-600">
      <div class="inline-block animate-spin h-6 w-6 border-2 border-purple-500 border-t-transparent rounded-full mb-4"></div>
      <p class="text-xs tracking-widest uppercase">Loading threads...</p>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="p-6 border border-red-900 bg-red-950/20 text-center rounded-xl">
      <p class="text-red-500 font-bold uppercase text-sm mb-4">{{ error }}</p>
      <button
        @click="emit('retry')"
        class="px-4 py-2 bg-red-900 hover:bg-red-800 text-white text-xs font-bold uppercase tracking-wide transition-colors cursor-pointer"
      >Retry</button>
    </div>

    <!-- Empty -->
    <div v-else-if="threads.length === 0" class="py-20 text-center text-mono-600 border border-dashed border-mono-800 rounded-xl">
      <p class="text-sm uppercase tracking-wide">No threads yet.</p>
      <p class="text-xs text-mono-700 mt-1">Create a thread to organize notes, quotes, thoughts, and books.</p>
    </div>

    <!-- Card stack -->
    <div v-else class="flex flex-col gap-2">
      <ThreadCard
        v-for="(thread, index) in threads"
        :key="thread.id"
        :thread="thread"
        :ordinal="index + 1"
        :expanded="expandedThreads.has(thread.id)"
        :isAdmin="isAdmin"
        @toggle="emit('toggleThread', thread.id)"
        @delete="emit('deleteThread', thread)"
        @renamed="(id: string, name: string) => emit('renamedThread', id, name)"
      >
        <template #chamber>
            <ThreadDetail
              :ref="(el: any) => { if (el) threadDetailRefs.set(thread.id, el); else threadDetailRefs.delete(thread.id); }"
              :threadId="thread.id"
              :showHeader="false"
              :isAdmin="isAdmin"
              @presentItem="(type: string, entity: any) => emit('presentItem', type, entity)"
              @editItem="(type: string, entity: any) => emit('editItem', thread.id, type, entity)"
            />
        </template>
      </ThreadCard>
    </div>
  </div>
</template>
