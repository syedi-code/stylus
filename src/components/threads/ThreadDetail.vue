<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import {
  fetchThread,
  updateThreadApi,
  removeThreadItemApi,
  reorderThreadItemsApi,
  fetchNotes,
  fetchQuotes,
  fetchBooks,
  fetchThoughts,
  fetchBookById,
  getSignedFileUrl,
  fetchConnections,
  fetchAuthorById,
  type Thread,
  type ThreadItem,
  type Book,
  type Author,
  type EntityType,
} from '../../lib/api';
import ThreadViewNote from '../notes/ThreadViewNote.vue';
import ThreadViewQuote from '../quotes/ThreadViewQuote.vue';
import ThreadViewThought from '../thoughts/ThreadViewThought.vue';
import ConfirmModal from '../shared/ConfirmModal.vue';

const props = defineProps<{
  threadId: string;
  showHeader?: boolean;
  isAdmin?: boolean;
}>();

const emit = defineEmits<{
  (e: 'back'): void;
  (e: 'deleted'): void;
  (e: 'presentItem', entityType: string, entity: any): void;
  (e: 'editItem', entityType: string, entity: any): void;
}>();

const thread = ref<Thread | null>(null);
const items = ref<ThreadItem[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);

// Resolved entity data
const resolvedEntities = ref<Map<string, any>>(new Map());

// Pre-resolved books, PDF URLs, and authors for note/quote cards
const resolvedBooks = ref<Map<string, Book>>(new Map());
const resolvedPdfUrls = ref<Map<string, string>>(new Map());
const resolvedAuthors = ref<Map<string, Author>>(new Map());

// Inline editing
const editingName = ref(false);
const editName = ref('');
const editingDesc = ref(false);
const editDesc = ref('');

// Drag state (desktop + touch)
const dragIndex = ref<number | null>(null);
const dragOverIndex = ref<number | null>(null);
const touchDragging = ref(false);
const itemsContainer = ref<HTMLElement | null>(null);
const isReordering = ref(false);

async function loadThread() {
  loading.value = true;
  error.value = null;
  try {
    const data = await fetchThread(props.threadId);
    thread.value = data.thread;
    items.value = data.items;
    editName.value = data.thread.name;
    editDesc.value = data.thread.description || '';
    await resolveItems(data.items);
  } catch (err) {
    console.error('Failed to load thread:', err);
    error.value = 'Failed to load thread.';
  } finally {
    loading.value = false;
  }
}

