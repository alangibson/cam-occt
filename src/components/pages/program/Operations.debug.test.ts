import { beforeEach, describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import { partStore } from '$lib/stores/parts/store';
import { chainStore } from '$lib/stores/chains/store';

// Test that we can directly call the store functions that Operations uses
describe('Operations Store Functions Debug', () => {
    beforeEach(() => {
        partStore.clearHighlight();
        chainStore.selectChain(null);
    });

    it('should directly test highlightPart function', () => {
        const testPartId = 'part-debug-123';
        partStore.highlightPart(testPartId);

        const finalState = get(partStore);

        expect(finalState.highlightedPartId).toBe(testPartId);
    });

    it('should directly test selectChain function', () => {
        const testChainId = 'chain-debug-456';
        chainStore.selectChain(testChainId);

        const finalState = get(chainStore);

        expect(finalState.selectedChainIds.has(testChainId)).toBe(true);
        expect(finalState.selectedChainIds.size).toBe(1);
    });

    it('should test clearHighlight function', () => {
        // First set a highlighted part
        const testPartId = 'part-debug-123';
        partStore.highlightPart(testPartId);
        expect(get(partStore).highlightedPartId).toBe(testPartId);

        // Then clear it
        partStore.clearHighlight();
        expect(get(partStore).highlightedPartId).toBe(null);
    });

    it('should test selectChain with null', () => {
        // First select a chain
        const testChainId = 'chain-debug-456';
        chainStore.selectChain(testChainId);
        expect(get(chainStore).selectedChainIds.has(testChainId)).toBe(true);
        expect(get(chainStore).selectedChainIds.size).toBe(1);

        // Then clear it
        chainStore.selectChain(null);
        expect(get(chainStore).selectedChainIds.size).toBe(0);
    });

    it('should verify stores are reactive', () => {
        let partHighlighted = false;
        let chainSelected = false;

        // Subscribe to stores
        const unsubscribePart = partStore.subscribe((state) => {
            if (state.highlightedPartId) {
                partHighlighted = true;
            }
        });

        const unsubscribeChain = chainStore.subscribe((state) => {
            if (state.selectedChainIds.size > 0) {
                chainSelected = true;
            }
        });

        // Trigger changes
        partStore.highlightPart('part-reactive-test');
        chainStore.selectChain('chain-reactive-test');

        // Verify callbacks were triggered
        expect(partHighlighted).toBe(true);
        expect(chainSelected).toBe(true);

        // Cleanup
        unsubscribePart();
        unsubscribeChain();
    });
});
