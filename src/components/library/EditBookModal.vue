<script setup lang="ts">
import { ref, watch } from 'vue';
import { createBook, updateBook, uploadPdf, uploadCover, type Book, type BookInput, type Author } from '../../lib/api';
import AuthorSelector from './AuthorSelector.vue';

const props = defineProps<{
  book: Book | null;
  isOpen: boolean;
}>();

const emit = defineEmits(['close', 'saved']);

const title = ref('');
const authorId = ref('');
const description = ref('');
const isbn = ref('');
const originallyPublished = ref('');
const pdfUrl = ref('');
const pdfPageOffset = ref(0);
const coverUrl = ref('');
const loading = ref(false);
const uploadingPdf = ref(false);
const uploadingCover = ref(false);
const pdfFile = ref<File | null>(null);
const coverFile = ref<File | null>(null);
const pdfInputRef = ref<HTMLInputElement | null>(null);
const coverInputRef = ref<HTMLInputElement | null>(null);
const authorSelectorRef = ref<InstanceType<typeof AuthorSelector> | null>(null);

const isEditing = ref(false);

watch(() => props.book, (newBook) => {
  if (newBook) {
    isEditing.value = true;
    title.value = newBook.title;
    authorId.value = newBook.author_id || '';
    description.value = newBook.description || '';
    isbn.value = newBook.isbn || '';
    originallyPublished.value = newBook.originally_published || '';
    pdfUrl.value = newBook.pdf_url || '';
    pdfPageOffset.value = newBook.pdf_page_offset || 0;
    coverUrl.value = newBook.cover_url || '';
  } else {
    isEditing.value = false;
    resetForm();
  }
});

watch(() => props.isOpen, (open) => {
  if (open && !props.book) {
    resetForm();
  }
});

const resetForm = () => {
  title.value = '';
  authorId.value = '';
  description.value = '';
  isbn.value = '';
  originallyPublished.value = '';
  pdfUrl.value = '';
  pdfPageOffset.value = 0;
  pdfFile.value = null;
  coverUrl.value = '';
  coverFile.value = null;
};

const close = () => {
  emit('close');
  resetForm();
};

const handlePdfSelect = (event: Event) => {
  const input = event.target as HTMLInputElement;
  if (input.files && input.files[0]) {
    pdfFile.value = input.files[0];
  }
};

const uploadPdfFile = async (): Promise<string | undefined> => {
  if (!pdfFile.value) return pdfUrl.value || undefined;

  uploadingPdf.value = true;
  try {
    const result = await uploadPdf(pdfFile.value, props.book?.id);
    return result.url;
  } catch (err) {
    console.error('PDF upload failed:', err);
    throw err;
  } finally {
    uploadingPdf.value = false;
  }
};

const handleCoverSelect = (event: Event) => {
  const input = event.target as HTMLInputElement;
  if (input.files && input.files[0]) {
    coverFile.value = input.files[0];
  }
};

const uploadCoverFile = async (): Promise<string | undefined> => {
  if (!coverFile.value) return coverUrl.value || undefined;

  uploadingCover.value = true;
  try {
    const result = await uploadCover(coverFile.value, props.book?.id);
    return result.url;
  } catch (err) {
    console.error('Cover upload failed:', err);
    throw err;
  } finally {
    uploadingCover.value = false;
  }
};

