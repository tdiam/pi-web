<script setup lang="ts">
import { ref, watch, nextTick } from "vue";
import type { TranscriptEntry } from "../composables/useBridgeClient";

const props = defineProps<{
	messages: readonly TranscriptEntry[];
	isStreaming: boolean;
}>();

const container = ref<HTMLDivElement | null>(null);

let wasDisconnected = false;
let savedScrollTop = 0;
let savedScrollHeight = 0;

function preserveScroll() {
	if (!container.value) return;
	savedScrollTop = container.value.scrollTop;
	savedScrollHeight = container.value.scrollHeight;
	wasDisconnected = true;
}

function restoreScroll() {
	if (!container.value || !wasDisconnected) return;
	const delta = container.value.scrollHeight - savedScrollHeight;
	container.value.scrollTop = savedScrollTop + delta;
	wasDisconnected = false;
}

function roleClass(role: string): "user" | "assistant" | "tool" {
	if (role === "user") return "user";
	if (role === "assistant") return "assistant";
	return "tool";
}

function roleLabel(role: string): string {
	if (role === "user") return "You";
	if (role === "assistant") return "Assistant";
	if (role === "toolResult") return "Tool Result";
	if (role === "tool") return "Tool";
	return role;
}

interface ContentBlock {
	kind: "text" | "toolCall" | "thinking" | "image";
	text: string;
	toolName?: string;
}

function contentBlocks(msg: TranscriptEntry): ContentBlock[] {
	const content = msg.content;
	const blocks: ContentBlock[] = [];

	if (typeof content === "string") {
		blocks.push({ kind: "text", text: content });
		return blocks;
	}

	if (typeof msg.text === "string") {
		blocks.push({ kind: "text", text: msg.text });
		return blocks;
	}

	if (!Array.isArray(content)) return blocks;

	for (const block of content as unknown[]) {
		if (typeof block === "string") {
			blocks.push({ kind: "text", text: block });
			continue;
		}

		const b = block as Record<string, unknown>;
		const type = b.type as string | undefined;

		if (type === "text" && typeof b.text === "string") {
			blocks.push({ kind: "text", text: b.text });
		} else if (type === "thinking" && typeof b.thinking === "string") {
			blocks.push({ kind: "thinking", text: b.thinking });
		} else if (type === "toolCall") {
			blocks.push({
				kind: "toolCall",
				text: typeof b.arguments === "string" ? b.arguments : JSON.stringify(b.arguments ?? "", null, 2),
				toolName: (b.name as string) ?? "unknown",
			});
		} else if (type === "toolResult") {
			const text = typeof b.text === "string" ? b.text : JSON.stringify(block, null, 2);
			blocks.push({ kind: "text", text });
		} else if (type === "image" || type === "image_url") {
			blocks.push({ kind: "image", text: "[image]" });
		}
	}

	return blocks;
}

function truncateToolResult(text: string, maxLen = 500): { text: string; truncated: boolean } {
	if (text.length <= maxLen) return { text, truncated: false };
	return { text: text.slice(0, maxLen) + "\n... (truncated)", truncated: true };
}

function isToolResultMessage(msg: TranscriptEntry): boolean {
	return msg.role === "toolResult" || msg.role === "tool";
}

const expandedToolResults = ref(new Set<string>());
const expandedThinking = ref(new Set<string>());

function toggleToolResult(msgId: string | undefined) {
	if (!msgId) return;
	const next = new Set(expandedToolResults.value);
	if (next.has(msgId)) next.delete(msgId);
	else next.add(msgId);
	expandedToolResults.value = next;
}

function toggleThinking(msgId: string | undefined, blockIdx: number) {
	const key = `${msgId ?? ""}-${blockIdx}`;
	const next = new Set(expandedThinking.value);
	if (next.has(key)) next.delete(key);
	else next.add(key);
	expandedThinking.value = next;
}

function isToolResultExpanded(msgId: string | undefined): boolean {
	return msgId ? expandedToolResults.value.has(msgId) : false;
}

function isThinkingExpanded(msgId: string | undefined, blockIdx: number): boolean {
	return expandedThinking.value.has(`${msgId ?? ""}-${blockIdx}`);
}

watch(
	() => props.messages.length,
	async () => {
		if (!wasDisconnected) {
			await nextTick();
			if (container.value) {
				container.value.scrollTop = container.value.scrollHeight;
			}
			return;
		}
		await nextTick();
		restoreScroll();
	},
);

watch(
	() => props.isStreaming,
	async (streaming) => {
		if (streaming) {
			await nextTick();
			if (container.value) {
				container.value.scrollTop = container.value.scrollHeight;
			}
		}
	},
);

