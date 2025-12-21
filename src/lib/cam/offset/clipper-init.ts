/**
 * Clipper2 WASM Initialization Module
 *
 * Handles eager initialization of the Clipper2 WASM module with singleton pattern.
 * The WASM module should be preloaded at app startup via preloadClipper2().
 * Once loaded, getClipper2() returns the instance synchronously.
 */

import type { MainModule } from '$lib/wasm/clipper2z';
import Clipper2ZFactoryImport from '$lib/wasm/clipper2z.js';

// Type assertion for the factory function since the .d.ts doesn't properly export it
type FactoryFunction = (config?: {
    wasmBinary?: BufferSource;
    locateFile?: (path: string) => string;
}) => Promise<MainModule>;

const Clipper2ZFactory = Clipper2ZFactoryImport as FactoryFunction;

let clipper2Instance: MainModule | null = null;
let initPromise: Promise<MainModule> | null = null;

/**
 * Preload the Clipper2 WASM module
 *
 * This function starts loading the WASM module and should be called at app startup.
 * It uses environment-aware WASM loading:
 * - Browser: Vite serves .wasm as an asset (uses href)
 * - Node/Vitest: Direct filesystem access (uses pathname)
 *
 * @returns Promise resolving to initialized Clipper2 MainModule
 * @throws Error if WASM initialization fails
 */
export async function preloadClipper2(): Promise<MainModule> {
    // Return cached instance if available
    if (clipper2Instance) {
        return clipper2Instance;
    }

    // If initialization is already in progress, return existing promise
    if (!initPromise) {
        // Detect Node environment
        const isNode = typeof process !== 'undefined' && process.versions?.node;

        if (isNode) {
            // Node/Vitest: Load WASM binary directly from filesystem using dynamic imports
            // This prevents these Node.js modules from being bundled in the browser build
            const { fileURLToPath } = await import('url');
            const { join, dirname } = await import('path');
            const { readFileSync } = await import('fs');

            const currentDir = dirname(fileURLToPath(import.meta.url));
            const wasmPath = join(
                currentDir,
                '..',
                '..',
                'wasm',
                'clipper2z.wasm'
            );
            const wasmBinary = readFileSync(wasmPath);

            initPromise = Clipper2ZFactory({
                wasmBinary,
            });
        } else {
            // Browser: Use Vite's asset URL resolution
            initPromise = Clipper2ZFactory({
                locateFile: (path: string) => {
                    const wasmURL = new URL(
                        `../../wasm/${path}`,
                        import.meta.url
                    );
                    return wasmURL.href;
                },
            });
        }
    }

    clipper2Instance = await initPromise!;
    return clipper2Instance;
}

/**
 * Get the Clipper2 WASM module synchronously
 *
 * This function returns the cached WASM instance. It throws an error if the
 * module hasn't been loaded yet via preloadClipper2().
 *
 * @returns Initialized Clipper2 MainModule
 * @throws Error if WASM module hasn't been preloaded
 */
export function getClipper2(): MainModule {
    if (!clipper2Instance) {
        throw new Error(
            'Clipper2 WASM module not loaded. Call preloadClipper2() at app startup.'
        );
    }
    return clipper2Instance;
}
