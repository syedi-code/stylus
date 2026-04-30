<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import {
  createEssay,
  type Essay,
  type EssayInput,
  type EssayReferenceInput,
} from '../../lib/api';
import { useEssayDraft } from '../../composables/useEssayDraft';
import EssayEmbedSheet from './EssayEmbedSheet.vue';

const props = defineProps<{
  isOpen: boolean;
  essay?: Essay | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'saved'): void;
}>();

const content = ref('');
const tagInput = ref('');
const tags = ref<string[]>([]);
const submitting = ref(false);
const textareaRef = ref<HTMLTextAreaElement | null>(null);

const sheetOpen = ref(false);
const sheetInitialKind = ref<'quote' | 'book'>('quote');

const {
  draftContent,
  draftTags,
  restore: restoreDraft,
  clearDraft,
} = useEssayDraft();

const isEditMode = computed(() => !!props.essay);

watch(() => props.isOpen, (open) => {
  if (open) {
    if (props.essay) {
      content.value = props.essay.content;
      tags.value = [...(props.essay.tags || [])];
    } else {
      restoreDraft();
      content.value = draftContent.value;
      tags.value = [...draftTags.value];
      tagInput.value = '';
    }
    // Skip auto-focus on touch / coarse-pointer devices so the soft keyboard
    // doesn't pop up the moment the modal opens.
    const isCoarse =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(pointer: coarse)').matches;
    if (!isCoarse) {
      nextTick(() => textareaRef.value?.focus());
    }
  }
});

watch(content, (v) => { if (!isEditMode.value) draftContent.value = v; });
watch(tags, (v) => { if (!isEditMode.value) draftTags.value = [...v]; }, { deep: true });

const charCount = computed(() => content.value.length);
const MAX_CHARS = 20000;

const canSubmit = computed(() =>
  content.value.trim().length > 0 &&
  charCount.value <= MAX_CHARS &&
  !submitting.value
);

// ─── Cursor-aware insertion ───
function insertAtCursor(insert: string, selectInsertedRange?: { start: number; length: number }) {
  const ta = textareaRef.value;
  if (!ta) {
    content.value += insert;
    return;
  }
  const { selectionStart, selectionEnd, value } = ta;
  const before = value.slice(0, selectionStart);
  const after = value.slice(selectionEnd);
  content.value = `${before}${insert}${after}`;
  nextTick(() => {
    ta.focus();
    if (selectInsertedRange) {
      const start = before.length + selectInsertedRange.start;
      ta.setSelectionRange(start, start + selectInsertedRange.length);
    } else {
      const cursor = before.length + insert.length;
      ta.setSelectionRange(cursor, cursor);
    }
  });
}

/**
 * Insert text on its own paragraph at the cursor — guarantees `\n\n` padding
 * so the inserted token sits as a paragraph-isolated unit (matches the
 * paragraph-token grammar consumed by useEssaySlides + parseEssayTokens).
 */
function insertAsParagraph(token: string) {
  const ta = textareaRef.value;
  const value = ta?.value ?? content.value;
  const cursor = ta?.selectionStart ?? value.length;
  const before = value.slice(0, cursor);
  const after = value.slice(cursor);
  const prefix =
    before === '' || before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n';
  const suffix =
    after === '' || after.startsWith('\n\n') ? '' : after.startsWith('\n') ? '\n' : '\n\n';
  insertAtCursor(`${prefix}${token}${suffix}`);
}

function openSheet(kind: 'quote' | 'book') {
  sheetInitialKind.value = kind;
  sheetOpen.value = true;
}

function handleEmbedSelect(ref: EssayReferenceInput) {
  const token =
    ref.entity_type === 'quote'
      ? `[[quote:${ref.entity_id}]]`
      : `[[book:${ref.entity_id}]]`;
  insertAsParagraph(token);
}

/**
 * Wrap the current selection with `before…after` (e.g. `**…**`, `<…>`, `{…}`).
 * If nothing is selected, inserts the delimiters and places the cursor between
 * them so the user can type into the wrap.
 */
function wrapSelection(before: string, after: string) {
  const ta = textareaRef.value;
  if (!ta) return;
  const { selectionStart, selectionEnd, value } = ta;
  const selected = value.slice(selectionStart, selectionEnd);
  const pre = value.slice(0, selectionStart);
  const post = value.slice(selectionEnd);
  content.value = `${pre}${before}${selected}${after}${post}`;
  nextTick(() => {
    ta.focus();
    if (selected.length > 0) {
      const start = pre.length + before.length;
      ta.setSelectionRange(start, start + selected.length);
    } else {
      const cursor = pre.length + before.length;
      ta.setSelectionRange(cursor, cursor);
    }
  });
}

