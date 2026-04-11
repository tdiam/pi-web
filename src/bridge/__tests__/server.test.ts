import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import * as http from "node:http";
import { WebSocket } from "ws";
import { BridgeServer } from "../server.js";
import { BridgeEventBus } from "../bridge-event-bus.js";
import { DEFAULT_BRIDGE_CONFIG, type BridgeEvent, type WsClient } from "../types.js";
import type { WsRpcAdapterContext } from "../ws-rpc-adapter.js";

describe("BridgeServer", () => {
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

	let eventBus: BridgeEventBus;
	let mockContext: WsRpcAdapterContext;
	let events: BridgeEvent[];
	let emitEvent: (event: BridgeEvent) => void;

	beforeEach(() => {
		eventBus = new BridgeEventBus(DEFAULT_BRIDGE_CONFIG);
		mockContext = createMockContext();
		events = [];
		emitEvent = (event: BridgeEvent) => {
			events.push(event);
		};
	});

	afterEach(async () => {
		eventBus.dispose();
	});

	describe("lifecycle", () => {
		it("should start server on available port", async () => {
			const config = { ...DEFAULT_BRIDGE_CONFIG, port: 0 };
			const server = new BridgeServer(config, mockContext, eventBus, emitEvent);

			const address = await server.start();

			expect(address.port).toBeGreaterThan(0);
			expect(server.getIsRunning()).toBe(true);
			expect(events).toContainEqual({
				type: "server_start",
				host: config.host,
				port: address.port,
			});

			await server.stop();
		});

		it("should throw if starting when already running", async () => {
			const config = { ...DEFAULT_BRIDGE_CONFIG, port: 0 };
			const server = new BridgeServer(config, mockContext, eventBus, emitEvent);

			await server.start();
			await expect(server.start()).rejects.toThrow("Server is already running");

			await server.stop();
		});

		it("should stop gracefully", async () => {
			const config = { ...DEFAULT_BRIDGE_CONFIG, port: 0 };
			const server = new BridgeServer(config, mockContext, eventBus, emitEvent);

			await server.start();
			await server.stop();

			expect(server.getIsRunning()).toBe(false);
			expect(server.getAddress()).toBeUndefined();
			expect(events).toContainEqual({ type: "server_stop" });
		});

		it("should handle multiple start/stop cycles", async () => {
			const config = { ...DEFAULT_BRIDGE_CONFIG, port: 0 };
			const server = new BridgeServer(config, mockContext, eventBus, emitEvent);

			for (let i = 0; i < 3; i++) {
				const address = await server.start();
				expect(address.port).toBeGreaterThan(0);
				await server.stop();
				expect(server.getIsRunning()).toBe(false);
			}
		});
	});

	describe("port fallback", () => {
		it("should support port range configuration", () => {
			// Test that port range config is properly accepted
			const config = {
				...DEFAULT_BRIDGE_CONFIG,
				port: 8080,
				portMax: 8090,
			};
			const server = new BridgeServer(config, mockContext, eventBus, emitEvent);
			// Just verify the server was created with the config
			expect(server.getIsRunning()).toBe(false);
		});

		it("should bind to OS-assigned port when port is 0", async () => {
			const config = { ...DEFAULT_BRIDGE_CONFIG, port: 0 };
			const server = new BridgeServer(config, mockContext, eventBus, emitEvent);

			const address = await server.start();

			expect(address.port).toBeGreaterThan(0);
			expect(server.getIsRunning()).toBe(true);

			await server.stop();
		});
	});

	describe("HTTP static file serving", () => {
		it("should serve placeholder HTML when no staticDir", async () => {
			const config = { ...DEFAULT_BRIDGE_CONFIG, port: 0 };
			const server = new BridgeServer(config, mockContext, eventBus, emitEvent);
			const address = await server.start();

			// Make HTTP request to root
			const response = await new Promise<{ status: number; body: string }>((resolve, reject) => {
				const req = http.get(`http://localhost:${address.port}/`, (res) => {
					let body = "";
					res.on("data", (chunk) => (body += chunk));
					res.on("end", () => resolve({ status: res.statusCode || 0, body }));
				});
				req.on("error", reject);
				req.setTimeout(5000, () => {
					req.destroy();
					reject(new Error("Request timeout"));
				});
			});

			expect(response.status).toBe(200);
			expect(response.body).toContain("Pi Web Bridge");
			expect(response.body).toContain(`ws://${address.host}:${address.port}/ws`);

			await server.stop();
		});

		it("should return 404 for non-root paths when no staticDir", async () => {
			const config = { ...DEFAULT_BRIDGE_CONFIG, port: 0 };
			const server = new BridgeServer(config, mockContext, eventBus, emitEvent);
			const address = await server.start();

			const response = await new Promise<{ status: number; body: string }>((resolve, reject) => {
				const req = http.get(`http://localhost:${address.port}/some-file.js`, (res) => {
					let body = "";
					res.on("data", (chunk) => (body += chunk));
					res.on("end", () => resolve({ status: res.statusCode || 0, body }));
				});
				req.on("error", reject);
				req.setTimeout(5000, () => {
					req.destroy();
					reject(new Error("Request timeout"));
				});
			});

			expect(response.status).toBe(404);
			expect(response.body).toContain("Not Found");

			await server.stop();
		});

		it("should return 405 for non-GET methods", async () => {
			const config = { ...DEFAULT_BRIDGE_CONFIG, port: 0 };
			const server = new BridgeServer(config, mockContext, eventBus, emitEvent);
			const address = await server.start();

			const response = await new Promise<{ status: number; body: string }>((resolve, reject) => {
				const req = http.request(
					`http://localhost:${address.port}/`,
					{ method: "POST" },
					(res) => {
						let body = "";
						res.on("data", (chunk) => (body += chunk));
						res.on("end", () => resolve({ status: res.statusCode || 0, body }));
					}
				);
				req.on("error", reject);
				req.setTimeout(5000, () => {
					req.destroy();
					reject(new Error("Request timeout"));
				});
				req.end();
			});

			expect(response.status).toBe(405);

			await server.stop();
		});
	});

	describe("client tracking", () => {
		it("should start with zero clients", async () => {
			const config = { ...DEFAULT_BRIDGE_CONFIG, port: 0 };
			const server = new BridgeServer(config, mockContext, eventBus, emitEvent);
			await server.start();

			expect(server.getClientCount()).toBe(0);
			expect(server.getClients()).toEqual([]);

			await server.stop();
		});
	});

	describe("address", () => {
		it("should return undefined when not running", () => {
			const config = { ...DEFAULT_BRIDGE_CONFIG, port: 0 };
			const server = new BridgeServer(config, mockContext, eventBus, emitEvent);

			expect(server.getAddress()).toBeUndefined();
		});

		it("should return address when running", async () => {
			const config = { ...DEFAULT_BRIDGE_CONFIG, port: 0 };
			const server = new BridgeServer(config, mockContext, eventBus, emitEvent);
			const address = await server.start();

			expect(server.getAddress()).toEqual({
				host: config.host,
				port: address.port,
			});

			await server.stop();
		});
	});
});
