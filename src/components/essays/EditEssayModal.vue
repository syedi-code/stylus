<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import { createEssay, type Essay, type EssayInput } from '../../lib/api';
import { bookHue, bookGradient } from '../../composables/useBookHue';
import { useEssayDraft } from '../../composables/useEssayDraft';
import EssayLibraryBrowser, { type SelectedBookRef } from './EssayLibraryBrowser.vue';

const props = defineProps<{
  isOpen: boolean;
  essay?: Essay | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'saved'): void;
}>();

const content = ref('');
const selectedRefs = ref<SelectedBookRef[]>([]);
const tagInput = ref('');
const tags = ref<string[]>([]);
const submitting = ref(false);
const textareaRef = ref<HTMLTextAreaElement | null>(null);

const { draftContent, draftTags, draftRefs, restore: restoreDraft, clearDraft } = useEssayDraft();

// Edit mode: pre-fill when opening with an existing essay
const isEditMode = computed(() => !!props.essay);

watch(() => props.isOpen, (open) => {
  if (open) {
    if (props.essay) {
      // Pre-fill for versioning (creates new record with replaces)
      content.value = props.essay.content;
      tags.value = [...(props.essay.tags || [])];
      selectedRefs.value = props.essay.references.map(r => ({
        book_id: r.book_id,
        book_title: r.book_title || '',
        book_author: r.book_author || '',
        page: r.page,
      }));
    } else {
      // Restore cached draft (or start blank)
      restoreDraft();
      content.value = draftContent.value;
      tags.value = [...draftTags.value];
      selectedRefs.value = [...draftRefs.value];
      tagInput.value = '';
    }
    nextTick(() => textareaRef.value?.focus());
  }
});

// Auto-save draft for new essays
watch(content, (v) => { if (!isEditMode.value) draftContent.value = v; });
watch(tags, (v) => { if (!isEditMode.value) draftTags.value = [...v]; }, { deep: true });
watch(selectedRefs, (v) => { if (!isEditMode.value) draftRefs.value = [...v]; }, { deep: true });

const gradient = computed(() => {
  const bookIds = selectedRefs.value.map(r => r.book_id);
  return bookGradient(bookIds);
});

const charCount = computed(() => content.value.length);
const MAX_CHARS = 3000;

const canSubmit = computed(() =>
  content.value.trim().length > 0 &&
  charCount.value <= MAX_CHARS &&
  !submitting.value
);

const updatePage = (bookId: string, page: string) => {
  selectedRefs.value = selectedRefs.value.map(r =>
    r.book_id === bookId ? { ...r, page: page || undefined } : r
  );
};

const removeRef = (bookId: string) => {
  selectedRefs.value = selectedRefs.value.filter(r => r.book_id !== bookId);
};

const handleTagKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault();
    const tag = tagInput.value.trim().replace(/^#/, '');
    if (tag && !tags.value.includes(tag)) {
      tags.value.push(tag);
    }
    tagInput.value = '';
  }
  if (e.key === 'Backspace' && !tagInput.value && tags.value.length) {
    tags.value.pop();
  }
};

const handleSubmit = async () => {
  if (!canSubmit.value) return;
  submitting.value = true;

  try {
    const references = selectedRefs.value.map((r, i) => ({
      book_id: r.book_id,
      page: r.page || undefined,
      position: i,
    }));

    if (isEditMode.value && props.essay) {
      // Versioning: create a new essay that replaces the old one
      const input: EssayInput = {
        content: content.value,
        tags: tags.value.length ? tags.value : undefined,
        replaces: props.essay.id,
        references,
      };
      await createEssay(input);
    } else {
      const input: EssayInput = {
        content: content.value,
        tags: tags.value.length ? tags.value : undefined,
        references,
      };
      await createEssay(input);
    }
    clearDraft();
    emit('saved');
    emit('close');
  } catch (err: any) {
    console.error('Failed to save essay:', err?.response?.data ?? err);
  } finally {
    submitting.value = false;
  }
};

