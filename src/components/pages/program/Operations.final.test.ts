import { beforeEach, describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import { partStore } from '$lib/stores/parts/store';
import { chainStore } from '$lib/stores/chains/store';

describe('Operations Final Integration Test', () => {
    beforeEach(() => {
        partStore.clearHighlight();
        chainStore.selectChain(null);
    });

    it('should complete full part hover workflow like Operations component', () => {
        const testPartId = 'part-final-123';

        // Step 1: Verify initial state (like when page loads)
        const initialState = get(partStore);
        expect(initialState.highlightedPartId).toBe(null);

        // Step 2: Simulate mouseenter on part in Operations apply-to menu
        partStore.highlightPart(testPartId);

        // Step 3: Verify store is updated (this should trigger DrawingCanvas re-render)
        const highlightedState = get(partStore);
        expect(highlightedState.highlightedPartId).toBe(testPartId);

        // Step 4: Simulate mouseleave from part in Operations apply-to menu
        partStore.clearHighlight();

        // Step 5: Verify highlighting is cleared
        const clearedState = get(partStore);
        expect(clearedState.highlightedPartId).toBe(null);
    });

    it('should complete full cut hover workflow like Operations component', () => {
        const testChainId = 'chain-final-456';

        // Step 1: Verify initial state
        const initialState = get(chainStore);
        expect(initialState.selectedChainIds.size).toBe(0);

        // Step 2: Simulate mouseenter on cut in Operations apply-to menu
        chainStore.selectChain(testChainId);

        // Step 3: Verify store is updated (this should trigger DrawingCanvas re-render)
        const selectedState = get(chainStore);
        expect(selectedState.selectedChainIds.has(testChainId)).toBe(true);
        expect(selectedState.selectedChainIds.size).toBe(1);

        // Step 4: Simulate hover over different cut
        const secondChainId = 'chain-final-789';
        chainStore.selectChain(secondChainId);

        // Step 5: Verify selection changed
        const changedState = get(chainStore);
        expect(changedState.selectedChainIds.has(secondChainId)).toBe(true);
        expect(changedState.selectedChainIds.size).toBe(1);

        // Step 6: Simulate mouseleave from cut (hovering away)
        chainStore.selectChain(null);

        // Step 7: Verify selection is cleared
        const clearedState = get(chainStore);
        expect(clearedState.selectedChainIds.size).toBe(0);
    });

    it('should handle complex interaction workflow', () => {
        const partId = 'part-complex-111';
        const chainId = 'chain-complex-222';

        // User hovers over part in Operations menu
        partStore.highlightPart(partId);
        expect(get(partStore).highlightedPartId).toBe(partId);
        expect(get(chainStore).selectedChainIds.size).toBe(0);

        // User then hovers over cut in Operations menu (part should stay highlighted)
        chainStore.selectChain(chainId);
        expect(get(partStore).highlightedPartId).toBe(partId);
        expect(get(chainStore).selectedChainIds.has(chainId)).toBe(true);
        expect(get(chainStore).selectedChainIds.size).toBe(1);

        // User hovers away from part but stays on cut
        partStore.clearHighlight();
        expect(get(partStore).highlightedPartId).toBe(null);
        expect(get(chainStore).selectedChainIds.has(chainId)).toBe(true);
        expect(get(chainStore).selectedChainIds.size).toBe(1);

        // User hovers away from cut
        chainStore.selectChain(null);
        expect(get(partStore).highlightedPartId).toBe(null);
        expect(get(chainStore).selectedChainIds.size).toBe(0);
    });

    it('should verify DrawingCanvas would get the correct data', () => {
        const testPartId = 'part-canvas-integration';
        const testChainId = 'chain-canvas-integration';

        // Simulate what DrawingCanvas reactive statements would see
        let partStoreValue = get(partStore);
        let chainStoreValue = get(chainStore);

        // Highlight part (like Operations component does on part hover)
        partStore.highlightPart(testPartId);
        partStoreValue = get(partStore);
        expect(partStoreValue.highlightedPartId).toBe(testPartId);

        // Select chain (like Operations component does on cut hover)
        chainStore.selectChain(testChainId);
        chainStoreValue = get(chainStore);
        expect(chainStoreValue.selectedChainIds.has(testChainId)).toBe(true);
        expect(chainStoreValue.selectedChainIds.size).toBe(1);

        // This is the data that DrawingCanvas reactive statements would receive

        // Clear everything
        partStore.clearHighlight();
        chainStore.selectChain(null);

        partStoreValue = get(partStore);
        chainStoreValue = get(chainStore);

        expect(partStoreValue.highlightedPartId).toBe(null);
        expect(chainStoreValue.selectedChainIds.size).toBe(0);
    });
});
