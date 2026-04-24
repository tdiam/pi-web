<script setup lang="ts">
import { ref } from "vue";
import SessionTreeRail from "../components/SessionTreeRail.vue";
import type { TreeEntry } from "../composables/useBridgeClient";

const props = defineProps<{
  treeEntries: readonly TreeEntry[];
  sidebarOpen: boolean;
  sessionLabel: string;
  sessionPath: string | null;
}>();

const emit = defineEmits<{
  closeSidebar: [];
  selectTreeEntry: [entryId: string];
  refreshTree: [];
}>();

type RightSidebarTabId = "tree";

const activeTab = ref<RightSidebarTabId>("tree");

const rightSidebarTabs = [
  {
    id: "tree" as const,
    label: "Tree",
  },
];
</script>

<template>
  <aside class="right-rail" :class="{ open: sidebarOpen }">
    <div class="rail-shell">
      <div class="rail-tabs" role="tablist" aria-label="Right sidebar panels">
        <button
          v-for="tab in rightSidebarTabs"
          :id="`right-rail-tab-${tab.id}`"
          :key="tab.id"
          class="rail-tab"
          :class="{ active: activeTab === tab.id }"
          type="button"
          role="tab"
          :aria-selected="activeTab === tab.id"
          :aria-controls="`right-rail-panel-${tab.id}`"
          @click="activeTab = tab.id"
        >
          <span class="rail-tab-label">{{ tab.label }}</span>
        </button>
      </div>

      <div class="rail-panel">
        <div
          v-if="activeTab === 'tree'"
          id="right-rail-panel-tree"
          class="tab-panel"
          role="tabpanel"
          aria-labelledby="right-rail-tab-tree"
        >
          <SessionTreeRail
            :entries="treeEntries"
            :session-label="sessionLabel"
            :session-path="sessionPath"
            @select="emit('selectTreeEntry', $event)"
            @refresh="emit('refreshTree')"
          />
        </div>
      </div>
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

.rail-shell {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  height: 100%;
  background: var(--rail-bg);
}

.rail-tabs {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 0px 12px 0;
  border-bottom: 1px solid var(--border);
}

.rail-tab {
  min-width: 0;
  height: 34px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 2px;
  border: none;
  border-radius: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--text-subtle);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    color 0.12s ease,
    border-color 0.12s ease;
}

.rail-tab:hover {
  color: var(--text);
}

.rail-tab:focus-visible {
  outline: none;
  color: var(--text);
  border-color: var(--accent);
}

.rail-tab.active {
  color: var(--text);
  border-color: var(--accent);
}

.rail-tab-label {
  font-size: 0.73rem;
  font-weight: 600;
  line-height: 1;
}

.rail-panel {
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.tab-panel {
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
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
    width: min(100vw, 420px);
    max-width: 100vw;
    transform: translateX(100%);
    transition: transform 0.2s ease;
    z-index: 15;
  }

  .right-rail.open {
    transform: translateX(0);
    box-shadow: var(--shadow);
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

@media (max-width: 640px) {
  .right-rail {
    width: 100vw;
    border-left: none;
  }

  .rail-tabs {
    gap: 12px;
    padding: 10px 10px 0;
  }

  .rail-tab {
    height: 38px;
  }

  .rail-tab-label {
    font-size: 0.79rem;
  }

}
</style>
