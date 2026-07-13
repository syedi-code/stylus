<script setup lang="ts">
import { computed } from 'vue';
import type { Essay } from '../../lib/api';
import {
  essayName,
  essayPreview,
  essaySourceLabel,
  essayWordCount,
  relativeDate,
} from '../../lib/essayDisplay';

const props = defineProps<{
  essay: Essay;
  isAdmin?: boolean;
  expanded?: boolean;
}>();

const emit = defineEmits<{
  (e: 'toggle', essay: Essay): void;
  (e: 'edit', essay: Essay): void;
  (e: 'present', essay: Essay): void;
  (e: 'copy', essay: Essay): void;
  (e: 'delete', essay: Essay): void;
}>();

const name = computed(() => essayName(props.essay.content));
const sourceLabel = computed(() => essaySourceLabel(props.essay));
const when = computed(() => relativeDate(props.essay.updated_at || props.essay.created_at));
const preview = computed(() => essayPreview(props.essay.content));
const wordCount = computed(() => essayWordCount(props.essay.content));
const stateLabel = computed(() => (props.essay.posted ? 'posted' : 'still writing'));
</script>

<template>
  <div class="gild">
    <!-- Hairline index entry -->
    <div class="ess" :class="{ on: expanded }" @click="emit('toggle', essay)">
      <div class="main">
        <div class="t" :class="{ untitled: name.untitled }">{{ name.name }}</div>
        <div class="sub">
          <span>{{ sourceLabel }}</span>
          <span aria-hidden="true">·</span>
          <span>{{ when }}</span>
        </div>
      </div>
      <div class="right">
        <!-- desktop hover actions -->
        <div class="rowacts">
          <span class="iact" title="Edit" @click.stop="emit('edit', essay)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
          </span>
          <span class="iact" title="Duplicate" @click.stop="emit('copy', essay)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>
          </span>
          <span class="iact" title="Present" @click.stop="emit('present', essay)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polygon points="6 4 20 12 6 20 6 4"/></svg>
          </span>
          <span v-if="isAdmin" class="iact danger" title="Delete" @click.stop="emit('delete', essay)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14"/></svg>
          </span>
        </div>
        <span class="seal" :class="essay.posted ? 'posted' : 'working'" :title="stateLabel"></span>
      </div>
    </div>

    <!-- Expanded peek — flows from the open entry, sharing its gold thread -->
    <Transition name="peek">
      <div v-if="expanded" class="peek">
        <div class="pp"><p>{{ preview || '…' }}</p></div>
        <div class="pfoot">
          <span class="when">{{ wordCount }} word{{ wordCount === 1 ? '' : 's' }} · {{ stateLabel }}</span>
          <div class="pacts">
            <span class="iact" title="Present" @click.stop="emit('present', essay)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polygon points="6 4 20 12 6 20 6 4"/></svg>
            </span>
            <span class="iact" title="Duplicate" @click.stop="emit('copy', essay)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>
            </span>
            <span v-if="isAdmin" class="iact danger" title="Delete" @click.stop="emit('delete', essay)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14"/></svg>
            </span>
            <span class="btn2 gold" @click.stop="emit('edit', essay)">Edit</span>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* "The Gilded Index" row. Local names alias the app's global tokens so the
   warm foil vocabulary stays legible; the mono ramp comes straight from
   style.css. */
.gild {
  --gold: var(--color-essay);
  --ink: #140d03;
  --line: #241d12;
  --tint: rgba(232, 160, 64, 0.05);
}

