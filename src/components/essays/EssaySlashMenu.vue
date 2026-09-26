<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue';
import type { SlashItem } from '../../lib/essaySlash';
import { bookHue } from '../../composables/useBookHue';

/**
 * The slash menu, drawn. What it lists and in which order is decided in
 * lib/essaySlash; this only paints it, keeps the highlighted row in view, and
 * reports a choice. It never takes focus — the caret stays in the paragraph,
 * so typing goes on narrowing the list.
 */
const props = defineProps<{
	items: SlashItem[];
	index: number;
	/** Fixed-position placement, computed by the editor from the block. */
	pos: { left: number; width: number; top?: number; bottom?: number; maxHeight: number };
	/** The library is still arriving — say so instead of "nothing matches". */
	loading?: boolean;
	term: string;
}>();

const emit = defineEmits<{
	(e: 'choose', item: SlashItem): void;
	(e: 'hover', index: number): void;
}>();

interface Group {
	label: string;
	rows: { item: SlashItem; i: number }[];
}

const groups = computed<Group[]>(() => {
	const out: Group[] = [];
	props.items.forEach((item, i) => {
		const label =
			item.type === 'command'
				? item.command.more
					? 'More'
					: 'Set in'
				: item.recent && !props.term
					? 'Cited lately'
					: item.type === 'quote'
						? 'Your quotes'
						: 'Your books';
		const last = out[out.length - 1];
		if (last && last.label === label) last.rows.push({ item, i });
		else out.push({ label, rows: [{ item, i }] });
	});
	return out;
});

const listRef = ref<HTMLElement | null>(null);
watch(
	() => props.index,
	() =>
		nextTick(() => {
			listRef.value?.querySelector<HTMLElement>('[data-on="true"]')?.scrollIntoView({ block: 'nearest' });
		})
);

function clip(s: string, n: number) {
	const t = s.replace(/\s+/g, ' ').trim();
	return t.length > n ? `${t.slice(0, n).trimEnd()}…` : t;
}

const touch = typeof window !== 'undefined' && window.matchMedia?.('(hover: none)').matches;
</script>

<template>
	<Teleport to="body">
		<div
			class="sm"
			role="listbox"
			aria-label="Slash menu"
			:style="{
				left: `${pos.left}px`,
				width: `${pos.width}px`,
				top: pos.top !== undefined ? `${pos.top}px` : undefined,
				bottom: pos.bottom !== undefined ? `${pos.bottom}px` : undefined,
				maxHeight: `${pos.maxHeight}px`,
			}"
			@mousedown.prevent
		>
			<div ref="listRef" class="sm-list">
				<template v-for="g in groups" :key="g.label">
					<div class="sm-g">{{ g.label }}</div>
					<button
						v-for="{ item, i } in g.rows"
						:key="item.key"
						type="button"
						role="option"
						class="sm-row"
						:class="`t-${item.type}`"
						:data-on="i === index"
						:aria-selected="i === index"
						@mousemove="i !== index && emit('hover', i)"
						@click="emit('choose', item)"
					>
						<template v-if="item.type === 'command'">
							<span class="sm-glyph">{{ item.command.glyph }}</span>
							<span class="sm-main">
								<span class="sm-label">{{ item.command.label }}</span>
								<span class="sm-hint">{{
									item.command.searches && term ? `Write “${clip(term, 28)}” as a new ${item.command.id}` : item.command.hint
								}}</span>
							</span>
						</template>
						<template v-else-if="item.type === 'quote'">
							<span class="sm-tick" :style="{ background: item.quote.book_id ? bookHue(item.quote.book_id) : 'var(--color-essay)' }"></span>
							<span class="sm-main">
								<span class="sm-q">“{{ clip(item.quote.quote ?? '', 120) }}”</span>
								<span class="sm-meta">
									<b v-if="item.quote.creator">{{ item.quote.creator }}</b>
									<i v-if="item.quote.work">{{ item.quote.work }}</i>
								</span>
							</span>
						</template>
						<template v-else>
							<span class="sm-tick book" :style="{ background: bookHue(item.book.id) }"></span>
							<span class="sm-main">
								<span class="sm-title">{{ item.book.title }}</span>
								<span class="sm-meta"><b v-if="item.book.author">{{ item.book.author }}</b></span>
							</span>
						</template>
					</button>
				</template>
				<div v-if="!items.length" class="sm-empty">
					{{ loading ? 'Opening your library…' : 'Nothing by that name. Keep typing, or press Esc.' }}
				</div>
			</div>
			<div v-if="!touch" class="sm-foot">
				<span><kbd>↑</kbd><kbd>↓</kbd> choose</span>
				<span><kbd>↵</kbd> set in</span>
				<span><kbd>esc</kbd> keep as text</span>
			</div>
		</div>
	</Teleport>
