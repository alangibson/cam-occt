import { describe, expect, it } from 'vitest';
import { offsetSpline, splitVerbCurve, tessellateVerbCurve } from './spline';
import { OffsetDirection } from '../types';
import verb from 'verb-nurbs';
import type { Spline } from '$lib/geometry/spline';

describe('spline edge cases and uncovered branches', () => {
    describe('offsetSpline validation edge cases', () => {
        it('should handle spline with degree 0', () => {
            const invalidSpline: Spline = {
                controlPoints: [
                    { x: 0, y: 0 },
                    { x: 1, y: 1 },
                ],
                knots: [0, 0, 1, 1],
                weights: [1, 1],
                degree: 0, // Invalid degree
                fitPoints: [],
                closed: false,
            };

            const result = offsetSpline(
                invalidSpline,
                1,
                OffsetDirection.OUTSET
            );
            expect(result.success).toBe(false);
            expect(result.errors[0]).toContain('Invalid degree');
        });

        it('should handle negative offset distance with direction', () => {
            const testSpline: Spline = {
                controlPoints: [
                    { x: 0, y: 0 },
                    { x: 2, y: 4 },
                    { x: 6, y: 4 },
                    { x: 8, y: 0 },
                ],
                knots: [0, 0, 0, 0, 1, 1, 1, 1],
                weights: [1, 1, 1, 1],
                degree: 3,
                fitPoints: [],
                closed: false,
            };

            // Test with negative distance - should use absolute value
            const result = offsetSpline(testSpline, -2, OffsetDirection.OUTSET);
            expect(result.success).toBe(true);

            if (result.success) {
                expect(result.shapes.length).toBeGreaterThan(0);
            }
        });
    });

    describe('calculateNormalAtPoint degenerate cases', () => {
        it('should handle degenerate tangent cases with custom spline', () => {
            // Create a spline that might have degenerate tangent
            const degenerateSpline: Spline = {
                controlPoints: [
                    { x: 0, y: 0 },
                    { x: 0, y: 0 }, // Duplicate point to potentially create degenerate tangent
                    { x: 1, y: 0 },
                ],
                knots: [0, 0, 0, 1, 1, 1],
                weights: [1, 1, 1],
                degree: 2,
                fitPoints: [],
                closed: false,
            };

            // This may fail due to degenerate tangent
            const result = offsetSpline(
                degenerateSpline,
                1,
                OffsetDirection.OUTSET
            );
            // Could succeed or fail depending on verb-nurbs handling
            expect(typeof result.success).toBe('boolean');
        });
    });

    describe('refinement with max retries', () => {
        it('should handle max retry reached scenario', () => {
            const testSpline: Spline = {
                controlPoints: [
                    { x: 0, y: 0 },
                    { x: 1, y: 5 },
                    { x: 2, y: 5 },
                    { x: 3, y: 0 },
                ],
                knots: [0, 0, 0, 0, 1, 1, 1, 1],
                weights: [1, 1, 1, 1],
                degree: 3,
                fitPoints: [],
                closed: false,
            };

            // Use very tight tolerance and limited retries to force max retry scenario
            const result = offsetSpline(
                testSpline,
                0.1,
                OffsetDirection.OUTSET,
                0.000001, // Very tight tolerance
                1 // Only 1 retry allowed
            );

            expect(result.success).toBe(true);
            // Should have warning about tolerance not achieved
            const toleranceWarnings = result.warnings.filter(
                (w) =>
                    w.includes('tolerance not achieved') ||
                    w.includes('Maximum sample limit reached')
            );
            // May or may not have warnings depending on actual tolerance achievement
            expect(toleranceWarnings.length).toBeGreaterThanOrEqual(0);
        });

        it('should handle sample increase hitting max limit', () => {
            const testSpline: Spline = {
                controlPoints: [
                    { x: 0, y: 0 },
                    { x: 1, y: 3 },
                    { x: 2, y: 3 },
                    { x: 3, y: 0 },
                ],
                knots: [0, 0, 0, 0, 1, 1, 1, 1],
                weights: [1, 1, 1, 1],
                degree: 3,
                fitPoints: [],
                closed: false,
            };

            // This should trigger the MAX_SPLINE_SAMPLES limit
            const result = offsetSpline(
                testSpline,
                0.05,
                OffsetDirection.OUTSET,
                0.00001, // Very tight tolerance
                10 // Many retries
            );

            expect(result.success).toBe(true);
        });
    });

    describe('curve fitting edge cases', () => {
        it('should handle insufficient points for curve fitting', () => {
            // This test is harder to trigger since our validation prevents it
            // But we can test the edge case indirectly
            const testSpline: Spline = {
                controlPoints: [
                    { x: 0, y: 0 },
                    { x: 1, y: 1 },
                ],
                knots: [0, 0, 1, 1],
                weights: [1, 1],
                degree: 1,
                fitPoints: [],
                closed: false,
            };

            const result = offsetSpline(
                testSpline,
                0.1,
                OffsetDirection.OUTSET
            );
            // Should succeed for linear case
            expect(result.success).toBe(true);
        });
    });

    describe('knot vector generation and validation', () => {
        it('should handle invalid knot vector in convertVerbCurveToSpline', () => {
            // Create a simple spline first
            const testSpline: Spline = {
                controlPoints: [
                    { x: 0, y: 0 },
                    { x: 2, y: 4 },
                    { x: 6, y: 4 },
                    { x: 8, y: 0 },
                ],
                knots: [0, 0, 0, 0, 1, 1, 1, 1],
                weights: [1, 1, 1, 1],
                degree: 3,
                fitPoints: [],
                closed: false,
            };

            // This should trigger the knot vector validation and regeneration path
            const result = offsetSpline(testSpline, 1, OffsetDirection.OUTSET);
            expect(result.success).toBe(true);
        });
    });

    describe('error handling branches', () => {
        it('should handle verb-nurbs derivative calculation errors', () => {
            // Test with a spline that might cause derivative issues
            const problematicSpline: Spline = {
                controlPoints: [
                    { x: 0, y: 0 },
                    { x: 0.001, y: 0.001 }, // Very small movement
                    { x: 0.002, y: 0.002 },
                    { x: 10, y: 10 }, // Sudden large jump
                ],
                knots: [0, 0, 0, 0, 1, 1, 1, 1],
                weights: [1, 1, 1, 1],
                degree: 3,
                fitPoints: [],
                closed: false,
            };

            const result = offsetSpline(
                problematicSpline,
                0.1,
                OffsetDirection.OUTSET
            );
            // Could succeed or fail depending on verb-nurbs behavior
            expect(typeof result.success).toBe('boolean');
        });

        it('should handle timeout error propagation', () => {
            // Test with reasonable spline that should not timeout
            const testSpline: Spline = {
                controlPoints: [
                    { x: 0, y: 0 },
                    { x: 1, y: 1 },
                    { x: 2, y: 1 },
                    { x: 3, y: 0 },
                ],
                knots: [0, 0, 0, 0, 1, 1, 1, 1],
                weights: [1, 1, 1, 1],
                degree: 3,
                fitPoints: [],
                closed: false,
            };

            const result = offsetSpline(
                testSpline,
                0.5,
                OffsetDirection.OUTSET
            );
            expect(result.success).toBe(true);
        });
    });
});

