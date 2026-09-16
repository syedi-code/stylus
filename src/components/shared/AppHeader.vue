<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

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

const tabs = [
  { key: 'notes', label: 'notes', color: 'accent', titleClass: 'text-accent-bright', iconClass: 'text-accent-bright', tint: 'rgba(41,82,255,0.12)', activeText: '#5e84ff' },
  { key: 'thoughts', label: 'thoughts', color: 'rose', titleClass: 'text-rose-bright', iconClass: 'text-rose', tint: 'rgba(244,63,94,0.12)', activeText: '#fb7185' },
  { key: 'quotes', label: 'quotes', color: 'quote', titleClass: 'text-quote-bright', iconClass: 'text-quote', tint: 'rgba(95,194,148,0.12)', activeText: '#7ed4a8' },
  { key: 'essays', label: 'essays', color: 'essay', titleClass: 'text-essay-bright', iconClass: 'text-essay', tint: 'rgba(232,160,64,0.12)', activeText: '#f0b860' },
  { key: 'library', label: 'library', color: 'accent', titleClass: 'text-accent-bright', iconClass: 'text-[#e8d0a8]', tint: 'rgba(41,82,255,0.12)', activeText: '#5e84ff' },
  { key: 'threads', label: 'threads', color: 'purple', titleClass: 'text-purple-400', iconClass: 'text-purple-400', tint: 'rgba(192,132,252,0.12)', activeText: '#c084fc' },
] as const;

const currentTitleClass = computed(
  () => tabs.find((t) => t.key === props.currentTab)?.titleClass ?? 'text-accent-bright',
);

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
 * Publish the header's height as `--app-header-h` on the document root.
 *
 * A full-height tab (the Essays manuscript) has to fill from under this
 * header to the bottom of the viewport. Measuring its OWN offset to work that
 * out is what broke: the six tab transitions in App.vue are separate
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

  if (rootEl.value && typeof ResizeObserver !== 'undefined') {
    headerRO = new ResizeObserver(([entry]) => {
      const h = Math.round(entry.target.getBoundingClientRect().height);
      document.documentElement.style.setProperty('--app-header-h', `${h}px`);
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
        <span class="text-base font-semibold tracking-tight truncate" :class="currentTitleClass">{{ currentTab }}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" class="shrink-0 transition-transform duration-200" :class="menuOpen ? 'rotate-180 text-mono-400' : 'text-mono-600'">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      <!-- Desktop: inline tabs -->
      <nav class="hidden sm:flex flex-1 justify-center gap-1.5 text-xs font-medium tracking-wide uppercase">
        <button v-for="tab in tabs" :key="tab.key" @click="$emit('update:currentTab', tab.key)" class="px-4 py-1.5 rounded-md border border-transparent transition-all duration-200 cursor-pointer" :class="{
          'bg-accent text-white border-accent': currentTab === tab.key && tab.color === 'accent',
          'bg-rose text-white border-rose': currentTab === tab.key && tab.color === 'rose',
          'bg-purple-600 text-white border-purple-600': currentTab === tab.key && tab.color === 'purple',
          'bg-essay text-black border-essay': currentTab === tab.key && tab.color === 'essay',
          'bg-quote text-quote-text border-quote': currentTab === tab.key && tab.color === 'quote',
          'text-mono-500 hover:text-white': currentTab !== tab.key && tab.color === 'accent',
          'text-mono-500 hover:text-rose-bright': currentTab !== tab.key && tab.color === 'rose',
          'text-mono-500 hover:text-purple-400': currentTab !== tab.key && tab.color === 'purple',
          'text-mono-500 hover:text-essay-bright': currentTab !== tab.key && tab.color === 'essay',
          'text-mono-500 hover:text-quote-bright': currentTab !== tab.key && tab.color === 'quote',
        }">
          {{ tab.label }}
        </button>
      </nav>

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
          :class="currentTab === tab.key ? '' : 'text-mono-300 active:bg-mono-800'"
          :style="currentTab === tab.key ? { background: tab.tint, color: tab.activeText } : undefined"
        >
          <span class="flex shrink-0" :class="tab.iconClass">
            <svg v-if="tab.key === 'notes'" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
            <svg v-else-if="tab.key === 'thoughts'" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0-6 6c0 2.5 1.5 3.7 2.3 4.8.5.8.7 1.4.7 2.2h6c0-.8.2-1.4.7-2.2C16.5 12.7 18 11.5 18 9a6 6 0 0 0-6-6Z" /><path d="M9 19h6" /></svg>
            <svg v-else-if="tab.key === 'quotes'" width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M10 8c-2.8 0-5 2.2-5 5 0 1.9 1.5 3.4 3.4 3.4.3 0 .6 0 .9-.1-.5 1.3-1.6 2.3-3 2.6l.5 1.6c3.1-.7 5.2-3.4 5.2-6.7V13c0-2.8-.9-5-2-5Zm9 0c-2.8 0-5 2.2-5 5 0 1.9 1.5 3.4 3.4 3.4.3 0 .6 0 .9-.1-.5 1.3-1.6 2.3-3 2.6l.5 1.6c3.1-.7 5.2-3.4 5.2-6.7V13c0-2.8-.9-5-2-5Z" transform="scale(0.85) translate(2,2)" /></svg>
            <svg v-else-if="tab.key === 'essays'" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6" /><path d="M8 13h8" /><path d="M8 17h5" /></svg>
            <svg v-else-if="tab.key === 'library'" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" /></svg>
            <svg v-else width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="5" r="2.2" /><circle cx="18" cy="12" r="2.2" /><circle cx="8" cy="19" r="2.2" /><path d="M7.8 6.3 16 10.8" /><path d="M16.2 13.6 9.8 17.7" /></svg>
          </span>
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
  .panel-enter-active,
  .panel-leave-active,
  .fade-enter-active,
  .fade-leave-active {
    transition: none;
  }
}
</style>