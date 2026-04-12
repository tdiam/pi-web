/**
 * Pi Extension Entry Point - Web Bridge
 *
 * Registers the `/web` command that starts the bridge server,
 * degrades the terminal to a read-only log view, and allows
 * browser clients to interact with Pi via WebSocket RPC.
 */

import { startBridge, type BridgeController } from "../../../src/bridge/lifecycle.js";
import { createBridgeTerminalView } from "../../../src/bridge/terminal-log-view.js";
import type { WsRpcAdapterContext } from "../../../src/bridge/ws-rpc-adapter.js";
import { DEFAULT_BRIDGE_CONFIG, type BridgeConfig } from "../../../src/bridge/types.js";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";

/**
 * Command handler for `/web`
 */
async function webBridgeHandler(args: string, ctx: any, pi: any): Promise<void> {
	// Build the adapter context:
	// - pi (the PiExtensionAPI): sendUserMessage, setModel, on, etc.
	// - ctx (the command context): sessionManager, model, modelRegistry, ui, etc.
	const adapterContext: WsRpcAdapterContext = {
		pi,
		ctx,
	};

	// Resolve web-dist directory for static bundle serving
	const thisFile = fileURLToPath(import.meta.url);
	const projectRoot = join(dirname(thisFile), "..", "..", "..");
	const webDistDir = join(projectRoot, "web-dist");
	const staticDir = existsSync(webDistDir) ? webDistDir : undefined;

	// Bridge configuration (could be extended to read from config file)
	// Note: DEFAULT_BRIDGE_CONFIG.host is "0.0.0.0" so the bridge is reachable from LAN.
	// Set PI_BRIDGE_HOST=localhost to restrict to local-only access.
	const config: BridgeConfig = {
		...DEFAULT_BRIDGE_CONFIG,
		// Allow environment variable override for port
		port: process.env.PI_BRIDGE_PORT ? parseInt(process.env.PI_BRIDGE_PORT, 10) : 0,
		host: process.env.PI_BRIDGE_HOST || DEFAULT_BRIDGE_CONFIG.host,
		staticDir,
	};

	let bridgeController: BridgeController | undefined;

	// Start the bridge
	try {
		bridgeController = await startBridge(config, adapterContext, () => {
			// Done callback - view should exit
			if (bridgeController) {
				terminalView.requestExit();
			}
		});
	} catch (err) {
		const errorMsg = err instanceof Error ? err.message : String(err);
		await ctx.ui.custom((_tui: any, _theme: any, _kb: any, done: () => void) => {
			return {
				render() {
					return [
						`Error: ${errorMsg}`,
						"",
						"Press any key to exit...",
					];
				},
				handleInput() { done(); },
				invalidate() {},
				done() {},
			};
		});
		return;
	}

	// Create terminal log view subscribed to bridge events
	const terminalView = createBridgeTerminalView(
		(handler: any) => bridgeController!.subscribe(handler),
		() => bridgeController!.getState(),
		() => bridgeController!.getClients(),
		config,
		() => bridgeController!.getToken()
	);

	// Render the custom UI - this degrades terminal to read-only log view
	await ctx.ui.custom((_tui: any, _theme: any, _kb: any, done: () => void) => {
		return {
			render() { return terminalView.render(); },
			handleInput(input: string) {
				terminalView.handleInput(input);
			},
			shouldExit() { return terminalView.shouldExit(); },
			invalidate() {},
			async done() {
				terminalView.dispose();
				if (bridgeController) {
					await bridgeController.stop();
				}
			},
		};
	});
}

/**
 * Extension entry point — registers the /web command.
 *
 * Pi calls this with (pi, state) at load time.
 * pi: the extension API surface (sendUserMessage, registerCommand, on, etc.)
 * state: shared state bag (rarely needed)
 */
export default function registerWebBridge(pi: any, state: any): void {
	pi.registerCommand("web", {
		description: "Start web bridge server for browser-based interaction",
		handler: async (args: string, ctx: any) => {
			await webBridgeHandler(args, ctx, pi);
		},
	});
}

// Export handler for testing
export { webBridgeHandler };
