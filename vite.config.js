import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	optimizeDeps: {
		include: ['three', 'dxf']
	},
	server: {
		fs: {
			allow: ['..']
		},
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
	},
	ssr: {
		noExternal: ['three', 'dxf']
	},
	assetsInclude: ['**/*.wasm']
});