import { describe, expect, it } from "vitest";
import { detectLanguageFromPath } from "../utils/codeHighlight";

describe("detectLanguageFromPath", () => {
  it("maps common code extensions to bundled languages", () => {
    expect(detectLanguageFromPath("src/main.ts")).toBe("typescript");
    expect(detectLanguageFromPath("src/view.vue")).toBe("vue");
    expect(detectLanguageFromPath("Dockerfile")).toBe("docker");
    expect(detectLanguageFromPath("scripts/build.sh")).toBe("bash");
    expect(detectLanguageFromPath("patches/fix.diff")).toBe("diff");
    expect(detectLanguageFromPath("js")).toBe("javascript");
    expect(detectLanguageFromPath("app/main.py")).toBe("python");
    expect(detectLanguageFromPath("cmd/server.go")).toBe("go");
    expect(detectLanguageFromPath("src/lib.rs")).toBe("rust");
    expect(detectLanguageFromPath("src/App.java")).toBe("java");
    expect(detectLanguageFromPath("src/native.cpp")).toBe("cpp");
    expect(detectLanguageFromPath("db/schema.sql")).toBe("sql");
  });

  it("falls back to text for unsupported extensions", () => {
    expect(detectLanguageFromPath("notes.txt")).toBe("text");
    expect(detectLanguageFromPath("Gemfile.rb")).toBe("text");
    expect(detectLanguageFromPath(undefined)).toBe("text");
  });
});
