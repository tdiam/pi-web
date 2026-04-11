import { describe, it, expect } from "vitest";
import {
	type BridgeConfig,
	type BridgeState,
	type WsClient,
	type BridgeEvent,
	type ServerMessage,
	type ClientMessage,
	type RpcCommand,
	type RpcResponse,
	type RpcExtensionUIRequest,
	type RpcExtensionUIResponse,
	type RpcCommandType,
	DEFAULT_BRIDGE_CONFIG,
} from "../types.js";

// ============================================================================
// BridgeConfig
// ============================================================================

describe("BridgeConfig", () => {
	it("DEFAULT_BRIDGE_CONFIG has expected defaults", () => {
		const cfg: BridgeConfig = DEFAULT_BRIDGE_CONFIG;
		expect(cfg.host).toBe("localhost");
		expect(cfg.port).toBe(0);
		expect(cfg.portMax).toBe(0);
		expect(cfg.uiRequestTimeout).toBe(60_000);
		expect(cfg.clientBufferSize).toBe(256);
		expect(cfg.staticDir).toBeUndefined();
	});

	it("allows overriding individual fields", () => {
		const cfg: BridgeConfig = { ...DEFAULT_BRIDGE_CONFIG, port: 8080, staticDir: "./web" };
		expect(cfg.port).toBe(8080);
		expect(cfg.staticDir).toBe("./web");
	});
});

// ============================================================================
// BridgeState
// ============================================================================

describe("BridgeState", () => {
	it("stopped state has status field only", () => {
		const state: BridgeState = { status: "stopped" };
		expect(state.status).toBe("stopped");
	});

	it("starting state carries port", () => {
		const state: BridgeState = { status: "starting", port: 8080 };
		if (state.status === "starting") {
			expect(state.port).toBe(8080);
		}
	});

	it("running state carries host and port", () => {
		const state: BridgeState = { status: "running", host: "localhost", port: 9090 };
		if (state.status === "running") {
			expect(state.host).toBe("localhost");
			expect(state.port).toBe(9090);
		}
	});

	it("stopping state has status field only", () => {
		const state: BridgeState = { status: "stopping" };
		expect(state.status).toBe("stopping");
	});
});

// ============================================================================
// WsClient
// ============================================================================

describe("WsClient", () => {
	it("has required fields", () => {
		const client: WsClient = { id: "c1", seq: 1, connectedAt: new Date().toISOString() };
		expect(client.id).toBe("c1");
		expect(client.seq).toBe(1);
		expect(typeof client.connectedAt).toBe("string");
	});
});

// ============================================================================
// BridgeEvent
// ============================================================================

describe("BridgeEvent", () => {
	it("server_start event carries host and port", () => {
		const evt: BridgeEvent = { type: "server_start", host: "0.0.0.0", port: 3000 };
		expect(evt.type).toBe("server_start");
		if (evt.type === "server_start") {
			expect(evt.port).toBe(3000);
		}
	});

	it("command_error event includes command type, correlation ID, and error", () => {
		const client: WsClient = { id: "c1", seq: 1, connectedAt: "2025-01-01T00:00:00Z" };
		const evt: BridgeEvent = {
			type: "command_error",
			client,
			commandType: "prompt",
			correlationId: "corr-123",
			error: "not connected",
		};
		if (evt.type === "command_error") {
			expect(evt.commandType).toBe("prompt");
			expect(evt.correlationId).toBe("corr-123");
			expect(evt.error).toBe("not connected");
		}
	});

	it("client_connect carries WsClient", () => {
		const client: WsClient = { id: "c1", seq: 1, connectedAt: "2025-01-01T00:00:00Z" };
		const evt: BridgeEvent = { type: "client_connect", client };
		if (evt.type === "client_connect") {
			expect(evt.client.id).toBe("c1");
		}
	});

	it("sigint_received has no extra fields", () => {
		const evt: BridgeEvent = { type: "sigint_received" };
		expect(evt.type).toBe("sigint_received");
	});
});

// ============================================================================
// RPC types
// ============================================================================

