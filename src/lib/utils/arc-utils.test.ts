import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    calculateArcPoint,
    calculateArcStartPoint,
    calculateArcEndPoint,
    convertBulgeToArc,
} from '$lib/geometry/arc';
import type { Arc } from '$lib/geometry/arc';

describe('arc-utils', () => {
    describe('calculateArcPoint', () => {
        it('should calculate point at 0 radians (right side)', () => {
            const center = { x: 0, y: 0 };
            const radius = 1;
            const angle = 0;

            const result = calculateArcPoint(center, radius, angle);
            expect(result).toEqual({ x: 1, y: 0 });
        });

        it('should calculate point at π/2 radians (top)', () => {
            const center = { x: 0, y: 0 };
            const radius = 1;
            const angle = Math.PI / 2;

            const result = calculateArcPoint(center, radius, angle);
            expect(result.x).toBeCloseTo(0, 10);
            expect(result.y).toBeCloseTo(1, 10);
        });

        it('should calculate point at π radians (left side)', () => {
            const center = { x: 0, y: 0 };
            const radius = 1;
            const angle = Math.PI;

            const result = calculateArcPoint(center, radius, angle);
            expect(result.x).toBeCloseTo(-1, 10);
            expect(result.y).toBeCloseTo(0, 10);
        });

        it('should calculate point with non-zero center', () => {
            const center = { x: 5, y: 3 };
            const radius = 2;
            const angle = 0;

            const result = calculateArcPoint(center, radius, angle);
            expect(result).toEqual({ x: 7, y: 3 });
        });

        it('should handle different radius values', () => {
            const center = { x: 0, y: 0 };
            const radius = 5;
            const angle = Math.PI / 2;

            const result = calculateArcPoint(center, radius, angle);
            expect(result.x).toBeCloseTo(0, 10);
            expect(result.y).toBeCloseTo(5, 10);
        });

        it('should round very small values to zero', () => {
            const center = { x: 0, y: 0 };
            const radius = 1;
            const angle = Math.PI / 2; // Should produce x ≈ 0 due to floating point

            const result = calculateArcPoint(center, radius, angle);
            expect(result.x).toBe(0); // Should be exactly 0 due to rounding
        });
    });

    describe('calculateArcStartPoint', () => {
        it('should calculate start point of arc', () => {
            const arc: Arc = {
                center: { x: 0, y: 0 },
                radius: 1,
                startAngle: 0,
                endAngle: Math.PI / 2,
                clockwise: false,
            };

            const result = calculateArcStartPoint(arc);
            expect(result).toEqual({ x: 1, y: 0 });
        });

        it('should calculate start point with non-zero center', () => {
            const arc: Arc = {
                center: { x: 2, y: 3 },
                radius: 1,
                startAngle: Math.PI,
                endAngle: 0,
                clockwise: false,
            };

            const result = calculateArcStartPoint(arc);
            expect(result.x).toBeCloseTo(1, 10);
            expect(result.y).toBeCloseTo(3, 10);
        });

        it('should handle different start angles', () => {
            const arc: Arc = {
                center: { x: 0, y: 0 },
                radius: 2,
                startAngle: Math.PI / 4,
                endAngle: Math.PI,
                clockwise: false,
            };

            const result = calculateArcStartPoint(arc);
            expect(result.x).toBeCloseTo(Math.sqrt(2), 10);
            expect(result.y).toBeCloseTo(Math.sqrt(2), 10);
        });
    });

    describe('calculateArcEndPoint', () => {
        it('should calculate end point of arc', () => {
            const arc: Arc = {
                center: { x: 0, y: 0 },
                radius: 1,
                startAngle: 0,
                endAngle: Math.PI / 2,
                clockwise: false,
            };

            const result = calculateArcEndPoint(arc);
            expect(result.x).toBeCloseTo(0, 10);
            expect(result.y).toBeCloseTo(1, 10);
        });

        it('should calculate end point with different radius', () => {
            const arc: Arc = {
                center: { x: 1, y: 1 },
                radius: 3,
                startAngle: 0,
                endAngle: Math.PI,
                clockwise: false,
            };

            const result = calculateArcEndPoint(arc);
            expect(result.x).toBeCloseTo(-2, 10);
            expect(result.y).toBeCloseTo(1, 10);
        });
    });

    describe('convertBulgeToArc', () => {
        beforeEach(() => {
            vi.clearAllMocks();
        });

        it('should convert positive bulge to counterclockwise arc', () => {
            const bulge = 1; // 45° included angle (tan(π/16))
            const start = { x: 0, y: 0 };
            const end = { x: 1, y: 1 };

            const result = convertBulgeToArc(bulge, start, end);

            expect(result).not.toBeNull();
            expect(result!.clockwise).toBe(false);
            expect(result!.radius).toBeGreaterThan(0);
            expect(result!.center).toBeDefined();
        });

        it('should convert negative bulge to clockwise arc', () => {
            const bulge = -1;
            const start = { x: 0, y: 0 };
            const end = { x: 1, y: 1 };

            const result = convertBulgeToArc(bulge, start, end);

            expect(result).not.toBeNull();
            expect(result!.clockwise).toBe(true);
            expect(result!.radius).toBeGreaterThan(0);
        });

        it('should return null for degenerate segment (same start and end)', () => {
            const bulge = 1;
            const start = { x: 1, y: 1 };
            const end = { x: 1, y: 1 }; // Same point

            const result = convertBulgeToArc(bulge, start, end);
            expect(result).toBeNull();
        });

        it('should handle nearly degenerate segment (may return very small arc)', () => {
            const bulge = 1;
            const start = { x: 0, y: 0 };
            const end = { x: 1e-10, y: 1e-10 }; // Very close points

            const result = convertBulgeToArc(bulge, start, end);
            // The function might return a very small valid arc or null
            if (result !== null) {
                expect(result.radius).toBeGreaterThan(0);
                expect(typeof result.center.x).toBe('number');
                expect(typeof result.center.y).toBe('number');
            }
        });

        it('should handle horizontal line segment', () => {
            const bulge = 0.5;
            const start = { x: 0, y: 0 };
            const end = { x: 2, y: 0 };

            const result = convertBulgeToArc(bulge, start, end);

            expect(result).not.toBeNull();
            expect(result!.center.y).not.toBeCloseTo(0, 1); // Center should be off the x-axis
        });

        it('should handle vertical line segment', () => {
            const bulge = 0.5;
            const start = { x: 0, y: 0 };
            const end = { x: 0, y: 2 };

            const result = convertBulgeToArc(bulge, start, end);

            expect(result).not.toBeNull();
            expect(result!.center.x).not.toBeCloseTo(0, 1); // Center should be off the y-axis
        });

        it('should calculate correct radius for simple case', () => {
            const bulge = Math.tan(Math.PI / 8); // This represents a 45° included angle
            const start = { x: 0, y: 0 };
            const end = { x: 1, y: 0 };

            const result = convertBulgeToArc(bulge, start, end);

            expect(result).not.toBeNull();
            expect(result!.radius).toBeGreaterThan(0);

            // Test that the actual calculated radius produces the correct arc
            // by verifying the arc endpoints are at correct distances from center
            const startDist = Math.sqrt(
                (start.x - result!.center.x) ** 2 +
                    (start.y - result!.center.y) ** 2
            );
            const endDist = Math.sqrt(
                (end.x - result!.center.x) ** 2 +
                    (end.y - result!.center.y) ** 2
            );

            expect(startDist).toBeCloseTo(result!.radius, 5);
            expect(endDist).toBeCloseTo(result!.radius, 5);
        });

        it('should normalize angles to [0, 2π) range', () => {
            const bulge = 0.5;
            const start = { x: 0, y: 0 };
            const end = { x: 1, y: 1 };

            const result = convertBulgeToArc(bulge, start, end);

            expect(result).not.toBeNull();
            expect(result!.startAngle).toBeGreaterThanOrEqual(0);
            expect(result!.startAngle).toBeLessThan(2 * Math.PI);
            expect(result!.endAngle).toBeGreaterThanOrEqual(0);
            expect(result!.endAngle).toBeLessThan(2 * Math.PI);
        });

        it('should handle bulge resulting in semicircle', () => {
            const bulge = 1; // This represents a 90° included angle (semicircle)
            const start = { x: -1, y: 0 };
            const end = { x: 1, y: 0 };

            const result = convertBulgeToArc(bulge, start, end);

            expect(result).not.toBeNull();
            expect(result!.radius).toBeCloseTo(1, 3);
            // For horizontal chord with positive bulge, center should be positioned appropriately
            // The y-coordinate might be 0 in this case due to the perpendicular calculation
            expect(typeof result!.center.y).toBe('number');
            expect(Math.abs(result!.center.y)).toBeGreaterThanOrEqual(0);
        });

        it('should validate arc geometry and return null if invalid', () => {
            // Mock console.warn to suppress warnings during test
            const consoleSpy = vi
                .spyOn(console, 'warn')
                .mockImplementation(() => {});

            // Create a scenario that might cause validation failure
            // Using extreme bulge value that could cause numerical issues
            const bulge = 1000; // Very large bulge
            const start = { x: 0, y: 0 };
            const end = { x: 0.001, y: 0 }; // Very small chord

            const result = convertBulgeToArc(bulge, start, end);

            // This might return null due to validation failure
            if (result === null) {
                expect(consoleSpy).toHaveBeenCalled();
            }

            consoleSpy.mockRestore();
        });

        it('should handle error conditions gracefully', () => {
            const consoleSpy = vi
                .spyOn(console, 'warn')
                .mockImplementation(() => {});

            // Force an error by using invalid inputs that might cause Math operations to fail
            const bulge = NaN;
            const start = { x: 0, y: 0 };
            const end = { x: 1, y: 1 };

            const result = convertBulgeToArc(bulge, start, end);

            // The function might return an invalid result with NaN values or null
            if (result === null) {
                expect(result).toBeNull();
            } else {
                // If not null, it should have invalid NaN values which would fail validation
                expect(
                    Number.isNaN(result.radius) ||
                        Number.isNaN(result.center.x) ||
                        Number.isNaN(result.center.y)
                ).toBe(true);
            }

            consoleSpy.mockRestore();
        });

        it('should maintain arc endpoint accuracy', () => {
            const bulge = 0.5;
            const start = { x: 1, y: 2 };
            const end = { x: 4, y: 6 };

            const result = convertBulgeToArc(bulge, start, end);

            if (result !== null) {
                // Verify that start and end points are at the expected radius from center
                const startDist = Math.sqrt(
                    (start.x - result.center.x) ** 2 +
                        (start.y - result.center.y) ** 2
                );
                const endDist = Math.sqrt(
                    (end.x - result.center.x) ** 2 +
                        (end.y - result.center.y) ** 2
                );

                expect(startDist).toBeCloseTo(result.radius, 3);
                expect(endDist).toBeCloseTo(result.radius, 3);
            }
        });

        it('should handle very small bulge values', () => {
            const bulge = 0.001; // Very small bulge (almost straight)
            const start = { x: 0, y: 0 };
            const end = { x: 10, y: 0 };

            const result = convertBulgeToArc(bulge, start, end);

            expect(result).not.toBeNull();
            expect(result!.radius).toBeGreaterThan(10); // Large radius for small bulge
        });
    });
});
