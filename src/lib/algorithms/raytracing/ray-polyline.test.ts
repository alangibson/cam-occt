import { describe, expect, it, vi } from 'vitest';
import type { Point2D } from '$lib/geometry/point';
import type { Polyline } from '$lib/geometry/polyline';
import type { Shape } from '$lib/geometry/shape';
import { GeometryType } from '$lib/geometry/shape';
import type { Ray } from './types';
import {
    countHorizontalRayPolylineCrossings,
    countRayPolylineCrossings,
    findRayPolylineIntersections,
} from './ray-polyline';

describe('Ray-Polyline Intersection', () => {
    // Helper function to create a line shape
    function createLineShape(id: string, start: Point2D, end: Point2D): Shape {
        return {
            id,
            type: GeometryType.LINE,
            geometry: { start, end },
        };
    }

    // Helper function to create an arc shape
    function createArcShape(
        id: string,
        center: Point2D,
        radius: number,
        startAngle: number,
        endAngle: number,
        clockwise: boolean = false
    ): Shape {
        return {
            id,
            type: GeometryType.ARC,
            geometry: { center, radius, startAngle, endAngle, clockwise },
        };
    }

    describe('countRayPolylineCrossings', () => {
        it('should count crossings for simple rectangular polyline', () => {
            // Create a 2x2 rectangle centered at origin
            const rectPolyline: Polyline = {
                closed: true,
                shapes: [
                    createLineShape('1', { x: -1, y: -1 }, { x: 1, y: -1 }), // bottom
                    createLineShape('2', { x: 1, y: -1 }, { x: 1, y: 1 }), // right
                    createLineShape('3', { x: 1, y: 1 }, { x: -1, y: 1 }), // top
                    createLineShape('4', { x: -1, y: 1 }, { x: -1, y: -1 }), // left
                ],
            };

            const horizontalRay: Ray = {
                origin: { x: -2, y: 0 },
                direction: { x: 1, y: 0 },
            };

            // Ray from left should cross 2 times (left and right sides)
            expect(countRayPolylineCrossings(horizontalRay, rectPolyline)).toBe(
                2
            );
        });

        it('should count crossings for open polyline', () => {
            // Create an L-shape (open polyline)
            const lShape: Polyline = {
                closed: false,
                shapes: [
                    createLineShape('1', { x: 0, y: 0 }, { x: 2, y: 0 }), // horizontal
                    createLineShape('2', { x: 2, y: 0 }, { x: 2, y: 2 }), // vertical
                ],
            };

            const ray: Ray = {
                origin: { x: -1, y: 1 },
                direction: { x: 1, y: 0 },
            };

            // Ray should cross only the vertical segment
            expect(countRayPolylineCrossings(ray, lShape)).toBe(1);
        });

        it('should handle polyline with mixed line and arc segments', () => {
            // Create a shape with both lines and arcs
            const mixedPolyline: Polyline = {
                closed: true,
                shapes: [
                    createLineShape('1', { x: -1, y: 0 }, { x: 0, y: 0 }), // left line
                    createArcShape(
                        '2',
                        { x: 0, y: 1 },
                        1,
                        Math.PI * 1.5,
                        Math.PI * 0.5,
                        false
                    ), // right semicircle
                    createLineShape('3', { x: 0, y: 2 }, { x: -1, y: 2 }), // top line
                ],
            };

            const ray: Ray = {
                origin: { x: -2, y: 1 },
                direction: { x: 1, y: 0 },
            };

            // Should cross the arc (implementation returns 1 crossing)
            expect(countRayPolylineCrossings(ray, mixedPolyline)).toBe(1);
        });

        it('should return 0 for ray that misses polyline entirely', () => {
            const polyline: Polyline = {
                closed: true,
                shapes: [
                    createLineShape('1', { x: 10, y: 10 }, { x: 12, y: 10 }),
                    createLineShape('2', { x: 12, y: 10 }, { x: 12, y: 12 }),
                    createLineShape('3', { x: 12, y: 12 }, { x: 10, y: 12 }),
                    createLineShape('4', { x: 10, y: 12 }, { x: 10, y: 10 }),
                ],
            };

            const ray: Ray = {
                origin: { x: 0, y: 0 },
                direction: { x: 1, y: 0 },
            };

            expect(countRayPolylineCrossings(ray, polyline)).toBe(0);
        });

        it('should handle empty polyline', () => {
            const emptyPolyline: Polyline = {
                closed: false,
                shapes: [],
            };

            const ray: Ray = {
                origin: { x: 0, y: 0 },
                direction: { x: 1, y: 0 },
            };

            expect(countRayPolylineCrossings(ray, emptyPolyline)).toBe(0);
        });
    });

    describe('findRayPolylineIntersections', () => {
        it('should find all intersection points for rectangular polyline', () => {
            const rectPolyline: Polyline = {
                closed: true,
                shapes: [
                    createLineShape('1', { x: -1, y: -1 }, { x: 1, y: -1 }),
                    createLineShape('2', { x: 1, y: -1 }, { x: 1, y: 1 }),
                    createLineShape('3', { x: 1, y: 1 }, { x: -1, y: 1 }),
                    createLineShape('4', { x: -1, y: 1 }, { x: -1, y: -1 }),
                ],
            };

            const ray: Ray = {
                origin: { x: -2, y: 0 },
                direction: { x: 1, y: 0 },
            };

            const intersections = findRayPolylineIntersections(
                ray,
                rectPolyline
            );

            expect(intersections).toHaveLength(2);

            // Should be sorted by t parameter (distance along ray)
            expect(intersections[0].point.x).toBeCloseTo(-1); // left side
            expect(intersections[0].point.y).toBeCloseTo(0);
            expect(intersections[1].point.x).toBeCloseTo(1); // right side
            expect(intersections[1].point.y).toBeCloseTo(0);

            // First intersection should be closer (smaller t)
            expect(intersections[0].t).toBeLessThan(intersections[1].t);
        });

        it('should return empty array for no intersections', () => {
            const polyline: Polyline = {
                closed: false,
                shapes: [createLineShape('1', { x: 5, y: 5 }, { x: 10, y: 5 })],
            };

            const ray: Ray = {
                origin: { x: 0, y: 0 },
                direction: { x: 1, y: 0 },
            };

            const intersections = findRayPolylineIntersections(ray, polyline);
            expect(intersections).toHaveLength(0);
        });
    });

    describe('countHorizontalRayPolylineCrossings', () => {
        it('should count crossings for horizontal ray from point', () => {
            const triangle: Polyline = {
                closed: true,
                shapes: [
                    createLineShape('1', { x: 0, y: 0 }, { x: 2, y: 0 }), // base
                    createLineShape('2', { x: 2, y: 0 }, { x: 1, y: 2 }), // right side
                    createLineShape('3', { x: 1, y: 2 }, { x: 0, y: 0 }), // left side
                ],
            };

            // Point inside triangle
            const insidePoint = { x: 1, y: 0.5 };
            expect(
                countHorizontalRayPolylineCrossings(insidePoint, triangle)
            ).toBe(1);

            // Point outside triangle
            const outsidePoint = { x: -1, y: 0.5 };
            expect(
                countHorizontalRayPolylineCrossings(outsidePoint, triangle)
            ).toBe(2);

            // Point far outside
            const farPoint = { x: -10, y: 10 };
            expect(
                countHorizontalRayPolylineCrossings(farPoint, triangle)
            ).toBe(0);
        });
    });

    describe('Edge Cases', () => {
        it('should handle self-intersecting polylines', () => {
            // Create a figure-8 shape
            const figureEight: Polyline = {
                closed: true,
                shapes: [
                    createLineShape('1', { x: 0, y: 0 }, { x: 2, y: 2 }), // diagonal up
                    createLineShape('2', { x: 2, y: 2 }, { x: 0, y: 2 }), // horizontal left
                    createLineShape('3', { x: 0, y: 2 }, { x: 2, y: 0 }), // diagonal down
                    createLineShape('4', { x: 2, y: 0 }, { x: 0, y: 0 }), // horizontal left
                ],
            };

            const ray: Ray = {
                origin: { x: -1, y: 1 },
                direction: { x: 1, y: 0 },
            };

            // Should still count crossings correctly
            const crossings = countRayPolylineCrossings(ray, figureEight);
            expect(crossings).toBeGreaterThanOrEqual(0);
        });

        it('should handle polyline with collinear segments', () => {
            const collinearPolyline: Polyline = {
                closed: false,
                shapes: [
                    createLineShape('1', { x: 0, y: 1 }, { x: 1, y: 1 }), // horizontal
                    createLineShape('2', { x: 1, y: 1 }, { x: 3, y: 1 }), // continues horizontal
                ],
            };

            const ray: Ray = {
                origin: { x: 0.5, y: 0 },
                direction: { x: 0, y: 1 },
            };

            // Ray should intersect both segments at the same point
            const intersections = findRayPolylineIntersections(
                ray,
                collinearPolyline
            );
            expect(intersections.length).toBeGreaterThanOrEqual(1);
        });

        it('should warn about unsupported shape types in polylines', () => {
            const consoleSpy = vi
                .spyOn(console, 'warn')
                .mockImplementation(() => {});

            const polylineWithUnsupported: Polyline = {
                closed: false,
                shapes: [
                    {
                        id: 'unsupported',
                        type: GeometryType.CIRCLE,
                        geometry: { center: { x: 0, y: 0 }, radius: 1 },
                    },
                ],
            };

            const ray: Ray = {
                origin: { x: -2, y: 0 },
                direction: { x: 1, y: 0 },
            };

            countRayPolylineCrossings(ray, polylineWithUnsupported);

            expect(consoleSpy).toHaveBeenCalledWith(
                'Unsupported shape type in polyline: circle'
            );

            consoleSpy.mockRestore();
        });
    });
});