watch(
	() => props.messages,
	() => {
		expandedToolResults.value = new Set();
		expandedThinking.value = new Set();
	},
	{ deep: false },
);

defineExpose({ preserveScroll });
</script>

<template>
	<div ref="container" class="chat-transcript">
		<div v-if="messages.length === 0" class="empty-state">
			<p class="empty-title">Start a conversation</p>
			<p class="empty-subtitle">Use / to open commands, then keep the session moving.</p>
			<div class="empty-hints">
				<span class="hint-chip">/ commands</span>
				<span class="hint-chip">Enter send</span>
			</div>
		</div>
		<template v-for="(msg, index) in messages" :key="msg.id ?? index">
			<div v-if="isToolResultMessage(msg)" class="message-row tool">
				<div class="message-meta">
					<span class="message-role">{{ roleLabel(msg.role) }}</span>
				</div>
				<div class="message-content tool-row">
					<button
						class="tool-result-toggle"
						@click="toggleToolResult(msg.id)"
						:title="isToolResultExpanded(msg.id) ? 'Collapse' : 'Expand'"
					>
						<span class="toggle-icon">{{ isToolResultExpanded(msg.id) ? '-' : '+' }}</span>
						<span class="tool-result-label">{{ roleLabel(msg.role) }}</span>
					</button>
					<div v-if="isToolResultExpanded(msg.id)" class="tool-result-content">
						<pre>{{ messageContent(msg) }}</pre>
					</div>
					<div v-else class="tool-result-preview">
						{{ truncateToolResult(messageContent(msg)).text }}
					</div>
				</div>
			</div>

			<div v-else class="message-row" :class="roleClass(msg.role)">
				<div class="message-meta">
					<span class="message-role">{{ roleLabel(msg.role) }}</span>
				</div>
				<div class="message-content" :class="roleClass(msg.role)">
					<template v-for="(block, bIdx) in contentBlocks(msg)" :key="bIdx">
						<div v-if="block.kind === 'thinking'" class="thinking-block">
							<button class="thinking-toggle" @click="toggleThinking(msg.id, bIdx)">
								<span class="toggle-icon">{{ isThinkingExpanded(msg.id, bIdx) ? '-' : '+' }}</span>
								Thinking
							</button>
							<pre v-if="isThinkingExpanded(msg.id, bIdx)" class="thinking-content">{{ block.text }}</pre>
						</div>

						<div v-else-if="block.kind === 'toolCall'" class="tool-call-block">
							<span class="tool-call-header">
								<span class="tool-call-kicker">tool</span>
								<span class="tool-call-name">{{ block.toolName }}</span>
							</span>
							<details class="tool-call-details">
								<summary>Arguments</summary>
								<pre>{{ block.text }}</pre>
							</details>
						</div>

						<div v-else-if="block.kind === 'text' && block.text" class="text-block">
							{{ block.text }}
						</div>
					</template>
				</div>
			</div>
		</template>

		<div v-if="isStreaming" class="streaming-indicator">
			<span class="streaming-label">Assistant</span>
			<span class="dot"></span>
			<span class="dot"></span>
			<span class="dot"></span>
		</div>
	</div>
</template>