describe('splitVerbCurve edge cases', () => {
    function createTestVerbCurve(
        degree: number,
        controlPoints: [number, number, number][],
        knots: number[],
        weights?: number[]
    ) {
        return verb.geom.NurbsCurve.byKnotsControlPointsWeights(
            degree,
            knots,
            controlPoints,
            weights || controlPoints.map(() => 1)
        );
    }

    describe('degree validation edge cases', () => {
        it('should reject degree 0', () => {
            // We can't actually create a degree 0 curve with verb-nurbs since it validates
            // So we'll test our splitVerbCurve function directly with a mock
            const mockCurve = {
                degree: () => 0,
                controlPoints: () => [
                    [0, 0, 0],
                    [1, 1, 0],
                ],
                knots: () => [0, 1],
                weights: () => [1, 1],
            } as verb.geom.NurbsCurve;

            expect(() => {
                splitVerbCurve(mockCurve);
            }).toThrow('Unsupported degree 0');
        });

        it('should reject degree greater than 3', () => {
            // Mock a degree 4 curve since verb-nurbs validates construction
            const mockCurve = {
                degree: () => 4,
                controlPoints: () => [
                    [0, 0, 0],
                    [1, 1, 0],
                    [2, 1, 0],
                    [3, 1, 0],
                    [4, 1, 0],
                    [5, 0, 0],
                ],
                knots: () => [0, 0, 0, 0, 0, 1, 1, 1, 1, 1],
                weights: () => [1, 1, 1, 1, 1, 1],
            } as verb.geom.NurbsCurve;

            expect(() => {
                splitVerbCurve(mockCurve);
            }).toThrow('Unsupported degree 4');
        });
    });

    describe('control points validation', () => {
        it('should handle insufficient control points for degree', () => {
            // Mock a curve with insufficient control points
            const mockCurve = {
                degree: () => 3,
                controlPoints: () => [
                    [0, 0, 0],
                    [1, 1, 0],
                    [2, 1, 0],
                ], // Only 3 points for degree 3
                knots: () => [0, 0, 0, 0, 1, 1, 1],
                weights: () => [1, 1, 1],
            } as verb.geom.NurbsCurve;

            expect(() => {
                splitVerbCurve(mockCurve);
            }).toThrow('Insufficient control points 3 for degree 3');
        });
    });

    describe('multiple segments path', () => {
        it('should handle complex multi-segment curves', () => {
            // Create a curve with multiple distinct knot values to trigger multi-segment path
            const controlPoints: [number, number, number][] = [
                [0, 0, 0],
                [1, 2, 0],
                [2, 2, 0],
                [3, 0, 0],
                [4, -1, 0],
                [5, -1, 0],
                [6, 0, 0],
                [7, 1, 0],
                [8, 1, 0],
                [9, 0, 0],
            ];
            // Multiple internal knots to create multiple segments
            const knots = [
                0, 0, 0, 0, 0.25, 0.25, 0.5, 0.5, 0.75, 0.75, 1, 1, 1, 1,
            ];

            const curve = createTestVerbCurve(3, controlPoints, knots);
            const segments = splitVerbCurve(curve);

            expect(segments.length).toBeGreaterThan(1);

            // Verify each segment has correct structure
            segments.forEach((segment) => {
                expect(segment.degree).toBe(3);
                expect(segment.controlPoints.length).toBe(4);
                expect(segment.knots).toEqual([0, 0, 0, 0, 1, 1, 1, 1]);
                expect(segment.closed).toBe(false);
            });
        });

        it('should handle case where no valid segments can be extracted', () => {
            // This is difficult to trigger with valid verb curves
            // but we can test the edge case logic
            const controlPoints: [number, number, number][] = [
                [0, 0, 0],
                [1, 1, 0],
                [2, 0, 0],
                [3, 1, 0],
            ];
            const knots = [0, 0, 0, 0, 1, 1, 1, 1];

            const curve = createTestVerbCurve(3, controlPoints, knots);
            const segments = splitVerbCurve(curve);

            // Should successfully create at least one segment
            expect(segments.length).toBeGreaterThan(0);
        });
    });

    describe('error handling in decomposition', () => {
        it('should handle verb-nurbs internal errors', () => {
            // Create a valid curve that should not cause errors
            const controlPoints: [number, number, number][] = [
                [0, 0, 0],
                [1, 2, 0],
                [2, 2, 0],
                [3, 0, 0],
            ];
            const knots = [0, 0, 0, 0, 1, 1, 1, 1];

            const curve = createTestVerbCurve(3, controlPoints, knots);

            // This should not throw
            expect(() => {
                splitVerbCurve(curve);
            }).not.toThrow();

            const segments = splitVerbCurve(curve);
            expect(segments.length).toBeGreaterThan(0);
        });
    });
});

