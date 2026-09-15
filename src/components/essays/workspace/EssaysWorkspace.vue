<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { fetchEssays, deleteEssay as deleteEssayApi, type Essay } from '../../../lib/api';
import { usePagination } from '../../../composables/usePagination';
import { parseBlocks } from '../../../composables/useEssayBlocks';
import EssaySpine from './EssaySpine.vue';
import EssayWritingRoom from './EssayWritingRoom.vue';

/**
 * The Essays tab, whole.
 *
 * There is no index any more. The tab IS the manuscript: a spine on the left
 * for moving between pieces, the writing room filling the rest. Opening the
 * tab drops you straight into the piece you touched last, because that is
 * what you came to do — the list was a toll gate in front of it.
 *
 * All of the tab's state and actions live here rather than in App.vue, which
 * previously carried the pagination, five handlers and the modal wiring for
 * this one tab inline.
 */
const props = defineProps<{ isAdmin?: boolean }>();

const emit = defineEmits<{
	(e: 'present', essay: Essay): void;
	(e: 'addToThread', essay: Essay): void;
}>();

const pagination = usePagination<Essay, { search?: string }>({
	pageSize: 30,
	fetchFn: (params) => fetchEssays({ ...params }),
});

/** The piece being written. `null` means a new, unsaved one. */
const currentId = ref<string | null>(null);
/**
 * True while the room is on a new, unsaved piece. App.vue hides the mobile
 * "write" button on this: the tab IS the editor now, so once it has opened a
 * blank piece the button has nothing left to do and was just sitting on top
 * of the insert rail.
 */
const isNewPiece = computed(() => currentId.value === null);
/** Bumped to force the room to remount on "new", so its draft starts clean. */
const roomKey = ref(0);

const current = computed<Essay | null>(
	() => pagination.items.value.find((e) => e.id === currentId.value) ?? null
);

/** The open piece's blocks, so the spine can outline what is being edited. */
const liveContent = ref('');
const currentBlocks = computed(() => parseBlocks(liveContent.value));

onMounted(async () => {
	await pagination.loadInitial();
	// Land in the most recent piece. Nothing to open is a new piece, not an
	// empty state to click through.
	if (!currentId.value) currentId.value = pagination.items.value[0]?.id ?? null;
});

watch(current, (e) => {
	liveContent.value = e?.content ?? '';
}, { immediate: true });

function openEssay(essay: Essay) {
	currentId.value = essay.id;
	roomKey.value += 1;
}
/** Also the entry point for deep links from other tabs. */
function openById(id: string) {
	currentId.value = id;
	roomKey.value += 1;
}
function newEssay() {
	currentId.value = null;
	roomKey.value += 1;
}

async function copyEssay(essay: Essay) {
	if (essay.content) await navigator.clipboard.writeText(essay.content);
}

async function removeEssay(essay: Essay) {
	if (!confirm('Are you sure you want to delete this essay? This action cannot be undone.')) return;
	try {
		await deleteEssayApi(essay.id);
		pagination.removeItem((e) => e.id === essay.id);
		if (currentId.value === essay.id) {
			currentId.value = pagination.items.value[0]?.id ?? null;
			roomKey.value += 1;
		}
	} catch (err) {
		console.error('Failed to delete essay:', err);
	}
}

async function onSaved() {
	await pagination.loadInitial();
	// A brand-new piece becomes the newest one; stay in it rather than
	// bouncing back to whatever was open before.
	if (currentId.value === null) currentId.value = pagination.items.value[0]?.id ?? null;
}

/**
 * The room fills everything below the app header and scrolls internally, so
 * the page itself never scrolls behind it.
 *
 * The height comes from `--app-header-h`, which AppHeader publishes with a
 * ResizeObserver. It used to be measured from THIS element's own offset in
 * onMounted, which is a measurement taken at the one moment it cannot be
 * trusted: App.vue gives each tab its own `<transition>`, so `mode="out-in"`
 * does not coordinate across them and the outgoing tab is still in the DOM,
 * fading, while this one mounts. The offset came back as the full height of
 * the feed being replaced, `calc(100dvh - that)` clamped to nothing, and the
 * Essays tab opened blank — until a window resize re-measured it, which is
 * exactly the shape of the bug that was reported.
 */

const roomRef = ref<InstanceType<typeof EssayWritingRoom> | null>(null);
function goToBlock(bid: string) {
	roomRef.value?.goToBlock?.(bid);
}

defineExpose({ openById, newEssay, isNewPiece });
</script>

<template>
	<div class="ws-root">
		<EssayWritingRoom
			:key="roomKey"
			ref="roomRef"
			inline
			:is-open="true"
			:essay="current"
			@saved="onSaved"
			@present="(e) => emit('present', e)"
			@content="(c: string) => (liveContent = c)"
		>
			<template #spine>
				<EssaySpine
					:essays="pagination.items.value"
					:current-id="currentId"
					:current-blocks="currentBlocks"
					:loading="pagination.loading.value"
					:loading-more="pagination.loadingMore.value"
					:error="pagination.error.value"
					:is-admin="props.isAdmin"
					@open="openEssay"
					@new="newEssay"
					@go-to-block="goToBlock"
					@copy="copyEssay"
					@delete="removeEssay"
					@add-to-thread="(e) => emit('addToThread', e)"
					@load-more="pagination.loadMore()"
					@retry="pagination.loadInitial()"
				/>
			</template>
		</EssayWritingRoom>
	</div>
</template>

<style scoped>
.ws-root {
	/* Never a magic number, and never this element's own offset. */
	height: calc(100dvh - var(--app-header-h, 0px));
	min-height: 0;
	overflow: hidden;
}
</style>
