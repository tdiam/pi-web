<script setup lang="ts">
import type { SessionEntry } from "../composables/useBridgeClient";

defineProps<{
  sessions: readonly SessionEntry[];
  activeSessionId: string | null;
  runningSessionPath: string | null;
}>();

const emit = defineEmits<{
  select: [sessionPath: string];
}>();
</script>

<template>
  <div class="session-rail">
    <div class="rail-header">
      <span class="rail-title">Sessions</span>
      <div class="rail-actions">
        <slot name="header-actions"></slot>
      </div>
    </div>
    <ul v-if="sessions.length > 0" class="rail-list">
      <li
        v-for="s in sessions"
        :key="s.id"
        class="rail-item"
        :class="{
          active: s.id === activeSessionId,
          running: s.path === runningSessionPath,
        }"
        :title="s.path"
        @click="emit('select', s.path)"
      >
        <span class="item-indicator"></span>
        <span class="item-label">{{ s.name }}</span>
        <span
          v-if="s.path === runningSessionPath"
          class="item-status"
          role="status"
          aria-label="Agent running"
          title="Agent running"
        >
          <span class="item-status-dot" aria-hidden="true"></span>
        </span>
      </li>
    </ul>
    <p v-else class="rail-empty">No sessions</p>
  </div>
</template>

<style scoped>
.session-rail {
  display: flex;
  flex-direction: column;
  padding: 12px 10px 0;
  overflow: hidden;
}

.rail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 10px;
  color: var(--text-subtle);
  flex-shrink: 0;
}

.rail-title {
  font-size: 0.68rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.rail-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.rail-list {
  list-style: none;
  margin: 0;
  padding: 0;
  overflow-y: auto;
}

.rail-item {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 32px;
  padding: 0 10px;
  border-radius: 8px;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 0.82rem;
  transition:
    background 0.12s ease,
    color 0.12s ease;
}

.rail-item:hover {
  background: var(--panel-2);
}

.rail-item.active {
  background: var(--panel-3);
  color: var(--text);
}

.item-indicator {
  width: 2px;
  height: 14px;
  border-radius: 999px;
  background: transparent;
  flex-shrink: 0;
}

.rail-item.active .item-indicator {
  background: var(--text);
}

.rail-item.running .item-indicator {
  background: var(--diff-added-accent);
}

.item-label {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-status {
  width: 20px;
  height: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.item-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--diff-added-accent);
  box-shadow: 0 0 0 0
    color-mix(in srgb, var(--diff-added-accent) 34%, transparent);
  animation:
    session-running-blink 1.1s ease-in-out infinite,
    session-running-ping 1.8s ease-out infinite;
}

.rail-empty {
  margin: 0;
  padding: 8px 10px;
  font-size: 0.78rem;
  color: var(--text-subtle);
}

@keyframes session-running-blink {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }

  50% {
    opacity: 0.38;
    transform: scale(0.86);
  }
}

@keyframes session-running-ping {
  0% {
    box-shadow: 0 0 0 0
      color-mix(in srgb, var(--diff-added-accent) 34%, transparent);
  }

  75% {
    box-shadow: 0 0 0 6px
      color-mix(in srgb, var(--diff-added-accent) 0%, transparent);
  }

  100% {
    box-shadow: 0 0 0 0
      color-mix(in srgb, var(--diff-added-accent) 0%, transparent);
  }
}
</style>
