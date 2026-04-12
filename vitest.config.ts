import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		include: ["packages/bridge/**/*.test.ts", "packages/web/src/**/*.test.ts"],
	},
});
