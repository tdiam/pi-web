<script setup lang="ts">
import { ref, computed, watch, nextTick } from "vue";
import type { RpcSlashCommand } from "../shared-types";

const props = defineProps<{
	commands: RpcSlashCommand[];
	filter: string;
}>();

const emit = defineEmits<{
	select: [commandName: string];
	close: [];
}>();

const highlightedIndex = ref(0);
const listRef = ref<HTMLElement | null>(null);

const filtered = computed(() => {
	const q = props.filter.toLowerCase();
	if (!q) return props.commands;
	return props.commands.filter(
		(c) =>
			c.name.toLowerCase().includes(q) ||
			(c.description ?? "").toLowerCase().includes(q),
	);
});

// Reset highlight when filter changes
watch(
	() => props.filter,
	() => {
		highlightedIndex.value = 0;
	},
);

function handleKeydown(e: KeyboardEvent) {
	if (filtered.value.length === 0) {
		if (e.key === "Escape") emit("close");
		return;
	}

	switch (e.key) {
		case "ArrowDown":
			e.preventDefault();
			highlightedIndex.value =
				(highlightedIndex.value + 1) % filtered.value.length;
			scrollToHighlighted();
			break;
		case "ArrowUp":
			e.preventDefault();
			highlightedIndex.value =
				(highlightedIndex.value - 1 + filtered.value.length) %
				filtered.value.length;
			scrollToHighlighted();
			break;
		case "Enter":
			e.preventDefault();
			if (filtered.value[highlightedIndex.value]) {
				emit("select", filtered.value[highlightedIndex.value].name);
			}
			break;
		case "Escape":
			e.preventDefault();
			emit("close");
			break;
	}
}

function scrollToHighlighted() {
	nextTick(() => {
		const el = listRef.value?.children[highlightedIndex.value] as
			| HTMLElement
			| undefined;
		el?.scrollIntoView({ block: "nearest" });
	});
}

function handleClick(cmd: RpcSlashCommand) {
	emit("select", cmd.name);
}

// Expose handleKeydown so parent can forward keyboard events
defineExpose({ handleKeydown });
</script>

<template>
	<div v-if="filtered.length > 0" class="command-palette">
		<ul ref="listRef" class="command-list">
			<li
				v-for="(cmd, idx) in filtered"
				:key="cmd.name"
				class="command-item"
				:class="{ highlighted: idx === highlightedIndex }"
				@click="handleClick(cmd)"
				@mouseenter="highlightedIndex = idx"
			>
				<span class="cmd-name">/{{ cmd.name }}</span>
				<span v-if="cmd.description" class="cmd-desc">
					{{ cmd.description }}
				</span>
			</li>
		</ul>
	</div>
	<div v-else class="command-palette empty">
		<span class="empty-text">No matching commands</span>
	</div>
</template>

<style scoped>
.command-palette {
	position: absolute;
	bottom: 100%;
	left: 0;
	right: 0;
	max-height: 280px;
	overflow-y: auto;
	background: #1a1a2e;
	border: 1px solid #2d2d44;
	border-radius: 8px 8px 0 0;
	box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.4);
	z-index: 10;
}

.command-palette.empty {
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 10px;
}

.command-list {
	list-style: none;
	margin: 0;
	padding: 4px 0;
}

.command-item {
	display: flex;
	align-items: baseline;
	gap: 10px;
	padding: 8px 14px;
	cursor: pointer;
	transition: background 0.1s;
}

.command-item:hover,
.command-item.highlighted {
	background: #252545;
}

.cmd-name {
	color: #60a5fa;
	font-weight: 600;
	font-size: 0.85rem;
	white-space: nowrap;
}

.cmd-desc {
	color: #6b7280;
	font-size: 0.78rem;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.empty-text {
	color: #4b5563;
	font-size: 0.8rem;
}
</style>
