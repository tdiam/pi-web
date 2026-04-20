<script setup lang="ts">
import {
  AlertCircle,
  Check,
  ChevronDown,
  GitBranch,
  LoaderCircle,
  RefreshCw,
} from "lucide-vue-next";
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import type { RpcGitBranch, RpcGitRepoState } from "../shared-types";

const props = defineProps<{
  label: string | null;
  repoState: RpcGitRepoState | null;
  loading: boolean;
  switching: boolean;
  error: string | null;
  disabled?: boolean;
  refresh: (force?: boolean) => Promise<RpcGitRepoState | null>;
  switchBranch: (branchName: string) => Promise<RpcGitRepoState | null>;
}>();

const rootRef = ref<HTMLElement | null>(null);
const triggerRef = ref<HTMLButtonElement | null>(null);
const searchInputRef = ref<HTMLInputElement | null>(null);
const listRef = ref<HTMLElement | null>(null);
const isOpen = ref(false);
const searchText = ref("");
const highlightedIndex = ref(0);

const displayLabel = computed(() => {
  const fallback = props.repoState?.headLabel ?? props.label;
  const branch = fallback?.trim();
  return branch ? branch : null;
});
const isBusy = computed(() => props.loading || props.switching);
const filteredBranches = computed(() => {
  if (!props.repoState) return [];
  const query = searchText.value.trim().toLowerCase();
  if (!query) return props.repoState.branches;
  return props.repoState.branches.filter(branch => {
    const haystack = [branch.name, branch.shortName, branch.remoteName]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(query);
  });
});
const triggerTitle = computed(() => {
  if (!displayLabel.value) return "Git branch";
  if (props.repoState?.isDirty) {
    return `${displayLabel.value} (working tree has uncommitted changes)`;
  }
  return displayLabel.value;
});
const showSearch = computed(
  () => filteredBranches.value.length > 8 || searchText.value.length > 0,
);

function syncHighlightedIndex() {
  if (filteredBranches.value.length === 0) {
    highlightedIndex.value = 0;
    return;
  }

  const currentIndex = filteredBranches.value.findIndex(
    branch => branch.isCurrent,
  );
  highlightedIndex.value = currentIndex >= 0 ? currentIndex : 0;
}

function scrollToHighlighted() {
  nextTick(() => {
    const element = listRef.value?.children[highlightedIndex.value] as
      | HTMLElement
      | undefined;
    element?.scrollIntoView({ block: "nearest" });
  });
}

async function ensureRepoState(force = false) {
  await props.refresh(force);
  syncHighlightedIndex();
  scrollToHighlighted();
}

async function openDropdown() {
  if (props.disabled || !displayLabel.value) return;
  isOpen.value = true;
  searchText.value = "";
  syncHighlightedIndex();
  await nextTick();
  if (showSearch.value && (props.repoState || props.loading)) {
    searchInputRef.value?.focus();
  } else {
    listRef.value?.focus();
  }
  if (!props.repoState && !props.loading) {
    void ensureRepoState(true);
  } else {
    scrollToHighlighted();
  }
}

function closeDropdown(options?: { focusTrigger?: boolean }) {
  isOpen.value = false;
  searchText.value = "";
  if (options?.focusTrigger) {
    nextTick(() => {
      triggerRef.value?.focus();
    });
  }
}

function toggleDropdown() {
  if (isOpen.value) {
    closeDropdown();
    return;
  }
  void openDropdown();
}

function updateHighlight(nextIndex: number) {
  const maxIndex = filteredBranches.value.length - 1;
  highlightedIndex.value = Math.min(Math.max(nextIndex, 0), maxIndex);
  scrollToHighlighted();
}

async function handleRefresh(force = true) {
  if (isBusy.value) return;
  await ensureRepoState(force);
}

async function selectBranch(branch: RpcGitBranch) {
  if (props.switching) return;
  if (branch.isCurrent) {
    closeDropdown({ focusTrigger: true });
    return;
  }

  const nextState = await props.switchBranch(branch.name);
  if (nextState) {
    closeDropdown({ focusTrigger: true });
  }
}

function handleTriggerKeydown(event: KeyboardEvent) {
  if (props.disabled || !displayLabel.value) return;

  switch (event.key) {
    case "ArrowDown":
      event.preventDefault();
      if (!isOpen.value) {
        void openDropdown();
        return;
      }
      updateHighlight(highlightedIndex.value + 1);
      break;
    case "ArrowUp":
      event.preventDefault();
      if (!isOpen.value) {
        void openDropdown();
        return;
      }
      updateHighlight(highlightedIndex.value - 1);
      break;
    case "Enter":
    case " ":
      event.preventDefault();
      toggleDropdown();
      break;
  }
}

