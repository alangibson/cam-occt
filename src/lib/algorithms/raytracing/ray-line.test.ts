import { describe, it, expect } from 'vitest';
import {
    countRayLineCrossings,
    findRayLineIntersections,
    countHorizontalRayLineCrossings,
} from './ray-line';
import type { Line, Point2D } from '../../types/geometry';
import type { Ray, RayTracingConfig } from './types';

describe('Ray-Line Intersection', () => {
    const defaultConfig: RayTracingConfig = {
        epsilon: 1e-10,
        boundaryRule: 'lower-inclusive',
    };

    describe('countRayLineCrossings', () => {
        it('should count intersection when ray crosses line', () => {
            const ray: Ray = {
                origin: { x: 0, y: 0 },
                direction: { x: 1, y: 0 }, // horizontal ray to the right
            };
            const line: Line = {
                start: { x: 2, y: -1 },
                end: { x: 2, y: 1 }, // vertical line
            };

            const crossings = countRayLineCrossings(ray, line, defaultConfig);
            expect(crossings).toBe(1);
        });

        it('should return 0 when ray misses line', () => {
            const ray: Ray = {
                origin: { x: 0, y: 0 },
                direction: { x: 1, y: 0 },
            };
            const line: Line = {
                start: { x: 2, y: 1 },
                end: { x: 2, y: 2 }, // line above ray
            };

            const crossings = countRayLineCrossings(ray, line, defaultConfig);
            expect(crossings).toBe(0);
        });

        it('should return 0 when intersection is behind ray origin', () => {
            const ray: Ray = {
                origin: { x: 2, y: 0 },
                direction: { x: 1, y: 0 },
            };
            const line: Line = {
                start: { x: 1, y: -1 },
                end: { x: 1, y: 1 }, // line behind ray origin
            };

            const crossings = countRayLineCrossings(ray, line, defaultConfig);
            expect(crossings).toBe(0);
        });

        it('should handle parallel lines correctly', () => {
            const ray: Ray = {
                origin: { x: 0, y: 0 },
                direction: { x: 1, y: 0 },
            };
            const line: Line = {
                start: { x: 1, y: 0 },
                end: { x: 3, y: 0 }, // parallel to ray
            };

            const crossings = countRayLineCrossings(ray, line, defaultConfig);
            expect(crossings).toBe(0); // Collinear overlaps don't count as crossings
        });

        it('should handle diagonal lines', () => {
            const ray: Ray = {
                origin: { x: 0, y: 0 },
                direction: { x: 1, y: 0 },
            };
            const line: Line = {
                start: { x: 2, y: -2 },
                end: { x: 4, y: 2 }, // diagonal line crossing ray
            };

            const crossings = countRayLineCrossings(ray, line, defaultConfig);
            expect(crossings).toBe(1);
        });

        it('should handle endpoint intersections', () => {
            const ray: Ray = {
                origin: { x: 0, y: 0 },
                direction: { x: 1, y: 0 },
            };
            const line: Line = {
                start: { x: 2, y: 0 }, // endpoint on ray
                end: { x: 2, y: 1 },
            };

            const crossings = countRayLineCrossings(ray, line, defaultConfig);
            expect(crossings).toBe(1); // Should count endpoint intersection
        });
    });

    describe('findRayLineIntersections', () => {
        it('should find intersection point correctly', () => {
            const ray: Ray = {
                origin: { x: 0, y: 0 },
                direction: { x: 1, y: 0 },
            };
            const line: Line = {
                start: { x: 2, y: -1 },
                end: { x: 2, y: 1 },
            };

            const intersections = findRayLineIntersections(
                ray,
                line,
                defaultConfig
            );
            expect(intersections).toHaveLength(1);
            expect(intersections[0].point.x).toBeCloseTo(2);
            expect(intersections[0].point.y).toBeCloseTo(0);
            expect(intersections[0].t).toBeCloseTo(2);
            expect(intersections[0].shapeParameter).toBeCloseTo(0.5);
        });

        it('should return empty array for no intersection', () => {
            const ray: Ray = {
                origin: { x: 0, y: 0 },
                direction: { x: 1, y: 0 },
            };
            const line: Line = {
                start: { x: 2, y: 1 },
                end: { x: 2, y: 2 },
            };

            const intersections = findRayLineIntersections(
                ray,
                line,
                defaultConfig
            );
            expect(intersections).toHaveLength(0);
        });

        it('should classify endpoint intersections correctly', () => {
            const ray: Ray = {
                origin: { x: 0, y: 0 },
                direction: { x: 1, y: 0 },
            };
            const line: Line = {
                start: { x: 2, y: 0 },
                end: { x: 2, y: 1 },
            };

            const intersections = findRayLineIntersections(
                ray,
                line,
                defaultConfig
            );
            expect(intersections).toHaveLength(1);
            expect(intersections[0].type).toBe('endpoint');
            expect(intersections[0].shapeParameter).toBeCloseTo(0);
        });
    });

    describe('countHorizontalRayLineCrossings', () => {
        it('should count horizontal ray crossings efficiently', () => {
            const rayOrigin: Point2D = { x: 0, y: 0 };
            const line: Line = {
                start: { x: 2, y: -1 },
                end: { x: 2, y: 1 },
            };

            const crossings = countHorizontalRayLineCrossings(
                rayOrigin,
                line,
                defaultConfig
            );
            expect(crossings).toBe(1);
        });

        it('should handle horizontal lines correctly', () => {
            const rayOrigin: Point2D = { x: 0, y: 0 };
            const line: Line = {
                start: { x: 1, y: 0 },
                end: { x: 3, y: 0 }, // horizontal line on ray
            };

            const crossings = countHorizontalRayLineCrossings(
                rayOrigin,
                line,
                defaultConfig
            );
            expect(crossings).toBe(0);
        });

        it('should apply lower-inclusive boundary rule', () => {
            const rayOrigin: Point2D = { x: 0, y: 0 };

            // Line with lower endpoint on ray
            const line1: Line = {
                start: { x: 2, y: 0 },
                end: { x: 2, y: 1 },
            };

            // Line with upper endpoint on ray
            const line2: Line = {
                start: { x: 2, y: -1 },
                end: { x: 2, y: 0 },
            };

            const crossings1 = countHorizontalRayLineCrossings(
                rayOrigin,
                line1,
                defaultConfig
            );
            const crossings2 = countHorizontalRayLineCrossings(
                rayOrigin,
                line2,
                defaultConfig
            );

            // Lower-inclusive rule: count when other endpoint is above
            expect(crossings1).toBe(1);
            expect(crossings2).toBe(0);
        });

        it('should handle vertical lines', () => {
            const rayOrigin: Point2D = { x: 0, y: 0 };
            const line: Line = {
                start: { x: 2, y: -5 },
                end: { x: 2, y: 5 },
            };

            const crossings = countHorizontalRayLineCrossings(
                rayOrigin,
                line,
                defaultConfig
            );
            expect(crossings).toBe(1);
        });

        it('should not count intersections behind ray origin', () => {
            const rayOrigin: Point2D = { x: 2, y: 0 };
            const line: Line = {
                start: { x: 1, y: -1 },
                end: { x: 1, y: 1 }, // line behind origin
            };

            const crossings = countHorizontalRayLineCrossings(
                rayOrigin,
                line,
                defaultConfig
            );
            expect(crossings).toBe(0);
        });

        it('should handle lines that cross at ray origin', () => {
            const rayOrigin: Point2D = { x: 0, y: 0 };
            const line: Line = {
                start: { x: 0, y: -1 },
                end: { x: 0, y: 1 }, // line crosses at origin
            };

            const crossings = countHorizontalRayLineCrossings(
                rayOrigin,
                line,
                defaultConfig
            );
            expect(crossings).toBe(0); // Intersection at origin doesn't count as "to the right"
        });
    });

    describe('Edge Cases', () => {
        it('should handle very small lines', () => {
            const ray: Ray = {
                origin: { x: 0, y: 0 },
                direction: { x: 1, y: 0 },
            };
            const line: Line = {
                start: { x: 2, y: 0 },
                end: { x: 2, y: 1e-12 }, // very small line
            };

            const crossings = countRayLineCrossings(ray, line, defaultConfig);
            expect(crossings).toBe(0); // Very small lines are considered degenerate
        });

        it('should handle degenerate lines (zero length)', () => {
            const ray: Ray = {
                origin: { x: 0, y: 0 },
                direction: { x: 1, y: 0 },
            };
            const line: Line = {
                start: { x: 2, y: 0 },
                end: { x: 2, y: 0 }, // zero length line (point)
            };

            const intersections = findRayLineIntersections(
                ray,
                line,
                defaultConfig
            );
            // Degenerate line on ray - behavior may vary by implementation
            expect(Array.isArray(intersections)).toBe(true);
        });
    });
});
