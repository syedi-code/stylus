<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue';
import {
	createBook,
	updateBook,
	uploadCover,
	uploadPdf,
	getSignedFileUrlCached,
	type BookInput,
	type LibraryBook,
} from '../../lib/api';
import AuthorField from './AuthorField.vue';

const props = defineProps<{
	/** The book being edited, or null to add one. */
	book: LibraryBook | null;
	/** Prefills the title of a new book — from a search that found nothing. */
	initialTitle?: string;
}>();

const emit = defineEmits<{
	(e: 'saved', bookId: string, patch: Partial<LibraryBook>): void;
	(e: 'cancel'): void;
}>();

const b = props.book;
const title = ref(b?.title ?? props.initialTitle ?? '');
const authorId = ref(b?.author_id ?? '');
const authorName = ref(b?.author ?? '');
const year = ref(b?.originally_published ?? '');
const isbn = ref(b?.isbn ?? '');
const description = ref(b?.description ?? '');
const pageOffset = ref(b?.pdf_page_offset ?? 0);
const showMore = ref(!!(b?.isbn || b?.description || b?.pdf_page_offset));

// Files. `null` keeps what is there; a File replaces it; '' removes it.
const pdfFile = ref<File | null>(null);
const pdfRemoved = ref(false);
const coverFile = ref<File | null>(null);
const coverRemoved = ref(false);
const coverPreview = ref<string | null>(null);

const hasPdf = computed(() => !!pdfFile.value || (!!b?.pdf_url && !pdfRemoved.value));
const hasCover = computed(() => !!coverPreview.value);

const pdfInput = ref<HTMLInputElement | null>(null);
const coverInput = ref<HTMLInputElement | null>(null);
const titleInput = ref<HTMLInputElement | null>(null);

const saving = ref(false);
const error = ref<string | null>(null);

const missing = computed(() => {
	if (!title.value.trim()) return 'a title';
	if (!authorId.value) return 'an author';
	return null;
});

