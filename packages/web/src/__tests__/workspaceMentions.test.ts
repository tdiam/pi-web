import type { RpcWorkspaceEntry } from "@pi-web/bridge/types";
import { describe, expect, it } from "vitest";
import {
  applyWorkspaceMentionCompletion,
  getWorkspaceMentionContext,
  getWorkspaceMentionSuggestions,
} from "../utils/workspaceMentions";

const entries: RpcWorkspaceEntry[] = [
  { path: "README.md", kind: "file" },
  { path: "src", kind: "directory" },
  { path: "src/components", kind: "directory" },
  { path: "src/components/ComposerBar.vue", kind: "file" },
  { path: "src/components/CommandPalette.vue", kind: "file" },
  { path: "src/utils/with spaces.ts", kind: "file" },
];

describe("workspace mention helpers", () => {
  it("extracts @ mentions at the start of a token", () => {
    expect(getWorkspaceMentionContext("Check @src/Comp", 15)).toEqual({
      prefix: "@src/Comp",
      rawQuery: "src/Comp",
      isQuotedPrefix: false,
      start: 6,
      end: 15,
    });
  });

  it("supports quoted @ mentions for paths with spaces", () => {
    expect(getWorkspaceMentionContext('Use @"src/utils/with', 20)).toEqual({
      prefix: '@"src/utils/with',
      rawQuery: "src/utils/with",
      isQuotedPrefix: true,
      start: 4,
      end: 20,
    });
  });

  it("extracts bare @ mentions so the composer can show defaults", () => {
    expect(getWorkspaceMentionContext("Inspect @", 9)).toEqual({
      prefix: "@",
      rawQuery: "",
      isQuotedPrefix: false,
      start: 8,
      end: 9,
    });
  });

  it("returns null for bare @ without a token boundary", () => {
    expect(getWorkspaceMentionContext("email@test.com", 13)).toBeNull();
  });

  it("returns default suggestions for bare @", () => {
    const context = getWorkspaceMentionContext("Inspect @", 9);
    expect(context).not.toBeNull();

    const suggestions = getWorkspaceMentionSuggestions(entries, context!);
    expect(suggestions.slice(0, 4)).toEqual([
      expect.objectContaining({ path: "src", value: "@src/" }),
      expect.objectContaining({ path: "README.md", value: "@README.md" }),
      expect.objectContaining({
        path: "src/components",
        value: "@src/components/",
      }),
      expect.objectContaining({
        path: "src/components/CommandPalette.vue",
        value: "@src/components/CommandPalette.vue",
      }),
    ]);
  });

  it("prefers basename matches and supports scoped queries", () => {
    const context = getWorkspaceMentionContext("Inspect @src/comp", 17);
    expect(context).not.toBeNull();

    const suggestions = getWorkspaceMentionSuggestions(entries, context!);
    expect(suggestions.slice(0, 2)).toEqual([
      expect.objectContaining({
        path: "src/components",
        label: "components/",
        value: "@src/components/",
      }),
      expect.objectContaining({
        path: "src/components/ComposerBar.vue",
        label: "ComposerBar.vue",
        value: "@src/components/ComposerBar.vue",
      }),
    ]);
  });

  it("returns scoped suggestions for a directory prefix with no query", () => {
    const context = getWorkspaceMentionContext("Inspect @src/", 13);
    expect(context).not.toBeNull();

    const suggestions = getWorkspaceMentionSuggestions(entries, context!);
    expect(suggestions[0]).toEqual(
      expect.objectContaining({
        path: "src/components",
        value: "@src/components/",
      }),
    );
  });

  it("quotes inserted values when the path contains spaces", () => {
    const context = getWorkspaceMentionContext('Use @"src/utils/with', 20);
    expect(context).not.toBeNull();

    const suggestions = getWorkspaceMentionSuggestions(entries, context!);
    expect(suggestions[0]).toEqual(
      expect.objectContaining({
        value: '@"src/utils/with spaces.ts"',
      }),
    );
  });

  it("applies file completions with a trailing space", () => {
    const context = getWorkspaceMentionContext("Inspect @src/Comp", 17);
    const suggestion = getWorkspaceMentionSuggestions(entries, context!)[1];
    const result = applyWorkspaceMentionCompletion(
      "Inspect @src/Comp now",
      17,
      context!,
      suggestion!,
    );

    expect(result).toEqual({
      text: "Inspect @src/components/ComposerBar.vue  now",
      cursor: 40,
    });
  });

  it("applies directory completions without a trailing space", () => {
    const context = getWorkspaceMentionContext("Inspect @src/comp", 17);
    const suggestion = getWorkspaceMentionSuggestions(entries, context!)[0];
    const result = applyWorkspaceMentionCompletion(
      "Inspect @src/comp",
      17,
      context!,
      suggestion!,
    );

    expect(result).toEqual({
      text: "Inspect @src/components/",
      cursor: 24,
    });
  });
});
