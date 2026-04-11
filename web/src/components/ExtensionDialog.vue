<script setup lang="ts">
import { ref } from "vue";
import type { RpcExtensionUIRequest, RpcExtensionUIResponse } from "../shared-types";

const props = defineProps<{
	request: RpcExtensionUIRequest | null;
}>();

const emit = defineEmits<{
	respond: [payload: RpcExtensionUIResponse];
}>();

const inputValue = ref("");
const editorValue = ref("");
const selectedIndex = ref(-1);

/** Send a value response (for select method). */
function handleSelect(option: string) {
	if (!props.request) return;
	emit("respond", {
		type: "extension_ui_response",
		id: props.request.id,
		value: option,
	});
}

/** Send a confirmed response (for confirm method). */
function handleConfirm(confirmed: boolean) {
	if (!props.request) return;
	emit("respond", {
		type: "extension_ui_response",
		id: props.request.id,
		confirmed,
	});
}

/** Send an input value response. */
function handleInputSubmit() {
	if (!props.request) return;
	const text = inputValue.value;
	emit("respond", {
		type: "extension_ui_response",
		id: props.request.id,
		value: text,
	});
	inputValue.value = "";
}

/** Send an editor value response. */
function handleEditorSubmit() {
	if (!props.request) return;
	const text = editorValue.value;
	emit("respond", {
		type: "extension_ui_response",
		id: props.request.id,
		value: text,
	});
	editorValue.value = "";
}

/** Cancel the current dialog. */
function handleCancel() {
	if (!props.request) return;
	emit("respond", {
		type: "extension_ui_response",
		id: props.request.id,
		cancelled: true,
	});
	inputValue.value = "";
	editorValue.value = "";
}

/** Initialize local state when a new request arrives. */
function initFromRequest() {
	if (!props.request) return;
	if (props.request.method === "input" && props.request.placeholder) {
		inputValue.value = "";
	}
	if (props.request.method === "editor" && props.request.prefill) {
		editorValue.value = props.request.prefill;
	} else {
		editorValue.value = "";
	}
	selectedIndex.value = -1;
}

// Watch for request changes to initialize editor prefill
import { watch } from "vue";
watch(() => props.request, initFromRequest, { immediate: true });
</script>

<template>
	<Teleport to="body">
		<div v-if="request" class="dialog-overlay" @click.self="handleCancel">
			<div class="dialog-panel">
				<!-- Header -->
				<div class="dialog-header">
					<h3 class="dialog-title">{{ request.title }}</h3>
					<button class="dialog-close" aria-label="Cancel" @click="handleCancel">
						&times;
					</button>
				</div>

				<!-- Body: select -->
				<div v-if="request.method === 'select'" class="dialog-body">
					<ul class="select-list">
						<li
							v-for="(option, i) in request.options"
							:key="i"
							class="select-item"
							:class="{ selected: selectedIndex === i }"
							@click="handleSelect(option)"
							@mouseenter="selectedIndex = i"
							@mouseleave="selectedIndex = -1"
						>
							{{ option }}
						</li>
					</ul>
				</div>

				<!-- Body: confirm -->
				<div v-else-if="request.method === 'confirm'" class="dialog-body">
					<p class="confirm-message">{{ request.message }}</p>
					<div class="dialog-actions">
						<button class="btn btn-cancel" @click="handleConfirm(false)">
							Cancel
						</button>
						<button class="btn btn-primary" @click="handleConfirm(true)">
							Confirm
						</button>
					</div>
				</div>

				<!-- Body: input -->
				<div v-else-if="request.method === 'input'" class="dialog-body">
					<input
						v-model="inputValue"
						class="dialog-input"
						:placeholder="request.placeholder ?? 'Enter a value…'"
						@keydown.enter="handleInputSubmit"
					/>
					<div class="dialog-actions">
						<button class="btn btn-cancel" @click="handleCancel">
							Cancel
						</button>
						<button class="btn btn-primary" @click="handleInputSubmit">
							Submit
						</button>
					</div>
				</div>

				<!-- Body: editor -->
				<div v-else-if="request.method === 'editor'" class="dialog-body">
					<textarea
						v-model="editorValue"
						class="dialog-textarea"
						rows="10"
						@keydown.ctrl.enter="handleEditorSubmit"
						@keydown.meta.enter="handleEditorSubmit"
					></textarea>
					<div class="dialog-hint">Ctrl+Enter to submit</div>
					<div class="dialog-actions">
						<button class="btn btn-cancel" @click="handleCancel">
							Cancel
						</button>
						<button class="btn btn-primary" @click="handleEditorSubmit">
							Submit
						</button>
					</div>
				</div>

				<!-- Cancel button for select -->
				<div v-if="request.method === 'select'" class="dialog-actions">
					<button class="btn btn-cancel" @click="handleCancel">
						Cancel
					</button>
				</div>
			</div>
		</div>
	</Teleport>
