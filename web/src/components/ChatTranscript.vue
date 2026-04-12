<script setup lang="ts">
import { ref, watch, nextTick } from "vue";
import type { TranscriptEntry } from "../composables/useBridgeClient";

const props = defineProps<{
	messages: readonly TranscriptEntry[];
	isStreaming: boolean;
}>();

const container = ref<HTMLDivElement | null>(null);

// Scroll preservation for reconnect scenarios
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

/** Map message role to display category */
function roleClass(role: string): "user" | "assistant" | "tool" {
	if (role === "user") return "user";
	if (role === "assistant") return "assistant";
	return "tool";
}

/** Display label for role */
function roleLabel(role: string): string {
	if (role === "user") return "You";
	if (role === "assistant") return "Assistant";
	if (role === "toolResult") return "Tool Result";
	if (role === "tool") return "Tool";
	return role;
}

/** Extract content blocks from a message into a structured array */
interface ContentBlock {
	kind: "text" | "toolCall" | "thinking" | "image";
	text: string;
	toolName?: string;
	toolId?: string;
	isError?: boolean;
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
				toolId: (b.id as string) ?? undefined,
			});
		} else if (type === "toolResult") {
			// toolResult can be a top-level block in some formats
			const text = typeof b.text === "string" ? b.text : JSON.stringify(block, null, 2);
			blocks.push({
				kind: "text",
				text,
				isError: b.isError === true,
			});
		} else if (type === "image" || type === "image_url") {
			blocks.push({ kind: "image", text: "[image]" });
		}
		// Skip unknown block types
	}

	return blocks;
}

/** For toolResult role messages, truncate the raw text display */
function truncateToolResult(text: string, maxLen = 500): { text: string; truncated: boolean } {
	if (text.length <= maxLen) return { text, truncated: false };
	return { text: text.slice(0, maxLen) + "\n... (truncated)", truncated: true };
}

/** Is this a toolResult message that should be collapsed? */
function isToolResultMessage(msg: TranscriptEntry): boolean {
	return msg.role === "toolResult" || msg.role === "tool";
}

// Toggle state for collapsible blocks
const expandedToolResults = ref(new Set<string>());
const expandedThinking = ref(new Set<string>());

function toggleToolResult(msgId: string | undefined) {
	if (!msgId) return;
	const s = new Set(expandedToolResults.value);
	if (s.has(msgId)) s.delete(msgId);
	else s.add(msgId);
	expandedToolResults.value = s;
}

function toggleThinking(msgId: string | undefined, blockIdx: number) {
	const key = `${msgId ?? ""}-${blockIdx}`;
	const s = new Set(expandedThinking.value);
	if (s.has(key)) s.delete(key);
	else s.add(key);
	expandedThinking.value = s;
}

function isToolResultExpanded(msgId: string | undefined): boolean {
	return msgId ? expandedToolResults.value.has(msgId) : false;
}

function isThinkingExpanded(msgId: string | undefined, blockIdx: number): boolean {
	return expandedThinking.value.has(`${msgId ?? ""}-${blockIdx}`);
}

// Watch for reconnection-driven transcript repopulation.
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

// Reset collapse state when messages change to a different session
watch(
	() => props.messages,
	() => {
		expandedToolResults.value = new Set();
		expandedThinking.value = new Set();
	},
	{ deep: false }
);

defineExpose({ preserveScroll });
</script>

<template>
	<div ref="container" class="chat-transcript">
		<div v-if="messages.length === 0" class="empty-state">
			<p>No messages yet</p>
		</div>
		<template v-for="(msg, index) in messages" :key="msg.id ?? index">
			<!-- Tool result messages: collapsible, dimmed -->
			<div v-if="isToolResultMessage(msg)" class="message-row tool">
				<div class="tool-result-bubble" :class="{ expanded: isToolResultExpanded(msg.id) }">
					<button
						class="tool-result-toggle"
						@click="toggleToolResult(msg.id)"
						:title="isToolResultExpanded(msg.id) ? 'Collapse' : 'Expand'"
					>
						<span class="toggle-icon">{{ isToolResultExpanded(msg.id) ? '▼' : '▶' }}</span>
						<span class="tool-result-label">{{ roleLabel(msg.role) }}</span>
					</button>
					<div class="tool-result-content" v-if="isToolResultExpanded(msg.id)">
						<pre>{{ messageContent(msg) }}</pre>
					</div>
					<div class="tool-result-preview" v-else>
						{{ truncateToolResult(messageContent(msg)).text }}
					</div>
				</div>
			</div>

			<!-- User / Assistant messages: rich content blocks -->
			<div v-else class="message-row" :class="roleClass(msg.role)">
				<div class="message-bubble" :class="roleClass(msg.role)">
					<span class="message-role">{{ roleLabel(msg.role) }}</span>
					<template v-for="(block, bIdx) in contentBlocks(msg)" :key="bIdx">
						<!-- Thinking block: collapsible, dimmed -->
						<div v-if="block.kind === 'thinking'" class="thinking-block">
							<button
								class="thinking-toggle"
								@click="toggleThinking(msg.id, bIdx)"
							>
								<span class="toggle-icon">{{ isThinkingExpanded(msg.id, bIdx) ? '▼' : '▶' }}</span>
								Thinking...
							</button>
							<pre v-if="isThinkingExpanded(msg.id, bIdx)" class="thinking-content">{{ block.text }}</pre>
						</div>

						<!-- Tool call block: show tool name + collapsed args -->
						<div v-else-if="block.kind === 'toolCall'" class="tool-call-block">
							<span class="tool-call-header">
								<span class="tool-call-icon">⚙</span>
								<span class="tool-call-name">{{ block.toolName }}</span>
							</span>
							<details class="tool-call-details">
								<summary>Arguments</summary>
								<pre>{{ block.text }}</pre>
							</details>
						</div>

						<!-- Text block: normal rendering -->
						<div v-else-if="block.kind === 'text' && block.text" class="text-block">
							{{ block.text }}
						</div>
					</template>
					<span v-if="msg.timestamp" class="message-time">{{ msg.timestamp }}</span>
				</div>
			</div>
		</template>

		<div v-if="isStreaming" class="streaming-indicator">
			<span class="dot"></span>
			<span class="dot"></span>
			<span class="dot"></span>
		</div>
	</div>
