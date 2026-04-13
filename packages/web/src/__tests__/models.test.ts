import { describe, expect, it } from "vitest";
import { filterModels, normalizeRpcModel } from "../utils/models";

const models = [
  { provider: "openai", id: "gpt-4.1", name: "GPT-4.1" },
  { provider: "anthropic", id: "claude-sonnet-4", name: "Claude Sonnet 4" },
  { provider: "google", id: "gemini-2.5-pro", name: "Gemini 2.5 Pro" },
];

describe("models utils", () => {
  it("normalizes Pi model payloads", () => {
    expect(
      normalizeRpcModel({
        provider: "openai",
        id: "gpt-4.1",
        name: "GPT-4.1",
        api: "openai-responses",
        reasoning: true,
        contextWindow: 128000,
        maxTokens: 32000,
      }),
    ).toEqual({
      provider: "openai",
      id: "gpt-4.1",
      name: "GPT-4.1",
      api: "openai-responses",
      reasoning: true,
      contextWindow: 128000,
      maxTokens: 32000,
    });
  });

  it("matches provider and model ids with fuzzy search", () => {
    expect(filterModels(models, "claude s4")).toEqual([
      { provider: "anthropic", id: "claude-sonnet-4", name: "Claude Sonnet 4" },
    ]);
    expect(filterModels(models, "gm25p")).toEqual([
      { provider: "google", id: "gemini-2.5-pro", name: "Gemini 2.5 Pro" },
    ]);
  });

  it("prefers the closest match when multiple models fit", () => {
    expect(filterModels(models, "gpt")[0]).toEqual({
      provider: "openai",
      id: "gpt-4.1",
      name: "GPT-4.1",
    });
  });
});
