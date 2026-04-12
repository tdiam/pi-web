<script setup lang="ts">
import { ref, computed, watch } from "vue";
import type { ConnectionStatus } from "../composables/useBridgeClient";
import type { RpcSlashCommand } from "../shared-types";
import CommandPalette from "./CommandPalette.vue";

const props = defineProps<{
	connectionStatus: ConnectionStatus;
	commands: RpcSlashCommand[];
}>();

const emit = defineEmits<{
	submit: [message: string];
}>();

const inputText = ref("");
const isDisabled = computed(() => props.connectionStatus !== "connected");
const paletteRef = ref<InstanceType<typeof CommandPalette> | null>(null);

const showPalette = ref(false);
const filterText = computed(() => {
	if (!showPalette.value) return "";
	return inputText.value.slice(1);
});

watch(inputText, (val) => {
	showPalette.value = val.startsWith("/");
});

function handleSubmit() {
	const text = inputText.value.trim();
	if (!text || isDisabled.value) return;
	emit("submit", text);
	inputText.value = "";
	showPalette.value = false;
}

function handleCommandSelect(commandName: string) {
	inputText.value = "";
	showPalette.value = false;
	emit("submit", `/${commandName}`);
}

function handlePaletteClose() {
	showPalette.value = false;
}

function handleInputKeydown(e: KeyboardEvent) {
	if (showPalette.value && paletteRef.value) {
		if (
			e.key === "ArrowDown" ||
			e.key === "ArrowUp" ||
			e.key === "Escape" ||
			e.key === "Enter"
		) {
			paletteRef.value.handleKeydown(e);
			return;
		}
	}

	if (e.key === "Enter" && !showPalette.value) {
		handleSubmit();
	}
}
</script>

<template>
	<div class="composer-bar">
		<div class="composer-inner-wrap">
			<CommandPalette
				v-if="showPalette && commands.length > 0"
				ref="paletteRef"
				:commands="commands"
				:filter="filterText"
				@select="handleCommandSelect"
				@close="handlePaletteClose"
			/>
			<div class="composer-dock" :class="{ disabled: isDisabled }">
				<input
					v-model="inputText"
					class="prompt-input"
					placeholder="Type a message or use / commands"
					:disabled="isDisabled"
					@keydown="handleInputKeydown"
				/>
				<button
					class="send-btn"
					:disabled="isDisabled || !inputText.trim()"
					aria-label="Send message"
					@click="handleSubmit"
				>
					<svg
						class="send-icon"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="1.8"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<path d="M5 12h12"></path>
						<path d="M13 6l6 6-6 6"></path>
					</svg>
				</button>
			</div>
		</div>
		<div class="composer-meta">
			<span class="composer-status">
				{{ isDisabled ? 'Offline - waiting for connection' : '/ for commands' }}
			</span>
			<span class="composer-shortcut">Enter to send</span>
		</div>
	</div>
</template>

<style scoped>
.composer-bar {
	flex-shrink: 0;
	padding: 16px 24px 12px;
	padding-bottom: max(12px, env(safe-area-inset-bottom));
	background: linear-gradient(to top, var(--bg), var(--composer-fade));
}

.composer-inner-wrap {
	position: relative;
	width: min(920px, 100%);
	margin: 0 auto;
}

.composer-dock {
	display: flex;
	align-items: center;
	gap: 10px;
	padding: 10px;
	border-radius: 16px;
	border: 1px solid var(--border);
	background: var(--bg-elevated);
	transition: border-color 0.15s ease, background 0.15s ease;
}

.composer-dock:focus-within {
	border-color: var(--border-strong);
	background: var(--panel);
}

.composer-dock.disabled {
	opacity: 0.7;
}

.prompt-input {
	flex: 1;
	height: 44px;
	padding: 0 6px;
	border: none;
	background: transparent;
	color: var(--text);
	font-size: 0.92rem;
	outline: none;
}

.prompt-input:disabled {
	cursor: not-allowed;
}

.prompt-input::placeholder {
	color: var(--text-subtle);
}

.send-btn {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 36px;
	height: 36px;
	border-radius: 10px;
	border: 1px solid var(--border);
	background: var(--button-bg);
	color: var(--text);
	cursor: pointer;
	transition: background 0.15s ease, border-color 0.15s ease, opacity 0.15s ease;
}

.send-btn:hover:not(:disabled) {
	background: var(--button-hover);
	border-color: var(--border-strong);
}

.send-btn:disabled {
	opacity: 0.4;
	cursor: not-allowed;
}

.send-icon {
	width: 15px;
	height: 15px;
}

.composer-meta {
	display: flex;
	justify-content: space-between;
	gap: 16px;
	width: min(920px, 100%);
	margin: 8px auto 0;
	font-family: "SF Mono", "Monaco", "Menlo", monospace;
	font-size: 0.68rem;
	color: var(--text-subtle);
}

.composer-status,
.composer-shortcut {
	white-space: nowrap;
}

@media (max-width: 900px) {
	.composer-bar {
		position: sticky;
		bottom: 0;
		z-index: 10;
		padding: 12px 16px;
		padding-bottom: max(12px, env(safe-area-inset-bottom));
	}

	.prompt-input {
		font-size: 16px;
	}

	.composer-meta {
		font-size: 0.64rem;
	}
}
</style>