/* Entry — no card; a hairline-ruled line in a table of contents. */
.ess {
  position: relative;
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 12px;
  padding: 15px 18px;
  cursor: pointer;
  border-bottom: 1px solid var(--line);
  transition: background 0.16s;
}
.ess::before {
  content: '';
  position: absolute;
  left: 6px;
  top: 50%;
  transform: translateY(-50%) scaleY(0);
  width: 3px;
  height: 24px;
  border-radius: 2px;
  background: var(--gold);
  transition: transform 0.22s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.ess:hover {
  background: var(--tint);
}
.ess:hover::before {
  transform: translateY(-50%) scaleY(1);
}
.ess.on {
  background: var(--tint);
  box-shadow: inset 3px 0 0 var(--gold);
  border-bottom-color: transparent;
}
.ess.on::before {
  display: none;
}
.ess .main {
  min-width: 0;
}

/* Names carry the book-title convention: a gold rule beneath a titled work.
   Upright serif (my own writing) vs. italic for the untitled fallback; the
   rule brightens on hover as an affordance. */
.ess .t {
  font-size: 16.5px;
  color: var(--color-mono-50);
  font-weight: 500;
  letter-spacing: -0.006em;
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-decoration: underline;
  text-decoration-color: rgba(232, 160, 64, 0.42);
  text-decoration-thickness: 1.5px;
  text-underline-offset: 3.5px;
  transition: text-decoration-color 0.18s, color 0.18s;
}
.ess:hover .t,
.ess.on .t {
  text-decoration-color: var(--gold);
}
.ess .t.untitled {
  font-style: italic;
  font-weight: 400;
  color: var(--color-mono-400);
}
.ess .sub {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
  font-size: 11px;
  color: var(--color-mono-400);
  font-variant-numeric: lining-nums;
}
.ess .right {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* posted seal = a tiny foil dot; in-progress = hollow gold ring */
.seal {
  width: 15px;
  height: 15px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  flex: 0 0 auto;
}
.seal.posted {
  background: var(--gold);
  box-shadow: inset 0 1px 0 rgba(255, 245, 220, 0.6);
}
.seal.posted::after {
  content: '';
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--ink);
}
.seal.working {
  border: 1.5px solid var(--gold);
}
.seal.working::after {
  content: '';
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--gold);
}

/* desktop hover actions — hidden until the row is hovered (pointer only) */
.rowacts {
  display: none;
  gap: 1px;
}
@media (hover: hover) and (pointer: fine) {
  .ess:hover .rowacts {
    display: flex;
  }
}
.iact {
  width: 27px;
  height: 27px;
  display: grid;
  place-items: center;
  border-radius: 8px;
  color: var(--color-mono-400);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.iact:hover {
  background: var(--color-mono-800);
  color: var(--gold);
}
.iact.danger:hover {
  color: var(--color-rose);
  background: rgba(244, 63, 94, 0.1);
}
.iact svg {
  width: 15px;
  height: 15px;
}

/* Expanded peek — continuous gold thread down the open entry */
.peek {
  padding: 0 18px 16px;
  background: var(--tint);
  border-bottom: 1px solid var(--line);
  box-shadow: inset 3px 0 0 var(--gold);
  overflow: hidden;
}
.peek .pp {
  font-size: 14px;
  line-height: 1.6;
  color: var(--color-mono-200);
  padding-top: 2px;
}
.peek .pp p {
  margin: 0 0 10px;
}
.peek .pfoot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 13px;
  margin-top: 4px;
  border-top: 1px solid var(--line);
}
.peek .pfoot .when {
  font-size: 11px;
  color: var(--color-mono-500);
  font-variant-numeric: lining-nums;
}
.pacts {
  display: flex;
  gap: 5px;
  align-items: center;
}

.btn2 {
  font-size: 12px;
  padding: 7px 13px;
  border-radius: 999px;
  cursor: pointer;
  background: var(--color-mono-800);
  border: 1px solid var(--line);
  color: var(--color-mono-200);
  display: inline-flex;
  align-items: center;
  gap: 5px;
  transition: border-color 0.15s, color 0.15s, background 0.15s;
}
.btn2:hover {
  border-color: var(--color-mono-500);
  color: var(--color-mono-50);
}
.btn2.gold {
  background: var(--gold);
  color: var(--ink);
  border-color: transparent;
  font-weight: 600;
  box-shadow: inset 0 1px 0 rgba(255, 245, 220, 0.5);
}
.btn2.gold:hover {
  background: #f8d38a;
}

/* peek expand/collapse */
.peek-enter-active,
.peek-leave-active {
  transition: opacity 0.2s ease, max-height 0.28s cubic-bezier(0.2, 0.8, 0.2, 1);
  max-height: 320px;
}
.peek-enter-from,
.peek-leave-to {
  opacity: 0;
  max-height: 0;
}
</style>
