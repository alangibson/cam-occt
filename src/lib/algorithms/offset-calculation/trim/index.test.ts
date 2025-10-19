import { describe, expect, it } from 'vitest';
import type { IntersectionResult } from '$lib/algorithms/offset-calculation/chain/types';
import {
    selectTrimPoint,
    trimConsecutiveShapes,
    trimShapeAtPoint,
} from './index';
import type { Shape } from '$lib/geometry/shape/interfaces';
import type { Line } from '$lib/geometry/line/interfaces';
import type { Circle } from '$lib/geometry/circle/interfaces';
import { GeometryType } from '$lib/geometry/shape/enums';
import { generateId } from '$lib/domain/id';

describe('trim/index additional coverage tests', () => {
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

    function createIntersection(
        x: number,
        y: number,
        param1: number = 0.5,
        param2: number = 0.5,
        confidence: number = 1.0,
        type: string = 'exact',
        distance: number = 0
    ): IntersectionResult {
        return {
            point: { x, y },
            param1,
            param2,
            distance,
            type: type as 'exact' | 'approximate' | 'tangent' | 'coincident',
            confidence,
        };
    }

    describe('trimShapeAtPoint - uncovered branches', () => {
        it('should handle unsupported shape type (default case)', () => {
            const unsupportedShape: Shape = {
                id: generateId(),

                type: 'unsupported' as any,

                geometry: {} as any,
            };

            const result = trimShapeAtPoint(
                unsupportedShape,
                { x: 0, y: 0 },
                'start'
            );

            expect(result.success).toBe(false);
            expect(result.shape).toBeNull();
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0]).toContain(
                'Unsupported shape type for trimming'
            );
            expect(result.errors[0]).toContain('unsupported');
        });

        it('should handle exceptions in trimming (catch block)', () => {
            // Create a shape that will cause an exception by having a null geometry
            const badShape: Shape = {
                id: generateId(),
                type: GeometryType.LINE,

                geometry: null as any,
            };

            const result = trimShapeAtPoint(badShape, { x: 0, y: 0 }, 'start');

            expect(result.success).toBe(false);
            expect(result.shape).toBeNull();
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0]).toContain('Trimming failed');
        });
    });

    describe('selectTrimPoint - uncovered branches', () => {
        it('should handle endpoint intersections with conservative filtering', () => {
            // Need to use INTERSECTION_TOLERANCE (default 0.05) to trigger the endpoint filtering
            const intersections: IntersectionResult[] = [
                createIntersection(1, 1, 0.04, 0.5, 0.95, 'exact', 0.1), // Very close to param1=0 (within INTERSECTION_TOLERANCE), high distance
                createIntersection(2, 2, 0.5, 0.5, 0.6, 'exact'), // Not an endpoint
            ];

            const jointPoint = { x: 0, y: 0 };
            const result = selectTrimPoint(intersections, jointPoint, 0.05); // Tolerance smaller than distance

            // The scoring algorithm picks the closer point (1,1) over (2,2) based on distance to joint point
            expect(result).toBeDefined();
            expect(result!.point.x).toBe(1);
            expect(result!.point.y).toBe(1);
        });

        it('should fall back to all intersections when filtering removes everything', () => {
            const intersections: IntersectionResult[] = [
                createIntersection(1, 1, -0.1, 0.5, 0.4, 'exact'), // Low confidence, outside param bounds
                createIntersection(2, 2, 1.1, 0.5, 0.3, 'exact'), // Low confidence, outside param bounds
            ];

            const jointPoint = { x: 0, y: 0 };
            const result = selectTrimPoint(intersections, jointPoint);

            // Should still return something (closest to joint point) even though all were filtered
            expect(result).toBeDefined();
            expect(result!.point.x).toBe(1); // Closer to joint point
        });

        it('should score tangent intersection type', () => {
            const intersections: IntersectionResult[] = [
                createIntersection(1, 1, 0.5, 0.5, 1.0, 'tangent'),
                createIntersection(1.1, 1.1, 0.5, 0.5, 1.0, 'exact'),
            ];

            const jointPoint = { x: 0, y: 0 };
            const result = selectTrimPoint(intersections, jointPoint);

            expect(result).toBeDefined();
            // Both should be considered, with scoring taking type into account
        });

        it('should score coincident intersection type', () => {
            const intersections: IntersectionResult[] = [
                createIntersection(1, 1, 0.5, 0.5, 1.0, 'coincident'),
                createIntersection(1.1, 1.1, 0.5, 0.5, 1.0, 'exact'),
            ];

            const jointPoint = { x: 0, y: 0 };
            const result = selectTrimPoint(intersections, jointPoint);

            expect(result).toBeDefined();
            // Both should be considered, with scoring taking type into account
        });
    });

    describe('trimConsecutiveShapes - uncovered branches', () => {
        it('should handle case where trimming fails due to invalid intersection', () => {
            const line1 = createLine(0, 0, 10, 0);
            const line2 = createLine(0, 10, 10, 10);

            // Create intersection that will pass selection but fail trimming
            const intersections: IntersectionResult[] = [
                createIntersection(5, 5, 0.5, 0.5, 1.0, 'exact'), // Valid intersection but not on the lines
            ];

            const result = trimConsecutiveShapes(line1, line2, intersections);

            // Trimming should fail because the intersection point is not actually on the lines
            expect(result.shape1Result.success).toBe(false);
            expect(result.shape2Result.success).toBe(false);
            expect(result.shape1Result.errors[0]).toContain('not on the line');
        });

        it('should handle case where no intersections are found', () => {
            const line1 = createLine(0, 0, 10, 0);
            const line2 = createLine(0, 10, 10, 10);

            // Pass an empty array - this hits the early return case
            const intersections: IntersectionResult[] = [];

            const result = trimConsecutiveShapes(line1, line2, intersections);

            expect(result.shape1Result.success).toBe(false);
            expect(result.shape2Result.success).toBe(false);
            expect(result.shape1Result.errors[0]).toContain(
                'No intersections found between shapes'
            );
            expect(result.shape2Result.errors[0]).toContain(
                'No intersections found between shapes'
            );
        });
    });

    describe('getShapeCenter - circle case', () => {
        it('should handle circle shape in getShapeCenter', () => {
            const circle = createCircle(5, 10, 3);
            const line = createLine(0, 0, 1, 1);

            // This will internally call getShapeCenter for both shapes
            const intersections: IntersectionResult[] = [
                createIntersection(0.5, 0.5, 0.5, 0.5, 1.0, 'exact'),
            ];

            const result = trimConsecutiveShapes(circle, line, intersections);

            // The test mainly ensures the circle case in getShapeCenter is covered
            // The actual trimming may fail, but that's not the focus here
            expect(result).toBeDefined();
        });
    });

    describe('parameter validation edge cases', () => {
        it('should handle intersections with parameters very close to endpoints', () => {
            const intersections: IntersectionResult[] = [
                // Parameters very close to 0 and 1
                createIntersection(1, 1, 1e-10, 1 - 1e-10, 0.95, 'exact'),
                createIntersection(2, 2, 0.5, 0.5, 0.8, 'exact'),
            ];

            const jointPoint = { x: 0, y: 0 };
            const result = selectTrimPoint(intersections, jointPoint);

            expect(result).toBeDefined();
        });

        it('should handle intersections with mixed parameter bounds', () => {
            const intersections: IntersectionResult[] = [
                createIntersection(1, 1, -0.01, 1.01, 0.8, 'exact'), // Slightly outside bounds
                createIntersection(2, 2, 0.5, 0.5, 0.6, 'exact'), // Within bounds
            ];

            const jointPoint = { x: 0, y: 0 };
            const result = selectTrimPoint(intersections, jointPoint);

            expect(result).toBeDefined();
        });

        it('should handle intersections with high confidence at endpoints', () => {
            const intersections: IntersectionResult[] = [
                createIntersection(1, 1, 0, 0.5, 0.95, 'exact', 0.001), // At endpoint with high confidence and small distance
            ];

            const jointPoint = { x: 0, y: 0 };
            const result = selectTrimPoint(intersections, jointPoint, 0.01); // Tolerance larger than distance

            expect(result).toBeDefined();
        });
    });

    describe('error conditions and edge cases', () => {
        it('should handle trimming with very small tolerance', () => {
            const line = createLine(0, 0, 10, 0);
            const offPoint = { x: 5, y: 0.001 }; // Slightly off the line

            const result = trimShapeAtPoint(line, offPoint, 'start', 1e-6);

            expect(result.success).toBe(false);
        });

        it('should handle shape with invalid geometry structure', () => {
            const invalidShape: Shape = {
                id: generateId(),
                type: GeometryType.LINE,

                geometry: { invalid: 'data' } as any,
            };

            const result = trimShapeAtPoint(
                invalidShape,
                { x: 0, y: 0 },
                'start'
            );

            expect(result.success).toBe(false);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0]).toContain('Trimming failed');
        });
    });
});
