<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { fetchBooks, type Book } from '../../lib/api';

/**
 * Option A "book line": a single compact attribution/filter line with an
 * anchored popover picker. Notes conceptually always live in a book — this
 * replaces the old none/book/author/other segmented control.
 */
const props = withDefaults(
  defineProps<{
    /** Selected book (v-model:book). */
    book: Book | null;
    /** Page reference (v-model:page) — rendered only when showPage. */
    page?: string;
    showPage?: boolean;
    /** Ghost prompt when nothing is selected. */
    placeholder?: string;
    /** Externally supplied list; when null, fetched on first open. */
    books?: Book[] | null;
    /** Note counts per book id — shown as a column and used to sort. */
    counts?: Map<string, number> | null;
    /** Offer an "Unattached notes" row (v-model:unattached). */
    allowUnattached?: boolean;
    unattached?: boolean;
    unattachedCount?: number | null;
  }>(),
  {
    page: '',
    showPage: false,
    placeholder: 'attach a book…',
    books: null,
    counts: null,
    allowUnattached: false,
    unattached: false,
    unattachedCount: null,
  }
);

const emit = defineEmits<{
  (e: 'update:book', value: Book | null): void;
  (e: 'update:page', value: string): void;
  (e: 'update:unattached', value: boolean): void;
  (e: 'open'): void;
}>();

const isOpen = ref(false);
const search = ref('');
const hlIndex = ref(0);
const loading = ref(false);
const fetched = ref<Book[]>([]);
const rootRef = ref<HTMLElement | null>(null);
const searchRef = ref<HTMLInputElement | null>(null);

const allBooks = computed(() => props.books ?? fetched.value);

const filtered = computed(() => {
  const q = search.value.toLowerCase();
  let list = allBooks.value;
  if (q) {
    list = list.filter(
      (b) => b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q)
    );
  }
  if (props.counts) {
    const counts = props.counts;
    list = [...list].sort(
      (a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0) || a.title.localeCompare(b.title)
    );
  }
  return list;
});

/** Keyboard-navigable rows: books, then the optional unattached row. */
const rowCount = computed(() => filtered.value.length + (props.allowUnattached ? 1 : 0));

watch(search, () => {
  hlIndex.value = 0;
});

const open = async () => {
  isOpen.value = true;
  search.value = '';
  hlIndex.value = 0;
  emit('open');
  if (!props.books && fetched.value.length === 0) {
    loading.value = true;
    try {
      fetched.value = await fetchBooks({ limit: 500 });
    } catch (err) {
      console.error('Failed to load books:', err);
    } finally {
      loading.value = false;
    }
  }
  await nextTick();
  searchRef.value?.focus();
};

const close = () => {
  isOpen.value = false;
  search.value = '';
};

const selectBook = (b: Book) => {
  emit('update:book', b);
  if (props.allowUnattached && props.unattached) emit('update:unattached', false);
  close();
};

const selectUnattached = () => {
  emit('update:book', null);
  emit('update:unattached', true);
  close();
};

const clear = () => {
  emit('update:book', null);
  if (props.showPage && props.page) emit('update:page', '');
  if (props.allowUnattached && props.unattached) emit('update:unattached', false);
};

const onKeydown = (e: KeyboardEvent) => {
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    hlIndex.value = Math.min(hlIndex.value + 1, rowCount.value - 1);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    hlIndex.value = Math.max(hlIndex.value - 1, 0);
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (hlIndex.value < filtered.value.length) {
      const b = filtered.value[hlIndex.value];
      if (b) selectBook(b);
    } else if (props.allowUnattached) {
      selectUnattached();
    }
  } else if (e.key === 'Escape') {
    close();
  }
};

const handleClickOutside = (e: MouseEvent) => {
  if (isOpen.value && rootRef.value && !rootRef.value.contains(e.target as Node)) close();
};

onMounted(() => document.addEventListener('click', handleClickOutside));
onUnmounted(() => document.removeEventListener('click', handleClickOutside));
</script>

