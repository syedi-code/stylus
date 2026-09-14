<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import {
  createEssay,
  uploadEssayImage,
  getFileUrl,
  type Essay,
  type EssayInput,
  type EssayReferenceInput,
} from '../../lib/api';
import { useEssayDraft } from '../../composables/useEssayDraft';
import { useSourceLibrary } from '../../composables/useSourceLibrary';
import { useKeyboardAnchor } from '../../composables/useKeyboardAnchor';
import EssayEmbedSheet from './EssayEmbedSheet.vue';
import EssayBlockEditor from './EssayBlockEditor.vue';
import EssayDeckRail from './EssayDeckRail.vue';
import { essayName, essayWordCount } from '../../lib/essayDisplay';

const props = defineProps<{
  isOpen: boolean;
  essay?: Essay | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'saved'): void;
  (e: 'present', essay: Essay): void;
}>();

const content = ref('');
const tagInput = ref('');
const tags = ref<string[]>([]);
const submitting = ref(false);
const editorRef = ref<InstanceType<typeof EssayBlockEditor> | null>(null);
const { ensureLoaded, registerImage } = useSourceLibrary();

/**
 * Deck readout. The essay's own name (its first section header, or the opening
 * words in italic when it has none — `essayName`), then the three numbers that
 * describe the piece: slides, words, sources.
 *
 * Slides, not a word target: across the corpus the median essay is four blocks
 * and ~133 words, so a progress bar toward any prose goal would sit permanently
 * near-empty. The hard character limit stays — that one is a real constraint,
 * not an aspiration.
 */
