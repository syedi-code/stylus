<script setup lang="ts">
import { ref } from 'vue';

defineProps<{
  currentTab: string;
  userEmail?: string | null;
}>();

const emit = defineEmits<{
  (e: 'update:currentTab', value: string): void;
  (e: 'logout'): void;
}>();

const menuOpen = ref(false);

const tabs = [
  { key: 'notes', label: 'notes', color: 'accent' },
  { key: 'thoughts', label: 'thoughts', color: 'rose' },
  { key: 'quotes', label: 'quotes', color: 'accent' },
  { key: 'library', label: 'library', color: 'accent' },
  { key: 'threads', label: 'threads', color: 'purple' },
] as const;

function selectTab(tab: string) {
  emit('update:currentTab', tab);
  menuOpen.value = false;
}
</script>

<template>
  <header class="pt-6 pb-4 text-center border-b border-mono-900 bg-mono-950">
    <h1 class="flex items-center justify-center gap-2.5 text-xl font-semibold tracking-tight text-white">
      <svg width="34" height="34" viewBox="9 8 32 32" xmlns="http://www.w3.org/2000/svg" class="shrink-0 text-accent translate-y-[1px]">
        <clipPath id="leftCrack">
          <polygon points="0,0 24,0 26,18 22,23 26,28 23,36 0,36 0,0" />
        </clipPath>
        <clipPath id="rightCrack">
          <polygon points="50,0 27,0 29,18 25,23 29,28 26,36 50,36 50,0" />
        </clipPath>
        <polygon points="11,36 25,12 39,36" fill="currentColor" clip-path="url(#leftCrack)" />
        <polygon points="11,36 25,12 39,36" fill="currentColor" clip-path="url(#rightCrack)" />
      </svg>
      antisocial eating
    </h1>
    <div class="h-0.5 w-8 bg-accent mx-auto mt-3 mb-1"></div>
    <div v-if="userEmail" class="flex items-center justify-center gap-2 mt-6">
      <p class="text-xs text-mono-600">{{ userEmail }}</p>
      <button @click="$emit('logout')" class="text-xs text-mono-600 hover:text-mono-400 transition-colors cursor-pointer">log out</button>
    </div>

    <!-- Desktop tabs -->
    <div class="hidden sm:flex justify-center gap-1.5 mt-4 text-xs font-medium tracking-wide uppercase px-4">
      <button v-for="tab in tabs" :key="tab.key" @click="$emit('update:currentTab', tab.key)" class="px-4 py-1.5 rounded-md border border-transparent transition-all duration-200 cursor-pointer" :class="{
        'bg-accent text-white border-accent': currentTab === tab.key && tab.color === 'accent',
        'bg-rose text-white border-rose': currentTab === tab.key && tab.color === 'rose',
        'bg-purple-600 text-white border-purple-600': currentTab === tab.key && tab.color === 'purple',
        'text-mono-500 hover:text-white': currentTab !== tab.key && tab.color === 'accent',
        'text-mono-500 hover:text-rose-bright': currentTab !== tab.key && tab.color === 'rose',
        'text-mono-500 hover:text-purple-400': currentTab !== tab.key && tab.color === 'purple',
      }">
        {{ tab.label }}
      </button>
    </div>

    <!-- Mobile: current tab + chevron -->
    <div class="sm:hidden mt-4 px-5">
      <button @click="menuOpen = !menuOpen" class="w-full flex items-center justify-center gap-1.5 py-1 cursor-pointer group" aria-label="Toggle navigation">
        <span class="text-sm font-semibold tracking-tight" :class="{
          'text-accent': ['notes', 'quotes', 'library', 'fonts'].includes(currentTab),
          'text-rose-bright': currentTab === 'thoughts',
          'text-purple-400': currentTab === 'threads',
        }">
          {{ currentTab }}
        </span>
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-mono-500 transition-transform duration-200" :class="menuOpen ? 'rotate-180' : ''">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      <!-- Dropdown -->
      <transition name="menu-slide">
        <div v-if="menuOpen" class="flex flex-col items-center gap-0.5 mt-2 pb-1">
          <button v-for="tab in tabs" :key="tab.key" @click="selectTab(tab.key)" class="text-sm font-semibold tracking-tight transition-colors cursor-pointer py-1.5 px-3 rounded" :class="{
            'text-accent': currentTab === tab.key && tab.color === 'accent',
            'text-rose-bright': currentTab === tab.key && tab.color === 'rose',
            'text-purple-400': currentTab === tab.key && tab.color === 'purple',
            'text-mono-500 active:text-mono-300': currentTab !== tab.key,
          }">
            {{ tab.label }}
          </button>
        </div>
      </transition>
    </div>
  </header>
</template>

<style scoped>
.menu-slide-enter-active,
.menu-slide-leave-active {
  transition: all 0.15s ease;
}

.menu-slide-enter-from,
.menu-slide-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>