import * as crypto from "node:crypto";
import type { WebSocket } from "ws";
import type { BridgeEventBus } from "./bridge-event-bus.js";
import type {
	BridgeConfig,
	BridgeEvent,
	ClientMessage,
	RpcCommand,
	RpcExtensionUIRequest,
	RpcExtensionUIResponse,
	RpcResponse,
	RpcSessionState,
	RpcSlashCommand,
	ServerMessage,
	WsClient,
} from "./types.js";

/**
 * Extended context available in Pi extension API
 */
interface PiExtensionContext {
	sessionManager: {
		getBranch: () => unknown[];
		messages: unknown[];
		sessionId: string;
		sessionFile?: string;
		sessionName?: string;
	};
	model: unknown;
	modelRegistry: {
		getAvailable: () => Promise<unknown[]>;
	};
	isIdle: () => boolean;
	signal: AbortSignal | undefined;
	abort: () => void;
	compact: (options?: { onComplete?: (result: unknown) => void; onError?: (error: Error) => void }) => void;
	shutdown: () => void;
	hasPendingMessages: () => boolean;
	getContextUsage: () => { tokens: number | null; contextWindow: number; percent: number | null } | undefined;
	getSystemPrompt: () => string;
}

/**
 * Extended command context available in Pi extension API
 */
interface PiExtensionCommandContext extends PiExtensionContext {
	waitForIdle: () => Promise<void>;
	newSession: (options?: { parentSession?: string }) => Promise<{ cancelled: boolean }>;
	fork: (entryId: string) => Promise<{ cancelled: boolean }>;
	navigateTree: (
		targetId: string,
		options?: {
			summarize?: boolean;
			customInstructions?: string;
			replaceInstructions?: boolean;
			label?: string;
		}
	) => Promise<{ cancelled: boolean }>;
	switchSession: (sessionPath: string) => Promise<{ cancelled: boolean }>;
}

/**
 * Pi extension API surface
 */
interface PiExtensionAPI {
	sendUserMessage: (
		content: string | unknown[],
		options?: { deliverAs?: "steer" | "followUp" }
	) => void;
	setModel: (model: unknown) => Promise<boolean>;
	setThinkingLevel: (level: unknown) => void;
	getThinkingLevel: () => unknown;
	setSessionName: (name: string) => void;
	getSessionName: () => string | undefined;
	getCommands: () => Array<{ name: string; description?: string; source: string }>;
	on: (event: string, handler: (event: object) => void) => void;
}

/**
 * Context passed to the adapter containing Pi extension APIs
 */
export interface WsRpcAdapterContext {
	pi: PiExtensionAPI;
	ctx: PiExtensionCommandContext;
}

/**
 * Pending extension UI request
 */
interface PendingUIRequest {
	resolve: (value: RpcExtensionUIResponse) => void;
	reject: (error: Error) => void;
	timeoutId?: ReturnType<typeof setTimeout>;
	method: string;
}

/**
 * WS-RPC adapter handles:
 * - Command dispatch from WebSocket clients to Pi
 * - Extension UI request routing to specific clients
 * - Event subscription and fan-out via BridgeEventBus
 */
export class WsRpcAdapter {
	private client: WsClient;
	private ws: WebSocket;
	private context: WsRpcAdapterContext;
	private config: BridgeConfig;
	private eventBus: BridgeEventBus;
	private emitEvent: (event: BridgeEvent) => void;

	// Pending extension UI requests keyed by request ID
	private pendingUIRequests = new Map<string, PendingUIRequest>();

	// Event subscription unsubscribe function
	private unsubscribeEvents: (() => void) | undefined;

	// Track if adapter is disposed
	private disposed = false;

	constructor(
		client: WsClient,
		ws: WebSocket,
		context: WsRpcAdapterContext,
		config: BridgeConfig,
		eventBus: BridgeEventBus,
		emitEvent: (event: BridgeEvent) => void
	) {
		this.client = client;
		this.ws = ws;
		this.context = context;
		this.config = config;
		this.eventBus = eventBus;
		this.emitEvent = emitEvent;

		this.setupWebSocket();
		this.subscribeToEvents();
	}

