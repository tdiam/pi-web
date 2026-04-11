<script setup lang="ts">
import type { SessionEntry } from "../composables/useBridgeClient";

defineProps<{
	sessions: readonly SessionEntry[];
	activeSessionId: string | null;
}>();

const emit = defineEmits<{
	select: [sessionId: string];
}>();
</script>

<template>
	<div class="session-rail">
		<div class="rail-header">Sessions</div>
		<ul v-if="sessions.length > 0" class="rail-list">
			<li
				v-for="s in sessions"
				:key="s.id"
				class="rail-item"
				:class="{ active: s.id === activeSessionId }"
				:title="s.path"
				@click="emit('select', s.path)"
			>
				<span class="item-indicator" v-if="s.id === activeSessionId"></span>
				<span class="item-label">{{ s.name }}</span>
			</li>
		</ul>
		<p v-else class="rail-empty">No sessions</p>
	</div>
</template>

<style scoped>
.session-rail {
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
	gap: 6px;
	padding: 7px 10px;
	border-radius: 6px;
	font-size: 0.8rem;
	color: #d1d5db;
	cursor: pointer;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
	transition: background 0.12s;
}

.rail-item:hover {
	background: #2a2a42;
}

.rail-item.active {
	background: #1e3a5f;
	color: #60a5fa;
}

.item-indicator {
	width: 6px;
	height: 6px;
	border-radius: 50%;
	background: #60a5fa;
	flex-shrink: 0;
}

.item-label {
	overflow: hidden;
	text-overflow: ellipsis;
}

.rail-empty {
	color: #4b5563;
	font-size: 0.75rem;
	font-style: italic;
	padding: 8px 12px;
	margin: 0;
}
</style>
