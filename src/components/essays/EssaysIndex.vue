<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Essay } from '../../lib/api';
import {
  essayName,
  essayPreview,
  essaySourceLabel,
  essayWordCount,
  relativeDate,
} from '../../lib/essayDisplay';
import EssayIndexRow from './EssayIndexRow.vue';
import EssayCardSkeleton from './EssayCardSkeleton.vue';

const props = defineProps<{
  essays: Essay[];
  loading?: boolean;
  loadingMore?: boolean;
  error?: string | null;
  isAdmin?: boolean;
}>();

const emit = defineEmits<{
  (e: 'new'): void;
  (e: 'edit', essay: Essay): void;
  (e: 'copy', essay: Essay): void;
  (e: 'present', essay: Essay): void;
  (e: 'delete', essay: Essay): void;
  (e: 'addToThread', essay: Essay): void;
  (e: 'navigateToThread', threadId: string): void;
  (e: 'retry'): void;
}>();

// The one soft-gold "Continue" pillow: the most recently touched piece you're
// still writing, falling back to the most recent essay overall. Von Restorff —
// the single item that breaks the pattern is the one to return to.
const heroEssay = computed<Essay | null>(() => {
  if (!props.essays.length) return null;
  const byRecent = [...props.essays].sort((a, b) =>
    (b.updated_at || b.created_at).localeCompare(a.updated_at || a.created_at)
  );
  return byRecent.find((e) => !e.posted) ?? byRecent[0];
});

const hero = computed(() => {
  const e = heroEssay.value;
  if (!e) return null;
  return {
    essay: e,
    name: essayName(e.content).name,
    excerpt: essayPreview(e.content, 120),
    sources: essaySourceLabel(e),
    words: essayWordCount(e.content),
    when: relativeDate(e.updated_at || e.created_at),
  };
});

// The index proper — everything except the hero (shown above), most-recent first.
const listEssays = computed(() => {
  const heroId = heroEssay.value?.id;
  return [...props.essays]
    .filter((e) => e.id !== heroId)
    .sort((a, b) =>
      (b.updated_at || b.created_at).localeCompare(a.updated_at || a.created_at)
    );
});

const count = computed(() => props.essays.length);

// Accordion: a single open entry at a time.
const expandedId = ref<string | null>(null);
function toggle(essay: Essay) {
  expandedId.value = expandedId.value === essay.id ? null : essay.id;
}
</script>

<template>
  <div class="ws">
    <!-- Editorial header -->
    <div class="hd">
      <div class="row1">
        <h1>Essays</h1>
        <div class="hd-right">
          <span class="ct">{{ count }} {{ count === 1 ? 'piece' : 'pieces' }}</span>
          <button class="compose" title="Write a new essay" @click="emit('new')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 5v14" /><path d="M5 12h14" />
            </svg>
            <span>Write</span>
          </button>
        </div>
      </div>
      <div class="rule"></div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="states">
      <EssayCardSkeleton v-for="i in 4" :key="i" />
    </div>

    <!-- Error -->
    <div v-else-if="error" class="states">
      <div class="err">
        <p>{{ error }}</p>
        <button @click="emit('retry')">Retry connection</button>
      </div>
    </div>

    <!-- Empty -->
    <div v-else-if="!essays.length" class="states">
      <div class="empty">
        <div class="empty-mark">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" />
          </svg>
        </div>
        <p class="empty-t">No essays yet</p>
        <p class="empty-s">Essays are reflections that weave in one or more books from your library.</p>
        <button class="empty-cta" @click="emit('new')">Write your first essay</button>
      </div>
    </div>

    <template v-else>
      <!-- Continue hero — the one soft gold pillow -->
      <div v-if="hero" class="wrap">
        <div class="hero foil" @click="emit('edit', hero.essay)">
          <div class="eyebrow">Continue writing</div>
          <div class="h-title">{{ hero.name }}</div>
          <div v-if="hero.excerpt" class="h-ex">“{{ hero.excerpt }}”</div>
          <div class="h-foot">
            <div class="h-meta">
              <span>{{ hero.sources }}</span>
              <span class="b"></span>
              <span>{{ hero.words }} words</span>
              <span class="b"></span>
              <span>{{ hero.when }}</span>
            </div>
            <span class="h-cta">Resume ▸</span>
          </div>
        </div>
      </div>

      <!-- The index -->
      <div class="list">
        <div v-if="listEssays.length" class="sec">
          <span class="stamp">Recent</span><span class="line"></span>
        </div>

        <EssayIndexRow
          v-for="essay in listEssays"
          :key="essay.id"
          :essay="essay"
          :is-admin="isAdmin"
          :expanded="expandedId === essay.id"
          @toggle="toggle"
          @edit="emit('edit', $event)"
          @present="emit('present', $event)"
          @copy="emit('copy', $event)"
          @delete="emit('delete', $event)"
        />

        <div v-if="loadingMore" class="loadmore">
          <div class="spinner"></div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.ws {
  --gold: var(--color-essay);
  --gold-hi: #f8d38a;
  --gold-lo: #b9761f;
  --ink: #140d03;
  --line: #241d12;
  background: #000000;
  display: flex;
  flex-direction: column;
  min-height: calc(100vh - 56px);
  color: var(--color-mono-100);
}

