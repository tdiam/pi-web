import { describe, expect, it } from "vitest";
import {
  applySlashCommandCompletion,
  getSlashCommandContext,
  parseCompactSlashCommand,
} from "../utils/slashCommands";

describe("slash command helpers", () => {
  it("extracts slash command context from the start of the composer", () => {
    expect(getSlashCommandContext("  /comp", 7)).toEqual({
      query: "comp",
      start: 2,
      end: 7,
    });
  });

  it("applies command completion with a trailing separator", () => {
    const context = getSlashCommandContext("/comp", 5);
    expect(context).not.toBeNull();

    expect(
      applySlashCommandCompletion("/comp", context!, { name: "compact" }),
    ).toEqual({
      text: "/compact ",
      cursor: 9,
    });
  });

  it("parses /compact with optional custom instructions", () => {
    expect(parseCompactSlashCommand("/compact")).toEqual({});
    expect(
      parseCompactSlashCommand("/compact Focus on changed files only"),
    ).toEqual({
      customInstructions: "Focus on changed files only",
    });
  });

  it("ignores non-compact slash commands", () => {
    expect(parseCompactSlashCommand("/review src/app.ts")).toBeNull();
  });
});
