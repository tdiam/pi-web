<script setup lang="ts">
import type { TreeEntry } from "../composables/useBridgeClient";

defineProps<{
	entries: readonly TreeEntry[];
}>();

const emit = defineEmits<{
	navigate: [entryId: string];
}>();

function entryLabel(entry: TreeEntry): string {
	return entry.label ?? entry.type ?? entry.id;
}
</script>

<template>
	<div class="tree-rail">
		<div class="rail-header">Context</div>
		<ul v-if="entries.length > 0" class="rail-list">
			<li
				v-for="e in entries"
				:key="e.id"
				class="rail-item"
				:title="`${e.type} - ${e.id}`"
				@click="emit('navigate', e.id)"
			>
				<span class="entry-type-badge">{{ e.type.slice(0, 1).toUpperCase() }}</span>
				<span class="entry-label">{{ entryLabel(e) }}</span>
			</li>
		</ul>
		<p v-else class="rail-empty">No entries</p>
	</div>
</template>

<style scoped>
.tree-rail {
	display: flex;
	flex-direction: column;
	padding: 12px 10px 12px;
	min-height: 0;
	overflow: hidden;
}

.rail-header {
	padding: 8px 10px;
	font-family: "SF Mono", "Monaco", "Menlo", monospace;
	font-size: 0.68rem;
	font-weight: 600;
	text-transform: uppercase;
	letter-spacing: 0.08em;
	color: var(--text-subtle);
	flex-shrink: 0;
}

.rail-list {
	list-style: none;
	margin: 0;
	padding: 0;
	overflow-y: auto;
	flex: 1;
}

.rail-item {
	display: flex;
	align-items: center;
	gap: 10px;
	min-height: 36px;
	padding: 6px 10px;
	border-radius: 8px;
	font-size: 0.8rem;
	color: var(--text-muted);
	cursor: pointer;
	transition: background 0.12s ease, color 0.12s ease;
}

.rail-item:hover {
	background: var(--panel-2);
	color: var(--text);
}

.entry-type-badge {
	width: 16px;
	height: 16px;
	border-radius: 4px;
	border: 1px solid var(--border-strong);
	background: var(--panel);
	display: inline-flex;
	align-items: center;
	justify-content: center;
	font-family: "SF Mono", "Monaco", "Menlo", monospace;
	font-size: 0.6rem;
	color: var(--text-subtle);
	flex-shrink: 0;
}

.entry-label {
	flex: 1;
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.rail-empty {
	margin: 0;
	padding: 8px 10px;
	font-size: 0.78rem;
	color: var(--text-subtle);
}
</style>