<template>
  <div ref="rootRef" class="relative">
    <!-- Empty: the whole line is the trigger -->
    <button v-if="!book && !(allowUnattached && unattached)" @click="open" class="w-full flex items-center gap-2 min-h-7 px-1 text-[13px] text-left cursor-pointer group">
      <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0 text-gold/60">
        <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20" />
      </svg>
      <span class="italic text-mono-600 group-hover:text-mono-400 transition-colors">{{ placeholder }}</span>
    </button>

    <!-- The line — something selected -->
    <div v-else class="flex items-center gap-2 min-h-7 px-1 text-[13px]">
      <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0 text-gold">
        <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20" />
      </svg>

      <!-- Unattached filter selected -->
      <template v-if="allowUnattached && unattached">
        <span class="text-mono-200">Unattached notes</span>
        <button @click="clear" class="p-1 rounded text-mono-600 hover:text-mono-300 hover:bg-mono-800 transition-colors cursor-pointer" title="Clear">
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      </template>

      <!-- Book selected: reads like a citation -->
      <template v-else-if="book">
        <span class="italic truncate" style="color: #e8d0a8">{{ book.title }}</span>
        <span class="text-mono-700 shrink-0">·</span>
        <span class="text-mono-500 truncate shrink-[2]">{{ book.author }}</span>
        <span class="flex-1"></span>
        <input v-if="showPage" :value="page" @input="emit('update:page', ($event.target as HTMLInputElement).value)" placeholder="p. —" class="w-14 shrink-0 bg-transparent border-b border-mono-800 text-center italic text-xs text-mono-400 placeholder:text-mono-700 focus:outline-none focus:border-mono-600 py-0.5" />
        <button @click="open" class="p-1 rounded text-mono-600 hover:text-mono-300 hover:bg-mono-800 transition-colors cursor-pointer shrink-0" title="Change book">
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="m16 3 4 4-4 4" />
            <path d="M20 7H4" />
            <path d="m8 21-4-4 4-4" />
            <path d="M4 17h16" />
          </svg>
        </button>
        <button @click="clear" class="p-1 rounded text-mono-600 hover:text-mono-300 hover:bg-mono-800 transition-colors cursor-pointer shrink-0" title="Detach">
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      </template>
    </div>

    <!-- Popover picker -->
    <div v-if="isOpen" class="absolute left-0 right-0 top-full mt-1.5 z-40 bg-mono-900 border border-mono-700 rounded-xl shadow-2xl shadow-black/60 overflow-hidden">
      <div class="flex items-center gap-2.5 px-3.5 py-2.5 border-b border-mono-800">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-mono-600 shrink-0">
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input ref="searchRef" v-model="search" @keydown="onKeydown" type="text" :placeholder="`Search ${allBooks.length || ''} books…`" class="flex-1 min-w-0 bg-transparent text-base sm:text-[13.5px] text-mono-100 placeholder:text-mono-600 placeholder:italic focus:outline-none" />
        <span class="hidden sm:block text-[10px] text-mono-600 tracking-wide select-none shrink-0">↑↓ · ↵</span>
      </div>
      <div class="max-h-72 overflow-y-auto overscroll-contain">
        <div v-if="loading" class="px-4 py-6 text-center text-xs text-mono-600 italic">loading books…</div>
        <template v-else>
          <button v-for="(b, i) in filtered" :key="b.id" @click="selectBook(b)" @mousemove="hlIndex = i" class="w-full flex items-baseline gap-2 px-3.5 py-2 text-left cursor-pointer transition-colors" :class="hlIndex === i ? 'bg-accent/10' : ''">
            <span class="text-[13px] italic truncate" :class="book?.id === b.id ? 'text-gold' : ''" :style="book?.id === b.id ? undefined : { color: '#e8d0a8' }">{{ b.title }}</span>
            <span class="text-xs text-mono-400 truncate">{{ b.author }}</span>
            <span class="flex-1"></span>
            <span v-if="b.originally_published" class="text-[11px] text-white shrink-0">{{ b.originally_published }}</span>
            <span v-if="counts" class="text-[11px] text-mono-600 tabular-nums shrink-0 w-7 text-right">{{ counts.get(b.id) ?? 0 }}</span>
          </button>
          <div v-if="!filtered.length" class="px-4 py-5 text-center text-xs text-mono-600 italic">no books match “{{ search }}”</div>
          <button v-if="allowUnattached" @click="selectUnattached" @mousemove="hlIndex = filtered.length" class="w-full flex items-baseline gap-2 px-3.5 py-2.5 text-left cursor-pointer transition-colors border-t border-mono-800 text-[13px]" :class="[hlIndex === filtered.length ? 'bg-accent/10' : '', unattached ? 'text-gold' : 'text-mono-400']">
            <span class="flex-1">Unattached notes</span>
            <span v-if="unattachedCount !== null" class="text-[11px] text-mono-600 tabular-nums">{{ unattachedCount }}</span>
          </button>
        </template>
      </div>
    </div>
  </div>
</template>
