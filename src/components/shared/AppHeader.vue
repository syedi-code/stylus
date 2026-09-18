<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import TabIcon from './TabIcon.vue';

const props = defineProps<{
  currentTab: string;
  userEmail?: string | null;
}>();

const emit = defineEmits<{
  (e: 'update:currentTab', value: string): void;
  (e: 'logout'): void;
}>();

const menuOpen = ref(false); // mobile nav panel
const accountOpen = ref(false); // desktop avatar popover
const rootEl = ref<HTMLElement | null>(null);

/**
 * One hue per tab, taken straight from the palette in style.css. Everything
 * tinted — the desktop thumb, the active label, the mobile row — derives from
 * this single value via `--tab`, so a new tab is one line here and no CSS.
 */
const tabs = [
  { key: 'notes', label: 'notes', hue: 'var(--color-accent-bright)' },
  { key: 'thoughts', label: 'thoughts', hue: 'var(--color-rose-bright)' },
  { key: 'quotes', label: 'quotes', hue: 'var(--color-quote-bright)' },
  { key: 'essays', label: 'essays', hue: 'var(--color-essay-bright)' },
  { key: 'library', label: 'library', hue: '#e8d0a8' },
] as const;

const activeTab = computed(() => tabs.find((t) => t.key === props.currentTab));
const activeHue = computed(() => activeTab.value?.hue ?? 'var(--color-accent-bright)');

const avatarLetter = computed(() => props.userEmail?.[0]?.toLowerCase() ?? '·');

function selectTab(tab: string) {
  emit('update:currentTab', tab);
  menuOpen.value = false;
}

function toggleMenu() {
  menuOpen.value = !menuOpen.value;
  accountOpen.value = false;
}

function toggleAccount() {
  accountOpen.value = !accountOpen.value;
}

function handleLogout() {
  menuOpen.value = false;
  accountOpen.value = false;
  emit('logout');
}

function onDocumentClick(e: MouseEvent) {
  if (rootEl.value && !rootEl.value.contains(e.target as Node)) {
    menuOpen.value = false;
    accountOpen.value = false;
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    menuOpen.value = false;
    accountOpen.value = false;
  }
}

/**
 * The sliding thumb behind the active desktop tab.
 *
 * Measured rather than derived from CSS: the labels are different widths and
 * the webfont lands after first paint, so a percentage-based thumb sits wrong
 * until something re-renders. The ResizeObserver below covers both the font
 * swap and any resize; `nextTick` covers the tab change itself.
 */
const navEl = ref<HTMLElement | null>(null);
const thumb = ref({ x: 0, w: 0 });
const thumbReady = ref(false);

function measureThumb() {
  const nav = navEl.value;
  if (!nav) return;
  const active = nav.querySelector<HTMLElement>('[data-active="true"]');
  if (!active) return;
  thumb.value = { x: active.offsetLeft, w: active.offsetWidth };
  // First measurement lands untransitioned, so the thumb doesn't fly in
  // from the left edge on mount.
  if (!thumbReady.value) requestAnimationFrame(() => { thumbReady.value = true; });
}

watch(() => props.currentTab, () => nextTick(measureThumb));

/**
 * Publish the header's height as `--app-header-h` on the document root.
 *
 * A full-height tab (the Essays manuscript) has to fill from under this
 * header to the bottom of the viewport. Measuring its OWN offset to work that
 * out is what broke: the tab transitions in App.vue are separate
 * `<transition>` elements, so `mode="out-in"` does not coordinate between
 * them — the outgoing tab is still in the DOM, mid-fade, when the incoming
 * one mounts and measures. Its top came back as "below the whole previous
 * feed", the height clamped to nothing, and the tab rendered blank until any
 * resize re-measured it.
 *
 * The header's height does not depend on what is leaving underneath it. A
 * ResizeObserver also keeps it right when the nav wraps or the mobile panel
 * opens, which a one-shot measurement never did.
 */
let headerRO: ResizeObserver | null = null;

onMounted(() => {
  document.addEventListener('click', onDocumentClick);
  document.addEventListener('keydown', onKeydown);

  measureThumb();

  if (rootEl.value && typeof ResizeObserver !== 'undefined') {
    headerRO = new ResizeObserver(([entry]) => {
      const h = Math.round(entry.target.getBoundingClientRect().height);
      document.documentElement.style.setProperty('--app-header-h', `${h}px`);
      measureThumb();
    });
    headerRO.observe(rootEl.value);
  }
});
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick);
  document.removeEventListener('keydown', onKeydown);
  headerRO?.disconnect();
  headerRO = null;
});
</script>