	/**
	 * Setup WebSocket message handlers
	 */
	private setupWebSocket(): void {
		this.ws.on("message", (data) => {
			if (this.disposed) return;
			this.handleMessage(data.toString());
		});

		this.ws.on("close", () => {
			this.dispose();
		});

		this.ws.on("error", (err) => {
			console.error(`WsRpcAdapter[${this.client.id}]: WebSocket error:`, err);
			this.emitEvent({
				type: "command_error",
				client: this.client,
				commandType: "websocket",
				error: err.message,
			});
		});
	}

	/**
	 * Subscribe to Pi events and broadcast them
	 */
		subscribeToEvents(): void {
		// Subscribe to all Pi events via the extension API
		this.context.pi.on("agent_start", (event: object) => {
			this.eventBus.broadcast({ type: "agent_start", ...event });
		});

		this.context.pi.on("agent_end", (event: object) => {
			this.eventBus.broadcast({ type: "agent_end", ...event });
		});

		this.context.pi.on("message_start", (event: object) => {
			this.eventBus.broadcast({ type: "message_start", ...event });
		});

		this.context.pi.on("message_update", (event: object) => {
			this.eventBus.broadcast({ type: "message_update", ...event });
		});

		this.context.pi.on("message_end", (event: object) => {
			this.eventBus.broadcast({ type: "message_end", ...event });
		});

		this.context.pi.on("turn_start", (event: object) => {
			this.eventBus.broadcast({ type: "turn_start", ...event });
		});

		this.context.pi.on("turn_end", (event: object) => {
			this.eventBus.broadcast({ type: "turn_end", ...event });
		});

		this.context.pi.on("tool_execution_start", (event: object) => {
			this.eventBus.broadcast({ type: "tool_execution_start", ...event });
		});

		this.context.pi.on("tool_execution_update", (event: object) => {
			this.eventBus.broadcast({ type: "tool_execution_update", ...event });
		});

		this.context.pi.on("tool_execution_end", (event: object) => {
			this.eventBus.broadcast({ type: "tool_execution_end", ...event });
		});

		this.context.pi.on("model_select", (event: object) => {
			this.eventBus.broadcast({ type: "model_select", ...event });
		});
	}

	/**
	 * Handle incoming WebSocket message
	 */
	private handleMessage(data: string): void {
		let message: ClientMessage;
		try {
			message = JSON.parse(data) as ClientMessage;
		} catch (err) {
			this.sendResponse({
				type: "response",
				payload: {
					type: "response",
					command: "parse",
					success: false,
					error: `Failed to parse message: ${err instanceof Error ? err.message : String(err)}`,
				},
			});
			return;
		}

		if (message.type === "command") {
			void this.handleCommand(message.payload);
		} else if (message.type === "extension_ui_response") {
			this.handleUIResponse(message.payload);
		} else {
			this.sendResponse({
				type: "response",
				payload: {
					type: "response",
					command: "unknown",
					success: false,
					error: `Unknown message type`,
				},
			});
		}
	}

	/**
	 * Handle RPC command dispatch
	 */
	private async handleCommand(command: RpcCommand): Promise<void> {
		const correlationId = command.id ?? crypto.randomUUID();

		this.emitEvent({
			type: "command_received",
			client: this.client,
			commandType: command.type,
			correlationId,
		});

		try {
			const response = await this.dispatchCommand(command, correlationId);
			this.sendResponse({ type: "response", payload: response });
		} catch (err) {
			const error = err instanceof Error ? err.message : String(err);
			console.error(`WsRpcAdapter[${this.client.id}]: Command error (${command.type}):`, error);

			this.emitEvent({
				type: "command_error",
				client: this.client,
				commandType: command.type,
				correlationId,
				error,
			});

			this.sendResponse({
				type: "response",
				payload: {
					id: correlationId,
					type: "response",
					command: command.type,
					success: false,
					error,
				},
			});
		}
	}

