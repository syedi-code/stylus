<script setup lang="ts">
import type { Essay } from '../../lib/api';
import EssayWritingRoom from './workspace/EssayWritingRoom.vue';

/**
 * The writing room as a MODAL.
 *
 * The Essays tab renders the room inline (see EssaysWorkspace) — it is the tab.
 * This wrapper exists for the one place that still needs it over another
 * surface: editing an essay from inside a thread, where you are not on the
 * Essays tab and should not be thrown onto it.
 *
 * Everything that makes the room a room lives in EssayWritingRoom; this file
 * owns only the overlay and the click-outside-to-close gesture.
 */
defineProps<{
	isOpen: boolean;
	essay?: Essay | null;
}>();

const emit = defineEmits<{
	(e: 'close'): void;
	(e: 'saved'): void;
	(e: 'present', essay: Essay): void;
}>();

// Close only when the press STARTED on the backdrop — otherwise a drag that
// ends outside the room (selecting text to its edge) would dismiss it.
let downOnBackdrop = false;
function onBackdropMouseDown(e: MouseEvent) {
	downOnBackdrop = e.target === e.currentTarget;
}
function onBackdropMouseUp(e: MouseEvent) {
	if (downOnBackdrop && e.target === e.currentTarget) emit('close');
	downOnBackdrop = false;
}
</script>

<template>
	<Teleport to="body">
		<Transition name="fade">
			<div
				v-if="isOpen"
				class="fixed inset-0 z-50 flex sm:items-center sm:justify-center sm:p-6 lg:p-10 sm:bg-black/60 sm:backdrop-blur-sm"
				@mousedown="onBackdropMouseDown"
				@mouseup="onBackdropMouseUp"
			>
				<EssayWritingRoom
					:is-open="isOpen"
					:essay="essay"
					@close="emit('close')"
					@saved="emit('saved')"
					@present="(e) => emit('present', e)"
				/>
			</div>
		</Transition>
	</Teleport>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
	transition: opacity 0.15s ease;
}
.fade-enter-from,
.fade-leave-to {
	opacity: 0;
}
</style>
