<script setup lang="ts">
import { computed, ref, onMounted } from 'vue';
import { bookGradient, bookHue } from '../../composables/useBookHue';
import {
  fetchThreadsForEntity,
  type Essay,
  type EssayReference,
  type Thread,
} from '../../lib/api';
import { formatMarkdown } from '../../lib/formatText';

const props = defineProps<{
  essay: Essay;
  isAdmin?: boolean;
}>();

const emit = defineEmits<{
  (e: 'edit', essay: Essay): void;
  (e: 'copy', essay: Essay): void;
  (e: 'present', essay: Essay): void;
  (e: 'delete', essay: Essay): void;
  (e: 'addToThread', essay: Essay): void;
  (e: 'navigateToThread', threadId: string): void;
}>();

const latestThread = ref<Thread | null>(null);

onMounted(async () => {
  try {
    const threads = await fetchThreadsForEntity('essay', props.essay.id);
    if (threads.length) {
      latestThread.value = threads.sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];
    }
  } catch {
    // Thread lookup is non-critical
  }
});

const gradient = computed(() => {
  const ids = props.essay.references
    .map((r) => r.book_id)
    .filter((id): id is string => !!id);
  return bookGradient(ids);
});

const formattedDate = computed(() => {
  return new Date(props.essay.created_at).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
});

// Book titles (for italic-title gold underline) drawn from references.
const bookTitles = computed(() => {
  const set = new Set<string>();
  for (const r of props.essay.references) {
    if (r.book_title) set.add(r.book_title);
  }
  return [...set];
});

// Reference lookup by polymorphic key — used to materialise inline tokens.
const refByKey = computed(() => {
  const m = new Map<string, EssayReference>();
  for (const r of props.essay.references) {
    m.set(`${r.entity_type}:${r.entity_id}`, r);
  }
  return m;
});

type CardBlock =
  | { kind: 'paragraph'; html: string }
  | { kind: 'header'; text: string }
  | { kind: 'quote'; reference: EssayReference }
  | { kind: 'book'; reference: EssayReference };

const TOKEN_RE = /^\[\[(quote|book):([0-9a-fA-F-]{36})\]\]$/;
const HEADER_RE = /^#\s+(.+)$/;

const blocks = computed<CardBlock[]>(() => {
  const out: CardBlock[] = [];
  const paragraphs = props.essay.content
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  for (const p of paragraphs) {
    const tok = p.match(TOKEN_RE);
    if (tok) {
      const kind = tok[1] as 'quote' | 'book';
      const id = tok[2];
      const refKey = kind === 'quote' ? `quote:${id}` : `book_cover:${id}`;
      const reference = refByKey.value.get(refKey);
      if (reference) {
        out.push({ kind: kind === 'quote' ? 'quote' : 'book', reference });
      }
      continue;
    }
    const head = p.match(HEADER_RE);
    if (head) {
      out.push({ kind: 'header', text: head[1].trim() });
      continue;
    }
    out.push({ kind: 'paragraph', html: formatMarkdown(p, bookTitles.value) });
  }
  return out;
});
</script>

