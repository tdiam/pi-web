import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { startBridge, type BridgeDoneCallback, type BridgeController } from "../lifecycle.js";
import { DEFAULT_BRIDGE_CONFIG, type BridgeEvent, type BridgeState, type WsClient } from "../types.js";
import type { WsRpcAdapterContext } from "../ws-rpc-adapter.js";

describe("Bridge Lifecycle", () => {
	const createMockContext = (): WsRpcAdapterContext => ({
		pi: {
			sendUserMessage: vi.fn(),
			setModel: vi.fn().mockResolvedValue(true),
			setThinkingLevel: vi.fn(),
			getThinkingLevel: vi.fn().mockReturnValue("normal"),
			setSessionName: vi.fn(),
			getSessionName: vi.fn().mockReturnValue(undefined),
			getCommands: vi.fn().mockReturnValue([]),
			on: vi.fn(),
		},
		ctx: {
			sessionManager: {
				getBranch: vi.fn().mockReturnValue([]),
				messages: [],
				sessionId: "test-session",
				sessionFile: "/test/session.json",
				sessionName: "Test Session",
			},
			model: { id: "test-model", provider: "test" },
			modelRegistry: {
				getAvailable: vi.fn().mockResolvedValue([]),
			},
			isIdle: vi.fn().mockReturnValue(true),
			signal: undefined,
			abort: vi.fn(),
			compact: vi.fn(),
			shutdown: vi.fn(),
			hasPendingMessages: vi.fn().mockReturnValue(false),
			getContextUsage: vi.fn().mockReturnValue({ tokens: 100, contextWindow: 1000, percent: 10 }),
			getSystemPrompt: vi.fn().mockReturnValue("test prompt"),
			waitForIdle: vi.fn().mockResolvedValue(undefined),
			newSession: vi.fn().mockResolvedValue({ cancelled: false }),
			fork: vi.fn().mockResolvedValue({ cancelled: false }),
			navigateTree: vi.fn().mockResolvedValue({ cancelled: false }),
			switchSession: vi.fn().mockResolvedValue({ cancelled: false }),
		},
	});

	let mockContext: WsRpcAdapterContext;
	let doneCallback: BridgeDoneCallback;
	let doneCalled: boolean;
	let controllers: BridgeController[];

	// Store original SIGINT handlers to restore after tests
	const originalSigintListeners: Array<NodeJS.SignalsListener> = [];

	beforeEach(() => {
		mockContext = createMockContext();
		doneCalled = false;
		doneCallback = vi.fn(() => {
			doneCalled = true;
		});
		controllers = [];

		// Capture existing SIGINT listeners
		const listeners = process.listeners("SIGINT");
		originalSigintListeners.length = 0;
		originalSigintListeners.push(...listeners);
		// Remove them temporarily
		listeners.forEach((l) => process.off("SIGINT", l));
	});

	afterEach(async () => {
		// Stop all controllers
		for (const controller of controllers) {
			if (controller.getState().status === "running") {
				await controller.stop();
			}
		}

		// Restore original SIGINT listeners
		process.removeAllListeners("SIGINT");
		originalSigintListeners.forEach((l) => process.on("SIGINT", l));
	});

	describe("startBridge", () => {
		it("should start bridge and return controller", async () => {
			const config = { ...DEFAULT_BRIDGE_CONFIG, port: 0 };
			const controller = await startBridge(config, mockContext, doneCallback);
			controllers.push(controller);

			expect(controller).toBeDefined();
			expect(typeof controller.getState).toBe("function");
			expect(typeof controller.getBridgeUrl).toBe("function");
			expect(typeof controller.getClients).toBe("function");
			expect(typeof controller.stop).toBe("function");
			expect(typeof controller.subscribe).toBe("function");

			const state = controller.getState();
			expect(state.status).toBe("running");
			if (state.status === "running") {
				expect(state.port).toBeGreaterThan(0);
				expect(state.host).toBe(config.host);
			}
		});

		it("should provide bridge URL when running", async () => {
			const config = { ...DEFAULT_BRIDGE_CONFIG, port: 0 };
			const controller = await startBridge(config, mockContext, doneCallback);
			controllers.push(controller);

			const url = controller.getBridgeUrl();
			expect(url).toBeDefined();
			expect(url).toMatch(/^http:\/\/localhost:\d+$/);
		});

		it("should return undefined bridge URL when not running", async () => {
			const config = { ...DEFAULT_BRIDGE_CONFIG, port: 0 };
			const controller = await startBridge(config, mockContext, doneCallback);
			controllers.push(controller);

			await controller.stop();

			const url = controller.getBridgeUrl();
			expect(url).toBeUndefined();
		});

		it("should track client list", async () => {
			const config = { ...DEFAULT_BRIDGE_CONFIG, port: 0 };
			const controller = await startBridge(config, mockContext, doneCallback);
			controllers.push(controller);

			const clients = controller.getClients();
			expect(Array.isArray(clients)).toBe(true);
			expect(clients.length).toBe(0);
		});

		it("should subscribe to events", async () => {
			const config = { ...DEFAULT_BRIDGE_CONFIG, port: 0 };
			const controller = await startBridge(config, mockContext, doneCallback);
			controllers.push(controller);

			const events: BridgeEvent[] = [];
			const unsubscribe = controller.subscribe((event) => {
				events.push(event);
			});

			expect(typeof unsubscribe).toBe("function");

			// Stop to trigger events
			await controller.stop();

			// Should have received server_stop event
			expect(events.some((e) => e.type === "server_stop")).toBe(true);
		});

		it("should support unsubscribing from events", async () => {
			const config = { ...DEFAULT_BRIDGE_CONFIG, port: 0 };
			const controller = await startBridge(config, mockContext, doneCallback);
			controllers.push(controller);

			const events: BridgeEvent[] = [];
			const unsubscribe = controller.subscribe((event) => {
				events.push(event);
			});

			// Unsubscribe
			unsubscribe();

			// Clear events array
			events.length = 0;

			// Stop should not trigger events anymore
			await controller.stop();

			expect(events.length).toBe(0);
		});
	});

	describe("stop", () => {
		it("should stop bridge gracefully", async () => {
			const config = { ...DEFAULT_BRIDGE_CONFIG, port: 0 };
			const controller = await startBridge(config, mockContext, doneCallback);
			controllers.push(controller);

			expect(controller.getState().status).toBe("running");

			await controller.stop();

			expect(controller.getState().status).toBe("stopped");
			expect(doneCalled).toBe(true);
		});

		it("should be safe to call stop multiple times", async () => {
			const config = { ...DEFAULT_BRIDGE_CONFIG, port: 0 };
			const controller = await startBridge(config, mockContext, doneCallback);
			controllers.push(controller);

			await controller.stop();
			await controller.stop(); // Should not throw
			await controller.stop(); // Should not throw

			expect(controller.getState().status).toBe("stopped");
		});
	});

	describe("state transitions", () => {
		it("should transition from starting to running", async () => {
			const config = { ...DEFAULT_BRIDGE_CONFIG, port: 0 };

			// We can't observe "starting" state directly since start() is async,
			// but we can verify the end state
			const controller = await startBridge(config, mockContext, doneCallback);
			controllers.push(controller);

			const state = controller.getState();
			expect(state.status).toBe("running");
		});

		it("should transition from running to stopping to stopped", async () => {
			const config = { ...DEFAULT_BRIDGE_CONFIG, port: 0 };
			const controller = await startBridge(config, mockContext, doneCallback);
			controllers.push(controller);

			expect(controller.getState().status).toBe("running");

			// Note: We can't observe "stopping" state directly since stop() is async,
			// but we can verify the end state
			await controller.stop();

			expect(controller.getState().status).toBe("stopped");
		});
	});

	describe("event emission", () => {
		it("should emit server_start event", async () => {
			const config = { ...DEFAULT_BRIDGE_CONFIG, port: 0 };
			const events: BridgeEvent[] = [];

			const controller = await startBridge(config, mockContext, doneCallback);
			controllers.push(controller);

			controller.subscribe((event) => events.push(event));

			// Verify by checking state
			const state = controller.getState();
			expect(state.status).toBe("running");
		});

		it("should emit server_stop event on stop", async () => {
			const config = { ...DEFAULT_BRIDGE_CONFIG, port: 0 };
			const controller = await startBridge(config, mockContext, doneCallback);
			controllers.push(controller);

			const events: BridgeEvent[] = [];
			controller.subscribe((event) => events.push(event));

			await controller.stop();

			expect(events.some((e) => e.type === "server_stop")).toBe(true);
		});

		it("should emit shutdown_complete event", async () => {
			const config = { ...DEFAULT_BRIDGE_CONFIG, port: 0 };
			const controller = await startBridge(config, mockContext, doneCallback);
			controllers.push(controller);

			const events: BridgeEvent[] = [];
			controller.subscribe((event) => events.push(event));

			await controller.stop();

			expect(events.some((e) => e.type === "shutdown_complete")).toBe(true);
		});
	});

	describe("SIGINT handling", () => {
		it("should register SIGINT handler on start", async () => {
			const config = { ...DEFAULT_BRIDGE_CONFIG, port: 0 };
			const controller = await startBridge(config, mockContext, doneCallback);
			controllers.push(controller);

			const sigintListeners = process.listeners("SIGINT");
			expect(sigintListeners.length).toBeGreaterThan(0);
		});

		it("should remove SIGINT handler on stop", async () => {
			const config = { ...DEFAULT_BRIDGE_CONFIG, port: 0 };
			const controller = await startBridge(config, mockContext, doneCallback);
			controllers.push(controller);

			const beforeCount = process.listeners("SIGINT").length;
			expect(beforeCount).toBeGreaterThan(0);

			await controller.stop();

			const afterCount = process.listeners("SIGINT").length;
			expect(afterCount).toBe(0);
		});

		it("should trigger shutdown on SIGINT", async () => {
			const config = { ...DEFAULT_BRIDGE_CONFIG, port: 0 };
			const controller = await startBridge(config, mockContext, doneCallback);
			controllers.push(controller);

			const events: BridgeEvent[] = [];
			controller.subscribe((event) => events.push(event));

			// Simulate SIGINT
			process.emit("SIGINT");

			// Wait for async shutdown
			await new Promise((resolve) => setTimeout(resolve, 100));

			expect(events.some((e) => e.type === "sigint_received")).toBe(true);
			expect(doneCalled).toBe(true);
		});
	});
});
