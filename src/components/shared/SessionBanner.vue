<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { openSignIn, renewSession, useSession } from '../../lib/session';
import { pendingWrites } from '../../lib/http';

/**
 * Says what the connection is doing when it is not simply working: signed
 * out, unreachable, or offline. The page and anything unsaved stay put
 * underneath; writes that could not go are waiting, and go once it clears.
 */
const { status } = useSession();
const online = ref(typeof navigator === 'undefined' ? true : navigator.onLine);
const setOnline = () => (online.value = navigator.onLine);

onMounted(() => {
  window.addEventListener('online', setOnline);
  window.addEventListener('offline', setOnline);
});
onBeforeUnmount(() => {
  window.removeEventListener('online', setOnline);
  window.removeEventListener('offline', setOnline);
});

const waiting = computed(() =>
  pendingWrites.value > 0 ? ' Your changes are kept and will save once you are back.' : ''
);

const banner = computed(() => {
  if (!online.value) {
    return { tone: 'quiet', text: `You are offline.${waiting.value}`, action: null };
  }
  if (status.value === 'signed-out') {
    return {
      tone: 'warn',
      text: `Your sign-in has expired.${waiting.value}`,
      action: { label: 'Sign in', run: openSignIn },
    };
  }
  if (status.value === 'unreachable') {
    return {
      tone: 'warn',
      text: 'Could not reach the server.',
      action: { label: 'Try again', run: () => void renewSession().catch(() => {}) },
    };
  }
  return null;
});
</script>

<template>
  <Transition name="banner">
    <div v-if="banner" class="session-banner" :class="banner.tone" role="status" aria-live="polite">
      <span class="text">{{ banner.text }}</span>
      <button v-if="banner.action" type="button" class="action" @click="banner.action.run">
        {{ banner.action.label }}
      </button>
    </div>
  </Transition>
</template>

<style scoped>
.session-banner {
  position: fixed;
  left: 50%;
  bottom: calc(16px + env(safe-area-inset-bottom));
  transform: translateX(-50%);
  z-index: 60;
  display: flex;
  align-items: center;
  gap: 14px;
  max-width: calc(100vw - 32px);
  padding: 10px 10px 10px 16px;
  border-radius: 12px;
  border: 1px solid var(--color-mono-700);
  background: rgb(9 9 11 / 0.92);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  box-shadow: 0 12px 32px rgb(0 0 0 / 0.45);
  color: var(--color-mono-100);
  font-size: 13px;
  line-height: 1.4;
}

.session-banner.quiet {
  padding-right: 16px;
}

.session-banner.warn {
  border-color: rgb(244 63 94 / 0.35);
}

.text {
  min-width: 0;
}

.action {
  flex-shrink: 0;
  padding: 6px 12px;
  border-radius: 8px;
  background: var(--color-accent);
  color: var(--color-accent-text);
  font-weight: 600;
  font-size: 12.5px;
  transition: background-color 0.15s ease;
}

.action:hover {
  background: var(--color-accent-bright);
}

.action:focus-visible {
  outline: 2px solid var(--color-accent-bright);
  outline-offset: 2px;
}

.banner-enter-active,
.banner-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.banner-enter-from,
.banner-leave-to {
  opacity: 0;
  transform: translate(-50%, 8px);
}

@media (prefers-reduced-motion: reduce) {
  .banner-enter-active,
  .banner-leave-active {
    transition: opacity 0.2s ease;
  }

  .banner-enter-from,
  .banner-leave-to {
    transform: translateX(-50%);
  }
}
</style>
