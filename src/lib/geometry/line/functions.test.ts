import { describe, expect, it } from 'vitest';
import {
    onSegment,
    doLineSegmentsIntersect,
    calculateLineParameterForPoint,
    isParameterValidForSegment,
    calculateLineIntersection,
    calculateLineDirectionAndLength,
} from './functions';
import type { Line } from './interfaces';
import type { Point2D } from '$lib/types/geometry';
import { EPSILON } from '$lib/geometry/math';

describe('line functions additional coverage tests', () => {
    describe('onSegment - uncovered branches', () => {
        it('should handle point outside Y bounds while inside X bounds', () => {
            const p: Point2D = { x: 0, y: 0 };
            const r: Point2D = { x: 10, y: 5 };
            const q: Point2D = { x: 5, y: 10 }; // Inside X range but outside Y range

            const result = onSegment(p, q, r);
            expect(result).toBe(false);
        });

        it('should handle point at exact boundary conditions', () => {
            const p: Point2D = { x: 0, y: 0 };
            const r: Point2D = { x: 10, y: 10 };
            const q: Point2D = { x: 10, y: 5 }; // At X boundary, within Y range

            const result = onSegment(p, q, r);
            expect(result).toBe(true);
        });
    });

    describe('doLineSegmentsIntersect - uncovered branches', () => {
        it('should detect intersection when segments properly cross', () => {
            // Two line segments that clearly intersect
            const p1: Point2D = { x: 0, y: 0 };
            const p2: Point2D = { x: 10, y: 10 };
            const p3: Point2D = { x: 0, y: 10 };
            const p4: Point2D = { x: 10, y: 0 };

            const result = doLineSegmentsIntersect(p1, p2, p3, p4);
            expect(result).toBe(true);
        });

        it('should detect collinear point intersections - case d1=0', () => {
            const p1: Point2D = { x: 0, y: 0 };
            const p2: Point2D = { x: 10, y: 0 };
            const p3: Point2D = { x: 2, y: 0 }; // Collinear with p1-p2
            const p4: Point2D = { x: 8, y: 0 };

            const result = doLineSegmentsIntersect(p3, p4, p1, p2);
            expect(result).toBe(true);
        });

        it('should detect collinear point intersections - case d2=0', () => {
            const p1: Point2D = { x: 0, y: 0 };
            const p2: Point2D = { x: 10, y: 0 };
            const p3: Point2D = { x: 2, y: 0 };
            const p4: Point2D = { x: 8, y: 0 }; // p2 is collinear with p3-p4

            const result = doLineSegmentsIntersect(p1, p2, p3, p4);
            expect(result).toBe(true);
        });

        it('should detect collinear point intersections - case d3=0', () => {
            const p1: Point2D = { x: 0, y: 0 };
            const p2: Point2D = { x: 10, y: 0 };
            const p3: Point2D = { x: 5, y: 0 }; // p3 is collinear with p1-p2
            const p4: Point2D = { x: 15, y: 5 };

            const result = doLineSegmentsIntersect(p1, p2, p3, p4);
            expect(result).toBe(true);
        });

        it('should detect collinear point intersections - case d4=0', () => {
            const p1: Point2D = { x: 0, y: 0 };
            const p2: Point2D = { x: 10, y: 0 };
            const p3: Point2D = { x: -5, y: 5 };
            const p4: Point2D = { x: 5, y: 0 }; // p4 is collinear with p1-p2

            const result = doLineSegmentsIntersect(p1, p2, p3, p4);
            expect(result).toBe(true);
        });

        it('should return false for non-intersecting segments', () => {
            const p1: Point2D = { x: 0, y: 0 };
            const p2: Point2D = { x: 2, y: 0 };
            const p3: Point2D = { x: 5, y: 0 };
            const p4: Point2D = { x: 10, y: 0 };

            const result = doLineSegmentsIntersect(p1, p2, p3, p4);
            expect(result).toBe(false);
        });
    });

    describe('calculateLineParameterForPoint - degenerate line', () => {
        it('should handle degenerate line (zero length)', () => {
            const point: Point2D = { x: 5, y: 5 };
            const line: Line = {
                start: { x: 3, y: 3 },
                end: { x: 3, y: 3 }, // Same point - degenerate line
            };

            const result = calculateLineParameterForPoint(point, line);
            expect(result).toBe(0);
        });

        it('should handle very short line near epsilon threshold', () => {
            const point: Point2D = { x: 0, y: 0 };
            const line: Line = {
                start: { x: 0, y: 0 },
                end: { x: EPSILON / 2, y: EPSILON / 2 }, // Very short line
            };

            const result = calculateLineParameterForPoint(point, line);
            expect(result).toBe(0);
        });
    });

    describe('isParameterValidForSegment - default case', () => {
        it('should handle invalid segment position (default case)', () => {
            const param = 0.5;

            const position = 'invalid' as any;

            const result = isParameterValidForSegment(param, position);
            expect(result).toBe(true); // Default case allows param within tolerance
        });

        it('should handle default case with parameter outside bounds', () => {
            const param = 2.0; // Outside [0,1] range

            const position = 'invalid' as any;

            const result = isParameterValidForSegment(param, position);
            expect(result).toBe(false);
        });
    });

    describe('calculateLineIntersection - point cases', () => {
        it('should handle two identical points', () => {
            const line1: Line = {
                start: { x: 5, y: 5 },
                end: { x: 5, y: 5 }, // Point
            };
            const line2: Line = {
                start: { x: 5, y: 5 },
                end: { x: 5, y: 5 }, // Same point
            };

            const result = calculateLineIntersection(line1, line2);
            expect(result).toHaveLength(1);
            expect(result[0].point).toEqual({ x: 5, y: 5 });
            expect(result[0].param1).toBe(0);
            expect(result[0].param2).toBe(0);
            expect(result[0].type).toBe('exact');
        });

        it('should handle two different points', () => {
            const line1: Line = {
                start: { x: 0, y: 0 },
                end: { x: 0, y: 0 }, // Point
            };
            const line2: Line = {
                start: { x: 5, y: 5 },
                end: { x: 5, y: 5 }, // Different point
            };

            const result = calculateLineIntersection(line1, line2);
            expect(result).toHaveLength(0);
        });

        it('should handle point on line (first line is point)', () => {
            const line1: Line = {
                start: { x: 5, y: 5 },
                end: { x: 5, y: 5 }, // Point
            };
            const line2: Line = {
                start: { x: 0, y: 0 },
                end: { x: 10, y: 10 }, // Line passing through the point
            };

            const result = calculateLineIntersection(line1, line2);
            expect(result).toHaveLength(1);
            expect(result[0].point).toEqual({ x: 5, y: 5 });
            expect(result[0].param1).toBe(0);
            expect(result[0].param2).toBeCloseTo(0.5);
        });

        it('should handle point not on line (first line is point)', () => {
            const line1: Line = {
                start: { x: 3, y: 7 },
                end: { x: 3, y: 7 }, // Point
            };
            const line2: Line = {
                start: { x: 0, y: 0 },
                end: { x: 10, y: 0 }, // Horizontal line not passing through point
            };

            const result = calculateLineIntersection(line1, line2);
            expect(result).toHaveLength(0);
        });

        it('should handle point on line (second line is point)', () => {
            const line1: Line = {
                start: { x: 0, y: 0 },
                end: { x: 10, y: 10 }, // Line
            };
            const line2: Line = {
                start: { x: 5, y: 5 },
                end: { x: 5, y: 5 }, // Point on the line
            };

            const result = calculateLineIntersection(line1, line2);
            expect(result).toHaveLength(1);
            expect(result[0].point).toEqual({ x: 5, y: 5 });
            expect(result[0].param1).toBeCloseTo(0.5);
            expect(result[0].param2).toBe(0);
        });

        it('should handle point not on line (second line is point)', () => {
            const line1: Line = {
                start: { x: 0, y: 0 },
                end: { x: 10, y: 0 }, // Horizontal line
            };
            const line2: Line = {
                start: { x: 5, y: 5 },
                end: { x: 5, y: 5 }, // Point above the line
            };

            const result = calculateLineIntersection(line1, line2);
            expect(result).toHaveLength(0);
        });

        it('should handle vertical line with point', () => {
            const line1: Line = {
                start: { x: 5, y: 3 },
                end: { x: 5, y: 3 }, // Point
            };
            const line2: Line = {
                start: { x: 5, y: 0 },
                end: { x: 5, y: 10 }, // Vertical line passing through point
            };

            const result = calculateLineIntersection(line1, line2);
            expect(result).toHaveLength(1);
            expect(result[0].point).toEqual({ x: 5, y: 3 });
            expect(result[0].param2).toBeCloseTo(0.3);
        });

        it('should handle horizontal line with point', () => {
            const line1: Line = {
                start: { x: 0, y: 5 },
                end: { x: 10, y: 5 }, // Horizontal line
            };
            const line2: Line = {
                start: { x: 3, y: 5 },
                end: { x: 3, y: 5 }, // Point on the line
            };

            const result = calculateLineIntersection(line1, line2);
            expect(result).toHaveLength(1);
            expect(result[0].point).toEqual({ x: 3, y: 5 });
            expect(result[0].param1).toBeCloseTo(0.3);
        });
    });

    describe('calculateLineDirectionAndLength - degenerate line', () => {
        it('should return null for degenerate line', () => {
            const line: Line = {
                start: { x: 5, y: 3 },
                end: { x: 5, y: 3 },
            };

            const result = calculateLineDirectionAndLength(line);
            expect(result).toBeNull();
        });

        it('should return null for line shorter than epsilon', () => {
            const line: Line = {
                start: { x: 0, y: 0 },
                end: { x: EPSILON / 2, y: EPSILON / 2 },
            };

            const result = calculateLineDirectionAndLength(line);
            expect(result).toBeNull();
        });

        it('should handle normal line correctly', () => {
            const line: Line = {
                start: { x: 0, y: 0 },
                end: { x: 3, y: 4 },
            };

            const result = calculateLineDirectionAndLength(line);
            expect(result).not.toBeNull();
            expect(result!.length).toBeCloseTo(5);
            expect(result!.direction).toEqual({ x: 3, y: 4 });
            expect(result!.unitDirection.x).toBeCloseTo(0.6);
            expect(result!.unitDirection.y).toBeCloseTo(0.8);
        });
    });

    describe('edge cases and numerical precision', () => {
        it('should handle lines with very small coordinates', () => {
            const line1: Line = {
                start: { x: 1e-5, y: 1e-5 },
                end: { x: 2e-5, y: 2e-5 },
            };
            const line2: Line = {
                start: { x: 0, y: 2e-5 },
                end: { x: 2e-5, y: 0 },
            };

            const result = calculateLineIntersection(line1, line2);
            expect(result).toHaveLength(1);
        });

        it('should handle parallel lines', () => {
            const line1: Line = {
                start: { x: 0, y: 0 },
                end: { x: 10, y: 0 },
            };
            const line2: Line = {
                start: { x: 0, y: 5 },
                end: { x: 10, y: 5 },
            };

            const result = calculateLineIntersection(line1, line2);
            expect(result).toHaveLength(0);
        });

        it('should handle nearly parallel lines', () => {
            const line1: Line = {
                start: { x: 0, y: 0 },
                end: { x: 10, y: 0 },
            };
            const line2: Line = {
                start: { x: 0, y: 0 },
                end: { x: 10, y: EPSILON / 10 }, // Very nearly horizontal
            };

            const result = calculateLineIntersection(line1, line2);
            // Since they share the same start point, they intersect at origin
            expect(result).toHaveLength(1);
            expect(result[0].point.x).toBeCloseTo(0);
            expect(result[0].point.y).toBeCloseTo(0);
        });
    });
});
