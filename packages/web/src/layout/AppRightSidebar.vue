<script setup lang="ts">
import { PanelRightOpen } from "lucide-vue-next";
import SessionTreeRail from "../components/SessionTreeRail.vue";
import type { TreeEntry } from "../composables/useBridgeClient";

defineProps<{
  treeEntries: readonly TreeEntry[];
  sidebarOpen: boolean;
  sessionLabel: string;
  sessionPath: string | null;
}>();

const emit = defineEmits<{
  toggleSidebar: [];
  closeSidebar: [];
  selectTreeEntry: [entryId: string];
  refreshTree: [];
}>();
</script>

<template>
  <aside
    class="right-rail"
    :class="{ open: sidebarOpen, collapsed: !sidebarOpen }"
  >
    <div v-if="sidebarOpen" class="rail-panel">
      <SessionTreeRail
        :entries="treeEntries"
        :session-label="sessionLabel"
        :session-path="sessionPath"
        :show-collapse-toggle="true"
        @select="emit('selectTreeEntry', $event)"
        @refresh="emit('refreshTree')"
        @toggle-collapse="emit('toggleSidebar')"
      />
    </div>

    <div v-else class="rail-collapsed">
      <button
        class="collapsed-tab"
        type="button"
        aria-label="Expand outline"
        title="Expand outline"
        @click="emit('toggleSidebar')"
      >
        <PanelRightOpen aria-hidden="true" />
      </button>
    </div>
  </aside>
  <div class="rail-backdrop" @click="emit('closeSidebar')"></div>
</template>

<style scoped>
.right-rail {
  grid-column: 2;
  min-width: 0;
  height: 100%;
  background: var(--rail-bg);
  border-left: 1px solid var(--border);
  overflow: hidden;
}

.right-rail.collapsed {
  position: absolute;
  top: 0;
  right: 10px;
  bottom: 0;
  width: 44px;
  background: transparent;
  border-left: 0;
  overflow: visible;
  pointer-events: none;
  z-index: 12;
}

.rail-panel {
  height: 100%;
  min-width: 0;
  overflow: hidden;
}

.rail-collapsed {
  display: flex;
  justify-content: center;
  padding-top: 12px;
  pointer-events: none;
}

.collapsed-tab {
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: color-mix(in srgb, var(--panel) 82%, transparent);
  color: var(--text-subtle);
  cursor: pointer;
  pointer-events: auto;
  transition:
    background 0.12s ease,
    border-color 0.12s ease,
    color 0.12s ease,
    transform 0.12s ease;
}

.collapsed-tab:hover {
  background: var(--panel-2);
  border-color: var(--border-strong);
  color: var(--text);
  transform: translateY(-1px);
}

.collapsed-tab svg {
  width: 14px;
  height: 14px;
}

.rail-backdrop {
  display: none;
}

@media (max-width: 900px) {
  .right-rail {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    width: min(88vw, 360px);
    transform: translateX(calc(100% - 44px));
    transition: transform 0.2s ease;
    z-index: 15;
  }

  .right-rail.open {
    transform: translateX(0);
    box-shadow: var(--shadow);
  }

  .right-rail.collapsed {
    right: 10px;
    width: min(88vw, 360px);
    background: transparent;
    border-left: 0;
    pointer-events: none;
    z-index: 15;
  }

  .rail-collapsed {
    justify-content: flex-start;
    padding: 10px 6px 0 0;
    height: 100%;
  }

  .rail-backdrop {
    display: block;
    position: absolute;
    inset: 0;
    background: var(--backdrop);
    z-index: 14;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.2s ease;
  }

  .right-rail.open ~ .rail-backdrop {
    pointer-events: auto;
    opacity: 1;
  }
}
</style>