function insertHeader() {
  const placeholder = 'Section title';
  const ta = textareaRef.value;
  const value = ta?.value ?? content.value;
  const cursor = ta?.selectionStart ?? value.length;
  const before = value.slice(0, cursor);
  const after = value.slice(cursor);
  const prefix =
    before === '' || before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n';
  const suffix =
    after === '' || after.startsWith('\n\n') ? '' : after.startsWith('\n') ? '\n' : '\n\n';
  const insert = `${prefix}# ${placeholder}${suffix}`;
  // Select the placeholder so the user can type over it.
  insertAtCursor(insert, {
    start: prefix.length + 2, // skip "# "
    length: placeholder.length,
  });
}

const handleTagKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault();
    const tag = tagInput.value.trim().replace(/^#/, '');
    if (tag && !tags.value.includes(tag)) tags.value.push(tag);
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
    // References are derived server-side from content tokens; the worker
    // ignores anything we send. Pass empty so the API contract is satisfied.
    const baseInput: EssayInput = {
      content: content.value,
      tags: tags.value.length ? tags.value : undefined,
      references: [],
    };

    if (isEditMode.value && props.essay) {
      await createEssay({ ...baseInput, replaces: props.essay.id });
    } else {
      await createEssay(baseInput);
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

function handleTextareaFocus() {
  // iOS Safari sometimes leaves the focused field under the keyboard;
  // nudge it into view.
  nextTick(() => {
    textareaRef.value?.scrollIntoView({ block: 'nearest' });
  });
}
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="isOpen"
        class="fixed inset-0 z-50 flex sm:items-center sm:justify-center sm:p-6 lg:p-10 sm:bg-black/60 sm:backdrop-blur-sm"
        @keydown="handleKeydown"
        @click.self="emit('close')"
      >
      <div
        class="flex flex-col bg-mono-950 w-full h-[100dvh] max-h-[100dvh] sm:h-[calc(100dvh-3rem)] sm:max-h-[calc(100dvh-3rem)] sm:max-w-4xl sm:rounded-lg sm:border sm:border-mono-800 overflow-hidden"
      >
        <!-- Top bar — Cancel left, Publish right (always above keyboard) -->
        <div class="shrink-0 flex items-center justify-between gap-3 px-4 py-2.5 border-b border-mono-800 bg-mono-900/95 backdrop-blur supports-[backdrop-filter]:bg-mono-900/85">
          <button
            type="button"
            @click="emit('close')"
            class="px-3 py-1.5 text-mono-300 hover:text-mono-100 text-sm transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <span class="font-mono text-[10.5px] text-mono-500 hidden sm:inline tracking-[0.06em]">
            {{ isEditMode ? 'Editing essay' : 'New essay' }}
          </span>
          <button
            type="button"
            @click="handleSubmit"
            :disabled="!canSubmit"
            class="py-1.5 px-4 bg-essay border-none rounded-md font-body text-xs font-semibold text-black cursor-pointer transition-colors hover:bg-essay-bright disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {{ isEditMode ? 'Publish New Version' : 'Publish' }}
          </button>
        </div>

        <!-- Action row — embed insert chips + char count -->
        <div class="shrink-0 flex items-center gap-2 px-4 py-2 border-b border-mono-800 bg-mono-900/95 backdrop-blur supports-[backdrop-filter]:bg-mono-900/85 overflow-x-auto">
          <button
            type="button"
            @click="openSheet('quote')"
            class="flex items-center gap-1.5 px-3 py-1.5 bg-mono-800 hover:bg-mono-700 border border-mono-700 hover:border-mono-600 rounded-md font-body text-xs text-mono-200 cursor-pointer transition-colors shrink-0"
          >
            <span class="text-mono-400">＋</span> Quote
          </button>
          <button
            type="button"
            @click="openSheet('book')"
            class="flex items-center gap-1.5 px-3 py-1.5 bg-mono-800 hover:bg-mono-700 border border-mono-700 hover:border-mono-600 rounded-md font-body text-xs text-mono-200 cursor-pointer transition-colors shrink-0"
          >
            <span class="text-mono-400">＋</span> Book
          </button>
          <button
            type="button"
            @click="insertHeader"
            class="flex items-center gap-1.5 px-3 py-1.5 bg-mono-800 hover:bg-mono-700 border border-mono-700 hover:border-mono-600 rounded-md font-body text-xs text-mono-200 cursor-pointer transition-colors shrink-0"
          >
            <span class="text-mono-400 font-mono">＃</span> Header
          </button>
          <span
            class="ml-auto font-mono text-[10.5px] tracking-[0.03em] shrink-0 tabular-nums"
            :class="charCount > MAX_CHARS ? 'text-red-400' : 'text-mono-500'"
          >
            {{ charCount.toLocaleString() }} / {{ MAX_CHARS.toLocaleString() }}
          </span>
        </div>

        <!-- Format row — wrap selection with markdown delimiters -->
        <div class="shrink-0 flex items-center gap-2 px-4 py-1.5 border-b border-mono-800 bg-mono-900/95 backdrop-blur supports-[backdrop-filter]:bg-mono-900/85 overflow-x-auto">
          <button
            type="button"
            @click="wrapSelection('**', '**')"
            title="Bold (**text**)"
            class="px-2.5 py-1 bg-mono-800 hover:bg-mono-700 border border-mono-700 hover:border-mono-600 rounded-md font-mono text-xs font-bold text-mono-200 cursor-pointer transition-colors shrink-0"
          >
            B
          </button>
          <button
            type="button"
            @click="wrapSelection('*', '*')"
            title="Italics (*text*)"
            class="px-2.5 py-1 bg-mono-800 hover:bg-mono-700 border border-mono-700 hover:border-mono-600 rounded-md font-mono text-xs italic text-mono-200 cursor-pointer transition-colors shrink-0"
          >
            I
          </button>
          <button
            type="button"
            @click="wrapSelection('&lt;', '&gt;')"
            title="Underline (&lt;text&gt;)"
            class="px-2.5 py-1 bg-mono-800 hover:bg-mono-700 border border-mono-700 hover:border-mono-600 rounded-md font-mono text-xs text-mono-200 cursor-pointer transition-colors shrink-0"
            style="text-decoration: underline; text-decoration-color: rgba(232, 200, 130, 0.85); text-underline-offset: 2px; text-decoration-thickness: 1.5px;"
          >
            U
          </button>
          <button
            type="button"
            @click="wrapSelection('{', '}')"
            title="Highlight ({text})"
            class="px-2.5 py-1 bg-mono-800 hover:bg-mono-700 border border-mono-700 hover:border-mono-600 rounded-md font-mono text-xs cursor-pointer transition-colors shrink-0"
            style="color: #e8d0a8;"
          >
            H
          </button>
        </div>

        <!-- Writing area: single textarea, fills remaining height -->
        <div class="flex-1 min-h-0 flex flex-col overflow-hidden">
          <textarea
            ref="textareaRef"
            v-model="content"
            @focus="handleTextareaFocus"
            placeholder="Begin writing… `# Header` for a section title. Ctrl+Enter to publish."
            class="flex-1 min-h-0 w-full bg-transparent border-none outline-none resize-none font-body text-base sm:text-[15px] leading-[1.55] text-mono-100 placeholder:text-mono-600 px-5 py-4"
            style="text-wrap: pretty; font-kerning: normal; font-variant-ligatures: common-ligatures; font-variant-numeric: oldstyle-nums;"
          ></textarea>
        </div>

        <!-- Footer: tags only -->
        <div
          class="shrink-0 flex items-center gap-1.5 px-4 py-2 bg-mono-800 border-t border-mono-700 overflow-x-auto"
          style="padding-bottom: max(0.5rem, env(safe-area-inset-bottom));"
        >
          <span
            v-for="tag in tags"
            :key="tag"
            class="inline-flex items-center py-0.5 px-2 bg-mono-700 rounded-sm font-mono text-[10px] text-mono-300 whitespace-nowrap shrink-0"
          >
            #{{ tag }}
          </span>
          <input
            v-model="tagInput"
            @keydown="handleTagKeydown"
            placeholder="add tag…"
            class="py-1 px-2 bg-transparent border-none font-mono text-[10px] text-mono-200 outline-none min-w-[100px] flex-1 placeholder:text-mono-500"
          />
          <span class="font-mono text-[10px] text-mono-500 hidden sm:inline shrink-0">Ctrl+Enter</span>
        </div>

        <!-- Embed picker sheet -->
        <EssayEmbedSheet
          :is-open="sheetOpen"
          :initial-kind="sheetInitialKind"
          @close="sheetOpen = false"
          @select="handleEmbedSelect"
        />
      </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
