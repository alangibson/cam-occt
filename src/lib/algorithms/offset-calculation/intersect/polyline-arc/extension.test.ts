import { describe, test, expect } from 'vitest';
import type { Polyline, Shape, Arc } from '../../../../types/geometry';
import { createPolylineFromVertices } from '../../../../geometry/polyline';
import { findPolylineArcIntersections } from './index';

describe('Polyline-Arc Extension Intersections', () => {
    test('should find intersection with extended polyline', () => {
        // Simple horizontal polyline that doesn't reach the arc
        const polyline: Shape = createPolylineFromVertices(
            [
                { x: 0, y: 0, bulge: 0 },
                { x: 5, y: 0, bulge: 0 },
            ],
            false
        );

        // Arc positioned well beyond the polyline end
        const arc: Arc = {
            center: { x: 15, y: 0 },
            radius: 3,
            startAngle: 0,
            endAngle: 2 * Math.PI,
            clockwise: false,
        };

        // Without extensions - should find no intersections
        const noExtensions = findPolylineArcIntersections(
            polyline.geometry as Polyline,
            arc,
            false,
            false
        );
        expect(noExtensions).toHaveLength(0);

        // With extensions - should find intersection where extended polyline meets arc
        const withExtensions = findPolylineArcIntersections(
            polyline.geometry as Polyline,
            arc,
            false,
            true,
            1000
        );
        expect(withExtensions.length).toBeGreaterThan(0);

        // Verify the intersection is marked as being on an extension
        const intersection = withExtensions[0];
        expect(intersection.onExtension).toBe(true);
    });

    test('should find intersection with extended arc', () => {
        // Polyline positioned to intersect with an extended arc
        const polyline: Shape = createPolylineFromVertices(
            [
                { x: 0, y: 5, bulge: 0 },
                { x: 30, y: 5, bulge: 0 },
            ],
            false
        );

        // Short arc that doesn't reach the polyline without extension
        const arc: Arc = {
            center: { x: 15, y: 5 },
            radius: 5,
            startAngle: Math.PI / 4, // 45 degrees
            endAngle: Math.PI / 3, // 60 degrees - small arc
            clockwise: false,
        };

        // Without extensions - should find no intersections
        const noExtensions = findPolylineArcIntersections(
            polyline.geometry as Polyline,
            arc,
            false,
            false
        );
        expect(noExtensions).toHaveLength(0);

        // With extensions - should find intersection where extended arc meets polyline
        const withExtensions = findPolylineArcIntersections(
            polyline.geometry as Polyline,
            arc,
            false,
            true,
            20
        );
        expect(withExtensions.length).toBeGreaterThan(0);

        // Verify the intersection is marked as being on an extension
        const intersection = withExtensions[0];
        expect(intersection.onExtension).toBe(true);
    });

    test('should find intersection with both extended shapes', () => {
        // Short polyline that doesn't reach the arc
        const polyline: Shape = createPolylineFromVertices(
            [
                { x: 0, y: 5, bulge: 0 },
                { x: 5, y: 5, bulge: 0 },
            ],
            false
        );

        // Short arc positioned away from the short polyline
        const arc: Arc = {
            center: { x: 15, y: 5 },
            radius: 5,
            startAngle: Math.PI / 4, // 45 degrees
            endAngle: Math.PI / 3, // 60 degrees - small arc
            clockwise: false,
        };

        // Without extensions - should find no intersections
        const noExtensions = findPolylineArcIntersections(
            polyline.geometry as Polyline,
            arc,
            false,
            false
        );
        expect(noExtensions).toHaveLength(0);

        // With extensions - should find intersection where both shapes are extended
        const withExtensions = findPolylineArcIntersections(
            polyline.geometry as Polyline,
            arc,
            false,
            true,
            20
        );
        expect(withExtensions.length).toBeGreaterThan(0);

        // Verify the intersection is marked as being on an extension
        const intersection = withExtensions[0];
        expect(intersection.onExtension).toBe(true);
    });

    test('should return original intersections when they exist', () => {
        // Polyline and arc that intersect normally
        const polyline: Shape = createPolylineFromVertices(
            [
                { x: 0, y: 5, bulge: 0 },
                { x: 30, y: 5, bulge: 0 },
            ],
            false
        );

        const arc: Arc = {
            center: { x: 15, y: 5 },
            radius: 5,
            startAngle: 0,
            endAngle: 2 * Math.PI,
            clockwise: false,
        };

        // Should find 2 intersections (polyline passes through circle)
        const intersections = findPolylineArcIntersections(
            polyline.geometry as Polyline,
            arc,
            false,
            true,
            1000
        );
        expect(intersections).toHaveLength(2);

        // These should not be marked as extensions since they exist on original shapes
        intersections.forEach((intersection) => {
            expect(intersection.onExtension || false).toBe(false);
        });
    });

    test('should handle multi-segment polyline extensions', () => {
        // Multi-segment polyline forming a simple path
        const polyline: Shape = createPolylineFromVertices(
            [
                { x: 0, y: 0, bulge: 0 },
                { x: 5, y: 0, bulge: 0 },
                { x: 5, y: 5, bulge: 0 },
            ],
            false
        );

        // Arc positioned beyond the last segment
        const arc: Arc = {
            center: { x: 5, y: 15 },
            radius: 3,
            startAngle: 0,
            endAngle: 2 * Math.PI,
            clockwise: false,
        };

        // Without extensions - should find no intersections
        const noExtensions = findPolylineArcIntersections(
            polyline.geometry as Polyline,
            arc,
            false,
            false
        );
        expect(noExtensions).toHaveLength(0);

        // With extensions - should find intersection on extended last segment
        const withExtensions = findPolylineArcIntersections(
            polyline.geometry as Polyline,
            arc,
            false,
            true,
            1000
        );
        expect(withExtensions.length).toBeGreaterThan(0);

        // Verify the intersection is marked as being on an extension
        const intersection = withExtensions[0];
        expect(intersection.onExtension).toBe(true);
    });

    test('should handle closed polyline correctly', () => {
        // Closed rectangular polyline
        const polyline: Shape = createPolylineFromVertices(
            [
                { x: 0, y: 0, bulge: 0 },
                { x: 10, y: 0, bulge: 0 },
                { x: 10, y: 10, bulge: 0 },
                { x: 0, y: 10, bulge: 0 },
            ],
            true
        );

        // Arc that intersects the rectangle
        // Circle centered at (5,5) needs radius > 5 to reach rectangle edges
        const arc: Arc = {
            center: { x: 5, y: 5 },
            radius: 6,
            startAngle: 0,
            endAngle: 2 * Math.PI,
            clockwise: false,
        };

        // Should find multiple intersections with the closed polyline
        const intersections = findPolylineArcIntersections(
            polyline.geometry as Polyline,
            arc,
            false,
            false
        );
        expect(intersections.length).toBeGreaterThan(0);

        // Intersections with original closed polyline should not be on extensions
        intersections.forEach((intersection) => {
            expect(intersection.onExtension || false).toBe(false);
        });
    });

    test('should handle parameter swapping correctly', () => {
        // Simple polyline
        const polyline: Shape = createPolylineFromVertices(
            [
                { x: 0, y: 5, bulge: 0 },
                { x: 20, y: 5, bulge: 0 },
            ],
            false
        );

        // Arc that intersects the polyline
        const arc: Arc = {
            center: { x: 10, y: 5 },
            radius: 3,
            startAngle: 0,
            endAngle: 2 * Math.PI,
            clockwise: false,
        };

        // Test normal parameter order
        const normalOrder = findPolylineArcIntersections(
            polyline.geometry as Polyline,
            arc,
            false,
            false
        );
        expect(normalOrder.length).toBeGreaterThan(0);

        // Test swapped parameter order
        const swappedOrder = findPolylineArcIntersections(
            polyline.geometry as Polyline,
            arc,
            true,
            false
        );
        expect(swappedOrder.length).toEqual(normalOrder.length);

        // Parameters should be swapped between the two calls
        normalOrder.forEach((normal, index) => {
            const swapped = swappedOrder[index];
            expect(swapped.param1).toBeCloseTo(normal.param2, 6);
            expect(swapped.param2).toBeCloseTo(normal.param1, 6);
        });
    });
});
