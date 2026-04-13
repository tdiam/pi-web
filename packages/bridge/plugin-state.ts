/**
 * Persistent plugin state stored in ~/.pi/agent/pi-web.json.
 *
 * Survives /web restarts since localStorage is per-origin and the
 * bridge URL changes on every invocation (different port + token).
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

const STATE_FILE = path.join(os.homedir(), ".pi", "agent", "pi-web.json");

let cache: Record<string, unknown> | null = null;

function readStateFile(): Record<string, unknown> {
  if (cache !== null) return cache;
  try {
    const raw = fs.readFileSync(STATE_FILE, "utf8");
    cache = JSON.parse(raw);
  } catch {
    cache = {};
  }
  return cache!;
}

function writeStateFile(state: Record<string, unknown>): void {
  const dir = path.dirname(STATE_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + "\n", "utf8");
  cache = state;
}

/**
 * Get a persisted value by key. Returns `undefined` when absent.
 */
export function getPluginState(key: string): unknown {
  return readStateFile()[key];
}

/**
 * Set a persisted value by key. Merges into the existing file.
 */
export function setPluginState(key: string, value: unknown): void {
  const state = { ...readStateFile(), [key]: value };
  writeStateFile(state);
}
