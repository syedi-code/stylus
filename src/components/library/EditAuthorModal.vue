<script setup lang="ts">
import { ref, watch } from 'vue';
import { createAuthor, updateAuthor, type Author, type AuthorInput } from '../../lib/api';

const props = defineProps<{
  author: Author | null;
  isOpen: boolean;
}>();

const emit = defineEmits(['close', 'saved']);

const name = ref('');
const bio = ref('');
const born = ref('');
const died = ref('');
const loading = ref(false);

const isEditing = ref(false);

watch(() => props.author, (newAuthor) => {
  if (newAuthor) {
    isEditing.value = true;
    name.value = newAuthor.name;
    bio.value = newAuthor.bio || '';
    born.value = newAuthor.born || '';
    died.value = newAuthor.died || '';
  } else {
    isEditing.value = false;
    resetForm();
  }
});

watch(() => props.isOpen, (open) => {
  if (open && !props.author) {
    resetForm();
  }
});

const resetForm = () => {
  name.value = '';
  bio.value = '';
  born.value = '';
  died.value = '';
};

const close = () => {
  emit('close');
  resetForm();
};

const save = async () => {
  if (!name.value.trim()) return;

  loading.value = true;
  try {
    const authorData: AuthorInput = {
      name: name.value.trim(),
      bio: bio.value.trim() || undefined,
      born: born.value.trim() || undefined,
      died: died.value.trim() || undefined,
    };

    if (isEditing.value && props.author) {
      await updateAuthor(props.author.id, authorData);
    } else {
      await createAuthor(authorData);
    }

    emit('saved');
    close();
  } catch (e) {
    console.error(e);
    alert('Failed to save author.');
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <!-- Backdrop -->
    <div class="absolute inset-0 bg-black/80 backdrop-blur-sm" @click="close"></div>

    <!-- Modal -->
    <div class="relative w-full max-w-lg bg-mono-900 border border-mono-700 shadow-2xl rounded-xl p-5 flex flex-col gap-4">

      <h3 class="text-base font-semibold text-white uppercase tracking-wide flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-accent">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
        {{ isEditing ? 'Edit Author' : 'Add Author' }}
      </h3>

      <!-- Name -->
      <div class="flex flex-col gap-1.5">
        <label class="text-xs text-mono-400 uppercase tracking-wide">Name <span class="text-accent">*</span></label>
        <input v-model="name" type="text" class="w-full bg-mono-950 border border-mono-800 rounded-lg px-4 py-2.5 text-mono-100 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent text-sm" placeholder="Author name" @keydown.enter="save" />
      </div>

      <!-- Bio -->
      <div class="flex flex-col gap-1.5">
        <label class="text-xs text-mono-400 uppercase tracking-wide">Bio</label>
        <textarea v-model="bio" class="w-full bg-mono-950 border border-mono-800 rounded-lg p-4 h-20 text-mono-100 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent resize-none text-sm leading-relaxed" placeholder="Optional biography..."></textarea>
      </div>

      <!-- Born & Died row -->
      <div class="grid grid-cols-2 gap-4">
        <div class="flex flex-col gap-1.5">
          <label class="text-xs text-mono-400 uppercase tracking-wide">Born</label>
          <input v-model="born" type="text" class="w-full bg-mono-950 border border-mono-800 rounded-lg px-4 py-2.5 text-mono-100 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent text-sm" placeholder="e.g., 1984, 4 BCE" />
        </div>

        <div class="flex flex-col gap-1.5">
          <label class="text-xs text-mono-400 uppercase tracking-wide">Died</label>
          <input v-model="died" type="text" class="w-full bg-mono-950 border border-mono-800 rounded-lg px-4 py-2.5 text-mono-100 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent text-sm" placeholder="e.g., 2024, leave empty if alive" />
        </div>
      </div>

      <!-- Actions -->
      <div class="flex justify-end gap-2 pt-2">
        <button @click="close" class="px-4 py-2 text-mono-400 hover:text-white transition-colors cursor-pointer">
          Cancel
        </button>
        <button @click="save" :disabled="loading || !name.trim()" class="px-5 py-2 bg-accent hover:bg-accent-bright disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors cursor-pointer flex items-center gap-2">
          <span v-if="loading" class="animate-spin">
            <svg class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </span>
          {{ loading ? 'Saving...' : (isEditing ? 'Update' : 'Add Author') }}
        </button>
      </div>
    </div>
  </div>
</template>
