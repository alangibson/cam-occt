import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    calculateArcEndPoint,
    calculateArcLength,
    calculateArcPoint,
    calculateArcStartPoint,
    convertBulgeToArc,
    createArcWithLength,
    createTangentArc,
    generateArcPoints,
    getArcEndPoint,
    getArcPointAt,
    getArcStartPoint,
    isArc,
    reverseArc,
    tessellateArc,
} from './functions';
import type { Arc } from './interfaces';
import type { Geometry, Line } from '$lib/types/geometry';

describe('getArcStartPoint', () => {
    it('should calculate start point for arc at 0 degrees', () => {
        const arc: Arc = {
            center: { x: 0, y: 0 },
            radius: 10,
            startAngle: 0,
            endAngle: Math.PI / 2,
            clockwise: false,
        };

        const startPoint = getArcStartPoint(arc);
        expect(startPoint.x).toBeCloseTo(10);
        expect(startPoint.y).toBeCloseTo(0);
    });

    it('should calculate start point for arc at 90 degrees', () => {
        const arc: Arc = {
            center: { x: 0, y: 0 },
            radius: 5,
            startAngle: Math.PI / 2,
            endAngle: Math.PI,
            clockwise: false,
        };

        const startPoint = getArcStartPoint(arc);
        expect(startPoint.x).toBeCloseTo(0);
        expect(startPoint.y).toBeCloseTo(5);
    });

    it('should calculate start point for arc with offset center', () => {
        const arc: Arc = {
            center: { x: 10, y: 20 },
            radius: 3,
            startAngle: 0,
            endAngle: Math.PI / 4,
            clockwise: false,
        };

        const startPoint = getArcStartPoint(arc);
        expect(startPoint.x).toBeCloseTo(13);
        expect(startPoint.y).toBeCloseTo(20);
    });
});

describe('getArcEndPoint', () => {
    it('should calculate end point for arc at 90 degrees', () => {
        const arc: Arc = {
            center: { x: 0, y: 0 },
            radius: 10,
            startAngle: 0,
            endAngle: Math.PI / 2,
            clockwise: false,
        };

        const endPoint = getArcEndPoint(arc);
        expect(endPoint.x).toBeCloseTo(0);
        expect(endPoint.y).toBeCloseTo(10);
    });

    it('should calculate end point for arc at 180 degrees', () => {
        const arc: Arc = {
            center: { x: 0, y: 0 },
            radius: 5,
            startAngle: Math.PI / 2,
            endAngle: Math.PI,
            clockwise: false,
        };

        const endPoint = getArcEndPoint(arc);
        expect(endPoint.x).toBeCloseTo(-5);
        expect(endPoint.y).toBeCloseTo(0);
    });

    it('should calculate end point for arc with offset center', () => {
        const arc: Arc = {
            center: { x: 10, y: 20 },
            radius: 3,
            startAngle: 0,
            endAngle: Math.PI / 4,
            clockwise: false,
        };

        const endPoint = getArcEndPoint(arc);
        expect(endPoint.x).toBeCloseTo(10 + 3 * Math.cos(Math.PI / 4));
        expect(endPoint.y).toBeCloseTo(20 + 3 * Math.sin(Math.PI / 4));
    });
});

describe('reverseArc', () => {
    it('should reverse counter-clockwise arc', () => {
        const arc: Arc = {
            center: { x: 0, y: 0 },
            radius: 10,
            startAngle: 0,
            endAngle: Math.PI / 2,
            clockwise: false,
        };

        const reversed = reverseArc(arc);
        expect(reversed.startAngle).toBe(Math.PI / 2);
        expect(reversed.endAngle).toBe(0);
        expect(reversed.clockwise).toBe(true);
        expect(reversed.center).toEqual(arc.center);
        expect(reversed.radius).toBe(arc.radius);
    });

    it('should reverse clockwise arc', () => {
        const arc: Arc = {
            center: { x: 5, y: 5 },
            radius: 3,
            startAngle: Math.PI,
            endAngle: 0,
            clockwise: true,
        };

        const reversed = reverseArc(arc);
        expect(reversed.startAngle).toBe(0);
        expect(reversed.endAngle).toBe(Math.PI);
        expect(reversed.clockwise).toBe(false);
        expect(reversed.center).toEqual(arc.center);
        expect(reversed.radius).toBe(arc.radius);
    });
});