async function resolveItems(threadItems: ThreadItem[]) {
  // Group by entity_type
  const byType: Record<string, string[]> = {};
  for (const item of threadItems) {
    if (!byType[item.entity_type]) byType[item.entity_type] = [];
    byType[item.entity_type].push(item.entity_id);
  }

  const entityMap = new Map<string, any>();

  // Fetch each type in parallel
  const promises: Promise<void>[] = [];

  if (byType.note?.length) {
    promises.push(
      fetchNotes({ limit: 5000 }).then((result) => {
        for (const n of result.data) {
          if (byType.note.includes(n.id)) {
            entityMap.set(`note:${n.id}`, { ...n, posted: !!n.posted, tags: n.tags || [] });
          }
        }
      })
    );
  }

  if (byType.quote?.length) {
    promises.push(
      fetchQuotes({ limit: 5000 }).then((quotes) => {
        for (const q of quotes) {
          if (byType.quote.includes(q.id)) {
            entityMap.set(`quote:${q.id}`, { ...q, posted: !!q.posted, tags: q.tags || [] });
          }
        }
      })
    );
  }

  if (byType.book?.length) {
    promises.push(
      fetchBooks({ limit: 500 }).then((books) => {
        for (const b of books) {
          if (byType.book.includes(b.id)) {
            entityMap.set(`book:${b.id}`, b);
          }
        }
      })
    );
  }

  if (byType.thought?.length) {
    promises.push(
      fetchThoughts({ limit: 5000 }).then((result) => {
        for (const t of result.data) {
          if (byType.thought.includes(t.id)) {
            entityMap.set(`thought:${t.id}`, t);
          }
        }
      })
    );
  }

  await Promise.all(promises);
  resolvedEntities.value = entityMap;

  // Pre-resolve books, PDF URLs, and authors for note/quote cards
  const bookMap = new Map<string, Book>();
  const pdfUrlMap = new Map<string, string>();
  const authorMap = new Map<string, Author>();

  // Collect unique book IDs from notes and quotes
  const bookIds = new Set<string>();
  const entitiesToResolveAuthors: { type: string; id: string; key: string }[] = [];
  for (const [key, entity] of entityMap) {
    if (key.startsWith('note:') || key.startsWith('quote:')) {
      if (entity.book_id) {
        bookIds.add(entity.book_id);
      } else {
        // Notes without book_id need author connection lookup
        // Quotes without book_id AND without creator need author connection lookup
        const isQuote = key.startsWith('quote:');
        if (!isQuote || !entity.creator) {
          const entityType = key.split(':')[0];
          entitiesToResolveAuthors.push({ type: entityType, id: entity.id, key });
        }
      }
    }
  }

  // Batch-fetch books
  const bookFetches = Array.from(bookIds).map(async (bookId) => {
    try {
      const b = await fetchBookById(bookId);
      bookMap.set(bookId, b);
      if (b.pdf_url) {
        try {
          const path = b.pdf_url.replace('/files/', '');
          const signed = await getSignedFileUrl(path);
          pdfUrlMap.set(bookId, signed);
        } catch { /* ignore PDF signing errors */ }
      }
    } catch { /* ignore */ }
  });

  // Batch-fetch author connections
  const authorFetches = entitiesToResolveAuthors.map(async ({ type, id, key }) => {
    try {
      const conns = await fetchConnections(type as EntityType, id, 'author');
      if (conns.length > 0) {
        const conn = conns[0];
        const authorId = conn.a_type === 'author' ? conn.a_id : conn.b_id;
        const author = await fetchAuthorById(authorId);
        authorMap.set(key, author);
      }
    } catch { /* ignore */ }
  });

  await Promise.all([...bookFetches, ...authorFetches]);
  resolvedBooks.value = bookMap;
  resolvedPdfUrls.value = pdfUrlMap;
  resolvedAuthors.value = authorMap;
}

function getEntity(item: ThreadItem): any {
  return resolvedEntities.value.get(`${item.entity_type}:${item.entity_id}`);
}

function getBookForEntity(item: ThreadItem): Book | null {
  const entity = getEntity(item);
  if (!entity?.book_id) return null;
  return resolvedBooks.value.get(entity.book_id) || null;
}

function getPdfUrlForEntity(item: ThreadItem): string | null {
  const entity = getEntity(item);
  if (!entity?.book_id) return null;
  return resolvedPdfUrls.value.get(entity.book_id) || null;
}

function getAuthorForEntity(item: ThreadItem): Author | null {
  const key = `${item.entity_type}:${item.entity_id}`;
  return resolvedAuthors.value.get(key) || null;
}

// Inline name editing
function startEditName() {
  editName.value = thread.value?.name || '';
  editingName.value = true;
  nextTick(() => {
    const input = document.querySelector('.thread-name-input') as HTMLInputElement;
    input?.focus();
  });
}

async function saveName() {
  if (!thread.value || !editName.value.trim()) {
    editingName.value = false;
    return;
  }
  try {
    await updateThreadApi(thread.value.id, { name: editName.value.trim() });
    thread.value.name = editName.value.trim();
  } catch (err) {
    console.error('Failed to update name:', err);
  }
  editingName.value = false;
}

function startEditDesc() {
  editDesc.value = thread.value?.description || '';
  editingDesc.value = true;
  nextTick(() => {
    const input = document.querySelector('.thread-desc-input') as HTMLInputElement;
    input?.focus();
  });
}

async function saveDesc() {
  if (!thread.value) {
    editingDesc.value = false;
    return;
  }
  try {
    await updateThreadApi(thread.value.id, { description: editDesc.value.trim() || undefined });
    thread.value.description = editDesc.value.trim() || undefined;
  } catch (err) {
    console.error('Failed to update description:', err);
  }
  editingDesc.value = false;
}

// Remove item with confirmation
const removingItem = ref<ThreadItem | null>(null);

function requestRemoveItem(item: ThreadItem) {
  removingItem.value = item;
}

async function confirmRemoveItem() {
  const item = removingItem.value;
  if (!item) return;
  removingItem.value = null;
  try {
    await removeThreadItemApi(props.threadId, item.id);
    items.value = items.value.filter((i) => i.id !== item.id);
    resolvedEntities.value.delete(`${item.entity_type}:${item.entity_id}`);
  } catch (err) {
    console.error('Failed to remove item:', err);
  }
}

