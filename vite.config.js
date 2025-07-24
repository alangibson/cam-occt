import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	optimizeDeps: {
		include: ['three', 'dxf'],
		exclude: ['opencascade.js']
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