describe("RpcCommand", () => {
	it("prompt command has required fields", () => {
		const cmd: RpcCommand = { type: "prompt", message: "hello" };
		if (cmd.type === "prompt") {
			expect(cmd.message).toBe("hello");
		}
	});

	it("supports optional id field for correlation", () => {
		const cmd: RpcCommand = { id: "corr-1", type: "abort" };
		if (cmd.type === "abort") {
			expect(cmd.id).toBe("corr-1");
		}
	});
});

describe("RpcCommandType", () => {
	it("extracts the union of all command type strings", () => {
		const types: RpcCommandType[] = [
			"prompt", "steer", "follow_up", "abort", "new_session",
			"get_state", "set_model", "cycle_model", "get_available_models",
			"set_thinking_level", "cycle_thinking_level",
			"set_steering_mode", "set_follow_up_mode",
			"compact", "set_auto_compaction",
			"set_auto_retry", "abort_retry",
			"bash", "abort_bash",
			"get_session_stats", "export_html",
			"switch_session", "fork", "get_fork_messages",
			"get_last_assistant_text", "set_session_name",
			"get_messages", "get_commands",
		];
		expect(types.length).toBeGreaterThan(0);
		for (const t of types) {
			expect(typeof t).toBe("string");
		}
	});
});

describe("RpcResponse", () => {
	it("error response carries command and error message", () => {
		const resp: RpcResponse = { id: "1", type: "response", command: "bash", success: false, error: "not allowed" };
		if (!resp.success) {
			expect(resp.error).toBe("not allowed");
		}
	});

	it("success response for get_state carries RpcSessionState", () => {
		const resp: RpcResponse = {
			id: "2",
			type: "response",
			command: "get_state",
			success: true,
			data: {
				thinkingLevel: "none",
				isStreaming: false,
				isCompacting: false,
				steeringMode: "all",
				followUpMode: "all",
				sessionId: "sess-1",
				autoCompactionEnabled: true,
				messageCount: 5,
				pendingMessageCount: 0,
			},
		};
		if (resp.success && resp.command === "get_state") {
			expect(resp.data.sessionId).toBe("sess-1");
		}
	});
});

describe("RpcExtensionUIRequest", () => {
	it("select request has options array", () => {
		const req: RpcExtensionUIRequest = {
			type: "extension_ui_request",
			id: "ui-1",
			method: "select",
			title: "Pick one",
			options: ["a", "b", "c"],
		};
		if (req.method === "select") {
			expect(req.options).toHaveLength(3);
		}
	});
});

describe("RpcExtensionUIResponse", () => {
	it("value response carries string", () => {
		const resp: RpcExtensionUIResponse = { type: "extension_ui_response", id: "ui-1", value: "ok" };
		if ("value" in resp) {
			expect(resp.value).toBe("ok");
		}
	});

	it("cancelled response", () => {
		const resp: RpcExtensionUIResponse = { type: "extension_ui_response", id: "ui-1", cancelled: true };
		if ("cancelled" in resp) {
			expect(resp.cancelled).toBe(true);
		}
	});
});

// ============================================================================
// Wire protocol
// ============================================================================

describe("Wire protocol types", () => {
	it("ServerMessage discriminates on type field", () => {
		const event: ServerMessage = { type: "event", payload: { kind: "text" } };
		const ui: ServerMessage = { type: "extension_ui_request", payload: { type: "extension_ui_request", id: "1", method: "notify", message: "hi" } };
		const resp: ServerMessage = { type: "response", payload: { type: "response", command: "prompt", success: true } };

		expect(event.type).toBe("event");
		expect(ui.type).toBe("extension_ui_request");
		expect(resp.type).toBe("response");
	});

	it("ClientMessage discriminates on type field", () => {
		const cmd: ClientMessage = { type: "command", payload: { type: "prompt", message: "hi" } };
		const uiResp: ClientMessage = { type: "extension_ui_response", payload: { type: "extension_ui_response", id: "1", value: "ok" } };

		expect(cmd.type).toBe("command");
		expect(uiResp.type).toBe("extension_ui_response");
	});
});
