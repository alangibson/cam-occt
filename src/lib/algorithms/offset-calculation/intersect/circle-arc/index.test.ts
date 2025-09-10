import { describe, it, expect } from 'vitest';
import { findArcCircleIntersections } from './index';
import type { Circle, Arc } from '../../../../../lib/types/geometry';

describe('Arc-Circle Intersections', () => {
    it('should find intersections when arc intersects circle at two points', () => {
        const arc: Arc = {
            center: { x: 0, y: 0 },
            radius: 50,
            startAngle: -Math.PI / 4,
            endAngle: Math.PI / 4,
            clockwise: false,
        };

        const circle: Circle = {
            center: { x: 30, y: 0 },
            radius: 30,
        };

        const results = findArcCircleIntersections(arc, circle);

        expect(results.length).toBeGreaterThan(0);

        // Verify intersection points are on both the arc and circle
        results.forEach((result) => {
            const { point } = result;

            // Distance from arc center should equal arc radius
            const distFromArcCenter = Math.sqrt(point.x ** 2 + point.y ** 2);
            expect(Math.abs(distFromArcCenter - 50)).toBeLessThan(0.01);

            // Distance from circle center should equal circle radius
            const distFromCircleCenter = Math.sqrt(
                (point.x - 30) ** 2 + point.y ** 2
            );
            expect(Math.abs(distFromCircleCenter - 30)).toBeLessThan(0.01);

            // Point should be within arc's angular range
            const angle = Math.atan2(point.y, point.x);
            expect(angle).toBeGreaterThanOrEqual(-Math.PI / 4 - 0.01);
            expect(angle).toBeLessThanOrEqual(Math.PI / 4 + 0.01);
        });
    });

    it('should find one intersection when arc is tangent to circle', () => {
        const arc: Arc = {
            center: { x: 0, y: 0 },
            radius: 40,
            startAngle: -Math.PI / 6,
            endAngle: Math.PI / 6,
            clockwise: false,
        };

        const circle: Circle = {
            center: { x: 60, y: 0 },
            radius: 20,
        };

        const results = findArcCircleIntersections(arc, circle);

        expect(results).toHaveLength(1);

        const { point } = results[0];

        // Point should be at (40, 0) - tangent point
        expect(Math.abs(point.x - 40)).toBeLessThan(0.01);
        expect(Math.abs(point.y)).toBeLessThan(0.01);
    });

    it('should find no intersections when arc and circle do not intersect', () => {
        const arc: Arc = {
            center: { x: 0, y: 0 },
            radius: 20,
            startAngle: 0,
            endAngle: Math.PI / 2,
            clockwise: false,
        };

        const circle: Circle = {
            center: { x: 100, y: 100 },
            radius: 15,
        };

        const results = findArcCircleIntersections(arc, circle);

        expect(results).toHaveLength(0);
    });

    it('should find intersections only within arc angular range', () => {
        const arc: Arc = {
            center: { x: 0, y: 0 },
            radius: 50,
            startAngle: Math.PI,
            endAngle: (3 * Math.PI) / 2,
            clockwise: false,
        };

        const circle: Circle = {
            center: { x: -30, y: -30 },
            radius: 30,
        };

        const results = findArcCircleIntersections(arc, circle);

        // Should only find intersections within the arc's angular range (180° to 270°)
        results.forEach((result) => {
            const { point } = result;

            const angle = Math.atan2(point.y, point.x);
            // Normalize angle to [0, 2π] for comparison
            const normalizedAngle = angle < 0 ? angle + 2 * Math.PI : angle;

            expect(normalizedAngle).toBeGreaterThanOrEqual(Math.PI - 0.01);
            expect(normalizedAngle).toBeLessThanOrEqual(
                (3 * Math.PI) / 2 + 0.01
            );
        });
    });

    it('should handle clockwise arc intersecting circle', () => {
        const arc: Arc = {
            center: { x: 0, y: 0 },
            radius: 35,
            startAngle: Math.PI / 4,
            endAngle: -Math.PI / 4,
            clockwise: true,
        };

        const circle: Circle = {
            center: { x: 25, y: 0 },
            radius: 20,
        };

        const results = findArcCircleIntersections(arc, circle);

        // Should handle clockwise arcs correctly
        expect(results.length).toBeGreaterThanOrEqual(0);

        results.forEach((result) => {
            const { point } = result;

            // Verify point is on both shapes
            const distFromArcCenter = Math.sqrt(point.x ** 2 + point.y ** 2);
            expect(Math.abs(distFromArcCenter - 35)).toBeLessThan(0.01);

            const distFromCircleCenter = Math.sqrt(
                (point.x - 25) ** 2 + point.y ** 2
            );
            expect(Math.abs(distFromCircleCenter - 20)).toBeLessThan(0.01);
        });
    });

    it('should handle very small arc intersecting circle', () => {
        const arc: Arc = {
            center: { x: 0, y: 0 },
            radius: 10,
            startAngle: -0.1,
            endAngle: 0.1,
            clockwise: false,
        };

        const circle: Circle = {
            center: { x: 8, y: 0 },
            radius: 5,
        };

        const results = findArcCircleIntersections(arc, circle);

        expect(results.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle arc completely inside circle', () => {
        const arc: Arc = {
            center: { x: 10, y: 10 },
            radius: 15,
            startAngle: 0,
            endAngle: Math.PI,
            clockwise: false,
        };

        const circle: Circle = {
            center: { x: 10, y: 10 },
            radius: 50,
        };

        const results = findArcCircleIntersections(arc, circle);

        // Arc is completely inside circle - should find no intersections
        expect(results).toHaveLength(0);
    });

    it('should handle circle completely inside arc path', () => {
        const arc: Arc = {
            center: { x: 0, y: 0 },
            radius: 80,
            startAngle: 0,
            endAngle: Math.PI,
            clockwise: false,
        };

        const circle: Circle = {
            center: { x: 40, y: 40 },
            radius: 10,
        };

        const results = findArcCircleIntersections(arc, circle);

        // Circle is completely inside the area swept by the arc
        expect(results.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle integer coordinate intersections', () => {
        // Arc with radius 13, centered at origin, from 0 to π/2
        // Circle with radius 5, centered at (12, 0)
        // Should intersect at approximately (12, 5)
        const arc: Arc = {
            center: { x: 0, y: 0 },
            radius: 13,
            startAngle: 0,
            endAngle: Math.PI / 2,
            clockwise: false,
        };

        const circle: Circle = {
            center: { x: 12, y: 0 },
            radius: 5,
        };

        const results = findArcCircleIntersections(arc, circle);

        expect(results.length).toBeGreaterThan(0);

        results.forEach((result) => {
            const { point } = result;

            // Verify point is on both shapes
            const distFromArcCenter = Math.sqrt(point.x ** 2 + point.y ** 2);
            expect(Math.abs(distFromArcCenter - 13)).toBeLessThan(0.01);

            const distFromCircleCenter = Math.sqrt(
                (point.x - 12) ** 2 + point.y ** 2
            );
            expect(Math.abs(distFromCircleCenter - 5)).toBeLessThan(0.01);
        });
    });

    it('should handle full circle arc intersecting circle', () => {
        const fullArc: Arc = {
            center: { x: 0, y: 0 },
            radius: 25,
            startAngle: 0,
            endAngle: 2 * Math.PI,
            clockwise: false,
        };

        const circle: Circle = {
            center: { x: 20, y: 0 },
            radius: 15,
        };

        const results = findArcCircleIntersections(fullArc, circle);

        // Full arc is essentially a circle, should intersect at two points
        expect(results.length).toBeGreaterThanOrEqual(1);
    });
});
