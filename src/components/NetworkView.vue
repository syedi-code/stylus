<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import {
  fetchThoughts,
  createThought,
  deleteThought,
  updateThoughtPosition,
  type Thought,
} from '../lib/api';

// ============================================================================
// State
// ============================================================================

const thoughts = ref<Thought[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const selectedThought = ref<Thought | null>(null);

// Canvas state
const canvasRef = ref<HTMLDivElement | null>(null);
const canvasOffset = ref({ x: 0, y: 0 });
const canvasScale = ref(1);
const isPanning = ref(false);
const panStart = ref({ x: 0, y: 0 });

// Drag state
const draggingId = ref<string | null>(null);
const dragOffset = ref({ x: 0, y: 0 });

// Composer
const composerContent = ref('');
const composerSubmitting = ref(false);

// ============================================================================
// Data Loading
// ============================================================================

const loadThoughts = async () => {
  loading.value = true;
  error.value = null;

  try {
    const result = await fetchThoughts({ limit: 5000 });
    thoughts.value = result.data;
  } catch (err) {
    console.error('Failed to load thoughts:', err);
    error.value = 'Failed to load thoughts. Check connection.';
  } finally {
    loading.value = false;
  }
};

// ============================================================================
// Card Sizing
// ============================================================================

const getCardSize = (content: string): 'sm' | 'md' | 'lg' | 'xl' => {
  const len = content.length;
  if (len < 60) return 'sm';
  if (len < 150) return 'md';
  if (len < 300) return 'lg';
  return 'xl';
};

const cardSizeClasses = {
  sm: 'w-48',
  md: 'w-64',
  lg: 'w-80',
  xl: 'w-96',
};

// ============================================================================
// Canvas Pan & Zoom
// ============================================================================

const handleWheel = (e: WheelEvent) => {
  if (e.ctrlKey || e.metaKey) {
    // Zoom
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(0.25, Math.min(2, canvasScale.value * delta));
    canvasScale.value = newScale;
  } else {
    // Pan
    canvasOffset.value = {
      x: canvasOffset.value.x - e.deltaX,
      y: canvasOffset.value.y - e.deltaY,
    };
  }
};

const handleCanvasMouseDown = (e: MouseEvent) => {
  // Only start panning if clicking on canvas background
  if (e.target === canvasRef.value || (e.target as HTMLElement).classList.contains('canvas-bg')) {
    isPanning.value = true;
    panStart.value = { x: e.clientX - canvasOffset.value.x, y: e.clientY - canvasOffset.value.y };
    selectedThought.value = null;
  }
};

const handleCanvasMouseMove = (e: MouseEvent) => {
  if (isPanning.value) {
    canvasOffset.value = {
      x: e.clientX - panStart.value.x,
      y: e.clientY - panStart.value.y,
    };
  }
};



// ============================================================================
// Card Dragging
// ============================================================================

const handleCardMouseDown = (e: MouseEvent, thought: Thought) => {
  e.stopPropagation();
  draggingId.value = thought.id;

  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  dragOffset.value = {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top,
  };
};

const handleMouseMove = (e: MouseEvent) => {
  if (draggingId.value && canvasRef.value) {
    const canvasRect = canvasRef.value.getBoundingClientRect();

    // Calculate position in canvas space
    const x = (e.clientX - canvasRect.left - canvasOffset.value.x - dragOffset.value.x) / canvasScale.value;
    const y = (e.clientY - canvasRect.top - canvasOffset.value.y - dragOffset.value.y) / canvasScale.value;

    // Update local state immediately for smooth dragging
    const thought = thoughts.value.find(t => t.id === draggingId.value);
    if (thought) {
      thought.x = x;
      thought.y = y;
    }
  } else if (isPanning.value) {
    handleCanvasMouseMove(e);
  }
};

const handleMouseUp = async () => {
  if (draggingId.value) {
    const thought = thoughts.value.find(t => t.id === draggingId.value);
    if (thought && thought.x !== undefined && thought.y !== undefined) {
      // Persist position to server
      try {
        await updateThoughtPosition(thought.id, thought.x, thought.y);
      } catch (err) {
        console.error('Failed to save position:', err);
      }
    }
    draggingId.value = null;
  }
  isPanning.value = false;
};

// ============================================================================
// Thought Actions
// ============================================================================

const copyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text);
};

