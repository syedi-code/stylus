<script setup lang="ts">
import { ref } from 'vue';
import { useAppBoot } from './composables/useAppBoot';
import { showAuthorInLibrary } from './composables/useLibrary';
import AppHeader from './components/shared/AppHeader.vue';
import NotesPage from './components/notes/NotesPage.vue';
import { ThoughtsPage, QuotesPage, EssaysWorkspace, LibraryPage } from './composables/useTabPages';
import TextureDebugOverlay from './components/shared/TextureDebugOverlay.vue';
import SessionBanner from './components/shared/SessionBanner.vue';

const { isAdmin, user, logout } = useAppBoot();

const currentTab = ref('notes');
</script>

<template>
  <div class="min-h-screen bg-mono-950 text-mono-100 selection:bg-accent selection:text-white">
    <AppHeader v-model:currentTab="currentTab" :userEmail="user?.email ?? null" @logout="logout" />

    <main class="w-full">
      <transition name="fade" mode="out-in">
        <NotesPage v-if="currentTab === 'notes'" :isAdmin="isAdmin" @viewInLibrary="(id) => { showAuthorInLibrary(id); currentTab = 'library'; }" />
      </transition>

      <transition name="fade" mode="out-in">
        <ThoughtsPage v-if="currentTab === 'thoughts'" :isAdmin="isAdmin" />
      </transition>

      <transition name="fade" mode="out-in">
        <QuotesPage v-if="currentTab === 'quotes'" :isAdmin="isAdmin" @viewInLibrary="(id) => { showAuthorInLibrary(id); currentTab = 'library'; }" />
      </transition>

      <transition name="fade" mode="out-in">
        <EssaysWorkspace v-if="currentTab === 'essays'" :isAdmin="isAdmin" />
      </transition>

      <transition name="fade" mode="out-in">
        <LibraryPage v-if="currentTab === 'library'" :isAdmin="isAdmin" />
      </transition>
    </main>

    <!-- Opt-in texture-load debug readout (?texdebug=1) — see the component. -->
    <TextureDebugOverlay />

    <SessionBanner />
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