</template>

<style scoped>
.sm {
	position: fixed;
	z-index: 65;
	display: flex;
	flex-direction: column;
	min-height: 0;
	background: #0d0b08;
	border: 1px solid #2c2416;
	border-radius: 14px;
	box-shadow:
		0 18px 50px rgb(0 0 0 / 0.7),
		0 0 0 1px rgb(232 160 64 / 0.05);
	overflow: hidden;
	animation: sm-in 0.14s cubic-bezier(0.2, 0.8, 0.2, 1);
}
@keyframes sm-in {
	from {
		opacity: 0;
		transform: translateY(-4px) scale(0.985);
	}
}
@media (prefers-reduced-motion: reduce) {
	.sm {
		animation: none;
	}
}
.sm-list {
	overflow-y: auto;
	overscroll-behavior: contain;
	padding: 5px;
	min-height: 0;
	scrollbar-width: thin;
}
.sm-g {
	padding: 8px 9px 4px;
	font-size: 10px;
	font-weight: 600;
	letter-spacing: 0.1em;
	text-transform: uppercase;
	color: var(--color-mono-600);
}
.sm-row {
	display: flex;
	align-items: flex-start;
	gap: 10px;
	width: 100%;
	padding: 7px 9px;
	border: none;
	border-radius: 9px;
	background: transparent;
	text-align: left;
	color: var(--color-mono-200);
	cursor: pointer;
	font: inherit;
}
.sm-row[data-on='true'] {
	background: rgb(232 160 64 / 0.11);
}
.sm-glyph {
	flex: 0 0 auto;
	width: 28px;
	height: 28px;
	display: grid;
	place-items: center;
	border-radius: 8px;
	background: #17130c;
	border: 1px solid #2c2416;
	color: var(--color-essay);
	font-size: 14px;
	line-height: 1;
}
.sm-row[data-on='true'] .sm-glyph {
	border-color: rgb(232 160 64 / 0.55);
}
.sm-main {
	display: flex;
	flex-direction: column;
	gap: 2px;
	min-width: 0;
	flex: 1;
}
.sm-label {
	font-size: 13.5px;
	font-weight: 600;
	color: var(--color-mono-50);
}
.sm-hint {
	font-size: 11.5px;
	color: var(--color-mono-500);
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}
.sm-tick {
	flex: 0 0 auto;
	width: 3px;
	align-self: stretch;
	border-radius: 2px;
	margin: 2px 4px 2px 2px;
}
.sm-q {
	font-family: var(--font-body);
	font-size: 13.5px;
	line-height: 1.35;
	color: #efe9dd;
	display: -webkit-box;
	-webkit-line-clamp: 2;
	-webkit-box-orient: vertical;
	overflow: hidden;
}
.sm-title {
	font-size: 13.5px;
	font-style: italic;
	font-weight: 600;
	color: var(--color-essay);
}
.sm-meta {
	display: flex;
	gap: 8px;
	font-size: 11px;
	color: var(--color-mono-500);
	min-width: 0;
	white-space: nowrap;
	overflow: hidden;
}
.sm-meta b {
	font-weight: 500;
	color: var(--color-mono-300);
}
.sm-meta i {
	overflow: hidden;
	text-overflow: ellipsis;
}
.sm-empty {
	padding: 14px 12px;
	font-size: 12px;
	font-style: italic;
	color: var(--color-mono-500);
}
.sm-foot {
	display: flex;
	gap: 14px;
	padding: 7px 12px;
	border-top: 1px solid #221c12;
	font-size: 10.5px;
	color: var(--color-mono-600);
}
.sm-foot kbd {
	font: 600 10px/1 ui-monospace, SFMono-Regular, Menlo, monospace;
	padding: 2px 4px;
	margin-right: 3px;
	border-radius: 4px;
	border: 1px solid #2c2416;
	color: var(--color-mono-400);
}
/* A thumb, not a pointer. */
@media (hover: none) {
	.sm-row {
		padding: 10px 10px;
	}
}
</style>
