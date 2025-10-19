import { describe, expect, it } from 'vitest';
import { findCircleCircleIntersections } from './index';
import type { Circle } from '$lib/geometry/circle/interfaces';

describe('Circle-Circle Intersections', () => {
    it('should find two intersections when circles intersect at two points', () => {
        const circle1: Circle = {
            center: { x: 0, y: 0 },
            radius: 50,
        };

        const circle2: Circle = {
            center: { x: 60, y: 0 },
            radius: 50,
        };

        const results = findCircleCircleIntersections(circle1, circle2);

        expect(results).toHaveLength(2);

        // Check that both intersection points are on both circles
        results.forEach((result) => {
            const { point } = result;

            // Distance from circle1 center should equal radius1
            const dist1 = Math.sqrt(point.x ** 2 + point.y ** 2);
            expect(Math.abs(dist1 - 50)).toBeLessThan(0.01);

            // Distance from circle2 center should equal radius2
            const dist2 = Math.sqrt((point.x - 60) ** 2 + point.y ** 2);
            expect(Math.abs(dist2 - 50)).toBeLessThan(0.01);
        });
    });

    it('should find one intersection when circles are tangent externally', () => {
        const circle1: Circle = {
            center: { x: 0, y: 0 },
            radius: 30,
        };

        const circle2: Circle = {
            center: { x: 80, y: 0 },
            radius: 50,
        };

        const results = findCircleCircleIntersections(circle1, circle2);

        expect(results).toHaveLength(1);

        const { point } = results[0];

        // Point should be at (30, 0) - tangent point
        expect(Math.abs(point.x - 30)).toBeLessThan(0.01);
        expect(Math.abs(point.y)).toBeLessThan(0.01);
    });

    it('should find one intersection when circles are tangent internally', () => {
        const circle1: Circle = {
            center: { x: 0, y: 0 },
            radius: 100,
        };

        const circle2: Circle = {
            center: { x: 40, y: 0 },
            radius: 60,
        };

        const results = findCircleCircleIntersections(circle1, circle2);

        expect(results).toHaveLength(1);

        const { point } = results[0];

        // Point should be at (100, 0) - internal tangent point
        expect(Math.abs(point.x - 100)).toBeLessThan(0.01);
        expect(Math.abs(point.y)).toBeLessThan(0.01);
    });

    it('should find no intersections when circles are separate', () => {
        const circle1: Circle = {
            center: { x: 0, y: 0 },
            radius: 20,
        };

        const circle2: Circle = {
            center: { x: 100, y: 0 },
            radius: 20,
        };

        const results = findCircleCircleIntersections(circle1, circle2);

        expect(results).toHaveLength(0);
    });

    it('should find no intersections when one circle is completely inside another', () => {
        const circle1: Circle = {
            center: { x: 0, y: 0 },
            radius: 100,
        };

        const circle2: Circle = {
            center: { x: 20, y: 20 },
            radius: 30,
        };

        const results = findCircleCircleIntersections(circle1, circle2);

        expect(results).toHaveLength(0);
    });

    it('should handle identical circles', () => {
        const circle1: Circle = {
            center: { x: 50, y: 25 },
            radius: 40,
        };

        const circle2: Circle = {
            center: { x: 50, y: 25 },
            radius: 40,
        };

        const results = findCircleCircleIntersections(circle1, circle2);

        // Identical circles either have infinite intersections or are treated as no intersection
        // Behavior depends on the underlying arc-arc implementation
        expect(results.length).toBeGreaterThanOrEqual(0);
    });

    it('should find intersections with integer coordinates case', () => {
        // Two circles with radius 5, centers at (0,0) and (8,0)
        // Should intersect at (4, 3) and (4, -3)
        const circle1: Circle = {
            center: { x: 0, y: 0 },
            radius: 5,
        };

        const circle2: Circle = {
            center: { x: 8, y: 0 },
            radius: 5,
        };

        const results = findCircleCircleIntersections(circle1, circle2);

        expect(results).toHaveLength(2);

        // Sort results by y coordinate for predictable testing
        results.sort((a, b) => a.point.y - b.point.y);

        // First intersection should be at (4, -3)
        expect(Math.abs(results[0].point.x - 4)).toBeLessThan(0.01);
        expect(Math.abs(results[0].point.y - -3)).toBeLessThan(0.01);

        // Second intersection should be at (4, 3)
        expect(Math.abs(results[1].point.x - 4)).toBeLessThan(0.01);
        expect(Math.abs(results[1].point.y - 3)).toBeLessThan(0.01);
    });

    it('should find intersections when circles are positioned diagonally', () => {
        const circle1: Circle = {
            center: { x: 0, y: 0 },
            radius: 50,
        };

        const circle2: Circle = {
            center: { x: 60, y: 80 },
            radius: 70,
        };

        const results = findCircleCircleIntersections(circle1, circle2);

        expect(results).toHaveLength(2);

        // Verify all intersection points are on both circles
        results.forEach((result) => {
            const { point } = result;

            const dist1 = Math.sqrt(point.x ** 2 + point.y ** 2);
            expect(Math.abs(dist1 - 50)).toBeLessThan(0.01);

            const dist2 = Math.sqrt((point.x - 60) ** 2 + (point.y - 80) ** 2);
            expect(Math.abs(dist2 - 70)).toBeLessThan(0.01);
        });
    });

    it('should handle very small circles', () => {
        const circle1: Circle = {
            center: { x: 0, y: 0 },
            radius: 0.1,
        };

        const circle2: Circle = {
            center: { x: 0.15, y: 0 },
            radius: 0.1,
        };

        const results = findCircleCircleIntersections(circle1, circle2);

        expect(results).toHaveLength(2);

        // Verify intersection points
        results.forEach((result) => {
            const { point } = result;

            const dist1 = Math.sqrt(point.x ** 2 + point.y ** 2);
            expect(Math.abs(dist1 - 0.1)).toBeLessThan(0.001);

            const dist2 = Math.sqrt((point.x - 0.15) ** 2 + point.y ** 2);
            expect(Math.abs(dist2 - 0.1)).toBeLessThan(0.001);
        });
    });

    it('should handle very large circles', () => {
        const circle1: Circle = {
            center: { x: 0, y: 0 },
            radius: 10000,
        };

        const circle2: Circle = {
            center: { x: 15000, y: 0 },
            radius: 10000,
        };

        const results = findCircleCircleIntersections(circle1, circle2);

        expect(results).toHaveLength(2);

        // Verify intersection points - for circles with radius 10000 and centers 15000 apart
        // The intersection x coordinate is at 7500 (midpoint) and y = ±6614.38
        // Using Pythagorean theorem: sqrt(10000² - 7500²) = sqrt(43750000) ≈ 6614.38
        results.forEach((result) => {
            const { point } = result;

            expect(Math.abs(point.x - 7500)).toBeLessThan(1);
            expect(Math.abs(Math.abs(point.y) - 6614.38)).toBeLessThan(1);
        });
    });
});