// Drag and drop (desktop only — guarded against concurrent touch drag)
function onDragStart(index: number, event: DragEvent) {
  if (touchDragging.value) { event.preventDefault(); return; }
  dragIndex.value = index;
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(index));
  }
}

function onDragOver(index: number, event: DragEvent) {
  if (touchDragging.value) return;
  event.preventDefault();
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move';
  }
  // Clamp to ±1 from source so items move only one position at a time
  if (dragIndex.value !== null) {
    dragOverIndex.value = Math.max(dragIndex.value - 1, Math.min(dragIndex.value + 1, index));
  } else {
    dragOverIndex.value = index;
  }
}

function onDragLeave() {
  if (touchDragging.value) return;
  dragOverIndex.value = null;
}

async function onDrop(targetIndex: number, event: DragEvent) {
  if (touchDragging.value) return;
  event.preventDefault();
  await reorderToIndex(dragIndex.value, targetIndex);
}

function onDragEnd() {
  if (touchDragging.value) return;
  dragIndex.value = null;
  dragOverIndex.value = null;
}

// Touch drag (mobile) — only triggered from drag handle
function onHandleTouchStart(index: number, event: TouchEvent) {
  event.preventDefault();
  event.stopPropagation();
  touchDragging.value = true;
  dragIndex.value = index;
}

function onHandleTouchMove(event: TouchEvent) {
  if (!touchDragging.value || dragIndex.value === null) return;
  event.preventDefault();
  const touch = event.touches[0];
  if (!itemsContainer.value) return;
  const elements = itemsContainer.value.querySelectorAll('.thread-item-row');
  for (let i = 0; i < elements.length; i++) {
    const rect = elements[i].getBoundingClientRect();
    if (touch.clientY >= rect.top && touch.clientY <= rect.bottom) {
      // Clamp to ±1 from source so items move only one position at a time
      const clamped = Math.max(dragIndex.value - 1, Math.min(dragIndex.value + 1, i));
      dragOverIndex.value = clamped;
      return;
    }
  }
}

async function onHandleTouchEnd(event: TouchEvent) {
  if (touchDragging.value && dragIndex.value !== null) {
    // Recalculate target from final finger position, clamped to ±1
    const touch = event.changedTouches[0];
    if (touch && itemsContainer.value) {
      const elements = itemsContainer.value.querySelectorAll('.thread-item-row');
      for (let i = 0; i < elements.length; i++) {
        const rect = elements[i].getBoundingClientRect();
        if (touch.clientY >= rect.top && touch.clientY <= rect.bottom) {
          dragOverIndex.value = Math.max(dragIndex.value! - 1, Math.min(dragIndex.value! + 1, i));
          break;
        }
      }
    }
    if (dragOverIndex.value !== null) {
      await reorderToIndex(dragIndex.value, dragOverIndex.value);
    }
  }
  touchDragging.value = false;
  dragIndex.value = null;
  dragOverIndex.value = null;
}

function onHandleTouchCancel() {
  touchDragging.value = false;
  dragIndex.value = null;
  dragOverIndex.value = null;
}

// Returns a directional arrow for the connector line at the given index during drag
function connectorArrow(index: number): string | null {
  if (dragIndex.value === null || dragOverIndex.value === null || dragIndex.value === dragOverIndex.value) return null;
  const movingDown = dragOverIndex.value > dragIndex.value;
  if (movingDown && index === dragIndex.value + 1) return '↓';
  if (!movingDown && index === dragIndex.value) return '↑';
  return null;
}

async function reorderToIndex(sourceIndex: number | null, targetIndex: number) {
  if (sourceIndex === null || sourceIndex === targetIndex || isReordering.value) {
    dragIndex.value = null;
    dragOverIndex.value = null;
    return;
  }
  if (targetIndex < 0 || targetIndex >= items.value.length) {
    dragIndex.value = null;
    dragOverIndex.value = null;
    return;
  }
  isReordering.value = true;
  const itemsCopy = [...items.value];
  const [moved] = itemsCopy.splice(sourceIndex, 1);
  itemsCopy.splice(targetIndex, 0, moved);
  items.value = itemsCopy;
  dragIndex.value = null;
  dragOverIndex.value = null;

  const reorderPayload = itemsCopy.map((item, i) => ({
    entity_type: item.entity_type,
    entity_id: item.entity_id,
    position: i,
  }));
  try {
    await reorderThreadItemsApi(props.threadId, reorderPayload);
  } catch (err) {
    console.error('Failed to reorder:', err);
    await loadThread();
  } finally {
    isReordering.value = false;
  }
}

