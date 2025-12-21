// Test setup file for vitest
// Provides browser API polyfills for the test environment

import { preloadClipper2 } from '$lib/cam/offset/clipper-init';

// Preload Clipper2 WASM module for all tests
await preloadClipper2();

// ResizeObserver polyfill for @svar-ui/svelte-grid
global.ResizeObserver = class ResizeObserver {
    constructor(callback: ResizeObserverCallback) {
        this.callback = callback;
    }
    callback: ResizeObserverCallback;
    observe() {}
    unobserve() {}
    disconnect() {}
};
