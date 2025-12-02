import { describe, expect, it } from 'vitest';
import {
    arePointsCollinear,
    joinColinearLinesInChains,
    joinColinearLinesInPolyline,
} from './index';
import { GeometryType } from '$lib/geometry/enums';
import type { Line } from '$lib/geometry/line/interfaces';
import type { Polyline } from '$lib/geometry/polyline/interfaces';
import type { ShapeData } from '$lib/cam/shape/interfaces';
import { generateId } from '$lib/domain/id';
import type { ChainData } from '$lib/cam/chain/interfaces';

describe('join-colinear-lines', () => {
    describe('joinColinearLinesInPolyline', () => {
        it('should join two collinear lines in a polyline', () => {
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

            const polyline: Polyline = {
                closed: false,
                shapes: [line1, line2],
            };

            const result = joinColinearLinesInPolyline(polyline, 0.1);

            expect(result.shapes).toHaveLength(1);
            expect(result.shapes[0].type).toBe('line');
            const joinedGeometry = result.shapes[0].geometry as Line;
            expect(joinedGeometry.start).toEqual({ x: 0, y: 0 });
            expect(joinedGeometry.end).toEqual({ x: 20, y: 0 });
        });

        it('should join three collinear lines in a polyline', () => {
            const line1: ShapeData = {
                id: generateId(),
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 0, y: 0 },
                    end: { x: 5, y: 0 },
                } as Line,
            };

            const line2: ShapeData = {
                id: generateId(),
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 5, y: 0 },
                    end: { x: 10, y: 0 },
                } as Line,
            };

            const line3: ShapeData = {
                id: generateId(),
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 10, y: 0 },
                    end: { x: 15, y: 0 },
                } as Line,
            };

            const polyline: Polyline = {
                closed: false,
                shapes: [line1, line2, line3],
            };

            const result = joinColinearLinesInPolyline(polyline, 0.1);

            expect(result.shapes).toHaveLength(1);
            const joinedGeometry = result.shapes[0].geometry as Line;
            expect(joinedGeometry.start).toEqual({ x: 0, y: 0 });
            expect(joinedGeometry.end).toEqual({ x: 15, y: 0 });
        });

        it('should not join non-collinear lines', () => {
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
                    end: { x: 15, y: 5 },
                } as Line,
            };

            const polyline: Polyline = {
                closed: false,
                shapes: [line1, line2],
            };

            const result = joinColinearLinesInPolyline(polyline, 0.1);

            expect(result.shapes).toHaveLength(2);
            expect(result.shapes[0]).toEqual(line1);
            expect(result.shapes[1]).toEqual(line2);
        });

        it('should preserve non-line shapes', () => {
            const line1: ShapeData = {
                id: generateId(),
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 0, y: 0 },
                    end: { x: 10, y: 0 },
                } as Line,
            };

            const arc: ShapeData = {
                id: generateId(),
                type: GeometryType.ARC,
                geometry: {
                    center: { x: 15, y: 0 },
                    radius: 5,
                    startAngle: 0,
                    endAngle: Math.PI / 2,
                    clockwise: false,
                },
            };

            const line2: ShapeData = {
                id: generateId(),
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 20, y: 0 },
                    end: { x: 30, y: 0 },
                } as Line,
            };

            const polyline: Polyline = {
                closed: false,
                shapes: [line1, arc, line2],
            };

            const result = joinColinearLinesInPolyline(polyline, 0.1);

            expect(result.shapes).toHaveLength(3);
            expect(result.shapes[0]).toEqual(line1);
            expect(result.shapes[1]).toEqual(arc);
            expect(result.shapes[2]).toEqual(line2);
        });

        it('should handle empty polyline', () => {
            const polyline: Polyline = {
                closed: false,
                shapes: [],
            };

            const result = joinColinearLinesInPolyline(polyline, 0.1);

            expect(result.shapes).toHaveLength(0);
            expect(result).toEqual(polyline);
        });

        it('should respect tolerance for near-collinear lines', () => {
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
                    end: { x: 20, y: 0.01 }, // Slightly off collinear
                } as Line,
            };

            const polyline: Polyline = {
                closed: false,
                shapes: [line1, line2],
            };

            // Should join with loose tolerance
            const resultLoose = joinColinearLinesInPolyline(polyline, 0.1);
            expect(resultLoose.shapes).toHaveLength(1);

            // Should not join with tight tolerance
            const resultTight = joinColinearLinesInPolyline(polyline, 0.001);
            expect(resultTight.shapes).toHaveLength(2);
        });

        it('should not be too aggressive - check tolerance against start segment for all joined segments', () => {
            // Create three lines where line1-line2 is collinear, but line3 deviates too much from line1
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
                    end: { x: 20, y: 0.01 }, // Slight deviation
                } as Line,
            };

            const line3: ShapeData = {
                id: generateId(),
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 20, y: 0.01 },
                    end: { x: 30, y: 0.2 }, // Too much total deviation from line1
                } as Line,
            };

            const polyline: Polyline = {
                closed: false,
                shapes: [line1, line2, line3],
            };

            // With tolerance 0.1, line3 should be rejected because its deviation from line1 is too large
            const result = joinColinearLinesInPolyline(polyline, 0.1);

            // Should have 2 shapes: line1+line2 joined, and line3 separate
            expect(result.shapes).toHaveLength(2);

            // First shape should be the joined line1+line2
            const joinedGeometry = result.shapes[0].geometry as Line;
            expect(joinedGeometry.start).toEqual({ x: 0, y: 0 });
            expect(joinedGeometry.end.x).toBeCloseTo(20, 5);
            expect(joinedGeometry.end.y).toBeCloseTo(0.01, 5);

            // Second shape should be line3 unchanged
            expect(result.shapes[1]).toEqual(line3);
        });

        it('should handle lines in reverse direction', () => {
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
                    start: { x: 20, y: 0 },
                    end: { x: 10, y: 0 }, // Reversed direction but collinear
                } as Line,
            };

            const polyline: Polyline = {
                closed: false,
                shapes: [line1, line2],
            };

            const result = joinColinearLinesInPolyline(polyline, 0.1);

            expect(result.shapes).toHaveLength(1);
            const joinedGeometry = result.shapes[0].geometry as Line;
            // Should span the full range regardless of direction
            expect(
                (joinedGeometry.start.x === 0 && joinedGeometry.end.x === 20) ||
                    (joinedGeometry.start.x === 20 &&
                        joinedGeometry.end.x === 0)
            ).toBe(true);
        });
    });

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

            const chain: ChainData = {
                id: 'test-chain',
                name: 'test-chain',
                shapes: [line1, line2],
            };

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
            const chain1: ChainData = {
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

            const chain2: ChainData = {
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

        it('should handle chains with polylines containing collinear lines', () => {
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
                } as Polyline,
            };

            const chain: ChainData = {
                id: 'test-chain',
                name: 'test-chain',
                shapes: [polylineShape],
            };

            const result = joinColinearLinesInChains([chain], 0.1);

            expect(result).toHaveLength(1);
            expect(result[0].shapes).toHaveLength(1);
            expect(result[0].shapes[0].type).toBe('polyline');

            const resultPolyline = result[0].shapes[0].geometry as Polyline;
            expect(resultPolyline.shapes).toHaveLength(1);

            const joinedLine = resultPolyline.shapes[0].geometry as Line;
            expect(joinedLine.start).toEqual({ x: 0, y: 0 });
            expect(joinedLine.end).toEqual({ x: 20, y: 0 });
        });

        it('should handle empty chains array', () => {
            const result = joinColinearLinesInChains([], 0.1);
            expect(result).toHaveLength(0);
        });

        it('should preserve chain with no collinear lines', () => {
            const chain: ChainData = {
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

            const result = joinColinearLinesInChains([chain], 0.1);

            expect(result).toHaveLength(1);
            expect(result[0]).toEqual(chain);
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
