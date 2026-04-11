<script setup lang="ts">
defineProps<{
	visible: boolean;
	reason: string;
	reconnectCount: number;
}>();
</script>

<template>
	<Transition name="banner-slide">
		<div v-if="visible" class="reconnect-banner" role="alert" aria-live="polite">
			<span class="pulse-dot"></span>
			<span class="banner-text">
				{{ reason || 'Connection lost' }}. Reconnecting…
			</span>
			<span v-if="reconnectCount > 1" class="attempt-badge">
				Attempt {{ reconnectCount }}
			</span>
		</div>
	</Transition>
</template>

<style scoped>
.reconnect-banner {
	display: flex;
	align-items: center;
	gap: 10px;
	padding: 8px 16px;
	background: #78350f;
	border-bottom: 1px solid #a16207;
	color: #fef3c7;
	font-size: 0.8rem;
	flex-shrink: 0;
	z-index: 19;
}

.pulse-dot {
	width: 8px;
	height: 8px;
	border-radius: 50%;
	background: #fbbf24;
	flex-shrink: 0;
	animation: pulse-glow 1.5s ease-in-out infinite;
}

.banner-text {
	flex: 1;
}

.attempt-badge {
	padding: 2px 8px;
	border-radius: 999px;
	background: rgba(251, 191, 36, 0.2);
	border: 1px solid rgba(251, 191, 36, 0.4);
	font-size: 0.7rem;
	font-weight: 600;
	color: #fde68a;
	white-space: nowrap;
}

@keyframes pulse-glow {
	0%, 100% {
		opacity: 0.4;
		transform: scale(0.8);
	}
	50% {
		opacity: 1;
		transform: scale(1.2);
	}
}

/* Slide transition */
.banner-slide-enter-active,
.banner-slide-leave-active {
	transition: transform 0.25s ease, opacity 0.25s ease;
}

.banner-slide-enter-from,
.banner-slide-leave-to {
	transform: translateY(-100%);
	opacity: 0;
}
</style>