const name = computed(() => essayName(content.value));
const blockCount = computed(() => editorRef.value?.blocks?.length ?? 0);
const wordCount = computed(() => essayWordCount(content.value));
const sourceCount = computed(
	() => (content.value.match(/\[\[(?:quote|book|image):/g) ?? []).length
);

const sheetOpen = ref(false);
const sheetInitialKind = ref<'quote' | 'book'>('quote');
const showTags = ref(false);
const { keyboardOffset } = useKeyboardAnchor();

// Present the LIVE draft — build an essay from the current content so an
// unsaved quote/book/image shows immediately. References are left empty; the
// presentation deck resolves those tokens client-side via the shared source
// library (useEssaySlides fallback). Handled by the parent.
function handlePresent() {
  const base = props.essay;
  emit('present', {
    id: base?.id ?? '',
    content: content.value,
    posted: base?.posted ?? false,
    tags: [...tags.value],
    replaces: base?.replaces,
    source: base?.source ?? '',
    created_at: base?.created_at ?? '',
    updated_at: base?.updated_at ?? '',
    references: [],
    version: base?.version,
  } as Essay);
}

const imageFileInput = ref<HTMLInputElement | null>(null);
const imageUploading = ref(false);

// Backdrop close: only when both press AND release happened on the backdrop
// itself. Prevents drag-select inside the textarea (release lands on the
// backdrop) from being interpreted as an "intent to dismiss".
const mouseDownOnBackdrop = ref(false);
function onBackdropMouseDown(e: MouseEvent) {
  if (e.target === e.currentTarget) mouseDownOnBackdrop.value = true;
}
function onBackdropMouseUp(e: MouseEvent) {
  if (mouseDownOnBackdrop.value && e.target === e.currentTarget) {
    emit('close');
  }
  mouseDownOnBackdrop.value = false;
}

// Scope getter: per-essay slot when editing, single global slot when new.
const draft = useEssayDraft(() =>
  props.essay ? { kind: 'edit', id: props.essay.id } : undefined
);
const { draftContent, draftTags, restore: restoreDraft, clearDraft } = draft;

const isEditMode = computed(() => !!props.essay);

watch(() => props.isOpen, (open) => {
  if (open) {
    showTags.value = false;
    restoreDraft();
    if (props.essay) {
      // Prefer cached draft (from a previous accidental close); fall back to
      // the live server content + tags if no draft exists.
      content.value =
        draftContent.value !== '' ? draftContent.value : props.essay.content;
      tags.value =
        draftTags.value.length > 0
          ? [...draftTags.value]
          : [...(props.essay.tags || [])];
      // Seed image URLs from the essay's already-resolved references so
      // [[image:UUID]] blocks render immediately (the server won't re-derive
      // them until save).
      for (const r of props.essay.references) {
        if (r.entity_type === 'image' && r.image_url) {
          registerImage(r.entity_id, resolveRefImageUrl(r.image_url));
        }
      }
    } else {
      content.value = draftContent.value;
      tags.value = [...draftTags.value];
      tagInput.value = '';
    }
    // Quotes / books resolve their display text via the shared library.
    // Force-refresh so foils reflect quote edits made since the last load.
    ensureLoaded(true);
  }
});

function resolveRefImageUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return getFileUrl(url.replace(/^\/files\//, ''));
}

// Mirror local refs into the draft regardless of mode — accidental closes
// (drag-out, backdrop click) shouldn't destroy in-flight work.
watch(content, (v) => { draftContent.value = v; });
watch(tags, (v) => { draftTags.value = [...v]; }, { deep: true });

const charCount = computed(() => content.value.length);
const MAX_CHARS = 20000;

const canSubmit = computed(() =>
  content.value.trim().length > 0 &&
  charCount.value <= MAX_CHARS &&
  !submitting.value
);

// ─── Insertion — the block editor owns the array; the modal just drives it ───
function openSheet(kind: 'quote' | 'book') {
  sheetInitialKind.value = kind;
  sheetOpen.value = true;
}

function handleEmbedSelect(ref: EssayReferenceInput) {
  const kind = ref.entity_type === 'quote' ? 'quote' : 'book';
  editorRef.value?.insertEmbed(kind, ref.entity_id);
}

function insertHeader() {
  editorRef.value?.insertHeaderBlock();
}

// The block editor's ＋ Add-block picker (and foil "replace") ask the modal to
// raise the right source UI.
function handleRequestInsert(kind: 'quote' | 'book' | 'image') {
  if (kind === 'image') triggerImageUpload();
  else openSheet(kind);
}

// Image upload: mint the id client-side, insert the image block immediately,
// upload, then register the resolved URL so the block resolves. On failure,
// strip the token so the author isn't left with a dead embed.
function triggerImageUpload() {
  imageFileInput.value?.click();
}

async function handleImageSelected(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = ''; // allow re-uploading same file later
  if (!file) return;

  const id = crypto.randomUUID();
  editorRef.value?.insertEmbed('image', id);

  imageUploading.value = true;
  try {
    const res = await uploadEssayImage(file, { id });
    registerImage(id, res.url);
  } catch (err) {
    console.error('Failed to upload essay image:', err);
    content.value = content.value.replace(`[[image:${id}]]`, '').replace(/\n{3,}/g, '\n\n').trim();
  } finally {
    imageUploading.value = false;
  }
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
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="isOpen"
        class="fixed inset-0 z-50 flex sm:items-center sm:justify-center sm:p-6 lg:p-10 sm:bg-black/60 sm:backdrop-blur-sm"
        @keydown="handleKeydown"
        @mousedown="onBackdropMouseDown"
        @mouseup="onBackdropMouseUp"
      >
      <div
        class="writing-room flex flex-col w-full h-[100dvh] max-h-[100dvh] sm:h-[calc(100dvh-3rem)] sm:max-h-[calc(100dvh-3rem)] sm:max-w-4xl sm:rounded-2xl overflow-hidden"
      >
        <!-- Chrome. The safe-area inset is carried HERE, by the container,
             and never by one of the fixed-height rows inside it: with
             `box-sizing: border-box` a 47px notch inset eats a short row
             whole and slices the controls in it. -->
        <div class="edchrome shrink-0">
        <EssayDeckRail
          :blocks="editorRef?.blocks ?? []"
          :active-bid="editorRef?.activeBid ?? null"
          @jump="(bid) => editorRef?.goToBlock(bid)"
        />
        <!-- Top bar — Close left; tags / present / save right. -->
        <div class="edtop flex items-center justify-between gap-2 px-3 py-2">
          <button type="button" @click="emit('close')" class="wr-btn">‹ Close</button>

          <!-- The deck's own identity vocabulary, from EssaySlide /
               EssayHeaderSlide: an ESSAY chip, then the piece's name in
               italic semibold amber. -->
          <div class="ednm min-w-0 flex items-center gap-1.5">
            <span class="edbadge">essay</span>
            <span class="sep">·</span>
            <span class="t truncate" :class="{ untitled: name.untitled }">{{ name.name }}</span>
          </div>
          <div class="relative flex items-center gap-2">
            <button type="button" class="itg" :class="{ on: tags.length }" title="Tags" @click="showTags = !showTags">#</button>
            <button v-if="content.trim().length > 0" type="button" class="itg" title="Present" @click="handlePresent" aria-label="Present essay">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
            </button>
            <button
              type="button"
              @click="handleSubmit"
              :disabled="!canSubmit"
              class="wr-btn gold icon"
              :title="isEditMode ? 'Save' : 'Publish'"
              :aria-label="isEditMode ? 'Save' : 'Publish'"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
            </button>

            <!-- Tags popover -->
            <div v-if="showTags" class="tagpop">
              <div class="tp-chips">
                <span v-for="tag in tags" :key="tag" class="tp-chip">
                  #{{ tag }}
                  <button type="button" class="tp-x" @click="tags = tags.filter((t) => t !== tag)">×</button>
                </span>
                <span v-if="!tags.length" class="tp-empty">No tags yet</span>
              </div>
              <input
                v-model="tagInput"
                @keydown="handleTagKeydown"
                placeholder="add tag…"
                class="tp-input"
              />
            </div>
          </div>
        </div>

        <!-- Toolbar — insert tiles. Ordered by what actually gets inserted:
             across the corpus, 84 quotes and 43 books against 6 images and
             ZERO section headers. Header used to sit first, nearest the
             thumb, for a block type no essay has ever contained; it moves
             last. Formatting lives on the bottom bar (thumb-reachable and
             above the keyboard). -->
        <div class="wr-tools flex items-center gap-1.5 px-3 py-1.5 overflow-x-auto">
          <button type="button" @click="openSheet('quote')" class="ttile primary" title="Insert quote"><span class="g">❝</span>Quote</button>
          <button type="button" @click="openSheet('book')" class="ttile" title="Insert book"><span class="g">▤</span>Book</button>
          <button type="button" @click="triggerImageUpload" :disabled="imageUploading" class="ttile" title="Insert image"><span class="g">▦</span>{{ imageUploading ? '…' : 'Image' }}</button>
          <button type="button" @click="insertHeader" class="ttile" title="Section header"><span class="g">＃</span>Header</button>
          <input ref="imageFileInput" type="file" accept="image/jpeg,image/png,image/webp,image/gif" class="hidden" @change="handleImageSelected" />
        </div>

        <!-- Status — the deck, plus the hard character limit. -->
        <div class="wr-status flex items-center gap-2 px-4 pb-1.5 text-[10.5px]">
          <span class="n">{{ blockCount }} {{ blockCount === 1 ? 'slide' : 'slides' }}</span>
          <span class="b"></span>
          <span class="n">{{ wordCount }} {{ wordCount === 1 ? 'word' : 'words' }}</span>
          <span class="b"></span>
          <span class="n">{{ sourceCount === 0 ? 'no sources' : `${sourceCount} ${sourceCount === 1 ? 'source' : 'sources'}` }}</span>
          <span class="ml-auto shrink-0 tabular-nums" :class="charCount > MAX_CHARS ? 'text-red-400' : 'text-mono-700'">
            {{ charCount.toLocaleString() }} / {{ MAX_CHARS.toLocaleString() }}
          </span>
        </div>
        </div><!-- /.edchrome -->

        <!-- Writing area: the block surface, fills remaining height -->
        <div class="wr-scroll flex-1 min-h-0 overflow-y-auto">
          <EssayBlockEditor ref="editorRef" v-model:content="content" @request-insert="handleRequestInsert" />
        </div>

        <!-- Bottom bar: text formatting — thumb-reachable, pinned above the
             soft keyboard on mobile. Acts on the active block's selection. -->
        <div
          class="wr-foot fmtbar shrink-0 flex items-center gap-1 px-4 py-2"
          :style="{
            paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))',
            transform: keyboardOffset ? `translateY(-${keyboardOffset}px)` : undefined,
          }"
        >
          <button type="button" @mousedown.prevent @click="editorRef?.wrapActiveSelection('**', '**')" title="Bold (**text**)" class="fmt font-bold">B</button>
          <button type="button" @mousedown.prevent @click="editorRef?.wrapActiveSelection('*', '*')" title="Italics (*text*)" class="fmt italic">I</button>
          <button type="button" @mousedown.prevent @click="editorRef?.wrapActiveSelection('&lt;', '&gt;')" title="Underline (&lt;text&gt;)" class="fmt" style="text-decoration: underline; text-decoration-color: rgba(232,200,130,0.85); text-underline-offset: 2px; text-decoration-thickness: 1.5px;">U</button>
          <button type="button" @mousedown.prevent @click="editorRef?.wrapActiveSelection('{', '}')" title="Highlight ({text})" class="fmt" style="color:#e8d0a8;">H</button>
          <span class="ml-auto text-[10px] text-mono-600 hidden sm:inline shrink-0">Ctrl+Enter to save</span>
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

/* ── The near-black writing room ── */
.writing-room {
  --gold: var(--color-essay);
  --gold-hi: #f8d38a;
  --ink: #140d03;
  --line: #241d12;
  --ink-bg: #060504;
  background: var(--ink-bg);
  border: 1px solid var(--line);
}
.writing-room.is-focus {
  background: #040302;
}

/* ── Chrome ──
   The container owns the safe-area inset so no fixed-height row inside it
   ever has to. Full-screen on mobile, the modal's top row sat under the
   notch; a row that carried the inset itself would have had its content box
   eaten instead (border-box + a 47px inset against a ~44px row). */
.edchrome {
  padding-top: env(safe-area-inset-top, 0px);
  border-bottom: 1px solid var(--line);
}

/* top bar */
.edtop {
  min-height: 44px;
}

/* The deck's identity, matching EssaySlide's badge row and the italic-amber
   title EssayHeaderSlide gives a piece on the slide itself. */
.ednm {
  flex: 1;
  justify-content: flex-end;
  overflow: hidden;
}
.edbadge {
  flex: 0 0 auto;
  background: var(--color-essay);
  color: var(--color-essay-text);
  font-size: 9.5px;
  font-weight: 700;
  line-height: 1.5;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 1px 5px;
}
.ednm .sep {
  flex: 0 0 auto;
  color: var(--color-mono-600);
  font-size: 11px;
}
.ednm .t {
  font-size: 12.5px;
  font-style: italic;
  font-weight: 600;
  color: var(--color-essay);
  letter-spacing: -0.005em;
}
.ednm .t.untitled {
  font-weight: 400;
  color: var(--color-mono-500);
}

/* Status line — slides · words · sources, then the hard character limit. */
.wr-status {
  color: var(--color-mono-600);
  font-variant-numeric: lining-nums;
}
.wr-status .n {
  color: var(--color-mono-500);
}
.wr-status .b {
  width: 2.5px;
  height: 2.5px;
  border-radius: 50%;
  background: var(--color-mono-700);
  flex: 0 0 auto;
}
.edtop .mid {
  font-size: 13px;
  color: var(--color-mono-300);
}
.edtop .mid .nm {
  color: var(--color-mono-200);
}
.edtop .sv {
  font-size: 11px;
  color: var(--color-mono-600);
  font-style: italic;
}

.wr-btn {
  padding: 6px 13px;
  border-radius: 999px;
  font-size: 12.5px;
  background: var(--color-mono-800);
  border: 1px solid var(--line);
  color: var(--color-mono-200);
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s, background 0.15s;
  white-space: nowrap;
}
.wr-btn:hover {
  border-color: var(--color-mono-600);
  color: var(--color-mono-50);
}
.wr-btn.gold {
  background: var(--gold);
  color: var(--ink);
  border-color: transparent;
  font-weight: 600;
  box-shadow: inset 0 1px 0 rgba(255, 245, 220, 0.5);
}
.wr-btn.gold:hover {
  background: var(--gold-hi);
}
.wr-btn.gold:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.wr-btn.icon {
  padding: 7px 10px;
  display: grid;
  place-items: center;
}

.itg {
  width: 34px;
  height: 34px;
  border-radius: 11px;
  display: grid;
  place-items: center;
  background: var(--color-mono-900);
  border: 1px solid var(--line);
  color: var(--color-mono-400);
  cursor: pointer;
  font-size: 15px;
  transition: color 0.15s, border-color 0.15s;
}
.itg:hover {
  color: var(--gold);
  border-color: var(--gold);
}
.itg.ghost {
  background: transparent;
  border-color: transparent;
}
.itg.on {
  color: var(--gold);
  border-color: var(--gold);
}

/* tags popover */
.tagpop {
  position: absolute;
  top: 42px;
  right: 0;
  z-index: 30;
  width: 230px;
  background: #0d0b08;
  border: 1px solid var(--line);
  border-radius: 13px;
  padding: 11px 12px;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.6);
}
.tp-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-bottom: 9px;
}
.tp-chip {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 4px 2px 7px;
  background: var(--color-mono-800);
  border-radius: 6px;
  font-size: 11px;
  color: var(--color-mono-200);
}
.tp-x {
  border: none;
  background: transparent;
  color: var(--color-mono-500);
  cursor: pointer;
  font-size: 13px;
  line-height: 1;
  padding: 0 2px;
}
.tp-x:hover {
  color: var(--color-rose);
}
.tp-empty {
  font-size: 11px;
  font-style: italic;
  color: var(--color-mono-600);
}
.tp-input {
  width: 100%;
  background: transparent;
  border: none;
  border-top: 1px solid var(--line);
  padding: 8px 2px 2px;
  font-size: 12px;
  color: var(--color-mono-100);
  outline: none;
}
.tp-input::placeholder {
  color: var(--color-mono-600);
}

