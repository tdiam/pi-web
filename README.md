# pi-web-bridge

A [Pi](https://github.com/mariozechner/pi-coding-agent) extension that opens a WebSocket bridge for browser-based interaction.

Running `/web` inside Pi starts a local HTTP/WebSocket server and degrades the terminal to a read-only log view. Open the served URL in a browser to interact with Pi through a full-featured chat UI.

---

## Features

- **Browser-based Pi client** — chat, command palette, diff viewer, tool cards, markdown rendering with syntax highlighting
- **WebSocket RPC bridge** — real-time bidirectional communication between the browser and Pi's backend
- **Multi-client support** — several browsers can connect simultaneously; events are fanned out to all clients
- **SPA static hosting** — the Vue 3 UI is served from `web-dist/` with fallback routing
- **Development mode** — Vite dev server with HMR for rapid UI iteration

---

## Architecture

```
packages/
├── bin/      # Pi extension entry point — registers the /web command
├── bridge/   # HTTP server, WebSocket upgrade handler, RPC adapter, terminal log view
└── web/      # Vue 3 client (Vite + Vitest)
```

### Data flow

1. User runs `/web` in Pi.
2. `packages/bin/index.ts` calls the lifecycle manager in `packages/bridge/`.
3. `BridgeServer` starts an HTTP server and a WebSocket server on `/ws`.
4. The browser loads the Vue SPA and opens a WebSocket connection.
5. `WsRpcAdapter` marshals Pi RPC calls over the socket and streams events back.
6. The terminal switches to a read-only log view that shows bridge state and connected clients.

---

## Development

### Requirements

- Node.js >= 20.6.0
- pnpm

### Install dependencies

```bash
pnpm install
```

### Build the web UI

```bash
pnpm run build:web
```

This outputs the production bundle to `web-dist/`.

### Run the web UI dev server

```bash
pnpm run dev:web
```

The Vite dev server runs with HMR. To proxy WebSocket traffic to Pi, set a stable bridge port:

```bash
PI_BRIDGE_PORT=8080 pnpm run dev:web
```

Then start Pi, run `/web`, and open the Vite URL.

### Type check

```bash
pnpm run check
```

### Test

```bash
pnpm test           # run once
pnpm run test:watch # watch mode
```

### Lint and format

```bash
pnpm run lint       # oxlint
pnpm run lint:fix   # oxlint --fix
pnpm run fmt        # oxfmt
pnpm run fmt:check  # oxfmt --check
```

---

## Environment variables

| Variable            | Description                                              |
|---------------------|----------------------------------------------------------|
| `PI_BRIDGE_PORT`    | Bridge HTTP/WebSocket port (default: `8080`)             |
| `PI_BRIDGE_HOST`    | Bridge bind host (default: `0.0.0.0`)                    |
| `PI_WEB_DEBUG`      | Enable debug mode in the web UI (`1` or `true`)          |

---

## Commands (package.json)

| Script        | What it does                                    |
|---------------|-------------------------------------------------|
| `prepare`     | Builds the web bundle (`pnpm run build:web`)    |
| `build:web`   | Vite production build of `packages/web/`        |
| `check`       | TypeScript type check with `tsgo`               |
| `dev:web`     | Vite dev server for `packages/web/`             |
| `test`        | Vitest run (verbose)                            |
| `test:watch`  | Vitest watch (verbose)                          |
| `lint`        | Lint with `oxlint`                              |
| `lint:fix`    | Lint and auto-fix with `oxlint`                 |
| `fmt`         | Format with `oxfmt`                             |
| `fmt:check`   | Check formatting with `oxfmt`                   |

---

## License

MIT