<script lang="ts">
function messageContent(msg: { content?: unknown; text?: string }): string {
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
export { messageContent };
</script>

<style scoped>
.chat-transcript {
	flex: 1;
	min-height: 0;
	overflow-y: auto;
	padding: 24px 32px 12px;
	display: flex;
	flex-direction: column;
	gap: 16px;
	background: transparent;
}

.empty-state {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 10px;
	flex: 1;
	text-align: center;
	color: var(--text-muted);
}

.empty-title {
	margin: 0;
	font-size: 1.1rem;
	font-weight: 500;
	color: var(--text);
}

.empty-subtitle {
	margin: 0;
	max-width: 420px;
	font-size: 0.85rem;
	line-height: 1.6;
	color: var(--text-subtle);
}

.empty-hints {
	display: flex;
	gap: 8px;
	flex-wrap: wrap;
	justify-content: center;
}

.hint-chip {
	display: inline-flex;
	align-items: center;
	height: 24px;
	padding: 0 10px;
	border-radius: 999px;
	border: 1px solid var(--border);
	background: var(--panel);
	font-family: "SF Mono", "Monaco", "Menlo", monospace;
	font-size: 0.68rem;
	color: var(--text-subtle);
}

.message-row {
	display: grid;
	grid-template-columns: 96px minmax(0, 1fr);
	gap: 16px;
	width: 100%;
	max-width: 920px;
	margin: 0 auto;
}

.message-meta {
	padding-top: 2px;
}

.message-role {
	display: inline-block;
	font-family: "SF Mono", "Monaco", "Menlo", monospace;
	font-size: 0.64rem;
	font-weight: 600;
	text-transform: uppercase;
	letter-spacing: 0.08em;
	color: var(--text-subtle);
}

.message-content {
	min-width: 0;
	padding-left: 14px;
	border-left: 1px solid var(--border);
	font-size: 0.9rem;
	line-height: 1.7;
	color: var(--text);
	word-break: break-word;
}

.message-content.user {
	max-width: 720px;
	margin-left: 28px;
}

.text-block {
	white-space: pre-wrap;
}

.text-block + .text-block,
.text-block + .thinking-block,
.text-block + .tool-call-block,
.thinking-block + .text-block,
.tool-call-block + .text-block,
.tool-call-block + .thinking-block,
.thinking-block + .tool-call-block {
	margin-top: 12px;
}

.thinking-block {
	padding-left: 10px;
	border-left: 1px solid var(--border-strong);
}

.thinking-toggle {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	padding: 0;
	background: none;
	border: none;
	color: var(--text-muted);
	font-family: "SF Mono", "Monaco", "Menlo", monospace;
	font-size: 0.7rem;
	cursor: pointer;
}

.thinking-toggle:hover {
	color: var(--text);
}

.thinking-content {
	margin: 8px 0 0;
	padding: 10px 0 0;
	font-family: "SF Mono", "Monaco", "Menlo", monospace;
	font-size: 0.74rem;
	line-height: 1.55;
	color: var(--text-muted);
	max-height: 300px;
	overflow-y: auto;
	white-space: pre-wrap;
	word-break: break-word;
}

.tool-call-block,
.tool-row {
	padding-left: 10px;
	border-left: 1px solid var(--border-strong);
}

.tool-call-header {
	display: inline-flex;
	align-items: center;
	gap: 8px;
}

.tool-call-kicker,
.tool-result-label,
.streaming-label {
	font-family: "SF Mono", "Monaco", "Menlo", monospace;
	font-size: 0.66rem;
	text-transform: uppercase;
	letter-spacing: 0.08em;
	color: var(--text-subtle);
}

.tool-call-name {
	font-family: "SF Mono", "Monaco", "Menlo", monospace;
	font-size: 0.76rem;
	color: var(--text);
}

.tool-call-details {
	margin-top: 8px;
}

.tool-call-details summary {
	cursor: pointer;
	font-size: 0.73rem;
	color: var(--text-muted);
}

.tool-call-details pre,
.tool-result-content pre {
	margin: 8px 0 0;
	font-family: "SF Mono", "Monaco", "Menlo", monospace;
	font-size: 0.72rem;
	line-height: 1.55;
	white-space: pre-wrap;
	word-break: break-word;
	color: var(--text-muted);
}

.tool-result-toggle {
	display: inline-flex;
	align-items: center;
	gap: 8px;
	padding: 0;
	background: none;
	border: none;
	color: var(--text-muted);
	cursor: pointer;
	text-align: left;
}

.tool-result-toggle:hover {
	color: var(--text);
}

.toggle-icon {
	width: 12px;
	text-align: center;
	font-family: "SF Mono", "Monaco", "Menlo", monospace;
	font-size: 0.68rem;
}

.tool-result-preview {
	margin-top: 8px;
	white-space: pre-wrap;
	word-break: break-word;
	max-height: 80px;
	overflow: hidden;
	mask-image: linear-gradient(to bottom, black 60%, transparent 100%);
	-webkit-mask-image: linear-gradient(to bottom, black 60%, transparent 100%);
	font-family: "SF Mono", "Monaco", "Menlo", monospace;
	font-size: 0.73rem;
	line-height: 1.55;
	color: var(--text-muted);
}

.tool-result-content {
	max-height: 320px;
	overflow-y: auto;
}

.streaming-indicator {
	display: flex;
	align-items: center;
	gap: 6px;
	padding: 0 32px 8px;
	width: min(920px, 100%);
	margin: 0 auto;
}

.streaming-indicator .dot {
	width: 6px;
	height: 6px;
	border-radius: 50%;
	background: var(--text-muted);
	animation: blink 1.2s infinite;
}

.streaming-indicator .dot:nth-child(3) {
	animation-delay: 0.2s;
}

.streaming-indicator .dot:nth-child(4) {
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

@media (max-width: 900px) {
	.chat-transcript {
		padding: 16px 16px 10px;
	}

	.message-row {
		grid-template-columns: 1fr;
		gap: 8px;
	}

	.message-content,
	.message-content.user,
	.tool-row {
		margin-left: 0;
		max-width: 100%;
	}

	.streaming-indicator {
		padding: 0 16px 6px;
	}
}
</style>