<template>
  <header ref="rootEl" class="relative z-40 border-b border-mono-900 bg-mono-950">
    <div class="flex items-center gap-2.5 px-4 sm:px-6 py-2.5">
      <!-- Logo mark + desktop wordmark -->
      <h1 class="flex items-center gap-2 min-w-0 shrink-0">
        <svg width="22" height="22" viewBox="9 8 32 32" xmlns="http://www.w3.org/2000/svg" class="shrink-0 text-accent">
          <clipPath id="leftCrack">
            <polygon points="0,0 24,0 26,18 22,23 26,28 23,36 0,36 0,0" />
          </clipPath>
          <clipPath id="rightCrack">
            <polygon points="50,0 27,0 29,18 25,23 29,28 26,36 50,36 50,0" />
          </clipPath>
          <polygon points="11,36 25,12 39,36" fill="currentColor" clip-path="url(#leftCrack)" />
          <polygon points="11,36 25,12 39,36" fill="currentColor" clip-path="url(#rightCrack)" />
        </svg>
        <span class="hidden sm:inline-flex items-baseline whitespace-nowrap">
          <span class="text-[15px] font-semibold tracking-tight text-white">stylus</span>
        </span>
      </h1>

      <!-- Mobile: current tab as title / dropdown trigger -->
      <button
        @click="toggleMenu"
        class="sm:hidden flex-1 flex items-center justify-center gap-1.5 min-w-0 py-1 cursor-pointer"
        aria-label="Toggle navigation"
        :aria-expanded="menuOpen"
      >
        <span class="text-base font-semibold tracking-tight truncate" :style="{ color: activeHue }">{{ currentTab }}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" class="shrink-0 transition-transform duration-200" :class="menuOpen ? 'rotate-180 text-mono-400' : 'text-mono-600'">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      <!-- Desktop: a segmented rail with a thumb that slides to the active
           tab, tinted with that tab's hue. -->
      <div class="hidden sm:flex flex-1 justify-center">
        <nav ref="navEl" class="tab-rail relative inline-flex items-center gap-0.5 p-1 rounded-[10px] bg-mono-900/70 border border-mono-800" :style="{ '--tab': activeHue }">
          <span
            class="thumb"
            :class="{ 'thumb-ready': thumbReady }"
            :style="{ transform: `translateX(${thumb.x}px)`, width: `${thumb.w}px` }"
            aria-hidden="true"
          ></span>

          <button
            v-for="tab in tabs"
            :key="tab.key"
            :data-active="currentTab === tab.key"
            @click="selectTab(tab.key)"
            class="tab"
            :style="{ '--tab': tab.hue }"
            :aria-current="currentTab === tab.key ? 'page' : undefined"
          >
            <TabIcon :tab="tab.key" :size="13" />
            <span class="lbl">{{ tab.label }}</span>
          </button>
        </nav>
      </div>

      <!-- Avatar -->
      <button
        v-if="userEmail"
        @click.stop="toggleAccount"
        class="hidden sm:flex w-7 h-7 rounded-full bg-mono-800 border border-mono-700 items-center justify-center text-xs font-semibold text-mono-300 hover:border-mono-500 hover:text-mono-100 transition-colors cursor-pointer shrink-0"
        aria-label="Account"
        :aria-expanded="accountOpen"
      >{{ avatarLetter }}</button>
      <button
        v-if="userEmail"
        @click="toggleMenu"
        class="sm:hidden flex w-7 h-7 rounded-full bg-mono-800 border border-mono-700 items-center justify-center text-xs font-semibold text-mono-300 transition-colors cursor-pointer shrink-0"
        aria-label="Account"
      >{{ avatarLetter }}</button>
      <span v-else class="hidden sm:block w-7 shrink-0"></span>
    </div>

    <!-- Mobile scrim -->
    <transition name="fade">
      <div v-if="menuOpen" class="sm:hidden fixed inset-0 z-[-1] bg-mono-950/60 backdrop-blur-[3px]" @click="menuOpen = false"></div>
    </transition>

    <!-- Mobile: anchored nav panel -->
    <transition name="panel">
      <div v-if="menuOpen" class="nav-panel sm:hidden absolute top-full left-3.5 right-3.5 mt-2 p-1.5 rounded-2xl bg-[#101013] border border-[#26262b] shadow-[0_24px_60px_rgba(0,0,0,0.65),0_2px_8px_rgba(0,0,0,0.4)]">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          @click="selectTab(tab.key)"
          class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold tracking-tight cursor-pointer transition-colors"
          :class="currentTab === tab.key ? 'row-active' : 'text-mono-300 active:bg-mono-800'"
          :style="{ '--tab': tab.hue }"
        >
          <TabIcon :tab="tab.key" :size="17" class="shrink-0" />
          <span class="flex-1 text-left">{{ tab.label }}</span>
          <svg v-if="currentTab === tab.key" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" class="shrink-0"><polyline points="20 6 9 17 4 12" /></svg>
        </button>

        <div v-if="userEmail" class="mx-1.5 mt-1.5 mb-1 pt-3 pb-1.5 px-1.5 border-t border-mono-800 flex items-center gap-2.5">
          <span class="flex w-6 h-6 rounded-full bg-mono-800 border border-mono-700 items-center justify-center text-[11px] font-semibold text-mono-300 shrink-0">{{ avatarLetter }}</span>
          <span class="flex-1 text-xs text-mono-500 truncate">{{ userEmail }}</span>
          <button @click="handleLogout" class="shrink-0 text-[11.5px] font-semibold text-mono-500 border border-mono-700 rounded-lg px-2.5 py-1 active:text-mono-300 cursor-pointer">log out</button>
        </div>
      </div>
    </transition>

    <!-- Desktop: account popover -->
    <transition name="panel">
      <div v-if="accountOpen && userEmail" class="account-panel hidden sm:block absolute top-full right-4 mt-2 p-3.5 min-w-56 rounded-2xl bg-[#101013] border border-[#26262b] shadow-[0_24px_60px_rgba(0,0,0,0.65),0_2px_8px_rgba(0,0,0,0.4)]">
        <div class="flex items-center gap-2.5">
          <span class="flex w-7 h-7 rounded-full bg-mono-800 border border-mono-700 items-center justify-center text-xs font-semibold text-mono-300 shrink-0">{{ avatarLetter }}</span>
          <span class="flex-1 text-xs text-mono-400 truncate">{{ userEmail }}</span>
        </div>
        <button @click="handleLogout" class="mt-3 w-full text-[11.5px] font-semibold text-mono-500 border border-mono-700 rounded-lg px-2.5 py-1.5 hover:text-mono-200 hover:border-mono-500 transition-colors cursor-pointer">log out</button>
      </div>
    </transition>
  </header>