function handleSearchKeydown(event: KeyboardEvent) {
  if (!isOpen.value) return;

  switch (event.key) {
    case "ArrowDown":
      event.preventDefault();
      if (filteredBranches.value.length > 0) {
        updateHighlight(
          (highlightedIndex.value + 1) % filteredBranches.value.length,
        );
      }
      break;
    case "ArrowUp":
      event.preventDefault();
      if (filteredBranches.value.length > 0) {
        updateHighlight(
          (highlightedIndex.value - 1 + filteredBranches.value.length) %
            filteredBranches.value.length,
        );
      }
      break;
    case "Enter": {
      if (filteredBranches.value.length === 0) return;
      event.preventDefault();
      const branch = filteredBranches.value[highlightedIndex.value];
      if (branch) {
        void selectBranch(branch);
      }
      break;
    }
    case "Escape":
      event.preventDefault();
      closeDropdown({ focusTrigger: true });
      break;
    case "Tab":
      closeDropdown();
      break;
  }
}

function handleDocumentMousedown(event: MouseEvent) {
  const target = event.target;
  if (!(target instanceof Node)) return;
  if (!rootRef.value?.contains(target)) {
    closeDropdown();
  }
}

watch(isOpen, open => {
  if (typeof document === "undefined") return;
  if (open) {
    document.addEventListener("mousedown", handleDocumentMousedown);
    return;
  }
  document.removeEventListener("mousedown", handleDocumentMousedown);
});

watch(filteredBranches, () => {
  if (highlightedIndex.value >= filteredBranches.value.length) {
    highlightedIndex.value = Math.max(0, filteredBranches.value.length - 1);
  }
  scrollToHighlighted();
});

watch(
  () => props.repoState,
  async repoState => {
    if (!isOpen.value) return;
    syncHighlightedIndex();
    await nextTick();
    if (repoState && !props.loading) {
      if (showSearch.value) {
        searchInputRef.value?.focus();
      } else {
        listRef.value?.focus();
      }
    }
    scrollToHighlighted();
  },
);

onBeforeUnmount(() => {
  if (typeof document !== "undefined") {
    document.removeEventListener("mousedown", handleDocumentMousedown);
  }
});
</script>

<template>
  <div v-if="displayLabel" ref="rootRef" class="git-dropdown">
    <button
      ref="triggerRef"
      class="git-trigger"
      :type="'button'"
      :disabled="disabled || isBusy"
      :title="triggerTitle"
      :aria-expanded="isOpen"
      aria-haspopup="dialog"
      @click="toggleDropdown"
      @keydown="handleTriggerKeydown"
    >
      <GitBranch class="git-trigger-icon" aria-hidden="true" />
      <span class="git-trigger-text">{{ displayLabel }}</span>
      <span
        v-if="repoState?.isDirty"
        class="git-trigger-dirty"
        aria-label="Working tree has uncommitted changes"
      />
      <LoaderCircle
        v-if="isBusy"
        class="git-trigger-spinner spin"
        aria-hidden="true"
      />
      <ChevronDown v-else class="git-trigger-caret" aria-hidden="true" />
    </button>

    <div v-if="isOpen" class="git-menu">
      <div class="git-menu-header">
        <div class="git-menu-copy">
          <span class="git-menu-title">Switch branch</span>
          <span v-if="repoState" class="git-menu-meta">{{
            repoState.repoRoot
          }}</span>
        </div>
        <button
          class="git-refresh"
          :type="'button'"
          :disabled="isBusy"
          title="Refresh branches"
          @click="handleRefresh(true)"
        >
          <RefreshCw
            class="git-refresh-icon"
            :class="{ spin: loading }"
            aria-hidden="true"
          />
        </button>
      </div>

      <div v-if="repoState?.detached" class="git-note">
        HEAD is detached. Switching to a branch will reattach it.
      </div>
      <div v-else-if="repoState?.isDirty" class="git-note git-note-warning">
        Working tree has local changes. Git may refuse some switches.
      </div>
      <div v-if="error" class="git-error" role="alert">
        <AlertCircle class="git-error-icon" aria-hidden="true" />
        <span>{{ error }}</span>
      </div>

      <label v-if="showSearch" class="git-search">
        <input
          ref="searchInputRef"
          v-model="searchText"
          class="git-search-input"
          type="text"
          placeholder="Filter branches"
          @keydown="handleSearchKeydown"
        />
      </label>

      <div v-if="loading && !repoState" class="git-empty">
        Loading branches...
      </div>
      <div v-else-if="!repoState" class="git-empty">
        No git repository found.
      </div>
      <div v-else-if="filteredBranches.length === 0" class="git-empty">
        No matching branches
      </div>
      <ul
        v-else
        ref="listRef"
        class="git-list"
        tabindex="-1"
        @keydown="handleSearchKeydown"
      >
        <li
          v-for="(branch, index) in filteredBranches"
          :key="branch.kind + ':' + branch.name"
          class="git-list-item"
        >
          <button
            class="git-option"
            :type="'button'"
            :class="{
              highlighted: index === highlightedIndex,
              selected: branch.isCurrent,
            }"
            :disabled="switching"
            @click="selectBranch(branch)"
            @mouseenter="highlightedIndex = index"
          >
            <div class="git-option-copy">
              <span class="git-option-name">{{ branch.shortName }}</span>
              <span class="git-option-meta">
                {{ branch.kind
                }}<template v-if="branch.remoteName">
                  · {{ branch.remoteName }}</template
                >
              </span>
            </div>
            <Check
              v-if="branch.isCurrent"
              class="git-option-check"
              aria-hidden="true"
            />
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.git-dropdown {
  position: relative;
  min-width: 0;
}

