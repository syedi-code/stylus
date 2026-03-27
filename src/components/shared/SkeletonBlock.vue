<template>
  <div class="animate-pulse rounded bg-mono-800" :class="[widthClass, heightClass]"></div>
</template>

<script setup lang="ts">
defineProps<{
  widthClass?: string;
  heightClass?: string;
}>();
</script>
