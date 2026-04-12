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

async function webBridgeHandler(args: string, ctx: any, pi: any): Promise<void> {
	const adapterContext: WsRpcAdapterContext = {
		pi,
		ctx,
	};

	const thisFile = fileURLToPath(import.meta.url);
	const projectRoot = join(dirname(thisFile), "..", "..", "..");
	const webDistDir = join(projectRoot, "web-dist");
	const staticDir = existsSync(webDistDir) ? webDistDir : undefined;

	const config: BridgeConfig = {
		...DEFAULT_BRIDGE_CONFIG,
		port: process.env.PI_BRIDGE_PORT ? parseInt(process.env.PI_BRIDGE_PORT, 10) : 0,
		host: process.env.PI_BRIDGE_HOST || DEFAULT_BRIDGE_CONFIG.host,
		staticDir,
	};

	let bridgeController: BridgeController | undefined;

	try {
		bridgeController = await startBridge(config, adapterContext, () => {
			terminalView?.requestExit();
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

	let terminalView:
		| (ReturnType<typeof createBridgeTerminalView> & { dispose: () => void })
		| undefined;

	await ctx.ui.custom((tui: any, _theme: any, kb: any, done: () => void) => {
		terminalView = createBridgeTerminalView(
			(handler: any) => bridgeController!.subscribe(handler),
			() => bridgeController!.getState(),
			() => bridgeController!.getClients(),
			config,
			() => bridgeController!.getToken(),
			() => tui.requestRender()
		);

		return {
			render() {
				return terminalView.render();
			},
			handleInput(input: string) {
				terminalView.handleInput(input);
				if (kb?.matches?.(input, "clear") || terminalView.shouldExit()) {
					done();
					return;
				}
			},
			shouldExit() {
				return terminalView.shouldExit();
			},
			invalidate() {
				tui.requestRender();
			},
			async done() {
				terminalView?.dispose();
				if (bridgeController) {
					await bridgeController.stop();
				}
			},
		};
	});
}

export default function registerWebBridge(pi: any, state: any): void {
	pi.registerCommand("web", {
		description: "Start web bridge server for browser-based interaction",
		handler: async (args: string, ctx: any) => {
			await webBridgeHandler(args, ctx, pi);
		},
	});
}

export { webBridgeHandler };
