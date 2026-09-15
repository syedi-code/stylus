<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import {
  createEssay,
  uploadEssayImage,
  getFileUrl,
  type Essay,
  type EssayInput,
  type EssayReferenceInput,
} from '../../../lib/api';
import { useEssayDraft } from '../../../composables/useEssayDraft';
import { useSourceLibrary } from '../../../composables/useSourceLibrary';
import { useKeyboardAnchor } from '../../../composables/useKeyboardAnchor';
import EssayEmbedSheet from '../EssayEmbedSheet.vue';
import EssayBlockEditor from '../EssayBlockEditor.vue';
import EssayDeckRail from '../EssayDeckRail.vue';
import { essayName, essayWordCount } from '../../../lib/essayDisplay';

const props = defineProps<{
  isOpen: boolean;
  essay?: Essay | null;
  /** Rendered as the Essays tab itself rather than inside a modal: it fills
   *  the tab area instead of the viewport, and there is nothing to close to. */
  inline?: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'saved'): void;
  (e: 'present', essay: Essay): void;
  /** Live content, so the spine can outline what is being written rather
   *  than what was last saved. */
  (e: 'content', content: string): void;
}>();

const content = ref('');
const tagInput = ref('');
const tags = ref<string[]>([]);
const submitting = ref(false);
const editorRef = ref<InstanceType<typeof EssayBlockEditor> | null>(null);
const { ensureLoaded, registerImage, quotes } = useSourceLibrary();

/**
 * Writing mode. On a phone the keyboard already takes half the screen; the
 * chrome above the manuscript takes another slice for information you are not
 * reading while mid-sentence. So it retracts on a keystroke and comes back the
 * moment you stop, scroll, or tap.
 *
 * It COLLAPSES rather than sliding away: a transform would leave its height
 * reserved and blank, which is the mystery gap above the first paragraph.
 */
const writing = ref(false);
let writingTimer = 0;
function onTyping() {
	writing.value = true;
	clearTimeout(writingTimer);
	writingTimer = window.setTimeout(() => (writing.value = false), 2600);
}
function stopWriting() {
	clearTimeout(writingTimer);
	writing.value = false;
}

/**
 * Recent quotes, as one-tap chips on the insert rail. Re-citing something you
 * just used is constant in this corpus — 84 quotes across 49 essays, many of
 * them several from the same book in a row — and it was a four-step trip
 * through the embed sheet every time.
 */
const recentQuotes = computed(() => quotes.value.slice(0, 2));

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

/** Re-cite a recent quote straight from the rail, no sheet. */
function insertRecentQuote(id: string) {
  editorRef.value?.insertEmbed('quote', id, {});
}

const sheetOpen = ref(false);
const sheetInitialKind = ref<'quote' | 'book'>('quote');
const showTags = ref(false);

/** The spine is docked on a wide screen and a drawer behind the hamburger
 *  below that — see the media queries on .spine-dock. */
const spineOpen = ref(false);
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

// Scope getter: per-essay slot when editing, single global slot when new.
const draft = useEssayDraft(() =>
  props.essay ? { kind: 'edit', id: props.essay.id } : undefined
);
const { draftContent, draftTags, restore: restoreDraft, clearDraft } = draft;

const isEditMode = computed(() => !!props.essay);

// Re-seeds on open AND whenever the piece changes — switching pieces in the
// spine is now as common as opening the room at all.
watch(() => [props.isOpen, props.essay?.id ?? '__new__'], ([open]) => {
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
  // IMMEDIATE, because the room is now mounted already-open as the Essays tab.
  // Keyed on isOpen alone it never fired inline — nothing seeded the content
  // and nothing loaded the source library, so the tab rendered blank.
}, { immediate: true });

function resolveRefImageUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return getFileUrl(url.replace(/^\/files\//, ''));
}

// Mirror local refs into the draft regardless of mode — accidental closes
// (drag-out, backdrop click) shouldn't destroy in-flight work.
watch(content, (v) => {
  draftContent.value = v;
  emit('content', v);
}, { immediate: true });
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

/** The spine's outline jumps through here into the block editor. */
function goToBlock(bid: string) {
  editorRef.value?.goToBlock?.(bid);
}

defineExpose({ goToBlock });
</script>

<template>
  <div class="room-layout flex" :class="inline ? 'is-inline' : 'is-modal'" @keydown="handleKeydown">
    <!-- The spine. Docked wide, a drawer under the hamburger below that. -->
    <aside class="spine-dock" :class="{ open: spineOpen }">
      <slot name="spine" />
    </aside>
    <div v-if="spineOpen" class="spine-scrim" @click="spineOpen = false"></div>

      <div class="writing-room flex flex-col min-w-0 flex-1 overflow-hidden">
        <!-- Chrome. The safe-area inset is carried HERE, by the container,
             and never by one of the fixed-height rows inside it: with
             `box-sizing: border-box` a 47px notch inset eats a short row
             whole and slices the controls in it. -->
        <div class="edchrome shrink-0" :class="{ writing }">
        <EssayDeckRail
          :blocks="editorRef?.blocks ?? []"
          :active-bid="editorRef?.activeBid ?? null"
          @jump="(bid) => editorRef?.goToBlock(bid)"
        />
        <!-- Top bar — Close left; tags / present / save right. -->
        <div class="edtop flex items-center justify-between gap-2 px-3 py-2">
          <button type="button" class="burger" :title="inline ? 'Pieces' : 'Back'" @click="spineOpen = !spineOpen">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16M4 12h11M4 18h7" /></svg>
          </button>
          <button v-if="!inline" type="button" @click="emit('close')" class="wr-btn">‹ Close</button>

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
        <div class="wr-scroll flex-1 min-h-0 overflow-y-auto" @scroll.passive="stopWriting" @click="stopWriting">
          <EssayBlockEditor
            ref="editorRef"
            v-model:content="content"
            @request-insert="handleRequestInsert"
            @typing="onTyping"
          />
        </div>

        <!-- Bottom rail: INSERT first, then formatting.
             Inserting is the frequent act and it lives where the thumb is —
             the tiles used to sit at the top of the modal, the furthest point
             from both thumb and caret on a phone, which is where most of this
             writing happens. Ordered by the corpus: 84 quotes and 43 books
             against 6 images and zero section headers. -->
        <div
          class="wr-foot fmtbar shrink-0 flex items-center gap-1.5 px-3 py-2"
          :style="{
            paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))',
            transform: keyboardOffset ? `translateY(-${keyboardOffset}px)` : undefined,
          }"
        >
          <div class="pills flex items-center gap-1.5 overflow-x-auto">
            <button type="button" @click="openSheet('quote')" class="pill primary" title="Insert quote"><span class="g">❝</span>Quote</button>
            <button type="button" @click="openSheet('book')" class="pill" title="Insert book"><span class="g">▤</span>Book</button>
            <!-- One tap to re-cite something recent. -->
            <button
              v-for="q in recentQuotes"
              :key="q.id"
              type="button"
              class="pill recent"
              :title="q.quote"
              @click="insertRecentQuote(q.id)"
            >
              <span class="g">❝</span><span class="rq">{{ q.quote.slice(0, 26) }}…</span>
            </button>
            <button type="button" @click="triggerImageUpload" :disabled="imageUploading" class="pill" title="Insert image"><span class="g">▦</span>{{ imageUploading ? '…' : 'Image' }}</button>
            <button type="button" @click="insertHeader" class="pill" title="Section header"><span class="g">＃</span>Header</button>
            <input ref="imageFileInput" type="file" accept="image/jpeg,image/png,image/webp,image/gif" class="hidden" @change="handleImageSelected" />
          </div>

          <div class="fmt flex items-center gap-1 shrink-0">
            <button type="button" @mousedown.prevent @click="editorRef?.wrapActiveSelection('**', '**')" title="Bold (**text**)" class="fmt-b font-bold">B</button>
            <button type="button" @mousedown.prevent @click="editorRef?.wrapActiveSelection('*', '*')" title="Italics (*text*)" class="fmt-b italic">I</button>
            <button type="button" @mousedown.prevent @click="editorRef?.wrapActiveSelection('&lt;', '&gt;')" title="Underline (&lt;text&gt;)" class="fmt-b" style="text-decoration: underline; text-decoration-color: rgba(232,200,130,0.85); text-underline-offset: 2px; text-decoration-thickness: 1.5px;">U</button>
            <button type="button" @mousedown.prevent @click="editorRef?.wrapActiveSelection('{', '}')" title="Highlight ({text})" class="fmt-b" style="color:#e8d0a8;">H</button>
          </div>
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
</template>