</template>

<style scoped>
.dialog-overlay {
	position: fixed;
	inset: 0;
	z-index: 1000;
	display: flex;
	align-items: center;
	justify-content: center;
	background: rgba(0, 0, 0, 0.6);
	backdrop-filter: blur(2px);
}

.dialog-panel {
	width: 90%;
	max-width: 480px;
	max-height: 80vh;
	overflow-y: auto;
	background: #1a1a2e;
	border: 1px solid #2d2d44;
	border-radius: 12px;
	box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
	display: flex;
	flex-direction: column;
}

.dialog-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 16px 20px;
	border-bottom: 1px solid #2d2d44;
	flex-shrink: 0;
}

.dialog-title {
	margin: 0;
	font-size: 1rem;
	font-weight: 600;
	color: #e2e8f0;
}

.dialog-close {
	background: none;
	border: none;
	color: #9ca3af;
	font-size: 1.5rem;
	cursor: pointer;
	line-height: 1;
	padding: 0 4px;
	transition: color 0.15s;
}

.dialog-close:hover {
	color: #e2e8f0;
}

.dialog-body {
	padding: 16px 20px;
	flex: 1;
	overflow-y: auto;
}

/* Select list */
.select-list {
	list-style: none;
	margin: 0;
	padding: 0;
	display: flex;
	flex-direction: column;
	gap: 4px;
}

.select-item {
	padding: 10px 14px;
	border-radius: 8px;
	cursor: pointer;
	color: #e2e8f0;
	font-size: 0.9rem;
	transition: background 0.1s;
	border: 1px solid transparent;
}

.select-item:hover,
.select-item.selected {
	background: #2d2d44;
	border-color: #3b3b5c;
}

/* Confirm message */
.confirm-message {
	margin: 0 0 16px 0;
	color: #c4c9d4;
	font-size: 0.9rem;
	line-height: 1.5;
}

/* Input */
.dialog-input {
	width: 100%;
	padding: 10px 14px;
	border-radius: 8px;
	border: 1px solid #2d2d44;
	background: #0f0f23;
	color: #e2e8f0;
	font-size: 0.9rem;
	outline: none;
	transition: border-color 0.15s;
	margin-bottom: 16px;
	box-sizing: border-box;
}

.dialog-input:focus {
	border-color: #2563eb;
}

.dialog-input::placeholder {
	color: #4b5563;
}

/* Textarea */
.dialog-textarea {
	width: 100%;
	padding: 10px 14px;
	border-radius: 8px;
	border: 1px solid #2d2d44;
	background: #0f0f23;
	color: #e2e8f0;
	font-size: 0.9rem;
	font-family: "SF Mono", "Fira Code", "Cascadia Code", monospace;
	outline: none;
	resize: vertical;
	transition: border-color 0.15s;
	margin-bottom: 4px;
	box-sizing: border-box;
}

.dialog-textarea:focus {
	border-color: #2563eb;
}

.dialog-hint {
	font-size: 0.7rem;
	color: #4b5563;
	margin-bottom: 12px;
}

/* Actions */
.dialog-actions {
	display: flex;
	justify-content: flex-end;
	gap: 8px;
	padding-top: 8px;
}

.btn {
	padding: 8px 18px;
	border-radius: 8px;
	border: none;
	font-size: 0.85rem;
	font-weight: 600;
	cursor: pointer;
	transition: background 0.15s, opacity 0.15s;
}

.btn-primary {
	background: #2563eb;
	color: #fff;
}

.btn-primary:hover {
	background: #1d4ed8;
}

.btn-cancel {
	background: #2d2d44;
	color: #9ca3af;
}

.btn-cancel:hover {
	background: #3b3b5c;
	color: #e2e8f0;
}

@media (max-width: 900px) {
	.dialog-panel {
		max-height: 90vh;
		max-height: 90dvh;
		width: 95%;
	}

	.select-item {
		padding: 14px 16px;
		min-height: 44px;
	}

	.btn {
		padding: 12px 20px;
		min-height: 44px;
	}

	.dialog-input,
	.dialog-textarea {
		font-size: 16px; /* Prevents iOS zoom on focus */
	}
}
</style>