const handleSubmit = async () => {
  if (!composerContent.value.trim() || composerSubmitting.value) return;

  composerSubmitting.value = true;
  try {
    const result = await createThought({ content: composerContent.value.trim() });

    // Position new thought near center of current view
    const newThought = result.thought;
    if (canvasRef.value) {
      const rect = canvasRef.value.getBoundingClientRect();
      newThought.x = (rect.width / 2 - canvasOffset.value.x) / canvasScale.value - 100;
      newThought.y = (rect.height / 2 - canvasOffset.value.y) / canvasScale.value - 50;

      // Save initial position
      await updateThoughtPosition(newThought.id, newThought.x, newThought.y);
    }

    thoughts.value = [newThought, ...thoughts.value];
    composerContent.value = '';
  } catch (err) {
    console.error('Failed to create thought:', err);
  } finally {
    composerSubmitting.value = false;
  }
};

const handleDelete = async (thought: Thought) => {
  if (!confirm('Delete this thought?')) return;

  try {
    await deleteThought(thought.id);
    thoughts.value = thoughts.value.filter(t => t.id !== thought.id);
    selectedThought.value = null;
  } catch (err) {
    console.error('Failed to delete thought:', err);
  }
};

const handleCardClick = (e: MouseEvent, thought: Thought) => {
  // Only select if not dragging
  if (!draggingId.value) {
    e.stopPropagation();
    selectedThought.value = selectedThought.value?.id === thought.id ? null : thought;
  }
};

// ============================================================================
// Utilities
// ============================================================================

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
};

const getCardPosition = (thought: Thought, index: number) => {
  // If no position set, arrange in a grid
  if (thought.x === undefined || thought.x === null) {
    const cols = 4;
    const row = Math.floor(index / cols);
    const col = index % cols;
    return {
      x: col * 280 + 50,
      y: row * 200 + 50,
    };
  }
  return { x: thought.x, y: thought.y };
};

// ============================================================================
// Lifecycle
// ============================================================================

onMounted(() => {
  loadThoughts();
  window.addEventListener('mousemove', handleMouseMove);
  window.addEventListener('mouseup', handleMouseUp);
});

onUnmounted(() => {
  window.removeEventListener('mousemove', handleMouseMove);
  window.removeEventListener('mouseup', handleMouseUp);
});

// Character count
const charCount = computed(() => composerContent.value.length);
const charCountClass = computed(() => {
  if (charCount.value > 900) return 'text-red-500';
  if (charCount.value > 700) return 'text-gold';
  return 'text-mono-600';
});
</script>

