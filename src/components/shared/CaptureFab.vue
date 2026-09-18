<script setup lang="ts">
// The mobile quick-capture button. Teleported so a tab's own layout can never
// become its containing block, and hidden from `sm` up by CSS rather than a
// resize listener. Colour and position come in as class/style from the caller.
defineOptions({ inheritAttrs: false });

withDefaults(
  defineProps<{
    label: string;
    icon?: 'plus' | 'pen';
  }>(),
  { icon: 'plus' }
);

defineEmits<{ (e: 'click'): void }>();
</script>

<template>
  <Teleport to="body">
    <button
      v-bind="$attrs"
      @click="$emit('click')"
      class="sm:hidden fixed right-6 bottom-6 z-40 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all active:scale-95"
      :aria-label="label"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <template v-if="icon === 'pen'">
          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
          <path d="m15 5 4 4" />
        </template>
        <template v-else>
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </template>
      </svg>
    </button>
  </Teleport>
</template>
