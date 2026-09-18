<script setup lang="ts">
// The writing room in outline, drawn in the room's own geometry — the spine
// where the spine docks, the chrome bar, a manuscript at the editor's measure —
// so when the real room replaces it nothing on the screen moves.
const LINES = [96, 88, 92, 54, 0, 90, 95, 83, 71, 0, 93, 86, 40];
</script>

<template>
	<div class="skel" aria-busy="true" aria-label="Loading your essays">
		<aside class="spine">
			<div class="sp-top">
				<span class="mark">Essays</span>
			</div>
			<span class="bar filter"></span>
			<div v-for="i in 5" :key="i" class="piece">
				<span class="bar" :style="{ width: `${[78, 62, 84, 55, 70][i - 1]}%` }"></span>
				<span class="rail"><i v-for="j in [5, 4, 3, 2, 4][i - 1]" :key="j"></i></span>
				<span class="bar meta"></span>
			</div>
		</aside>

		<div class="room">
			<div class="chrome">
				<span class="badge"></span>
				<span class="bar name"></span>
			</div>
			<div class="page">
				<span class="bar heading"></span>
				<template v-for="(w, i) in LINES" :key="i">
					<span v-if="w" class="bar line" :style="{ width: `${w}%` }"></span>
					<span v-else class="gap"></span>
				</template>
			</div>
		</div>
	</div>
</template>

<style scoped>
.skel {
	display: flex;
	height: 100%;
	min-height: 0;
	background: #060504;
}
.spine {
	display: none;
	flex: 0 0 258px;
	width: 258px;
	background: #0b0b0f;
	border-right: 1px solid #1c1a15;
	padding: 12px 10px 28px;
}
@media (min-width: 1100px) {
	.spine {
		display: block;
	}
}
.sp-top {
	padding: 2px 6px 10px;
}
.mark {
	font-size: 14px;
	font-weight: 600;
	font-style: italic;
	color: var(--color-essay);
	letter-spacing: -0.01em;
	opacity: 0.8;
}
.piece {
	display: flex;
	flex-direction: column;
	gap: 8px;
	padding: 12px 11px 12px;
}
.rail {
	display: flex;
	gap: 3px;
}
.rail i {
	width: 14px;
	height: 3px;
	border-radius: 999px;
	background: #1c1b20;
}

.room {
	flex: 1;
	min-width: 0;
	display: flex;
	flex-direction: column;
}
.chrome {
	display: flex;
	align-items: center;
	gap: 8px;
	height: 57px;
	padding: 4px 12px 0;
	background: #08080a;
	border-bottom: 1px solid #241d12;
}
.badge {
	width: 42px;
	height: 15px;
	background: rgb(232 160 64 / 0.28);
}
.page {
	width: 100%;
	max-width: 33rem;
	margin: 0 auto;
	padding: 44px 20px;
	display: flex;
	flex-direction: column;
	gap: 13px;
}
@media (min-width: 768px) {
	.page {
		max-width: 36rem;
	}
}
@media (min-width: 1280px) {
	.page {
		max-width: 39rem;
	}
}

.bar {
	display: block;
	height: 11px;
	border-radius: 4px;
	background: linear-gradient(90deg, rgb(255 255 255 / 0.04) 0%, rgb(255 255 255 / 0.08) 50%, rgb(255 255 255 / 0.04) 100%);
	background-size: 200% 100%;
	animation: sheen 1.7s ease-in-out infinite;
}
.filter {
	height: 30px;
	margin: 0 0 10px;
	border-radius: 9px;
}
.meta {
	width: 45%;
	height: 8px;
}
.name {
	width: 160px;
	height: 13px;
}
.heading {
	width: 42%;
	height: 17px;
	margin-bottom: 10px;
}
.line {
	height: 13px;
}
.gap {
	height: 10px;
}
@keyframes sheen {
	from {
		background-position: 100% 0;
	}
	to {
		background-position: -100% 0;
	}
}
@media (prefers-reduced-motion: reduce) {
	.bar {
		animation: none;
	}
}
</style>