/* Editorial header */
.hd {
  padding: 20px 20px 6px;
}
.hd .row1 {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
}
.hd h1 {
  margin: 0;
  font-size: 30px;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: var(--color-mono-50);
  line-height: 1;
}
.hd-right {
  display: flex;
  align-items: center;
  gap: 14px;
}
.hd .ct {
  font-size: 12px;
  color: var(--color-mono-400);
  font-variant-numeric: lining-nums;
  margin-bottom: 3px;
}
.compose {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 13px;
  border-radius: 999px;
  background: var(--gold);
  color: var(--ink);
  font-size: 12.5px;
  font-weight: 600;
  border: none;
  cursor: pointer;
  box-shadow: inset 0 1px 0 rgba(255, 245, 220, 0.5);
  transition: background 0.15s, transform 0.15s;
}
.compose:hover {
  background: var(--gold-hi);
}
.compose:active {
  transform: scale(0.97);
}
.compose svg {
  width: 14px;
  height: 14px;
}
.hd .rule {
  height: 1px;
  margin-top: 14px;
  background: linear-gradient(90deg, var(--gold) 0%, rgba(232, 160, 64, 0.15) 34%, transparent 68%);
}

/* Continue hero — the one soft gold pillow */
.wrap {
  padding: 16px 16px 4px;
}
.foil {
  position: relative;
  background: var(--gold);
  background-image: linear-gradient(138deg, #f0c477 0%, var(--gold) 46%, var(--gold-lo) 124%);
  box-shadow: inset 0 1px 0 rgba(255, 245, 220, 0.5), inset 0 -1.5px 0 rgba(120, 70, 20, 0.42);
  color: var(--ink);
}
.hero {
  border-radius: 18px;
  padding: 15px 16px 14px;
  cursor: pointer;
  box-shadow: inset 0 1px 0 rgba(255, 245, 220, 0.42), inset 0 -1.5px 0 rgba(120, 70, 20, 0.38),
    0 6px 20px rgba(232, 160, 64, 0.13);
  transition: transform 0.28s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.28s;
  max-width: 640px;
}
.hero:hover {
  transform: translateY(-2px);
  box-shadow: inset 0 1px 0 rgba(255, 245, 220, 0.42), inset 0 -1.5px 0 rgba(120, 70, 20, 0.38),
    0 12px 30px rgba(232, 160, 64, 0.2);
}
.hero .eyebrow {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: rgba(20, 13, 3, 0.58);
}
.hero .h-title {
  font-size: 21px;
  font-weight: 600;
  letter-spacing: -0.015em;
  line-height: 1.12;
  margin: 7px 0 6px;
  color: var(--ink);
}
.hero .h-ex {
  font-size: 12.5px;
  line-height: 1.45;
  color: rgba(20, 13, 3, 0.66);
  font-style: italic;
  margin-bottom: 13px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.hero .h-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.hero .h-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 10.5px;
  color: rgba(20, 13, 3, 0.6);
  font-variant-numeric: lining-nums;
  min-width: 0;
  flex-wrap: wrap;
}
.hero .h-meta .b {
  width: 2.5px;
  height: 2.5px;
  border-radius: 50%;
  background: rgba(20, 13, 3, 0.36);
  flex: 0 0 auto;
}
.h-cta {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--ink);
  color: var(--gold-hi);
  font-size: 11.5px;
  font-weight: 600;
  padding: 7px 13px;
  border-radius: 999px;
  flex: 0 0 auto;
  box-shadow: 0 3px 11px rgba(0, 0, 0, 0.32);
}

/* Section stamp divider */
.sec {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 18px 18px 6px;
}
.stamp {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--gold);
  color: var(--ink);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  padding: 3px 7px;
  border-radius: 1px;
  line-height: 1;
  box-shadow: inset 0 1px 0 rgba(255, 245, 220, 0.5);
}
.sec .line {
  flex: 1;
  height: 1px;
  background: var(--color-mono-800);
}

/* The index list */
.list {
  flex: 1;
  padding-bottom: 96px;
}

.states {
  padding: 20px;
}

.loadmore {
  padding: 24px 0;
  display: flex;
  justify-content: center;
}
.spinner {
  width: 20px;
  height: 20px;
  border: 2px solid var(--gold);
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Error */
.err {
  padding: 24px;
  border: 1px solid #7f1d1d;
  background: rgba(127, 29, 29, 0.15);
  border-radius: 12px;
  text-align: center;
}
.err p {
  color: #f87171;
  font-weight: 600;
  text-transform: uppercase;
  font-size: 13px;
  margin: 0 0 14px;
}
.err button {
  padding: 8px 16px;
  background: #7f1d1d;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}

/* Empty */
.empty {
  padding: 72px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  text-align: center;
  border: 1px dashed var(--color-mono-700);
  border-radius: 14px;
}
.empty-mark {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: var(--color-essay-muted);
  color: var(--gold);
  display: grid;
  place-items: center;
}
.empty-mark svg {
  width: 18px;
  height: 18px;
}
.empty-t {
  font-size: 15px;
  font-weight: 500;
  color: var(--color-mono-200);
  margin: 0;
}
.empty-s {
  font-size: 12px;
  color: var(--color-mono-500);
  max-width: 20rem;
  line-height: 1.5;
  margin: 0;
}
.empty-cta {
  margin-top: 4px;
  padding: 8px 16px;
  background: var(--gold);
  color: var(--ink);
  border: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: inset 0 1px 0 rgba(255, 245, 220, 0.5);
}
.empty-cta:hover {
  background: var(--gold-hi);
}

/* Desktop: give the index a comfortable measure centered on the black field. */
@media (min-width: 640px) {
  .hd,
  .wrap,
  .list {
    max-width: 720px;
    margin-left: auto;
    margin-right: auto;
    width: 100%;
  }
}
</style>
