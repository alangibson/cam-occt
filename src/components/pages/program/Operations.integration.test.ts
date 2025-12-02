import { beforeEach, describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import { selectionStore } from '$lib/stores/selection/store';

describe('Operations Highlighting Integration', () => {
    beforeEach(() => {
        // Reset stores
        selectionStore.reset();
    });

    it('should highlight parts in part store when handlePartHover is called', () => {
        const testPartId = 'part-123';

        // Verify initial state
        expect(get(selectionStore).parts.highlighted).toBe(null);

        // Simulate hovering over a part in Operations apply-to menu
        selectionStore.highlightPart(testPartId);

        // Verify part is highlighted in store
        expect(get(selectionStore).parts.highlighted).toBe(testPartId);
    });

    it('should clear part highlighting when hovering away', () => {
        const testPartId = 'part-123';

        // First highlight a part
        selectionStore.highlightPart(testPartId);
        expect(get(selectionStore).parts.highlighted).toBe(testPartId);

        // Then clear highlighting (simulating mouse leave)
        selectionStore.clearPartHighlight();

        // Verify highlighting is cleared
        expect(get(selectionStore).parts.highlighted).toBe(null);
    });

    it('should select chains in chain store when handleCutHover is called', () => {
        const testChainId = 'chain-456';

        // Verify initial state
        expect(get(selectionStore).chains.selected.size).toBe(0);

        // Simulate hovering over a cut in Operations apply-to menu
        selectionStore.selectChain(testChainId);

        // Verify chain is selected in store
        expect(get(selectionStore).chains.selected.has(testChainId)).toBe(true);
        expect(get(selectionStore).chains.selected.size).toBe(1);
    });

    it('should change chain selection when hovering over different cuts', () => {
        const firstChainId = 'chain-456';
        const secondChainId = 'chain-789';

        // Select first chain
        selectionStore.selectChain(firstChainId);
        expect(get(selectionStore).chains.selected.has(firstChainId)).toBe(
            true
        );
        expect(get(selectionStore).chains.selected.size).toBe(1);

        // Select second chain (simulating hovering over different cut)
        selectionStore.selectChain(secondChainId);

        // Verify selection changed
        expect(get(selectionStore).chains.selected.has(secondChainId)).toBe(
            true
        );
        expect(get(selectionStore).chains.selected.size).toBe(1);
    });

    it('should clear chain selection when hovering away from cuts', () => {
        const testChainId = 'chain-456';

        // First select a chain
        selectionStore.selectChain(testChainId);
        expect(get(selectionStore).chains.selected.has(testChainId)).toBe(true);
        expect(get(selectionStore).chains.selected.size).toBe(1);

        // Then clear selection (simulating mouse leave)
        selectionStore.selectChain(null);

        // Verify selection is cleared
        expect(get(selectionStore).chains.selected.size).toBe(0);
    });

    it('should handle multiple rapid hover changes correctly', () => {
        const partId1 = 'part-111';
        const partId2 = 'part-222';
        const chainId1 = 'chain-111';
        const chainId2 = 'chain-222';

        // Simulate rapid hovering between parts and cuts
        selectionStore.highlightPart(partId1);
        expect(get(selectionStore).parts.highlighted).toBe(partId1);

        selectionStore.selectChain(chainId1);
        expect(get(selectionStore).chains.selected.has(chainId1)).toBe(true);
        expect(get(selectionStore).chains.selected.size).toBe(1);

        selectionStore.highlightPart(partId2);
        expect(get(selectionStore).parts.highlighted).toBe(partId2);

        selectionStore.selectChain(chainId2);
        expect(get(selectionStore).chains.selected.has(chainId2)).toBe(true);
        expect(get(selectionStore).chains.selected.size).toBe(1);

        // Clear both
        selectionStore.clearPartHighlight();
        selectionStore.selectChain(null);

        expect(get(selectionStore).parts.highlighted).toBe(null);
        expect(get(selectionStore).chains.selected.size).toBe(0);
    });
});
