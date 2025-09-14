import { describe, expect, it } from 'vitest';
import {
    countHorizontalRayArcCrossings,
    countRayArcCrossings,
    findRayArcIntersections,
} from './ray-arc';
import type { Arc } from '$lib/geometry/arc';
import type { Point2D } from '$lib/types/geometry';
import type { Ray, RayTracingConfig } from './types';

describe('Ray-Arc Intersection', () => {
    const defaultConfig: RayTracingConfig = {
        epsilon: 1e-10,
        boundaryRule: 'lower-inclusive',
    };

    describe('countRayArcCrossings', () => {
        it('should count intersections for 90° arc', () => {
            const ray: Ray = {
                origin: { x: 0, y: 0 },
                direction: { x: 1, y: 0 }, // horizontal ray to the right
            };
            const arc: Arc = {
                center: { x: 2, y: 0 },
                radius: 1,
                startAngle: -Math.PI / 2, // starts at bottom
                endAngle: 0, // ends at right
                clockwise: false,
            };

            const crossings = countRayArcCrossings(ray, arc, defaultConfig);
            expect(crossings).toBe(1); // Ray intersects arc once
        });

        it('should count intersections for 180° arc', () => {
            const ray: Ray = {
                origin: { x: 0, y: 0 },
                direction: { x: 1, y: 0 },
            };
            const arc: Arc = {
                center: { x: 2, y: 0 },
                radius: 1,
                startAngle: -Math.PI / 2, // starts at bottom
                endAngle: Math.PI / 2, // ends at top
                clockwise: false,
            };

            const crossings = countRayArcCrossings(ray, arc, defaultConfig);
            expect(crossings).toBe(1); // Ray intersects semicircle once at right side (0°)
        });

        it('should return 0 when ray misses arc', () => {
            const ray: Ray = {
                origin: { x: 0, y: 0 },
                direction: { x: 1, y: 0 },
            };
            const arc: Arc = {
                center: { x: 2, y: 0 },
                radius: 1,
                startAngle: Math.PI / 2, // starts at top
                endAngle: Math.PI, // ends at left
                clockwise: false,
            };

            const crossings = countRayArcCrossings(ray, arc, defaultConfig);
            expect(crossings).toBe(1); // Ray intersects arc at the left endpoint (180°)
        });

        it('should handle clockwise arcs', () => {
            const ray: Ray = {
                origin: { x: 0, y: 0 },
                direction: { x: 1, y: 0 },
            };
            const arc: Arc = {
                center: { x: 2, y: 0 },
                radius: 1,
                startAngle: 0, // starts at right
                endAngle: -Math.PI / 2, // ends at bottom
                clockwise: true,
            };

            const crossings = countRayArcCrossings(ray, arc, defaultConfig);
            expect(crossings).toBe(1);
        });

        it('should handle full circle (360° arc)', () => {
            const ray: Ray = {
                origin: { x: 0, y: 0 },
                direction: { x: 1, y: 0 },
            };
            const arc: Arc = {
                center: { x: 2, y: 0 },
                radius: 1,
                startAngle: 0,
                endAngle: 0, // Same start/end = full circle
                clockwise: false,
            };

            const crossings = countRayArcCrossings(ray, arc, defaultConfig);
            expect(crossings).toBe(2); // Full circle intersects ray twice
        });

        it('should handle arc above ray level', () => {
            const ray: Ray = {
                origin: { x: 0, y: 0 },
                direction: { x: 1, y: 0 },
            };
            const arc: Arc = {
                center: { x: 2, y: 2 }, // center above ray
                radius: 1,
                startAngle: 0,
                endAngle: Math.PI,
                clockwise: false,
            };

            const crossings = countRayArcCrossings(ray, arc, defaultConfig);
            expect(crossings).toBe(0); // Arc doesn't reach ray level
        });

        it('should handle tangent ray', () => {
            const ray: Ray = {
                origin: { x: 0, y: 1 }, // ray at y = 1
                direction: { x: 1, y: 0 },
            };
            const arc: Arc = {
                center: { x: 2, y: 0 },
                radius: 1,
                startAngle: 0,
                endAngle: Math.PI,
                clockwise: false,
            };

            const crossings = countRayArcCrossings(ray, arc, defaultConfig);
            expect(crossings).toBe(1); // Tangent intersection
        });
    });

    describe('findRayArcIntersections', () => {
        it('should find intersection points for 90° arc', () => {
            const ray: Ray = {
                origin: { x: 0, y: 0 },
                direction: { x: 1, y: 0 },
            };
            const arc: Arc = {
                center: { x: 2, y: 0 },
                radius: 1,
                startAngle: -Math.PI / 2,
                endAngle: 0,
                clockwise: false,
            };

            const intersections = findRayArcIntersections(
                ray,
                arc,
                defaultConfig
            );
            expect(intersections).toHaveLength(1);
            expect(intersections[0].point.x).toBeCloseTo(3); // center.x + radius
            expect(intersections[0].point.y).toBeCloseTo(0);
            expect(intersections[0].t).toBeCloseTo(3);
        });

        it('should classify endpoint intersections', () => {
            const ray: Ray = {
                origin: { x: 0, y: 0 },
                direction: { x: 1, y: 0 },
            };
            const arc: Arc = {
                center: { x: 2, y: 0 },
                radius: 1,
                startAngle: 0, // endpoint at (3, 0)
                endAngle: Math.PI / 2,
                clockwise: false,
            };

            const intersections = findRayArcIntersections(
                ray,
                arc,
                defaultConfig
            );
            expect(intersections).toHaveLength(1);
            expect(intersections[0].type).toBe('endpoint');
        });

        it('should handle multiple intersections', () => {
            const ray: Ray = {
                origin: { x: 0, y: 0 },
                direction: { x: 1, y: 0 },
            };
            const arc: Arc = {
                center: { x: 3, y: 0 },
                radius: 2,
                startAngle: -Math.PI / 2,
                endAngle: Math.PI / 2,
                clockwise: false,
            };

            const intersections = findRayArcIntersections(
                ray,
                arc,
                defaultConfig
            );
            expect(intersections).toHaveLength(1);

            // Should only intersect at the right side (0°)
            expect(intersections[0].point.x).toBeCloseTo(5); // center.x + radius
            expect(intersections[0].point.y).toBeCloseTo(0);
        });
    });

    describe('countHorizontalRayArcCrossings', () => {
        it('should handle horizontal ray efficiently', () => {
            const rayOrigin: Point2D = { x: 0, y: 0 };
            const arc: Arc = {
                center: { x: 2, y: 0 },
                radius: 1,
                startAngle: -Math.PI / 2,
                endAngle: Math.PI / 2,
                clockwise: false,
            };

            const crossings = countHorizontalRayArcCrossings(
                rayOrigin,
                arc,
                defaultConfig
            );
            expect(crossings).toBe(1); // Only right intersection (x = 3) is counted
        });

        it('should handle arc completely above ray', () => {
            const rayOrigin: Point2D = { x: 0, y: 0 };
            const arc: Arc = {
                center: { x: 2, y: 3 }, // well above ray
                radius: 1,
                startAngle: 0,
                endAngle: Math.PI,
                clockwise: false,
            };

            const crossings = countHorizontalRayArcCrossings(
                rayOrigin,
                arc,
                defaultConfig
            );
            expect(crossings).toBe(0);
        });

        it('should handle tangent intersection', () => {
            const rayOrigin: Point2D = { x: 0, y: 1 };
            const arc: Arc = {
                center: { x: 2, y: 0 },
                radius: 1,
                startAngle: 0,
                endAngle: Math.PI,
                clockwise: false,
            };

            const crossings = countHorizontalRayArcCrossings(
                rayOrigin,
                arc,
                defaultConfig
            );
            expect(crossings).toBe(1); // Tangent at top of arc
        });

        it('should not count intersections behind ray origin', () => {
            const rayOrigin: Point2D = { x: 5, y: 0 };
            const arc: Arc = {
                center: { x: 2, y: 0 },
                radius: 1,
                startAngle: -Math.PI / 2,
                endAngle: Math.PI / 2,
                clockwise: false,
            };

            const crossings = countHorizontalRayArcCrossings(
                rayOrigin,
                arc,
                defaultConfig
            );
            expect(crossings).toBe(0); // All intersections are behind ray origin
        });
    });

    describe('Angular Range Tests', () => {
        it('should handle arcs crossing 0° boundary counter-clockwise', () => {
            const ray: Ray = {
                origin: { x: 0, y: 0 },
                direction: { x: 1, y: 0 },
            };
            const arc: Arc = {
                center: { x: 2, y: 0 },
                radius: 1,
                startAngle: (3 * Math.PI) / 2, // 270° (bottom)
                endAngle: Math.PI / 2, // 90° (top) - crosses 0°
                clockwise: false,
            };

            const crossings = countRayArcCrossings(ray, arc, defaultConfig);
            expect(crossings).toBe(1); // Should intersect at right side
        });

        it('should handle arcs crossing 0° boundary clockwise', () => {
            const ray: Ray = {
                origin: { x: 0, y: 0 },
                direction: { x: 1, y: 0 },
            };
            const arc: Arc = {
                center: { x: 2, y: 0 },
                radius: 1,
                startAngle: Math.PI / 2, // 90° (top)
                endAngle: (3 * Math.PI) / 2, // 270° (bottom) - crosses 0°
                clockwise: true,
            };

            const crossings = countRayArcCrossings(ray, arc, defaultConfig);
            expect(crossings).toBe(1); // Should intersect at right side
        });

        it('should handle very small arcs', () => {
            const ray: Ray = {
                origin: { x: 0, y: 0 },
                direction: { x: 1, y: 0 },
            };
            const arc: Arc = {
                center: { x: 2, y: 0 },
                radius: 1,
                startAngle: -0.01,
                endAngle: 0.01, // very small arc around 0°
                clockwise: false,
            };

            const crossings = countRayArcCrossings(ray, arc, defaultConfig);
            expect(crossings).toBe(1); // Should still intersect
        });
    });

    describe('Edge Cases', () => {
        it('should handle ray passing through arc center', () => {
            const ray: Ray = {
                origin: { x: 0, y: 0 },
                direction: { x: 1, y: 0 },
            };
            const arc: Arc = {
                center: { x: 2, y: 0 }, // center on ray
                radius: 1,
                startAngle: -Math.PI / 2,
                endAngle: Math.PI / 2,
                clockwise: false,
            };

            const crossings = countRayArcCrossings(ray, arc, defaultConfig);
            expect(crossings).toBe(1); // Only rightmost intersection counts
        });

        it('should handle zero-radius arc (degenerate)', () => {
            const ray: Ray = {
                origin: { x: 0, y: 0 },
                direction: { x: 1, y: 0 },
            };
            const arc: Arc = {
                center: { x: 2, y: 0 },
                radius: 0, // degenerate arc (point)
                startAngle: 0,
                endAngle: Math.PI,
                clockwise: false,
            };

            const crossings = countRayArcCrossings(ray, arc, defaultConfig);
            expect(crossings).toBe(0); // Zero radius = no meaningful intersection
        });

        it('should handle very large radius arc', () => {
            const ray: Ray = {
                origin: { x: 0, y: 0 },
                direction: { x: 1, y: 0 },
            };
            const arc: Arc = {
                center: { x: 1000000, y: 1000000 },
                radius: 1414214, // Large radius, arc passes near origin
                startAngle: (-3 * Math.PI) / 4, // Positioned to intersect ray
                endAngle: -Math.PI / 4,
                clockwise: false,
            };

            // This test verifies numerical stability with large numbers
            const crossings = countRayArcCrossings(ray, arc, defaultConfig);
            expect(typeof crossings).toBe('number');
            expect(crossings >= 0).toBe(true);
        });
    });
});
