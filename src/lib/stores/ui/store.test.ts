import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { uiStore } from './store';

describe('UI Store', () => {
    beforeEach(() => {
        // Reset store to initial state
        uiStore.hideToolTable();
    });

    it('should initialize with default values', () => {
        const state = get(uiStore);
        expect(state.showToolTable).toBe(false);
    });

    describe('tool table visibility', () => {
        it('should toggle tool table visibility from false to true', () => {
            let state = get(uiStore);
            expect(state.showToolTable).toBe(false);

            uiStore.toggleToolTable();

            state = get(uiStore);
            expect(state.showToolTable).toBe(true);
        });

        it('should toggle tool table visibility from true to false', () => {
            // First set it to true
            uiStore.showToolTable();
            let state = get(uiStore);
            expect(state.showToolTable).toBe(true);

            // Then toggle it
            uiStore.toggleToolTable();

            state = get(uiStore);
            expect(state.showToolTable).toBe(false);
        });

        it('should show tool table', () => {
            let state = get(uiStore);
            expect(state.showToolTable).toBe(false);

            uiStore.showToolTable();

            state = get(uiStore);
            expect(state.showToolTable).toBe(true);
        });

        it('should hide tool table', () => {
            // First show it
            uiStore.showToolTable();
            let state = get(uiStore);
            expect(state.showToolTable).toBe(true);

            // Then hide it
            uiStore.hideToolTable();

            state = get(uiStore);
            expect(state.showToolTable).toBe(false);
        });

        it('should handle multiple toggle operations', () => {
            let state = get(uiStore);
            expect(state.showToolTable).toBe(false);

            // Toggle 1: false -> true
            uiStore.toggleToolTable();
            state = get(uiStore);
            expect(state.showToolTable).toBe(true);

            // Toggle 2: true -> false
            uiStore.toggleToolTable();
            state = get(uiStore);
            expect(state.showToolTable).toBe(false);

            // Toggle 3: false -> true
            uiStore.toggleToolTable();
            state = get(uiStore);
            expect(state.showToolTable).toBe(true);
        });

        it('should handle show when already shown', () => {
            uiStore.showToolTable();
            let state = get(uiStore);
            expect(state.showToolTable).toBe(true);

            // Call show again
            uiStore.showToolTable();
            state = get(uiStore);
            expect(state.showToolTable).toBe(true);
        });

        it('should handle hide when already hidden', () => {
            let state = get(uiStore);
            expect(state.showToolTable).toBe(false);

            // Call hide again
            uiStore.hideToolTable();
            state = get(uiStore);
            expect(state.showToolTable).toBe(false);
        });
    });
});
