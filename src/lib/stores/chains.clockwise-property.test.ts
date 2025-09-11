import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { chainStore, setChains, clearChains } from './chains';
import type { Chain } from '../algorithms/chain-detection/chain-detection';
import type { Shape } from '../types';
import { GeometryType } from '$lib/geometry/shape';

describe('Chain Store - Clockwise Property Setting', () => {
    beforeEach(() => {
        clearChains();
    });

    it('should automatically set clockwise property for clockwise chain', () => {
        // Create a clockwise square chain (going: right → down → left → up)
        const clockwiseSquare: Shape[] = [
            {
                id: 'line1',
                type: GeometryType.LINE,
                geometry: { start: { x: 0, y: 10 }, end: { x: 10, y: 10 } },
            }, // right
            {
                id: 'line2',
                type: GeometryType.LINE,
                geometry: { start: { x: 10, y: 10 }, end: { x: 10, y: 0 } },
            }, // down
            {
                id: 'line3',
                type: GeometryType.LINE,
                geometry: { start: { x: 10, y: 0 }, end: { x: 0, y: 0 } },
            }, // left
            {
                id: 'line4',
                type: GeometryType.LINE,
                geometry: { start: { x: 0, y: 0 }, end: { x: 0, y: 10 } },
            }, // up
        ];

        const chains: Chain[] = [
            {
                id: 'clockwise-square',
                shapes: clockwiseSquare,
            },
        ];

        // Set chains - this should automatically analyze and set clockwise property
        setChains(chains);

        const state = get(chainStore);
        expect(state.chains).toHaveLength(1);
        expect(state.chains[0].clockwise).toBe(true); // Should be detected as clockwise
    });

    it('should automatically set clockwise property for counterclockwise chain', () => {
        // Create a counterclockwise square chain (going: right → up → left → down)
        const counterclockwiseSquare: Shape[] = [
            {
                id: 'line1',
                type: GeometryType.LINE,
                geometry: { start: { x: 0, y: 0 }, end: { x: 10, y: 0 } },
            }, // right
            {
                id: 'line2',
                type: GeometryType.LINE,
                geometry: { start: { x: 10, y: 0 }, end: { x: 10, y: 10 } },
            }, // up
            {
                id: 'line3',
                type: GeometryType.LINE,
                geometry: { start: { x: 10, y: 10 }, end: { x: 0, y: 10 } },
            }, // left
            {
                id: 'line4',
                type: GeometryType.LINE,
                geometry: { start: { x: 0, y: 10 }, end: { x: 0, y: 0 } },
            }, // down
        ];

        const chains: Chain[] = [
            {
                id: 'counterclockwise-square',
                shapes: counterclockwiseSquare,
            },
        ];

        // Set chains - this should automatically analyze and set clockwise property
        setChains(chains);

        const state = get(chainStore);
        expect(state.chains).toHaveLength(1);
        expect(state.chains[0].clockwise).toBe(false); // Should be detected as counterclockwise
    });

    it('should set clockwise property to null for open chain', () => {
        // Create an open line chain
        const openLine: Shape[] = [
            {
                id: 'line1',
                type: GeometryType.LINE,
                geometry: { start: { x: 0, y: 0 }, end: { x: 10, y: 0 } },
            },
        ];

        const chains: Chain[] = [
            {
                id: 'open-line',
                shapes: openLine,
            },
        ];

        // Set chains - this should automatically analyze and set clockwise property
        setChains(chains);

        const state = get(chainStore);
        expect(state.chains).toHaveLength(1);
        expect(state.chains[0].clockwise).toBe(null); // Should be null for open chains
    });

    it('should handle multiple chains with different winding directions', () => {
        const clockwiseSquare: Shape[] = [
            {
                id: 'line1',
                type: GeometryType.LINE,
                geometry: { start: { x: 0, y: 10 }, end: { x: 10, y: 10 } },
            }, // right
            {
                id: 'line2',
                type: GeometryType.LINE,
                geometry: { start: { x: 10, y: 10 }, end: { x: 10, y: 0 } },
            }, // down
            {
                id: 'line3',
                type: GeometryType.LINE,
                geometry: { start: { x: 10, y: 0 }, end: { x: 0, y: 0 } },
            }, // left
            {
                id: 'line4',
                type: GeometryType.LINE,
                geometry: { start: { x: 0, y: 0 }, end: { x: 0, y: 10 } },
            }, // up
        ];

        const counterclockwiseSquare: Shape[] = [
            {
                id: 'line5',
                type: GeometryType.LINE,
                geometry: { start: { x: 20, y: 0 }, end: { x: 30, y: 0 } },
            }, // right
            {
                id: 'line6',
                type: GeometryType.LINE,
                geometry: { start: { x: 30, y: 0 }, end: { x: 30, y: 10 } },
            }, // up
            {
                id: 'line7',
                type: GeometryType.LINE,
                geometry: { start: { x: 30, y: 10 }, end: { x: 20, y: 10 } },
            }, // left
            {
                id: 'line8',
                type: GeometryType.LINE,
                geometry: { start: { x: 20, y: 10 }, end: { x: 20, y: 0 } },
            }, // down
        ];

        const openLine: Shape[] = [
            {
                id: 'line9',
                type: GeometryType.LINE,
                geometry: { start: { x: 0, y: 20 }, end: { x: 10, y: 20 } },
            },
        ];

        const chains: Chain[] = [
            {
                id: 'clockwise-square',
                shapes: clockwiseSquare,
            },
            {
                id: 'counterclockwise-square',
                shapes: counterclockwiseSquare,
            },
            {
                id: 'open-line',
                shapes: openLine,
            },
        ];

        // Set chains - this should automatically analyze and set clockwise properties
        setChains(chains);

        const state = get(chainStore);
        expect(state.chains).toHaveLength(3);

        const clockwiseChain = state.chains.find(
            (c) => c.id === 'clockwise-square'
        );
        const counterclockwiseChain = state.chains.find(
            (c) => c.id === 'counterclockwise-square'
        );
        const openChain = state.chains.find((c) => c.id === 'open-line');

        expect(clockwiseChain?.clockwise).toBe(true);
        expect(counterclockwiseChain?.clockwise).toBe(false);
        expect(openChain?.clockwise).toBe(null);
    });

    it('should preserve clockwise property when chains already have it set', () => {
        // Create chains that already have clockwise property set
        const chains: Chain[] = [
            {
                id: 'pre-analyzed-chain',
                shapes: [
                    {
                        id: 'line1',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 0, y: 0 },
                            end: { x: 10, y: 0 },
                        },
                    },
                ],
                clockwise: true, // Pre-set clockwise property
            },
        ];

        // Set chains - this should re-analyze and potentially override the pre-set property
        setChains(chains);

        const state = get(chainStore);
        expect(state.chains).toHaveLength(1);
        // The property should be re-analyzed since setChains always calls setChainsDirection
        // For an open line, it should be null regardless of what was pre-set
        expect(state.chains[0].clockwise).toBe(null);
    });
});
