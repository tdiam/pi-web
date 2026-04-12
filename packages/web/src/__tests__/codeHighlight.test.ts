import { describe, expect, it } from "vitest";
import { detectLanguageFromPath } from "../utils/codeHighlight";

describe("detectLanguageFromPath", () => {
  it("maps common code extensions to bundled languages", () => {
    expect(detectLanguageFromPath("src/main.ts")).toBe("typescript");
    expect(detectLanguageFromPath("src/view.vue")).toBe("vue");
    expect(detectLanguageFromPath("Dockerfile")).toBe("docker");
    expect(detectLanguageFromPath("scripts/build.sh")).toBe("bash");
    expect(detectLanguageFromPath("patches/fix.diff")).toBe("diff");
  });

  it("falls back to text for unsupported extensions", () => {
    expect(detectLanguageFromPath("notes.txt")).toBe("text");
    expect(detectLanguageFromPath("Gemfile.rb")).toBe("text");
    expect(detectLanguageFromPath(undefined)).toBe("text");
  });
});
