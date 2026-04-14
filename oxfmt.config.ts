import { defineConfig } from "oxfmt";

export default defineConfig({
  printWidth: 80,
  ignorePatterns: [".agents", ".pi"],
  sortImports: {
    newlinesBetween: false,
  },
  sortPackageJson: {
    sortScripts: true,
  },
});
