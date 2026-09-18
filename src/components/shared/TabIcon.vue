<script setup lang="ts">
// One glyph per tab, shared by the desktop nav and the mobile panel so the two
// can never drift. Inherits `currentColor` and sizes from the `size` prop.
withDefaults(defineProps<{ tab: string; size?: number }>(), { size: 17 });
</script>

<template>
  <svg :width="size" :height="size" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <template v-if="tab === 'notes'">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </template>
    <template v-else-if="tab === 'thoughts'">
      <path d="M12 3a6 6 0 0 0-6 6c0 2.5 1.5 3.7 2.3 4.8.5.8.7 1.4.7 2.2h6c0-.8.2-1.4.7-2.2C16.5 12.7 18 11.5 18 9a6 6 0 0 0-6-6Z" />
      <path d="M9 19h6" />
    </template>
    <template v-else-if="tab === 'quotes'">
      <path fill="currentColor" stroke="none" d="M10 8c-2.8 0-5 2.2-5 5 0 1.9 1.5 3.4 3.4 3.4.3 0 .6 0 .9-.1-.5 1.3-1.6 2.3-3 2.6l.5 1.6c3.1-.7 5.2-3.4 5.2-6.7V13c0-2.8-.9-5-2-5Zm9 0c-2.8 0-5 2.2-5 5 0 1.9 1.5 3.4 3.4 3.4.3 0 .6 0 .9-.1-.5 1.3-1.6 2.3-3 2.6l.5 1.6c3.1-.7 5.2-3.4 5.2-6.7V13c0-2.8-.9-5-2-5Z" transform="scale(0.85) translate(2,2)" />
    </template>
    <template v-else-if="tab === 'essays'">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <path d="M14 2v6h6" />
      <path d="M8 13h8" />
      <path d="M8 17h5" />
    </template>
    <template v-else-if="tab === 'library'">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
    </template>
  </svg>
</template>