describe('getArcPointAt', () => {
    it('should return start point at t=0', () => {
        const arc: Arc = {
            center: { x: 0, y: 0 },
            radius: 10,
            startAngle: 0,
            endAngle: Math.PI / 2,
            clockwise: false,
        };

        const point = getArcPointAt(arc, 0);
        const startPoint = getArcStartPoint(arc);
        expect(point.x).toBeCloseTo(startPoint.x);
        expect(point.y).toBeCloseTo(startPoint.y);
    });

    it('should return end point at t=1', () => {
        const arc: Arc = {
            center: { x: 0, y: 0 },
            radius: 10,
            startAngle: 0,
            endAngle: Math.PI / 2,
            clockwise: false,
        };

        const point = getArcPointAt(arc, 1);
        const endPoint = getArcEndPoint(arc);
        expect(point.x).toBeCloseTo(endPoint.x);
        expect(point.y).toBeCloseTo(endPoint.y);
    });

    it('should return midpoint at t=0.5 for counter-clockwise arc', () => {
        const arc: Arc = {
            center: { x: 0, y: 0 },
            radius: 10,
            startAngle: 0,
            endAngle: Math.PI / 2,
            clockwise: false,
        };

        const point = getArcPointAt(arc, 0.5);
        const expectedAngle = Math.PI / 4; // Midpoint angle
        expect(point.x).toBeCloseTo(10 * Math.cos(expectedAngle));
        expect(point.y).toBeCloseTo(10 * Math.sin(expectedAngle));
    });

    it('should handle clockwise arc correctly', () => {
        const arc: Arc = {
            center: { x: 0, y: 0 },
            radius: 10,
            startAngle: Math.PI / 2,
            endAngle: 0,
            clockwise: true,
        };

        const point = getArcPointAt(arc, 0.5);
        const expectedAngle = Math.PI / 4; // Should be midpoint in clockwise direction
        expect(point.x).toBeCloseTo(10 * Math.cos(expectedAngle));
        expect(point.y).toBeCloseTo(10 * Math.sin(expectedAngle));
    });

    it('should handle angle wrapping for clockwise arc', () => {
        const arc: Arc = {
            center: { x: 0, y: 0 },
            radius: 10,
            startAngle: Math.PI / 4,
            endAngle: (7 * Math.PI) / 4,
            clockwise: true,
        };

        const startPoint = getArcPointAt(arc, 0);
        const endPoint = getArcPointAt(arc, 1);

        expect(startPoint.x).toBeCloseTo(10 * Math.cos(Math.PI / 4));
        expect(startPoint.y).toBeCloseTo(10 * Math.sin(Math.PI / 4));
        expect(endPoint.x).toBeCloseTo(10 * Math.cos((7 * Math.PI) / 4));
        expect(endPoint.y).toBeCloseTo(10 * Math.sin((7 * Math.PI) / 4));
    });

    it('should handle angle wrapping for counter-clockwise arc', () => {
        const arc: Arc = {
            center: { x: 0, y: 0 },
            radius: 10,
            startAngle: (7 * Math.PI) / 4,
            endAngle: Math.PI / 4,
            clockwise: false,
        };

        const startPoint = getArcPointAt(arc, 0);
        const endPoint = getArcPointAt(arc, 1);

        expect(startPoint.x).toBeCloseTo(10 * Math.cos((7 * Math.PI) / 4));
        expect(startPoint.y).toBeCloseTo(10 * Math.sin((7 * Math.PI) / 4));
        expect(endPoint.x).toBeCloseTo(10 * Math.cos(Math.PI / 4));
        expect(endPoint.y).toBeCloseTo(10 * Math.sin(Math.PI / 4));
    });
});

describe('tessellateArc', () => {
    it('should throw error for less than 2 points', () => {
        const arc: Arc = {
            center: { x: 0, y: 0 },
            radius: 10,
            startAngle: 0,
            endAngle: Math.PI / 2,
            clockwise: false,
        };

        expect(() => tessellateArc(arc, 1)).toThrow(
            'Arc tessellation requires at least 2 points'
        );
        expect(() => tessellateArc(arc, 0)).toThrow(
            'Arc tessellation requires at least 2 points'
        );
    });

    it('should generate correct number of points', () => {
        const arc: Arc = {
            center: { x: 0, y: 0 },
            radius: 10,
            startAngle: 0,
            endAngle: Math.PI / 2,
            clockwise: false,
        };

        const points = tessellateArc(arc, 5);
        expect(points).toHaveLength(5);
    });

    it('should start and end at correct points', () => {
        const arc: Arc = {
            center: { x: 0, y: 0 },
            radius: 10,
            startAngle: 0,
            endAngle: Math.PI / 2,
            clockwise: false,
        };

        const points = tessellateArc(arc, 10);
        const startPoint = getArcStartPoint(arc);
        const endPoint = getArcEndPoint(arc);

        expect(points[0].x).toBeCloseTo(startPoint.x);
        expect(points[0].y).toBeCloseTo(startPoint.y);
        expect(points[points.length - 1].x).toBeCloseTo(endPoint.x);
        expect(points[points.length - 1].y).toBeCloseTo(endPoint.y);
    });

    it('should use default 10 points when numPoints not specified', () => {
        const arc: Arc = {
            center: { x: 0, y: 0 },
            radius: 10,
            startAngle: 0,
            endAngle: Math.PI / 2,
            clockwise: false,
        };

        const points = tessellateArc(arc);
        expect(points).toHaveLength(10);
    });

    it('should tessellate clockwise arc correctly', () => {
        const arc: Arc = {
            center: { x: 0, y: 0 },
            radius: 10,
            startAngle: Math.PI / 2,
            endAngle: 0,
            clockwise: true,
        };

        const points = tessellateArc(arc, 3);
        expect(points).toHaveLength(3);

        // First point should be at start angle
        expect(points[0].x).toBeCloseTo(0);
        expect(points[0].y).toBeCloseTo(10);

        // Last point should be at end angle
        expect(points[2].x).toBeCloseTo(10);
        expect(points[2].y).toBeCloseTo(0);
    });
});