/* toolbar */
.wr-tools {
  border-bottom: 1px solid var(--line);
}
.ttile {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 12px;
  border-radius: 11px;
  background: var(--color-mono-900);
  border: 1px solid var(--line);
  color: var(--color-mono-200);
  font-size: 12px;
  cursor: pointer;
  flex: 0 0 auto;
  transition: color 0.15s, border-color 0.15s, background 0.15s;
}
.ttile .g {
  font-size: 14px;
  color: var(--color-mono-500);
  line-height: 1;
}
/* Quote is filled because it is the primary insert — 84 of the 133 embeds in
   the corpus are quotes. That is the only difference between the tiles. */
.ttile.primary {
  background: var(--color-essay);
  border-color: var(--color-essay);
  color: var(--color-essay-text);
  font-weight: 600;
  box-shadow: inset 0 1px 0 rgb(255 245 220 / 0.5);
}
.ttile.primary .g {
  color: rgb(20 13 3 / 0.65);
}
.ttile.primary:hover {
  background: var(--color-essay-bright);
  border-color: var(--color-essay-bright);
  color: var(--color-essay-text);
}
.ttile:hover {
  border-color: var(--gold);
  color: var(--gold);
  background: var(--color-mono-800);
}
.ttile:hover .g {
  color: var(--gold);
}
.ttile:disabled {
  opacity: 0.5;
  cursor: wait;
}
.wr-sep {
  width: 1px;
  height: 20px;
  background: var(--line);
  flex: 0 0 auto;
  margin: 0 3px;
}
.fmt {
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  border-radius: 9px;
  background: var(--color-mono-900);
  border: 1px solid var(--line);
  color: var(--color-mono-200);
  font-size: 13px;
  cursor: pointer;
  flex: 0 0 auto;
  transition: border-color 0.15s, background 0.15s;
}
.fmt:hover {
  border-color: var(--color-mono-600);
  background: var(--color-mono-800);
}

