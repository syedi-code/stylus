<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import {
  createEssay,
  updateEssay,
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
import EssayQuoteModal from '../EssayQuoteModal.vue';
import EssayBlockEditor from '../EssayBlockEditor.vue';
import EssayDeckRail from '../EssayDeckRail.vue';
import { essayName, essayWordCount } from '../../../lib/essayDisplay';
import type { QuoteDraft } from '../../../lib/essayWorkspace';
import type { SlashCommandId } from '../../../lib/essaySlash';
import { onHeldInput } from '../../../lib/keyboardKeeper';

const props = defineProps<{
  isOpen: boolean;
  /** Quote and book ids cited across the writer's pieces, newest first. */
  recentIds?: string[];
  essay?: Essay | null;
  /** Rendered as the Essays tab itself rather than inside a modal: it fills
   *  the tab area instead of the viewport, and there is nothing to close to. */
  inline?: boolean;
  /**
   * The writer ASKED for a blank piece, so say so.
   *
   * Not `essay == null` — that is also true for the moment between the tab
   * mounting and the essay list arriving, which is how "New piece" came to be
   * announced over an old essay on every cold load. Absence of a piece is a
   * state the room passes through; starting one is an intent only the caller
   * knows about.
   */
  announceNew?: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  /** `replaced` is the version this save superseded, when it minted a new one. */
  (e: 'saved', essay: Essay, replaced: string | null): void;
  (e: 'present', essay: Essay): void;
  (e: 'new'): void;
  /** Live content, so the spine can outline what is being written rather
   *  than what was last saved. */
  (e: 'content', content: string): void;
}>();

const content = ref('');
const tagInput = ref('');
const tags = ref<string[]>([]);
const submitting = ref(false);
// Save state — read by the seeding watcher below, so declared ahead of it.
const savedContent = ref('');
const savedTags = ref<string[]>([]);
/** The version this sitting minted; later saves update it in place. */
const sittingId = ref<string | null>(null);
/** Ids this room created, so the parent following them is not a new piece. */
const ownIds = new Set<string>();
/** Words written since the piece was opened — the only goal worth showing. */
const sittingStart = ref<number | null>(null);
const editorRef = ref<InstanceType<typeof EssayBlockEditor> | null>(null);
const { ensureLoaded, registerImage } = useSourceLibrary();

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
	clearFlash();
	writing.value = true;
	clearTimeout(writingTimer);
	writingTimer = window.setTimeout(() => (writing.value = false), 2600);
}
function stopWriting() {
	clearTimeout(writingTimer);
	writing.value = false;
}

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
/** A pasted passage handed to the sheet pre-split, rather than retyped. */
const sheetSeed = ref<QuoteDraft | null>(null);
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
    id: headId.value ?? '',
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

/**
 * "A new piece has started."
 *
 * Asking for a new essay produced no visible event at all: the room is always
 * open, so the only difference between "your last piece" and "a blank new one"
 * was that the text went away — which reads as something breaking, not as
 * something starting. Especially on a phone, where the button that did it is
 * at the opposite end of the screen from the title that changed.
 *
 * So: a banner that names what happened, and the caret already in the first
 * line. It clears itself, and any keystroke clears it sooner.
 */
const startedNew = ref(false);
let startedTimer = 0;
function flashNewPiece() {
	startedNew.value = true;
	clearTimeout(startedTimer);
	startedTimer = window.setTimeout(() => (startedNew.value = false), 3200);
}
function clearFlash() {
	if (!startedNew.value) return;
	clearTimeout(startedTimer);
	startedNew.value = false;
}

