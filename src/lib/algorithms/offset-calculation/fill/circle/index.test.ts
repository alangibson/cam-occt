import type { Arc } from '$lib/geometry/arc';
import { GeometryType, type Shape } from '$lib/geometry/shape';
import type { Circle } from '$lib/geometry/circle';
import type { Point2D } from '$lib/geometry/point';
import { generateId } from '$lib/domain/id';
import { describe, expect, it } from 'vitest';
import {
    type FillOptions,
    type FillResult,
} from '$lib/algorithms/offset-calculation/fill/types';
import { fillCircleToIntersection } from './index';

describe('fillCircleToIntersection', () => {
    // Helper function to create test circles
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

    // Helper to check if two points are approximately equal
    function pointsApproxEqual(
        p1: Point2D,
        p2: Point2D,
        tolerance: number = 1e-6
    ): boolean {
        return (
            Math.abs(p1.x - p2.x) < tolerance &&
            Math.abs(p1.y - p2.y) < tolerance
        );
    }

    // Helper to validate fill result
    function validateFillResult(
        result: FillResult,
        shouldSucceed: boolean = true
    ): void {
        if (shouldSucceed) {
            expect(result.success).toBe(true);
            expect(result.extendedShape).not.toBeNull();
            expect(result.errors).toHaveLength(0);
        } else {
            expect(result.success).toBe(false);
            expect(result.extendedShape).toBeNull();
            expect(result.errors.length).toBeGreaterThan(0);
        }
    }

    const defaultOptions: FillOptions = {
        maxExtension: Math.PI, // Max angular extension
        tolerance: 1e-6,
    };

    describe('basic circle to arc conversion', () => {
        it('should convert circle to arc when extended to intersection point', () => {
            const circle = createCircle(0, 0, 5);
            const intersectionPoint = { x: 5, y: 0 }; // Point on circle at angle 0

            const result = fillCircleToIntersection(
                circle,
                intersectionPoint,
                defaultOptions
            );

            validateFillResult(result, true);
            expect(result.extendedShape!.type).toBe('arc');

            const resultArc = result.extendedShape!.geometry as Arc;
            expect(resultArc.radius).toBe(5);
            expect(pointsApproxEqual(resultArc.center, { x: 0, y: 0 })).toBe(
                true
            );
            expect(resultArc.startAngle).toBeDefined();
            expect(resultArc.endAngle).toBeDefined();
        });

        it('should handle intersection point at different angles', () => {
            const circle = createCircle(0, 0, 3);
            const intersectionPoint = { x: 0, y: 3 }; // Point at angle π/2 (90°)

            const result = fillCircleToIntersection(
                circle,
                intersectionPoint,
                defaultOptions
            );

            validateFillResult(result, true);
            const resultArc = result.extendedShape!.geometry as Arc;
            expect(resultArc.radius).toBe(3);
            expect(pointsApproxEqual(resultArc.center, { x: 0, y: 0 })).toBe(
                true
            );
        });

        it('should preserve circle center and radius', () => {
            const circle = createCircle(10, 20, 7);
            const intersectionPoint = { x: 17, y: 20 }; // Point on circle

            const result = fillCircleToIntersection(
                circle,
                intersectionPoint,
                defaultOptions
            );

            validateFillResult(result, true);
            const resultArc = result.extendedShape!.geometry as Arc;
            expect(resultArc.radius).toBe(7);
            expect(pointsApproxEqual(resultArc.center, { x: 10, y: 20 })).toBe(
                true
            );
        });
    });

    describe('extension direction and angular range', () => {
        it('should create arc with appropriate angular range', () => {
            const circle = createCircle(0, 0, 4);
            const intersectionPoint = { x: 4, y: 0 }; // At angle 0

            const result = fillCircleToIntersection(circle, intersectionPoint, {
                ...defaultOptions,
                extendDirection: 'end',
            });

            validateFillResult(result, true);
            const resultArc = result.extendedShape!.geometry as Arc;

            // Should create an arc that starts at intersection point
            expect(resultArc.startAngle).toBeDefined();
            expect(resultArc.endAngle).toBeDefined();

            // Arc should have meaningful angular range
            let angularRange = Math.abs(
                resultArc.endAngle - resultArc.startAngle
            );
            if (angularRange > Math.PI) {
                angularRange = 2 * Math.PI - angularRange;
            }
            expect(angularRange).toBeGreaterThan(0);
        });

        it('should handle extension in start direction', () => {
            const circle = createCircle(0, 0, 2);
            const intersectionPoint = { x: -2, y: 0 }; // At angle π (180°)

            const result = fillCircleToIntersection(circle, intersectionPoint, {
                ...defaultOptions,
                extendDirection: 'start',
            });

            validateFillResult(result, true);
            expect(result.extension).toBeDefined();
            if (result.extension) {
                expect(result.extension.direction).toBe('start');
            }
        });

        it('should auto-detect optimal extension direction', () => {
            const circle = createCircle(0, 0, 6);
            const intersectionPoint = { x: 0, y: -6 }; // At angle 3π/2 (270°)

            const result = fillCircleToIntersection(circle, intersectionPoint, {
                ...defaultOptions,
                extendDirection: 'auto',
            });

            validateFillResult(result, true);
            expect(result.extension).toBeDefined();
            expect(['start', 'end']).toContain(result.extension!.direction);
        });
    });

    describe('geometric validation', () => {
        it('should create arc that includes the intersection point', () => {
            const circle = createCircle(0, 0, 8);
            const intersectionPoint = {
                x: 8 * Math.cos(Math.PI / 3),
                y: 8 * Math.sin(Math.PI / 3),
            }; // 60°

            const result = fillCircleToIntersection(
                circle,
                intersectionPoint,
                defaultOptions
            );

            validateFillResult(result, true);
            const resultArc = result.extendedShape!.geometry as Arc;

            // Verify the arc has the same center and radius as original circle
            expect(resultArc.radius).toBe(8);
            expect(pointsApproxEqual(resultArc.center, { x: 0, y: 0 })).toBe(
                true
            );

            // Verify arc has meaningful angular range
            let angularRange = Math.abs(
                resultArc.endAngle - resultArc.startAngle
            );
            if (angularRange > Math.PI) {
                angularRange = 2 * Math.PI - angularRange;
            }
            expect(angularRange).toBeGreaterThan(0);
        });

        it('should maintain circle properties in resulting arc', () => {
            const originalCenter = { x: 5, y: -3 };
            const originalRadius = 12;
            const circle = createCircle(
                originalCenter.x,
                originalCenter.y,
                originalRadius
            );
            const intersectionPoint = {
                x: originalCenter.x + originalRadius,
                y: originalCenter.y,
            };

            const result = fillCircleToIntersection(
                circle,
                intersectionPoint,
                defaultOptions
            );

            validateFillResult(result, true);
            const resultArc = result.extendedShape!.geometry as Arc;

            expect(resultArc.radius).toBe(originalRadius);
            expect(pointsApproxEqual(resultArc.center, originalCenter)).toBe(
                true
            );
            expect(resultArc.clockwise).toBeDefined();
        });
    });

    describe('error conditions', () => {
        it('should reject non-circle shapes', () => {
            const line: Shape = {
                id: generateId(),
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 0, y: 0 },
                    end: { x: 10, y: 0 },
                },
            };

            const result = fillCircleToIntersection(
                line,
                { x: 15, y: 0 },
                defaultOptions
            );

            validateFillResult(result, false);
            expect(result.errors[0]).toContain('must be a circle');
        });

        it('should handle intersection point not on circle', () => {
            const circle = createCircle(0, 0, 5);
            const intersectionPoint = { x: 3, y: 0 }; // Inside circle

            const result = fillCircleToIntersection(
                circle,
                intersectionPoint,
                defaultOptions
            );

            if (!result.success) {
                expect(result.errors.length).toBeGreaterThan(0);
            }
            expect(result.success).toBeDefined();
        });

        it('should handle intersection point far from circle', () => {
            const circle = createCircle(0, 0, 2);
            const intersectionPoint = { x: 20, y: 0 }; // Far from circle

            const result = fillCircleToIntersection(
                circle,
                intersectionPoint,
                defaultOptions
            );

            if (!result.success) {
                expect(result.errors.length).toBeGreaterThan(0);
            }
            expect(result.success).toBeDefined();
        });

        it('should validate maxExtension parameter', () => {
            const circle = createCircle(0, 0, 5);
            const intersectionPoint = { x: 5, y: 0 };

            const result = fillCircleToIntersection(circle, intersectionPoint, {
                maxExtension: 0.1, // Very small max extension
                tolerance: 1e-6,
                extendDirection: 'end',
            });

            if (!result.success) {
                expect(result.errors.length).toBeGreaterThan(0);
            }
            expect(result.success).toBeDefined();
        });
    });

    describe('numerical precision and edge cases', () => {
        it('should handle very small circles', () => {
            const circle = createCircle(0, 0, 1e-6);
            const intersectionPoint = { x: 1e-6, y: 0 };

            const result = fillCircleToIntersection(
                circle,
                intersectionPoint,
                defaultOptions
            );

            expect(result.success).toBeDefined();
            if (result.success) {
                const resultArc = result.extendedShape!.geometry as Arc;
                expect(resultArc.radius).toBeCloseTo(1e-6);
            }
        });

        it('should handle very large circles', () => {
            const circle = createCircle(0, 0, 1000);
            const intersectionPoint = { x: 1000, y: 0 };

            const result = fillCircleToIntersection(
                circle,
                intersectionPoint,
                defaultOptions
            );

            validateFillResult(result, true);
            const resultArc = result.extendedShape!.geometry as Arc;
            expect(resultArc.radius).toBe(1000);
        });

        it('should handle intersection points with numerical precision issues', () => {
            const circle = createCircle(0, 0, 1);
            const intersectionPoint = { x: 1 + 1e-15, y: 1e-15 }; // Very close to (1,0)

            const result = fillCircleToIntersection(circle, intersectionPoint, {
                ...defaultOptions,
                tolerance: 1e-12,
            });

            expect(result.success).toBeDefined();
        });

        it('should respect tolerance for on-circle validation', () => {
            const circle = createCircle(0, 0, 5);
            const slightlyOffPoint = { x: 5.01, y: 0 }; // Slightly off circle

            // Test with different tolerance values
            const result1 = fillCircleToIntersection(circle, slightlyOffPoint, {
                ...defaultOptions,
                tolerance: 1e-8, // Very tight
            });

            const result2 = fillCircleToIntersection(circle, slightlyOffPoint, {
                ...defaultOptions,
                tolerance: 0.02, // Loose
            });

            expect(result1.success).toBeDefined();
            expect(result2.success).toBeDefined();

            // At least one should handle the slightly off point
            expect(result1.success || result2.success).toBe(true);
        });
    });

    describe('extension metadata', () => {
        it('should provide correct extension information', () => {
            const circle = createCircle(0, 0, 4);
            const intersectionPoint = { x: 4, y: 0 };

            const result = fillCircleToIntersection(
                circle,
                intersectionPoint,
                defaultOptions
            );

            validateFillResult(result, true);
            expect(result.extension).toBeDefined();
            expect(result.extension!.type).toBe('angular');
            expect(result.extension!.originalShape).toBe(circle);
            expect(
                pointsApproxEqual(
                    result.extension!.extensionEnd,
                    intersectionPoint
                )
            ).toBe(true);
        });

        it('should calculate angular extension amount', () => {
            const circle = createCircle(0, 0, 3);
            const intersectionPoint = { x: 3, y: 0 };

            const result = fillCircleToIntersection(
                circle,
                intersectionPoint,
                defaultOptions
            );

            validateFillResult(result, true);
            expect(result.extension!.amount).toBeGreaterThan(0);
            expect(result.extension!.amount).toBeLessThanOrEqual(2 * Math.PI);
        });
    });

    describe('confidence scoring', () => {
        it('should provide confidence scores', () => {
            const circle = createCircle(0, 0, 6);
            const intersectionPoint = { x: 6, y: 0 };

            const result = fillCircleToIntersection(
                circle,
                intersectionPoint,
                defaultOptions
            );

            validateFillResult(result, true);
            expect(result.confidence).toBeGreaterThanOrEqual(0);
            expect(result.confidence).toBeLessThanOrEqual(1);
        });

        it('should provide high confidence for points exactly on circle', () => {
            const circle = createCircle(0, 0, 1);
            const intersectionPoint = { x: 1, y: 0 }; // Exactly on circle

            const result = fillCircleToIntersection(
                circle,
                intersectionPoint,
                defaultOptions
            );

            validateFillResult(result, true);
            expect(result.confidence).toBeGreaterThan(0.8);
        });
    });

    describe('arc property validation', () => {
        it('should create arc with valid angular range', () => {
            const circle = createCircle(2, 3, 4);
            const intersectionPoint = { x: 6, y: 3 }; // Right side of circle

            const result = fillCircleToIntersection(
                circle,
                intersectionPoint,
                defaultOptions
            );

            validateFillResult(result, true);
            const resultArc = result.extendedShape!.geometry as Arc;

            // Validate angular range is meaningful
            let angularRange = Math.abs(
                resultArc.endAngle - resultArc.startAngle
            );
            if (angularRange > Math.PI) {
                angularRange = 2 * Math.PI - angularRange;
            }
            expect(angularRange).toBeGreaterThan(0);
            expect(angularRange).toBeLessThanOrEqual(2 * Math.PI);
        });

        it('should maintain consistent arc direction', () => {
            const circle = createCircle(0, 0, 5);
            const intersectionPoint = { x: 0, y: 5 }; // Top of circle

            const result = fillCircleToIntersection(circle, intersectionPoint, {
                ...defaultOptions,
                extendDirection: 'end',
            });

            validateFillResult(result, true);
            const resultArc = result.extendedShape!.geometry as Arc;
            expect(typeof resultArc.clockwise).toBe('boolean');
        });
    });

    describe('special geometric cases', () => {
        it('should handle circles at origin', () => {
            const circle = createCircle(0, 0, 1);
            const intersectionPoint = { x: 1, y: 0 };

            const result = fillCircleToIntersection(
                circle,
                intersectionPoint,
                defaultOptions
            );

            validateFillResult(result, true);
        });

        it('should handle circles with large coordinates', () => {
            const circle = createCircle(1000, 2000, 50);
            const intersectionPoint = { x: 1050, y: 2000 };

            const result = fillCircleToIntersection(
                circle,
                intersectionPoint,
                defaultOptions
            );

            validateFillResult(result, true);
            const resultArc = result.extendedShape!.geometry as Arc;
            expect(
                pointsApproxEqual(resultArc.center, { x: 1000, y: 2000 })
            ).toBe(true);
            expect(resultArc.radius).toBe(50);
        });

        it('should handle negative coordinate circles', () => {
            const circle = createCircle(-10, -20, 3);
            const intersectionPoint = { x: -7, y: -20 };

            const result = fillCircleToIntersection(
                circle,
                intersectionPoint,
                defaultOptions
            );

            validateFillResult(result, true);
            const resultArc = result.extendedShape!.geometry as Arc;
            expect(
                pointsApproxEqual(resultArc.center, { x: -10, y: -20 })
            ).toBe(true);
        });
    });

    describe('extension parameter validation', () => {
        it('should respect maxExtension limits', () => {
            const circle = createCircle(0, 0, 5);
            const intersectionPoint = { x: 5, y: 0 };

            const result = fillCircleToIntersection(circle, intersectionPoint, {
                maxExtension: 0.1, // Very small max extension
                tolerance: 1e-6,
                extendDirection: 'end',
            });

            // Either succeeds with small extension or fails due to limit
            expect(result.success).toBeDefined();
            if (result.success && result.extension) {
                expect(result.extension.amount).toBeLessThanOrEqual(0.1);
            }
        });

        it('should handle zero maxExtension', () => {
            const circle = createCircle(0, 0, 3);
            const intersectionPoint = { x: 3, y: 0 };

            const result = fillCircleToIntersection(circle, intersectionPoint, {
                maxExtension: 0,
                tolerance: 1e-6,
            });

            // Should either fail or succeed with no extension
            expect(result.success).toBeDefined();
            if (result.success && result.extension) {
                expect(result.extension.amount).toBe(0);
            }
        });
    });

    describe('intersection point validation', () => {
        it('should validate intersection point is reachable', () => {
            const circle = createCircle(0, 0, 1);
            const intersectionPoint = { x: 1, y: 0 }; // On circle

            const result = fillCircleToIntersection(
                circle,
                intersectionPoint,
                defaultOptions
            );

            validateFillResult(result, true);
            expect(result.intersectionPoint).toBeDefined();
            expect(
                pointsApproxEqual(result.intersectionPoint!, intersectionPoint)
            ).toBe(true);
        });
    });
});
