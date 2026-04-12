<script setup lang="ts">
import { ref } from "vue";

defineProps<{
	visible: boolean;
}>();

const dismissed = ref(false);

function handleDismiss() {
	dismissed.value = true;
}
</script>

<template>
	<div v-if="visible && !dismissed" class="compat-warning" role="alert">
		<span class="compat-kicker">compat</span>
		<span class="compat-text">
			This extension uses a custom TUI interface that is not supported in the browser.
			Use the terminal for full functionality.
		</span>
		<button class="compat-dismiss" aria-label="Dismiss warning" @click="handleDismiss">
			x
		</button>
	</div>
</template>

<style scoped>
.compat-warning {
	display: flex;
	align-items: center;
	gap: 10px;
	margin: 12px 24px 0;
	padding: 10px 12px;
	border-radius: 12px;
	border: 1px solid var(--border);
	background: var(--panel);
	color: var(--text-muted);
	font-size: 0.8rem;
	line-height: 1.5;
	flex-shrink: 0;
}

.compat-kicker {
	flex-shrink: 0;
	font-family: "SF Mono", "Monaco", "Menlo", monospace;
	font-size: 0.66rem;
	text-transform: uppercase;
	letter-spacing: 0.08em;
	color: var(--text-subtle);
}

.compat-text {
	flex: 1;
}

.compat-dismiss {
	flex-shrink: 0;
	background: none;
	border: none;
	color: var(--text-subtle);
	font-size: 0.92rem;
	cursor: pointer;
	padding: 0;
	line-height: 1;
}

.compat-dismiss:hover {
	color: var(--text);
}

@media (max-width: 900px) {
	.compat-warning {
		margin: 12px 16px 0;
	}
}
</style>
