<script setup lang="ts">
import { ref, watch, nextTick } from "vue";
import type { TranscriptEntry } from "../composables/useBridgeClient";

const props = defineProps<{
	messages: readonly TranscriptEntry[];
	isStreaming: boolean;
}>();

const container = ref<HTMLDivElement | null>(null);

function roleClass(role: string): "user" | "assistant" | "system" {
	if (role === "user") return "user";
	if (role === "assistant") return "assistant";
	return "system";
}

function messageContent(msg: TranscriptEntry): string {
	const content = msg.content;
	if (typeof content === "string") return content;
	if (typeof msg.text === "string") return msg.text;
	if (Array.isArray(content)) {
		return (content as unknown[])
			.map((block: unknown) => {
				if (typeof block === "string") return block;
				const b = block as { type?: string; text?: string };
				if (b.type === "text" && typeof b.text === "string") return b.text;
				return "";
			})
			.filter(Boolean)
			.join("\n");
	}
	return "";
}

// Auto-scroll to bottom on new messages
watch(
	() => props.messages.length,
	async () => {
		await nextTick();
		if (container.value) {
			container.value.scrollTop = container.value.scrollHeight;
		}
	}
);

// Also scroll when streaming updates happen
watch(
	() => props.isStreaming,
	async (streaming) => {
		if (streaming) {
			await nextTick();
			if (container.value) {
				container.value.scrollTop = container.value.scrollHeight;
			}
		}
	}
);
</script>

<template>
	<div ref="container" class="chat-transcript">
		<div v-if="messages.length === 0" class="empty-state">
			<p>No messages yet</p>
		</div>
		<div
			v-for="(msg, index) in messages"
			:key="msg.id ?? index"
			class="message-row"
			:class="roleClass(msg.role)"
		>
			<div class="message-bubble" :class="roleClass(msg.role)">
				<span class="message-role">{{ msg.role }}</span>
				<div class="message-content">{{ messageContent(msg) }}</div>
				<span v-if="msg.timestamp" class="message-time">{{ msg.timestamp }}</span>
			</div>
		</div>
		<div v-if="isStreaming" class="streaming-indicator">
			<span class="dot"></span>
			<span class="dot"></span>
			<span class="dot"></span>
		</div>
	</div>
</template>

<style scoped>
.chat-transcript {
	flex: 1;
	overflow-y: auto;
	padding: 16px;
	display: flex;
	flex-direction: column;
	gap: 12px;
	background: #1a1a2e;
}

.empty-state {
	display: flex;
	align-items: center;
	justify-content: center;
	flex: 1;
	color: #6b7280;
	font-style: italic;
}

.message-row {
	display: flex;
	max-width: 100%;
}

.message-row.user {
	justify-content: flex-end;
}

.message-row.assistant {
	justify-content: flex-start;
}

.message-row.system {
	justify-content: center;
}

.message-bubble {
	max-width: 75%;
	padding: 10px 14px;
	border-radius: 12px;
	font-size: 0.9rem;
	line-height: 1.5;
	position: relative;
	word-break: break-word;
}

.message-bubble.user {
	background: #2563eb;
	color: #fff;
	border-bottom-right-radius: 4px;
}

.message-bubble.assistant {
	background: #2d2d44;
	color: #e2e8f0;
	border-bottom-left-radius: 4px;
}

.message-bubble.system {
	background: transparent;
	color: #9ca3af;
	font-size: 0.8rem;
	text-align: center;
	max-width: 90%;
}

.message-role {
	display: block;
	font-size: 0.7rem;
	font-weight: 600;
	text-transform: uppercase;
	letter-spacing: 0.05em;
	margin-bottom: 4px;
	opacity: 0.6;
}

.message-content {
	white-space: pre-wrap;
}

.message-time {
	display: block;
	font-size: 0.65rem;
	margin-top: 4px;
	opacity: 0.4;
	text-align: right;
}

.streaming-indicator {
	display: flex;
	gap: 4px;
	padding: 8px 14px;
	align-items: center;
}

.streaming-indicator .dot {
	width: 6px;
	height: 6px;
	border-radius: 50%;
	background: #60a5fa;
	animation: blink 1.2s infinite;
}

.streaming-indicator .dot:nth-child(2) {
	animation-delay: 0.2s;
}

.streaming-indicator .dot:nth-child(3) {
	animation-delay: 0.4s;
}

@keyframes blink {
	0%,
	80%,
	100% {
		opacity: 0.2;
	}
	40% {
		opacity: 1;
	}
}
</style>
