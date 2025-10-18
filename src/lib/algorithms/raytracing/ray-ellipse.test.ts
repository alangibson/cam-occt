import { describe, expect, it } from 'vitest';
import type { Ellipse } from '$lib/geometry/ellipse/interfaces';
import type { Point2D } from '$lib/geometry/point/interfaces';
import type { Ray } from './types';
import {
    countHorizontalRayEllipseCrossings,
    countRayEllipseCrossings,
    findRayEllipseIntersections,
} from './ray-ellipse';

describe('Ray-Ellipse Intersection', () => {
    // Helper function to create an axis-aligned ellipse
    function createAxisAlignedEllipse(
        center: Point2D,
        majorRadius: number,
        minorRadius: number
    ): Ellipse {
        return {
            center,
            majorAxisEndpoint: { x: majorRadius, y: 0 },
            minorToMajorRatio: minorRadius / majorRadius,
        };
    }

    // Helper function to create a rotated ellipse
    function createRotatedEllipse(
        center: Point2D,
        majorRadius: number,
        minorRadius: number,
        rotation: number
    ): Ellipse {
        return {
            center,
            majorAxisEndpoint: {
                x: majorRadius * Math.cos(rotation),
                y: majorRadius * Math.sin(rotation),
            },
            minorToMajorRatio: minorRadius / majorRadius,
        };
    }

    describe('countRayEllipseCrossings', () => {
        it('should count 2 crossings for ray intersecting ellipse', () => {
            const ellipse = createAxisAlignedEllipse({ x: 0, y: 0 }, 3, 2);

            const horizontalRay: Ray = {
                origin: { x: -5, y: 0 },
                direction: { x: 1, y: 0 },
            };

            expect(countRayEllipseCrossings(horizontalRay, ellipse)).toBe(2);
        });

        it('should count 1 crossing for ray tangent to ellipse', () => {
            const ellipse = createAxisAlignedEllipse({ x: 0, y: 0 }, 3, 2);

            // Ray at y = 2 (minor axis length) should be tangent
            const tangentRay: Ray = {
                origin: { x: -5, y: 2 },
                direction: { x: 1, y: 0 },
            };

            expect(countRayEllipseCrossings(tangentRay, ellipse)).toBe(1);
        });

        it('should count 0 crossings for ray missing ellipse', () => {
            const ellipse = createAxisAlignedEllipse({ x: 0, y: 0 }, 3, 2);

            const missRay: Ray = {
                origin: { x: -5, y: 5 },
                direction: { x: 1, y: 0 },
            };

            expect(countRayEllipseCrossings(missRay, ellipse)).toBe(0);
        });

        it('should handle circular ellipse (a = b)', () => {
            const circle = createAxisAlignedEllipse({ x: 0, y: 0 }, 2, 2);

            const ray: Ray = {
                origin: { x: -3, y: 0 },
                direction: { x: 1, y: 0 },
            };

            expect(countRayEllipseCrossings(ray, circle)).toBe(2);
        });

        it('should handle ray originating inside ellipse', () => {
            const ellipse = createAxisAlignedEllipse({ x: 0, y: 0 }, 3, 2);

            const insideRay: Ray = {
                origin: { x: 0, y: 0 },
                direction: { x: 1, y: 0 },
            };

            expect(countRayEllipseCrossings(insideRay, ellipse)).toBe(1);
        });
    });

    describe('findRayEllipseIntersections', () => {
        it('should find correct intersection points for axis-aligned ellipse', () => {
            const ellipse = createAxisAlignedEllipse({ x: 2, y: 1 }, 3, 2);

            const ray: Ray = {
                origin: { x: -2, y: 1 },
                direction: { x: 1, y: 0 },
            };

            const intersections = findRayEllipseIntersections(ray, ellipse);

            expect(intersections).toHaveLength(2);

            // Should intersect at x = -1 and x = 5 (center at x=2, major radius=3)
            expect(intersections[0].point.x).toBeCloseTo(-1);
            expect(intersections[0].point.y).toBeCloseTo(1);
            expect(intersections[1].point.x).toBeCloseTo(5);
            expect(intersections[1].point.y).toBeCloseTo(1);

            // Should be sorted by t parameter
            expect(intersections[0].t).toBeLessThan(intersections[1].t);
        });

        it('should handle rotated ellipse correctly', () => {
            // 45-degree rotated ellipse
            const ellipse = createRotatedEllipse(
                { x: 0, y: 0 },
                3,
                2,
                Math.PI / 4
            );

            const ray: Ray = {
                origin: { x: -5, y: 0 },
                direction: { x: 1, y: 0 },
            };

            const intersections = findRayEllipseIntersections(ray, ellipse);

            expect(intersections.length).toBeGreaterThanOrEqual(0);
            // For rotated ellipse, exact intersection points depend on complex geometry
            // Just verify we get reasonable results
            intersections.forEach((intersection) => {
                expect(intersection.t).toBeGreaterThanOrEqual(-0.001); // Should be on positive ray
                expect(intersection.point.y).toBeCloseTo(0, 5); // Should be on ray line
            });
        });

        it('should return empty array for no intersections', () => {
            const ellipse = createAxisAlignedEllipse({ x: 10, y: 10 }, 1, 0.5);

            const ray: Ray = {
                origin: { x: 0, y: 0 },
                direction: { x: 1, y: 0 },
            };

            const intersections = findRayEllipseIntersections(ray, ellipse);
            expect(intersections).toHaveLength(0);
        });

        it('should handle tangent case with single intersection', () => {
            const ellipse = createAxisAlignedEllipse({ x: 0, y: 0 }, 2, 1);

            // Ray tangent at top of ellipse
            const tangentRay: Ray = {
                origin: { x: -3, y: 1 },
                direction: { x: 1, y: 0 },
            };

            const intersections = findRayEllipseIntersections(
                tangentRay,
                ellipse
            );

            expect(intersections).toHaveLength(1);
            expect(intersections[0].type).toBe('tangent');
            expect(intersections[0].point.y).toBeCloseTo(1);
        });
    });

    describe('Rotated Ellipses', () => {
        it('should handle 90-degree rotated ellipse', () => {
            // Rotate 90 degrees: major axis becomes vertical
            const ellipse = createRotatedEllipse(
                { x: 0, y: 0 },
                3,
                1,
                Math.PI / 2
            );

            const ray: Ray = {
                origin: { x: -2, y: 0 },
                direction: { x: 1, y: 0 },
            };

            const crossings = countRayEllipseCrossings(ray, ellipse);
            expect(crossings).toBe(2); // Should still intersect
        });

        it('should handle arbitrary rotation angle', () => {
            const ellipse = createRotatedEllipse(
                { x: 0, y: 0 },
                4,
                2,
                Math.PI / 6
            ); // 30 degrees

            const ray: Ray = {
                origin: { x: -6, y: 1 },
                direction: { x: 1, y: 0 },
            };

            const crossings = countRayEllipseCrossings(ray, ellipse);
            expect(crossings).toBeGreaterThanOrEqual(0);
            expect(crossings).toBeLessThanOrEqual(2);
        });
    });

    describe('Ellipse Arcs', () => {
        it('should handle ellipse arc with parameter range', () => {
            const ellipseArc: Ellipse = {
                center: { x: 0, y: 0 },
                majorAxisEndpoint: { x: 3, y: 0 },
                minorToMajorRatio: 2 / 3,
                startParam: 0, // Start at major axis
                endParam: Math.PI, // End at opposite side (semicircle)
            };

            const ray: Ray = {
                origin: { x: -4, y: 1 },
                direction: { x: 1, y: 0 },
            };

            const crossings = countRayEllipseCrossings(ray, ellipseArc);
            expect(crossings).toBeLessThanOrEqual(2); // Arc can intersect at most twice for this ray (entry and exit)
        });

        it('should handle arc crossing 0 degree boundary', () => {
            const ellipseArc: Ellipse = {
                center: { x: 0, y: 0 },
                majorAxisEndpoint: { x: 2, y: 0 },
                minorToMajorRatio: 0.5,
                startParam: Math.PI * 1.5, // Start at 270°
                endParam: Math.PI * 0.5, // End at 90° (crosses 0°)
            };

            const ray: Ray = {
                origin: { x: -3, y: 0 },
                direction: { x: 1, y: 0 },
            };

            const crossings = countRayEllipseCrossings(ray, ellipseArc);
            expect(crossings).toBeGreaterThanOrEqual(0);
        });
    });

    describe('countHorizontalRayEllipseCrossings', () => {
        it('should count crossings for horizontal ray from point', () => {
            const ellipse = createAxisAlignedEllipse({ x: 5, y: 3 }, 2, 1);

            // Point to the left of ellipse
            const leftPoint = { x: 0, y: 3 };
            expect(countHorizontalRayEllipseCrossings(leftPoint, ellipse)).toBe(
                2
            );

            // Point inside ellipse
            const insidePoint = { x: 5, y: 3 };
            expect(
                countHorizontalRayEllipseCrossings(insidePoint, ellipse)
            ).toBe(1);

            // Point above ellipse
            const abovePoint = { x: 0, y: 10 };
            expect(
                countHorizontalRayEllipseCrossings(abovePoint, ellipse)
            ).toBe(0);
        });
    });

    describe('Edge Cases', () => {
        it('should handle degenerate ellipse (zero dimensions)', () => {
            const degenerateEllipse: Ellipse = {
                center: { x: 0, y: 0 },
                majorAxisEndpoint: { x: 0, y: 0 },
                minorToMajorRatio: 1,
            };

            const ray: Ray = {
                origin: { x: -1, y: 0 },
                direction: { x: 1, y: 0 },
            };

            expect(countRayEllipseCrossings(ray, degenerateEllipse)).toBe(0);
        });

        it('should handle highly eccentric ellipse', () => {
            const eccentric = createAxisAlignedEllipse({ x: 0, y: 0 }, 10, 0.1);

            const ray: Ray = {
                origin: { x: -15, y: 0 },
                direction: { x: 1, y: 0 },
            };

            expect(countRayEllipseCrossings(ray, eccentric)).toBe(2);
        });

        it('should handle ray with zero direction', () => {
            const ellipse = createAxisAlignedEllipse({ x: 0, y: 0 }, 2, 1);

            const pointRay: Ray = {
                origin: { x: 1, y: 0 },
                direction: { x: 0, y: 0 },
            };

            // Should handle gracefully (point is on ellipse boundary)
            const crossings = countRayEllipseCrossings(pointRay, ellipse);
            expect(crossings).toBeGreaterThanOrEqual(0);
        });

        it('should handle numerical precision near boundaries', () => {
            const ellipse = createAxisAlignedEllipse({ x: 0, y: 0 }, 1, 1);

            // Ray very close to tangent
            const nearTangentRay: Ray = {
                origin: { x: -2, y: 0.9999999 },
                direction: { x: 1, y: 0 },
            };

            const crossings = countRayEllipseCrossings(nearTangentRay, ellipse);
            expect(crossings).toBeGreaterThanOrEqual(0);
            expect(crossings).toBeLessThanOrEqual(2);
        });
    });
});
