import { describe, it, expect } from 'vitest';
import { EPSILON } from '../../constants';
import {
    tessellateEllipseWithConfig,
    evaluateEllipseAtParameter,
    calculateEllipseArcLength,
    createAdaptiveTessellationConfig,
    validateEllipseGeometry,
} from './functions';
import type { EllipseTessellationConfig, Ellipse } from './interfaces';

describe('Ellipse Tessellation', () => {
    // Test ellipse shapes with known properties
    const unitCircle: Ellipse = {
        center: { x: 0, y: 0 },
        majorAxisEndpoint: { x: 1, y: 0 }, // Unit radius along X-axis
        minorToMajorRatio: 1.0, // Circle (equal axes)
    };

    const horizontalEllipse: Ellipse = {
        center: { x: 10, y: 20 },
        majorAxisEndpoint: { x: 5, y: 0 }, // Major axis length = 5 along X
        minorToMajorRatio: 0.6, // Minor axis length = 3
    };

    const rotatedEllipse: Ellipse = {
        center: { x: 0, y: 0 },
        majorAxisEndpoint: { x: 3, y: 4 }, // Major axis length = 5, rotated
        minorToMajorRatio: 0.6, // Minor axis length = 3
    };

    const ellipseArc: Ellipse = {
        center: { x: 0, y: 0 },
        majorAxisEndpoint: { x: 2, y: 0 },
        minorToMajorRatio: 0.5,
        startParam: 0, // Start at rightmost point
        endParam: Math.PI, // End at leftmost point (semicircle)
    };

    describe('tessellateEllipse', () => {
        it('should generate correct number of points for full ellipse', () => {
            const config: EllipseTessellationConfig = { numPoints: 8 };
            const points = tessellateEllipseWithConfig(unitCircle, config);

            expect(points).toHaveLength(8);
        });

        it('should generate correct number of points for ellipse arc', () => {
            const config: EllipseTessellationConfig = { numPoints: 10 };
            const points = tessellateEllipseWithConfig(ellipseArc, config);

            // Arc should have numPoints + 1 points (including both endpoints)
            expect(points).toHaveLength(11);
        });

        it('should close path when requested for full ellipse', () => {
            const config: EllipseTessellationConfig = {
                numPoints: 6,
                closePath: true,
            };
            const points = tessellateEllipseWithConfig(unitCircle, config);

            // Should have original points + 1 duplicate of first point
            expect(points).toHaveLength(7);
            expect(points[0].x).toBeCloseTo(points[6].x, 10);
            expect(points[0].y).toBeCloseTo(points[6].y, 10);
        });

        it('should generate points on unit circle correctly', () => {
            const config: EllipseTessellationConfig = { numPoints: 4 };
            const points = tessellateEllipseWithConfig(unitCircle, config);

            // Should generate points at 0°, 90°, 180°, 270°
            expect(points[0].x).toBeCloseTo(1, 10); // 0° -> (1, 0)
            expect(points[0].y).toBeCloseTo(0, 10);

            expect(points[1].x).toBeCloseTo(0, 10); // 90° -> (0, 1)
            expect(points[1].y).toBeCloseTo(1, 10);

            expect(points[2].x).toBeCloseTo(-1, 10); // 180° -> (-1, 0)
            expect(points[2].y).toBeCloseTo(0, 10);

            expect(points[3].x).toBeCloseTo(0, 10); // 270° -> (0, -1)
            expect(points[3].y).toBeCloseTo(-1, 10);
        });

        it('should handle horizontal ellipse correctly', () => {
            const config: EllipseTessellationConfig = { numPoints: 4 };
            const points = tessellateEllipseWithConfig(
                horizontalEllipse,
                config
            );

            // Center at (10, 20), major axis = 5, minor axis = 3
            expect(points[0].x).toBeCloseTo(15, 10); // rightmost: center.x + majorAxis
            expect(points[0].y).toBeCloseTo(20, 10); // center.y

            expect(points[1].x).toBeCloseTo(10, 10); // top: center.x
            expect(points[1].y).toBeCloseTo(23, 10); // center.y + minorAxis

            expect(points[2].x).toBeCloseTo(5, 10); // leftmost: center.x - majorAxis
            expect(points[2].y).toBeCloseTo(20, 10); // center.y

            expect(points[3].x).toBeCloseTo(10, 10); // bottom: center.x
            expect(points[3].y).toBeCloseTo(17, 10); // center.y - minorAxis
        });

        it('should handle rotated ellipse correctly', () => {
            const config: EllipseTessellationConfig = { numPoints: 8 };
            const points = tessellateEllipseWithConfig(rotatedEllipse, config);

            // All points should be at correct distance from center
            points.forEach((point) => {
                const distanceFromCenter = Math.sqrt(
                    point.x * point.x + point.y * point.y
                );
                // Distance should be between minor and major axis lengths
                expect(distanceFromCenter).toBeGreaterThanOrEqual(2.99); // minor axis = 3
                expect(distanceFromCenter).toBeLessThanOrEqual(5.01); // major axis = 5
            });

            // First point should be at the major axis endpoint
            expect(points[0].x).toBeCloseTo(3, 10);
            expect(points[0].y).toBeCloseTo(4, 10);
        });

        it('should generate semicircle arc correctly', () => {
            const config: EllipseTessellationConfig = { numPoints: 4 };
            const points = tessellateEllipseWithConfig(ellipseArc, config);

            // Should have 5 points for semicircle (4 + 1)
            expect(points).toHaveLength(5);

            // First point at start parameter (0): rightmost
            expect(points[0].x).toBeCloseTo(2, 10);
            expect(points[0].y).toBeCloseTo(0, 10);

            // Last point at end parameter (π): leftmost
            expect(points[4].x).toBeCloseTo(-2, 10);
            expect(points[4].y).toBeCloseTo(0, 10);

            // Middle point should be at top of arc
            expect(points[2].x).toBeCloseTo(0, 10);
            expect(points[2].y).toBeCloseTo(1, 10); // minor axis = 1
        });

        it('should handle very small ellipses', () => {
            const tinyEllipse: Ellipse = {
                center: { x: 0, y: 0 },
                majorAxisEndpoint: { x: 0.001, y: 0 },
                minorToMajorRatio: 0.5,
            };

            const config: EllipseTessellationConfig = { numPoints: 4 };
            const points = tessellateEllipseWithConfig(tinyEllipse, config);

            expect(points).toHaveLength(4);
            // All points should be very close to center
            points.forEach((point) => {
                expect(Math.abs(point.x)).toBeLessThan(0.002);
                expect(Math.abs(point.y)).toBeLessThan(0.001);
            });
        });

        it('should handle edge case with single point', () => {
            const config: EllipseTessellationConfig = { numPoints: 1 };
            const points = tessellateEllipseWithConfig(unitCircle, config);

            expect(points).toHaveLength(1);
            expect(points[0].x).toBeCloseTo(1, 10);
            expect(points[0].y).toBeCloseTo(0, 10);
        });
    });

    describe('evaluateEllipseAtParameter', () => {
        it('should evaluate circle at cardinal points correctly', () => {
            const center = { x: 0, y: 0 };
            const majorAxis = 1;
            const minorAxis = 1;
            const rotation = 0;

            // Test cardinal directions
            const point0 = evaluateEllipseAtParameter(
                center,
                majorAxis,
                minorAxis,
                rotation,
                0
            );
            expect(point0.x).toBeCloseTo(1, 10);
            expect(point0.y).toBeCloseTo(0, 10);

            const pointPi2 = evaluateEllipseAtParameter(
                center,
                majorAxis,
                minorAxis,
                rotation,
                Math.PI / 2
            );
            expect(pointPi2.x).toBeCloseTo(0, 10);
            expect(pointPi2.y).toBeCloseTo(1, 10);

            const pointPi = evaluateEllipseAtParameter(
                center,
                majorAxis,
                minorAxis,
                rotation,
                Math.PI
            );
            expect(pointPi.x).toBeCloseTo(-1, 10);
            expect(pointPi.y).toBeCloseTo(0, 10);

            const point3Pi2 = evaluateEllipseAtParameter(
                center,
                majorAxis,
                minorAxis,
                rotation,
                (3 * Math.PI) / 2
            );
            expect(point3Pi2.x).toBeCloseTo(0, 10);
            expect(point3Pi2.y).toBeCloseTo(-1, 10);
        });

        it('should handle rotation correctly', () => {
            const center = { x: 0, y: 0 };
            const majorAxis = 2;
            const minorAxis = 1;
            const rotation = Math.PI / 4; // 45 degrees

            // At t=0, should be at major axis endpoint rotated by 45°
            const point = evaluateEllipseAtParameter(
                center,
                majorAxis,
                minorAxis,
                rotation,
                0
            );
            const expected45x = 2 * Math.cos(Math.PI / 4); // 2 * cos(45°) = √2
            const expected45y = 2 * Math.sin(Math.PI / 4); // 2 * sin(45°) = √2

            expect(point.x).toBeCloseTo(expected45x, 10);
            expect(point.y).toBeCloseTo(expected45y, 10);
        });

        it('should handle center offset correctly', () => {
            const center = { x: 10, y: 20 };
            const majorAxis = 3;
            const minorAxis = 2;
            const rotation = 0;

            const point = evaluateEllipseAtParameter(
                center,
                majorAxis,
                minorAxis,
                rotation,
                0
            );
            expect(point.x).toBeCloseTo(13, 10); // center.x + majorAxis
            expect(point.y).toBeCloseTo(20, 10); // center.y
        });
    });

    describe('calculateEllipseArcLength', () => {
        it('should calculate unit circle circumference correctly', () => {
            const length = calculateEllipseArcLength(unitCircle);
            expect(length).toBeCloseTo(2 * Math.PI, 2); // Should be very close to 2π
        });

        it('should calculate ellipse circumference using Ramanujan approximation', () => {
            // For ellipse with a=5, b=3, Ramanujan's approximation gives specific value
            const ellipse: Ellipse = {
                center: { x: 0, y: 0 },
                majorAxisEndpoint: { x: 5, y: 0 },
                minorToMajorRatio: 0.6, // b/a = 3/5
            };

            const length = calculateEllipseArcLength(ellipse);

            // Expected value using Ramanujan's formula
            const a = 5,
                b = 3;
            const h = Math.pow((a - b) / (a + b), 2);
            const expected =
                Math.PI * (a + b) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));

            expect(length).toBeCloseTo(expected, 10);
            expect(length).toBeGreaterThan(Math.PI * 2 * b); // Should be > minor circumference
            expect(length).toBeLessThan(Math.PI * 2 * a); // Should be < major circumference
        });

        it('should calculate arc length for semicircle correctly', () => {
            const length = calculateEllipseArcLength(ellipseArc);
            const fullLength = calculateEllipseArcLength({
                ...ellipseArc,
                startParam: undefined,
                endParam: undefined,
            });

            // Semicircle should be half the full circumference
            expect(length).toBeCloseTo(fullLength / 2, 10);
        });

        it('should handle quarter arc correctly', () => {
            const quarterArc: Ellipse = {
                center: { x: 0, y: 0 },
                majorAxisEndpoint: { x: 4, y: 0 },
                minorToMajorRatio: 0.75,
                startParam: 0,
                endParam: Math.PI / 2,
            };

            const length = calculateEllipseArcLength(quarterArc);
            const fullLength = calculateEllipseArcLength({
                ...quarterArc,
                startParam: undefined,
                endParam: undefined,
            });

            // Quarter arc should be 1/4 of full circumference
            expect(length).toBeCloseTo(fullLength / 4, 10);
        });
    });

    describe('createAdaptiveTessellationConfig', () => {
        it('should create reasonable config for unit circle', () => {
            const config = createAdaptiveTessellationConfig(unitCircle, 0.1);

            expect(config.numPoints).toBeGreaterThanOrEqual(8);
            expect(config.numPoints).toBeLessThanOrEqual(200);
            expect(config.closePath).toBe(true); // Full ellipse should close path
        });

        it('should create appropriate config for small tolerance', () => {
            const config = createAdaptiveTessellationConfig(unitCircle, 0.001);

            // Small tolerance should require more points
            expect(config.numPoints).toBeGreaterThan(20);
        });

        it('should create appropriate config for large tolerance', () => {
            const config = createAdaptiveTessellationConfig(unitCircle, 1.0);

            // Large tolerance should allow fewer points, but respect minimum
            expect(config.numPoints).toBeGreaterThanOrEqual(8);
            expect(config.numPoints).toBeLessThan(50);
        });

        it('should handle eccentric ellipse appropriately', () => {
            const eccentricEllipse: Ellipse = {
                center: { x: 0, y: 0 },
                majorAxisEndpoint: { x: 10, y: 0 },
                minorToMajorRatio: 0.1, // Very flat ellipse
            };

            const config = createAdaptiveTessellationConfig(
                eccentricEllipse,
                0.1
            );

            // Eccentric ellipse should need some points, but may be limited by minimum
            expect(config.numPoints).toBeGreaterThanOrEqual(8);
        });

        it('should not close path for arcs', () => {
            const config = createAdaptiveTessellationConfig(ellipseArc, 0.1);

            expect(config.closePath).toBe(false); // Arc should not close path
        });

        it('should respect minimum and maximum point limits', () => {
            const configMin = createAdaptiveTessellationConfig(
                unitCircle,
                10.0,
                5,
                100
            );
            expect(configMin.numPoints).toBeGreaterThanOrEqual(5);

            const configMax = createAdaptiveTessellationConfig(
                unitCircle,
                0.0001,
                10,
                50
            );
            expect(configMax.numPoints).toBeLessThanOrEqual(50);
        });
    });

    describe('validateEllipseGeometry', () => {
        it('should validate correct ellipse', () => {
            const errors = validateEllipseGeometry(unitCircle);
            expect(errors).toHaveLength(0);
        });

        it('should detect zero major axis', () => {
            const invalidEllipse: Ellipse = {
                center: { x: 0, y: 0 },
                majorAxisEndpoint: { x: 0, y: 0 }, // Zero length
                minorToMajorRatio: 0.5,
            };

            const errors = validateEllipseGeometry(invalidEllipse);
            expect(errors).toContain('Major axis length is zero or negative');
        });

        it('should detect negative minor to major ratio', () => {
            const invalidEllipse: Ellipse = {
                center: { x: 0, y: 0 },
                majorAxisEndpoint: { x: 1, y: 0 },
                minorToMajorRatio: -0.5, // Negative ratio
            };

            const errors = validateEllipseGeometry(invalidEllipse);
            expect(errors).toContain('Minor to major ratio must be positive');
        });

        it('should detect ratio greater than 1', () => {
            const invalidEllipse: Ellipse = {
                center: { x: 0, y: 0 },
                majorAxisEndpoint: { x: 1, y: 0 },
                minorToMajorRatio: 1.5, // Ratio > 1
            };

            const errors = validateEllipseGeometry(invalidEllipse);
            expect(errors).toContain(
                'Minor to major ratio cannot exceed 1 (minor axis cannot be larger than major axis)'
            );
        });

        it('should detect mismatched arc parameters', () => {
            const invalidEllipse: Ellipse = {
                center: { x: 0, y: 0 },
                majorAxisEndpoint: { x: 1, y: 0 },
                minorToMajorRatio: 0.5,
                startParam: 0, // Missing endParam
            };

            const errors = validateEllipseGeometry(invalidEllipse);
            expect(errors).toContain(
                'Both startParam and endParam must be specified for ellipse arcs, or neither for full ellipses'
            );
        });

        it('should detect infinite arc parameters', () => {
            const invalidEllipse: Ellipse = {
                center: { x: 0, y: 0 },
                majorAxisEndpoint: { x: 1, y: 0 },
                minorToMajorRatio: 0.5,
                startParam: 0,
                endParam: Infinity,
            };

            const errors = validateEllipseGeometry(invalidEllipse);
            expect(errors).toContain('Arc parameters must be finite numbers');
        });

        it('should detect zero arc parameter range', () => {
            const invalidEllipse: Ellipse = {
                center: { x: 0, y: 0 },
                majorAxisEndpoint: { x: 1, y: 0 },
                minorToMajorRatio: 0.5,
                startParam: Math.PI,
                endParam: Math.PI, // Same as start
            };

            const errors = validateEllipseGeometry(invalidEllipse);
            expect(errors).toContain(
                'Arc parameter range is too small (start and end parameters are too close)'
            );
        });

        it('should accumulate multiple errors', () => {
            const invalidEllipse: Ellipse = {
                center: { x: 0, y: 0 },
                majorAxisEndpoint: { x: 0, y: 0 }, // Zero major axis
                minorToMajorRatio: -0.5, // Negative ratio
                startParam: 0, // Missing endParam
            };

            const errors = validateEllipseGeometry(invalidEllipse);
            expect(errors.length).toBeGreaterThan(1);
        });
    });

    describe('Real-world usage scenarios', () => {
        it('should handle typical CAD ellipse accurately', () => {
            const cadEllipse: Ellipse = {
                center: { x: 100, y: 50 },
                majorAxisEndpoint: { x: 25, y: 0 }, // 25mm major axis
                minorToMajorRatio: 0.6, // 15mm minor axis
            };

            const config: EllipseTessellationConfig = { numPoints: 32 };
            const points = tessellateEllipseWithConfig(cadEllipse, config);

            expect(points).toHaveLength(32);

            // All points should be within expected bounds
            points.forEach((point) => {
                const dx: number = point.x - cadEllipse.center.x;
                const dy: number = point.y - cadEllipse.center.y;
                const distanceFromCenter = Math.sqrt(dx * dx + dy * dy);

                expect(distanceFromCenter).toBeGreaterThanOrEqual(14.9); // Minor axis ≈ 15
                expect(distanceFromCenter).toBeLessThanOrEqual(25.1); // Major axis = 25
            });
        });

        it('should handle precision requirements for manufacturing', () => {
            const precisionEllipse: Ellipse = {
                center: { x: 0, y: 0 },
                majorAxisEndpoint: { x: 10.0, y: 0 },
                minorToMajorRatio: 0.8,
            };

            // Generate high-precision tessellation
            const config = createAdaptiveTessellationConfig(
                precisionEllipse,
                0.001
            );
            const points = tessellateEllipseWithConfig(
                precisionEllipse,
                config
            );

            // Should generate enough points for the given tolerance
            expect(config.numPoints).toBeGreaterThan(30);

            // For full ellipse with closePath=true, expect one extra point
            const expectedLength = config.closePath
                ? config.numPoints + 1
                : config.numPoints;
            expect(points).toHaveLength(expectedLength);

            // All points should be within expected ellipse bounds
            points.forEach((point) => {
                const dx: number = point.x - precisionEllipse.center.x;
                const dy: number = point.y - precisionEllipse.center.y;
                const distanceFromCenter = Math.sqrt(dx * dx + dy * dy);

                expect(distanceFromCenter).toBeGreaterThanOrEqual(7.99); // Minor axis ≈ 8
                expect(distanceFromCenter).toBeLessThanOrEqual(10.01); // Major axis = 10
            });
        });

        it('should handle rotated ellipse for CNC machining', () => {
            // Ellipse rotated 30 degrees for machining path
            const rotationAngle = Math.PI / 6; // 30 degrees
            const machiningEllipse: Ellipse = {
                center: { x: 50, y: 25 },
                majorAxisEndpoint: {
                    x: 20 * Math.cos(rotationAngle),
                    y: 20 * Math.sin(rotationAngle),
                },
                minorToMajorRatio: 0.5,
            };

            const config: EllipseTessellationConfig = { numPoints: 64 };
            const points = tessellateEllipseWithConfig(
                machiningEllipse,
                config
            );

            // Verify rotation is preserved
            const firstPoint = points[0];
            const vectorFromCenter = {
                x: firstPoint.x - machiningEllipse.center.x,
                y: firstPoint.y - machiningEllipse.center.y,
            };

            const actualAngle = Math.atan2(
                vectorFromCenter.y,
                vectorFromCenter.x
            );
            expect(actualAngle).toBeCloseTo(rotationAngle, 5);
        });
    });

    describe('Edge cases and error conditions', () => {
        it('should handle extremely small ellipses without numerical issues', () => {
            const microEllipse: Ellipse = {
                center: { x: 0, y: 0 },
                majorAxisEndpoint: { x: 1e-6, y: 0 },
                minorToMajorRatio: 0.5,
            };

            const config: EllipseTessellationConfig = { numPoints: 8 };
            const points = tessellateEllipseWithConfig(microEllipse, config);

            expect(points).toHaveLength(8);
            points.forEach((point) => {
                expect(isFinite(point.x)).toBe(true);
                expect(isFinite(point.y)).toBe(true);
                expect(Math.abs(point.x)).toBeLessThan(2e-6);
                expect(Math.abs(point.y)).toBeLessThan(1e-6);
            });
        });

        it('should handle very large ellipses', () => {
            const giantEllipse: Ellipse = {
                center: { x: 0, y: 0 },
                majorAxisEndpoint: { x: 1e6, y: 0 },
                minorToMajorRatio: 0.5,
            };

            const config: EllipseTessellationConfig = { numPoints: 4 };
            const points = tessellateEllipseWithConfig(giantEllipse, config);

            expect(points).toHaveLength(4);
            points.forEach((point) => {
                expect(isFinite(point.x)).toBe(true);
                expect(isFinite(point.y)).toBe(true);
            });

            // Check magnitude is as expected
            expect(Math.abs(points[0].x)).toBeCloseTo(1e6, 0);
        });

        it('should handle ellipse arc spanning more than 2π', () => {
            const multiTurnArc: Ellipse = {
                center: { x: 0, y: 0 },
                majorAxisEndpoint: { x: 1, y: 0 },
                minorToMajorRatio: 0.5,
                startParam: 0,
                endParam: 4 * Math.PI, // Two full turns
            };

            const config: EllipseTessellationConfig = { numPoints: 16 };
            const points = tessellateEllipseWithConfig(multiTurnArc, config);

            // Should still generate valid points
            expect(points).toHaveLength(17); // 16 + 1 for arc
            points.forEach((point) => {
                expect(isFinite(point.x)).toBe(true);
                expect(isFinite(point.y)).toBe(true);
            });
        });

        it('should handle zero number of points gracefully', () => {
            const config: EllipseTessellationConfig = { numPoints: 0 };
            const points = tessellateEllipseWithConfig(unitCircle, config);

            // Should return empty array for zero points
            expect(points).toHaveLength(0);
        });

        it('should handle nearly degenerate ellipse (very small minor axis)', () => {
            const nearlyDegenerate: Ellipse = {
                center: { x: 0, y: 0 },
                majorAxisEndpoint: { x: 10, y: 0 },
                minorToMajorRatio: EPSILON, // Extremely small minor axis
            };

            const config: EllipseTessellationConfig = { numPoints: 8 };
            const points = tessellateEllipseWithConfig(
                nearlyDegenerate,
                config
            );

            expect(points).toHaveLength(8);

            // Points should form nearly a line segment
            points.forEach((point) => {
                expect(Math.abs(point.y)).toBeLessThan(1e-8); // Very close to x-axis
                expect(Math.abs(point.x)).toBeLessThanOrEqual(10.1); // Within major axis bounds
            });
        });
    });
});