// Re-seeds on open AND whenever the piece changes — switching pieces in the
// spine is now as common as opening the room at all.
watch(() => [props.isOpen, props.essay?.id ?? '__new__'], ([open, id]) => {
  // The parent following this room's own save to the version it minted is
  // the same piece, mid-sentence. Re-seeding here reverted whatever was typed
  // during the round trip.
  if (ownIds.has(id as string)) return;
  if (open) {
    sittingId.value = null;
    ownIds.clear();
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
      savedContent.value = props.essay.content;
      savedTags.value = [...(props.essay.tags || [])];
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
      savedContent.value = '';
      savedTags.value = [];
      // A restored draft is resumed work, not a new piece, and saying "new"
      // over it would be a lie.
      if (props.announceNew && !draftContent.value.trim()) flashNewPiece();
    }
    sittingStart.value = essayWordCount(content.value);
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
/** The ceiling is worth a row only once it is in sight. */
const nearLimit = computed(() => charCount.value > MAX_CHARS * 0.8);

/**
 * THE SAVE MODEL: one version per sitting, and it saves itself.
 *
 * Saving was a button, and every press minted a new version row (`replaces`
 * the last) — so "is this saved?" was answered by remembering to press it.
 * Worse, the new version has a new id and the tab kept looking for the old
 * one: saving an edit dropped you out of the piece you had just saved.
 *
 * Now the first save of a sitting mints the version, exactly as before, and
 * every save after it PATCHes that row in place. alexandria re-derives
 * references from the tokens on PATCH as it does on POST, so the two differ
 * only in the version count.
 */
const saving = ref(false);
const saveError = ref<string | null>(null);
const lastSavedAt = ref<number | null>(null);
const justSaved = ref(false);
let savedTimer = 0;
let autosaveTimer = 0;
let queued = false;
let cancelled = false;

const headId = computed(() => sittingId.value ?? props.essay?.id ?? null);
const isEditMode = computed(() => headId.value !== null);

const sameTags = (a: string[], b: string[]) => a.length === b.length && a.every((t, i) => t === b[i]);
const dirty = computed(
  () => content.value.trim() !== savedContent.value.trim() || !sameTags(tags.value, savedTags.value)
);

const canSubmit = computed(() =>
  content.value.trim().length > 0 &&
  charCount.value <= MAX_CHARS &&
  !submitting.value
);

/**
 * A blank new piece is not saved for its first stray keystroke — a piece
 * abandoned after "The" should not appear in the spine. Three words or one
 * source is a piece.
 */
const worthSaving = computed(
  () => isEditMode.value || wordCount.value >= 3 || sourceCount.value > 0
);

// ─── Insertion — the block editor owns the array; the modal just drives it ───
/** Quotes open the centred modal; books keep the picker sheet. */
const quoteModalOpen = ref(false);
function openSheet(kind: 'quote' | 'book', seed?: QuoteDraft) {
  sheetSeed.value = seed ?? null;
  if (kind === 'quote') {
    quoteModalOpen.value = true;
    return;
  }
  sheetInitialKind.value = kind;
  sheetOpen.value = true;
}

function closeQuoteModal() {
  quoteModalOpen.value = false;
  editorRef.value?.cancelInsert();
}
function closeSheet() {
  sheetOpen.value = false;
  editorRef.value?.cancelInsert();
}

function handleEmbedSelect(ref: EssayReferenceInput) {
  const kind = ref.entity_type === 'quote' ? 'quote' : 'book';
  editorRef.value?.insertEmbed(kind, ref.entity_id);
}

// The block editor's ＋ Add-block picker (and foil "replace") ask the modal to
// raise the right source UI.
function handleRequestInsert(kind: 'quote' | 'book' | 'image', seed?: QuoteDraft) {
  if (kind === 'image') triggerImageUpload();
  else openSheet(kind, seed);
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

async function save(): Promise<void> {
  clearTimeout(autosaveTimer);
  if (cancelled || !dirty.value || content.value.trim().length === 0 || charCount.value > MAX_CHARS) return;
  if (saving.value) {
    queued = true;
    return;
  }
  const snapshot = content.value;
  const snapshotTags = [...tags.value];
  saving.value = true;
  submitting.value = true;
  try {
    // References are derived server-side from content tokens; the worker
    // ignores anything we send. Pass empty so the API contract is satisfied.
    const input: EssayInput = {
      content: snapshot,
      tags: snapshotTags.length ? snapshotTags : undefined,
      references: [],
    };
    let saved: Essay;
    let replaced: string | null = null;
    if (sittingId.value) {
      saved = (await updateEssay(sittingId.value, { content: snapshot, tags: snapshotTags })).essay;
    } else if (props.essay) {
      replaced = props.essay.id;
      saved = (await createEssay({ ...input, replaces: props.essay.id })).essay;
    } else {
      saved = (await createEssay(input)).essay;
    }
    savedContent.value = snapshot;
    savedTags.value = snapshotTags;
    // Nothing typed during the round trip, so the local copy has done its job.
    if (content.value === snapshot) clearDraft();
    if (saved?.id) {
      sittingId.value = saved.id;
      ownIds.add(saved.id);
    }
    saveError.value = null;
    lastSavedAt.value = Date.now();
    justSaved.value = true;
    clearTimeout(savedTimer);
    savedTimer = window.setTimeout(() => (justSaved.value = false), 1400);
    emit('saved', saved, replaced);
  } catch (err: any) {
    console.error('Failed to save essay:', err?.response?.data ?? err);
    // Silence here meant a failed save looked exactly like a good one.
    saveError.value = 'That didn’t save. Your writing is kept on this device — try again.';
  } finally {
    saving.value = false;
    submitting.value = false;
    if (queued) {
      queued = false;
      scheduleSave(400);
    }
  }
}

function scheduleSave(ms = 1600) {
  clearTimeout(autosaveTimer);
  autosaveTimer = window.setTimeout(() => {
    if (worthSaving.value) void save();
  }, ms);
}

watch([content, tags], () => {
  if (dirty.value && !saveError.value) scheduleSave();
}, { deep: true });

/** Leaving the tab or the app is the moment a pending save matters most. */
function flushOnHide() {
  if (document.visibilityState === 'hidden' && dirty.value && worthSaving.value) void save();
}

/** The piece is about to be deleted — saving it now would resurrect it. */
function cancelSaves() {
  cancelled = true;
  clearTimeout(autosaveTimer);
}

const handleSubmit = () => {
  saveError.value = null;
  return save();
};

/** "saved 3m ago", for the status row and the save control's title. */
const now = ref(Date.now());
let clock = 0;
const saveLabel = computed(() => {
  if (saveError.value) return 'not saved';
  if (saving.value) return 'saving…';
  if (dirty.value) return worthSaving.value ? 'unsaved' : 'not saved yet';
  if (!lastSavedAt.value) return isEditMode.value ? 'saved' : '';
  const s = Math.round((now.value - lastSavedAt.value) / 1000);
  if (s < 45) return 'saved just now';
  return `saved ${Math.max(1, Math.round(s / 60))}m ago`;
});

const sittingDelta = computed(() =>
  sittingStart.value === null ? 0 : wordCount.value - sittingStart.value
);

const handleKeydown = (e: KeyboardEvent) => {
  if ((e.ctrlKey || e.metaKey) && (e.key === 'Enter' || e.key.toLowerCase() === 's')) {
    e.preventDefault();
    void handleSubmit();
  }
};

// ─── Focus mode ───
const FOCUS_KEY = 'stylus-essay-focus';
function readFocus() {
  try {
    return localStorage.getItem(FOCUS_KEY) === '1';
  } catch {
    return false;
  }
}
const focusMode = ref(readFocus());
function toggleFocus() {
  focusMode.value = !focusMode.value;
  try {
    localStorage.setItem(FOCUS_KEY, focusMode.value ? '1' : '0');
  } catch {
    // Private browsing: the mode still works, it just isn't remembered.
  }
}

/** The slash menu's verbs that belong to the room rather than the editor. */
function handleCommand(id: SlashCommandId) {
  if (id === 'present') handlePresent();
  else if (id === 'save') void handleSubmit();
  else if (id === 'focus') toggleFocus();
  else if (id === 'new') emit('new');
}

const anyOverlayOpen = computed(() => quoteModalOpen.value || sheetOpen.value || showTags.value);

/**
 * Type to write. With nothing focused, a printable key — or Enter, or the
 * slash — goes into the piece instead of nowhere: the end of the last
 * paragraph, or a new one after the last source. Opening a piece and
 * starting to type is the whole interaction; clicking into it first was a
 * toll.
 */
function onWindowKeydown(e: KeyboardEvent) {
  if (e.defaultPrevented || e.isComposing) return;
  if (anyOverlayOpen.value || spineOpen.value) return;
  const el = document.activeElement as HTMLElement | null;
  // A button or link keeps focus after it is clicked — the Essays tab itself,
  // most often. Letters mean nothing to it; Enter still presses it.
  const onControl = !!el && /^(BUTTON|A)$/.test(el.tagName);
  if (el && el !== document.body && !onControl) {
    if (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
    // A selected source listens for its own keys (delete, escape).
    if (el.closest('.blk')) return;
  }
  if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    if (e.shiftKey) editorRef.value?.redo();
    else editorRef.value?.undo();
    return;
  }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const printable = e.key.length === 1 && e.key !== ' ';
  if (!printable && (e.key !== 'Enter' || onControl)) return;
  e.preventDefault();
  editorRef.value?.typeAtEnd(printable ? e.key : '');
}

onMounted(() => {
  document.addEventListener('visibilitychange', flushOnHide);
  window.addEventListener('keydown', onWindowKeydown);
  onHeldInput((text) => editorRef.value?.typeAtEnd(text));
  clock = window.setInterval(() => (now.value = Date.now()), 20_000);
  // A blank page takes the caret. There is one thing to do on it, and a tap
  // to be allowed to do it was the first friction of every new piece.
  if (!props.essay) nextTick(() => editorRef.value?.startWriting());
});
onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', flushOnHide);
  window.removeEventListener('keydown', onWindowKeydown);
  onHeldInput(null);
  clearInterval(clock);
  // Switching pieces remounts the room; the one being left saves on the way out.
  if (dirty.value && worthSaving.value) void save();
  clearTimeout(autosaveTimer);
});

/** The spine's outline jumps through here into the block editor. */
function goToBlock(bid: string) {
  editorRef.value?.goToBlock?.(bid);
}

defineExpose({ goToBlock, cancelSaves, save });
</script>

<template>
  <div class="room-layout flex" :class="[inline ? 'is-inline' : 'is-modal', { 'focus-mode': focusMode }]" @keydown="handleKeydown">
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
        <!-- Top bar.
             IDENTITY LEFT, one action cluster right. It used to run the other
             way: nothing at all on the left, the badge and title shoved up
             against four differently-shaped controls in the top-right corner.
             The name of the thing you are writing is the first thing on the
             row now, and only Save is a filled control — the rest are quiet
             glyphs, so the corner reads as one cluster instead of a pile. -->
        <div class="edtop flex items-center gap-2 px-3 py-2">
          <button type="button" class="burger" :title="inline ? 'Pieces' : 'Back'" @click="spineOpen = !spineOpen">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16M4 12h11M4 18h7" /></svg>
          </button>
          <button v-if="!inline" type="button" @click="emit('close')" class="wr-btn">‹ Close</button>
          <!-- New piece. It used to be a floating button over the bottom-right
               of the manuscript, where it sat on top of the prose; here it
               covers nothing. Phone only — the docked spine has its own. -->
          <button type="button" class="newpiece" title="New piece" aria-label="Start a new piece" @click="emit('new')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
          </button>

          <!-- The deck's own identity vocabulary, from EssaySlide /
               EssayHeaderSlide: an ESSAY chip, then the piece's name in
               italic semibold amber. -->
          <div class="ednm min-w-0 flex items-center gap-1.5">
            <span class="edbadge">essay</span>
            <span class="t truncate" :class="{ untitled: name.untitled }">{{ name.name }}</span>
          </div>
          <div class="relative flex items-center gap-0.5 shrink-0">
            <button type="button" class="itg tagbtn" :class="{ on: tags.length }" title="Tags" aria-label="Tags" @click="showTags = !showTags">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18" /></svg>
            </button>
            <button v-if="content.trim().length > 0" type="button" class="itg" title="Present" @click="handlePresent" aria-label="Present essay">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
            </button>
            <button
              type="button"
              @click="handleSubmit"
              :disabled="!canSubmit"
              class="wr-btn gold icon"
              :class="{ dirty, saved: justSaved, saving }"
              :title="`${saveLabel || 'Save'} — ⌘S saves now`"
              :aria-label="dirty ? 'Save now' : 'Saved'"
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

        <!-- The deck's numbers. A phone gives this row 43px it needs for
             prose, and across the corpus the median piece is ~110 words
             against a 20,000 character ceiling — so the count is desk
             furniture, and only the ceiling is worth interrupting for. -->
        <div class="wr-status flex items-center gap-2 px-4 pb-1.5 text-[10.5px]">
          <span class="n">{{ blockCount }} {{ blockCount === 1 ? 'slide' : 'slides' }}</span>
          <span class="b"></span>
          <span class="n">{{ wordCount }} {{ wordCount === 1 ? 'word' : 'words' }}</span>
          <span class="b"></span>
          <span class="n">{{ sourceCount === 0 ? 'no sources' : `${sourceCount} ${sourceCount === 1 ? 'source' : 'sources'}` }}</span>
          <template v-if="sittingDelta > 0">
            <span class="b"></span>
            <span class="n delta" title="Words written since you opened this piece">+{{ sittingDelta }} this sitting</span>
          </template>
          <span v-if="saveLabel" class="savest" :class="{ warn: !!saveError, busy: saving }">{{ saveLabel }}</span>
          <span v-if="nearLimit" class="shrink-0 tabular-nums" :class="charCount > MAX_CHARS ? 'text-red-400' : 'text-mono-700'">
            {{ charCount.toLocaleString() }} / {{ MAX_CHARS.toLocaleString() }}
          </span>
        </div>
        <!-- On a phone the ceiling is the only number that can stop a save. -->
        <div v-if="nearLimit" class="wr-limit">
          {{ charCount.toLocaleString() }} / {{ MAX_CHARS.toLocaleString() }} characters
        </div>
        </div><!-- /.edchrome -->

        <!-- Writing area: the block surface, fills remaining height -->
        <div class="wr-scroll flex-1 min-h-0 overflow-y-auto" @scroll.passive="stopWriting" @click="stopWriting">
          <EssayBlockEditor
            ref="editorRef"
            v-model:content="content"
            :recent-ids="recentIds ?? []"
            :focus-mode="focusMode"
            @request-insert="handleRequestInsert"
            @command="handleCommand"
            @typing="onTyping"
          />
        </div>

        <!-- "New piece", as a strip above the rail.
             In the manuscript it sat on the top of the column — which, on the
             blank page it is announcing, is exactly where the caret is. Here
             it covers nothing, and it needs no magic offset to clear a bar
             whose height it would otherwise have to guess. -->
        <Transition name="flash">
          <div v-if="saveError" class="savefail shrink-0" role="alert">
            <span class="nf-t">{{ saveError }}</span>
            <button type="button" class="sf-retry" @click="handleSubmit">Try again</button>
          </div>
        </Transition>

        <Transition name="flash">
          <div v-if="startedNew && !saveError" class="newflash shrink-0" role="status">
            <span class="nf-dot"></span>
            <span class="nf-t"><b>New piece.</b> Just start — it saves itself. Type <kbd>/</kbd> for quotes, books, anything.</span>
          </div>
        </Transition>

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
          <!-- Four inserts, each named. The two "recent quote" chips that used
               to sit here were labelled with the quote's own opening words —
               so a rail whose first control is Quote read "Quote / Book /
               Quote... / Quote...", and the duplicates were the feature.
               Re-citing is one search in the sheet's Library pane instead. -->
          <div class="pills flex items-center gap-1.5">
            <!-- The slash, one tap away. On a phone "/" lives on the
                 keyboard's second page, which made the menu the hardest
                 thing in the editor to reach from the device most of it is
                 written on. -->
            <button type="button" class="slashkey" title="Search your library, or run a command ( / )" aria-label="Open the slash menu" @mousedown.prevent @click="editorRef?.openSlash()">/</button>
            <button type="button" @click="openSheet('quote')" class="pill primary" title="Insert quote"><span class="g">❝</span>Quote</button>
            <button type="button" @click="openSheet('book')" class="pill" title="Insert book"><span class="g">▤</span>Book</button>
            <!-- Four images against 87 quotes and 44 books: it keeps its place
                 in the rail but not a word of it. Header is gone — not one
                 piece in the corpus has ever used a section header. -->
            <button type="button" @click="triggerImageUpload" :disabled="imageUploading" class="pill icon" title="Insert image" aria-label="Insert image"><span class="g">{{ imageUploading ? '…' : '▦' }}</span></button>
            <input ref="imageFileInput" type="file" accept="image/jpeg,image/png,image/webp,image/gif" class="hidden" @change="handleImageSelected" />
          </div>

          <!-- Ordered by the corpus: 109 highlights, 96 italics, 28 gold
               underlines, 2 bolds. The bar read B I U H, which is that list
               backwards. -->
          <div class="fmt flex items-center gap-0.5 shrink-0">
            <button type="button" @mousedown.prevent @click="editorRef?.wrapActiveSelection('{', '}')" title="Highlight ({text})" class="fmt-b" style="color:#e8d0a8;">H</button>
            <button type="button" @mousedown.prevent @click="editorRef?.wrapActiveSelection('*', '*')" title="Italics (*text*)" class="fmt-b italic">I</button>
            <button type="button" @mousedown.prevent @click="editorRef?.wrapActiveSelection('&lt;', '&gt;')" title="Underline (&lt;text&gt;)" class="fmt-b" style="text-decoration: underline; text-decoration-color: rgba(232,200,130,0.85); text-underline-offset: 2px; text-decoration-thickness: 1.5px;">U</button>
            <button type="button" @mousedown.prevent @click="editorRef?.wrapActiveSelection('**', '**')" title="Bold (**text**)" class="fmt-b font-bold">B</button>
          </div>
        </div>

        <!-- Embed picker sheet -->
        <EssayQuoteModal
          :is-open="quoteModalOpen"
          :seed="sheetSeed"
          @close="closeQuoteModal"
          @select="handleEmbedSelect"
        />

        <EssayEmbedSheet
          :is-open="sheetOpen"
          initial-kind="book"
          @close="closeSheet"
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

/* The width is pinned three ways on purpose. `flex: 0 0 258px` alone is not a
   width: a flex item's default `min-width: auto` lets its CONTENT'S min-content
   size override the basis, and piece titles are `white-space: nowrap`. On prod,
   where most pieces are untitled and named by their opening line, the dock
   grew to the width of the longest first sentence. `min-width: 0` removes that
   floor; width/max-width say what the column is. */
.spine-dock {
  display: none;
  flex: 0 0 258px;
  width: 258px;
  min-width: 0;
  max-width: 258px;
  min-height: 0;
  overflow: hidden;
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
/* As the tab it already has the app nav above it and the spine beside it; a
   warm border drawn all the way round that was one frame too many. */
.room-layout.is-inline .writing-room {
  border: none;
}

/* ── Chrome ──
   The container owns the safe-area inset so no fixed-height row inside it
   ever has to. Full-screen on mobile, the modal's top row sat under the
   notch; a row that carried the inset itself would have had its content box
   eaten instead (border-box + a 47px inset against a ~44px row). */
.edchrome {
  padding-top: env(safe-area-inset-top, 0px);
  background: #08080a;
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
/* The room is the tab, so its chrome butts straight up against the app's own
   nav; without this the deck rail reads as a clipped edge rather than a bar. */
.room-layout.is-inline .edchrome {
  padding-top: 4px;
}

/* The deck's identity, matching EssaySlide's badge row and the italic-amber
   title EssayHeaderSlide gives a piece on the slide itself. */
.ednm {
  flex: 1;
  min-width: 0;
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
.ednm .t {
  font-size: 13px;
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
  width: 32px;
  height: 32px;
  border-radius: 9px;
  display: grid;
  place-items: center;
  background: transparent;
  border: none;
  color: var(--color-mono-400);
  cursor: pointer;
  font-size: 15px;
  transition: color 0.15s, background 0.15s;
}
.itg:hover {
  color: var(--gold);
  background: var(--color-mono-800);
}
.itg.on {
  color: var(--gold);
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
/* The formatting cluster. It never shrinks and it never scrolls — the pills
   beside it do both. Declared ONCE: there used to be a second `.fmt` further
   down that re-declared it as a 30x30 grid cell, and being later it won, so
   the four buttons were laid out inside a box narrower than two of them. */
.fmt {
  flex: 0 0 auto;
  border-left: 1px solid var(--line);
  padding-left: 6px;
  margin-left: 2px;
}
.fmt-b {
  width: 30px;
  height: 30px;
  flex: 0 0 auto;
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

/* —— The rail ——
   Neutral near-black, not the warm #0d0b08 it was. Gold is what this product
   spends on quotes, book titles and the one primary control; a whole bar
   tinted with it made the furniture compete with the manuscript above it. */
.wr-foot {
  background: #0a0a0c;
  border-top: 1px solid var(--color-mono-800);
}

/* —— "New piece" —— */
.newflash {
  display: flex;
  align-items: center;
  gap: 9px;
  overflow: hidden;
  padding: 9px 16px;
  background: #100d07;
  border-top: 1px solid rgb(232 160 64 / 0.28);
}
.nf-dot {
  flex: 0 0 auto;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--gold);
  box-shadow: 0 0 8px rgb(232 160 64 / 0.75);
}
.nf-t {
  font-size: 12px;
  line-height: 1.35;
  color: var(--color-mono-400);
}
.nf-t b {
  color: var(--color-essay);
  font-weight: 600;
}
/* max-height rather than transform, so the strip gives its space back to the
   manuscript instead of leaving a blank band — the same reason the chrome
   above collapses rather than sliding away. */
.flash-enter-active,
.flash-leave-active {
  transition: max-height 0.22s cubic-bezier(0.3, 0.8, 0.3, 1), opacity 0.22s ease,
    padding 0.22s ease;
}
.flash-enter-from,
.flash-leave-to {
  max-height: 0;
  opacity: 0;
  padding-top: 0;
  padding-bottom: 0;
}
.flash-enter-to,
.flash-leave-from {
  max-height: 44px;
  opacity: 1;
}

/* ── The phone's room ── */

/* New piece, in the top bar. The floating button this replaces sat over the
   bottom-right of the manuscript and covered the prose under it. */
.newpiece {
  flex: 0 0 auto;
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border: none;
  border-radius: 9px;
  background: transparent;
  color: var(--color-essay);
  cursor: pointer;
}
.newpiece svg {
  width: 17px;
  height: 17px;
}
.newpiece:active {
  background: rgb(232 160 64 / 0.14);
}
/* The docked spine carries its own Write button. */
@media (min-width: 1100px) {
  .room-layout.is-inline .newpiece {
    display: none;
  }
}

/* Not one piece in the corpus carries a tag; the phone's top row has better
   uses for 34px. It stays on a desk, where the row is not the constraint. */
.tagbtn {
  display: none;
}
@media (min-width: 640px) {
  .tagbtn {
    display: grid;
  }
}

/* Save, as a state rather than a button that always looks the same: filled
   while there is something to save, a quiet outline when there is not, and a
   moment of green when it lands. A ring around the filled gold check was the
   first attempt — gold on gold, invisible. */
.wr-btn.gold.icon {
  transition:
    background-color 0.25s ease,
    box-shadow 0.25s ease,
    color 0.25s ease,
    transform 0.12s ease;
}
.wr-btn.gold.icon:not(.dirty):not(.saved) {
  background: transparent;
  color: rgb(232 160 64 / 0.8);
  box-shadow: inset 0 0 0 1px rgb(232 160 64 / 0.3);
}
.wr-btn.gold.icon.saved {
  background: #7ed4a8;
  color: #08130d;
}

/* The character ceiling, once it is close enough to matter. */
.wr-limit {
  padding: 0 16px 6px;
  font-size: 10.5px;
  color: #f0b860;
  font-variant-numeric: tabular-nums;
}

/* A save that failed says so where the save button is, not in the console. */
.savefail {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  background: rgb(244 63 94 / 0.1);
  border-top: 1px solid rgb(244 63 94 / 0.25);
  color: #fda4af;
  font-size: 12.5px;
}
.sf-retry {
  margin-left: auto;
  flex-shrink: 0;
  padding: 4px 10px;
  border: 1px solid rgb(253 164 175 / 0.4);
  border-radius: 8px;
  background: none;
  font: inherit;
  font-size: 12px;
  color: #fda4af;
  cursor: pointer;
}

/* The slash key — first on the rail, because it reaches everything else. */
.slashkey {
  flex: 0 0 auto;
  width: 34px;
  height: 34px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  border: 1px solid rgb(232 160 64 / 0.35);
  background: rgb(232 160 64 / 0.08);
  color: var(--color-essay);
  font: 600 16px/1 ui-monospace, SFMono-Regular, Menlo, monospace;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}
.slashkey:hover {
  background: rgb(232 160 64 / 0.16);
  border-color: var(--color-essay);
}

/* Save state, where the numbers are. */
.savest {
  margin-left: auto;
  color: var(--color-mono-600);
  font-style: italic;
  white-space: nowrap;
}
.savest.busy {
  color: var(--color-essay);
}
.savest.warn {
  color: #fda4af;
}
.wr-status .delta {
  color: rgb(126 212 168 / 0.85);
}
.nf-t kbd {
  font: 600 11px/1 ui-monospace, SFMono-Regular, Menlo, monospace;
  padding: 1px 5px;
  border-radius: 4px;
  border: 1px solid rgb(232 160 64 / 0.4);
  color: var(--color-essay);
}
.wr-btn.gold.icon.saving {
  animation: savepulse 1s ease-in-out infinite;
}
@keyframes savepulse {
  50% {
    opacity: 0.55;
  }
}
@media (prefers-reduced-motion: reduce) {
  .wr-btn.gold.icon.saving {
    animation: none;
  }
}

/* An icon-only insert, for the one that is rarely used. */
.pill.icon {
  padding-left: 11px;
  padding-right: 11px;
  gap: 0;
}

/* The deck's numbers are desk furniture; a phone needs the row for prose. */
@media (max-width: 639px) {
  .wr-status {
    display: none;
  }
}
</style>