<template>
  <div
    class="essay-card group relative flex flex-col gap-2.5 p-4 border bg-mono-900 rounded-b-lg cursor-pointer transition-colors hover:border-mono-600"
    :class="essay.posted ? 'border-emerald-700' : 'border-mono-800'"
    @click="emit('present', essay)"
  >
    <!-- Book-hue gradient bar -->
    <div
      class="absolute top-0 left-0 right-0 h-[2px] opacity-85"
      :style="{ background: gradient }"
    ></div>

    <!-- Header: badges + date + actions -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2 min-w-0 flex-1 mr-2">
        <span class="bg-essay text-essay-text px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.06em] leading-[1.5] shrink-0">
          essay
        </span>
        <button v-if="latestThread" @click.stop="emit('navigateToThread', latestThread.id)" class="inline-flex items-baseline gap-1 cursor-pointer group/thread min-w-0">
          <span class="text-[10.5px] italic text-mono-500 group-hover/thread:text-mono-400 transition-colors shrink-0">in</span>
          <span class="text-[11.5px] font-medium text-thread-muted group-hover/thread:text-thread transition-colors truncate">{{ latestThread.name }}</span>
        </button>
      </div>

      <div class="flex items-center gap-2 sm:gap-3 relative">
        <time :datetime="essay.created_at" class="hidden sm:inline sm:group-hover:opacity-0 sm:group-hover:invisible text-xs text-mono-500 font-medium py-1.5">{{ formattedDate }}</time>

        <div class="flex items-center gap-2 sm:absolute sm:right-0 sm:hidden sm:group-hover:flex">
          <button @click.stop="emit('copy', essay)" class="p-1.5 bg-accent active:bg-accent-bright sm:hover:bg-accent-bright text-white rounded cursor-pointer transition-all active:scale-95" title="Copy Essay">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" class="sm:w-3.5 sm:h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
              <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
            </svg>
          </button>
          <button @click.stop="emit('edit', essay)" class="p-1.5 bg-accent active:bg-accent-bright sm:hover:bg-accent-bright text-white rounded cursor-pointer transition-all active:scale-95" title="Edit Essay">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" class="sm:w-3.5 sm:h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
              <path d="m15 5 4 4" />
            </svg>
          </button>
          <button @click.stop="emit('addToThread', essay)" class="flex p-1.5 text-mono-500 hover:text-purple-400 hover:bg-purple-500/10 rounded cursor-pointer transition-all active:scale-95" title="Add to Thread">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8Z" />
              <path d="M12 8v8" /><path d="M8 12h8" />
            </svg>
          </button>
          <button v-if="isAdmin" @click.stop="emit('delete', essay)" class="hidden sm:flex p-1.5 text-mono-500 hover:text-red-400 hover:bg-red-500/10 rounded cursor-pointer transition-all active:scale-95" title="Delete Essay">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 6h18" />
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
              <line x1="10" x2="10" y1="11" y2="17" />
              <line x1="14" x2="14" y1="11" y2="17" />
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Essay body — block-walked so embed tokens materialize as visual artifacts -->
    <div class="mt-1 flex flex-col gap-2.5">
      <template v-for="(block, i) in blocks" :key="i">
        <!-- Header: section title -->
        <h3
          v-if="block.kind === 'header'"
          class="font-body text-[15px] font-semibold text-mono-50 leading-tight pt-1 typography-prose"
        >{{ block.text }}</h3>

        <!-- Paragraph: prose -->
        <p
          v-else-if="block.kind === 'paragraph'"
          class="typography-prose whitespace-pre-wrap leading-[1.4] text-sm text-mono-100"
          v-html="block.html"
        ></p>

        <!-- Quote embed — cardless blockquote with accent left bar.
             Attribution is left-aligned (card-view convention) under the
             blockquote, while presentation view keeps the right-aligned
             rendering native to PresentationViewQuote. -->
        <div
          v-else-if="block.kind === 'quote'"
          class="my-2 flex flex-col gap-1.5"
        >
          <blockquote
            class="typography-quote text-mono-100 border-l-4 border-accent pl-4 py-1 text-[14px] leading-[1.45] whitespace-pre-wrap"
          >{{ block.reference.quote_text }}</blockquote>
          <div class="pl-5 text-mono-400 text-[12px] flex flex-col gap-0.5">
            <span v-if="block.reference.book_author || block.reference.quote_creator" class="font-medium text-mono-300">— {{ block.reference.book_author || block.reference.quote_creator }}</span>
            <span v-if="block.reference.book_title || block.reference.quote_work">
              <span class="underline decoration-mono-600 underline-offset-2 italic">{{ block.reference.book_title || block.reference.quote_work }}</span><span v-if="block.reference.book_originally_published"> ({{ block.reference.book_originally_published }})</span><span v-if="block.reference.page || block.reference.quote_page">, p.&nbsp;{{ block.reference.page || block.reference.quote_page }}</span>
            </span>
          </div>
        </div>

        <!-- Book embed: text-only marker (cover image lives only in presentation) -->
        <div
          v-else-if="block.kind === 'book'"
          class="flex items-baseline gap-2 py-1"
        >
          <span
            class="w-1.5 h-1.5 rounded-full shrink-0 self-center"
            :style="{ background: bookHue(block.reference.entity_id) }"
          ></span>
          <span class="text-[11px] uppercase tracking-[0.16em] text-essay font-medium shrink-0">Book</span>
          <span class="text-[12.5px] text-mono-200">
            <span class="font-medium">{{ block.reference.book_author }}</span>,
            <span class="italic text-mono-300">{{ block.reference.book_title }}</span>
          </span>
        </div>
      </template>
    </div>

    <!-- Tags -->
    <div v-if="essay.tags && essay.tags.length" class="flex flex-wrap gap-2 mt-0.5">
      <span v-for="tag in essay.tags" :key="tag" class="text-xs text-mono-500 hover:text-accent cursor-pointer transition-colors">
        #{{ tag }}
      </span>
    </div>

    <!-- Mobile date footer -->
    <time :datetime="essay.created_at" class="sm:hidden text-xs text-mono-500 font-medium pt-1.5 border-t border-mono-800">{{ formattedDate }}</time>
  </div>
</template>

<style scoped>
.essay-card {
  /* Ensure the gradient bar is visible above the card background */
  overflow: visible;
}
</style>
