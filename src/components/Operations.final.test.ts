import { beforeEach, describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import { clearHighlight, highlightPart, partStore } from '$lib/stores/parts';
import { chainStore, selectChain } from '$lib/stores/chains';

describe('Operations Final Integration Test', () => {
    beforeEach(() => {
        clearHighlight();
        selectChain(null);
    });

    it('should complete full part hover workflow like Operations component', () => {
        const testPartId = 'part-final-123';

        // Step 1: Verify initial state (like when page loads)
        const initialState = get(partStore);
        expect(initialState.highlightedPartId).toBe(null);

        // Step 2: Simulate mouseenter on part in Operations apply-to menu
        highlightPart(testPartId);

        // Step 3: Verify store is updated (this should trigger DrawingCanvas re-render)
        const highlightedState = get(partStore);
        expect(highlightedState.highlightedPartId).toBe(testPartId);

        // Step 4: Simulate mouseleave from part in Operations apply-to menu
        clearHighlight();

        // Step 5: Verify highlighting is cleared
        const clearedState = get(partStore);
        expect(clearedState.highlightedPartId).toBe(null);
    });

    it('should complete full path hover workflow like Operations component', () => {
        const testChainId = 'chain-final-456';

        // Step 1: Verify initial state
        const initialState = get(chainStore);
        expect(initialState.selectedChainId).toBe(null);

        // Step 2: Simulate mouseenter on path in Operations apply-to menu
        selectChain(testChainId);

        // Step 3: Verify store is updated (this should trigger DrawingCanvas re-render)
        const selectedState = get(chainStore);
        expect(selectedState.selectedChainId).toBe(testChainId);

        // Step 4: Simulate hover over different path
        const secondChainId = 'chain-final-789';
        selectChain(secondChainId);

        // Step 5: Verify selection changed
        const changedState = get(chainStore);
        expect(changedState.selectedChainId).toBe(secondChainId);

        // Step 6: Simulate mouseleave from path (hovering away)
        selectChain(null);

        // Step 7: Verify selection is cleared
        const clearedState = get(chainStore);
        expect(clearedState.selectedChainId).toBe(null);
    });

    it('should handle complex interaction workflow', () => {
        const partId = 'part-complex-111';
        const chainId = 'chain-complex-222';

        // User hovers over part in Operations menu
        highlightPart(partId);
        expect(get(partStore).highlightedPartId).toBe(partId);
        expect(get(chainStore).selectedChainId).toBe(null);

        // User then hovers over path in Operations menu (part should stay highlighted)
        selectChain(chainId);
        expect(get(partStore).highlightedPartId).toBe(partId);
        expect(get(chainStore).selectedChainId).toBe(chainId);

        // User hovers away from part but stays on path
        clearHighlight();
        expect(get(partStore).highlightedPartId).toBe(null);
        expect(get(chainStore).selectedChainId).toBe(chainId);

        // User hovers away from path
        selectChain(null);
        expect(get(partStore).highlightedPartId).toBe(null);
        expect(get(chainStore).selectedChainId).toBe(null);
    });

    it('should verify DrawingCanvas would get the correct data', () => {
        const testPartId = 'part-canvas-integration';
        const testChainId = 'chain-canvas-integration';

        // Simulate what DrawingCanvas reactive statements would see
        let partStoreValue = get(partStore);
        let chainStoreValue = get(chainStore);

        // Highlight part (like Operations component does on part hover)
        highlightPart(testPartId);
        partStoreValue = get(partStore);
        expect(partStoreValue.highlightedPartId).toBe(testPartId);

        // Select chain (like Operations component does on path hover)
        selectChain(testChainId);
        chainStoreValue = get(chainStore);
        expect(chainStoreValue.selectedChainId).toBe(testChainId);

        // This is the data that DrawingCanvas reactive statements would receive

        // Clear everything
        clearHighlight();
        selectChain(null);

        partStoreValue = get(partStore);
        chainStoreValue = get(chainStore);

        expect(partStoreValue.highlightedPartId).toBe(null);
        expect(chainStoreValue.selectedChainId).toBe(null);
    });
});