/* textarea */
.wr-text {
  line-height: 1.55;
  padding: 18px 20px;
  transition: line-height 0.3s, padding 0.3s;
}
@media (min-width: 640px) {
  .wr-text {
    max-width: 680px;
    width: 100%;
    margin: 0 auto;
    padding: 26px 24px;
  }
}
.is-focus .wr-text {
  line-height: 1.35;
  padding: 28px 22px;
}
@media (min-width: 640px) {
  .is-focus .wr-text {
    padding: 40px 24px;
  }
}

/* footer / tags */
.wr-foot {
  background: #0d0b08;
  border-top: 1px solid var(--line);
}

/* focus chrome */
.fedtop .ftitle {
  font-size: 11px;
  color: var(--color-mono-500);
}
.fbar .wc {
  font-size: 10px;
  color: var(--color-mono-600);
  font-variant-numeric: lining-nums;
  letter-spacing: 0.14em;
}
.ft {
  width: 42px;
  height: 42px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  background: var(--color-mono-900);
  border: 1px solid var(--line);
  color: var(--color-mono-400);
  font-size: 16px;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
}
.ft:hover {
  color: var(--gold);
  border-color: var(--gold);
}
.ft.done {
  background: var(--gold);
  color: var(--ink);
  border: none;
  font-weight: 700;
  font-size: 13px;
  width: auto;
  padding: 0 18px;
  box-shadow: inset 0 1px 0 rgba(255, 245, 220, 0.5);
}
</style>
