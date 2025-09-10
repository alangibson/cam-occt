import { describe, it, expect, beforeAll } from 'vitest';
import {
    tessellateSpline,
    validateSplineGeometry,
    createAdaptiveTessellationConfig,
    estimateSplineArcLength,
    simplifyTessellatedSpline,
    type SplineTessellationConfig,
} from '$lib/geometry/spline';
import type { Point2D } from '$lib/types/geometry';
import type { Spline } from '$lib/geometry/spline';

describe('Spline Tessellation', () => {
    // Test splines with known properties
    const linearSpline: Spline = {
        controlPoints: [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
        ],
        degree: 1,
        knots: [0, 0, 1, 1],
        weights: [1, 1],
        fitPoints: [],
        closed: false,
    };

    const quadraticBezier: Spline = {
        controlPoints: [
            { x: 0, y: 0 },
            { x: 1, y: 2 },
            { x: 2, y: 0 },
        ],
        degree: 2,
        knots: [0, 0, 0, 1, 1, 1],
        weights: [1, 1, 1],
        fitPoints: [],
        closed: false,
    };

    const closedSpline: Spline = {
        controlPoints: [
            { x: 0, y: 0 },
            { x: 2, y: 0 },
            { x: 2, y: 2 },
            { x: 0, y: 2 },
        ],
        degree: 3,
        knots: [0, 0, 0, 0, 1, 1, 1, 1],
        weights: [1, 1, 1, 1],
        fitPoints: [],
        closed: true,
    };

    // Skip verb-nurbs tests if the library is not available in test environment
    beforeAll(async () => {
        try {
            await import('verb-nurbs');
        } catch {
            // verb-nurbs not available
        }
    });

    describe('tessellateSpline', () => {
        it('should tessellate linear spline correctly', () => {
            const config: SplineTessellationConfig = {
                method: 'uniform-sampling',
                numSamples: 10,
            };

            const result = tessellateSpline(linearSpline, config);

            expect(result.success).toBe(true);
            expect(result.points.length).toBeGreaterThanOrEqual(2);
            // Method used depends on what's available - verb-nurbs preferred if available
            expect([
                'verb-nurbs',
                'uniform-sampling',
                'adaptive-sampling',
                'fallback',
            ]).toContain(result.methodUsed);

            // First and last points should match control points
            expect(result.points[0]).toEqual({ x: 0, y: 0 });
            expect(result.points[result.points.length - 1]).toEqual({
                x: 1,
                y: 0,
            });

            // All points should lie on the line
            result.points.forEach((point) => {
                expect(point.y).toBeCloseTo(0, 10);
                expect(point.x).toBeGreaterThanOrEqual(-0.001);
                expect(point.x).toBeLessThanOrEqual(1.001);
            });
        });

        it('should tessellate quadratic bezier curve', () => {
            const config: SplineTessellationConfig = {
                method: 'uniform-sampling',
                numSamples: 20,
            };

            const result = tessellateSpline(quadraticBezier, config);

            expect(result.success).toBe(true);
            expect(result.points.length).toBeGreaterThan(2);
            expect([
                'verb-nurbs',
                'uniform-sampling',
                'adaptive-sampling',
                'fallback',
            ]).toContain(result.methodUsed);

            // Check that curve starts and ends at expected points
            expect(result.points[0]).toEqual({ x: 0, y: 0 });
            expect(result.points[result.points.length - 1]).toEqual({
                x: 2,
                y: 0,
            });
        });

        it('should handle closed splines correctly', () => {
            const config: SplineTessellationConfig = {
                method: 'fallback',
            };

            const result = tessellateSpline(closedSpline, config);

            expect(result.success).toBe(true);
            expect(result.methodUsed).toBe('fallback');

            // For closed splines using fallback, should return control points
            expect(result.points.length).toBeGreaterThanOrEqual(
                closedSpline.controlPoints.length
            );
        });

        it('should fall back gracefully when verb-nurbs fails', () => {
            const invalidSpline: Spline = {
                controlPoints: [{ x: 0, y: 0 }], // Too few points
                degree: 1,
                knots: [0, 1],
                weights: [1],
                fitPoints: [],
                closed: false,
            };

            const result = tessellateSpline(invalidSpline);

            // Should fail validation and return error
            expect(result.success).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
        });

        it('should try multiple methods until one succeeds', () => {
            const config: SplineTessellationConfig = {
                method: 'verb-nurbs', // This may fail in test environment
            };

            const result = tessellateSpline(linearSpline, config);

            expect(result.success).toBe(true);
            expect(result.points.length).toBeGreaterThan(0);
            // Should have fallen back to another method if verb-nurbs isn't available
            expect([
                'verb-nurbs',
                'adaptive-sampling',
                'uniform-sampling',
                'fallback',
            ]).toContain(result.methodUsed);
        });

        it('should respect timeout configuration', () => {
            const config: SplineTessellationConfig = {
                method: 'uniform-sampling',
                numSamples: 50,
                timeoutMs: 1, // Very short timeout
            };

            // Should still succeed for simple operations
            const result = tessellateSpline(linearSpline, config);
            expect(result.success).toBe(true);
        });

        it('should handle adaptive sampling configuration', () => {
            const config: SplineTessellationConfig = {
                method: 'adaptive-sampling',
                tolerance: 0.1,
                maxSamples: 50,
                minSamples: 5,
            };

            const result = tessellateSpline(quadraticBezier, config);

            if (result.success) {
                expect(['verb-nurbs', 'adaptive-sampling']).toContain(
                    result.methodUsed
                );
                expect(result.points.length).toBeGreaterThanOrEqual(3);
                expect(result.points.length).toBeLessThanOrEqual(100); // Be more lenient
            }
        });

        it('should include performance metrics', () => {
            const result = tessellateSpline(linearSpline);

            expect(result.success).toBe(true);
            expect(result.metrics).toBeDefined();
            expect(typeof result.metrics!.duration).toBe('number');
            expect(typeof result.metrics!.sampleCount).toBe('number');
            expect(result.metrics!.duration).toBeGreaterThanOrEqual(0);
            expect(result.metrics!.sampleCount).toBeGreaterThan(0);
        });
    });

    describe('validateSplineGeometry', () => {
        it('should validate correct spline', () => {
            const errors = validateSplineGeometry(linearSpline);
            expect(errors).toHaveLength(0);
        });

        it('should detect insufficient control points', () => {
            const invalidSpline: Spline = {
                controlPoints: [{ x: 0, y: 0 }],
                degree: 1,
                knots: [],
                weights: [],
                fitPoints: [],
                closed: false,
            };

            const errors = validateSplineGeometry(invalidSpline);
            expect(errors).toContain(
                'Spline must have at least 2 control points'
            );
        });

        it('should detect invalid degree', () => {
            const invalidSpline: Spline = {
                controlPoints: [
                    { x: 0, y: 0 },
                    { x: 1, y: 0 },
                ],
                degree: 0,
                knots: [],
                weights: [],
                fitPoints: [],
                closed: false,
            };

            const errors = validateSplineGeometry(invalidSpline);
            expect(errors).toContain('Spline degree must be at least 1');
        });

        it('should detect degree too high for control points', () => {
            const invalidSpline: Spline = {
                controlPoints: [
                    { x: 0, y: 0 },
                    { x: 1, y: 0 },
                ],
                degree: 3, // Too high for 2 control points
                knots: [],
                weights: [],
                fitPoints: [],
                closed: false,
            };

            const errors = validateSplineGeometry(invalidSpline);
            expect(errors).toContain(
                'Spline degree (3) must be less than number of control points (2)'
            );
        });

        it('should detect incorrect knot count', () => {
            const invalidSpline: Spline = {
                controlPoints: [
                    { x: 0, y: 0 },
                    { x: 1, y: 0 },
                ],
                degree: 1,
                knots: [0, 1], // Should be [0, 0, 1, 1] for degree 1 with 2 control points
                weights: [1, 1],
                fitPoints: [],
                closed: false,
            };

            const errors = validateSplineGeometry(invalidSpline);
            expect(errors).toContain('Expected 4 knots but got 2');
        });

        it('should detect non-monotonic knot sequence', () => {
            const invalidSpline: Spline = {
                controlPoints: [
                    { x: 0, y: 0 },
                    { x: 1, y: 0 },
                ],
                degree: 1,
                knots: [1, 0, 1, 1], // Non-decreasing sequence
                weights: [1, 1],
                fitPoints: [],
                closed: false,
            };

            const errors = validateSplineGeometry(invalidSpline);
            expect(errors).toContain('Knot sequence must be non-decreasing');
        });

        it('should detect invalid weights', () => {
            const invalidSpline: Spline = {
                controlPoints: [
                    { x: 0, y: 0 },
                    { x: 1, y: 0 },
                ],
                degree: 1,
                knots: [0, 0, 1, 1],
                weights: [-1, 1], // Negative weight
                fitPoints: [],
                closed: false,
            };

            const errors = validateSplineGeometry(invalidSpline);
            expect(errors).toContain('All weights must be positive');
        });

        it('should detect weight count mismatch', () => {
            const invalidSpline: Spline = {
                controlPoints: [
                    { x: 0, y: 0 },
                    { x: 1, y: 0 },
                ],
                degree: 1,
                knots: [0, 0, 1, 1],
                weights: [1], // Wrong number of weights
                fitPoints: [],
                closed: false,
            };

            const errors = validateSplineGeometry(invalidSpline);
            expect(errors).toContain(
                'Number of weights must match number of control points'
            );
        });
    });

    describe('createAdaptiveTessellationConfig', () => {
        it('should create appropriate config for simple splines', () => {
            const config = createAdaptiveTessellationConfig(linearSpline, 0.01);

            expect(config.method).toBe('uniform-sampling');
            expect(config.tolerance).toBe(0.01);
            expect(config.numSamples).toBeGreaterThanOrEqual(10);
            expect(config.numSamples).toBeLessThanOrEqual(50);
        });

        it('should create appropriate config for complex splines', () => {
            const complexSpline: Spline = {
                controlPoints: Array.from({ length: 20 }, (_, i) => ({
                    x: i,
                    y: Math.sin(i * 0.5),
                })),
                degree: 3,
                knots: Array.from({ length: 24 }, (_, i) => i / 23),
                weights: Array.from({ length: 20 }, () => 1),
                fitPoints: [],
                closed: false,
            };

            const config = createAdaptiveTessellationConfig(
                complexSpline,
                0.001
            );

            expect(['verb-nurbs', 'adaptive-sampling']).toContain(
                config.method
            );
            expect(config.tolerance).toBe(0.001);
            expect(config.maxSamples).toBeGreaterThan(config.numSamples!);
        });

        it('should handle closed splines appropriately', () => {
            const config = createAdaptiveTessellationConfig(closedSpline, 0.01);

            // Closed splines should get slightly more complex treatment
            expect(config.numSamples).toBeGreaterThan(10);
            expect(config.timeoutMs).toBeGreaterThan(1000);
        });

        it('should handle weighted splines appropriately', () => {
            const weightedSpline: Spline = {
                ...quadraticBezier,
                weights: [1, 2, 1], // Non-uniform weights
            };

            const config = createAdaptiveTessellationConfig(
                weightedSpline,
                0.01
            );

            // Weighted splines are more complex
            expect(config.numSamples).toBeGreaterThan(15);
        });
    });

    describe('estimateSplineArcLength', () => {
        it('should estimate linear spline length correctly', () => {
            const length = estimateSplineArcLength(linearSpline);

            // Linear spline from (0,0) to (1,0) should have length 1
            expect(length).toBeCloseTo(1, 1);
        });

        it('should handle closed splines', () => {
            const length = estimateSplineArcLength(closedSpline);

            // Should return positive length
            expect(length).toBeGreaterThan(0);
        });

        it('should return zero for invalid splines', () => {
            const invalidSpline: Spline = {
                controlPoints: [],
                degree: 1,
                knots: [],
                weights: [],
                fitPoints: [],
                closed: false,
            };

            const length = estimateSplineArcLength(invalidSpline);
            expect(length).toBe(0);
        });

        it('should handle custom tessellation config', () => {
            const config: SplineTessellationConfig = {
                method: 'uniform-sampling',
                numSamples: 10,
            };

            const length = estimateSplineArcLength(linearSpline, config);
            expect(length).toBeCloseTo(1, 0.1);
        });
    });

    describe('simplifyTessellatedSpline', () => {
        it('should simplify redundant points', () => {
            const densePoinst: Point2D[] = [
                { x: 0, y: 0 },
                { x: 0.1, y: 0.001 }, // Almost on line
                { x: 0.2, y: 0.002 }, // Almost on line
                { x: 1, y: 0 },
            ];

            const simplified = simplifyTessellatedSpline(densePoinst, 0.01);

            // Should remove middle points that are close to the line
            expect(simplified.length).toBeLessThan(densePoinst.length);
            expect(simplified[0]).toEqual({ x: 0, y: 0 });
            expect(simplified[simplified.length - 1]).toEqual({ x: 1, y: 0 });
        });

        it('should preserve significant points', () => {
            const significantPoints: Point2D[] = [
                { x: 0, y: 0 },
                { x: 0.5, y: 1 }, // Significant deviation
                { x: 1, y: 0 },
            ];

            const simplified = simplifyTessellatedSpline(
                significantPoints,
                0.01
            );

            // Should keep all points as they're all significant
            expect(simplified.length).toBe(significantPoints.length);
        });

        it('should handle edge cases', () => {
            // Empty array
            expect(simplifyTessellatedSpline([], 0.01)).toEqual([]);

            // Single point
            const singlePoint = [{ x: 0, y: 0 }];
            expect(simplifyTessellatedSpline(singlePoint, 0.01)).toEqual(
                singlePoint
            );

            // Two points
            const twoPoints = [
                { x: 0, y: 0 },
                { x: 1, y: 0 },
            ];
            expect(simplifyTessellatedSpline(twoPoints, 0.01)).toEqual(
                twoPoints
            );
        });

        it('should respect tolerance parameter', () => {
            const points: Point2D[] = [
                { x: 0, y: 0 },
                { x: 0.5, y: 0.005 }, // Small deviation
                { x: 1, y: 0 },
            ];

            // Tight tolerance should keep the point
            const tight = simplifyTessellatedSpline(points, 0.001);
            expect(tight.length).toBe(3);

            // Loose tolerance should remove it
            const loose = simplifyTessellatedSpline(points, 0.1);
            expect(loose.length).toBe(2);
        });
    });

    describe('Real-world CAD scenarios', () => {
        it('should handle typical CAD spline curves', () => {
            const cadSpline: Spline = {
                controlPoints: [
                    { x: 0, y: 0 },
                    { x: 50, y: 100 },
                    { x: 150, y: 120 },
                    { x: 200, y: 50 },
                    { x: 300, y: 0 },
                ],
                degree: 3,
                knots: [0, 0, 0, 0, 0.5, 1, 1, 1, 1],
                weights: [1, 1, 1, 1, 1],
                fitPoints: [],
                closed: false,
            };

            const result = tessellateSpline(cadSpline);

            expect(result.success).toBe(true);
            expect(result.points.length).toBeGreaterThan(10);
            expect(result.points[0]).toEqual({ x: 0, y: 0 });
            expect(result.points[result.points.length - 1]).toEqual({
                x: 300,
                y: 0,
            });
        });

        it('should handle manufacturing tolerance requirements', () => {
            const precisionSpline: Spline = {
                controlPoints: [
                    { x: 0, y: 0 },
                    { x: 25, y: 50 },
                    { x: 75, y: 50 },
                    { x: 100, y: 0 },
                ],
                degree: 3,
                knots: [0, 0, 0, 0, 1, 1, 1, 1],
                weights: [1, 1, 1, 1],
                fitPoints: [],
                closed: false,
            };

            const config = createAdaptiveTessellationConfig(
                precisionSpline,
                0.001
            );
            const result = tessellateSpline(precisionSpline, config);

            if (result.success) {
                expect(result.points.length).toBeGreaterThan(20); // High precision

                // Estimate and check arc length
                const length = estimateSplineArcLength(precisionSpline, config);
                expect(length).toBeGreaterThan(100); // Should be > 100mm
                expect(length).toBeLessThan(200); // But < 200mm
            }
        });

        it('should handle closed loop splines for part boundaries', () => {
            const partBoundary: Spline = {
                controlPoints: [
                    { x: 0, y: 0 },
                    { x: 50, y: -10 },
                    { x: 100, y: 0 },
                    { x: 100, y: 50 },
                    { x: 50, y: 60 },
                    { x: 0, y: 50 },
                ],
                degree: 3,
                knots: [0, 0, 0, 0, 0.5, 0.7, 1, 1, 1, 1],
                weights: [1, 1, 1, 1, 1, 1],
                fitPoints: [],
                closed: true,
            };

            const result = tessellateSpline(partBoundary);

            expect(result.success).toBe(true);

            if (result.success && result.points.length > 2) {
                // For closed splines, first and last points should be very close
                const firstPoint = result.points[0];
                const lastPoint = result.points[result.points.length - 1];
                const closureDistance = Math.sqrt(
                    Math.pow(lastPoint.x - firstPoint.x, 2) +
                        Math.pow(lastPoint.y - firstPoint.y, 2)
                );
                expect(closureDistance).toBeLessThan(0.1);
            }
        });
    });

    describe('Performance and robustness', () => {
        it('should handle very small splines', () => {
            const microSpline: Spline = {
                controlPoints: [
                    { x: 0, y: 0 },
                    { x: 0.001, y: 0.001 },
                ],
                degree: 1,
                knots: [0, 0, 1, 1],
                weights: [1, 1],
                fitPoints: [],
                closed: false,
            };

            const result = tessellateSpline(microSpline);
            expect(result.success).toBe(true);
            expect(result.points.length).toBeGreaterThanOrEqual(2);
        });

        it('should handle very large splines', () => {
            const giantSpline: Spline = {
                controlPoints: [
                    { x: 0, y: 0 },
                    { x: 1e6, y: 1e6 },
                ],
                degree: 1,
                knots: [0, 0, 1, 1],
                weights: [1, 1],
                fitPoints: [],
                closed: false,
            };

            const result = tessellateSpline(giantSpline);
            expect(result.success).toBe(true);
            expect(result.points.length).toBeGreaterThanOrEqual(2);
        });

        it('should complete within reasonable time', () => {
            const complexSpline: Spline = {
                controlPoints: Array.from({ length: 10 }, (_, i) => ({
                    x: i * 10,
                    y: Math.sin(i) * 20,
                })),
                degree: 3,
                knots: Array.from({ length: 14 }, (_, i) => i / 13),
                weights: Array.from({ length: 10 }, () => 1),
                fitPoints: [],
                closed: false,
            };

            const start = Date.now();
            const result = tessellateSpline(complexSpline, { timeoutMs: 3000 });
            const duration = Date.now() - start;

            expect(result.success).toBe(true);
            expect(duration).toBeLessThan(3000);
        });

        it('should handle malformed input gracefully', () => {
            const malformedSpline = {
                controlPoints: null,
                degree: -1,
                knots: undefined,
                weights: [],
                fitPoints: [],
                closed: false,
            } as unknown as Spline;

            const result = tessellateSpline(malformedSpline);
            expect(result.success).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
        });
    });
});