</template>

<style scoped>
/* ── Desktop tab rail ───────────────────────────────────────────────────── */

/* A hairline of the active hue along the rail's top edge, so the nav reads as
   belonging to the tab you are on even at a glance. */
.tab-rail::before {
  content: '';
  position: absolute;
  inset: -1px 0 auto;
  height: 1px;
  border-radius: 1px;
  background: linear-gradient(
    to right,
    transparent,
    color-mix(in srgb, var(--tab) 55%, transparent),
    transparent
  );
}

.thumb {
  position: absolute;
  top: 4px;
  bottom: 4px;
  left: 0;
  border-radius: 8px;
  background: color-mix(in srgb, var(--tab) 15%, transparent);
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, var(--tab) 38%, transparent),
    0 2px 10px -2px color-mix(in srgb, var(--tab) 30%, transparent);
}
/* Transitions only after the first measurement — see measureThumb(). */
.thumb-ready {
  transition:
    transform 0.34s cubic-bezier(0.22, 1, 0.36, 1),
    width 0.34s cubic-bezier(0.22, 1, 0.36, 1),
    background-color 0.34s ease,
    box-shadow 0.34s ease;
}

/* The label register the app already uses for section headings (see the essay
   spine's `.sec`): 9.5px, 700, 0.18em, uppercase. Tiempos goes mushy set
   uppercase at a text size with loose tracking, which is what the first pass
   got wrong — small, heavy and widely tracked is what reads as a label. */
.tab {
  position: relative;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 7px 13px;
  border: none;
  background: transparent;
  border-radius: 8px;
  font: inherit;
  font-size: 9.5px;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  /* Constant across states on purpose: a weight change on activation would
     re-measure the thumb mid-slide and make it stutter. */
  color: var(--color-mono-400);
  cursor: pointer;
  transition: color 0.2s ease;
}
/* Letter-spacing adds a trailing gap after the last letter, which pushes the
   label visibly left of centre in its pill. Pull it back. */
.lbl {
  margin-right: -0.18em;
}
.tab:hover {
  color: var(--color-mono-100);
}
.tab[data-active='true'] {
  color: var(--tab);
}
/* The icon leads the eye, so it carries the hue a step earlier than the label. */
.tab:hover :deep(svg) {
  color: color-mix(in srgb, var(--tab) 70%, var(--color-mono-100));
}
.tab :deep(svg) {
  flex-shrink: 0;
}
.tab:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--tab) 60%, transparent);
  outline-offset: 2px;
}

/* ── Mobile panel row ───────────────────────────────────────────────────── */
.row-active {
  color: var(--tab);
  background: color-mix(in srgb, var(--tab) 12%, transparent);
}

/* ── Popover chrome ─────────────────────────────────────────────────────── */

/* Caret pointing at the trigger */
.nav-panel::before {
  content: '';
  position: absolute;
  top: -5px;
  left: 50%;
  width: 9px;
  height: 9px;
  transform: translateX(-50%) rotate(45deg);
  background: #101013;
  border-left: 1px solid #26262b;
  border-top: 1px solid #26262b;
  border-radius: 2px 0 0 0;
}
.account-panel::before {
  content: '';
  position: absolute;
  top: -5px;
  right: 9px;
  width: 9px;
  height: 9px;
  transform: rotate(45deg);
  background: #101013;
  border-left: 1px solid #26262b;
  border-top: 1px solid #26262b;
  border-radius: 2px 0 0 0;
}

.panel-enter-active,
.panel-leave-active {
  transition: opacity 0.16s ease, transform 0.16s ease;
  transform-origin: top center;
}
.panel-enter-from,
.panel-leave-to {
  opacity: 0;
  transform: scale(0.96) translateY(-4px);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.16s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .thumb-ready,
  .panel-enter-active,
  .panel-leave-active,
  .fade-enter-active,
  .fade-leave-active {
    transition: none;
  }
}
</style>
