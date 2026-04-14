import { defineConfig } from "oxlint";

export default defineConfig({
  plugins: [
    "typescript",
    "vue",
    "vitest",
    "import",
    "jsdoc",
    "node",
    "promise",
  ],
  categories: {
    correctness: "error",
    perf: "error",
    suspicious: "error",
  },
});