const save = async () => {
  if (!title.value.trim() || !authorId.value) return;

  // Resolve author name from the selector's loaded authors list
  const selectedAuthor = authorSelectorRef.value?.authors?.find(
    (a: Author) => a.id === authorId.value
  );
  const authorName = selectedAuthor?.name || '';

  loading.value = true;
  try {
    // Upload PDF first if selected
    let finalPdfUrl = pdfUrl.value || undefined;
    if (pdfFile.value) {
      finalPdfUrl = await uploadPdfFile();
    }

    // Upload cover if selected
    let finalCoverUrl = coverUrl.value || undefined;
    if (coverFile.value) {
      finalCoverUrl = await uploadCoverFile();
    }

    const bookData: BookInput = {
      title: title.value.trim(),
      author: authorName,
      author_id: authorId.value,
      description: description.value.trim() || undefined,
      isbn: isbn.value.trim() || undefined,
      originally_published: originallyPublished.value.trim() || undefined,
      pdf_url: finalPdfUrl,
      pdf_page_offset: pdfPageOffset.value || 0,
      cover_url: finalCoverUrl,
    };

    if (isEditing.value && props.book) {
      await updateBook(props.book.id, bookData);
    } else {
      await createBook(bookData);
    }

    emit('saved');
    close();
  } catch (e) {
    console.error(e);
    alert('Failed to save book.');
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
          <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20" />
        </svg>
        {{ isEditing ? 'Edit Book' : 'Add Book' }}
      </h3>

      <!-- Title -->
      <div class="flex flex-col gap-1.5">
        <label class="text-xs text-mono-400 uppercase tracking-wide">Title <span class="text-accent">*</span></label>
        <input v-model="title" type="text" class="w-full bg-mono-950 border border-mono-800 rounded-lg px-4 py-2.5 text-mono-100 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent text-sm" placeholder="Book title" @keydown.enter="save" />
      </div>

      <!-- Author -->
      <AuthorSelector ref="authorSelectorRef" v-model="authorId" />

      <!-- Description -->
      <div class="flex flex-col gap-1.5">
        <label class="text-xs text-mono-400 uppercase tracking-wide">Description</label>
        <textarea v-model="description" class="w-full bg-mono-950 border border-mono-800 rounded-lg p-4 h-20 text-mono-100 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent resize-none text-sm leading-relaxed" placeholder="Optional description..."></textarea>
      </div>

      <!-- ISBN & Year row -->
      <div class="grid grid-cols-2 gap-4">
        <div class="flex flex-col gap-1.5">
          <label class="text-xs text-mono-400 uppercase tracking-wide">ISBN</label>
          <input v-model="isbn" type="text" class="w-full bg-mono-950 border border-mono-800 rounded-lg px-4 py-2.5 text-mono-100 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent text-sm" placeholder="978-..." />
        </div>

        <div class="flex flex-col gap-1.5">
          <label class="text-xs text-mono-400 uppercase tracking-wide">Originally Published</label>
          <input v-model="originallyPublished" type="text" class="w-full bg-mono-950 border border-mono-800 rounded-lg px-4 py-2.5 text-mono-100 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent text-sm" placeholder="e.g., 1984, 237 BCE" />
        </div>
      </div>

      <!-- PDF Upload -->
      <div class="flex flex-col gap-1.5">
        <label class="text-xs text-mono-400 uppercase tracking-wide">PDF</label>
        <div class="flex items-center gap-2">
          <input ref="pdfInputRef" type="file" accept=".pdf,application/pdf" class="hidden" @change="handlePdfSelect" />
          <button @click="pdfInputRef?.click()" type="button" class="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-mono-800 border border-mono-700 rounded-lg text-sm text-mono-300 hover:bg-mono-700 hover:text-white transition-colors cursor-pointer">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" x2="12" y1="3" y2="15" />
            </svg>
            {{ pdfFile ? 'Change' : pdfUrl ? 'Replace' : 'Upload' }}
          </button>
          <span v-if="pdfFile || pdfUrl" class="text-xs text-accent">
            {{ pdfFile ? pdfFile.name.slice(0, 15) + '...' : 'PDF attached' }}
          </span>
        </div>
      </div>

      <!-- PDF Page Offset (only when PDF is attached) -->
      <div v-if="pdfFile || pdfUrl" class="flex flex-col gap-1.5">
        <label class="text-xs text-mono-400 uppercase tracking-wide">
          PDF Page Offset
          <span class="text-mono-600 normal-case ml-1">(print page + offset = PDF page)</span>
        </label>
        <div class="flex items-center gap-3">
          <input v-model.number="pdfPageOffset" type="number" class="w-24 bg-mono-950 border border-mono-800 rounded-lg px-4 py-2.5 text-mono-100 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent text-sm" placeholder="0" />
          <span class="text-xs text-mono-500">
            e.g., if print page 1 is on PDF page 15, offset is 14
          </span>
        </div>
      </div>

      <!-- Cover Image Upload (JPEG/PNG/WebP) — surfaces only as the
           book-cover slide kind in essay presentation. -->
      <div class="flex flex-col gap-1.5">
        <label class="text-xs text-mono-400 uppercase tracking-wide">Cover image</label>
        <div class="flex items-center gap-2">
          <input ref="coverInputRef" type="file" accept="image/jpeg,image/png,image/webp" class="hidden" @change="handleCoverSelect" />
          <button @click="coverInputRef?.click()" type="button" class="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-mono-800 border border-mono-700 rounded-lg text-sm text-mono-300 hover:bg-mono-700 hover:text-white transition-colors cursor-pointer">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
              <circle cx="9" cy="9" r="2" />
              <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
            </svg>
            {{ coverFile ? 'Change' : coverUrl ? 'Replace' : 'Upload' }}
          </button>
          <span v-if="coverFile" class="text-xs text-essay">{{ coverFile.name.slice(0, 15) }}{{ coverFile.name.length > 15 ? '…' : '' }}</span>
          <span v-else-if="coverUrl" class="text-xs text-essay">Cover attached</span>
        </div>
      </div>

      <!-- Actions -->
      <div class="flex justify-end gap-2 pt-2">
        <button @click="close" class="px-4 py-2 text-mono-400 hover:text-white transition-colors cursor-pointer">
          Cancel
        </button>
        <button @click="save" :disabled="loading || uploadingPdf || uploadingCover || !title.trim() || !authorId" class="px-5 py-2 bg-accent hover:bg-accent-bright disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors cursor-pointer flex items-center gap-2">
          <span v-if="loading || uploadingPdf || uploadingCover" class="animate-spin">
            <svg class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </span>
          {{ uploadingPdf ? 'Uploading PDF…' : uploadingCover ? 'Uploading cover…' : (loading ? 'Saving...' : (isEditing ? 'Update' : 'Add Book')) }}
        </button>
      </div>
    </div>
  </div>
</template>
