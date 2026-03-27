<template>
  <div class="bg-mono-900 border border-rose/20 rounded-xl p-4">
    <!-- Content lines -->
    <div class="space-y-2">
      <SkeletonBlock widthClass="w-full" heightClass="h-4" />
      <SkeletonBlock widthClass="w-4/5" heightClass="h-4" />
    </div>

    <!-- Mood -->
    <div class="flex items-center gap-2 mt-3">
      <SkeletonBlock widthClass="w-8" heightClass="h-5" />
      <SkeletonBlock widthClass="w-16" heightClass="h-5 rounded-full" />
    </div>

    <!-- Footer -->
    <div class="flex items-center justify-between mt-3 pt-3 border-t border-mono-800">
      <SkeletonBlock widthClass="w-28" heightClass="h-3" />
      <div class="flex gap-1">
        <SkeletonBlock widthClass="w-6" heightClass="h-6" />
        <SkeletonBlock widthClass="w-6" heightClass="h-6" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import SkeletonBlock from '../shared/SkeletonBlock.vue';
</script>
