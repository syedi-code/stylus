<script setup lang="ts">
/**
 * Auto-fading wrapper for presentation-view chrome (action buttons, close).
 *
 * Pairs with `useAutoChrome`, which owns the inactivity timer and exposes the
 * `visible` flag. This component is the single source of truth for *how* that
 * chrome fades — opacity transition plus pointer-events suppression while
 * hidden — so the Note / Quote / Thought presentation views share one
 * fade-away behavior (mirroring the essay deck) instead of duplicating it.
 *
 * The wrapper itself is layout-neutral: its slotted children are expected to
 * be absolutely positioned against the presentation's fixed root.
 */
defineProps<{ visible: boolean }>();
</script>

<template>
    <div
        class="transition-opacity duration-300"
        :class="visible ? 'opacity-100' : 'opacity-0 pointer-events-none'"
    >
        <slot />
    </div>
</template>
