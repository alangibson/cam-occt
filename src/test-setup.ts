// Test setup file for vitest
// Provides browser API polyfills for the test environment

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
