<template>
  <div class="flex flex-col gap-2.5 p-4 border border-mono-800 bg-mono-900 rounded-lg overflow-hidden relative">
    <!-- Gradient bar placeholder -->
    <div class="absolute top-0 left-0 right-0 h-[2px] rounded-t-lg shimmer bg-mono-800"></div>

    <!-- Header: badge + date -->
    <div class="flex items-center justify-between">
      <div class="shimmer h-5 w-14 bg-essay/15 rounded-sm"></div>
      <div class="shimmer h-3 w-20 rounded bg-mono-800"></div>
    </div>

    <!-- Content lines -->
    <div class="mt-1 space-y-2">
      <div class="shimmer h-3.5 w-full rounded bg-mono-800"></div>
      <div class="shimmer h-3.5 w-full rounded bg-mono-800"></div>
      <div class="shimmer h-3.5 w-4/5 rounded bg-mono-800"></div>
    </div>

    <!-- Reference chips placeholder -->
    <div class="flex gap-1.5 mt-1 pt-2.5 border-t border-mono-800">
      <div class="shimmer h-5 w-28 rounded-sm bg-mono-800"></div>
      <div class="shimmer h-5 w-24 rounded-sm bg-mono-800"></div>
    </div>

    <!-- Tags -->
    <div class="flex gap-3 mt-0.5">
      <div class="shimmer h-3 w-12 rounded bg-mono-800/50"></div>
      <div class="shimmer h-3 w-16 rounded bg-mono-800/50"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
</script>

<style scoped>
.shimmer {
  position: relative;
  overflow: hidden;
}
.shimmer::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.04) 50%,
    transparent 100%
  );
  animation: shimmer 2s ease-in-out infinite;
}
@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}
</style>
