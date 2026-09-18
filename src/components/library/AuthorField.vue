<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { createAuthor, fetchAuthors, type Author } from '../../lib/api';
import { parseAuthors } from '../../lib/bookAttribution';
import { fold, lifespan } from '../../lib/library';

/**
 * Who wrote it — typed, not picked from a list first.
 *
 * Start typing a name and the matching authors appear beneath, in the order a
 * reader expects; a name that isn't there yet can be added in the same motion.
 * The suggestions sit in the flow rather than floating over the form, so on a
 * phone nothing is clipped by the sheet or covered by the keyboard.
 */
const authorId = defineModel<string>('authorId', { default: '' });
const authorName = defineModel<string>('authorName', { default: '' });

// Shared across forms: the author list is fetched once per session.
const authors = ref<Author[]>(cache ?? []);
const text = ref(authorName.value);
const focused = ref(false);
const active = ref(0);
const adding = ref(false);
const error = ref<string | null>(null);

onMounted(async () => {
	if (cache) return;
	try {
		cache = await fetchAuthors({ limit: 1000 });
		authors.value = cache;
	} catch (err) {
		console.error('Failed to load authors:', err);
	}
});

const selected = computed(() => authors.value.find((a) => a.id === authorId.value) ?? null);

const matches = computed(() => {
	const q = fold(text.value.trim());
	if (!q || (selected.value && selected.value.name === text.value)) return [];
	return authors.value
		.filter((a) => fold(a.name).includes(q))
		.sort((a, b) => Number(!fold(a.name).startsWith(q)) - Number(!fold(b.name).startsWith(q)) || a.name.localeCompare(b.name))
		.slice(0, 6);
});

const exact = computed(() => authors.value.some((a) => fold(a.name) === fold(text.value.trim())));
const canAdd = computed(() => !!text.value.trim() && !exact.value);
const options = computed(() => matches.value.length + (canAdd.value ? 1 : 0));
const open = computed(() => focused.value && options.value > 0);

function onInput() {
	active.value = 0;
	// Typing over a chosen author un-chooses them until a new one is picked.
	if (selected.value && selected.value.name !== text.value) {
		authorId.value = '';
		authorName.value = '';
	}
}

function choose(a: Author) {
	authorId.value = a.id;
	authorName.value = a.name;
	text.value = a.name;
	focused.value = false;
}

async function addNew() {
	const name = text.value.trim();
	if (!name || adding.value) return;
	adding.value = true;
	error.value = null;
	try {
		const { author } = await createAuthor({ name });
		authors.value = [...authors.value, author];
		cache = authors.value;
		choose(author);
	} catch (err) {
		console.error('Failed to add author:', err);
		error.value = `Couldn’t add ${name}. Try again.`;
	} finally {
		adding.value = false;
	}
}

function onKey(e: KeyboardEvent) {
	if (!open.value) return;
	if (e.key === 'ArrowDown') {
		e.preventDefault();
		active.value = (active.value + 1) % options.value;
	} else if (e.key === 'ArrowUp') {
		e.preventDefault();
		active.value = (active.value - 1 + options.value) % options.value;
	} else if (e.key === 'Enter') {
		e.preventDefault();
		if (active.value < matches.value.length) choose(matches.value[active.value]);
		else addNew();
	} else if (e.key === 'Escape') {
		e.stopPropagation();
		focused.value = false;
	}
}

// Let a tap on a suggestion land before the blur hides the list.
function onBlur() {
	setTimeout(() => (focused.value = false), 150);
}

const surname = (name: string) => parseAuthors(name)[0];
</script>

<script lang="ts">
let cache: Author[] | null = null;
</script>

<template>
	<div class="author-field">
		<div class="box" :class="{ chosen: !!selected, open }">
			<input
				v-model="text"
				class="input"
				placeholder="Start typing a name"
				autocomplete="off"
				role="combobox"
				:aria-expanded="open"
				aria-autocomplete="list"
				@input="onInput"
				@focus="focused = true"
				@blur="onBlur"
				@keydown="onKey"
			/>
			<span v-if="selected" class="dates">{{ lifespan(selected.born, selected.died) }}</span>
		</div>

		<ul v-if="open" class="options" role="listbox">
			<li
				v-for="(a, i) in matches"
				:key="a.id"
				role="option"
				:aria-selected="i === active"
				class="option"
				:class="{ active: i === active }"
				@mousedown.prevent="choose(a)"
				@mouseenter="active = i"
			>
				<span class="name"><span class="fp">{{ surname(a.name)?.firstParts }}</span><span class="ln" :style="{ color: surname(a.name)?.color }">{{ surname(a.name)?.lastName }}</span><span class="fp">{{ surname(a.name)?.suffix }}</span></span>
				<span class="dates">{{ lifespan(a.born, a.died) }}</span>
			</li>
			<li
				v-if="canAdd"
				role="option"
				:aria-selected="active === matches.length"
				class="option add"
				:class="{ active: active === matches.length }"
				@mousedown.prevent="addNew"
				@mouseenter="active = matches.length"
			>
				{{ adding ? 'Adding…' : `Add “${text.trim()}” as a new author` }}
			</li>
		</ul>
		<p v-if="error" class="error">{{ error }}</p>
	</div>
</template>

<style scoped>
.box {
	display: flex;
	align-items: center;
	gap: 10px;
	padding-right: 12px;
	background: var(--color-mono-900);
	border: 1px solid var(--color-mono-700);
	border-radius: 9px;
	transition: border-color 0.18s ease;
}
.box:focus-within {
	border-color: rgb(232 208 168 / 0.7);
}
.box.open {
	border-bottom-left-radius: 0;
	border-bottom-right-radius: 0;
}
.input {
	flex: 1;
	min-width: 0;
	padding: 10px 12px;
	border: none;
	outline: none;
	background: none;
	font: inherit;
	font-size: 16px;
	color: #fff;
}
.input::placeholder {
	color: var(--color-mono-600);
	font-style: italic;
}
.box.chosen .input {
	color: #e8d0a8;
}
.dates {
	flex-shrink: 0;
	font-size: 13px;
	font-style: italic;
	color: var(--color-mono-500);
	font-variant-numeric: lining-nums;
}
.options {
	margin: 0;
	padding: 4px;
	list-style: none;
	background: var(--color-mono-900);
	border: 1px solid rgb(232 208 168 / 0.7);
	border-top: none;
	border-radius: 0 0 9px 9px;
}
.option {
	display: flex;
	align-items: baseline;
	justify-content: space-between;
	gap: 12px;
	padding: 10px 10px;
	border-radius: 6px;
	font-size: 15px;
	cursor: pointer;
}
.option.active {
	background: rgb(255 255 255 / 0.06);
}
.fp {
	color: var(--color-mono-200);
}
.ln {
	font-weight: 500;
}
.option.add {
	color: #e8d0a8;
	font-style: italic;
}
.error {
	margin: 6px 0 0;
	font-size: 13px;
	color: #fda4af;
}
</style>
