import { beforeEach, describe, expect, it } from 'vitest';
import { selectionStore } from '$lib/stores/selection/store.svelte';

// Mock the Operations component functions directly
describe('Operations Component Hover Functions', () => {
    let hoveredPartId: string | null = null;
    let hoveredCutId: string | null = null;

    // These are the actual functions from Operations.svelte
    function handlePartHover(partId: string | null) {
        hoveredPartId = partId;
        if (partId) {
            // This should call the highlightPart function
            selectionStore.highlightPart(partId);
        } else {
            // This should call clearHighlight
            selectionStore.clearPartHighlight();
        }
    }

    function handleCutHover(cutId: string | null) {
        hoveredCutId = cutId;
        // This should call selectChain
        selectionStore.selectChain(cutId);
    }

    beforeEach(() => {
        hoveredPartId = null;
        hoveredCutId = null;
        selectionStore.clearPartHighlight();
        selectionStore.selectChain(null);
    });

    it('should update part store when hovering over part', () => {
        const testPartId = 'part-test-123';

        // Verify initial state
        expect(selectionStore.getState().parts.highlighted).toBe(null);

        // Simulate hovering over a part
        handlePartHover(testPartId);

        // Verify local state is updated
        expect(hoveredPartId).toBe(testPartId);

        // Verify store is updated
        expect(selectionStore.getState().parts.highlighted).toBe(testPartId);
    });

    it('should clear part highlighting when hovering away', () => {
        const testPartId = 'part-test-123';

        // First hover over part
        handlePartHover(testPartId);
        expect(selectionStore.getState().parts.highlighted).toBe(testPartId);

        // Then hover away (null)
        handlePartHover(null);

        // Verify local state is cleared
        expect(hoveredPartId).toBe(null);

        // Verify store is cleared
        expect(selectionStore.getState().parts.highlighted).toBe(null);
    });

    it('should update chain store when hovering over cut', () => {
        const testChainId = 'chain-test-456';

        // Verify initial state
        expect(selectionStore.getState().chains.selected.size).toBe(0);

        // Simulate hovering over a cut
        handleCutHover(testChainId);

        // Verify local state is updated
        expect(hoveredCutId).toBe(testChainId);

        // Verify store is updated
        expect(selectionStore.getState().chains.selected.has(testChainId)).toBe(
            true
        );
        expect(selectionStore.getState().chains.selected.size).toBe(1);
    });

    it('should change chain selection when hovering over different cuts', () => {
        const firstChainId = 'chain-test-456';
        const secondChainId = 'chain-test-789';

        // Hover over first cut
        handleCutHover(firstChainId);
        expect(
            selectionStore.getState().chains.selected.has(firstChainId)
        ).toBe(true);
        expect(selectionStore.getState().chains.selected.size).toBe(1);

        // Hover over second cut
        handleCutHover(secondChainId);

        // Verify selection changed
        expect(hoveredCutId).toBe(secondChainId);
        expect(
            selectionStore.getState().chains.selected.has(secondChainId)
        ).toBe(true);
        expect(selectionStore.getState().chains.selected.size).toBe(1);
    });

    it('should clear chain selection when hovering away from cuts', () => {
        const testChainId = 'chain-test-456';

        // First hover over cut
        handleCutHover(testChainId);
        expect(selectionStore.getState().chains.selected.has(testChainId)).toBe(
            true
        );
        expect(selectionStore.getState().chains.selected.size).toBe(1);

        // Then hover away (null)
        handleCutHover(null);

        // Verify local state is cleared
        expect(hoveredCutId).toBe(null);

        // Verify store is cleared
        expect(selectionStore.getState().chains.selected.size).toBe(0);
    });

    it('should handle simultaneous part and cut hovering', () => {
        const testPartId = 'part-test-123';
        const testChainId = 'chain-test-456';

        // Hover over part
        handlePartHover(testPartId);
        expect(selectionStore.getState().parts.highlighted).toBe(testPartId);

        // Hover over cut (should not affect part highlighting)
        handleCutHover(testChainId);
        expect(selectionStore.getState().chains.selected.has(testChainId)).toBe(
            true
        );
        expect(selectionStore.getState().chains.selected.size).toBe(1);
        expect(selectionStore.getState().parts.highlighted).toBe(testPartId); // Should still be highlighted

        // Clear part hover
        handlePartHover(null);
        expect(selectionStore.getState().parts.highlighted).toBe(null);
        expect(selectionStore.getState().chains.selected.has(testChainId)).toBe(
            true
        );
        expect(selectionStore.getState().chains.selected.size).toBe(1); // Chain should still be selected

        // Clear cut hover
        handleCutHover(null);
        expect(selectionStore.getState().chains.selected.size).toBe(0);
    });
});
