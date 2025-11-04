import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { comlink } from 'vite-plugin-comlink';

export default defineConfig({
	plugins: [sveltekit(), comlink()],
	worker: {
		plugins: () => [comlink()]
	},
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
	assetsInclude: ['**/*.wasm'],
});