<script setup lang="ts">
import { ref, computed } from "vue";
import { useBridgeClient } from "./composables/useBridgeClient";
import ChatTranscript from "./components/ChatTranscript.vue";
import SessionRail from "./components/SessionRail.vue";
import TreeRail from "./components/TreeRail.vue";
import ComposerBar from "./components/ComposerBar.vue";

const {
	connectionStatus,
	transcript,
	sessionState,
	sessions,
	treeEntries,
	isStreaming,
	sendPrompt,
	sendCommand,
} = useBridgeClient();

const activeSessionId = computed(() => sessionState.value?.sessionId ?? null);
const sidebarOpen = ref(false);

function handleSessionSelect(sessionPath: string) {
	sendCommand({ type: "switch_session", sessionPath }).catch(() => {});
}

function handleTreeNavigate(entryId: string) {
	sendCommand({ type: "navigate_tree", entryId }).catch(() => {});
}

function handlePrompt(message: string) {
	sendPrompt(message);
}
</script>

<template>
	<div class="app-shell">
		<!-- Header -->
		<header class="app-header">
			<button
				class="hamburger"
				aria-label="Toggle sidebar"
				@click="sidebarOpen = !sidebarOpen"
			>
				<span></span><span></span><span></span>
			</button>
			<h1 class="app-title">Pi</h1>
			<span
				class="connection-badge"
				:class="connectionStatus"
				:title="`Connection: ${connectionStatus}`"
			>
				<span class="badge-dot"></span>
				{{ connectionStatus === 'connected' ? 'Connected' : connectionStatus === 'connecting' ? 'Connecting…' : 'Disconnected' }}
			</span>
		</header>

		<!-- Body: CSS Grid layout -->
		<div class="app-body">
			<!-- Left rail column -->
			<aside class="left-rail" :class="{ open: sidebarOpen }">
				<SessionRail
					:sessions="sessions"
					:active-session-id="activeSessionId"
					@select="handleSessionSelect"
				/>
				<div class="rail-divider"></div>
				<TreeRail
					:entries="treeEntries"
					@navigate="handleTreeNavigate"
				/>
			</aside>
			<div class="rail-backdrop" @click="sidebarOpen = false"></div>

			<!-- Center column -->
			<main class="center-column">
				<ChatTranscript :messages="transcript" :is-streaming="isStreaming" />
				<ComposerBar
					:connection-status="connectionStatus"
					@submit="handlePrompt"
				/>
			</main>
		</div>
	</div>
</template>

<style scoped>
/* ---- Shell ---- */
.app-shell {
	display: flex;
	flex-direction: column;
	height: 100vh;
	width: 100vw;
	overflow: hidden;
	font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
	background: #0f0f23;
	color: #e2e8f0;
}

/* ---- Header ---- */
.app-header {
	display: flex;
	align-items: center;
	gap: 12px;
	padding: 10px 20px;
	border-bottom: 1px solid #2d2d44;
	flex-shrink: 0;
	background: #12122a;
	z-index: 20;
}

.hamburger {
	display: none;
	flex-direction: column;
	gap: 3px;
	padding: 6px;
	background: none;
	border: none;
	cursor: pointer;
}

.hamburger span {
	display: block;
	width: 18px;
	height: 2px;
	background: #9ca3af;
	border-radius: 1px;
}

.app-title {
	margin: 0;
	font-size: 1.2rem;
	color: #60a5fa;
	font-weight: 700;
	letter-spacing: -0.02em;
}

.connection-badge {
	display: flex;
	align-items: center;
	gap: 6px;
	margin-left: auto;
	padding: 3px 10px;
	border-radius: 999px;
	font-size: 0.7rem;
	font-weight: 600;
	color: #9ca3af;
	background: #1a1a2e;
	border: 1px solid #2d2d44;
}

.connection-badge.connected {
	color: #22c55e;
	border-color: #166534;
}

.connection-badge.connecting {
	color: #eab308;
	border-color: #854d0e;
}

.connection-badge.disconnected {
	color: #ef4444;
	border-color: #991b1b;
}

.badge-dot {
	width: 7px;
	height: 7px;
	border-radius: 50%;
	background: currentColor;
	flex-shrink: 0;
}

/* ---- Body ---- */
.app-body {
	display: grid;
	grid-template-columns: 220px 1fr;
	flex: 1;
	overflow: hidden;
}

/* ---- Left Rail ---- */
.left-rail {
	grid-column: 1;
	display: flex;
	flex-direction: column;
	background: #16162a;
	border-right: 1px solid #2d2d44;
	overflow: hidden;
}

.rail-divider {
	height: 1px;
	background: #2d2d44;
	flex-shrink: 0;
}

.rail-backdrop {
	display: none;
}

/* ---- Center Column ---- */
.center-column {
	grid-column: 2;
	display: flex;
	flex-direction: column;
	overflow: hidden;
}

/* ---- Responsive: narrow screens ---- */
@media (max-width: 900px) {
	.hamburger {
		display: flex;
	}

	.app-body {
		grid-template-columns: 1fr;
		position: relative;
	}

	.left-rail {
		position: absolute;
		top: 0;
		left: 0;
		bottom: 0;
		width: 260px;
		transform: translateX(-100%);
		transition: transform 0.2s ease;
		z-index: 15;
		box-shadow: none;
	}

	.left-rail.open {
		transform: translateX(0);
		box-shadow: 4px 0 24px rgba(0, 0, 0, 0.5);
	}

	.rail-backdrop {
		display: block;
		position: absolute;
		inset: 0;
		background: rgba(0, 0, 0, 0.4);
		z-index: 14;
		pointer-events: none;
		opacity: 0;
		transition: opacity 0.2s;
	}

	.left-rail.open ~ .rail-backdrop {
		pointer-events: auto;
		opacity: 1;
	}

	.center-column {
		grid-column: 1;
	}
}
</style>
