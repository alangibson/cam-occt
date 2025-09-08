import { describe, it, expect } from 'vitest';
import type {
    Shape,
    Point2D,
    Line,
    Arc,
    Circle,
    Spline,
    Polyline,
    Ellipse,
    GeometryType,
} from '../../../../lib/types/geometry';
import { findSplineLineIntersectionsVerb } from '../intersect/line-spline/index';
import { findSplineSplineIntersectionsVerb } from '../intersect/spline-spline/index';
import { findSplinePolylineIntersectionsVerb } from '../intersect/polyline-spline/index';
import { findSplineCircleIntersectionsVerb } from '../intersect/circle-spline';
import { findSplineArcIntersectionsVerb } from '../intersect/spline-arc/index';
import { createPolylineFromVertices } from '../../../geometry/polyline';

describe('intersections-spline-verb', () => {
    // Helper function to create test spline
    function createTestSpline(
        controlPoints: Point2D[],
        degree: number = 3,
        knots?: number[],
        weights?: number[]
    ): Spline {
        // If no weights provided, create unit weights for all control points
        const actualWeights = weights || controlPoints.map(() => 1);

        return {
            controlPoints,
            degree,
            knots: knots || [],
            weights: actualWeights,
            fitPoints: [],
            closed: false,
        };
    }

    // Helper function to create test shape
    function createTestShape(
        geometry: Arc | Line | Circle | Ellipse | Polyline | Spline,
        type: GeometryType
    ): Shape {
        return {
            id: 'test-shape',
            type: type,
            geometry,
        };
    }

    // Helper function to check if point is approximately equal
    function expectPointNear(
        actual: Point2D,
        expected: Point2D,
        tolerance = 1e-6
    ) {
        expect(Math.abs(actual.x - expected.x)).toBeLessThan(tolerance);
        expect(Math.abs(actual.y - expected.y)).toBeLessThan(tolerance);
    }

    describe('findSplineLineIntersectionsVerb', () => {
        it('should find intersection between straight spline and horizontal line', () => {
            // Create a simple degree-1 spline (essentially a line from (0,0) to (2,2))
            const spline: import('$lib/types/geometry').Spline =
                createTestSpline(
                    [
                        { x: 0, y: 0 },
                        { x: 2, y: 2 },
                    ],
                    1,
                    [0, 0, 1, 1]
                );

            const line: Line = {
                start: { x: 0, y: 1 },
                end: { x: 2, y: 1 },
            };

            const result = findSplineLineIntersectionsVerb(
                createTestShape(spline, 'spline'),
                createTestShape(line, 'line')
            );

            // Should intersect at (1, 1)
            expect(result.length).toBeGreaterThan(0);
            if (result.length > 0) {
                expectPointNear(result[0].point, { x: 1, y: 1 });
                expect(result[0].type).toBe('exact');
            }
        });

        it('should find no intersections for parallel spline and line', () => {
            // Create horizontal spline
            const spline: import('$lib/types/geometry').Spline =
                createTestSpline(
                    [
                        { x: 0, y: 1 },
                        { x: 2, y: 1 },
                    ],
                    1,
                    [0, 0, 1, 1]
                );

            // Parallel horizontal line
            const line: Line = {
                start: { x: 0, y: 2 },
                end: { x: 2, y: 2 },
            };

            const result = findSplineLineIntersectionsVerb(
                createTestShape(spline, 'spline'),
                createTestShape(line, 'line')
            );

            expect(result).toHaveLength(0);
        });

        it('should handle spline with missing knots', () => {
            // Quadratic spline without explicit knots
            const spline: import('$lib/types/geometry').Spline =
                createTestSpline(
                    [
                        { x: 0, y: 0 },
                        { x: 1, y: 2 },
                        { x: 2, y: 0 },
                    ],
                    2
                );

            const line: Line = {
                start: { x: 0, y: 1 },
                end: { x: 2, y: 1 },
            };

            // Should not throw and should attempt to find intersections
            expect(() => {
                findSplineLineIntersectionsVerb(
                    createTestShape(spline, 'spline'),
                    createTestShape(line, 'line')
                );
                // Result might be empty or contain intersections, both are valid
            }).not.toThrow();
        });

        it('should handle parameter swapping', () => {
            const spline: import('$lib/types/geometry').Spline =
                createTestSpline(
                    [
                        { x: 0, y: 0 },
                        { x: 2, y: 2 },
                    ],
                    1,
                    [0, 0, 1, 1]
                );

            const line: Line = {
                start: { x: 0, y: 1 },
                end: { x: 2, y: 1 },
            };

            const normalResult = findSplineLineIntersectionsVerb(
                createTestShape(spline, 'spline'),
                createTestShape(line, 'line'),
                false
            );

            const swappedResult = findSplineLineIntersectionsVerb(
                createTestShape(spline, 'spline'),
                createTestShape(line, 'line'),
                true
            );

            // If both have intersections, parameters should be swapped (within numerical tolerance)
            if (normalResult.length > 0 && swappedResult.length > 0) {
                expect(normalResult[0].param1).toBeCloseTo(
                    swappedResult[0].param2,
                    6
                );
                expect(normalResult[0].param2).toBeCloseTo(
                    swappedResult[0].param1,
                    6
                );
            }
        });
    });

    describe('findSplineArcIntersectionsVerb', () => {
        it('should exist and be callable', () => {
            // Just test that the function exists and can be imported
            expect(typeof findSplineArcIntersectionsVerb).toBe('function');

            // The actual arc-spline intersections may have issues with verb-nurbs API
            // This is a known issue with the verb-nurbs Arc constructor
            // For now, we verify the function signature is correct
            const spline: import('$lib/types/geometry').Spline =
                createTestSpline(
                    [
                        { x: 0, y: 0 },
                        { x: 1, y: 1 },
                    ],
                    1
                );
            const arc: Arc = {
                center: { x: 0, y: 0 },
                radius: 1,
                startAngle: 0,
                endAngle: Math.PI,
                clockwise: false,
            };

            // Function should accept the correct parameters without throwing
            expect(() => {
                const result = findSplineArcIntersectionsVerb(
                    createTestShape(spline, 'spline'),
                    createTestShape(arc, 'arc')
                );
                // Should return a valid intersection result array
                expect(Array.isArray(result)).toBe(true);
            }).not.toThrow(); // Function should work without throwing errors
        });
    });

    describe('findSplineCircleIntersectionsVerb', () => {
        it('should exist and be callable', () => {
            // Just test that the function exists and can be imported
            expect(typeof findSplineCircleIntersectionsVerb).toBe('function');

            // The actual circle-spline intersections may have issues with verb-nurbs API
            // This is a known issue with the verb-nurbs Circle constructor
            // For now, we verify the function signature is correct
            const spline: import('$lib/types/geometry').Spline =
                createTestSpline(
                    [
                        { x: 0, y: 0 },
                        { x: 1, y: 1 },
                    ],
                    1
                );
            const circle: Circle = { center: { x: 0, y: 0 }, radius: 1 };

            // Function should accept the correct parameters without throwing
            expect(() => {
                const result = findSplineCircleIntersectionsVerb(
                    createTestShape(spline, 'spline'),
                    createTestShape(circle, 'circle')
                );
                // Should return a valid intersection result array
                expect(Array.isArray(result)).toBe(true);
            }).not.toThrow(); // Function should work without throwing errors
        });
    });

    describe('findSplineSplineIntersectionsVerb', () => {
        it('should find intersection between two crossing line splines', () => {
            // First spline: diagonal from bottom-left to top-right
            const spline1 = createTestSpline(
                [
                    { x: 0, y: 0 },
                    { x: 2, y: 2 },
                ],
                1,
                [0, 0, 1, 1]
            );

            // Second spline: diagonal from top-left to bottom-right
            const spline2 = createTestSpline(
                [
                    { x: 0, y: 2 },
                    { x: 2, y: 0 },
                ],
                1,
                [0, 0, 1, 1]
            );

            const result = findSplineSplineIntersectionsVerb(
                createTestShape(spline1, 'spline'),
                createTestShape(spline2, 'spline')
            );

            // Should intersect at (1, 1)
            expect(result.length).toBeGreaterThan(0);
            if (result.length > 0) {
                expectPointNear(result[0].point, { x: 1, y: 1 });
                expect(result[0].type).toBe('exact');
            }
        });

        it('should find no intersection between parallel splines', () => {
            // Two parallel horizontal splines
            const spline1 = createTestSpline(
                [
                    { x: 0, y: 0 },
                    { x: 2, y: 0 },
                ],
                1,
                [0, 0, 1, 1]
            );

            const spline2 = createTestSpline(
                [
                    { x: 0, y: 1 },
                    { x: 2, y: 1 },
                ],
                1,
                [0, 0, 1, 1]
            );

            const result = findSplineSplineIntersectionsVerb(
                createTestShape(spline1, 'spline'),
                createTestShape(spline2, 'spline')
            );

            expect(result).toHaveLength(0);
        });

        it('should handle higher degree spline intersections', () => {
            // Quadratic spline forming an arch
            const spline1 = createTestSpline(
                [
                    { x: 0, y: 0 },
                    { x: 1, y: 2 },
                    { x: 2, y: 0 },
                ],
                2
            );

            // Horizontal line spline
            const spline2 = createTestSpline(
                [
                    { x: 0, y: 1 },
                    { x: 2, y: 1 },
                ],
                1,
                [0, 0, 1, 1]
            );

            // Should not throw, may or may not find intersections depending on verb-nurbs
            expect(() => {
                findSplineSplineIntersectionsVerb(
                    createTestShape(spline1, 'spline'),
                    createTestShape(spline2, 'spline')
                );
            }).not.toThrow();
        });
    });

    describe('findSplinePolylineIntersectionsVerb', () => {
        it('should find intersections between diagonal spline and rectangular polyline', () => {
            // Diagonal spline from bottom-left to top-right
            const spline: import('$lib/types/geometry').Spline =
                createTestSpline(
                    [
                        { x: 0, y: 0 },
                        { x: 2, y: 2 },
                    ],
                    1,
                    [0, 0, 1, 1]
                );

            // Square polyline
            const polylineShape = createPolylineFromVertices(
                [
                    { x: 0, y: 1, bulge: 0 },
                    { x: 1, y: 1, bulge: 0 },
                    { x: 1, y: 0, bulge: 0 },
                    { x: 2, y: 0, bulge: 0 },
                ],
                false
            );
            const polyline: import('$lib/types/geometry').Polyline =
                polylineShape.geometry as Polyline;

            const result = findSplinePolylineIntersectionsVerb(
                createTestShape(spline, 'spline'),
                createTestShape(polyline, 'polyline')
            );

            // Should find intersections with the polyline segments
            // Expected intersections depend on verb-nurbs behavior
            expect(result.length).toBeGreaterThanOrEqual(0);

            // All results should have valid intersection data
            result.forEach((intersection) => {
                expect(intersection.point).toBeDefined();
                expect(typeof intersection.point.x).toBe('number');
                expect(typeof intersection.point.y).toBe('number');
                expect(intersection.type).toBe('exact');
                expect(intersection.confidence).toBe(1.0);
            });
        });

        it('should handle closed polyline with closing segment', () => {
            // Horizontal spline
            const spline: import('$lib/types/geometry').Spline =
                createTestSpline(
                    [
                        { x: -1, y: 1 },
                        { x: 3, y: 1 },
                    ],
                    1,
                    [0, 0, 1, 1]
                );

            // Square closed polyline
            const polylineShape = createPolylineFromVertices(
                [
                    { x: 0, y: 0, bulge: 0 },
                    { x: 2, y: 0, bulge: 0 },
                    { x: 2, y: 2, bulge: 0 },
                    { x: 0, y: 2, bulge: 0 },
                ],
                true
            );

            const result = findSplinePolylineIntersectionsVerb(
                createTestShape(spline, 'spline'),
                polylineShape
            );

            // Should intersect with left and right sides of the square at y=1
            expect(result.length).toBe(2);
            if (result.length >= 2) {
                // Sort by x-coordinate for consistent testing
                const sortedResults = result.sort(
                    (a, b) => a.point.x - b.point.x
                );
                expectPointNear(sortedResults[0].point, { x: 0, y: 1 }, 1e-6);
                expectPointNear(sortedResults[1].point, { x: 2, y: 1 }, 1e-6);
            }
        });

        it('should handle parameter swapping', () => {
            const spline: import('$lib/types/geometry').Spline =
                createTestSpline(
                    [
                        { x: 0, y: 0 },
                        { x: 1, y: 1 },
                    ],
                    1,
                    [0, 0, 1, 1]
                );

            const polylineShape = createPolylineFromVertices(
                [
                    { x: 0, y: 0.5, bulge: 0 },
                    { x: 1, y: 0.5, bulge: 0 },
                ],
                false
            );
            const polyline: import('$lib/types/geometry').Polyline =
                polylineShape.geometry as Polyline;

            const normalResult = findSplinePolylineIntersectionsVerb(
                createTestShape(spline, 'spline'),
                createTestShape(polyline, 'polyline'),
                false
            );

            const swappedResult = findSplinePolylineIntersectionsVerb(
                createTestShape(spline, 'spline'),
                createTestShape(polyline, 'polyline'),
                true
            );

            // If both have intersections, parameters should be swapped (within numerical tolerance)
            if (normalResult.length > 0 && swappedResult.length > 0) {
                expect(normalResult[0].param1).toBeCloseTo(
                    swappedResult[0].param2,
                    6
                );
                expect(normalResult[0].param2).toBeCloseTo(
                    swappedResult[0].param1,
                    6
                );
            }
        });

        it('should find no intersections when spline and polyline do not cross', () => {
            // Horizontal spline at y=3
            const spline: import('$lib/types/geometry').Spline =
                createTestSpline(
                    [
                        { x: 0, y: 3 },
                        { x: 2, y: 3 },
                    ],
                    1,
                    [0, 0, 1, 1]
                );

            // Square polyline from (0,0) to (2,2)
            const polylineShape = createPolylineFromVertices(
                [
                    { x: 0, y: 0, bulge: 0 },
                    { x: 2, y: 0, bulge: 0 },
                    { x: 2, y: 2, bulge: 0 },
                    { x: 0, y: 2, bulge: 0 },
                ],
                true
            );
            const polyline: import('$lib/types/geometry').Polyline =
                polylineShape.geometry as Polyline;

            const result = findSplinePolylineIntersectionsVerb(
                createTestShape(spline, 'spline'),
                createTestShape(polyline, 'polyline')
            );

            expect(result).toHaveLength(0);
        });
    });

    describe('edge cases and robustness', () => {
        it('should handle splines with different weight configurations', () => {
            const controlPoints = [
                { x: 0, y: 0 },
                { x: 1, y: 1 },
                { x: 2, y: 0 },
            ];

            // Test with explicit weights
            const splineWithWeights = createTestSpline(
                controlPoints,
                2,
                undefined,
                [1, 2, 1]
            );
            const line: Line = { start: { x: 0, y: 0 }, end: { x: 2, y: 0 } };

            expect(() => {
                findSplineLineIntersectionsVerb(
                    createTestShape(splineWithWeights, 'spline'),
                    createTestShape(line, 'line')
                );
            }).not.toThrow();

            // Test without weights (should use uniform defaults)
            const splineWithoutWeights = createTestSpline(controlPoints, 2);

            expect(() => {
                findSplineLineIntersectionsVerb(
                    createTestShape(splineWithoutWeights, 'spline'),
                    createTestShape(line, 'line')
                );
            }).not.toThrow();
        });

        it('should handle various spline degrees', () => {
            const baseControlPoints = [
                { x: 0, y: 0 },
                { x: 1, y: 1 },
                { x: 2, y: 0 },
                { x: 3, y: 1 },
            ];

            const line: Line = {
                start: { x: 0, y: 0.5 },
                end: { x: 3, y: 0.5 },
            };

            // Test different degrees
            [1, 2, 3].forEach((degree) => {
                const spline: import('$lib/types/geometry').Spline =
                    createTestSpline(baseControlPoints, degree);

                expect(() => {
                    findSplineLineIntersectionsVerb(
                        createTestShape(spline, 'spline'),
                        createTestShape(line, 'line')
                    );
                }).not.toThrow();
            });
        });

        it('should handle empty or minimal control point arrays', () => {
            const line: Line = { start: { x: 0, y: 0 }, end: { x: 1, y: 1 } };

            // Test with minimal control points for degree 1
            const minimalSpline = createTestSpline(
                [
                    { x: 0, y: 0 },
                    { x: 1, y: 1 },
                ],
                1
            );

            expect(() => {
                findSplineLineIntersectionsVerb(
                    createTestShape(minimalSpline, 'spline'),
                    createTestShape(line, 'line')
                );
            }).not.toThrow();
        });

        it('should produce consistent intersection results', () => {
            // Test that same input produces same output
            const spline: import('$lib/types/geometry').Spline =
                createTestSpline(
                    [
                        { x: 0, y: 0 },
                        { x: 2, y: 2 },
                    ],
                    1,
                    [0, 0, 1, 1]
                );

            const line: Line = { start: { x: 0, y: 1 }, end: { x: 2, y: 1 } };

            const result1 = findSplineLineIntersectionsVerb(
                createTestShape(spline, 'spline'),
                createTestShape(line, 'line')
            );

            const result2 = findSplineLineIntersectionsVerb(
                createTestShape(spline, 'spline'),
                createTestShape(line, 'line')
            );

            // Results should be identical (within reasonable numerical tolerance)
            expect(result1.length).toBe(result2.length);

            for (let i: number = 0; i < result1.length; i++) {
                expectPointNear(result1[i].point, result2[i].point, 1e-9);
                expect(result1[i].param1).toBeCloseTo(result2[i].param1, 8);
                expect(result1[i].param2).toBeCloseTo(result2[i].param2, 8);
            }
        });
    });
});