.git-trigger {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  max-width: 100%;
  height: 26px;
  padding: 0 10px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--border) 50%, transparent);
  background: color-mix(in srgb, var(--panel) 60%, transparent);
  color: var(--text-muted);
  cursor: pointer;
  transition:
    background 0.15s ease,
    border-color 0.15s ease,
    color 0.15s ease;
}

.git-trigger:hover:not(:disabled),
.git-trigger[aria-expanded="true"],
.git-trigger:focus-visible {
  border-color: var(--border-strong);
  background: var(--panel-2);
  color: var(--text);
  outline: none;
}

.git-trigger:disabled {
  cursor: not-allowed;
  opacity: 0.72;
}

.git-trigger-icon,
.git-trigger-caret,
.git-trigger-spinner {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
  color: var(--text-subtle);
}

.git-trigger-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--pi-font-mono);
  font-size: 0.64rem;
}

.git-trigger-dirty {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  flex-shrink: 0;
  background: #f59e0b;
  box-shadow: 0 0 0 3px color-mix(in srgb, #f59e0b 18%, transparent);
}

.git-menu {
  position: absolute;
  left: 0;
  bottom: calc(100% + 10px);
  width: min(320px, calc(100vw - 24px));
  padding: 8px;
  border: 1px solid var(--border-strong);
  border-radius: 16px;
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--panel) 97%, transparent),
    var(--bg-elevated)
  );
  box-shadow: var(--shadow);
  backdrop-filter: blur(18px);
  z-index: 20;
}

.git-menu-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 4px 4px 8px;
}

.git-menu-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.git-menu-title {
  font-family: var(--pi-font-sans);
  font-size: 0.74rem;
  color: var(--text);
}

.git-menu-meta {
  font-family: var(--pi-font-mono);
  font-size: 0.64rem;
  color: var(--text-subtle);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.git-refresh {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 10px;
  border: 1px solid color-mix(in srgb, var(--border) 82%, transparent);
  background: transparent;
  color: var(--text-subtle);
  cursor: pointer;
}

.git-refresh:hover:not(:disabled),
.git-refresh:focus-visible {
  border-color: var(--border-strong);
  background: var(--panel-2);
  color: var(--text);
  outline: none;
}

.git-refresh:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.git-refresh-icon,
.git-error-icon,
.git-option-check {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

.git-search {
  display: block;
  margin-bottom: 8px;
}

.git-search-input {
  width: 100%;
  height: 32px;
  padding: 0 11px;
  border-radius: 10px;
  border: 1px solid color-mix(in srgb, var(--border) 84%, transparent);
  background: color-mix(in srgb, var(--panel) 82%, transparent);
  color: var(--text);
  font-family: var(--pi-font-mono);
  font-size: 0.68rem;
}

.git-search-input:focus {
  outline: none;
  border-color: var(--border-strong);
}

.git-note,
.git-error,
.git-empty {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 8px;
  padding: 9px 10px;
  border-radius: 10px;
  font-size: 0.68rem;
  line-height: 1.45;
}

.git-note {
  background: color-mix(in srgb, var(--panel-2) 86%, transparent);
  color: var(--text-muted);
}

.git-note-warning {
  background: color-mix(in srgb, #f59e0b 12%, var(--panel-2));
  color: var(--text);
}

.git-error {
  background: var(--error-bg);
  color: var(--error-text);
}

.git-empty {
  justify-content: center;
  color: var(--text-subtle);
  background: color-mix(in srgb, var(--panel-2) 70%, transparent);
}

.git-list {
  margin: 0;
  padding: 0;
  list-style: none;
  max-height: 280px;
  overflow-y: auto;
}

.git-list:focus {
  outline: none;
}

.git-list-item + .git-list-item {
  margin-top: 4px;
}

.git-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
  padding: 8px 10px;
  border: 1px solid transparent;
  border-radius: 11px;
  background: transparent;
  color: var(--text);
  cursor: pointer;
  text-align: left;
  transition:
    background 0.12s ease,
    border-color 0.12s ease,
    transform 0.12s ease;
}

.git-option:hover:not(:disabled),
.git-option.highlighted {
  background: var(--panel-2);
  border-color: color-mix(in srgb, var(--border-strong) 84%, transparent);
  transform: translateX(1px);
}

.git-option.selected {
  background: color-mix(in srgb, var(--panel-2) 82%, var(--button-bg));
  border-color: color-mix(in srgb, var(--border-strong) 90%, transparent);
}

.git-option:disabled {
  cursor: wait;
}

.git-option-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.git-option-name {
  font-family: var(--pi-font-mono);
  font-size: 0.7rem;
  color: var(--text);
}

.git-option-meta {
  font-family: var(--pi-font-sans);
  font-size: 0.63rem;
  color: var(--text-subtle);
}

.git-option-check {
  color: var(--text-muted);
}

.spin {
  animation: git-spin 0.85s linear infinite;
}

@keyframes git-spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}
</style>
