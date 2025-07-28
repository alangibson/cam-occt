import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';
import { svelteTesting } from '@testing-library/svelte/vite';

export default defineConfig({
	plugins: [sveltekit(), svelteTesting()],
	test: {
		environment: 'jsdom',
		globals: true,
		include: ['src/**/*.{test,spec}.{js,ts}'],
		watchExclude: ['**/node_modules/**', '**/dist/**', '**/docs/**']
	},
	optimizeDeps: {
		include: ['three', 'dxf']
	},
	assetsInclude: ['**/*.wasm'],
	server: {
		watch: {
			ignored: [
				'**/docs/**',
				'**/reference/**',
				'**/build/**',
				'**/node_modules/**',
				'**/*.test.ts',
				'**/*.test.js',
				'**/*.spec.ts',
				'**/*.spec.js'
			]
		}
	}
});