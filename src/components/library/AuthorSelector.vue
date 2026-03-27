<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { fetchAuthors, createAuthor, type Author } from '../lib/api';

const props = withDefaults(defineProps<{
  autoOpen?: boolean;
}>(), {
  autoOpen: false,
});

const model = defineModel<string>({ default: '' });

const isOpen = ref(false);
const search = ref('');
const authors = ref<Author[]>([]);
const loading = ref(false);
const dropdownRef = ref<HTMLElement | null>(null);
const searchInputRef = ref<HTMLInputElement | null>(null);
const quickAddInputRef = ref<HTMLInputElement | null>(null);

// Inline quick-add state
const showQuickAdd = ref(false);
const quickAddName = ref('');
const quickAddSaving = ref(false);

const selectedAuthor = computed(() => {
  if (!model.value) return null;
  return authors.value.find(a => a.id === model.value) || null;
});

const filteredAuthors = computed(() => {
  if (!search.value) return authors.value;
  const q = search.value.toLowerCase();
  return authors.value.filter(a => a.name.toLowerCase().includes(q));
});

const loadAuthors = async () => {
  loading.value = true;
  try {
    authors.value = await fetchAuthors({ limit: 500 });
  } catch (err) {
    console.error('Failed to load authors:', err);
  } finally {
    loading.value = false;
  }
};

const selectAuthor = (author: Author) => {
  model.value = author.id;
  isOpen.value = false;
  search.value = '';
  showQuickAdd.value = false;
};

const clearSelection = () => {
  model.value = '';
};

const toggleDropdown = () => {
  isOpen.value = !isOpen.value;
  if (isOpen.value) {
    showQuickAdd.value = false;
    quickAddName.value = '';
    if (authors.value.length === 0) {
      loadAuthors();
    }
    nextTick(() => searchInputRef.value?.focus());
  }
};

// Auto-open when prop is set (e.g. from SourceSelector mode pill)
watch(() => props.autoOpen, (val) => {
  if (val && !model.value && !isOpen.value) {
    toggleDropdown();
  }
});

const startQuickAdd = () => {
  showQuickAdd.value = true;
  quickAddName.value = search.value;
  nextTick(() => quickAddInputRef.value?.focus());
};

// Auto-show quick-add when search yields no results
watch([filteredAuthors, search], ([filtered, q]) => {
  if (isOpen.value && !loading.value && filtered.length === 0 && q.trim() && !showQuickAdd.value) {
    startQuickAdd();
  }
});

const handleQuickAdd = async () => {
  if (!quickAddName.value.trim() || quickAddSaving.value) return;

  quickAddSaving.value = true;
  try {
    const result = await createAuthor({ name: quickAddName.value.trim() });
    // Add to local list and select immediately
    authors.value.push(result.author);
    authors.value.sort((a, b) => a.name.localeCompare(b.name));
    selectAuthor(result.author);
  } catch (err) {
    console.error('Failed to create author:', err);
    alert('Failed to create author.');
  } finally {
    quickAddSaving.value = false;
  }
};

const cancelQuickAdd = () => {
  showQuickAdd.value = false;
  quickAddName.value = '';
};

// Close dropdown when clicking outside
const handleClickOutside = (event: MouseEvent) => {
  if (dropdownRef.value && !dropdownRef.value.contains(event.target as Node)) {
    isOpen.value = false;
    showQuickAdd.value = false;
  }
};

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
  loadAuthors();
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});

