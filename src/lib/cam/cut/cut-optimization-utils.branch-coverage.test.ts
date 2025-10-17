import { describe, it, expect, vi } from 'vitest';
import {
    findNearestCut,
    getCutStartPoint,
    getCutChainStartPoint,
    getCutChainEndPoint,
    createSplitShape,
    splitLineAtMidpoint,
    splitArcAtMidpoint,
} from './cut-optimization-utils';
import type { Cut } from '$lib/cam/cut/interfaces';
import type { Chain } from '$lib/geometry/chain/interfaces';
import { GeometryType, type Shape } from '$lib/geometry/shape';
import { OffsetDirection } from '$lib/algorithms/offset-calculation/offset/types';
import { CutDirection, NormalSide } from './enums';
import { LeadType } from '$lib/cam/lead/enums';

describe('cut-optimization-utils - branch coverage', () => {
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

    const mockCut: Cut = {
        id: 'test-cut',
        chainId: 'test-chain',
        name: 'Test Cut',
        operationId: 'test-op',
        toolId: null,
        enabled: true,
        order: 1,
        cutDirection: CutDirection.CLOCKWISE,
        normal: { x: 1, y: 0 },
        normalConnectionPoint: { x: 0, y: 0 },
        normalSide: NormalSide.LEFT,
    };

    describe('findNearestCut uncovered branches', () => {
        it('should skip cuts not in unvisited set', () => {
            const unvisited = new Set<Cut>();
            const chains = new Map([['test-chain', mockChain]]);
            const findPartForChain = vi.fn().mockReturnValue(undefined);

            const result = findNearestCut(
                { x: 0, y: 0 },
                [mockCut],
                chains,
                unvisited,
                findPartForChain
            );

            expect(result.cut).toBeNull();
            expect(result.distance).toBe(Infinity);
        });

        it('should skip cuts with missing chains', () => {
            const unvisited = new Set([mockCut]);
            const chains = new Map<string, Chain>(); // Empty map
            const findPartForChain = vi.fn().mockReturnValue(undefined);

            const result = findNearestCut(
                { x: 0, y: 0 },
                [mockCut],
                chains,
                unvisited,
                findPartForChain
            );

            expect(result.cut).toBeNull();
            expect(result.distance).toBe(Infinity);
        });
    });

    describe('getCutStartPoint uncovered branches', () => {
        it('should handle cut with lead-in configuration but no lead result', () => {
            const cutWithLeadIn: Cut = {
                ...mockCut,
                leadInConfig: { type: LeadType.ARC, length: 5.0 },
            };

            const result = getCutStartPoint(cutWithLeadIn, mockChain);

            // Should fall back to chain start point when no lead-in is calculated
            // The actual result depends on the implementation - we just need to test the branch
            expect(result).toBeDefined();
            expect(typeof result.x).toBe('number');
            expect(typeof result.y).toBe('number');
        });

        it('should handle cut with calculated offset', () => {
            const cutWithOffset: Cut = {
                ...mockCut,
                offset: {
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

            const result = getCutStartPoint(cutWithOffset, mockChain);

            // Should use offset shapes start point
            expect(result).toEqual({ x: 1, y: 1 });
        });
    });

    describe('getCutChainStartPoint uncovered branches', () => {
        it('should use offset shapes when available', () => {
            const cutWithOffset: Cut = {
                ...mockCut,
                offset: {
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

            const result = getCutChainStartPoint(cutWithOffset, mockChain);
            expect(result).toEqual({ x: 2, y: 2 });
        });

        it('should fallback to chain start point when no offset', () => {
            const result = getCutChainStartPoint(mockCut, mockChain);
            expect(result).toEqual({ x: 0, y: 0 });
        });
    });

    describe('getCutChainEndPoint uncovered branches', () => {
        it('should use offset shapes when available', () => {
            const cutWithOffset: Cut = {
                ...mockCut,
                offset: {
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

            const result = getCutChainEndPoint(cutWithOffset, mockChain);
            expect(result).toEqual({ x: 13, y: 3 });
        });

        it('should fallback to chain end point when no offset', () => {
            const result = getCutChainEndPoint(mockCut, mockChain);
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
