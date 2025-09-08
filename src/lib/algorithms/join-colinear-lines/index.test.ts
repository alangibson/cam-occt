import { describe, it, expect } from 'vitest';
import {
    joinColinearLinesInPolyline,
    joinColinearLinesInChains,
} from './index';
import type { Polyline, Shape, Line } from '../../types/geometry';
import { generateId } from '../../utils/id';
import type { Chain } from '../chain-detection/chain-detection';

describe('join-colinear-lines', () => {
    describe('joinColinearLinesInPolyline', () => {
        it('should join two collinear lines in a polyline', () => {
            const line1: Shape = {
                id: generateId(),
                type: 'line',
                geometry: {
                    start: { x: 0, y: 0 },
                    end: { x: 10, y: 0 },
                } as Line,
            };

            const line2: Shape = {
                id: generateId(),
                type: 'line',
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
            const line1: Shape = {
                id: generateId(),
                type: 'line',
                geometry: {
                    start: { x: 0, y: 0 },
                    end: { x: 5, y: 0 },
                } as Line,
            };

            const line2: Shape = {
                id: generateId(),
                type: 'line',
                geometry: {
                    start: { x: 5, y: 0 },
                    end: { x: 10, y: 0 },
                } as Line,
            };

            const line3: Shape = {
                id: generateId(),
                type: 'line',
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
            const line1: Shape = {
                id: generateId(),
                type: 'line',
                geometry: {
                    start: { x: 0, y: 0 },
                    end: { x: 10, y: 0 },
                } as Line,
            };

            const line2: Shape = {
                id: generateId(),
                type: 'line',
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
            const line1: Shape = {
                id: generateId(),
                type: 'line',
                geometry: {
                    start: { x: 0, y: 0 },
                    end: { x: 10, y: 0 },
                } as Line,
            };

            const arc: Shape = {
                id: generateId(),
                type: 'arc',
                geometry: {
                    center: { x: 15, y: 0 },
                    radius: 5,
                    startAngle: 0,
                    endAngle: Math.PI / 2,
                    clockwise: false,
                },
            };

            const line2: Shape = {
                id: generateId(),
                type: 'line',
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
            const line1: Shape = {
                id: generateId(),
                type: 'line',
                geometry: {
                    start: { x: 0, y: 0 },
                    end: { x: 10, y: 0 },
                } as Line,
            };

            const line2: Shape = {
                id: generateId(),
                type: 'line',
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
            const line1: Shape = {
                id: generateId(),
                type: 'line',
                geometry: {
                    start: { x: 0, y: 0 },
                    end: { x: 10, y: 0 },
                } as Line,
            };

            const line2: Shape = {
                id: generateId(),
                type: 'line',
                geometry: {
                    start: { x: 10, y: 0 },
                    end: { x: 20, y: 0.01 }, // Slight deviation
                } as Line,
            };

            const line3: Shape = {
                id: generateId(),
                type: 'line',
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
            const line1: Shape = {
                id: generateId(),
                type: 'line',
                geometry: {
                    start: { x: 0, y: 0 },
                    end: { x: 10, y: 0 },
                } as Line,
            };

            const line2: Shape = {
                id: generateId(),
                type: 'line',
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
            const line1: Shape = {
                id: generateId(),
                type: 'line',
                geometry: {
                    start: { x: 0, y: 0 },
                    end: { x: 10, y: 0 },
                } as Line,
            };

            const line2: Shape = {
                id: generateId(),
                type: 'line',
                geometry: {
                    start: { x: 10, y: 0 },
                    end: { x: 20, y: 0 },
                } as Line,
            };

            const chain: Chain = {
                id: 'test-chain',
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
            const chain1: Chain = {
                id: 'chain-1',
                shapes: [
                    {
                        id: generateId(),
                        type: 'line',
                        geometry: {
                            start: { x: 0, y: 0 },
                            end: { x: 10, y: 0 },
                        } as Line,
                    },
                    {
                        id: generateId(),
                        type: 'line',
                        geometry: {
                            start: { x: 10, y: 0 },
                            end: { x: 20, y: 0 },
                        } as Line,
                    },
                ],
            };

            const chain2: Chain = {
                id: 'chain-2',
                shapes: [
                    {
                        id: generateId(),
                        type: 'line',
                        geometry: {
                            start: { x: 0, y: 10 },
                            end: { x: 5, y: 10 },
                        } as Line,
                    },
                    {
                        id: generateId(),
                        type: 'line',
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
            const polylineShape: Shape = {
                id: generateId(),
                type: 'polyline',
                geometry: {
                    closed: false,
                    shapes: [
                        {
                            id: generateId(),
                            type: 'line',
                            geometry: {
                                start: { x: 0, y: 0 },
                                end: { x: 10, y: 0 },
                            } as Line,
                        },
                        {
                            id: generateId(),
                            type: 'line',
                            geometry: {
                                start: { x: 10, y: 0 },
                                end: { x: 20, y: 0 },
                            } as Line,
                        },
                    ],
                } as Polyline,
            };

            const chain: Chain = {
                id: 'test-chain',
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
            const chain: Chain = {
                id: 'test-chain',
                shapes: [
                    {
                        id: generateId(),
                        type: 'circle',
                        geometry: { center: { x: 0, y: 0 }, radius: 5 },
                    },
                    {
                        id: generateId(),
                        type: 'arc',
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
});
