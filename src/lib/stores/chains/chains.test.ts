import { GeometryType } from '$lib/geometry/enums';
import { get } from 'svelte/store';
import { describe, expect, it } from 'vitest';
import type { ChainData } from '$lib/cam/chain/interfaces';
import { chainStore } from './store';
import { selectionStore } from '$lib/stores/selection/store';
import { getChainById, getChainShapeIds, getShapeChainId } from './functions';

describe('Chain Store', () => {
    const mockChains: ChainData[] = [
        {
            id: 'chain-1',
            name: 'chain-1',
            shapes: [
                {
                    id: 'shape-1',
                    type: GeometryType.LINE,
                    geometry: { start: { x: 0, y: 0 }, end: { x: 10, y: 0 } },
                },
                {
                    id: 'shape-2',
                    type: GeometryType.LINE,
                    geometry: { start: { x: 10, y: 0 }, end: { x: 20, y: 0 } },
                },
            ],
        },
        {
            id: 'chain-2',
            name: 'chain-2',
            shapes: [
                {
                    id: 'shape-3',
                    type: GeometryType.CIRCLE,
                    geometry: { center: { x: 50, y: 50 }, radius: 5 },
                },
                {
                    id: 'shape-4',
                    type: GeometryType.LINE,
                    geometry: {
                        start: { x: 55, y: 50 },
                        end: { x: 65, y: 50 },
                    },
                },
            ],
        },
    ];

    it('should initialize with default tolerance', () => {
        const state = get(chainStore);
        expect(state.tolerance).toBe(0.1);
    });

    it.skip('should set chains correctly', () => {
        // NOTE: setChains method no longer exists - chains are now managed through Drawing -> Layers
    });

    it.skip('should clear chains', () => {
        // NOTE: clearChains method no longer exists - chains are now managed through Drawing -> Layers
    });

    it('should set tolerance', () => {
        chainStore.setTolerance(0.1);
        const state = get(chainStore);
        expect(state.tolerance).toBe(0.1);
    });

    it('should get shape chain ID correctly', () => {
        const chainId = getShapeChainId('shape-1', mockChains);
        expect(chainId).toBe('chain-1');

        const nonExistentChainId = getShapeChainId('shape-999', mockChains);
        expect(nonExistentChainId).toBeNull();
    });

    it('should get all shape IDs in a chain', () => {
        const shapeIds = getChainShapeIds('shape-1', mockChains);
        expect(shapeIds).toEqual(['shape-1', 'shape-2']);

        const isolatedShapeIds = getChainShapeIds('shape-999', mockChains);
        expect(isolatedShapeIds).toEqual(['shape-999']);
    });

    it('should get chain by ID', () => {
        const chain = getChainById('chain-1', mockChains);
        expect(chain).toEqual(mockChains[0]);

        const nonExistentChain = getChainById('chain-999', mockChains);
        expect(nonExistentChain).toBeNull();
    });

    describe('Chain Highlighting', () => {
        it('should highlight a chain', () => {
            const testChainId = 'chain-123';

            selectionStore.highlightChain(testChainId);

            const state = get(selectionStore);
            expect(state.chains.highlighted).toBe(testChainId);
            expect(state.chains.selected.size).toBe(0); // Should not affect selection
        });

        it('should clear chain highlight', () => {
            const testChainId = 'chain-123';

            // First highlight a chain
            selectionStore.highlightChain(testChainId);
            expect(get(selectionStore).chains.highlighted).toBe(testChainId);

            // Then clear the highlight
            selectionStore.clearChainHighlight();
            expect(get(selectionStore).chains.highlighted).toBeNull();
        });

        it('should allow highlighting and selection to coexist', () => {
            const selectedChainId = 'chain-selected';
            const highlightedChainId = 'chain-highlighted';

            // Select one chain and highlight another
            selectionStore.selectChain(selectedChainId);
            selectionStore.highlightChain(highlightedChainId);

            const state = get(selectionStore);
            expect(state.chains.selected.has(selectedChainId)).toBe(true);
            expect(state.chains.highlighted).toBe(highlightedChainId);
        });

        it('should handle null chain highlighting', () => {
            selectionStore.highlightChain(null);

            const state = get(selectionStore);
            expect(state.chains.highlighted).toBeNull();
        });
    });
});