<style scoped>
/* ── Layout: spine + manuscript ── */
.room-layout {
  min-height: 0;
}
.room-layout.is-inline {
  height: 100%;
}
.room-layout.is-modal {
  width: 100%;
  height: 100dvh;
  max-height: 100dvh;
}
@media (min-width: 640px) {
  .room-layout.is-modal {
    height: calc(100dvh - 3rem);
    max-height: calc(100dvh - 3rem);
    max-width: 72rem;
    border-radius: 1rem;
    overflow: hidden;
  }
}

.spine-dock {
  display: none;
  flex: 0 0 258px;
  min-height: 0;
}
/* Docked only when there is room for it beside a full measure of prose. */
@media (min-width: 1100px) {
  .spine-dock {
    display: block;
  }
}
/* Below that it is a drawer, opened by the hamburger. */
@media (max-width: 1099px) {
  .spine-dock.open {
    display: block;
    position: fixed;
    left: 0;
    top: 0;
    bottom: 0;
    width: 290px;
    z-index: 60;
    box-shadow: 30px 0 70px rgb(0 0 0 / 0.7);
    padding-top: env(safe-area-inset-top, 0px);
  }
}
.spine-scrim {
  position: fixed;
  inset: 0;
  z-index: 55;
  background: rgb(0 0 0 / 0.6);
}
@media (min-width: 1100px) {
  .spine-scrim {
    display: none;
  }
}

.burger {
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  border: none;
  background: transparent;
  color: var(--color-mono-400);
  border-radius: 9px;
  cursor: pointer;
}
.burger svg {
  width: 17px;
  height: 17px;
}
.burger:hover {
  background: var(--color-mono-800);
  color: var(--color-essay);
}
@media (min-width: 1100px) {
  /* Docked — the hamburger has nothing to open. */
  .room-layout.is-inline .burger {
    display: none;
  }
}

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
  /* Collapses while writing — max-height, not transform, so the space it was
     holding goes back to the manuscript instead of sitting blank. */
  overflow: hidden;
  max-height: 200px;
  transition: max-height 0.28s cubic-bezier(0.3, 0.8, 0.3, 1), opacity 0.2s ease;
}
.edchrome.writing {
  max-height: 0;
  opacity: 0;
  pointer-events: none;
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
/* ── The insert rail ──
   Every insert affordance is the same shape: glyph + label in a pill. Quote is
   filled because it is primary; that is the only difference between them. */
.pills {
  flex: 1;
  min-width: 0;
  scrollbar-width: none;
  /* The row scrolls, so the last pill fades under the formatting cluster
     rather than being guillotined by its edge. */
  -webkit-mask-image: linear-gradient(90deg, #000 calc(100% - 22px), transparent);
  mask-image: linear-gradient(90deg, #000 calc(100% - 22px), transparent);
}
.pills::-webkit-scrollbar {
  display: none;
}
.pill {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  flex: 0 0 auto;
  padding: 9px 14px;
  border-radius: 999px;
  cursor: pointer;
  font: inherit;
  font-size: 12.5px;
  line-height: 1;
  background: transparent;
  border: 1px solid var(--line);
  color: var(--color-mono-300);
  transition: border-color 0.15s, color 0.15s, background 0.15s;
}
.pill .g {
  font-size: 14px;
  line-height: 0;
  position: relative;
  top: 1px;
  color: var(--color-mono-500);
}
.pill:hover {
  border-color: var(--color-essay);
  color: var(--color-essay);
}
.pill:hover .g {
  color: var(--color-essay);
}
.pill:disabled {
  opacity: 0.5;
  cursor: default;
}
.pill.primary {
  background: var(--color-essay);
  border-color: var(--color-essay);
  color: var(--color-essay-text);
  font-weight: 600;
  box-shadow: inset 0 1px 0 rgb(255 245 220 / 0.5);
}
.pill.primary .g {
  color: rgb(20 13 3 / 0.65);
}
.pill.primary:hover {
  background: var(--color-essay-bright);
  border-color: var(--color-essay-bright);
  color: var(--color-essay-text);
}
.pill.recent {
  max-width: 190px;
}
.pill.recent .rq {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-style: italic;
  color: var(--color-mono-400);
}
.fmt {
  border-left: 1px solid var(--line);
  padding-left: 7px;
}
.fmt-b {
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  border: none;
  background: transparent;
  color: var(--color-mono-300);
  font-size: 14px;
  border-radius: 8px;
  cursor: pointer;
  font-family: inherit;
}
.fmt-b:hover {
  background: var(--color-mono-800);
  color: var(--color-mono-50);
}

/* Quote is filled because it is the primary insert — 84 of the 133 embeds in
   the corpus are quotes. That is the only difference between the tiles. */
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