watch(() => props.threadId, () => {
  loadThread();
}, { immediate: true });

defineExpose({ loadThread });
</script>

<template>
  <div class="thread-container">
    <!-- Loading -->
    <div v-if="loading" class="py-12 text-center text-mono-600">
      <div class="inline-block animate-spin h-5 w-5 border-2 border-purple-500 border-t-transparent rounded-full mb-3"></div>
      <p class="text-xs tracking-widest uppercase">Loading...</p>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="p-4 border border-red-900 bg-red-950/20 text-center rounded-lg">
      <p class="text-red-500 text-xs uppercase font-bold">{{ error }}</p>
    </div>

    <!-- Thread Content -->
    <div v-else-if="thread">
      <!-- Thread Title (above card) -->
      <div v-if="props.showHeader !== false" class="text-center mb-3">
        <div v-if="editingName" class="max-w-md mx-auto">
          <input v-model="editName" class="thread-name-input w-full text-sm sm:text-base font-semibold bg-transparent border-b border-mono-700 px-0 py-1 text-white text-center focus:outline-none placeholder-mono-600 tracking-tight" placeholder="Thread name..." @keydown.enter="saveName" @keydown.escape="editingName = false" @blur="saveName" />
        </div>
        <h2 v-else @click="props.isAdmin && startEditName()" class="text-sm sm:text-base font-semibold text-white tracking-tight" :class="props.isAdmin ? 'cursor-pointer hover:text-purple-300 transition-colors underline underline-offset-4 decoration-purple-500/40' : ''" :title="props.isAdmin ? 'Click to edit' : undefined">
          {{ thread.name.toLowerCase() }}
        </h2>
      </div>

      <div>

        <div v-if="editingDesc" class="max-w-sm mx-auto mt-1">
          <input v-model="editDesc" class="thread-desc-input w-full bg-transparent border-b border-mono-700 text-mono-300 text-sm text-center focus:outline-none focus:border-purple-500 placeholder-mono-600 py-1" placeholder="Add a description..." @keydown.enter="saveDesc" @keydown.escape="editingDesc = false" @blur="saveDesc" />
        </div>
        <p v-else-if="thread.description" @click="props.isAdmin && startEditDesc()" class="mt-1 text-sm text-mono-400 text-center" :class="props.isAdmin ? 'cursor-pointer hover:text-mono-200 transition-colors' : ''" :title="props.isAdmin ? 'Click to edit' : undefined">
          {{ thread.description }}
        </p>

        <!-- Empty State -->
        <div v-if="items.length === 0" class="py-12 text-center">
          <p class="text-sm text-mono-500">This thread is empty.</p>
          <p class="text-xs text-mono-600 mt-1">Add items from note, quote, or thought cards.</p>
        </div>

        <!-- Thread Items — Centered Timeline -->
        <div v-else ref="itemsContainer" class="relative max-w-lg mx-auto">
          <div v-for="(item, index) in items" :key="item.id" class="thread-item-row relative">
            <!-- Connector line / drag direction arrow between items -->
            <div v-if="index > 0" class="flex justify-center py-3">
              <span v-if="connectorArrow(index)" class="text-violet-400/50 text-sm font-bold leading-none select-none">{{ connectorArrow(index) }}</span>
              <div v-else class="w-px h-4 bg-violet-400/20"></div>
            </div>

            <!-- Card wrapper -->
            <div class="relative" draggable="true" @dragstart="onDragStart(index, $event)" @dragover="onDragOver(index, $event)" @dragleave="onDragLeave" @drop="onDrop(index, $event)" @dragend="onDragEnd">
              <!-- Item with controls -->
              <div class="relative group/item">
                <!-- Drag handle + Present + Remove -->
                <div v-if="props.isAdmin" class="absolute -top-2 -right-2 z-20 flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover/item:opacity-100 transition-opacity">
                  <div class="p-1.5 bg-mono-800 border border-mono-700 rounded-lg cursor-grab active:cursor-grabbing text-mono-500 hover:text-mono-300 shadow-lg touch-none" title="Drag to reorder" @touchstart="onHandleTouchStart(index, $event)" @touchmove="onHandleTouchMove" @touchend="onHandleTouchEnd" @touchcancel="onHandleTouchCancel">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                      <circle cx="9" cy="6" r="1.5" />
                      <circle cx="15" cy="6" r="1.5" />
                      <circle cx="9" cy="12" r="1.5" />
                      <circle cx="15" cy="12" r="1.5" />
                      <circle cx="9" cy="18" r="1.5" />
                      <circle cx="15" cy="18" r="1.5" />
                    </svg>
                  </div>
                  <button v-if="item.entity_type === 'note' || item.entity_type === 'quote' || item.entity_type === 'thought'" @click.stop="emit('presentItem', item.entity_type, getEntity(item))" class="p-1.5 bg-mono-800 border border-mono-700 rounded-lg text-mono-500 hover:text-mono-300 hover:border-mono-600 cursor-pointer transition-colors shadow-lg" title="Present">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="15 3 21 3 21 9" />
                      <polyline points="9 21 3 21 3 15" />
                      <line x1="21" y1="3" x2="14" y2="10" />
                      <line x1="3" y1="21" x2="10" y2="14" />
                    </svg>
                  </button>
                  <button v-if="item.entity_type === 'note' || item.entity_type === 'quote' || item.entity_type === 'thought'" @click.stop="emit('editItem', item.entity_type, getEntity(item))" class="p-1.5 bg-mono-800 border border-mono-700 rounded-lg text-mono-500 hover:text-mono-300 hover:border-mono-600 cursor-pointer transition-colors shadow-lg" title="Edit">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                      <path d="m15 5 4 4" />
                    </svg>
                  </button>
                  <button @click.stop="requestRemoveItem(item)" class="p-1.5 bg-mono-800 border border-mono-700 rounded-lg text-mono-500 hover:text-red-400 hover:border-red-500/30 cursor-pointer transition-colors shadow-lg" title="Remove from thread">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M18 6 6 18" />
                      <path d="m6 6 12 12" />
                    </svg>
                  </button>
                </div>

                <!-- Entity card -->
                <ThreadViewNote v-if="item.entity_type === 'note' && getEntity(item)" :note="getEntity(item)" :resolvedBook="getBookForEntity(item)" :resolvedPdfUrl="getPdfUrlForEntity(item)" :resolvedAuthor="getAuthorForEntity(item)" />
                <ThreadViewQuote v-else-if="item.entity_type === 'quote' && getEntity(item)" :quote="getEntity(item)" :resolvedBook="getBookForEntity(item)" :resolvedPdfUrl="getPdfUrlForEntity(item)" :resolvedAuthor="getAuthorForEntity(item)" />
                <ThreadViewThought v-else-if="item.entity_type === 'thought' && getEntity(item)" :thought="getEntity(item)" />
                <!-- Book (no BookItem component) -->
                <div v-else-if="item.entity_type === 'book' && getEntity(item)" class="p-3 sm:p-4 border border-emerald-700/30 bg-mono-900 rounded-lg">
                  <div class="flex items-center gap-2 mb-2">
                    <span class="bg-emerald-600 text-white px-2 py-0.5 text-xs font-bold uppercase tracking-wider">book</span>
                  </div>
                  <h4 class="text-sm font-semibold text-white">{{ getEntity(item).title }}</h4>
                  <p class="text-xs text-mono-400 mt-0.5">{{ getEntity(item).author }}</p>
                </div>
                <!-- Loading skeleton -->
                <div v-else class="p-3 sm:p-4 border border-mono-800 bg-mono-900 rounded-lg animate-pulse">
                  <div class="h-3 bg-mono-800 rounded w-20 mb-2"></div>
                  <div class="h-4 bg-mono-800 rounded w-3/4"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <ConfirmModal :isOpen="!!removingItem" title="Remove from thread" :message="`Remove this ${removingItem?.entity_type || 'item'} from the thread? The original item won't be deleted.`" confirmLabel="Remove" variant="warning" @confirm="confirmRemoveItem" @cancel="removingItem = null" />
</template>

<style scoped>
.thread-item-row {
  user-select: none;
  -webkit-user-select: none;
}
</style>