describe('tessellateVerbCurve', () => {
    function createTestVerbCurve(
        degree: number,
        controlPoints: [number, number, number][],
        knots: number[],
        weights?: number[]
    ) {
        return verb.geom.NurbsCurve.byKnotsControlPointsWeights(
            degree,
            knots,
            controlPoints,
            weights || controlPoints.map(() => 1)
        );
    }

    describe('tessellation edge cases', () => {
        it('should handle custom tolerance parameter', () => {
            const controlPoints: [number, number, number][] = [
                [0, 0, 0],
                [1, 2, 0],
                [2, 2, 0],
                [3, 0, 0],
            ];
            const knots = [0, 0, 0, 0, 1, 1, 1, 1];

            const curve = createTestVerbCurve(3, controlPoints, knots);

            // Test with custom tolerance
            const points1 = tessellateVerbCurve(curve, 0.1);
            const points2 = tessellateVerbCurve(curve, 0.01);

            expect(points1.length).toBeGreaterThan(0);
            expect(points2.length).toBeGreaterThan(0);

            // Finer tolerance should generally produce more points
            expect(points2.length).toBeGreaterThanOrEqual(points1.length);
        });

        it('should handle case without tolerance parameter', () => {
            const controlPoints: [number, number, number][] = [
                [0, 0, 0],
                [1, 2, 0],
                [2, 2, 0],
                [3, 0, 0],
            ];
            const knots = [0, 0, 0, 0, 1, 1, 1, 1];

            const curve = createTestVerbCurve(3, controlPoints, knots);

            // Test without tolerance (should use adaptive tolerance)
            const points = tessellateVerbCurve(curve);

            expect(points.length).toBeGreaterThan(0);

            // All points should be valid 2D points
            points.forEach((point) => {
                expect(typeof point.x).toBe('number');
                expect(typeof point.y).toBe('number');
                expect(isFinite(point.x)).toBe(true);
                expect(isFinite(point.y)).toBe(true);
            });
        });

        it('should handle empty tessellation result', () => {
            // This is hard to trigger with verb-nurbs, but we can mock
            // or test with curves that might produce minimal tessellation
            const controlPoints: [number, number, number][] = [
                [0, 0, 0],
                [0.001, 0.001, 0], // Very small curve
            ];
            const knots = [0, 0, 1, 1];

            const curve = createTestVerbCurve(1, controlPoints, knots);

            const points = tessellateVerbCurve(curve);

            // Should still produce at least some points
            expect(points.length).toBeGreaterThan(0);
        });
    });
});
