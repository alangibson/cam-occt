import { beforeEach, describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import { partStore } from '$lib/stores/parts/store';
import { chainStore } from '$lib/stores/chains/store';

// Mock the Operations component functions directly
describe('Operations Component Hover Functions', () => {
    let hoveredPartId: string | null = null;
    let hoveredCutId: string | null = null;

    // These are the actual functions from Operations.svelte
    function handlePartHover(partId: string | null) {
        hoveredPartId = partId;
        if (partId) {
            // This should call the highlightPart function
            partStore.highlightPart(partId);
        } else {
            // This should call clearHighlight
            partStore.clearHighlight();
        }
    }

    function handleCutHover(cutId: string | null) {
        hoveredCutId = cutId;
        // This should call selectChain
        chainStore.selectChain(cutId);
    }

    beforeEach(() => {
        hoveredPartId = null;
        hoveredCutId = null;
        partStore.clearHighlight();
        chainStore.selectChain(null);
    });

    it('should update part store when hovering over part', () => {
        const testPartId = 'part-test-123';

        // Verify initial state
        expect(get(partStore).highlightedPartId).toBe(null);

        // Simulate hovering over a part
        handlePartHover(testPartId);

        // Verify local state is updated
        expect(hoveredPartId).toBe(testPartId);

        // Verify store is updated
        expect(get(partStore).highlightedPartId).toBe(testPartId);
    });

    it('should clear part highlighting when hovering away', () => {
        const testPartId = 'part-test-123';

        // First hover over part
        handlePartHover(testPartId);
        expect(get(partStore).highlightedPartId).toBe(testPartId);

        // Then hover away (null)
        handlePartHover(null);

        // Verify local state is cleared
        expect(hoveredPartId).toBe(null);

        // Verify store is cleared
        expect(get(partStore).highlightedPartId).toBe(null);
    });

    it('should update chain store when hovering over cut', () => {
        const testChainId = 'chain-test-456';

        // Verify initial state
        expect(get(chainStore).selectedChainId).toBe(null);

        // Simulate hovering over a cut
        handleCutHover(testChainId);

        // Verify local state is updated
        expect(hoveredCutId).toBe(testChainId);

        // Verify store is updated
        expect(get(chainStore).selectedChainId).toBe(testChainId);
    });

    it('should change chain selection when hovering over different cuts', () => {
        const firstChainId = 'chain-test-456';
        const secondChainId = 'chain-test-789';

        // Hover over first cut
        handleCutHover(firstChainId);
        expect(get(chainStore).selectedChainId).toBe(firstChainId);

        // Hover over second cut
        handleCutHover(secondChainId);

        // Verify selection changed
        expect(hoveredCutId).toBe(secondChainId);
        expect(get(chainStore).selectedChainId).toBe(secondChainId);
    });

    it('should clear chain selection when hovering away from cuts', () => {
        const testChainId = 'chain-test-456';

        // First hover over cut
        handleCutHover(testChainId);
        expect(get(chainStore).selectedChainId).toBe(testChainId);

        // Then hover away (null)
        handleCutHover(null);

        // Verify local state is cleared
        expect(hoveredCutId).toBe(null);

        // Verify store is cleared
        expect(get(chainStore).selectedChainId).toBe(null);
    });

    it('should handle simultaneous part and cut hovering', () => {
        const testPartId = 'part-test-123';
        const testChainId = 'chain-test-456';

        // Hover over part
        handlePartHover(testPartId);
        expect(get(partStore).highlightedPartId).toBe(testPartId);

        // Hover over cut (should not affect part highlighting)
        handleCutHover(testChainId);
        expect(get(chainStore).selectedChainId).toBe(testChainId);
        expect(get(partStore).highlightedPartId).toBe(testPartId); // Should still be highlighted

        // Clear part hover
        handlePartHover(null);
        expect(get(partStore).highlightedPartId).toBe(null);
        expect(get(chainStore).selectedChainId).toBe(testChainId); // Chain should still be selected

        // Clear cut hover
        handleCutHover(null);
        expect(get(chainStore).selectedChainId).toBe(null);
    });
});
