<script lang="ts">
import type { Essay as CachedEssay } from '../../../lib/api';

/**
 * The last list and the piece that was open, kept across tab switches. Coming
 * back to Essays reopens what you were writing at once and revalidates behind
 * it, instead of starting from an empty room every time.
 */
interface WorkspaceCache {
	items: CachedEssay[];
	hasMore: boolean;
	currentId: string | null;
}
let cache: WorkspaceCache | null = null;

/** Read through a function, so the type checker doesn't narrow to the initial null. */
function warmCache(): WorkspaceCache | null {
	return cache;
}

/** Tests start each case from a cold tab. */
export function resetWorkspaceCache() {
	cache = null;
}
</script>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { fetchEssays, deleteEssay as deleteEssayApi, type Essay } from '../../../lib/api';
import { usePagination } from '../../../composables/usePagination';
import { parseBlocks } from '../../../composables/useEssayBlocks';
import EssaySpine from './EssaySpine.vue';
import EssayWritingRoom from './EssayWritingRoom.vue';
import PresentationViewEssay from '../PresentationViewEssay.vue';
import EssayRoomSkeleton from './EssayRoomSkeleton.vue';

/**
 * The Essays tab, whole.
 *
 * There is no index any more. The tab IS the manuscript: a spine on the left
 * for moving between pieces, the writing room filling the rest. Opening the
 * tab drops you straight into the piece you touched last, because that is
 * what you came to do — the list was a toll gate in front of it.
 *
 * All of the tab's state and actions live here, presenting included.
 */
const props = defineProps<{ isAdmin?: boolean }>();

const presenting = ref<Essay | null>(null);

const pagination = usePagination<Essay, { search?: string }>({
	pageSize: 30,
	fetchFn: (params) => fetchEssays({ ...params }),
	key: (e) => e.id,
});

/**
 * True until the first list arrives on a cold tab. The room is not mounted
 * until then: mounted without an essay it IS a blank new piece, and for the
 * length of the request the tab showed an untitled, empty manuscript with a
 * live publish button before the real piece snapped in over it.
 */
const warm = warmCache();
const booting = ref(!warm);

// A warm tab restores its list and its open piece before the first render —
// restoring them on mount would still paint one frame of an empty room.
if (warm) pagination.seed(warm.items, warm.hasMore);

/** The piece being written. `null` means a new, unsaved one. */
const currentId = ref<string | null>(
	warm ? (warm.items.find((e) => e.id === warm.currentId)?.id ?? warm.items[0]?.id ?? null) : null
);
/**
 * True while the room is on a new, unsaved piece. The mobile "write" button
 * hides on this: the tab IS the editor now, so once it has opened a
 * blank piece the button has nothing left to do and was just sitting on top
 * of the insert rail.
 */
const isNewPiece = computed(() => currentId.value === null);
/** Bumped to force the room to remount on "new", so its draft starts clean. */
const roomKey = ref(0);
/**
 * Set only by `newEssay()` — i.e. only when someone actually pressed Write.
 * The room used to infer it from having no essay, but it has no essay during
 * the first load too, so every cold start announced a new piece and then
 * quietly opened the most recent one underneath the notice.
 */
const startedNew = ref(false);

const current = computed<Essay | null>(
	() => pagination.items.value.find((e) => e.id === currentId.value) ?? null
);

/** The open piece's blocks, so the spine can outline what is being edited. */
const liveContent = ref('');
const currentBlocks = computed(() => parseBlocks(liveContent.value));

onMounted(async () => {
	if (!booting.value) {
		await pagination.refresh();
		if (!currentId.value && !startedNew.value) currentId.value = pagination.items.value[0]?.id ?? null;
		return;
	}
	await pagination.loadInitial();
	// Land in the most recent piece. Nothing to open is a new piece, not an
	// empty state to click through.
	if (!currentId.value) currentId.value = pagination.items.value[0]?.id ?? null;
	booting.value = false;
});

watch(
	[pagination.items, currentId, pagination.hasMore],
	() => {
		if (booting.value) return;
		cache = { items: pagination.items.value, hasMore: pagination.hasMore.value, currentId: currentId.value };
	}
);

watch(current, (e) => {
	liveContent.value = e?.content ?? '';
}, { immediate: true });

function openEssay(essay: Essay) {
	currentId.value = essay.id;
	startedNew.value = false;
	roomKey.value += 1;
}
/** Also the entry point for deep links from other tabs. */
function openById(id: string) {
	currentId.value = id;
	startedNew.value = false;
	roomKey.value += 1;
}
function newEssay() {
	currentId.value = null;
	startedNew.value = true;
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
	// Revalidate in place. A reload that empties the list first would, for
	// the length of the request, leave the open piece pointing at nothing.
	await pagination.refresh();
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
		<!-- Only the first arrival crossfades. Switching pieces remounts the
		     room inside the wrapper, where no transition is listening. -->
		<Transition name="room" mode="out-in">
			<EssayRoomSkeleton v-if="booting" />
			<div v-else class="ws-room">
				<EssayWritingRoom
					:key="roomKey"
					ref="roomRef"
					inline
					:is-open="true"
					:essay="current"
					:announce-new="startedNew"
					@saved="onSaved"
					@new="newEssay"
					@present="presenting = $event"
					@content="(c: string) => (liveContent = c)"
				>
					<template #spine>
						<EssaySpine
							:essays="pagination.items.value"
							:current-id="currentId"
							:current-blocks="currentBlocks"
							:loading="pagination.loading.value && !pagination.items.value.length"
							:loading-more="pagination.loadingMore.value"
							:error="pagination.error.value"
							:is-admin="props.isAdmin"
							@open="openEssay"
							@new="newEssay"
							@go-to-block="goToBlock"
							@copy="copyEssay"
							@delete="removeEssay"
							@load-more="pagination.loadMore()"
							@retry="pagination.loadInitial()"
						/>
					</template>
				</EssayWritingRoom>
			</div>
		</Transition>

		<PresentationViewEssay :isOpen="!!presenting" :essay="presenting" @close="presenting = null" />

	</div>
</template>

<style scoped>
.room-enter-active {
	transition: opacity 0.32s ease;
}
.room-leave-active {
	transition: opacity 0.14s ease;
}
.room-enter-from,
.room-leave-to {
	opacity: 0;
}
@media (prefers-reduced-motion: reduce) {
	.room-enter-active,
	.room-leave-active {
		transition: none;
	}
}
.ws-room {
	height: 100%;
	min-height: 0;
}
.ws-root {
	/* Never a magic number, and never this element's own offset. */
	height: calc(100dvh - var(--app-header-h, 0px));
	min-height: 0;
	overflow: hidden;
}
</style>
