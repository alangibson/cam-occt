import { beforeEach, describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import { selectionStore } from '$lib/stores/selection/store';

// Test that we can directly call the store functions that Operations uses
describe('Operations Store Functions Debug', () => {
    beforeEach(() => {
        selectionStore.reset();
    });

    it('should directly test highlightPart function', () => {
        const testPartId = 'part-debug-123';
        selectionStore.highlightPart(testPartId);

        const finalState = get(selectionStore);

        expect(finalState.parts.highlighted).toBe(testPartId);
    });

    it('should directly test selectChain function', () => {
        const testChainId = 'chain-debug-456';
        selectionStore.selectChain(testChainId);

        const finalState = get(selectionStore);

        expect(finalState.chains.selected.has(testChainId)).toBe(true);
        expect(finalState.chains.selected.size).toBe(1);
    });

    it('should test clearHighlight function', () => {
        // First set a highlighted part
        const testPartId = 'part-debug-123';
        selectionStore.highlightPart(testPartId);
        expect(get(selectionStore).parts.highlighted).toBe(testPartId);

        // Then clear it
        selectionStore.clearPartHighlight();
        expect(get(selectionStore).parts.highlighted).toBe(null);
    });

    it('should test selectChain with null', () => {
        // First select a chain
        const testChainId = 'chain-debug-456';
        selectionStore.selectChain(testChainId);
        expect(get(selectionStore).chains.selected.has(testChainId)).toBe(true);
        expect(get(selectionStore).chains.selected.size).toBe(1);

        // Then clear it
        selectionStore.selectChain(null);
        expect(get(selectionStore).chains.selected.size).toBe(0);
    });

    it('should verify stores are reactive', () => {
        let partHighlighted = false;
        let chainSelected = false;

        // Subscribe to store
        const unsubscribe = selectionStore.subscribe((state) => {
            if (state.parts.highlighted) {
                partHighlighted = true;
            }
            if (state.chains.selected.size > 0) {
                chainSelected = true;
            }
        });

        // Trigger changes
        selectionStore.highlightPart('part-reactive-test');
        selectionStore.selectChain('chain-reactive-test');

        // Verify callbacks were triggered
        expect(partHighlighted).toBe(true);
        expect(chainSelected).toBe(true);

        // Cleanup
        unsubscribe();
    });
});
