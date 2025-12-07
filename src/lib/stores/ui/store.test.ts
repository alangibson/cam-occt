import { describe, it, expect, beforeEach } from 'vitest';
import { uiStore } from './store.svelte';

describe('UI Store', () => {
    beforeEach(() => {
        // Reset store to initial state
        uiStore.hideToolTable();
        uiStore.hideSettings();
    });

    it('should initialize with default values', () => {
        expect(uiStore.toolTableVisible).toBe(false);
        expect(uiStore.settingsVisible).toBe(false);
    });

    describe('tool table visibility', () => {
        it('should toggle tool table visibility from false to true', () => {
            expect(uiStore.toolTableVisible).toBe(false);

            uiStore.toggleToolTable();

            expect(uiStore.toolTableVisible).toBe(true);
        });

        it('should toggle tool table visibility from true to false', () => {
            // First set it to true
            uiStore.showToolTable();
            expect(uiStore.toolTableVisible).toBe(true);

            // Then toggle it
            uiStore.toggleToolTable();

            expect(uiStore.toolTableVisible).toBe(false);
        });

        it('should show tool table', () => {
            expect(uiStore.toolTableVisible).toBe(false);

            uiStore.showToolTable();

            expect(uiStore.toolTableVisible).toBe(true);
        });

        it('should hide tool table', () => {
            // First show it
            uiStore.showToolTable();
            expect(uiStore.toolTableVisible).toBe(true);

            // Then hide it
            uiStore.hideToolTable();

            expect(uiStore.toolTableVisible).toBe(false);
        });

        it('should handle multiple toggle operations', () => {
            expect(uiStore.toolTableVisible).toBe(false);

            // Toggle 1: false -> true
            uiStore.toggleToolTable();
            expect(uiStore.toolTableVisible).toBe(true);

            // Toggle 2: true -> false
            uiStore.toggleToolTable();
            expect(uiStore.toolTableVisible).toBe(false);

            // Toggle 3: false -> true
            uiStore.toggleToolTable();
            expect(uiStore.toolTableVisible).toBe(true);
        });

        it('should handle show when already shown', () => {
            uiStore.showToolTable();
            expect(uiStore.toolTableVisible).toBe(true);

            // Call show again
            uiStore.showToolTable();
            expect(uiStore.toolTableVisible).toBe(true);
        });

        it('should handle hide when already hidden', () => {
            expect(uiStore.toolTableVisible).toBe(false);

            // Call hide again
            uiStore.hideToolTable();
            expect(uiStore.toolTableVisible).toBe(false);
        });
    });

    describe('settings visibility', () => {
        it('should toggle settings visibility from false to true', () => {
            expect(uiStore.settingsVisible).toBe(false);

            uiStore.toggleSettings();

            expect(uiStore.settingsVisible).toBe(true);
        });

        it('should toggle settings visibility from true to false', () => {
            // First set it to true
            uiStore.showSettings();
            expect(uiStore.settingsVisible).toBe(true);

            // Then toggle it
            uiStore.toggleSettings();

            expect(uiStore.settingsVisible).toBe(false);
        });

        it('should show settings', () => {
            expect(uiStore.settingsVisible).toBe(false);

            uiStore.showSettings();

            expect(uiStore.settingsVisible).toBe(true);
        });

        it('should hide settings', () => {
            // First show it
            uiStore.showSettings();
            expect(uiStore.settingsVisible).toBe(true);

            // Then hide it
            uiStore.hideSettings();

            expect(uiStore.settingsVisible).toBe(false);
        });
    });

    describe('restore', () => {
        it('should restore state from persistence', () => {
            uiStore.restore({
                showToolTable: true,
                showSettings: true,
            });

            expect(uiStore.toolTableVisible).toBe(true);
            expect(uiStore.settingsVisible).toBe(true);
        });
    });
});
