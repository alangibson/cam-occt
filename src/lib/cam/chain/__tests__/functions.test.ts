import { Chain } from '$lib/cam/chain/classes.svelte';
import { getChainEndPoint, isChainClosed } from '$lib/cam/chain/functions';
import type { Line } from '$lib/geometry/line/interfaces';
import { GeometryType } from '$lib/geometry/enums';
import { describe, expect, it } from 'vitest';
import type { Point2D } from '$lib/geometry/point/interfaces';
import type { ShapeData } from '$lib/cam/shape/interfaces';
import type { ChainData } from '$lib/cam/chain/interfaces';

// Helper function to create test chains
function createTestChain(id: string, shapes: ShapeData[]): ChainData {
    return {
        id,
        name: id,
        shapes,
    };
}

// Helper function to create test rectangle
function createRectangle(
    x: number,
    y: number,
    width: number,
    height: number
): ShapeData[] {
    return [
        {
            id: '1',
            type: GeometryType.LINE,
            geometry: {
                start: { x, y },
                end: { x: x + width, y },
            } as Line,
        },
        {
            id: '2',
            type: GeometryType.LINE,
            geometry: {
                start: { x: x + width, y },
                end: { x: x + width, y: y + height },
            } as Line,
        },
        {
            id: '3',
            type: GeometryType.LINE,
            geometry: {
                start: { x: x + width, y: y + height },
                end: { x, y: y + height },
            } as Line,
        },
        {
            id: '4',
            type: GeometryType.LINE,
            geometry: {
                start: { x, y: y + height },
                end: { x, y },
            } as Line,
        },
    ];
}

describe('isChainClosed', () => {
    it('should return true for closed chain within tolerance', () => {
        const shapes = createRectangle(0, 0, 10, 10);
        const chain = createTestChain('test', shapes);

        expect(isChainClosed(new Chain(chain), 0.1)).toBe(true);
    });

    it('should return false for open chain', () => {
        const shapes: ShapeData[] = [
            {
                id: '1',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 0, y: 0 },
                    end: { x: 10, y: 0 },
                } as Line,
            },
            {
                id: '2',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 10, y: 0 },
                    end: { x: 10, y: 10 },
                } as Line,
            },
        ];
        const chain = createTestChain('test', shapes);

        expect(isChainClosed(new Chain(chain), 0.1)).toBe(false);
    });

    it('should return false for empty chain', () => {
        const chain = createTestChain('test', []);

        expect(isChainClosed(new Chain(chain), 0.1)).toBe(false);
    });

    it('should handle chain with points close but not within tolerance', () => {
        const shapes: ShapeData[] = [
            {
                id: '1',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 0, y: 0 },
                    end: { x: 10, y: 0 },
                } as Line,
            },
            {
                id: '2',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 10, y: 0 },
                    end: { x: 10, y: 10 },
                } as Line,
            },
            {
                id: '3',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 10, y: 10 },
                    end: { x: 0, y: 10 },
                } as Line,
            },
            {
                id: '4',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 0, y: 10 },
                    end: { x: 0.2, y: 0 },
                } as Line,
            }, // 0.2 gap
        ];
        const chain = createTestChain('test', shapes);

        expect(isChainClosed(new Chain(chain), 0.1)).toBe(false);
        expect(isChainClosed(new Chain(chain), 0.3)).toBe(true);
    });
});

describe('getChainEndPoint', () => {
    const createTestChain = (
        overrides: Partial<ChainData> = {}
    ): ChainData => ({
        id: 'test-chain',
        name: 'test-chain',
        shapes: [
            {
                id: 'line1',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 0, y: 0 },
                    end: { x: 10, y: 0 },
                } as Line,
            },
        ],
        ...overrides,
    });

    const createTestShape = (start: Point2D, end: Point2D): ShapeData => ({
        id: 'test-line',
        type: GeometryType.LINE,
        geometry: {
            start,
            end,
        } as Line,
    });

    it('should return end point of last shape in chain', () => {
        const chain = createTestChain({
            shapes: [
                createTestShape({ x: 0, y: 0 }, { x: 5, y: 0 }),
                createTestShape({ x: 5, y: 0 }, { x: 10, y: 5 }),
                createTestShape({ x: 10, y: 5 }, { x: 15, y: 10 }),
            ],
        });

        const endPoint = getChainEndPoint(new Chain(chain));

        expect(endPoint).toEqual({ x: 15, y: 10 });
    });

    it('should handle chain with single shape', () => {
        const chain = createTestChain({
            shapes: [createTestShape({ x: 2, y: 3 }, { x: 8, y: 7 })],
        });

        const endPoint = getChainEndPoint(new Chain(chain));

        expect(endPoint).toEqual({ x: 8, y: 7 });
    });

    it('should throw error for empty chain', () => {
        const chain = createTestChain({
            shapes: [],
        });

        expect(() => getChainEndPoint(new Chain(chain))).toThrow(
            'Chain has no shapes'
        );
    });

    it('should work with different shape types', () => {
        const arcShape: ShapeData = {
            id: 'arc1',
            type: GeometryType.ARC,
            geometry: {
                center: { x: 0, y: 0 },
                radius: 5,
                startAngle: 0,
                endAngle: Math.PI / 2,
                clockwise: true,
            },
        };

        const chain = createTestChain({
            shapes: [arcShape],
        });

        const endPoint = getChainEndPoint(new Chain(chain));

        // For an arc from 0 to π/2, end point should be (0, 5)
        expect(endPoint.x).toBeCloseTo(0);
        expect(endPoint.y).toBeCloseTo(5);
    });
});