const handleKeydown = (e: KeyboardEvent) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    handleSubmit();
  }
};
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="isOpen" class="fixed inset-0 z-50 flex items-start justify-center p-4 pt-12 sm:pt-20 overflow-y-auto" @keydown="handleKeydown">
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/80 backdrop-blur-sm" @click="emit('close')"></div>

        <!-- Modal -->
        <div class="relative w-full max-w-[640px] flex flex-col border border-mono-800 rounded-lg bg-mono-900 overflow-hidden">
          <!-- Gradient top-bar (2px, per mockup 03) -->
          <div
            class="h-[2px] rounded-t-lg transition-opacity duration-200"
            :class="selectedRefs.length > 0 ? 'opacity-100' : 'opacity-85'"
            :style="{ background: gradient }"
          ></div>

          <!-- Writing area -->
          <div class="p-5 pb-3 flex flex-col gap-2">
            <textarea
              ref="textareaRef"
              v-model="content"
              placeholder="Begin writing… Ctrl+Enter to publish."
              class="w-full min-h-[360px] lg:min-h-[520px] 2xl:min-h-[680px] bg-transparent border-none outline-none resize-none font-body text-sm leading-[1.30] text-mono-100 placeholder:text-mono-600"
              style="text-wrap: pretty; font-kerning: normal; font-variant-ligatures: common-ligatures; font-variant-numeric: oldstyle-nums;"
            ></textarea>
            <span class="font-mono text-[10px] text-right tracking-[0.03em]" :class="charCount > MAX_CHARS ? 'text-red-400' : 'text-mono-600'">{{ charCount }}</span>
          </div>

          <div class="h-px bg-mono-800 mx-4"></div>

          <!-- Library panel -->
          <div class="p-4 flex flex-col gap-2.5">
            <EssayLibraryBrowser v-model="selectedRefs" />

            <!-- Selected reference chips with page inputs and remove buttons (per mockup 03) -->
            <div v-if="selectedRefs.length" class="flex flex-wrap gap-1.5">
              <span
                v-for="ref in selectedRefs"
                :key="ref.book_id"
                class="inline-flex items-baseline gap-[5px] py-[3px] pl-1.5 pr-1.5 rounded-sm text-[11px] text-mono-300 bg-mono-800 leading-[1.5]"
              >
                <span
                  class="w-1.5 h-1.5 rounded-full shrink-0 self-center"
                  :style="{ background: bookHue(ref.book_id) }"
                ></span>
                <span class="font-medium text-mono-400">{{ ref.book_author }}</span>
                <span class="italic">{{ ref.book_title }}</span>
                <input
                  :value="ref.page || ''"
                  @input="updatePage(ref.book_id, ($event.target as HTMLInputElement).value)"
                  placeholder="p."
                  class="w-[42px] py-px px-1 ml-1 bg-mono-700 border border-mono-600 rounded-[3px] font-mono text-[10px] text-mono-200 outline-none text-center placeholder:text-mono-500 focus:border-essay"
                />
                <button @click="removeRef(ref.book_id)" class="w-4 h-4 flex items-center justify-center bg-transparent border-none text-mono-500 cursor-pointer rounded-[3px] ml-0.5 transition-all hover:text-red-400 hover:bg-red-500/10">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </button>
              </span>
            </div>
          </div>

          <!-- Footer (per mockup 03: tags left, shortcut + publish right) -->
          <div class="flex items-center justify-between px-4 py-2.5 bg-mono-800 border-t border-mono-700">
            <div class="flex items-center gap-1.5 flex-1 min-w-0">
              <span
                v-for="tag in tags"
                :key="tag"
                class="inline-flex items-center py-0.5 px-2 bg-mono-700 rounded-sm font-mono text-[10px] text-mono-300 whitespace-nowrap"
              >
                #{{ tag }}
              </span>
              <input
                v-model="tagInput"
                @keydown="handleTagKeydown"
                placeholder="add tag…"
                class="py-1 px-2 bg-transparent border-none font-mono text-[10px] text-mono-200 outline-none w-[100px] placeholder:text-mono-500"
              />
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <span class="font-mono text-[10px] text-mono-500 hidden sm:inline">Ctrl+Enter</span>
              <button
                @click="handleSubmit"
                :disabled="!canSubmit"
                class="py-1.5 px-4 bg-essay border-none rounded-md font-body text-xs font-semibold text-black cursor-pointer transition-colors hover:bg-essay-bright disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {{ isEditMode ? 'Publish New Version' : 'Publish' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
