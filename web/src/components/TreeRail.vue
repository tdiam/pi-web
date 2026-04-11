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
		<div class="rail-header">Tree</div>
		<ul v-if="entries.length > 0" class="rail-list">
			<li
				v-for="e in entries"
				:key="e.id"
				class="rail-item"
				:title="`${e.type} — ${e.id}`"
				@click="emit('navigate', e.id)"
			>
				<span class="entry-type-badge">{{ e.type.slice(0, 1).toUpperCase() }}</span>
				<span class="entry-label">{{ entryLabel(e) }}</span>
				<span v-if="e.timestamp" class="entry-time">{{ e.timestamp }}</span>
			</li>
		</ul>
		<p v-else class="rail-empty">No entries</p>
	</div>
</template>

<style scoped>
.tree-rail {
	display: flex;
	flex-direction: column;
	height: 100%;
	overflow: hidden;
}

.rail-header {
	padding: 12px 12px 8px;
	font-size: 0.7rem;
	font-weight: 700;
	text-transform: uppercase;
	letter-spacing: 0.1em;
	color: #6b7280;
	flex-shrink: 0;
}

.rail-list {
	list-style: none;
	margin: 0;
	padding: 0 6px;
	overflow-y: auto;
	flex: 1;
}

.rail-item {
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 7px 10px;
	border-radius: 6px;
	font-size: 0.8rem;
	color: #d1d5db;
	cursor: pointer;
	transition: background 0.12s;
}

.rail-item:hover {
	background: #2a2a42;
}

.entry-type-badge {
	width: 20px;
	height: 20px;
	border-radius: 4px;
	background: #2d2d44;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 0.65rem;
	font-weight: 700;
	color: #9ca3af;
	flex-shrink: 0;
}

.entry-label {
	flex: 1;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.entry-time {
	font-size: 0.6rem;
	color: #4b5563;
	flex-shrink: 0;
}

.rail-empty {
	color: #4b5563;
	font-size: 0.75rem;
	font-style: italic;
	padding: 8px 12px;
	margin: 0;
}
</style>