	/**
	 * Dispatch command to Pi extension API
	 */
	private async dispatchCommand(command: RpcCommand, correlationId: string): Promise<RpcResponse> {
		const { pi, ctx } = this.context;

		switch (command.type) {
			// =================================================================
			// Prompting (use ONLY extension API)
			// =================================================================

			case "prompt": {
				pi.sendUserMessage(command.message, {
					deliverAs: command.streamingBehavior ?? "steer",
				});
				return { id: correlationId, type: "response", command: "prompt", success: true };
			}

			case "steer": {
				pi.sendUserMessage(command.message, { deliverAs: "steer" });
				return { id: correlationId, type: "response", command: "steer", success: true };
			}

			case "follow_up": {
				pi.sendUserMessage(command.message, { deliverAs: "followUp" });
				return { id: correlationId, type: "response", command: "follow_up", success: true };
			}

			case "abort": {
				ctx.abort();
				return { id: correlationId, type: "response", command: "abort", success: true };
			}

			// =================================================================
			// State (reconstruct from ctx)
			// =================================================================

			case "get_state": {
				const usage = ctx.getContextUsage();
				const state: RpcSessionState = {
					model: ctx.model,
					thinkingLevel: pi.getThinkingLevel(),
					isStreaming: !ctx.isIdle(),
					isCompacting: false, // Not directly exposed
					steeringMode: "all", // Default, not directly exposed
					followUpMode: "all", // Default, not directly exposed
					sessionFile: ctx.sessionManager.sessionFile,
					sessionId: ctx.sessionManager.sessionId,
					sessionName: ctx.sessionManager.sessionName,
					autoCompactionEnabled: false, // Not directly exposed
					messageCount: ctx.sessionManager.messages.length,
					pendingMessageCount: ctx.hasPendingMessages() ? 1 : 0,
				};
				return { id: correlationId, type: "response", command: "get_state", success: true, data: state };
			}

			// =================================================================
			// Model (use extension API)
			// =================================================================

			case "set_model": {
				const models = await ctx.modelRegistry.getAvailable();
				const model = models.find(
					(m: unknown) =>
						(m as { provider: string; id: string }).provider === command.provider &&
						(m as { provider: string; id: string }).id === command.modelId
				);
				if (!model) {
					return {
						id: correlationId,
						type: "response",
						command: "set_model",
						success: false,
						error: `Model not found: ${command.provider}/${command.modelId}`,
					};
				}
				await pi.setModel(model);
				return { id: correlationId, type: "response", command: "set_model", success: true, data: model };
			}

			case "get_available_models": {
				const models = await ctx.modelRegistry.getAvailable();
				return {
					id: correlationId,
					type: "response",
					command: "get_available_models",
					success: true,
					data: { models },
				};
			}

			case "cycle_model": {
				// Not directly supported via extension API
				return {
					id: correlationId,
					type: "response",
					command: "cycle_model",
					success: false,
					error: "cycle_model not supported via bridge",
				};
			}

			// =================================================================
			// Thinking (use extension API)
			// =================================================================

			case "set_thinking_level": {
				pi.setThinkingLevel(command.level);
				return { id: correlationId, type: "response", command: "set_thinking_level", success: true };
			}

			case "cycle_thinking_level": {
				// Not directly supported via extension API
				return {
					id: correlationId,
					type: "response",
					command: "cycle_thinking_level",
					success: false,
					error: "cycle_thinking_level not supported via bridge",
				};
			}

			// =================================================================
			// Queue modes (not supported via extension API)
			// =================================================================

			case "set_steering_mode": {
				return {
					id: correlationId,
					type: "response",
					command: "set_steering_mode",
					success: false,
					error: "set_steering_mode not supported via bridge",
				};
			}

			case "set_follow_up_mode": {
				return {
					id: correlationId,
					type: "response",
					command: "set_follow_up_mode",
					success: false,
					error: "set_follow_up_mode not supported via bridge",
				};
			}

			// =================================================================
			// Compaction (use ctx.compact)
			// =================================================================

			case "compact": {
				return new Promise((resolve) => {
					ctx.compact({
						onComplete: (result) => {
							resolve({
								id: correlationId,
								type: "response",
								command: "compact",
								success: true,
								data: result,
							});
						},
						onError: (error) => {
							resolve({
								id: correlationId,
								type: "response",
								command: "compact",
								success: false,
								error: error.message,
							});
						},
					});
				});
			}

			case "set_auto_compaction": {
				return {
					id: correlationId,
					type: "response",
					command: "set_auto_compaction",
					success: false,
					error: "set_auto_compaction not supported via bridge",
				};
			}

			// =================================================================
			// Retry (not supported via extension API)
			// =================================================================

			case "set_auto_retry":
			case "abort_retry": {
				return {
					id: correlationId,
					type: "response",
					command: command.type,
					success: false,
					error: `${command.type} not supported via bridge`,
				};
			}

			// =================================================================
			// Bash (not supported via extension API - security)
			// =================================================================

			case "bash":
			case "abort_bash": {
				return {
					id: correlationId,
					type: "response",
					command: command.type,
					success: false,
					error: `${command.type} not supported via bridge for security`,
				};
			}

			// =================================================================
			// Session (use ctx methods)
			// =================================================================

			case "get_session_stats": {
				const usage = ctx.getContextUsage();
				return {
					id: correlationId,
					type: "response",
					command: "get_session_stats",
					success: true,
					data: {
						tokens: usage?.tokens ?? null,
						contextWindow: usage?.contextWindow ?? 0,
						percent: usage?.percent ?? null,
						messageCount: ctx.sessionManager.messages.length,
					},
				};
			}

			case "export_html": {
				return {
					id: correlationId,
					type: "response",
					command: "export_html",
					success: false,
					error: "export_html not supported via bridge",
				};
			}

			case "switch_session": {
				const result = await ctx.switchSession(command.sessionPath);
				return {
					id: correlationId,
					type: "response",
					command: "switch_session",
					success: true,
					data: result,
				};
			}

			case "fork": {
				const result = await ctx.fork(command.entryId);
				return {
					id: correlationId,
					type: "response",
					command: "fork",
					success: true,
					data: { text: "", ...result },
				};
			}

			case "get_fork_messages": {
				// Not directly available via extension API
				return {
					id: correlationId,
					type: "response",
					command: "get_fork_messages",
					success: false,
					error: "get_fork_messages not supported via bridge",
				};
			}

			case "get_last_assistant_text": {
				// Not directly available via extension API
				return {
					id: correlationId,
					type: "response",
					command: "get_last_assistant_text",
					success: false,
					error: "get_last_assistant_text not supported via bridge",
				};
			}

			case "set_session_name": {
				const name = command.name.trim();
				if (!name) {
					return {
						id: correlationId,
						type: "response",
						command: "set_session_name",
						success: false,
						error: "Session name cannot be empty",
					};
				}
				pi.setSessionName(name);
				return { id: correlationId, type: "response", command: "set_session_name", success: true };
			}

			case "new_session": {
				const result = await ctx.newSession(
					command.parentSession ? { parentSession: command.parentSession } : undefined
				);
				return {
					id: correlationId,
					type: "response",
					command: "new_session",
					success: true,
					data: result,
				};
			}

			// =================================================================
			// Messages (use ctx.sessionManager)
			// =================================================================

			case "get_messages": {
				const entries = ctx.sessionManager.getBranch();
				// Filter to message entries only
				const messages = entries.filter((e: unknown) => {
					const entry = e as { role?: string; type?: string };
					return entry.role !== undefined || entry.type === "message";
				});
				return {
					id: correlationId,
					type: "response",
					command: "get_messages",
					success: true,
					data: { messages },
				};
			}

			// =================================================================
			// Commands (use pi.getCommands)
			// =================================================================

			case "get_commands": {
				const commands = pi.getCommands();
				const rpcCommands: RpcSlashCommand[] = commands.map((cmd) => ({
					name: cmd.name,
					description: cmd.description,
					source: "extension" as const,
				}));
				return {
					id: correlationId,
					type: "response",
					command: "get_commands",
					success: true,
					data: { commands: rpcCommands },
				};
			}

			// =================================================================
			// Navigate Tree (use ctx.navigateTree)
			// =================================================================

			case "navigate_tree": {
				const result = await ctx.navigateTree(command.entryId, {
					summarize: command.summarize,
					customInstructions: command.customInstructions,
					replaceInstructions: command.replaceInstructions,
					label: command.label,
				});
				return {
					id: correlationId,
					type: "response" as const,
					command: "navigate_tree" as const,
					success: true as const,
					data: result,
				};
			}

			default: {
				const unknownCommand = command as { type: string };
				return {
					id: correlationId,
					type: "response",
					command: unknownCommand.type,
					success: false,
					error: `Unknown command: ${unknownCommand.type}`,
				};
			}
		}
	}

