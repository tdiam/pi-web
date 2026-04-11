<script setup lang="ts">
import { ref } from "vue";

defineProps<{
	/** Whether to show the warning banner. */
	visible: boolean;
}>();

const dismissed = ref(false);

function handleDismiss() {
	dismissed.value = true;
}
</script>

<template>
	<div
		v-if="visible && !dismissed"
		class="compat-warning"
		role="alert"
	>
		<span class="compat-icon">⚠️</span>
		<span class="compat-text">
			This extension uses a custom TUI interface (ctx.ui.custom()) that is
			not supported in the web browser. Use the terminal for full
			functionality.
		</span>
		<button
			class="compat-dismiss"
			aria-label="Dismiss warning"
			@click="handleDismiss"
		>
			&times;
		</button>
	</div>
</template>

<style scoped>
.compat-warning {
	display: flex;
	align-items: center;
	gap: 10px;
	padding: 10px 16px;
	background: #422006;
	border-bottom: 1px solid #854d0e;
	color: #fbbf24;
	font-size: 0.8rem;
	line-height: 1.4;
	flex-shrink: 0;
}

.compat-icon {
	flex-shrink: 0;
	font-size: 1rem;
}

.compat-text {
	flex: 1;
}

.compat-dismiss {
	flex-shrink: 0;
	background: none;
	border: none;
	color: #fbbf24;
	font-size: 1.25rem;
	cursor: pointer;
	padding: 0 4px;
	line-height: 1;
	opacity: 0.7;
	transition: opacity 0.15s;
}

.compat-dismiss:hover {
	opacity: 1;
}
</style>