onMounted(async () => {
	if (!b) nextTick(() => titleInput.value?.focus());
	if (b?.cover_url) {
		try {
			coverPreview.value = await getSignedFileUrlCached(b.cover_url.replace(/^\/files\//, ''));
		} catch {
			// A cover that won't sign just doesn't preview.
		}
	}
});

let objectUrl: string | null = null;
onBeforeUnmount(() => {
	if (objectUrl) URL.revokeObjectURL(objectUrl);
});

function onPdf(e: Event) {
	const file = (e.target as HTMLInputElement).files?.[0];
	if (!file) return;
	pdfFile.value = file;
	pdfRemoved.value = false;
}

function removePdf() {
	pdfFile.value = null;
	pdfRemoved.value = true;
	if (pdfInput.value) pdfInput.value.value = '';
}

function onCover(e: Event) {
	const file = (e.target as HTMLInputElement).files?.[0];
	if (!file) return;
	coverFile.value = file;
	coverRemoved.value = false;
	if (objectUrl) URL.revokeObjectURL(objectUrl);
	objectUrl = URL.createObjectURL(file);
	coverPreview.value = objectUrl;
}

function removeCover() {
	coverFile.value = null;
	coverRemoved.value = true;
	coverPreview.value = null;
	if (coverInput.value) coverInput.value.value = '';
}

function formatBytes(n: number): string {
	return n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1e3))} KB`;
}

async function save() {
	if (missing.value || saving.value) return;
	saving.value = true;
	error.value = null;
	try {
		let pdfUrl: string | undefined = pdfRemoved.value ? '' : b?.pdf_url;
		if (pdfFile.value) pdfUrl = (await uploadPdf(pdfFile.value, b?.id)).url;

		let coverUrl: string | undefined = coverRemoved.value ? '' : b?.cover_url;
		if (coverFile.value) coverUrl = (await uploadCover(coverFile.value, b?.id)).url;

		const input: BookInput = {
			title: title.value.trim(),
			author: authorName.value,
			author_id: authorId.value,
			originally_published: year.value.trim() || undefined,
			isbn: isbn.value.trim() || undefined,
			description: description.value.trim() || undefined,
			pdf_url: pdfUrl,
			pdf_page_offset: Number(pageOffset.value) || 0,
			cover_url: coverUrl,
		};

		let id = b?.id;
		if (b) await updateBook(b.id, input);
		else id = (await createBook(input)).book.id;

		emit('saved', id!, {
			title: input.title,
			author: input.author,
			author_id: input.author_id,
			originally_published: input.originally_published,
			isbn: input.isbn,
			description: input.description,
			pdf_url: pdfUrl || undefined,
			pdf_page_offset: input.pdf_page_offset,
			cover_url: coverUrl || undefined,
			has_pdf: pdfUrl ? 1 : 0,
		});
	} catch (err) {
		console.error('Failed to save book:', err);
		error.value = 'The book didn’t save. Check your connection and try again — nothing here has been lost.';
	} finally {
		saving.value = false;
	}
}
</script>

<template>
	<form class="form" @submit.prevent="save">
		<label class="field">
			<span class="label">Title</span>
			<input ref="titleInput" v-model="title" class="input title-input" placeholder="The Human Condition" autocomplete="off" />
		</label>

		<div class="field">
			<span class="label">Author</span>
			<AuthorField v-model:author-id="authorId" v-model:author-name="authorName" />
		</div>

		<label class="field narrow">
			<span class="label">First published</span>
			<input v-model="year" class="input" inputmode="numeric" placeholder="1958" maxlength="8" autocomplete="off" />
		</label>

		<!-- The PDF -->
		<div class="field">
			<span class="label">PDF</span>
			<div class="file" :class="{ empty: !hasPdf }">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
					<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" /><path d="M14 3v5h5" />
				</svg>
				<span class="file-name">
					<template v-if="pdfFile">{{ pdfFile.name }} <em>{{ formatBytes(pdfFile.size) }}, uploads when you save</em></template>
					<template v-else-if="hasPdf">A PDF is attached</template>
					<template v-else>No PDF yet</template>
				</span>
				<button type="button" class="link" @click="pdfInput?.click()">{{ hasPdf ? 'Replace' : 'Choose a PDF' }}</button>
				<button v-if="hasPdf" type="button" class="link quiet" @click="removePdf">Remove</button>
				<input ref="pdfInput" type="file" accept="application/pdf" class="hidden" @change="onPdf" />
			</div>
		</div>

		<!-- The cover -->
		<div class="field">
			<span class="label">Cover</span>
			<div class="cover-row">
				<button type="button" class="cover" :class="{ empty: !hasCover }" :aria-label="hasCover ? 'Replace the cover' : 'Choose a cover image'" @click="coverInput?.click()">
					<img v-if="coverPreview" :src="coverPreview" alt="" />
					<svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
				</button>
				<div class="cover-actions">
					<button type="button" class="link" @click="coverInput?.click()">{{ hasCover ? 'Replace' : 'Choose an image' }}</button>
					<button v-if="hasCover" type="button" class="link quiet" @click="removeCover">Remove</button>
				</div>
				<input ref="coverInput" type="file" accept="image/jpeg,image/png,image/webp" class="hidden" @change="onCover" />
			</div>
		</div>

		<button v-if="!showMore" type="button" class="link more" @click="showMore = true">More details</button>
		<template v-else>
			<label class="field narrow">
				<span class="label">ISBN</span>
				<input v-model="isbn" class="input" autocomplete="off" />
			</label>
			<label class="field narrow">
				<span class="label">PDF page offset</span>
				<input v-model.number="pageOffset" class="input" type="number" inputmode="numeric" />
				<span class="hint">When the PDF’s first page isn’t the book’s page 1 — how many pages to skip.</span>
			</label>
			<label class="field">
				<span class="label">Description</span>
				<textarea v-model="description" class="input" rows="3"></textarea>
			</label>
		</template>

		<p v-if="error" class="error" role="alert">{{ error }}</p>

		<div class="actions">
			<button type="submit" class="save" :disabled="!!missing || saving">
				{{ saving ? 'Saving…' : book ? 'Save changes' : 'Add to library' }}
			</button>
			<button type="button" class="cancel" @click="emit('cancel')">Cancel</button>
			<span v-if="missing && !saving" class="needs">Needs {{ missing }}</span>
		</div>
	</form>
</template>

<style scoped>
.form {
	display: flex;
	flex-direction: column;
	gap: 18px;
}
.field {
	display: flex;
	flex-direction: column;
	gap: 7px;
}
.field.narrow {
	max-width: 240px;
}
.label {
	font-size: 13px;
	color: var(--color-mono-300);
}
.hint {
	font-size: 12px;
	font-style: italic;
	color: var(--color-mono-500);
	line-height: 1.4;
}
.input {
	width: 100%;
	padding: 10px 12px;
	background: var(--color-mono-900);
	border: 1px solid var(--color-mono-700);
	border-radius: 9px;
	color: #fff;
	font: inherit;
	font-size: 15px;
	outline: none;
	transition: border-color 0.18s ease;
}
.input:focus {
	border-color: rgb(232 208 168 / 0.7);
}
.input::placeholder {
	color: var(--color-mono-600);
	font-style: italic;
}
.title-input {
	font-size: 19px;
	font-style: italic;
	letter-spacing: -0.01em;
}
textarea.input {
	resize: vertical;
	line-height: 1.45;
}

.file {
	display: flex;
	align-items: center;
	flex-wrap: wrap;
	gap: 6px 14px;
	padding: 11px 13px;
	border: 1px solid var(--color-mono-800);
	border-radius: 9px;
	color: #e8d0a8;
}
.file.empty {
	color: var(--color-mono-500);
	border-style: dashed;
}
.file svg {
	width: 18px;
	height: 18px;
	flex-shrink: 0;
}
.file-name {
	flex: 1;
	min-width: 140px;
	font-size: 14px;
	color: var(--color-mono-200);
	overflow-wrap: anywhere;
}
.file-name em {
	display: block;
	font-size: 12px;
	color: var(--color-mono-500);
}
.file.empty .file-name {
	color: var(--color-mono-500);
	font-style: italic;
}

.cover-row {
	display: flex;
	align-items: center;
	gap: 16px;
}
.cover {
	width: 64px;
	height: 96px;
	flex-shrink: 0;
	display: grid;
	place-items: center;
	padding: 0;
	border-radius: 4px;
	overflow: hidden;
	background: var(--color-mono-900);
	border: 1px solid var(--color-mono-700);
	cursor: pointer;
	color: var(--color-mono-500);
}
.cover.empty {
	border-style: dashed;
}
.cover img {
	width: 100%;
	height: 100%;
	object-fit: cover;
}
.cover svg {
	width: 20px;
	height: 20px;
}
.cover-actions {
	display: flex;
	flex-direction: column;
	align-items: flex-start;
	gap: 6px;
}

.link {
	padding: 0;
	border: none;
	background: none;
	font: inherit;
	font-size: 14px;
	color: #e8d0a8;
	cursor: pointer;
	text-decoration: underline;
	text-decoration-color: rgb(232 208 168 / 0.35);
	text-underline-offset: 3px;
}
.link.quiet {
	color: var(--color-mono-400);
	text-decoration-color: rgb(255 255 255 / 0.15);
}
.link:hover {
	text-decoration-color: currentColor;
}
.more {
	align-self: flex-start;
}

.error {
	margin: 0;
	padding: 10px 12px;
	border-radius: 9px;
	background: rgb(244 63 94 / 0.08);
	color: #fda4af;
	font-size: 14px;
	line-height: 1.4;
}

.actions {
	display: flex;
	align-items: center;
	flex-wrap: wrap;
	gap: 10px 16px;
	padding-top: 4px;
}
.save {
	padding: 10px 18px;
	border: none;
	border-radius: 9px;
	background: #e8d0a8;
	color: #1a1408;
	font: inherit;
	font-size: 15px;
	font-weight: 600;
	cursor: pointer;
	transition:
		opacity 0.18s ease,
		transform 0.12s ease;
}
.save:active:not(:disabled) {
	transform: scale(0.98);
}
.save:disabled {
	opacity: 0.4;
	cursor: not-allowed;
}
.cancel {
	padding: 10px 4px;
	border: none;
	background: none;
	font: inherit;
	font-size: 15px;
	color: var(--color-mono-400);
	cursor: pointer;
}
.cancel:hover {
	color: var(--color-mono-100);
}
.needs {
	font-size: 13px;
	font-style: italic;
	color: var(--color-mono-500);
}
</style>