	/**
	 * Handle extension UI response from client
	 */
	private handleUIResponse(response: RpcExtensionUIResponse): void {
		const pending = this.pendingUIRequests.get(response.id);
		if (!pending) {
			console.warn(`WsRpcAdapter[${this.client.id}]: Received UI response for unknown request: ${response.id}`);
			return;
		}

		// Clear timeout
		if (pending.timeoutId) {
			clearTimeout(pending.timeoutId);
		}
		this.pendingUIRequests.delete(response.id);

		console.log(`WsRpcAdapter[${this.client.id}]: UI request ${response.id} (${pending.method}) resolved`);

		// Pass the full response object to the resolver
		pending.resolve(response);
	}

	/**
	 * Create an extension UI context for routing UI requests to this WS client
	 */
	createExtensionUIContext() {
		const createDialogPromise = <T>(
			request: Record<string, unknown>,
			defaultValue: T,
			parseResponse: (response: RpcExtensionUIResponse) => T
		): Promise<T> => {
			const id = crypto.randomUUID();

			return new Promise((resolve, reject) => {
				let timeoutId: ReturnType<typeof setTimeout> | undefined;

				const cleanup = () => {
					if (timeoutId) clearTimeout(timeoutId);
					this.pendingUIRequests.delete(id);
				};

				timeoutId = setTimeout(() => {
					console.log(`WsRpcAdapter[${this.client.id}]: UI request ${id} (${request.method}) timed out`);
					cleanup();
					resolve(defaultValue);
				}, this.config.uiRequestTimeout);

				this.pendingUIRequests.set(id, {
					resolve: (value: RpcExtensionUIResponse) => {
						cleanup();
						resolve(parseResponse(value));
					},
					reject,
					timeoutId,
					method: request.method as string,
				});

				const envelope: ServerMessage = {
					type: "extension_ui_request",
					payload: { type: "extension_ui_request", id, ...request } as RpcExtensionUIRequest,
				};

				console.log(`WsRpcAdapter[${this.client.id}]: Sending UI request ${id} (${request.method})`);
				this.sendResponse(envelope);
			});
		};

		const setEditorText = (text: string) => {
			const id = crypto.randomUUID();
			const envelope: ServerMessage = {
				type: "extension_ui_request",
				payload: {
					type: "extension_ui_request",
					id,
					method: "set_editor_text",
					text,
				} as RpcExtensionUIRequest,
			};
			this.sendResponse(envelope);
		};

		return {
			select: (title: string, options: string[], opts?: { timeout?: number; signal?: AbortSignal }) =>
				createDialogPromise(
					{ method: "select", title, options, timeout: opts?.timeout },
					undefined as string | undefined,
					(r) => ("cancelled" in r && r.cancelled ? undefined : "value" in r ? r.value : undefined)
				),

			confirm: (title: string, message: string, opts?: { timeout?: number; signal?: AbortSignal }) =>
				createDialogPromise(
					{ method: "confirm", title, message, timeout: opts?.timeout },
					false,
					(r) => ("cancelled" in r && r.cancelled ? false : "confirmed" in r ? r.confirmed : false)
				),

			input: (title: string, placeholder?: string, opts?: { timeout?: number; signal?: AbortSignal }) =>
				createDialogPromise(
					{ method: "input", title, placeholder, timeout: opts?.timeout },
					undefined as string | undefined,
					(r) => ("cancelled" in r && r.cancelled ? undefined : "value" in r ? r.value : undefined)
				),

			editor: (title: string, prefill?: string) =>
				createDialogPromise(
					{ method: "editor", title, prefill },
					undefined as string | undefined,
					(r) => ("cancelled" in r && r.cancelled ? undefined : "value" in r ? r.value : undefined)
				),

			notify: (message: string, notifyType?: "info" | "warning" | "error") => {
				const id = crypto.randomUUID();
				const envelope: ServerMessage = {
					type: "extension_ui_request",
					payload: {
						type: "extension_ui_request",
						id,
						method: "notify",
						message,
						notifyType,
					} as RpcExtensionUIRequest,
				};
				this.sendResponse(envelope);
			},

			setStatus: (key: string, statusText: string | undefined) => {
				const id = crypto.randomUUID();
				const envelope: ServerMessage = {
					type: "extension_ui_request",
					payload: {
						type: "extension_ui_request",
						id,
						method: "setStatus",
						statusKey: key,
						statusText,
					} as RpcExtensionUIRequest,
				};
				this.sendResponse(envelope);
			},

			setWidget: (
				key: string,
				widgetLines: string[] | undefined,
				options?: { placement?: "aboveEditor" | "belowEditor" }
			) => {
				const id = crypto.randomUUID();
				const envelope: ServerMessage = {
					type: "extension_ui_request",
					payload: {
						type: "extension_ui_request",
						id,
						method: "setWidget",
						widgetKey: key,
						widgetLines,
						widgetPlacement: options?.placement,
					} as RpcExtensionUIRequest,
				};
				this.sendResponse(envelope);
			},

			setTitle: (title: string) => {
				const id = crypto.randomUUID();
				const envelope: ServerMessage = {
					type: "extension_ui_request",
					payload: {
						type: "extension_ui_request",
						id,
						method: "setTitle",
						title,
					} as RpcExtensionUIRequest,
				};
				this.sendResponse(envelope);
			},

			setEditorText,

			getEditorText: () => "", // Synchronous - not supported
			onTerminalInput: () => () => {}, // Not supported
			setWorkingMessage: () => {}, // Not supported
			setHiddenThinkingLabel: () => {}, // Not supported
			setFooter: () => {}, // Not supported
			setHeader: () => {}, // Not supported
			custom: async () => undefined, // Not supported
			pasteToEditor: (text: string) => {
				setEditorText(text);
			},
			setEditorComponent: () => {}, // Not supported
			theme: {} as unknown, // Not available
			getAllThemes: () => [],
			getTheme: () => undefined,
			setTheme: () => ({ success: false, error: "Not supported" }),
			getToolsExpanded: () => false,
			setToolsExpanded: () => {},
		};
	}