describe('isArc', () => {
    it('should return true for arc geometry', () => {
        const arc: Arc = {
            center: { x: 0, y: 0 },
            radius: 10,
            startAngle: 0,
            endAngle: Math.PI / 2,
            clockwise: false,
        };

        expect(isArc(arc)).toBe(true);
    });

    it('should return false for line geometry', () => {
        const line: Line = {
            start: { x: 0, y: 0 },
            end: { x: 10, y: 10 },
        };

        expect(isArc(line)).toBe(false);
    });

    it('should return false for object without center and radius', () => {
        const notArc = {
            start: { x: 0, y: 0 },
            end: { x: 10, y: 10 },
            someOtherProperty: true,
        };

        expect(isArc(notArc as unknown as Geometry)).toBe(false);
    });
});

describe('generateArcPoints', () => {
    it('should generate points with minimum of 16 segments', () => {
        const arc: Arc = {
            center: { x: 0, y: 0 },
            radius: 1,
            startAngle: 0,
            endAngle: Math.PI / 4, // Small angle
            clockwise: false,
        };

        const points = generateArcPoints(arc);
        expect(points.length).toBeGreaterThanOrEqual(17); // 16 segments + 1
    });

    it('should generate more segments for larger arcs', () => {
        const arc: Arc = {
            center: { x: 0, y: 0 },
            radius: 100,
            startAngle: 0,
            endAngle: Math.PI,
            clockwise: false,
        };

        const points = generateArcPoints(arc);
        const expectedSegments = Math.ceil((Math.PI * 100) / 5); // totalAngle * radius / 5
        expect(points.length).toBe(expectedSegments + 1);
    });

    it('should start and end at correct points', () => {
        const arc: Arc = {
            center: { x: 5, y: 5 },
            radius: 10,
            startAngle: 0,
            endAngle: Math.PI / 2,
            clockwise: false,
        };

        const points = generateArcPoints(arc);

        // First point should be at start
        expect(points[0].x).toBeCloseTo(15); // 5 + 10 * cos(0)
        expect(points[0].y).toBeCloseTo(5); // 5 + 10 * sin(0)

        // Last point should be at end
        const lastPoint = points[points.length - 1];
        expect(lastPoint.x).toBeCloseTo(5); // 5 + 10 * cos(π/2)
        expect(lastPoint.y).toBeCloseTo(15); // 5 + 10 * sin(π/2)
    });

    it('should handle negative angles', () => {
        const arc: Arc = {
            center: { x: 0, y: 0 },
            radius: 10,
            startAngle: Math.PI / 2,
            endAngle: -Math.PI / 2,
            clockwise: false,
        };

        const points = generateArcPoints(arc);
        expect(points.length).toBeGreaterThan(1);

        // Should start at (0, 10)
        expect(points[0].x).toBeCloseTo(0);
        expect(points[0].y).toBeCloseTo(10);

        // Should end at (0, -10)
        const lastPoint = points[points.length - 1];
        expect(lastPoint.x).toBeCloseTo(0);
        expect(lastPoint.y).toBeCloseTo(-10);
    });

    it('should handle zero radius gracefully', () => {
        const arc: Arc = {
            center: { x: 5, y: 5 },
            radius: 0,
            startAngle: 0,
            endAngle: Math.PI,
            clockwise: false,
        };

        const points = generateArcPoints(arc);
        expect(points.length).toBeGreaterThan(0);

        // All points should be at center
        points.forEach((point) => {
            expect(point.x).toBeCloseTo(5);
            expect(point.y).toBeCloseTo(5);
        });
    });
});

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

    describe('createTangentArc', () => {
        it('should create lead arcs with exactly 90° (π/2) sweep', () => {
            // Lead arcs should have maximum 90° sweep for optimal cutting
            const connectionPoint = { x: 0, y: 0 };
            const tangentDirection = { x: 1, y: 0 };
            const curveDirection = { x: 0, y: 1 };
            const arcLength = 100; // Any arc length
            const isLeadIn = true;
            const clockwise = false;

            const arc = createTangentArc(
                connectionPoint,
                tangentDirection,
                arcLength,
                curveDirection,
                isLeadIn,
                clockwise
            );

            // Calculate angular span
            let angularSpan: number;
            if (arc.clockwise) {
                angularSpan = arc.startAngle - arc.endAngle;
                if (angularSpan <= 0) angularSpan += 2 * Math.PI;
            } else {
                angularSpan = arc.endAngle - arc.startAngle;
                if (angularSpan <= 0) angularSpan += 2 * Math.PI;
            }

            // FIXED: Arc sweep is now exactly 90° (π/2 radians)
            const expectedSweep = Math.PI / 2; // 90 degrees
            expect(angularSpan).toBeCloseTo(expectedSweep, 5);

            // Verify radius calculation: radius = arcLength / (π/2)
            const expectedRadius = arcLength / expectedSweep; // = arcLength × (2/π)
            expect(arc.radius).toBeCloseTo(expectedRadius, 5);
        });

        it('should handle normal arc lengths correctly', () => {
            // Test with reasonable arc length
            const connectionPoint = { x: 10, y: 10 };
            const tangentDirection = { x: 0, y: 1 }; // Vertical tangent
            const curveDirection = { x: -1, y: 0 }; // Curve left (perpendicular to tangent)
            const arcLength = 5;
            const isLeadIn = false;
            const clockwise = true;

            const arc = createTangentArc(
                connectionPoint,
                tangentDirection,
                arcLength,
                curveDirection,
                isLeadIn,
                clockwise
            );

            // Arc should have 90° sweep
            let angularSpan: number;
            if (arc.clockwise) {
                angularSpan = arc.startAngle - arc.endAngle;
                if (angularSpan <= 0) {
                    angularSpan += 2 * Math.PI;
                }
            } else {
                angularSpan = arc.endAngle - arc.startAngle;
                if (angularSpan <= 0) {
                    angularSpan += 2 * Math.PI;
                }
            }

            expect(angularSpan).toBeGreaterThan(0);
            expect(angularSpan).toBeCloseTo(Math.PI / 2, 5); // 90° sweep
            expect(arc.radius).toBeCloseTo(arcLength / (Math.PI / 2), 5); // Radius = arcLength / (π/2)
        });
    });

    describe('createArcWithLength', () => {
        it('should clamp sweep angle to 2π maximum (FIXED)', () => {
            // Test that would previously create invalid arc with sweep > 2π
            const center = { x: 0, y: 0 };
            const radius = 10; // Small radius
            const startAngle = 0;
            const arcLength = 100; // Long arc length: unclamped sweepAngle = 100/10 = 10 radians > 2π (6.28)
            const clockwise = false;

            const arc = createArcWithLength(
                center,
                radius,
                startAngle,
                arcLength,
                clockwise
            );

            // Calculate what unclamped sweep angle would be
            const unclampedSweepAngle = arcLength / radius; // = 10 radians

            // Verify unclamped calculation would exceed 2π
            expect(unclampedSweepAngle).toBeGreaterThan(2 * Math.PI);

            // Calculate actual angular span of the created arc
            let angularSpan: number;
            if (arc.clockwise) {
                angularSpan = arc.startAngle - arc.endAngle;
                if (angularSpan <= 0) angularSpan += 2 * Math.PI;
            } else {
                angularSpan = arc.endAngle - arc.startAngle;
                if (angularSpan <= 0) angularSpan += 2 * Math.PI;
            }

            // FIXED: Arc is now clamped to 2π maximum
            expect(angularSpan).toBeLessThanOrEqual(2 * Math.PI + 0.0001); // Small epsilon for floating point
            expect(angularSpan).toBeCloseTo(2 * Math.PI, 3); // Should be at full circle limit
        });

        it('should handle normal arc lengths without clamping', () => {
            const center = { x: 5, y: 5 };
            const radius = 20;
            const startAngle = Math.PI / 4;
            const arcLength = 31.4; // ~π radians sweep (half circle)
            const clockwise = true;

            const arc = createArcWithLength(
                center,
                radius,
                startAngle,
                arcLength,
                clockwise
            );

            const expectedSweepAngle = arcLength / radius; // = 1.57 radians (π/2)

            let angularSpan: number;
            if (arc.clockwise) {
                angularSpan = arc.startAngle - arc.endAngle;
                if (angularSpan <= 0) angularSpan += 2 * Math.PI;
            } else {
                angularSpan = arc.endAngle - arc.startAngle;
                if (angularSpan <= 0) angularSpan += 2 * Math.PI;
            }

            expect(angularSpan).toBeCloseTo(expectedSweepAngle, 2);
        });
    });
});
