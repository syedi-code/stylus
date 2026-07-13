<script setup lang="ts">
/**
 * Small black-bordered confirm that hangs under a foil's trash button, so a
 * source is never lost to a stray tap. Purely presentational — the foil owns
 * the open state.
 */
defineProps<{ label?: string }>();
const emit = defineEmits<{ (e: 'confirm'): void; (e: 'cancel'): void }>();
</script>

<template>
	<div class="confirm" @click.stop @mousedown.stop>
		<div class="cq">{{ label ?? 'Remove this source?' }}</div>
		<div class="cbtns">
			<button type="button" class="cb cancel" @click="emit('cancel')">Cancel</button>
			<button type="button" class="cb del" @click="emit('confirm')">Remove</button>
		</div>
	</div>
</template>

<style scoped>
.confirm {
	position: absolute;
	z-index: 20;
	top: 42px;
	right: 6px;
	width: 190px;
	background: #1e1810;
	border: 1.5px solid #000;
	border-radius: 13px;
	padding: 12px 13px;
	box-shadow: 0 16px 36px rgba(0, 0, 0, 0.65);
}
.cq {
	font-size: 12px;
	color: var(--color-mono-100);
	margin-bottom: 11px;
	line-height: 1.35;
}
.cbtns {
	display: flex;
	gap: 7px;
	justify-content: flex-end;
}
.cb {
	font-size: 11.5px;
	padding: 6px 13px;
	border-radius: 999px;
	cursor: pointer;
	border: none;
}
.cb.cancel {
	background: #15110a;
	border: 1px solid #241d12;
	color: var(--color-mono-300);
}
.cb.del {
	background: var(--color-rose);
	color: #fff;
	font-weight: 600;
}
</style>
