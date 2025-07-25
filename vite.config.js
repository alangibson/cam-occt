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
				'**/reference/**'
			]
		}
	},
	ssr: {
		noExternal: ['three', 'dxf']
	},
	assetsInclude: ['**/*.wasm']
});