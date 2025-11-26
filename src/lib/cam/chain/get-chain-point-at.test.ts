import { Chain } from '$lib/cam/chain/classes';
import { describe, it, expect } from 'vitest';
import { getChainPointAt } from './functions';
import type { ChainData } from './interfaces';
import type { ShapeData } from '$lib/cam/shape/interfaces';
import type { Line } from '$lib/geometry/line/interfaces';
import type { Arc } from '$lib/geometry/arc/interfaces';
import { GeometryType } from '$lib/geometry/enums';

describe('getChainPointAt', () => {
    it('should throw error for empty chain', () => {
        const emptyChain: ChainData = {
            id: 'empty',
            shapes: [],
        };

        expect(() => getChainPointAt(new Chain(emptyChain), 0.5)).toThrow(
            'Chain has no shapes'
        );
    });

    it('should return start point when t=0', () => {
        const lineShape: ShapeData = {
            id: 'test-line',
            type: GeometryType.LINE,
            geometry: {
                start: { x: 0, y: 0 },
                end: { x: 100, y: 0 },
            } as Line,
        };

        const chain: ChainData = {
            id: 'line-chain',
            shapes: [lineShape],
        };

        const point = getChainPointAt(new Chain(chain), 0);
        expect(point.x).toBe(0);
        expect(point.y).toBe(0);
    });

    it('should return end point when t=1', () => {
        const lineShape: ShapeData = {
            id: 'test-line',
            type: GeometryType.LINE,
            geometry: {
                start: { x: 0, y: 0 },
                end: { x: 100, y: 0 },
            } as Line,
        };

        const chain: ChainData = {
            id: 'line-chain',
            shapes: [lineShape],
        };

        const point = getChainPointAt(new Chain(chain), 1);
        expect(point.x).toBe(100);
        expect(point.y).toBe(0);
    });

    it('should return midpoint when t=0.5 for single line', () => {
        const lineShape: ShapeData = {
            id: 'test-line',
            type: GeometryType.LINE,
            geometry: {
                start: { x: 0, y: 0 },
                end: { x: 100, y: 0 },
            } as Line,
        };

        const chain: ChainData = {
            id: 'line-chain',
            shapes: [lineShape],
        };

        const point = getChainPointAt(new Chain(chain), 0.5);
        expect(point.x).toBe(50);
        expect(point.y).toBe(0);
    });

    it('should handle chain with multiple lines', () => {
        const line1: ShapeData = {
            id: 'line1',
            type: GeometryType.LINE,
            geometry: {
                start: { x: 0, y: 0 },
                end: { x: 100, y: 0 },
            } as Line,
        };

        const line2: ShapeData = {
            id: 'line2',
            type: GeometryType.LINE,
            geometry: {
                start: { x: 100, y: 0 },
                end: { x: 100, y: 100 },
            } as Line,
        };

        const chain: ChainData = {
            id: 'two-line-chain',
            shapes: [line1, line2],
        };

        // Total length = 200 (100 + 100)
        // t=0.25 should be at 50 units along first line
        const point1 = getChainPointAt(new Chain(chain), 0.25);
        expect(point1.x).toBe(50);
        expect(point1.y).toBe(0);

        // t=0.5 should be at the junction (end of first line)
        const point2 = getChainPointAt(new Chain(chain), 0.5);
        expect(point2.x).toBe(100);
        expect(point2.y).toBe(0);

        // t=0.75 should be 50 units along second line
        const point3 = getChainPointAt(new Chain(chain), 0.75);
        expect(point3.x).toBe(100);
        expect(point3.y).toBe(50);
    });

    it('should handle arc in chain', () => {
        // Quarter circle arc from 0° to 90°
        const arcShape: ShapeData = {
            id: 'test-arc',
            type: GeometryType.ARC,
            geometry: {
                center: { x: 0, y: 0 },
                radius: 100,
                startAngle: 0,
                endAngle: Math.PI / 2,
                clockwise: false,
            } as Arc,
        };

        const chain: ChainData = {
            id: 'arc-chain',
            shapes: [arcShape],
        };

        // t=0 should be at start (100, 0)
        const start = getChainPointAt(new Chain(chain), 0);
        expect(start.x).toBeCloseTo(100, 5);
        expect(start.y).toBeCloseTo(0, 5);

        // t=1 should be at end (0, 100)
        const end = getChainPointAt(new Chain(chain), 1);
        expect(end.x).toBeCloseTo(0, 5);
        expect(end.y).toBeCloseTo(100, 5);

        // t=0.5 should be at 45° (roughly 70.7, 70.7)
        const mid = getChainPointAt(new Chain(chain), 0.5);
        expect(mid.x).toBeCloseTo(70.71, 1);
        expect(mid.y).toBeCloseTo(70.71, 1);
    });

    it('should clamp t values outside [0, 1] range', () => {
        const lineShape: ShapeData = {
            id: 'test-line',
            type: GeometryType.LINE,
            geometry: {
                start: { x: 0, y: 0 },
                end: { x: 100, y: 0 },
            } as Line,
        };

        const chain: ChainData = {
            id: 'line-chain',
            shapes: [lineShape],
        };

        // t < 0 should return start point
        const pointNegative = getChainPointAt(new Chain(chain), -0.5);
        expect(pointNegative.x).toBe(0);
        expect(pointNegative.y).toBe(0);

        // t > 1 should return end point
        const pointOver = getChainPointAt(new Chain(chain), 1.5);
        expect(pointOver.x).toBe(100);
        expect(pointOver.y).toBe(0);
    });

    it('should handle mixed shape types in chain', () => {
        const line: ShapeData = {
            id: 'test-line',
            type: GeometryType.LINE,
            geometry: {
                start: { x: 0, y: 0 },
                end: { x: 100, y: 0 },
            } as Line,
        };

        // Quarter circle arc
        const arc: ShapeData = {
            id: 'test-arc',
            type: GeometryType.ARC,
            geometry: {
                center: { x: 100, y: 100 },
                radius: 100,
                startAngle: -Math.PI / 2, // Starts at (100, 0)
                endAngle: 0, // Ends at (200, 100)
                clockwise: false,
            } as Arc,
        };

        const chain: ChainData = {
            id: 'mixed-chain',
            shapes: [line, arc],
        };

        // Should handle transition between different shape types
        // Line length = 100
        // Arc length ≈ 157.08 (quarter circle with radius 100)
        // Total ≈ 257.08

        // t=0 should be at line start
        const start = getChainPointAt(new Chain(chain), 0);
        expect(start.x).toBeCloseTo(0, 5);
        expect(start.y).toBeCloseTo(0, 5);

        // t=1 should be at arc end
        const end = getChainPointAt(new Chain(chain), 1);
        expect(end.x).toBeCloseTo(200, 5);
        expect(end.y).toBeCloseTo(100, 5);
    });
});
