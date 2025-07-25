import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
	plugins: [sveltekit()],
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
			ignored: ['**/docs/**']
		}
	}
});