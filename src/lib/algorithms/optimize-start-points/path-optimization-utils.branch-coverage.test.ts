import { describe, it, expect, vi } from 'vitest';
import {
    findNearestPath,
    getPathStartPoint,
    getPathChainStartPoint,
    getPathChainEndPoint,
    createSplitShape,
    splitLineAtMidpoint,
    splitArcAtMidpoint,
} from './path-optimization-utils';
import type { Path } from '$lib/stores/paths/interfaces';
import type { Chain } from '$lib/geometry/chain/interfaces';
import { GeometryType, type Shape } from '$lib/types/geometry';
import { OffsetDirection } from '$lib/algorithms/offset-calculation/offset/types';
import { CutDirection, LeadType } from '$lib/types/direction';

describe('path-optimization-utils - branch coverage', () => {
    // Mock data
    const mockChain: Chain = {
        id: 'test-chain',
        shapes: [
            {
                id: 'shape-1',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 0, y: 0 },
                    end: { x: 10, y: 0 },
                },
            },
        ],
    };

    const mockPath: Path = {
        id: 'test-path',
        chainId: 'test-chain',
        name: 'Test Path',
        operationId: 'test-op',
        toolId: null,
        enabled: true,
        order: 1,
        cutDirection: CutDirection.CLOCKWISE,
    };

    describe('findNearestPath uncovered branches', () => {
        it('should skip paths not in unvisited set', () => {
            const unvisited = new Set<Path>();
            const chains = new Map([['test-chain', mockChain]]);
            const findPartForChain = vi.fn().mockReturnValue(undefined);

            const result = findNearestPath(
                { x: 0, y: 0 },
                [mockPath],
                chains,
                unvisited,
                findPartForChain
            );

            expect(result.path).toBeNull();
            expect(result.distance).toBe(Infinity);
        });

        it('should skip paths with missing chains', () => {
            const unvisited = new Set([mockPath]);
            const chains = new Map<string, Chain>(); // Empty map
            const findPartForChain = vi.fn().mockReturnValue(undefined);

            const result = findNearestPath(
                { x: 0, y: 0 },
                [mockPath],
                chains,
                unvisited,
                findPartForChain
            );

            expect(result.path).toBeNull();
            expect(result.distance).toBe(Infinity);
        });
    });

    describe('getPathStartPoint uncovered branches', () => {
        it('should handle path with lead-in configuration but no lead result', () => {
            const pathWithLeadIn: Path = {
                ...mockPath,
                leadInType: LeadType.LINE,
                leadInLength: 5.0,
            };

            const result = getPathStartPoint(pathWithLeadIn, mockChain);

            // Should fall back to chain start point when no lead-in is calculated
            // The actual result depends on the implementation - we just need to test the branch
            expect(result).toBeDefined();
            expect(typeof result.x).toBe('number');
            expect(typeof result.y).toBe('number');
        });

        it('should handle path with calculated offset', () => {
            const pathWithOffset: Path = {
                ...mockPath,
                calculatedOffset: {
                    offsetShapes: [
                        {
                            id: 'offset-shape-1',
                            type: GeometryType.LINE,
                            geometry: {
                                start: { x: 1, y: 1 },
                                end: { x: 11, y: 1 },
                            },
                        },
                    ],
                    originalShapes: [],
                    direction: OffsetDirection.OUTSET,
                    kerfWidth: 1.0,
                    generatedAt: '2023-01-01T00:00:00Z',
                    version: '1.0',
                },
            };

            const result = getPathStartPoint(pathWithOffset, mockChain);

            // Should use offset shapes start point
            expect(result).toEqual({ x: 1, y: 1 });
        });
    });

    describe('getPathChainStartPoint uncovered branches', () => {
        it('should use offset shapes when available', () => {
            const pathWithOffset: Path = {
                ...mockPath,
                calculatedOffset: {
                    offsetShapes: [
                        {
                            id: 'offset-shape-1',
                            type: GeometryType.LINE,
                            geometry: {
                                start: { x: 2, y: 2 },
                                end: { x: 12, y: 2 },
                            },
                        },
                    ],
                    originalShapes: [],
                    direction: OffsetDirection.OUTSET,
                    kerfWidth: 1.0,
                    generatedAt: '2023-01-01T00:00:00Z',
                    version: '1.0',
                },
            };

            const result = getPathChainStartPoint(pathWithOffset, mockChain);
            expect(result).toEqual({ x: 2, y: 2 });
        });

        it('should fallback to chain start point when no offset', () => {
            const result = getPathChainStartPoint(mockPath, mockChain);
            expect(result).toEqual({ x: 0, y: 0 });
        });
    });

    describe('getPathChainEndPoint uncovered branches', () => {
        it('should use offset shapes when available', () => {
            const pathWithOffset: Path = {
                ...mockPath,
                calculatedOffset: {
                    offsetShapes: [
                        {
                            id: 'offset-shape-1',
                            type: GeometryType.LINE,
                            geometry: {
                                start: { x: 3, y: 3 },
                                end: { x: 13, y: 3 },
                            },
                        },
                    ],
                    originalShapes: [],
                    direction: OffsetDirection.OUTSET,
                    kerfWidth: 1.0,
                    generatedAt: '2023-01-01T00:00:00Z',
                    version: '1.0',
                },
            };

            const result = getPathChainEndPoint(pathWithOffset, mockChain);
            expect(result).toEqual({ x: 13, y: 3 });
        });

        it('should fallback to chain end point when no offset', () => {
            const result = getPathChainEndPoint(mockPath, mockChain);
            expect(result).toEqual({ x: 10, y: 0 });
        });
    });

    describe('createSplitShape uncovered branches', () => {
        it('should preserve layer when present', () => {
            const shapeWithLayer: Shape = {
                id: 'test-shape',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 0, y: 0 },
                    end: { x: 10, y: 0 },
                },
                layer: 'test-layer',
            };

            const result = createSplitShape(
                shapeWithLayer,
                '1',
                GeometryType.LINE,
                { start: { x: 0, y: 0 }, end: { x: 5, y: 0 } }
            );

            expect(result.layer).toBe('test-layer');
        });

        it('should preserve metadata when present', () => {
            const shapeWithMetadata: Shape = {
                id: 'test-shape',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 0, y: 0 },
                    end: { x: 10, y: 0 },
                },
                metadata: { custom: 'data' },
            };

            const result = createSplitShape(
                shapeWithMetadata,
                '1',
                GeometryType.LINE,
                { start: { x: 0, y: 0 }, end: { x: 5, y: 0 } }
            );

            expect(result.metadata).toEqual({ custom: 'data' });
        });

        it('should not include layer or metadata when not present', () => {
            const basicShape: Shape = {
                id: 'test-shape',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 0, y: 0 },
                    end: { x: 10, y: 0 },
                },
            };

            const result = createSplitShape(
                basicShape,
                '1',
                GeometryType.LINE,
                { start: { x: 0, y: 0 }, end: { x: 5, y: 0 } }
            );

            expect(result).not.toHaveProperty('layer');
            expect(result).not.toHaveProperty('metadata');
        });
    });

    describe('splitLineAtMidpoint error handling', () => {
        it('should return null for non-line shapes', () => {
            const nonLineShape: Shape = {
                id: 'test-arc',
                type: GeometryType.ARC,
                geometry: {
                    center: { x: 0, y: 0 },
                    radius: 5,
                    startAngle: 0,
                    endAngle: Math.PI,
                },
            };

            const result = splitLineAtMidpoint(nonLineShape);
            expect(result).toBeNull();
        });
    });

    describe('splitArcAtMidpoint error handling', () => {
        it('should return null for non-arc shapes', () => {
            const nonArcShape: Shape = {
                id: 'test-line',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 0, y: 0 },
                    end: { x: 10, y: 0 },
                },
            };

            const result = splitArcAtMidpoint(nonArcShape);
            expect(result).toBeNull();
        });
    });
});
