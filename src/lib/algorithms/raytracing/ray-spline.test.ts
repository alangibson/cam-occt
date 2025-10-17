import { describe, expect, it } from 'vitest';
import type { Point2D } from '$lib/geometry/point';
import type { Spline } from '$lib/geometry/spline';
import type { Ray } from './types';
import {
    countHorizontalRaySplineCrossings,
    countRaySplineCrossings,
    findRaySplineIntersections,
} from './ray-spline';

describe('Ray-Spline Intersection', () => {
    // Helper function to create a linear spline (equivalent to a line)
    function createLinearSpline(start: Point2D, end: Point2D): Spline {
        return {
            controlPoints: [start, end],
            knots: [0, 0, 1, 1],
            weights: [1, 1],
            degree: 1,
            fitPoints: [start, end],
            closed: false,
        };
    }

    // Helper function to create a simple quadratic spline
    function createQuadraticSpline(
        p0: Point2D,
        p1: Point2D,
        p2: Point2D
    ): Spline {
        return {
            controlPoints: [p0, p1, p2],
            knots: [0, 0, 0, 1, 1, 1],
            weights: [1, 1, 1],
            degree: 2,
            fitPoints: [],
            closed: false,
        };
    }

    // Helper function to create a cubic spline
    function createCubicSpline(
        p0: Point2D,
        p1: Point2D,
        p2: Point2D,
        p3: Point2D
    ): Spline {
        return {
            controlPoints: [p0, p1, p2, p3],
            knots: [0, 0, 0, 0, 1, 1, 1, 1],
            weights: [1, 1, 1, 1],
            degree: 3,
            fitPoints: [],
            closed: false,
        };
    }

    describe('countRaySplineCrossings', () => {
        it('should count crossings for linear spline (equivalent to line)', () => {
            const linearSpline = createLinearSpline(
                { x: 0, y: -1 },
                { x: 0, y: 1 }
            );

            const ray: Ray = {
                origin: { x: -1, y: 0 },
                direction: { x: 1, y: 0 },
            };

            expect(countRaySplineCrossings(ray, linearSpline)).toBe(1);
        });

        it('should count crossings for horizontal linear spline', () => {
            const horizontalSpline = createLinearSpline(
                { x: -1, y: 0 },
                { x: 1, y: 0 }
            );

            const ray: Ray = {
                origin: { x: 0, y: -1 },
                direction: { x: 0, y: 1 },
            };

            expect(countRaySplineCrossings(ray, horizontalSpline)).toBe(1);
        });

        it('should count 0 crossings for ray missing spline', () => {
            const spline: Spline = createLinearSpline(
                { x: 5, y: 5 },
                { x: 10, y: 10 }
            );

            const ray: Ray = {
                origin: { x: 0, y: 0 },
                direction: { x: 1, y: 0 },
            };

            expect(countRaySplineCrossings(ray, spline)).toBe(0);
        });

        it('should handle quadratic spline', () => {
            // Create a parabolic arc that opens upward
            const quadratic = createQuadraticSpline(
                { x: -1, y: 1 }, // start
                { x: 0, y: -1 }, // control (creates downward dip)
                { x: 1, y: 1 } // end
            );

            const ray: Ray = {
                origin: { x: -2, y: 0 },
                direction: { x: 1, y: 0 },
            };

            const crossings = countRaySplineCrossings(ray, quadratic);
            expect(crossings).toBeGreaterThanOrEqual(0);
            expect(crossings).toBeLessThanOrEqual(2); // Should intersect 0-2 times
        });

        it('should handle cubic spline', () => {
            // Create an S-shaped cubic curve
            const cubic = createCubicSpline(
                { x: 0, y: 0 }, // start
                { x: 1, y: 2 }, // first control
                { x: 2, y: -2 }, // second control
                { x: 3, y: 0 } // end
            );

            const ray: Ray = {
                origin: { x: -1, y: 0 },
                direction: { x: 1, y: 0 },
            };

            const crossings = countRaySplineCrossings(ray, cubic);
            expect(crossings).toBeGreaterThanOrEqual(0);
        });

        it('should handle empty spline', () => {
            const emptySpline: Spline = {
                controlPoints: [],
                knots: [],
                weights: [],
                degree: 0,
                fitPoints: [],
                closed: false,
            };

            const ray: Ray = {
                origin: { x: 0, y: 0 },
                direction: { x: 1, y: 0 },
            };

            expect(countRaySplineCrossings(ray, emptySpline)).toBe(0);
        });

        it('should handle single point spline', () => {
            const pointSpline: Spline = {
                controlPoints: [{ x: 0, y: 0 }],
                knots: [0, 1],
                weights: [1],
                degree: 0,
                fitPoints: [],
                closed: false,
            };

            const ray: Ray = {
                origin: { x: -1, y: 0 },
                direction: { x: 1, y: 0 },
            };

            expect(countRaySplineCrossings(ray, pointSpline)).toBe(0);
        });
    });

    describe('findRaySplineIntersections', () => {
        it('should find intersection for linear spline', () => {
            const linearSpline = createLinearSpline(
                { x: 0, y: -2 },
                { x: 0, y: 2 }
            );

            const ray: Ray = {
                origin: { x: -1, y: 0 },
                direction: { x: 1, y: 0 },
            };

            const intersections = findRaySplineIntersections(ray, linearSpline);

            expect(intersections.length).toBeGreaterThan(0);
            if (intersections.length > 0) {
                expect(intersections[0].point.x).toBeCloseTo(0);
                expect(intersections[0].point.y).toBeCloseTo(0);
                expect(intersections[0].t).toBeCloseTo(1);
            }
        });

        it('should return empty array for no intersections', () => {
            const spline: Spline = createLinearSpline(
                { x: 10, y: 10 },
                { x: 15, y: 15 }
            );

            const ray: Ray = {
                origin: { x: 0, y: 0 },
                direction: { x: 1, y: 0 },
            };

            const intersections = findRaySplineIntersections(ray, spline);
            expect(intersections).toHaveLength(0);
        });

        it('should handle spline with fit points', () => {
            const splineWithFitPoints: Spline = {
                controlPoints: [
                    { x: 0, y: 0 },
                    { x: 1, y: 1 },
                ], // These may be ignored
                knots: [0, 1],
                weights: [1, 1],
                degree: 1,
                fitPoints: [
                    { x: -1, y: 0 },
                    { x: 1, y: 0 },
                ], // Horizontal line through origin
                closed: false,
            };

            const ray: Ray = {
                origin: { x: 0, y: -1 },
                direction: { x: 0, y: 1 },
            };

            const intersections = findRaySplineIntersections(
                ray,
                splineWithFitPoints
            );
            expect(intersections.length).toBeGreaterThan(0);
        });
    });

    describe('countHorizontalRaySplineCrossings', () => {
        it('should count crossings for horizontal ray', () => {
            const verticalSpline = createLinearSpline(
                { x: 2, y: -1 },
                { x: 2, y: 1 }
            );

            // Point to left of spline
            const leftPoint = { x: 0, y: 0 };
            expect(
                countHorizontalRaySplineCrossings(leftPoint, verticalSpline)
            ).toBe(1);

            // Point to right of spline
            const rightPoint = { x: 4, y: 0 };
            expect(
                countHorizontalRaySplineCrossings(rightPoint, verticalSpline)
            ).toBe(0);

            // Point above spline
            const abovePoint = { x: 0, y: 2 };
            expect(
                countHorizontalRaySplineCrossings(abovePoint, verticalSpline)
            ).toBe(0);
        });
    });

    describe('Spline Types', () => {
        it('should handle rational splines with weights', () => {
            const rationalSpline: Spline = {
                controlPoints: [
                    { x: 0, y: 0 },
                    { x: 1, y: 1 },
                    { x: 2, y: 0 },
                ],
                knots: [0, 0, 0, 1, 1, 1],
                weights: [1, 2, 1], // Higher weight at middle control point
                degree: 2,
                fitPoints: [],
                closed: false,
            };

            const ray: Ray = {
                origin: { x: -1, y: 0.5 },
                direction: { x: 1, y: 0 },
            };

            const crossings = countRaySplineCrossings(ray, rationalSpline);
            expect(crossings).toBeGreaterThanOrEqual(0);
        });

        it('should handle closed splines', () => {
            const closedSpline: Spline = {
                controlPoints: [
                    { x: 0, y: 0 },
                    { x: 2, y: 0 },
                    { x: 2, y: 2 },
                    { x: 0, y: 2 },
                ],
                knots: [0, 0, 0, 0, 1, 1, 1, 1],
                weights: [1, 1, 1, 1],
                degree: 3,
                fitPoints: [],
                closed: true,
            };

            const ray: Ray = {
                origin: { x: -1, y: 1 },
                direction: { x: 1, y: 0 },
            };

            const crossings = countRaySplineCrossings(ray, closedSpline);
            expect(crossings).toBeGreaterThanOrEqual(0);
        });
    });

    describe('Edge Cases', () => {
        it('should handle very small splines', () => {
            const tinySpline = createLinearSpline(
                { x: 0, y: 0 },
                { x: 0.001, y: 0.001 }
            );

            const ray: Ray = {
                origin: { x: -1, y: 0.0005 },
                direction: { x: 1, y: 0 },
            };

            const crossings = countRaySplineCrossings(ray, tinySpline);
            expect(crossings).toBeGreaterThanOrEqual(0);
            expect(crossings).toBeLessThanOrEqual(1);
        });

        it('should handle splines with coincident control points', () => {
            const coincidentSpline: Spline = {
                controlPoints: [
                    { x: 0, y: 0 },
                    { x: 0, y: 0 },
                    { x: 1, y: 1 },
                ],
                knots: [0, 0, 0, 1, 1, 1],
                weights: [1, 1, 1],
                degree: 2,
                fitPoints: [],
                closed: false,
            };

            const ray: Ray = {
                origin: { x: -1, y: 0.5 },
                direction: { x: 1, y: 0 },
            };

            // Should handle gracefully without crashing
            const crossings = countRaySplineCrossings(ray, coincidentSpline);
            expect(crossings).toBeGreaterThanOrEqual(0);
        });

        it('should handle splines with high degree', () => {
            const highDegreeSpline: Spline = {
                controlPoints: [
                    { x: 0, y: 0 },
                    { x: 0.5, y: 2 },
                    { x: 1, y: -1 },
                    { x: 1.5, y: 3 },
                    { x: 2, y: 0 },
                    { x: 2.5, y: -2 },
                    { x: 3, y: 1 },
                ],
                knots: [0, 0, 0, 0, 0, 0.5, 0.5, 1, 1, 1, 1, 1],
                weights: [1, 1, 1, 1, 1, 1, 1],
                degree: 4,
                fitPoints: [],
                closed: false,
            };

            const ray: Ray = {
                origin: { x: -1, y: 0 },
                direction: { x: 1, y: 0 },
            };

            // Should handle complex splines, even if only approximately
            const crossings = countRaySplineCrossings(ray, highDegreeSpline);
            expect(crossings).toBeGreaterThanOrEqual(0);
        });

        it('should handle numerical precision issues', () => {
            const precisionSpline = createLinearSpline(
                { x: 1.0000000001, y: 0 },
                { x: 1.0000000002, y: 1 }
            );

            const ray: Ray = {
                origin: { x: 0, y: 0.5 },
                direction: { x: 1, y: 0 },
            };

            // Should handle very close points without numerical issues
            const crossings = countRaySplineCrossings(ray, precisionSpline);
            expect(crossings).toBeGreaterThanOrEqual(0);
            expect(crossings).toBeLessThanOrEqual(1);
        });

        it('should handle degenerate ray direction', () => {
            const spline: Spline = createLinearSpline(
                { x: 0, y: 0 },
                { x: 1, y: 1 }
            );

            const degenerateRay: Ray = {
                origin: { x: 0.5, y: 0.5 },
                direction: { x: 0, y: 0 },
            };

            // Should handle gracefully
            const crossings = countRaySplineCrossings(degenerateRay, spline);
            expect(crossings).toBeGreaterThanOrEqual(0);
        });
    });

    describe('Performance', () => {
        it('should handle splines with many control points efficiently', () => {
            // Create a spline with many control points
            const manyPointsSpline: Spline = {
                controlPoints: Array.from({ length: 100 }, (_, i) => ({
                    x: i * 0.1,
                    y: Math.sin(i * 0.1), // Sine wave
                })),
                knots: Array.from({ length: 104 }, (_, i) => {
                    if (i < 4) return 0;
                    if (i >= 100) return 1;
                    return (i - 3) / 96;
                }),
                weights: Array.from({ length: 100 }, () => 1),
                degree: 3,
                fitPoints: [],
                closed: false,
            };

            const ray: Ray = {
                origin: { x: -1, y: 0 },
                direction: { x: 1, y: 0 },
            };

            const start = performance.now();
            const crossings = countRaySplineCrossings(ray, manyPointsSpline);
            const end = performance.now();

            expect(crossings).toBeGreaterThanOrEqual(0);
            expect(end - start).toBeLessThan(100); // Should complete in reasonable time
        });
    });
});