defineExpose({ loadAuthors, authors });
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <label class="text-xs text-mono-400 uppercase tracking-wide">Author <span class="text-accent">*</span></label>

    <div ref="dropdownRef" class="relative">
      <!-- Selected Author Display -->
      <div v-if="selectedAuthor" @click="toggleDropdown" class="flex items-center gap-2 px-3 py-2 bg-mono-800 border border-mono-700 rounded-lg min-h-11 cursor-pointer hover:border-mono-600 transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-accent shrink-0">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-mono-100 truncate">{{ selectedAuthor.name }}</p>
          <p v-if="selectedAuthor.born" class="text-xs text-mono-400 truncate">{{ selectedAuthor.born }}{{ selectedAuthor.died ? ' – ' + selectedAuthor.died : '' }}</p>
        </div>
        <button @click.stop="clearSelection" type="button" class="p-1 hover:bg-mono-700 rounded transition-colors cursor-pointer" title="Clear selection">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-mono-400">
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      </div>

      <!-- Empty State / Trigger -->
      <button v-else @click="toggleDropdown" type="button" class="w-full flex items-center gap-2 px-3 py-2 bg-mono-950 border border-mono-800 rounded-lg text-mono-500 hover:border-mono-700 hover:text-mono-400 transition-colors cursor-pointer min-h-11">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
        <span class="text-sm">Select an author...</span>
      </button>

      <!-- Dropdown -->
      <transition
        enter-active-class="transition ease-out duration-100"
        enter-from-class="transform opacity-0 scale-95"
        enter-to-class="transform opacity-100 scale-100"
        leave-active-class="transition ease-in duration-75"
        leave-from-class="transform opacity-100 scale-100"
        leave-to-class="transform opacity-0 scale-95"
      >
        <div v-if="isOpen" class="absolute z-50 mt-1 w-full bg-mono-900 border border-mono-700 rounded-lg shadow-xl overflow-hidden">
          <!-- Search -->
          <div class="p-2 border-b border-mono-800">
            <input
              ref="searchInputRef"
              v-model="search"
              type="text"
              placeholder="Search authors..."
              class="w-full px-3 py-2 bg-mono-950 border border-mono-800 rounded-md text-sm text-mono-100 placeholder-mono-600 focus:outline-none focus:border-accent"
              @click.stop
              @keydown.enter.prevent="filteredAuthors.length === 1 ? selectAuthor(filteredAuthors[0]) : (showQuickAdd && quickAddName.trim() ? handleQuickAdd() : undefined)"
            />
          </div>

          <!-- Quick Add (inline) -->
          <div v-if="showQuickAdd" class="p-2 border-b border-mono-800">
            <div class="flex gap-2">
              <input
                ref="quickAddInputRef"
                v-model="quickAddName"
                type="text"
                placeholder="Author name..."
                class="flex-1 px-3 py-2 bg-mono-950 border border-mono-800 rounded-md text-sm text-mono-100 placeholder-mono-600 focus:outline-none focus:border-accent"
                @click.stop
                @keydown.enter.prevent="handleQuickAdd"
                @keydown.escape.prevent="cancelQuickAdd"
              />
              <button
                @click.stop="handleQuickAdd"
                :disabled="!quickAddName.trim() || quickAddSaving"
                type="button"
                class="px-3 py-2 bg-accent hover:bg-accent-bright disabled:opacity-50 text-white text-xs font-medium rounded-md transition-colors cursor-pointer shrink-0"
              >
                {{ quickAddSaving ? '...' : 'Add' }}
              </button>
            </div>
          </div>

          <!-- Add New Author button -->
          <button
            v-if="!showQuickAdd"
            @click.stop="startQuickAdd"
            type="button"
            class="w-full flex items-center gap-3 px-3 py-2.5 text-accent hover:bg-accent/10 transition-colors text-left cursor-pointer border-b border-mono-800"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0">
              <path d="M12 5v14" />
              <path d="M5 12h14" />
            </svg>
            <span class="text-sm font-medium">Add new author</span>
          </button>

          <!-- Author List -->
          <div class="max-h-60 overflow-y-auto overscroll-contain">
            <div v-if="loading" class="p-4 text-center text-mono-500 text-sm">
              Loading authors...
            </div>
            <div v-else-if="filteredAuthors.length === 0" class="p-4 text-center text-mono-500 text-sm">
              No authors found
            </div>
            <button
              v-else
              v-for="author in filteredAuthors"
              :key="author.id"
              @click="selectAuthor(author)"
              type="button"
              class="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-mono-800 transition-colors text-left cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-mono-500 shrink-0">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-mono-100 truncate">{{ author.name }}</p>
                <p v-if="author.born" class="text-xs text-mono-400 truncate">{{ author.born }}{{ author.died ? ' – ' + author.died : '' }}</p>
              </div>
            </button>
          </div>
        </div>
      </transition>
    </div>
  </div>
</template>
