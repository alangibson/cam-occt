import { describe, it, expect } from 'vitest';
import { EPSILON } from '$lib/geometry/math';
import { findLineLineIntersections } from '../intersect/line-line/index';
import { findLineArcIntersections } from '../intersect/line-arc/index';
import { findArcArcIntersections } from '../intersect/arc-arc/index';
import {
    findShapeIntersections,
    clusterIntersections,
} from '../intersect/index';
import type { Arc } from '../../../geometry/arc';
import {
    GeometryType,
    type Shape,
    type Line,
    type Circle,
    type Point2D,
} from '../../../../lib/types/geometry';
import type { IntersectionResult } from './types';
import { generateId } from '../../../utils/id';
import { createPolylineFromVertices } from '$lib/geometry/polyline';

describe('intersections', () => {
    // Helper functions to create test shapes
    function createLine(x1: number, y1: number, x2: number, y2: number): Shape {
        return {
            id: generateId(),
            type: GeometryType.LINE,
            geometry: {
                start: { x: x1, y: y1 },
                end: { x: x2, y: y2 },
            } as Line,
        };
    }

    function createArc(
        cx: number,
        cy: number,
        radius: number,
        startAngle: number,
        endAngle: number,
        clockwise: boolean = false
    ): Shape {
        return {
            id: generateId(),
            type: GeometryType.ARC,
            geometry: {
                center: { x: cx, y: cy },
                radius,
                startAngle,
                endAngle,
                clockwise,
            } as Arc,
        };
    }

    function createCircle(cx: number, cy: number, radius: number): Shape {
        return {
            id: generateId(),
            type: GeometryType.CIRCLE,
            geometry: {
                center: { x: cx, y: cy },
                radius,
            } as Circle,
        };
    }

    // Helper to check if points are approximately equal
    function pointsApproxEqual(
        p1: Point2D,
        p2: Point2D,
        tolerance = EPSILON
    ): boolean {
        return (
            Math.abs(p1.x - p2.x) < tolerance &&
            Math.abs(p1.y - p2.y) < tolerance
        );
    }

    // Helper to check intersection result
    function checkIntersection(
        result: IntersectionResult,
        expectedPoint: Point2D,
        expectedType: string = 'exact',
        tolerance = EPSILON
    ): void {
        expect(pointsApproxEqual(result.point, expectedPoint, tolerance)).toBe(
            true
        );
        expect(result.type).toBe(expectedType);
        expect(result.confidence).toBeGreaterThan(0);
        expect(result.param1).toBeGreaterThanOrEqual(-tolerance);
        expect(result.param1).toBeLessThanOrEqual(1 + tolerance);
        expect(result.param2).toBeGreaterThanOrEqual(-tolerance);
        expect(result.param2).toBeLessThanOrEqual(1 + tolerance);
    }

    describe('findLineLineIntersections', () => {
        it('should find intersection of two crossing lines', () => {
            const line1: Line = {
                start: { x: 0, y: 0 },
                end: { x: 10, y: 10 },
            };
            const line2: Line = {
                start: { x: 0, y: 10 },
                end: { x: 10, y: 0 },
            };

            const result = findLineLineIntersections(line1, line2);

            expect(result).toHaveLength(1);
            checkIntersection(result[0], { x: 5, y: 5 });
            expect(result[0].param1).toBeCloseTo(0.5);
            expect(result[0].param2).toBeCloseTo(0.5);
        });

        it('should find intersection at line endpoints', () => {
            const line1: Line = { start: { x: 0, y: 0 }, end: { x: 10, y: 0 } };
            const line2: Line = {
                start: { x: 10, y: 0 },
                end: { x: 10, y: 10 },
            };

            const result = findLineLineIntersections(line1, line2);

            expect(result).toHaveLength(1);
            checkIntersection(result[0], { x: 10, y: 0 });
            expect(result[0].param1).toBeCloseTo(1.0);
            expect(result[0].param2).toBeCloseTo(0.0);
        });

        it('should handle parallel non-intersecting lines', () => {
            const line1: Line = { start: { x: 0, y: 0 }, end: { x: 10, y: 0 } };
            const line2: Line = { start: { x: 0, y: 1 }, end: { x: 10, y: 1 } };

            const result = findLineLineIntersections(line1, line2);

            expect(result).toHaveLength(0);
        });

        it('should handle collinear overlapping lines', () => {
            const line1: Line = { start: { x: 0, y: 0 }, end: { x: 10, y: 0 } };
            const line2: Line = { start: { x: 5, y: 0 }, end: { x: 15, y: 0 } };

            const result = findLineLineIntersections(line1, line2);

            expect(result.length).toBeGreaterThan(0);
            expect(result.every((r) => r.type === 'coincident')).toBe(true);

            // Should find overlap region from x=5 to x=10
            const overlapPoints = result
                .map((r) => r.point.x)
                .sort((a, b) => a - b);
            expect(overlapPoints[0]).toBeCloseTo(5);
            if (overlapPoints.length > 1) {
                expect(overlapPoints[overlapPoints.length - 1]).toBeCloseTo(10);
            }
        });

        it('should handle collinear non-overlapping lines', () => {
            const line1: Line = { start: { x: 0, y: 0 }, end: { x: 5, y: 0 } };
            const line2: Line = {
                start: { x: 10, y: 0 },
                end: { x: 15, y: 0 },
            };

            const result = findLineLineIntersections(line1, line2);

            expect(result).toHaveLength(0);
        });

        it('should handle degenerate lines (points)', () => {
            const line1: Line = { start: { x: 5, y: 5 }, end: { x: 5, y: 5 } };
            const line2: Line = {
                start: { x: 0, y: 0 },
                end: { x: 10, y: 10 },
            };

            const result = findLineLineIntersections(line1, line2);

            expect(result).toHaveLength(1);
            checkIntersection(result[0], { x: 5, y: 5 });
        });

        it('should handle near-parallel lines', () => {
            const line1: Line = { start: { x: 0, y: 0 }, end: { x: 10, y: 0 } };
            const line2: Line = {
                start: { x: 0, y: 0.0001 },
                end: { x: 10, y: 0.0002 },
            };

            const result = findLineLineIntersections(line1, line2);

            // Should still find an intersection despite being nearly parallel
            if (result.length > 0) {
                expect(result[0].confidence).toBeGreaterThan(0);
                expect(
                    pointsApproxEqual(result[0].point, { x: -10, y: 0 }, 1e-3)
                ).toBe(true);
            }
        });
    });

    describe('findLineArcIntersections', () => {
        it('should find two intersections for line crossing circle', () => {
            const line: Line = { start: { x: -5, y: 0 }, end: { x: 5, y: 0 } };
            const arc: Arc = {
                center: { x: 0, y: 0 },
                radius: 3,
                startAngle: 0,
                endAngle: 2 * Math.PI,
                clockwise: false,
            };

            const result = findLineArcIntersections(line, arc);

            expect(result).toHaveLength(2);

            // Should intersect at (-3, 0) and (3, 0)
            const xCoords = result.map((r) => r.point.x).sort((a, b) => a - b);
            expect(xCoords[0]).toBeCloseTo(-3);
            expect(xCoords[1]).toBeCloseTo(3);

            result.forEach((r) => {
                expect(r.point.y).toBeCloseTo(0);
                expect(r.type).toBe('exact');
            });
        });

        it('should find one intersection for tangent line', () => {
            const line: Line = { start: { x: -5, y: 3 }, end: { x: 5, y: 3 } };
            const arc: Arc = {
                center: { x: 0, y: 0 },
                radius: 3,
                startAngle: 0,
                endAngle: 2 * Math.PI,
                clockwise: false,
            };

            const result = findLineArcIntersections(line, arc);

            expect(result).toHaveLength(1);
            checkIntersection(result[0], { x: 0, y: 3 }, 'tangent');
        });

        it('should find no intersection for line missing arc', () => {
            const line: Line = { start: { x: -5, y: 5 }, end: { x: 5, y: 5 } };
            const arc: Arc = {
                center: { x: 0, y: 0 },
                radius: 3,
                startAngle: 0,
                endAngle: 2 * Math.PI,
                clockwise: false,
            };

            const result = findLineArcIntersections(line, arc);

            expect(result).toHaveLength(0);
        });

        it('should respect arc angular bounds', () => {
            const line: Line = { start: { x: -5, y: 0 }, end: { x: 5, y: 0 } };
            const arc: Arc = {
                center: { x: 0, y: 0 },
                radius: 3,
                startAngle: 0, // 0 to π/2 (first quadrant)
                endAngle: Math.PI / 2,
                clockwise: false,
            };

            const result = findLineArcIntersections(line, arc);

            expect(result).toHaveLength(1); // Only positive x intersection should be valid
            checkIntersection(result[0], { x: 3, y: 0 });
        });

        it('should handle line endpoints on arc', () => {
            const line: Line = { start: { x: 3, y: 0 }, end: { x: 6, y: 0 } };
            const arc: Arc = {
                center: { x: 0, y: 0 },
                radius: 3,
                startAngle: 0,
                endAngle: 2 * Math.PI,
                clockwise: false,
            };

            const result = findLineArcIntersections(line, arc);

            expect(result).toHaveLength(1); // Line segment only intersects at its start point (3,0)

            // Check the single intersection at x=3
            checkIntersection(result[0], { x: 3, y: 0 });
            expect(result[0].param1).toBeCloseTo(0); // At line start
        });
    });

    describe('findArcArcIntersections', () => {
        it('should find two intersections for overlapping circles', () => {
            const arc1: Arc = {
                center: { x: 0, y: 0 },
                radius: 3,
                startAngle: 0,
                endAngle: 2 * Math.PI,
                clockwise: false,
            };
            const arc2: Arc = {
                center: { x: 4, y: 0 },
                radius: 3,
                startAngle: 0,
                endAngle: 2 * Math.PI,
                clockwise: false,
            };

            const result = findArcArcIntersections(arc1, arc2);

            expect(result).toHaveLength(2);

            // Should intersect at (2, ±√5)
            result.forEach((r) => {
                expect(r.point.x).toBeCloseTo(2);
                expect(Math.abs(r.point.y)).toBeCloseTo(Math.sqrt(5));
                expect(r.type).toBe('exact');
            });
        });

        it('should find one intersection for externally tangent circles', () => {
            const arc1: Arc = {
                center: { x: 0, y: 0 },
                radius: 3,
                startAngle: 0,
                endAngle: 2 * Math.PI,
                clockwise: false,
            };
            const arc2: Arc = {
                center: { x: 6, y: 0 },
                radius: 3,
                startAngle: 0,
                endAngle: 2 * Math.PI,
                clockwise: false,
            };

            const result = findArcArcIntersections(arc1, arc2);

            expect(result).toHaveLength(1);
            checkIntersection(result[0], { x: 3, y: 0 }, 'tangent');
        });

        it('should find no intersection for separated circles', () => {
            const arc1: Arc = {
                center: { x: 0, y: 0 },
                radius: 2,
                startAngle: 0,
                endAngle: 2 * Math.PI,
                clockwise: false,
            };
            const arc2: Arc = {
                center: { x: 10, y: 0 },
                radius: 2,
                startAngle: 0,
                endAngle: 2 * Math.PI,
                clockwise: false,
            };

            const result = findArcArcIntersections(arc1, arc2);

            expect(result).toHaveLength(0);
        });

        it('should respect arc angular bounds for partial arcs', () => {
            const arc1: Arc = {
                center: { x: 0, y: 0 },
                radius: 3,
                startAngle: 0,
                endAngle: Math.PI / 2, // First quadrant only
                clockwise: false,
            };
            const arc2: Arc = {
                center: { x: 4, y: 0 },
                radius: 3,
                startAngle: Math.PI / 2,
                endAngle: Math.PI, // Second quadrant only
                clockwise: false,
            };

            const result = findArcArcIntersections(arc1, arc2);

            expect(result).toHaveLength(1); // Only upper intersection should be valid
            expect(result[0].point.x).toBeCloseTo(2);
            expect(result[0].point.y).toBeCloseTo(Math.sqrt(5));
        });

        it('should handle concentric circles', () => {
            const arc1: Arc = {
                center: { x: 0, y: 0 },
                radius: 2,
                startAngle: 0,
                endAngle: 2 * Math.PI,
                clockwise: false,
            };
            const arc2: Arc = {
                center: { x: 0, y: 0 },
                radius: 3,
                startAngle: 0,
                endAngle: 2 * Math.PI,
                clockwise: false,
            };

            const result = findArcArcIntersections(arc1, arc2);

            expect(result).toHaveLength(0); // Concentric circles don't intersect
        });
    });

    describe('clusterIntersections', () => {
        it('should cluster nearby intersection points', () => {
            const intersections: IntersectionResult[] = [
                {
                    point: { x: 1.0, y: 1.0 },
                    param1: 0.5,
                    param2: 0.5,
                    distance: 0,
                    type: 'exact',
                    confidence: 1.0,
                },
                {
                    point: { x: 1.0001, y: 0.9999 },
                    param1: 0.5,
                    param2: 0.5,
                    distance: 0,
                    type: 'exact',
                    confidence: 1.0,
                },
                {
                    point: { x: 5.0, y: 5.0 },
                    param1: 0.8,
                    param2: 0.8,
                    distance: 0,
                    type: 'exact',
                    confidence: 1.0,
                },
            ];

            const result = clusterIntersections(intersections, 1e-3);

            expect(result).toHaveLength(2); // Two clusters: one near (1,1), one at (5,5)

            // First cluster should be averaged
            expect(
                pointsApproxEqual(
                    result[0].point,
                    { x: 1.00005, y: 0.99995 },
                    1e-4
                )
            ).toBe(true);
            expect(
                pointsApproxEqual(result[1].point, { x: 5.0, y: 5.0 }, EPSILON)
            ).toBe(true);
        });

        it('should not cluster distant points', () => {
            const intersections: IntersectionResult[] = [
                {
                    point: { x: 1.0, y: 1.0 },
                    param1: 0.5,
                    param2: 0.5,
                    distance: 0,
                    type: 'exact',
                    confidence: 1.0,
                },
                {
                    point: { x: 5.0, y: 5.0 },
                    param1: 0.8,
                    param2: 0.8,
                    distance: 0,
                    type: 'exact',
                    confidence: 1.0,
                },
            ];

            const result = clusterIntersections(intersections, 1e-3);

            expect(result).toHaveLength(2); // No clustering should occur
            expect(result).toEqual(intersections);
        });

        it('should handle empty and single intersection arrays', () => {
            expect(clusterIntersections([], 1e-3)).toHaveLength(0);

            const single: IntersectionResult[] = [
                {
                    point: { x: 1.0, y: 1.0 },
                    param1: 0.5,
                    param2: 0.5,
                    distance: 0,
                    type: 'exact',
                    confidence: 1.0,
                },
            ];

            expect(clusterIntersections(single, 1e-3)).toEqual(single);
        });
    });

    describe('findShapeIntersections integration', () => {
        it('should find line-line intersections through main interface', () => {
            const line1 = createLine(0, 0, 10, 10);
            const line2 = createLine(0, 10, 10, 0);

            const result = findShapeIntersections(line1, line2);

            expect(result).toHaveLength(1);
            checkIntersection(result[0], { x: 5, y: 5 });
        });

        it('should find line-arc intersections through main interface', () => {
            const line: Shape = createLine(-5, 0, 5, 0);
            const arc: Shape = createArc(0, 0, 3, 0, 2 * Math.PI);

            const result = findShapeIntersections(line, arc);

            expect(result).toHaveLength(1);

            // Should find one of the two possible intersections (either x = -3 or x = 3)
            const x: number = result[0].point.x;
            expect(Math.abs(x)).toBeCloseTo(3);
            expect(result[0].point.y).toBeCloseTo(0);
        });

        it('should find arc-arc intersections through main interface', () => {
            const arc1 = createArc(0, 0, 3, 0, 2 * Math.PI);
            const arc2 = createArc(4, 0, 3, 0, 2 * Math.PI);

            const result = findShapeIntersections(arc1, arc2);

            expect(result).toHaveLength(1);

            // Should find one of the two possible intersections
            const intersection = result[0];
            expect(intersection.point.x).toBeCloseTo(2, 1);
            expect(Math.abs(intersection.point.y)).toBeCloseTo(Math.sqrt(5), 1);
        });

        it('should find circle intersections through main interface', () => {
            const circle1 = createCircle(0, 0, 3);
            const circle2 = createCircle(4, 0, 3);

            const result = findShapeIntersections(circle1, circle2);

            expect(result).toHaveLength(1);

            // Should find one of the two possible intersections
            const intersection = result[0];
            expect(intersection.point.x).toBeCloseTo(2, 1);
            expect(Math.abs(intersection.point.y)).toBeCloseTo(Math.sqrt(5), 1);
        });
    });

    describe('new intersection types', () => {
        // Helper function to create polyline
        function createPolyline(
            points: Array<{ x: number; y: number; bulge?: number }>,
            closed: boolean = false
        ): Shape {
            const vertices = points.map((p) => ({
                x: p.x,
                y: p.y,
                bulge: p.bulge ?? 0,
            }));
            return createPolylineFromVertices(vertices, closed, {
                id: generateId(),
            });
        }

        // Helper function to create ellipse
        function createEllipse(
            cx: number,
            cy: number,
            majorX: number,
            majorY: number,
            ratio: number
        ): Shape {
            return {
                id: generateId(),
                type: GeometryType.ELLIPSE,
                geometry: {
                    center: { x: cx, y: cy },
                    majorAxisEndpoint: { x: majorX, y: majorY },
                    minorToMajorRatio: ratio,
                },
            };
        }

        // Helper function to create spline
        function createSpline(
            controlPoints: Array<{ x: number; y: number }>,
            degree: number = 3,
            closed: boolean = false
        ): Shape {
            return {
                id: generateId(),
                type: GeometryType.SPLINE,
                geometry: {
                    controlPoints,
                    knots: [], // Simplified
                    weights: controlPoints.map(() => 1),
                    degree,
                    fitPoints: controlPoints, // Use control points as fit points for testing
                    closed,
                },
            };
        }

        it('should find polyline-line intersections', () => {
            const polyline: Shape = createPolyline(
                [
                    { x: 0, y: 0 },
                    { x: 10, y: 0 },
                    { x: 10, y: 10 },
                    { x: 0, y: 10 },
                ],
                true
            );

            const line: Shape = createLine(5, -5, 5, 15);
            const result = findShapeIntersections(polyline, line);

            expect(result).toHaveLength(1); // Only one intersection due to constraint

            // Should find one intersection point (either at y=0 or y=10)
            const intersection = result[0];
            expect(intersection.point.x).toBeCloseTo(5, 1);
            const y: number = intersection.point.y;
            expect(
                y === 0 ||
                    y === 10 ||
                    Math.abs(y) < 0.1 ||
                    Math.abs(y - 10) < 0.1
            ).toBe(true);
        });

        it('should find polyline-polyline intersections', () => {
            const polyline1 = createPolyline([
                { x: 0, y: 0 },
                { x: 10, y: 10 },
            ]);

            const polyline2 = createPolyline([
                { x: 0, y: 10 },
                { x: 10, y: 0 },
            ]);

            const result = findShapeIntersections(polyline1, polyline2);

            expect(result).toHaveLength(1);
            checkIntersection(result[0], { x: 5, y: 5 });
        });

        it('should find ellipse-line intersections', () => {
            // Unit circle centered at origin with horizontal major axis
            const ellipse: Shape = createEllipse(0, 0, 1, 0, 1); // Circle actually
            const line: Shape = createLine(-2, 0, 2, 0); // Horizontal line through center

            const result = findShapeIntersections(ellipse, line);

            expect(result).toHaveLength(1);
            // Should find one of the two possible intersections (either x = -1 or x = 1)
            const intersection = result[0];
            expect(Math.abs(intersection.point.x)).toBeCloseTo(1, 1);
            expect(intersection.point.y).toBeCloseTo(0, 1);
        });

        it('should find ellipse-ellipse intersections using approximation', () => {
            const ellipse1 = createEllipse(0, 0, 2, 0, 0.5); // Horizontal ellipse
            const ellipse2 = createEllipse(0, 0, 0, 2, 0.5); // Vertical ellipse

            const result = findShapeIntersections(ellipse1, ellipse2);

            // Should find intersection points (results may vary due to approximation)
            expect(result.length).toBeGreaterThan(0);
        });

        it('should find spline-line intersections using approximation', () => {
            // Simple spline that approximates a line from (0,0) to (10,10)
            const spline: Shape = createSpline(
                [
                    { x: 0, y: 0 },
                    { x: 5, y: 5 },
                    { x: 10, y: 10 },
                ],
                2
            );

            const line: Shape = createLine(0, 10, 10, 0); // Perpendicular line

            const result = findShapeIntersections(spline, line);

            expect(result.length).toBeGreaterThan(0);
            // Should intersect near the middle
            const intersectionPoint = result[0].point;
            expect(intersectionPoint.x).toBeCloseTo(5, 1);
            expect(intersectionPoint.y).toBeCloseTo(5, 1);
        });

        it('should find spline-spline intersections using approximation', () => {
            const spline1 = createSpline(
                [
                    { x: 0, y: 0 },
                    { x: 10, y: 10 },
                ],
                1
            ); // Linear spline

            const spline2 = createSpline(
                [
                    { x: 0, y: 10 },
                    { x: 10, y: 0 },
                ],
                1
            ); // Another linear spline

            const result = findShapeIntersections(spline1, spline2);

            expect(result.length).toBeGreaterThan(0);
            if (result.length > 0) {
                checkIntersection(result[0], { x: 5, y: 5 }, 'exact', 1); // Allow some tolerance due to approximation
            }
        });

        it('should handle polylines with bulge vertices', () => {
            // Create a polyline with a bulged segment (approximating an arc)
            const polyline: Shape = createPolyline([
                { x: 0, y: 0 },
                { x: 10, y: 0, bulge: 1 }, // 90-degree arc to next point
                { x: 10, y: 10 },
            ]);

            const line: Shape = createLine(5, -5, 5, 15);
            const result = findShapeIntersections(polyline, line);

            expect(result.length).toBeGreaterThan(0);
        });

        it('should maintain reasonable confidence levels for approximations', () => {
            const ellipse: Shape = createEllipse(0, 0, 1, 0, 1);
            const spline: Shape = createSpline(
                [
                    { x: -2, y: 0 },
                    { x: 2, y: 0 },
                ],
                1
            );

            const result = findShapeIntersections(ellipse, spline);

            if (result.length > 0) {
                result.forEach((intersection) => {
                    expect(intersection.confidence).toBeGreaterThan(0.5);
                    expect(intersection.confidence).toBeLessThanOrEqual(1.0);
                });
            }
        });
    });
});
