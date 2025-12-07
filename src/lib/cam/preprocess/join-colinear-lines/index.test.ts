import { describe, expect, it } from 'vitest';
import { arePointsCollinear, joinColinearLinesInChains } from './index';
import { GeometryType } from '$lib/geometry/enums';
import type { Line } from '$lib/geometry/line/interfaces';
import type { ShapeData } from '$lib/cam/shape/interfaces';
import { generateId } from '$lib/domain/id';
import type { ChainData } from '$lib/cam/chain/interfaces';
import { Chain } from '$lib/cam/chain/classes.svelte';

describe('join-colinear-lines', () => {
    describe('joinColinearLinesInChains', () => {
        it('should join collinear lines in a simple chain', () => {
            const line1: ShapeData = {
                id: generateId(),
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 0, y: 0 },
                    end: { x: 10, y: 0 },
                } as Line,
            };

            const line2: ShapeData = {
                id: generateId(),
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 10, y: 0 },
                    end: { x: 20, y: 0 },
                } as Line,
            };

            const chainData: ChainData = {
                id: 'test-chain',
                name: 'test-chain',
                shapes: [line1, line2],
            };
            const chain = new Chain(chainData);

            const result = joinColinearLinesInChains([chain], 0.1);

            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('test-chain');
            expect(result[0].shapes).toHaveLength(1);
            expect(result[0].shapes[0].type).toBe('line');

            const joinedGeometry = result[0].shapes[0].geometry as Line;
            expect(joinedGeometry.start).toEqual({ x: 0, y: 0 });
            expect(joinedGeometry.end).toEqual({ x: 20, y: 0 });
        });

        it('should handle multiple chains independently', () => {
            const chain1Data: ChainData = {
                id: 'chain-1',
                name: 'chain-1',
                shapes: [
                    {
                        id: generateId(),
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 0, y: 0 },
                            end: { x: 10, y: 0 },
                        } as Line,
                    },
                    {
                        id: generateId(),
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 10, y: 0 },
                            end: { x: 20, y: 0 },
                        } as Line,
                    },
                ],
            };
            const chain1 = new Chain(chain1Data);

            const chain2Data: ChainData = {
                id: 'chain-2',
                name: 'chain-2',
                shapes: [
                    {
                        id: generateId(),
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 0, y: 10 },
                            end: { x: 5, y: 10 },
                        } as Line,
                    },
                    {
                        id: generateId(),
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 5, y: 10 },
                            end: { x: 10, y: 10 },
                        } as Line,
                    },
                ],
            };
            const chain2 = new Chain(chain2Data);

            const result = joinColinearLinesInChains([chain1, chain2], 0.1);

            expect(result).toHaveLength(2);
            expect(result[0].shapes).toHaveLength(1);
            expect(result[1].shapes).toHaveLength(1);

            const chain1Joined = result[0].shapes[0].geometry as Line;
            const chain2Joined = result[1].shapes[0].geometry as Line;

            expect(chain1Joined.start).toEqual({ x: 0, y: 0 });
            expect(chain1Joined.end).toEqual({ x: 20, y: 0 });

            expect(chain2Joined.start).toEqual({ x: 0, y: 10 });
            expect(chain2Joined.end).toEqual({ x: 10, y: 10 });
        });

        it('should pass through polylines unchanged', () => {
            const polylineShape: ShapeData = {
                id: generateId(),
                type: GeometryType.POLYLINE,
                geometry: {
                    closed: false,
                    shapes: [
                        {
                            id: generateId(),
                            type: GeometryType.LINE,
                            geometry: {
                                start: { x: 0, y: 0 },
                                end: { x: 10, y: 0 },
                            } as Line,
                        },
                        {
                            id: generateId(),
                            type: GeometryType.LINE,
                            geometry: {
                                start: { x: 10, y: 0 },
                                end: { x: 20, y: 0 },
                            } as Line,
                        },
                    ],
                },
            };

            const chainData: ChainData = {
                id: 'test-chain',
                name: 'test-chain',
                shapes: [polylineShape],
            };
            const chain = new Chain(chainData);

            const result = joinColinearLinesInChains([chain], 0.1);

            expect(result).toHaveLength(1);
            expect(result[0].shapes).toHaveLength(1);
            expect(result[0].shapes[0].toData()).toEqual(polylineShape);
        });

        it('should handle empty chains array', () => {
            const result = joinColinearLinesInChains([], 0.1);
            expect(result).toHaveLength(0);
        });

        it('should preserve chain with no collinear lines', () => {
            const chainData: ChainData = {
                id: 'test-chain',
                name: 'test-chain',
                shapes: [
                    {
                        id: generateId(),
                        type: GeometryType.CIRCLE,
                        geometry: { center: { x: 0, y: 0 }, radius: 5 },
                    },
                    {
                        id: generateId(),
                        type: GeometryType.ARC,
                        geometry: {
                            center: { x: 10, y: 0 },
                            radius: 5,
                            startAngle: 0,
                            endAngle: Math.PI,
                            clockwise: false,
                        },
                    },
                ],
            };
            const chain = new Chain(chainData);

            const result = joinColinearLinesInChains([chain], 0.1);

            expect(result).toHaveLength(1);
            expect(result[0].toData()).toEqual(chainData);
        });
    });

    describe('arePointsCollinear', () => {
        it('should detect perfectly collinear horizontal points', () => {
            const p1 = { x: 0, y: 0 };
            const p2 = { x: 5, y: 0 };
            const p3 = { x: 10, y: 0 };

            expect(arePointsCollinear(p1, p2, p3, 0.01)).toBe(true);
        });

        it('should detect perfectly collinear vertical points', () => {
            const p1 = { x: 0, y: 0 };
            const p2 = { x: 0, y: 5 };
            const p3 = { x: 0, y: 10 };

            expect(arePointsCollinear(p1, p2, p3, 0.01)).toBe(true);
        });

        it('should detect perfectly collinear diagonal points', () => {
            const p1 = { x: 0, y: 0 };
            const p2 = { x: 3, y: 4 };
            const p3 = { x: 6, y: 8 };

            expect(arePointsCollinear(p1, p2, p3, 0.01)).toBe(true);
        });

        it('should reject non-collinear points', () => {
            const p1 = { x: 0, y: 0 };
            const p2 = { x: 5, y: 0 };
            const p3 = { x: 10, y: 5 };

            expect(arePointsCollinear(p1, p2, p3, 0.01)).toBe(false);
        });

        it('should handle near-collinear points within tolerance', () => {
            const p1 = { x: 0, y: 0 };
            const p2 = { x: 5, y: 0 };
            const p3 = { x: 10, y: 0.005 }; // Slightly off horizontal

            // Cross product = |(5-0)*(0.005-0) - (0-0)*(10-0)| = |5*0.005 - 0*10| = 0.025
            expect(arePointsCollinear(p1, p2, p3, 0.03)).toBe(true);
            expect(arePointsCollinear(p1, p2, p3, 0.01)).toBe(false);
        });

        it('should handle identical points', () => {
            const p1 = { x: 5, y: 5 };
            const p2 = { x: 5, y: 5 };
            const p3 = { x: 5, y: 5 };

            expect(arePointsCollinear(p1, p2, p3, 0.01)).toBe(true);
        });

        it('should handle negative coordinates', () => {
            const p1 = { x: -10, y: -5 };
            const p2 = { x: -5, y: -2.5 };
            const p3 = { x: 0, y: 0 };

            expect(arePointsCollinear(p1, p2, p3, 0.01)).toBe(true);
        });

        it('should use correct tolerance threshold', () => {
            const p1 = { x: 0, y: 0 };
            const p2 = { x: 10, y: 0 };
            const p3 = { x: 20, y: 1 };

            // Cross product = |0*1 - 0*20| = 0, but actually:
            // Cross product = |(10-0)*(1-0) - (0-0)*(20-0)| = |10*1 - 0*20| = 10
            expect(arePointsCollinear(p1, p2, p3, 15)).toBe(true);
            expect(arePointsCollinear(p1, p2, p3, 5)).toBe(false);
        });
    });
});
