<script setup lang="ts">
import { ref, computed, nextTick } from 'vue';
import { MAX_LENGTHS } from '../../lib/contract';
import { updateThreadApi, type Thread } from '../../lib/api';

const props = defineProps<{
  thread: Thread;
  ordinal: number;
  expanded: boolean;
  isAdmin?: boolean;
}>();

const emit = defineEmits<{
  (e: 'toggle'): void;
  (e: 'delete'): void;
  (e: 'renamed', id: string, name: string): void;
}>();

const ordinalLabel = computed(() =>
  String(props.ordinal).padStart(2, '0')
);

const MAX_BARS = 5;

const typeBars = computed(() => {
  const types = props.thread.item_types ?? [];
  return types.slice(0, MAX_BARS);
});

const hasOverflow = computed(() =>
  (props.thread.item_types?.length ?? 0) > MAX_BARS
);

const itemCountLabel = computed(() => {
  const count = props.thread.item_count ?? 0;
  return count === 1 ? '1 item' : `${count} items`;
});

function barColor(type: string): string {
  switch (type) {
    case 'note': return 'bg-accent';
    case 'quote': return 'bg-purple-500';
    case 'thought': return 'bg-rose';
    default: return 'bg-mono-500';
  }
}

// Inline rename
const editingName = ref(false);
const editName = ref('');
const nameInputRef = ref<HTMLInputElement | null>(null);

function startEditName() {
  editName.value = props.thread.name;
  editingName.value = true;
  nextTick(() => nameInputRef.value?.focus());
}

async function saveName() {
  const trimmed = editName.value.trim();
  editingName.value = false;
  if (!trimmed || trimmed === props.thread.name) return;
  try {
    await updateThreadApi(props.thread.id, { name: trimmed });
    emit('renamed', props.thread.id, trimmed);
  } catch (err) {
    console.error('Failed to rename thread:', err);
  }
}

function cancelEdit() {
  editingName.value = false;
}

function handleHeaderClick() {
  if (!editingName.value) emit('toggle');
}
</script>

<template>
  <div
    class="thread-card group relative border rounded-2xl overflow-hidden transition-all duration-250"
    :class="expanded
      ? 'border-purple-500/25 bg-gradient-to-b from-purple-500/[0.03] to-transparent'
      : 'border-mono-800 hover:border-purple-500/20 hover:bg-white/[0.008]'"
  >
    <div class="p-[18px_20px] cursor-pointer" :class="expanded && 'pb-0'" @click="handleHeaderClick">
      <!-- Ordinal watermark -->
      <span
        class="card-ordinal absolute select-none font-display transition-all duration-300 pointer-events-none"
        :class="expanded
          ? 'text-[72px] sm:text-[72px] top-2 right-3 text-purple-500/5'
          : 'text-[36px] sm:text-[44px] top-3 right-4 text-mono-900 group-hover:text-purple-500/[0.04]'"
        style="font-weight: 900; line-height: 0.85; letter-spacing: -0.04em;"
      >{{ ordinalLabel }}</span>

      <!-- Header row -->
      <div class="flex items-center gap-3">
        <!-- Type strip -->
        <div class="flex gap-0.5 shrink-0">
          <div
            v-for="(type, i) in typeBars"
            :key="i"
            class="w-[3px] h-4 rounded-sm"
            :class="barColor(type)"
          />
          <div
            v-if="hasOverflow"
            class="w-[3px] h-4 rounded-sm bg-mono-600/40"
          />
        </div>

        <!-- Info -->
        <div class="flex-1 min-w-0">
          <input
            v-if="editingName"
            ref="nameInputRef"
            v-model="editName"
            :maxlength="MAX_LENGTHS.TITLE"
            class="w-full font-display leading-snug tracking-tight text-white bg-transparent border-b border-purple-500/40 outline-none text-[20px] sm:text-[22px] py-0.5"
            style="font-weight: 500; letter-spacing: -0.015em;"
            placeholder="Thread name..."
            @click.stop
            @keydown.enter="saveName"
            @keydown.escape="cancelEdit"
            @blur="saveName"
          />
          <div
            v-else
            class="font-display leading-snug tracking-tight transition-all duration-250"
            :class="expanded
              ? 'text-white text-[20px] sm:text-[22px]'
              : 'text-mono-200 group-hover:text-white text-[17px]'"
            style="font-weight: 500; letter-spacing: -0.015em;"
          >{{ thread.name }}</div>
          <div
            class="text-xs text-mono-500 tabular-nums"
            :class="expanded ? 'mt-1' : 'mt-0.5'"
          >{{ itemCountLabel }}</div>
        </div>
      </div>

      <!-- Actions row (expanded only) -->
      <div v-if="expanded" class="flex gap-0.5 mt-3">
        <button
          class="card-action flex items-center justify-center w-[30px] h-[30px] rounded-md bg-transparent border-none cursor-pointer text-mono-600 hover:text-purple-300 hover:bg-purple-400/8 transition-colors"
          title="Rename"
          @click.stop="startEditName"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
        </button>
        <button
          v-if="isAdmin"
          class="card-action flex items-center justify-center w-[30px] h-[30px] rounded-md bg-transparent border-none cursor-pointer text-mono-600 hover:text-red-400 hover:bg-red-400/8 transition-colors"
          title="Delete"
          @click.stop="emit('delete')"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
        </button>
      </div>
    </div>

    <!-- Chamber (expanded) -->
    <div v-if="expanded" class="px-[18px] pb-5 pt-4">
      <slot name="chamber" />
    </div>
  </div>
</template>
