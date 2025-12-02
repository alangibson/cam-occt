import { beforeEach, describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import { selectionStore } from '$lib/stores/selection/store';

describe('Operations Final Integration Test', () => {
    beforeEach(() => {
        selectionStore.reset();
    });

    it('should complete full part hover workflow like Operations component', () => {
        const testPartId = 'part-final-123';

        // Step 1: Verify initial state (like when page loads)
        const initialState = get(selectionStore);
        expect(initialState.parts.highlighted).toBe(null);

        // Step 2: Simulate mouseenter on part in Operations apply-to menu
        selectionStore.highlightPart(testPartId);

        // Step 3: Verify store is updated (this should trigger DrawingCanvas re-render)
        const highlightedState = get(selectionStore);
        expect(highlightedState.parts.highlighted).toBe(testPartId);

        // Step 4: Simulate mouseleave from part in Operations apply-to menu
        selectionStore.clearPartHighlight();

        // Step 5: Verify highlighting is cleared
        const clearedState = get(selectionStore);
        expect(clearedState.parts.highlighted).toBe(null);
    });

    it('should complete full cut hover workflow like Operations component', () => {
        const testChainId = 'chain-final-456';

        // Step 1: Verify initial state
        const initialState = get(selectionStore);
        expect(initialState.chains.selected.size).toBe(0);

        // Step 2: Simulate mouseenter on cut in Operations apply-to menu
        selectionStore.selectChain(testChainId);

        // Step 3: Verify store is updated (this should trigger DrawingCanvas re-render)
        const selectedState = get(selectionStore);
        expect(selectedState.chains.selected.has(testChainId)).toBe(true);
        expect(selectedState.chains.selected.size).toBe(1);

        // Step 4: Simulate hover over different cut
        const secondChainId = 'chain-final-789';
        selectionStore.selectChain(secondChainId);

        // Step 5: Verify selection changed
        const changedState = get(selectionStore);
        expect(changedState.chains.selected.has(secondChainId)).toBe(true);
        expect(changedState.chains.selected.size).toBe(1);

        // Step 6: Simulate mouseleave from cut (hovering away)
        selectionStore.selectChain(null);

        // Step 7: Verify selection is cleared
        const clearedState = get(selectionStore);
        expect(clearedState.chains.selected.size).toBe(0);
    });

    it('should handle complex interaction workflow', () => {
        const partId = 'part-complex-111';
        const chainId = 'chain-complex-222';

        // User hovers over part in Operations menu
        selectionStore.highlightPart(partId);
        expect(get(selectionStore).parts.highlighted).toBe(partId);
        expect(get(selectionStore).chains.selected.size).toBe(0);

        // User then hovers over cut in Operations menu (part should stay highlighted)
        selectionStore.selectChain(chainId);
        expect(get(selectionStore).parts.highlighted).toBe(partId);
        expect(get(selectionStore).chains.selected.has(chainId)).toBe(true);
        expect(get(selectionStore).chains.selected.size).toBe(1);

        // User hovers away from part but stays on cut
        selectionStore.clearPartHighlight();
        expect(get(selectionStore).parts.highlighted).toBe(null);
        expect(get(selectionStore).chains.selected.has(chainId)).toBe(true);
        expect(get(selectionStore).chains.selected.size).toBe(1);

        // User hovers away from cut
        selectionStore.selectChain(null);
        expect(get(selectionStore).parts.highlighted).toBe(null);
        expect(get(selectionStore).chains.selected.size).toBe(0);
    });

    it('should verify DrawingCanvas would get the correct data', () => {
        const testPartId = 'part-canvas-integration';
        const testChainId = 'chain-canvas-integration';

        // Simulate what DrawingCanvas reactive statements would see
        let selectionStoreValue = get(selectionStore);

        // Highlight part (like Operations component does on part hover)
        selectionStore.highlightPart(testPartId);
        selectionStoreValue = get(selectionStore);
        expect(selectionStoreValue.parts.highlighted).toBe(testPartId);

        // Select chain (like Operations component does on cut hover)
        selectionStore.selectChain(testChainId);
        selectionStoreValue = get(selectionStore);
        expect(selectionStoreValue.chains.selected.has(testChainId)).toBe(true);
        expect(selectionStoreValue.chains.selected.size).toBe(1);

        // This is the data that DrawingCanvas reactive statements would receive

        // Clear everything
        selectionStore.clearPartHighlight();
        selectionStore.selectChain(null);

        selectionStoreValue = get(selectionStore);

        expect(selectionStoreValue.parts.highlighted).toBe(null);
        expect(selectionStoreValue.chains.selected.size).toBe(0);
    });
});
