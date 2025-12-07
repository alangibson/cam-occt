import { beforeEach, describe, expect, it } from 'vitest';
import { selectionStore } from '$lib/stores/selection/store.svelte';

describe('Operations Final Integration Test', () => {
    beforeEach(() => {
        selectionStore.reset();
    });

    it('should complete full part hover workflow like Operations component', () => {
        const testPartId = 'part-final-123';

        // Step 1: Verify initial state (like when page loads)
        const initialState = selectionStore.getState();
        expect(initialState.parts.highlighted).toBe(null);

        // Step 2: Simulate mouseenter on part in Operations apply-to menu
        selectionStore.highlightPart(testPartId);

        // Step 3: Verify store is updated (this should trigger DrawingCanvas re-render)
        const highlightedState = selectionStore.getState();
        expect(highlightedState.parts.highlighted).toBe(testPartId);

        // Step 4: Simulate mouseleave from part in Operations apply-to menu
        selectionStore.clearPartHighlight();

        // Step 5: Verify highlighting is cleared
        const clearedState = selectionStore.getState();
        expect(clearedState.parts.highlighted).toBe(null);
    });

    it('should complete full cut hover workflow like Operations component', () => {
        const testChainId = 'chain-final-456';

        // Step 1: Verify initial state
        const initialState = selectionStore.getState();
        expect(initialState.chains.selected.size).toBe(0);

        // Step 2: Simulate mouseenter on cut in Operations apply-to menu
        selectionStore.selectChain(testChainId);

        // Step 3: Verify store is updated (this should trigger DrawingCanvas re-render)
        const selectedState = selectionStore.getState();
        expect(selectedState.chains.selected.has(testChainId)).toBe(true);
        expect(selectedState.chains.selected.size).toBe(1);

        // Step 4: Simulate hover over different cut
        const secondChainId = 'chain-final-789';
        selectionStore.selectChain(secondChainId);

        // Step 5: Verify selection changed
        const changedState = selectionStore.getState();
        expect(changedState.chains.selected.has(secondChainId)).toBe(true);
        expect(changedState.chains.selected.size).toBe(1);

        // Step 6: Simulate mouseleave from cut (hovering away)
        selectionStore.selectChain(null);

        // Step 7: Verify selection is cleared
        const clearedState = selectionStore.getState();
        expect(clearedState.chains.selected.size).toBe(0);
    });

    it('should handle complex interaction workflow', () => {
        const partId = 'part-complex-111';
        const chainId = 'chain-complex-222';

        // User hovers over part in Operations menu
        selectionStore.highlightPart(partId);
        expect(selectionStore.getState().parts.highlighted).toBe(partId);
        expect(selectionStore.getState().chains.selected.size).toBe(0);

        // User then hovers over cut in Operations menu (part should stay highlighted)
        selectionStore.selectChain(chainId);
        expect(selectionStore.getState().parts.highlighted).toBe(partId);
        expect(selectionStore.getState().chains.selected.has(chainId)).toBe(
            true
        );
        expect(selectionStore.getState().chains.selected.size).toBe(1);

        // User hovers away from part but stays on cut
        selectionStore.clearPartHighlight();
        expect(selectionStore.getState().parts.highlighted).toBe(null);
        expect(selectionStore.getState().chains.selected.has(chainId)).toBe(
            true
        );
        expect(selectionStore.getState().chains.selected.size).toBe(1);

        // User hovers away from cut
        selectionStore.selectChain(null);
        expect(selectionStore.getState().parts.highlighted).toBe(null);
        expect(selectionStore.getState().chains.selected.size).toBe(0);
    });

    it('should verify DrawingCanvas would get the correct data', () => {
        const testPartId = 'part-canvas-integration';
        const testChainId = 'chain-canvas-integration';

        // Simulate what DrawingCanvas reactive statements would see
        let selectionStoreValue = selectionStore.getState();

        // Highlight part (like Operations component does on part hover)
        selectionStore.highlightPart(testPartId);
        selectionStoreValue = selectionStore.getState();
        expect(selectionStoreValue.parts.highlighted).toBe(testPartId);

        // Select chain (like Operations component does on cut hover)
        selectionStore.selectChain(testChainId);
        selectionStoreValue = selectionStore.getState();
        expect(selectionStoreValue.chains.selected.has(testChainId)).toBe(true);
        expect(selectionStoreValue.chains.selected.size).toBe(1);

        // This is the data that DrawingCanvas reactive statements would receive

        // Clear everything
        selectionStore.clearPartHighlight();
        selectionStore.selectChain(null);

        selectionStoreValue = selectionStore.getState();

        expect(selectionStoreValue.parts.highlighted).toBe(null);
        expect(selectionStoreValue.chains.selected.size).toBe(0);
    });
});
