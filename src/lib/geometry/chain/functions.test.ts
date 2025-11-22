import {
    calculateChainArea,
    getChainEndPoint,
    isChainClosed,
    isChainContainedInChain,
} from '$lib/geometry/chain/functions';
import type { Line } from '$lib/geometry/line/interfaces';
import { GeometryType } from '$lib/geometry/shape/enums';
import { describe, expect, it } from 'vitest';
import type { Point2D } from '$lib/geometry/point/interfaces';
import type { ShapeData } from '$lib/geometry/shape/interfaces';
import { DEFAULT_PART_DETECTION_PARAMETERS } from '$lib/cam/part/defaults';
import type { ChainData } from './interfaces';

// Helper function to create test chains
function createTestChain(id: string, shapes: ShapeData[]): ChainData {
    return {
        id,
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

        expect(isChainClosed(chain, 0.1)).toBe(true);
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

        expect(isChainClosed(chain, 0.1)).toBe(false);
    });

    it('should return false for empty chain', () => {
        const chain = createTestChain('test', []);

        expect(isChainClosed(chain, 0.1)).toBe(false);
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

        expect(isChainClosed(chain, 0.1)).toBe(false);
        expect(isChainClosed(chain, 0.3)).toBe(true);
    });
});

describe('calculateChainArea', () => {
    it('should calculate area for closed rectangular chain', () => {
        const shapes = createRectangle(0, 0, 10, 10);
        const chain = createTestChain('test', shapes);

        const area = calculateChainArea(chain, 0.1);
        expect(area).toBeCloseTo(100, 1);
    });

    it('should return 0 for open chain', () => {
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

        expect(calculateChainArea(chain, 0.1)).toBe(0);
    });

    it('should return 0 for chain with less than 3 points', () => {
        const shapes: ShapeData[] = [
            {
                id: '1',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 0, y: 0 },
                    end: { x: 10, y: 0 },
                } as Line,
            },
        ];
        const chain = createTestChain('test', shapes);

        expect(calculateChainArea(chain, 0.1)).toBe(0);
    });

    it('should handle custom parameters', () => {
        const shapes = createRectangle(0, 0, 10, 10);
        const chain = createTestChain('test', shapes);
        const customParams = {
            ...DEFAULT_PART_DETECTION_PARAMETERS,
            decimalPrecision: 4,
        };

        const area = calculateChainArea(chain, 0.1, customParams);
        expect(area).toBeCloseTo(100, 1);
    });
});

describe('isChainContainedInChain', () => {
    it('should detect small rectangle contained in large rectangle', () => {
        const innerShapes = createRectangle(2, 2, 6, 6);
        const outerShapes = createRectangle(0, 0, 10, 10);
        const innerChain = createTestChain('inner', innerShapes);
        const outerChain = createTestChain('outer', outerShapes);

        expect(isChainContainedInChain(innerChain, outerChain, 0.1)).toBe(true);
    });

    it('should return false when outer chain is not closed', () => {
        const innerShapes: ShapeData[] = createRectangle(2, 2, 6, 6);
        const outerShapes: ShapeData[] = [
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
        const innerChain = createTestChain('inner', innerShapes);
        const outerChain = createTestChain('outer', outerShapes);

        expect(isChainContainedInChain(innerChain, outerChain, 0.1)).toBe(
            false
        );
    });

    it('should handle open inner chain (linestring)', () => {
        const innerShapes: ShapeData[] = [
            {
                id: '1',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 2, y: 2 },
                    end: { x: 8, y: 2 },
                } as Line,
            },
            {
                id: '2',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 8, y: 2 },
                    end: { x: 8, y: 8 },
                } as Line,
            },
        ];
        const outerShapes = createRectangle(0, 0, 10, 10);
        const innerChain = createTestChain('inner', innerShapes);
        const outerChain = createTestChain('outer', outerShapes);

        expect(isChainContainedInChain(innerChain, outerChain, 0.1)).toBe(true);
    });

    it('should handle error cases gracefully', () => {
        // Create chains that might cause JSTS errors
        const problematicShapes: ShapeData[] = [
            {
                id: '1',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 0, y: 0 },
                    end: { x: 0, y: 0 },
                } as Line,
            }, // Zero-length line
        ];
        const outerShapes = createRectangle(0, 0, 10, 10);
        const innerChain = createTestChain('inner', problematicShapes);
        const outerChain = createTestChain('outer', outerShapes);

        // Should not throw and should return false
        expect(isChainContainedInChain(innerChain, outerChain, 0.1)).toBe(
            false
        );
    });
});

describe('getChainEndPoint', () => {
    const createTestChain = (
        overrides: Partial<ChainData> = {}
    ): ChainData => ({
        id: 'test-chain',
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

        const endPoint = getChainEndPoint(chain);

        expect(endPoint).toEqual({ x: 15, y: 10 });
    });

    it('should handle chain with single shape', () => {
        const chain = createTestChain({
            shapes: [createTestShape({ x: 2, y: 3 }, { x: 8, y: 7 })],
        });

        const endPoint = getChainEndPoint(chain);

        expect(endPoint).toEqual({ x: 8, y: 7 });
    });

    it('should throw error for empty chain', () => {
        const chain = createTestChain({
            shapes: [],
        });

        expect(() => getChainEndPoint(chain)).toThrow('Chain has no shapes');
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

        const endPoint = getChainEndPoint(chain);

        // For an arc from 0 to π/2, end point should be (0, 5)
        expect(endPoint.x).toBeCloseTo(0);
        expect(endPoint.y).toBeCloseTo(5);
    });
});
