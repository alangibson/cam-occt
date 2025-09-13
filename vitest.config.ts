import { defineConfig } from "vitest/config";
import { sveltekit } from "@sveltejs/kit/vite";
import { svelteTesting } from "@testing-library/svelte/vite";

export default defineConfig({
	plugins: [sveltekit(), svelteTesting()],
	test: {
		environment: "jsdom",
		globals: true,
		include: ["src/**/*.{test,spec}.{js,ts}"],
		watchExclude: ["**/node_modules/**", "**/dist/**", "**/docs/**"],
		silent: true,
		reporters: [
			['default', { 
				summary: false
			}]
		],
		coverage: {
			provider: "v8",
			reporter: ["html"],
			reportsDirectory: "./report/coverage",
			clean: false, // Clean coverage reports directory before running tests
			all: true, // Collect coverage from all files, even if they've not been tested
			// thresholds: {
			// 	lines: 88,
			// 	functions: 88,
			// 	branches: 86,
			// 	statements: 88,
			// },
			include: ["src/**/*.{js,vue,ts,svelte}"],
			exclude: [
				"node_modules/**/*",
				"tests/**/*",
				"**/*.test.ts",
				"**/*.test.js",
				"**/*.spec.ts",
				"**/*.spec.js",
				"**/vite.config.js",
				"**/svelte.config.js",
				"**/playwright.config.js",
				".svelte-kit/**/*",
				"build/**/*",
				"reference/**/*",
				"routes/**/*",
			],
		},
	},
	optimizeDeps: {
		include: ["three", "dxf"],
	},
	assetsInclude: ["**/*.wasm"],
	server: {
		watch: {
			ignored: [
				"**/docs/**",
				"**/reference/**",
				"**/build/**",
				"**/node_modules/**",
				"**/*.test.ts",
				"**/*.test.js",
				"**/*.spec.ts",
				"**/*.spec.js",
			],
		},
	},
});
