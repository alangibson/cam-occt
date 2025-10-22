import { beforeEach, describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import { partStore } from '$lib/stores/parts/store';
import { chainStore } from '$lib/stores/chains/store';

describe('Operations Highlighting Integration', () => {
    beforeEach(() => {
        // Reset stores
        partStore.clearHighlight();
        chainStore.selectChain(null);
    });

    it('should highlight parts in part store when handlePartHover is called', () => {
        const testPartId = 'part-123';

        // Verify initial state
        expect(get(partStore).highlightedPartId).toBe(null);

        // Simulate hovering over a part in Operations apply-to menu
        partStore.highlightPart(testPartId);

        // Verify part is highlighted in store
        expect(get(partStore).highlightedPartId).toBe(testPartId);
    });

    it('should clear part highlighting when hovering away', () => {
        const testPartId = 'part-123';

        // First highlight a part
        partStore.highlightPart(testPartId);
        expect(get(partStore).highlightedPartId).toBe(testPartId);

        // Then clear highlighting (simulating mouse leave)
        partStore.clearHighlight();

        // Verify highlighting is cleared
        expect(get(partStore).highlightedPartId).toBe(null);
    });

    it('should select chains in chain store when handleCutHover is called', () => {
        const testChainId = 'chain-456';

        // Verify initial state
        expect(get(chainStore).selectedChainIds.size).toBe(0);

        // Simulate hovering over a cut in Operations apply-to menu
        chainStore.selectChain(testChainId);

        // Verify chain is selected in store
        expect(get(chainStore).selectedChainIds.has(testChainId)).toBe(true);
        expect(get(chainStore).selectedChainIds.size).toBe(1);
    });

    it('should change chain selection when hovering over different cuts', () => {
        const firstChainId = 'chain-456';
        const secondChainId = 'chain-789';

        // Select first chain
        chainStore.selectChain(firstChainId);
        expect(get(chainStore).selectedChainIds.has(firstChainId)).toBe(true);
        expect(get(chainStore).selectedChainIds.size).toBe(1);

        // Select second chain (simulating hovering over different cut)
        chainStore.selectChain(secondChainId);

        // Verify selection changed
        expect(get(chainStore).selectedChainIds.has(secondChainId)).toBe(true);
        expect(get(chainStore).selectedChainIds.size).toBe(1);
    });

    it('should clear chain selection when hovering away from cuts', () => {
        const testChainId = 'chain-456';

        // First select a chain
        chainStore.selectChain(testChainId);
        expect(get(chainStore).selectedChainIds.has(testChainId)).toBe(true);
        expect(get(chainStore).selectedChainIds.size).toBe(1);

        // Then clear selection (simulating mouse leave)
        chainStore.selectChain(null);

        // Verify selection is cleared
        expect(get(chainStore).selectedChainIds.size).toBe(0);
    });

    it('should handle multiple rapid hover changes correctly', () => {
        const partId1 = 'part-111';
        const partId2 = 'part-222';
        const chainId1 = 'chain-111';
        const chainId2 = 'chain-222';

        // Simulate rapid hovering between parts and cuts
        partStore.highlightPart(partId1);
        expect(get(partStore).highlightedPartId).toBe(partId1);

        chainStore.selectChain(chainId1);
        expect(get(chainStore).selectedChainIds.has(chainId1)).toBe(true);
        expect(get(chainStore).selectedChainIds.size).toBe(1);

        partStore.highlightPart(partId2);
        expect(get(partStore).highlightedPartId).toBe(partId2);

        chainStore.selectChain(chainId2);
        expect(get(chainStore).selectedChainIds.has(chainId2)).toBe(true);
        expect(get(chainStore).selectedChainIds.size).toBe(1);

        // Clear both
        partStore.clearHighlight();
        chainStore.selectChain(null);

        expect(get(partStore).highlightedPartId).toBe(null);
        expect(get(chainStore).selectedChainIds.size).toBe(0);
    });
});