</template>

<script lang="ts">
/** Helper used by tool result rendering — extracts plain text from message */
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

.message-row.tool {
	justify-content: flex-start;
}

/* ---- Message Bubbles ---- */
.message-bubble {
	max-width: 80%;
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

.message-role {
	display: block;
	font-size: 0.7rem;
	font-weight: 600;
	text-transform: uppercase;
	letter-spacing: 0.05em;
	margin-bottom: 4px;
	opacity: 0.5;
}

.text-block {
	white-space: pre-wrap;
}

.message-time {
	display: block;
	font-size: 0.65rem;
	margin-top: 4px;
	opacity: 0.4;
	text-align: right;
}

/* ---- Thinking Block ---- */
.thinking-block {
	margin: 4px 0;
	border-left: 2px solid #6366f1;
	padding-left: 8px;
}

.thinking-toggle {
	display: flex;
	align-items: center;
	gap: 4px;
	background: none;
	border: none;
	color: #818cf8;
	font-size: 0.75rem;
	cursor: pointer;
	padding: 2px 0;
	opacity: 0.7;
}

.thinking-toggle:hover {
	opacity: 1;
}

.thinking-content {
	margin: 4px 0 0 0;
	padding: 6px 8px;
	background: rgba(99, 102, 241, 0.08);
	border-radius: 4px;
	font-size: 0.8rem;
	color: #a5b4fc;
	max-height: 300px;
	overflow-y: auto;
	white-space: pre-wrap;
	word-break: break-word;
}

/* ---- Tool Call Block ---- */
.tool-call-block {
	margin: 6px 0;
	padding: 6px 10px;
	background: rgba(234, 179, 8, 0.06);
	border: 1px solid rgba(234, 179, 8, 0.15);
	border-radius: 6px;
	font-size: 0.8rem;
}

.tool-call-header {
	display: flex;
	align-items: center;
	gap: 6px;
	color: #fbbf24;
	font-weight: 600;
}

.tool-call-icon {
	font-size: 0.85rem;
}

.tool-call-name {
	font-family: 'Monaco', 'Menlo', monospace;
}

.tool-call-details {
	margin-top: 4px;
}

.tool-call-details summary {
	cursor: pointer;
	color: #9ca3af;
	font-size: 0.75rem;
}

.tool-call-details pre {
	margin: 4px 0 0;
	padding: 6px 8px;
	background: rgba(0, 0, 0, 0.2);
	border-radius: 4px;
	font-size: 0.75rem;
	color: #d1d5db;
	max-height: 200px;
	overflow-y: auto;
	white-space: pre-wrap;
	word-break: break-word;
}

/* ---- Tool Result Bubble ---- */
.tool-result-bubble {
	max-width: 85%;
	padding: 6px 10px;
	border-radius: 8px;
	background: #1e1e32;
	border: 1px solid #2d2d44;
	font-size: 0.8rem;
	color: #9ca3af;
}

.tool-result-toggle {
	display: flex;
	align-items: center;
	gap: 6px;
	background: none;
	border: none;
	color: #9ca3af;
	cursor: pointer;
	padding: 0;
	font-size: 0.75rem;
	width: 100%;
	text-align: left;
}

.tool-result-toggle:hover {
	color: #e2e8f0;
}

.toggle-icon {
	font-size: 0.6rem;
	width: 12px;
	display: inline-block;
	text-align: center;
}

.tool-result-label {
	font-weight: 600;
	text-transform: uppercase;
	letter-spacing: 0.05em;
	font-size: 0.65rem;
	opacity: 0.6;
}

.tool-result-preview {
	margin-top: 4px;
	white-space: pre-wrap;
	word-break: break-word;
	max-height: 80px;
	overflow: hidden;
	position: relative;
	mask-image: linear-gradient(to bottom, black 60%, transparent 100%);
	-webkit-mask-image: linear-gradient(to bottom, black 60%, transparent 100%);
	font-family: 'Monaco', 'Menlo', monospace;
	font-size: 0.75rem;
}

.tool-result-content {
	margin-top: 4px;
	max-height: 400px;
	overflow-y: auto;
}

.tool-result-content pre {
	margin: 0;
	white-space: pre-wrap;
	word-break: break-word;
	font-family: 'Monaco', 'Menlo', monospace;
	font-size: 0.75rem;
	color: #d1d5db;
}

/* ---- Streaming ---- */
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
