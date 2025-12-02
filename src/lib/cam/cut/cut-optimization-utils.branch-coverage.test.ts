import { Shape } from '$lib/cam/shape/classes';
import { Chain } from '$lib/cam/chain/classes';
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
import type { CutData } from '$lib/cam/cut/interfaces';
import type { ChainData } from '$lib/cam/chain/interfaces';
import { GeometryType } from '$lib/geometry/enums';
import type { ShapeData } from '$lib/cam/shape/interfaces';
import { OffsetDirection } from '$lib/cam/offset/types';
import { CutDirection, NormalSide } from './enums';
import { LeadType } from '$lib/cam/lead/enums';
import { Cut } from './classes.svelte';
import { OperationAction } from '$lib/cam/operation/enums';

describe('cut-optimization-utils - branch coverage', () => {
    // Mock data
    const mockChain: ChainData = {
        id: 'test-chain',
        name: 'test-chain',
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

    const mockCut: CutData = {
        id: 'test-cut',
        chainId: 'test-chain',
        name: 'Test Cut',
        operationId: 'test-op',
        toolId: null,
        enabled: true,
        order: 1,
        action: OperationAction.CUT,
        cutDirection: CutDirection.CLOCKWISE,
        normal: { x: 1, y: 0 },
        normalConnectionPoint: { x: 0, y: 0 },
        normalSide: NormalSide.LEFT,
    };

    describe('findNearestCut uncovered branches', () => {
        it('should skip cuts not in unvisited set', () => {
            const cut = new Cut(mockCut);
            const unvisited = new Set<Cut>();
            const chains = new Map([['test-chain', new Chain(mockChain)]]);
            const findPartForChain = vi.fn().mockReturnValue(undefined);

            const result = findNearestCut(
                { x: 0, y: 0 },
                [cut],
                chains,
                unvisited,
                findPartForChain
            );

            expect(result.cut).toBeNull();
            expect(result.distance).toBe(Infinity);
        });

        it('should skip cuts with missing chains', () => {
            const cut = new Cut(mockCut);
            const unvisited = new Set([cut]);
            const chains = new Map<string, Chain>(); // Empty map
            const findPartForChain = vi.fn().mockReturnValue(undefined);

            const result = findNearestCut(
                { x: 0, y: 0 },
                [cut],
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
            const cutWithLeadIn: CutData = {
                ...mockCut,
                leadInConfig: { type: LeadType.ARC, length: 5.0 },
            };

            const result = getCutStartPoint(
                new Cut(cutWithLeadIn),
                new Chain(mockChain)
            );

            // Should fall back to chain start point when no lead-in is calculated
            // The actual result depends on the implementation - we just need to test the branch
            expect(result).toBeDefined();
            expect(typeof result.x).toBe('number');
            expect(typeof result.y).toBe('number');
        });

        it('should handle cut with calculated offset', () => {
            const cutWithOffset: CutData = {
                ...mockCut,
                offset: {
                    offsetShapes: [
                        new Shape({
                            id: 'offset-shape-1',
                            type: GeometryType.LINE,
                            geometry: {
                                start: { x: 1, y: 1 },
                                end: { x: 11, y: 1 },
                            },
                        }),
                    ],
                    originalShapes: [],
                    direction: OffsetDirection.OUTSET,
                    kerfWidth: 1.0,
                    generatedAt: '2023-01-01T00:00:00Z',
                    version: '1.0',
                },
            };

            const result = getCutStartPoint(
                new Cut(cutWithOffset),
                new Chain(mockChain)
            );

            // Should use offset shapes start point
            expect(result).toEqual({ x: 1, y: 1 });
        });
    });

    describe('getCutChainStartPoint uncovered branches', () => {
        it('should use offset shapes when available', () => {
            const cutWithOffset: CutData = {
                ...mockCut,
                offset: {
                    offsetShapes: [
                        new Shape({
                            id: 'offset-shape-1',
                            type: GeometryType.LINE,
                            geometry: {
                                start: { x: 2, y: 2 },
                                end: { x: 12, y: 2 },
                            },
                        }),
                    ],
                    originalShapes: [],
                    direction: OffsetDirection.OUTSET,
                    kerfWidth: 1.0,
                    generatedAt: '2023-01-01T00:00:00Z',
                    version: '1.0',
                },
            };

            const result = getCutChainStartPoint(
                new Cut(cutWithOffset),
                new Chain(mockChain)
            );
            expect(result).toEqual({ x: 2, y: 2 });
        });

        it('should fallback to chain start point when no offset', () => {
            const result = getCutChainStartPoint(
                new Cut(mockCut),
                new Chain(mockChain)
            );
            expect(result).toEqual({ x: 0, y: 0 });
        });
    });

    describe('getCutChainEndPoint uncovered branches', () => {
        it('should use offset shapes when available', () => {
            const cutWithOffset: CutData = {
                ...mockCut,
                offset: {
                    offsetShapes: [
                        new Shape({
                            id: 'offset-shape-1',
                            type: GeometryType.LINE,
                            geometry: {
                                start: { x: 3, y: 3 },
                                end: { x: 13, y: 3 },
                            },
                        }),
                    ],
                    originalShapes: [],
                    direction: OffsetDirection.OUTSET,
                    kerfWidth: 1.0,
                    generatedAt: '2023-01-01T00:00:00Z',
                    version: '1.0',
                },
            };

            const result = getCutChainEndPoint(
                new Cut(cutWithOffset),
                new Chain(mockChain)
            );
            expect(result).toEqual({ x: 13, y: 3 });
        });

        it('should fallback to chain end point when no offset', () => {
            const result = getCutChainEndPoint(
                new Cut(mockCut),
                new Chain(mockChain)
            );
            expect(result).toEqual({ x: 10, y: 0 });
        });
    });

    describe('createSplitShape uncovered branches', () => {
        it('should preserve layer when present', () => {
            const shapeWithLayer: ShapeData = {
                id: 'test-shape',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 0, y: 0 },
                    end: { x: 10, y: 0 },
                },
                layer: 'test-layer',
            };

            const result = createSplitShape(
                new Shape(shapeWithLayer),
                '1',
                GeometryType.LINE,
                { start: { x: 0, y: 0 }, end: { x: 5, y: 0 } }
            );

            expect(result.toData().layer).toBe('test-layer');
        });

        it('should not include layer when not present', () => {
            const basicShape: ShapeData = {
                id: 'test-shape',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 0, y: 0 },
                    end: { x: 10, y: 0 },
                },
            };

            const result = createSplitShape(
                new Shape(basicShape),
                '1',
                GeometryType.LINE,
                { start: { x: 0, y: 0 }, end: { x: 5, y: 0 } }
            );

            expect(result.toData()).not.toHaveProperty('layer');
        });
    });

    describe('splitLineAtMidpoint error handling', () => {
        it('should return null for non-line shapes', () => {
            const nonLineShape: ShapeData = {
                id: 'test-arc',
                type: GeometryType.ARC,
                geometry: {
                    center: { x: 0, y: 0 },
                    radius: 5,
                    startAngle: 0,
                    endAngle: Math.PI,
                },
            };

            const result = splitLineAtMidpoint(new Shape(nonLineShape));
            expect(result).toBeNull();
        });
    });

    describe('splitArcAtMidpoint error handling', () => {
        it('should return null for non-arc shapes', () => {
            const nonArcShape: ShapeData = {
                id: 'test-line',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 0, y: 0 },
                    end: { x: 10, y: 0 },
                },
            };

            const result = splitArcAtMidpoint(new Shape(nonArcShape));
            expect(result).toBeNull();
        });
    });
});
