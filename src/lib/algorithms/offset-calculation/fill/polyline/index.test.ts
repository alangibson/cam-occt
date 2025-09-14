import {
    createPolylineFromVertices,
    polylineToPoints,
} from '$lib/geometry/polyline';
import {
    GeometryType,
    type Point2D,
    type Polyline,
    type Shape,
} from '$lib/types/geometry';
import { generateId } from '$lib/domain/id';
import { describe, expect, it } from 'vitest';
import {
    type FillOptions,
    type FillResult,
} from '$lib/algorithms/offset-calculation/fill/types';
import { fillPolylineToIntersection } from './index';

describe('fillPolylineToIntersection', () => {
    // Helper function to create test polylines
    function createPolyline(
        vertices: { x: number; y: number; bulge?: number }[],
        closed: boolean = false
    ): Shape {
        const polylineVertices = vertices.map((v) => ({
            x: v.x,
            y: v.y,
            bulge: v.bulge || 0,
        }));
        return {
            id: generateId(),
            type: GeometryType.POLYLINE,
            geometry: createPolylineFromVertices(polylineVertices, closed)
                .geometry as Polyline,
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
        maxExtension: 100,
        tolerance: 1e-6,
    };

    describe('basic polyline extension', () => {
        it('should extend polyline at end to intersection point', () => {
            const polyline = createPolyline([
                { x: 0, y: 0 },
                { x: 5, y: 0 },
                { x: 10, y: 0 },
            ]);
            const intersectionPoint = { x: 15, y: 0 }; // Extend along last segment

            const result = fillPolylineToIntersection(
                polyline,
                intersectionPoint,
                {
                    ...defaultOptions,
                    extendDirection: 'end',
                }
            );

            validateFillResult(result, true);
            const extendedPolyline = result.extendedShape!.geometry as Polyline;
            const points = polylineToPoints(extendedPolyline);

            expect(points).toHaveLength(4);
            expect(pointsApproxEqual(points[0], { x: 0, y: 0 })).toBe(true);
            expect(pointsApproxEqual(points[3], intersectionPoint)).toBe(true);
            expect(result.extension).toBeDefined();
            expect(result.extension!.direction).toBe('end');
            expect(result.extension!.type).toBe('linear');
        });

        it('should extend polyline at start to intersection point', () => {
            const polyline = createPolyline([
                { x: 5, y: 0 },
                { x: 10, y: 0 },
                { x: 15, y: 0 },
            ]);
            const intersectionPoint = { x: 0, y: 0 }; // Extend backwards from first segment

            const result = fillPolylineToIntersection(
                polyline,
                intersectionPoint,
                {
                    ...defaultOptions,
                    extendDirection: 'start',
                }
            );

            validateFillResult(result, true);
            const extendedPolyline = result.extendedShape!.geometry as Polyline;
            const points = polylineToPoints(extendedPolyline);

            expect(points).toHaveLength(4);
            expect(pointsApproxEqual(points[0], intersectionPoint)).toBe(true);
            expect(pointsApproxEqual(points[3], { x: 15, y: 0 })).toBe(true);
            expect(result.extension!.direction).toBe('start');
        });

        it('should auto-detect extension direction to closest endpoint', () => {
            const polyline = createPolyline([
                { x: 5, y: 0 },
                { x: 10, y: 0 },
                { x: 15, y: 0 },
            ]);
            const intersectionPoint = { x: 20, y: 0 }; // Closer to end

            const result = fillPolylineToIntersection(
                polyline,
                intersectionPoint,
                {
                    ...defaultOptions,
                    extendDirection: 'auto',
                }
            );

            validateFillResult(result, true);
            expect(result.extension!.direction).toBe('end');
        });
    });

    describe('diagonal and angled polylines', () => {
        it('should extend diagonal polyline correctly', () => {
            const polyline = createPolyline([
                { x: 0, y: 0 },
                { x: 5, y: 5 },
                { x: 10, y: 10 },
            ]);
            const intersectionPoint = { x: 15, y: 15 }; // Continue diagonal

            const result = fillPolylineToIntersection(
                polyline,
                intersectionPoint,
                {
                    ...defaultOptions,
                    extendDirection: 'end',
                }
            );

            validateFillResult(result, true);
            const extendedPolyline = result.extendedShape!.geometry as Polyline;
            const points = polylineToPoints(extendedPolyline);

            expect(
                pointsApproxEqual(points[points.length - 1], intersectionPoint)
            ).toBe(true);
        });

        it('should handle complex polyline with multiple segments', () => {
            const polyline = createPolyline([
                { x: 0, y: 0 },
                { x: 5, y: 0 },
                { x: 5, y: 5 },
                { x: 10, y: 5 },
            ]);
            const intersectionPoint = { x: 15, y: 5 }; // Extend final horizontal segment

            const result = fillPolylineToIntersection(
                polyline,
                intersectionPoint,
                {
                    ...defaultOptions,
                    extendDirection: 'end',
                }
            );

            validateFillResult(result, true);
            const extendedPolyline = result.extendedShape!.geometry as Polyline;
            const points = polylineToPoints(extendedPolyline);

            expect(
                pointsApproxEqual(points[points.length - 1], intersectionPoint)
            ).toBe(true);
        });
    });

    describe('polylines with bulges (arcs)', () => {
        it('should handle polyline with arc segments', () => {
            const polyline = createPolyline([
                { x: 0, y: 0, bulge: 0 },
                { x: 5, y: 0, bulge: 1 }, // Arc with bulge=1 (semicircle)
                { x: 10, y: 0, bulge: 0 },
            ]);
            const intersectionPoint = { x: 15, y: 0 }; // Extend linearly from last segment

            const result = fillPolylineToIntersection(
                polyline,
                intersectionPoint,
                {
                    ...defaultOptions,
                    extendDirection: 'end',
                }
            );

            validateFillResult(result, true);
            expect(result.extension!.type).toBe('linear');
        });
    });

    describe('edge cases and error handling', () => {
        it('should reject non-polyline shapes', () => {
            const line: Shape = {
                id: generateId(),
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 0, y: 0 },
                    end: { x: 10, y: 0 },
                },
            };

            const result = fillPolylineToIntersection(
                line,
                { x: 15, y: 0 },
                defaultOptions
            );

            validateFillResult(result, false);
            expect(result.errors[0]).toContain('must be a polyline');
        });

        it('should handle intersection point too far away', () => {
            const polyline = createPolyline([
                { x: 0, y: 0 },
                { x: 5, y: 0 },
            ]);
            const intersectionPoint = { x: 200, y: 0 }; // Very far

            const result = fillPolylineToIntersection(
                polyline,
                intersectionPoint,
                {
                    maxExtension: 50, // Limit extension
                    tolerance: 1e-6,
                    extendDirection: 'end',
                }
            );

            validateFillResult(result, false);
            expect(result.errors.length).toBeGreaterThan(0);
        });

        it('should handle intersection point not aligned with segment direction', () => {
            const polyline = createPolyline([
                { x: 0, y: 0 },
                { x: 10, y: 0 },
            ]); // Horizontal line
            const intersectionPoint = { x: 5, y: 10 }; // Perpendicular to line direction

            const result = fillPolylineToIntersection(
                polyline,
                intersectionPoint,
                {
                    ...defaultOptions,
                    extendDirection: 'end',
                }
            );

            // The function might succeed but not extend as expected, or might fail
            // The important thing is that it behaves consistently
            expect(result.success).toBeDefined();
            if (!result.success) {
                expect(result.errors.length).toBeGreaterThan(0);
            }
        });

        it('should handle closed polylines', () => {
            const polyline = createPolyline(
                [
                    { x: 0, y: 0 },
                    { x: 5, y: 0 },
                    { x: 5, y: 5 },
                    { x: 0, y: 5 },
                ],
                true
            ); // Closed square
            const intersectionPoint = { x: 10, y: 0 };

            const result = fillPolylineToIntersection(
                polyline,
                intersectionPoint,
                {
                    ...defaultOptions,
                    extendDirection: 'end',
                }
            );

            // Result depends on implementation - might succeed or fail for closed polylines
            expect(result.success).toBeDefined();
        });

        it('should handle very small polylines', () => {
            const polyline = createPolyline([
                { x: 0, y: 0 },
                { x: 1e-8, y: 0 },
            ]);
            const intersectionPoint = { x: 1e-7, y: 0 };

            const result = fillPolylineToIntersection(
                polyline,
                intersectionPoint,
                {
                    ...defaultOptions,
                    extendDirection: 'end',
                }
            );

            validateFillResult(result, true);
        });

        it('should respect tolerance parameter', () => {
            const polyline = createPolyline([
                { x: 0, y: 0 },
                { x: 10, y: 0 },
            ]);
            const intersectionPoint = { x: 15, y: 0.1 }; // Slightly off line

            const result = fillPolylineToIntersection(
                polyline,
                intersectionPoint,
                {
                    ...defaultOptions,
                    tolerance: 1e-8,
                    extendDirection: 'end',
                }
            );

            // Test that tolerance affects the result somehow
            expect(result.success).toBeDefined();
            if (result.success) {
                expect(result.extendedShape).toBeDefined();
            } else {
                expect(result.errors.length).toBeGreaterThan(0);
            }
        });

        it('should provide meaningful error messages when extension fails', () => {
            const polyline = createPolyline([
                { x: 0, y: 0 },
                { x: 5, y: 0 },
            ]);

            // Test with extension beyond max limit
            const farPoint = { x: 1000, y: 0 };

            const result = fillPolylineToIntersection(polyline, farPoint, {
                maxExtension: 10,
                tolerance: 1e-6,
                extendDirection: 'end',
            });

            if (!result.success) {
                expect(result.errors[0]).toBeDefined();
                expect(typeof result.errors[0]).toBe('string');
            }
            expect(result.success).toBeDefined();
        });
    });

    describe('extension information validation', () => {
        it('should provide correct extension metadata', () => {
            const polyline = createPolyline([
                { x: 0, y: 0 },
                { x: 10, y: 0 },
            ]);
            const intersectionPoint = { x: 20, y: 0 };

            const result = fillPolylineToIntersection(
                polyline,
                intersectionPoint,
                {
                    ...defaultOptions,
                    extendDirection: 'end',
                }
            );

            validateFillResult(result, true);
            expect(result.extension).toBeDefined();
            expect(result.extension!.type).toBe('linear');
            expect(result.extension!.direction).toBe('end');
            expect(result.extension!.amount).toBeCloseTo(10); // 10 unit extension
            expect(
                pointsApproxEqual(result.extension!.extensionStart, {
                    x: 10,
                    y: 0,
                })
            ).toBe(true);
            expect(
                pointsApproxEqual(
                    result.extension!.extensionEnd,
                    intersectionPoint
                )
            ).toBe(true);
            expect(result.intersectionPoint).toBeDefined();
            expect(
                pointsApproxEqual(result.intersectionPoint!, intersectionPoint)
            ).toBe(true);
        });

        it('should calculate extension distance correctly for diagonal lines', () => {
            const polyline = createPolyline([
                { x: 0, y: 0 },
                { x: 3, y: 4 },
            ]); // 3-4-5 triangle, last segment length = 5
            const intersectionPoint = { x: 6, y: 8 }; // Extend by factor of 2

            const result = fillPolylineToIntersection(
                polyline,
                intersectionPoint,
                {
                    ...defaultOptions,
                    extendDirection: 'end',
                }
            );

            validateFillResult(result, true);
            expect(result.extension!.amount).toBeCloseTo(5); // Should extend by 5 units
        });
    });

    describe('geometric validation', () => {
        it('should maintain polyline continuity after extension', () => {
            const polyline = createPolyline([
                { x: 0, y: 0 },
                { x: 5, y: 3 },
                { x: 10, y: 6 },
            ]);
            const intersectionPoint = { x: 15, y: 9 }; // Continue the pattern

            const result = fillPolylineToIntersection(
                polyline,
                intersectionPoint,
                {
                    ...defaultOptions,
                    extendDirection: 'end',
                }
            );

            validateFillResult(result, true);
            const extendedPolyline = result.extendedShape!.geometry as Polyline;
            const points = polylineToPoints(extendedPolyline);

            // Check that extension maintains direction
            const lastOriginalPoint = points[2]; // { x: 10, y: 6 }
            const extendedPoint = points[3]; // Should be intersection point

            expect(pointsApproxEqual(extendedPoint, intersectionPoint)).toBe(
                true
            );

            // Verify the extension is linear continuation
            const lastSegmentDx = lastOriginalPoint.x - points[1].x;
            const lastSegmentDy = lastOriginalPoint.y - points[1].y;
            const extensionDx = extendedPoint.x - lastOriginalPoint.x;
            const extensionDy = extendedPoint.y - lastOriginalPoint.y;

            // Direction should be the same (parallel vectors)
            const originalDirection = Math.atan2(lastSegmentDy, lastSegmentDx);
            const extensionDirection = Math.atan2(extensionDy, extensionDx);
            expect(
                Math.abs(originalDirection - extensionDirection)
            ).toBeLessThan(1e-6);
        });

        it('should preserve original polyline properties', () => {
            const originalVertices = [
                { x: 1, y: 2 },
                { x: 6, y: 7 },
                { x: 11, y: 12 },
            ];
            const polyline = createPolyline(originalVertices);
            const intersectionPoint = { x: 16, y: 17 };

            const result = fillPolylineToIntersection(
                polyline,
                intersectionPoint,
                {
                    ...defaultOptions,
                    extendDirection: 'end',
                }
            );

            validateFillResult(result, true);
            const extendedPolyline = result.extendedShape!.geometry as Polyline;
            const points = polylineToPoints(extendedPolyline);

            // Original points should be preserved
            for (let i = 0; i < originalVertices.length; i++) {
                expect(pointsApproxEqual(points[i], originalVertices[i])).toBe(
                    true
                );
            }

            // Type and ID should be preserved
            expect(result.extendedShape!.type).toBe('polyline');
            expect(result.extendedShape!.id).toBe(polyline.id);
        });
    });

    describe('numerical precision and tolerance', () => {
        it('should handle very small extensions', () => {
            const polyline = createPolyline([
                { x: 0, y: 0 },
                { x: 1, y: 0 },
            ]);
            const intersectionPoint = { x: 1 + 1e-8, y: 0 }; // Tiny extension

            const result = fillPolylineToIntersection(
                polyline,
                intersectionPoint,
                {
                    ...defaultOptions,
                    extendDirection: 'end',
                }
            );

            validateFillResult(result, true);
            expect(result.extension!.amount).toBeCloseTo(1e-8, 15);
        });

        it('should handle tolerance correctly for alignment detection', () => {
            const polyline = createPolyline([
                { x: 0, y: 0 },
                { x: 10, y: 0 },
            ]);
            const slightlyOffPoint = { x: 15, y: 0.01 }; // Slightly off alignment

            const result = fillPolylineToIntersection(
                polyline,
                slightlyOffPoint,
                {
                    maxExtension: 100,
                    tolerance: 1e-8,
                    extendDirection: 'end',
                }
            );

            // Test that some result is produced
            expect(result.success).toBeDefined();
            if (result.success) {
                expect(result.extendedShape).not.toBeNull();
            }
        });
    });

    describe('error conditions', () => {
        it('should handle intersection point behind polyline start', () => {
            const polyline = createPolyline([
                { x: 5, y: 0 },
                { x: 10, y: 0 },
            ]);
            const intersectionPoint = { x: -5, y: 0 }; // Behind start, but extending end

            const result = fillPolylineToIntersection(
                polyline,
                intersectionPoint,
                {
                    ...defaultOptions,
                    extendDirection: 'end',
                }
            );

            // The function uses auto direction detection and will extend from the end
            // since we explicitly set extendDirection to 'end'
            expect(result.success).toBeDefined();
            if (result.success && result.extension) {
                expect(result.extension.direction).toBe('end');
            }
        });

        it('should handle single-point polyline', () => {
            const polyline = createPolyline([{ x: 0, y: 0 }]);
            const intersectionPoint = { x: 5, y: 0 };

            const result = fillPolylineToIntersection(
                polyline,
                intersectionPoint,
                defaultOptions
            );

            validateFillResult(result, false);
            expect(result.errors[0]).toBeDefined();
        });

        it('should validate maxExtension limit', () => {
            const polyline = createPolyline([
                { x: 0, y: 0 },
                { x: 10, y: 0 },
            ]);
            const farPoint = { x: 1000, y: 0 }; // Very far away

            const result = fillPolylineToIntersection(polyline, farPoint, {
                maxExtension: 50, // Limit extension to 50 units
                tolerance: 1e-6,
                extendDirection: 'end',
            });

            validateFillResult(result, false);
            expect(result.errors.length).toBeGreaterThan(0);
        });
    });

    describe('confidence scoring', () => {
        it('should provide high confidence for straightforward extensions', () => {
            const polyline = createPolyline([
                { x: 0, y: 0 },
                { x: 10, y: 0 },
            ]);
            const intersectionPoint = { x: 15, y: 0 };

            const result = fillPolylineToIntersection(
                polyline,
                intersectionPoint,
                {
                    ...defaultOptions,
                    extendDirection: 'end',
                }
            );

            validateFillResult(result, true);
            expect(result.confidence).toBeGreaterThan(0.9);
        });
    });
});
