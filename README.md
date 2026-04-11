# Pi Web

A browser bridge for Pi that transforms your terminal session into a web-accessible chat interface.

## Overview

Pi Web allows you to execute `/web` in any Pi session to start a bridge server. The terminal degrades to a read-only log view while the session becomes accessible via browser. This enables:

- **Comfortable editing** — Use a full browser window instead of terminal constraints
- **Mobile continuity** — Continue your session from a phone browser
- **Remote access** — Connect from another device on your network

## Quick Start

```bash
# Install dependencies
npm install

# Build the extension
npm run build

# In Pi, execute:
/web
```

The terminal will display the bridge URL (default: `http://localhost:8080`). Open this in your browser to access the session.

Press `Ctrl+C` in the terminal to stop the bridge and restore the TUI.

## Architecture

The bridge is a Pi extension that runs in the same Node.js process:

- **HTTP Server** — Serves static files (placeholder for now, S02 will add chat UI)
- **WebSocket Endpoint** (`/ws`) — Full-duplex RPC protocol for browser clients
- **Terminal Log View** — Read-only display of bridge status and events
- **Extension API Bridge** — Maps WebSocket commands to Pi's extension surface

## Project Structure

```
src/bridge/
  types.ts              # RPC protocol types, bridge config/state
  bridge-event-bus.ts   # Event fan-out with backpressure handling
  ws-rpc-adapter.ts     # WebSocket ↔ Pi extension API adapter
  server.ts             # HTTP + WebSocket server
  lifecycle.ts          # Bridge startup/shutdown/SIGINT handling
  terminal-log-view.ts  # Read-only terminal UI
  __tests__/            # Comprehensive test suite (111 tests)

.pi/agent/extensions/
  web-bridge.ts         # Pi extension entry point, /web command
```

## Development

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Type check
npx tsc --noEmit

# Build extension
npm run build
```

## Milestones

### M001: Pi Web Session Bridge (in progress)

| Slice | Status | Description |
|-------|--------|-------------|
| S01 | ✅ Complete | Bridge runtime — HTTP/WebSocket server, terminal log view |
| S02 | ⬜ Planned | Web Chat Shell — Browser chat UI |
| S03 | ⬜ Planned | Command & Extension UI Mapping |
| S04 | ⬜ Planned | Mobile Continuity & Reconnect |
| S05 | ⬜ Planned | Remote Access & Final Assembly |

## License

MIT
