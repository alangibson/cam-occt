import { beforeEach, describe, expect, it } from 'vitest';
import { selectionStore } from '$lib/stores/selection/store.svelte';

// Test that we can directly call the store functions that Operations uses
describe('Operations Store Functions Debug', () => {
    beforeEach(() => {
        selectionStore.reset();
    });

    it('should directly test highlightPart function', () => {
        const testPartId = 'part-debug-123';
        selectionStore.highlightPart(testPartId);

        const finalState = selectionStore.getState();

        expect(finalState.parts.highlighted).toBe(testPartId);
    });

    it('should directly test selectChain function', () => {
        const testChainId = 'chain-debug-456';
        selectionStore.selectChain(testChainId);

        const finalState = selectionStore.getState();

        expect(finalState.chains.selected.has(testChainId)).toBe(true);
        expect(finalState.chains.selected.size).toBe(1);
    });

    it('should test clearHighlight function', () => {
        // First set a highlighted part
        const testPartId = 'part-debug-123';
        selectionStore.highlightPart(testPartId);
        expect(selectionStore.getState().parts.highlighted).toBe(testPartId);

        // Then clear it
        selectionStore.clearPartHighlight();
        expect(selectionStore.getState().parts.highlighted).toBe(null);
    });

    it('should test selectChain with null', () => {
        // First select a chain
        const testChainId = 'chain-debug-456';
        selectionStore.selectChain(testChainId);
        expect(selectionStore.getState().chains.selected.has(testChainId)).toBe(
            true
        );
        expect(selectionStore.getState().chains.selected.size).toBe(1);

        // Then clear it
        selectionStore.selectChain(null);
        expect(selectionStore.getState().chains.selected.size).toBe(0);
    });

    it('should verify stores are reactive', () => {
        // Verify initial state
        expect(selectionStore.parts.highlighted).toBeNull();
        expect(selectionStore.chains.selected.size).toBe(0);

        // Trigger changes
        selectionStore.highlightPart('part-reactive-test');
        selectionStore.selectChain('chain-reactive-test');

        // Verify state was updated
        expect(selectionStore.parts.highlighted).toBe('part-reactive-test');
        expect(selectionStore.chains.selected.size).toBe(1);
        expect(selectionStore.chains.selected.has('chain-reactive-test')).toBe(
            true
        );
    });
});