	/**
	 * Send a response to the WebSocket client
	 */
	private sendResponse(message: ServerMessage): void {
		if (this.disposed || this.ws.readyState !== 1) {
			// WebSocket.OPEN = 1
			return;
		}
		try {
			this.ws.send(JSON.stringify(message));
		} catch (err) {
			console.error(`WsRpcAdapter[${this.client.id}]: Failed to send response:`, err);
		}
	}

	/**
	 * Dispose the adapter, cleaning up pending requests and subscriptions
	 */
	dispose(): void {
		if (this.disposed) return;
		this.disposed = true;

		console.log(`WsRpcAdapter[${this.client.id}]: Disposing adapter`);

		// Resolve all pending UI requests with cancelled response
		for (const [id, pending] of this.pendingUIRequests) {
			if (pending.timeoutId) {
				clearTimeout(pending.timeoutId);
			}
			console.log(`WsRpcAdapter[${this.client.id}]: Resolving UI request ${id} (${pending.method}) on disconnect`);
			// Resolve with a cancelled response
			pending.resolve({ type: "extension_ui_response", id, cancelled: true } as RpcExtensionUIResponse);
		}
		this.pendingUIRequests.clear();

		// Unsubscribe from events
		if (this.unsubscribeEvents) {
			this.unsubscribeEvents();
		}

		// Notify event bus
		this.emitEvent({
			type: "client_disconnect",
			client: this.client,
			reason: "adapter_disposed",
		});
	}
}
