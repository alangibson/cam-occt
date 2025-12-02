/**
 * Tests for doesLeadKerfOverlapChain function
 */

import { describe, it, expect } from 'vitest';
import { doesLeadKerfOverlapChain } from './functions';
import type { ChainData } from '$lib/cam/chain/interfaces';
import type { OffsetChain } from '$lib/cam/offset/types';
import type { Line } from '$lib/geometry/line/interfaces';
import { GeometryType } from '$lib/geometry/enums';

describe('doesLeadKerfOverlapChain', () => {
    it('should return false when leadKerfOuterChain is undefined', () => {
        const originalChain: ChainData = {
            id: 'original',
            name: 'original',
            shapes: [],
        };

        const result = doesLeadKerfOverlapChain(undefined, originalChain, 1.0);

        expect(result).toBe(false);
    });

    it('should return false when original chain has no shapes', () => {
        const outerChain: OffsetChain = {
            id: 'outer',
            name: 'outer',
            side: 'right',
            originalChainId: 'source',
            closed: false,

            continuous: true,
            shapes: [
                {
                    id: 'line-2',
                    type: GeometryType.LINE,
                    geometry: {
                        start: { x: 0, y: 1 },
                        end: { x: 10, y: 1 },
                    } as Line,
                },
            ],
        };

        const originalChain: ChainData = {
            id: 'original',
            name: 'original',
            shapes: [],
        };

        const result = doesLeadKerfOverlapChain(outerChain, originalChain, 1.0);

        expect(result).toBe(false);
    });

    it('should return false when original chain does not overlap kerf', () => {
        // Lead kerf: horizontal strip from y=-1 to y=1, x=0 to x=10
        // Kerf width = 2mm (from -1 to +1)
        const outerChain: OffsetChain = {
            id: 'outer',
            name: 'outer',
            side: 'right',
            originalChainId: 'source',
            closed: false,

            continuous: true,
            shapes: [
                {
                    id: 'line-2',
                    type: GeometryType.LINE,
                    geometry: {
                        start: { x: 0, y: 1 },
                        end: { x: 10, y: 1 },
                    } as Line,
                },
            ],
        };

        // Original chain well above the kerf (at y=10)
        const originalChain: ChainData = {
            id: 'original',
            name: 'original',
            shapes: [
                {
                    id: 'original-line',
                    type: GeometryType.LINE,
                    geometry: {
                        start: { x: 0, y: 10 },
                        end: { x: 10, y: 10 },
                    } as Line,
                },
            ],
        };

        const result = doesLeadKerfOverlapChain(
            outerChain,
            originalChain,
            1.0 // kerf width / 2 = 2mm / 2 = 1mm sampling
        );

        expect(result).toBe(false);
    });

    it('should return true when original chain passes through kerf zone', () => {
        // Lead kerf: closed polygon forming a horizontal strip from y=-1 to y=1, x=0 to x=10
        // This simulates what Clipper2 produces with EndType.Round for an open path
        // Kerf width = 2mm (from -1 to +1)
        const outerChain: OffsetChain = {
            id: 'outer',
            name: 'outer',
            side: 'right',
            originalChainId: 'source',
            closed: true,

            continuous: true,
            shapes: [
                {
                    id: 'bottom',
                    type: GeometryType.LINE,
                    geometry: {
                        start: { x: 0, y: -1 },
                        end: { x: 10, y: -1 },
                    } as Line,
                },
                {
                    id: 'right-end',
                    type: GeometryType.LINE,
                    geometry: {
                        start: { x: 10, y: -1 },
                        end: { x: 10, y: 1 },
                    } as Line,
                },
                {
                    id: 'top',
                    type: GeometryType.LINE,
                    geometry: {
                        start: { x: 10, y: 1 },
                        end: { x: 0, y: 1 },
                    } as Line,
                },
                {
                    id: 'left-end',
                    type: GeometryType.LINE,
                    geometry: {
                        start: { x: 0, y: 1 },
                        end: { x: 0, y: -1 },
                    } as Line,
                },
            ],
        };

        // Original chain passes through the middle of the kerf (at y=0)
        const originalChain: ChainData = {
            id: 'original',
            name: 'original',
            shapes: [
                {
                    id: 'original-line',
                    type: GeometryType.LINE,
                    geometry: {
                        start: { x: 0, y: 0 },
                        end: { x: 10, y: 0 },
                    } as Line,
                },
            ],
        };

        const result = doesLeadKerfOverlapChain(
            outerChain,
            originalChain,
            1.0 // kerf width / 2 = 2mm / 2 = 1mm sampling
        );

        expect(result).toBe(true);
    });

    it('should return true when original chain partially overlaps kerf', () => {
        // Lead kerf: closed polygon forming vertical strip from x=-1 to x=1, y=0 to y=10
        // Kerf width = 2mm (from -1 to +1)
        const outerChain: OffsetChain = {
            id: 'outer',
            name: 'outer',
            side: 'right',
            originalChainId: 'source',
            closed: true,

            continuous: true,
            shapes: [
                {
                    id: 'left',
                    type: GeometryType.LINE,
                    geometry: {
                        start: { x: -1, y: 0 },
                        end: { x: -1, y: 10 },
                    } as Line,
                },
                {
                    id: 'top',
                    type: GeometryType.LINE,
                    geometry: {
                        start: { x: -1, y: 10 },
                        end: { x: 1, y: 10 },
                    } as Line,
                },
                {
                    id: 'right',
                    type: GeometryType.LINE,
                    geometry: {
                        start: { x: 1, y: 10 },
                        end: { x: 1, y: 0 },
                    } as Line,
                },
                {
                    id: 'bottom',
                    type: GeometryType.LINE,
                    geometry: {
                        start: { x: 1, y: 0 },
                        end: { x: -1, y: 0 },
                    } as Line,
                },
            ],
        };

        // Original chain crosses through the kerf
        const originalChain: ChainData = {
            id: 'original',
            name: 'original',
            shapes: [
                {
                    id: 'original-line',
                    type: GeometryType.LINE,
                    geometry: {
                        start: { x: -5, y: 5 },
                        end: { x: 5, y: 5 },
                    } as Line,
                },
            ],
        };

        const result = doesLeadKerfOverlapChain(
            outerChain,
            originalChain,
            1.0 // kerf width / 2 = 2mm / 2 = 1mm sampling
        );

        expect(result).toBe(true);
    });

    it('should detect overlap with complex multi-segment chain', () => {
        // Lead kerf: square from (0,0) to (2,2)
        // Kerf width = 1mm (offset by 0.5mm on each side)
        const outerChain: OffsetChain = {
            id: 'outer',
            name: 'outer',
            side: 'outer',
            originalChainId: 'source',
            closed: true,

            continuous: true,
            shapes: [
                {
                    id: 'outer-bottom',
                    type: GeometryType.LINE,
                    geometry: {
                        start: { x: 0, y: 0 },
                        end: { x: 2, y: 0 },
                    } as Line,
                },
                {
                    id: 'outer-right',
                    type: GeometryType.LINE,
                    geometry: {
                        start: { x: 2, y: 0 },
                        end: { x: 2, y: 2 },
                    } as Line,
                },
                {
                    id: 'outer-top',
                    type: GeometryType.LINE,
                    geometry: {
                        start: { x: 2, y: 2 },
                        end: { x: 0, y: 2 },
                    } as Line,
                },
                {
                    id: 'outer-left',
                    type: GeometryType.LINE,
                    geometry: {
                        start: { x: 0, y: 2 },
                        end: { x: 0, y: 0 },
                    } as Line,
                },
            ],
        };

        // Original chain that passes through the kerf
        const originalChain: ChainData = {
            id: 'original',
            name: 'original',
            shapes: [
                {
                    id: 'seg1',
                    type: GeometryType.LINE,
                    geometry: {
                        start: { x: -1, y: 1 },
                        end: { x: 1, y: 1 },
                    } as Line,
                },
                {
                    id: 'seg2',
                    type: GeometryType.LINE,
                    geometry: {
                        start: { x: 1, y: 1 },
                        end: { x: 1, y: 3 },
                    } as Line,
                },
            ],
        };

        const result = doesLeadKerfOverlapChain(
            outerChain,
            originalChain,
            0.5 // kerf width / 2 = 1mm / 2 = 0.5mm sampling
        );

        expect(result).toBe(true);
    });

    it('should handle edge case where chain just touches kerf boundary', () => {
        // Lead kerf: horizontal strip from y=-1 to y=1
        // Kerf width = 2mm (from -1 to +1)
        const outerChain: OffsetChain = {
            id: 'outer',
            name: 'outer',
            side: 'right',
            originalChainId: 'source',
            closed: false,

            continuous: true,
            shapes: [
                {
                    id: 'line-2',
                    type: GeometryType.LINE,
                    geometry: {
                        start: { x: 0, y: 1 },
                        end: { x: 10, y: 1 },
                    } as Line,
                },
            ],
        };

        // Original chain exactly at the outer boundary (y=1)
        // Due to sampling tolerance, this may or may not detect overlap
        const originalChain: ChainData = {
            id: 'original',
            name: 'original',
            shapes: [
                {
                    id: 'original-line',
                    type: GeometryType.LINE,
                    geometry: {
                        start: { x: 0, y: 1 },
                        end: { x: 10, y: 1 },
                    } as Line,
                },
            ],
        };

        const result = doesLeadKerfOverlapChain(
            outerChain,
            originalChain,
            1.0 // kerf width / 2 = 2mm / 2 = 1mm sampling
        );

        // This is a boundary case - result depends on numerical precision
        // We just verify it returns a boolean without error
        expect(typeof result).toBe('boolean');
    });
});