<template>
  <div class="thoughts-canvas relative w-[calc(100%+4rem)] h-[calc(100vh-160px)] min-h-125 -mx-8 -mt-8 overflow-hidden">
    <!-- Loading overlay -->
    <div v-if="loading" class="absolute inset-0 flex items-center justify-center bg-mono-950/80 z-10">
      <div class="text-center">
        <div class="inline-block animate-spin h-8 w-8 border-2 border-accent border-t-transparent rounded-full mb-4"></div>
        <p class="text-xs tracking-widest uppercase text-mono-500">Loading thoughts...</p>
      </div>
    </div>

    <!-- Error -->
    <div v-if="error" class="absolute inset-0 flex items-center justify-center bg-mono-950/80 z-10">
      <div class="text-center">
        <p class="text-red-500 font-bold uppercase text-sm mb-4">{{ error }}</p>
        <button @click="loadThoughts" class="px-4 py-2 bg-red-900 hover:bg-red-800 text-white text-xs font-bold uppercase tracking-wide transition-colors cursor-pointer">
          Retry
        </button>
      </div>
    </div>

    <!-- Canvas -->
    <div ref="canvasRef" class="w-full h-full bg-mono-950 border border-mono-800 rounded-lg relative" :class="isPanning ? 'cursor-grabbing' : 'cursor-grab'" @mousedown="handleCanvasMouseDown" @wheel="handleWheel">
      <!-- Grid background pattern -->
      <div class="canvas-bg absolute inset-0 opacity-30" style="background-image: radial-gradient(circle, #333 1px, transparent 1px); background-size: 24px 24px;"></div>

      <!-- Transform container -->
      <div class="absolute" :style="{
        transform: `translate(${canvasOffset.x}px, ${canvasOffset.y}px) scale(${canvasScale})`,
        transformOrigin: '0 0',
      }">
        <!-- Thought Cards -->
        <div v-for="(thought, index) in thoughts" :key="thought.id" class="thought-card absolute select-none" :class="[
          cardSizeClasses[getCardSize(thought.content)],
          draggingId === thought.id ? 'z-50 scale-105 shadow-2xl' : 'z-10',
          selectedThought?.id === thought.id ? 'ring-2 ring-accent' : '',
        ]" :style="{
          left: `${getCardPosition(thought, index).x}px`,
          top: `${getCardPosition(thought, index).y}px`,
          transition: draggingId === thought.id ? 'none' : 'box-shadow 0.15s, transform 0.15s',
        }" @mousedown="handleCardMouseDown($event, thought)" @click="handleCardClick($event, thought)">
          <div class="bg-mono-900 border border-mono-700 rounded-xl p-4 cursor-grab active:cursor-grabbing hover:border-mono-600 transition-colors h-full" :class="draggingId === thought.id ? 'border-accent' : ''">
            <!-- Date badge -->
            <div class="text-[10px] text-mono-500 uppercase tracking-wider mb-2">
              {{ formatDate(thought.created_at) }}
            </div>

            <!-- Content -->
            <p class="text-mono-200 text-sm leading-relaxed whitespace-pre-wrap wrap-break-word">
              {{ thought.content }}
            </p>
          </div>
        </div>
      </div>

      <!-- Empty state -->
      <div v-if="!loading && !error && thoughts.length === 0" class="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div class="text-center text-mono-600">
          <div class="w-16 h-16 mx-auto mb-4 rounded-full border-2 border-dashed border-mono-700 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M12 8v8M8 12h8" />
            </svg>
          </div>
          <p class="text-sm mb-1">Your canvas is empty</p>
          <p class="text-xs text-mono-700">Add your first thought below</p>
        </div>
      </div>
    </div>

    <!-- Zoom indicator -->
    <div class="absolute top-4 left-4 bg-mono-900/80 backdrop-blur-sm px-3 py-1.5 rounded-lg text-xs text-mono-400 font-mono z-20">
      {{ Math.round(canvasScale * 100) }}%
    </div>

    <!-- Selected thought actions -->
    <transition name="slide-up">
      <div v-if="selectedThought" class="absolute bottom-24 left-1/2 -translate-x-1/2 bg-mono-900/95 backdrop-blur-md border border-mono-700/50 rounded-xl shadow-xl z-30 flex items-center gap-1 p-1">
        <button @click="copyToClipboard(selectedThought!.content)" class="flex items-center gap-2 px-4 py-2 text-sm text-mono-300 hover:text-white hover:bg-mono-700/50 rounded-lg transition-all cursor-pointer">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          Copy
        </button>
        <div class="w-px h-6 bg-mono-700"></div>
        <button @click="handleDelete(selectedThought!)" class="flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-all cursor-pointer">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
          Delete
        </button>
      </div>
    </transition>

    <!-- Floating Composer -->
    <div class="absolute bottom-6 left-1/2 -translate-x-1/2 w-full max-w-lg px-4 z-30">
      <form @submit.prevent="handleSubmit" class="bg-mono-900/95 backdrop-blur-sm border border-mono-700 rounded-2xl p-4 shadow-2xl shadow-black/50">
        <textarea v-model="composerContent" placeholder="Capture a thought..." rows="2" class="w-full bg-transparent text-mono-100 placeholder-mono-600 resize-none focus:outline-none text-sm" @keydown.meta.enter="handleSubmit" @keydown.ctrl.enter="handleSubmit"></textarea>
        <div class="flex justify-between items-center mt-2 pt-2 border-t border-mono-800">
          <span :class="['text-xs tabular-nums', charCountClass]">{{ charCount }}</span>
          <button type="submit" :disabled="!composerContent.trim() || composerSubmitting" class="px-4 py-1.5 bg-accent hover:bg-accent-bright disabled:bg-mono-800 disabled:text-mono-600 text-white text-xs font-bold uppercase tracking-wide rounded-lg transition-all cursor-pointer disabled:cursor-not-allowed">
            {{ composerSubmitting ? '...' : '⏎ Add' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.2s ease;
}

.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
  transform: translate(-50%, 10px);
}

.thought-card:hover {
  z-index: 20;
}
</style>
