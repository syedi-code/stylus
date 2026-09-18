<script setup lang="ts">
import { ref } from 'vue';
import ThoughtCapture from './ThoughtCapture.vue';
import ThoughtsList from './ThoughtsList.vue';
import MobileThoughtCapture from './MobileThoughtCapture.vue';
import CaptureFab from '../shared/CaptureFab.vue';

defineProps<{
  isAdmin?: boolean;
}>();

const listRef = ref<InstanceType<typeof ThoughtsList> | null>(null);
const captureOpen = ref(false);
</script>

<template>
  <div class="max-w-3xl mx-auto px-4 mt-4 sm:mt-8 pb-20 space-y-8">
    <!-- Desktop capture; mobile uses the FAB sheet instead -->
    <div class="hidden sm:block">
      <ThoughtCapture @saved="listRef?.reload()" />
    </div>
    <div class="hidden sm:block border-t border-rose/20"></div>

    <ThoughtsList ref="listRef" :isAdmin="isAdmin" />

    <MobileThoughtCapture :isOpen="captureOpen" @close="captureOpen = false" @saved="listRef?.reload()" />
    <CaptureFab label="Quick Thought" class="bg-rose active:bg-rose-bright shadow-rose/30 text-white" @click="captureOpen = true" />
  </div>
</template>
