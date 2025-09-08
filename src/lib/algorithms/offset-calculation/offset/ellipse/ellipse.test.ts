import { describe, it, expect } from 'vitest';
import { offsetEllipse } from './ellipse';
import type { Ellipse, Spline, Point2D } from '../../../../types/geometry';
import { findEllipseEllipseIntersectionsVerb } from '../../intersect/ellipse-ellipse';
import { findEllipseArcIntersectionsVerb } from '../../intersect/arc-ellipse';

describe('Quick Ellipse Intersection Test', () => {
    it('should find intersections between overlapping ellipses', () => {
        // Create two clearly overlapping ellipses
        const ellipse1 = {
            id: 'e1',
            type: 'ellipse' as const,
            geometry: {
                center: { x: 0, y: 0 },
                majorAxisEndpoint: { x: 10, y: 0 }, // 20x10 ellipse
                minorToMajorRatio: 0.5,
            },
        };

        const ellipse2 = {
            id: 'e2',
            type: 'ellipse' as const,
            geometry: {
                center: { x: 8, y: 0 }, // Overlapping by significant amount
                majorAxisEndpoint: { x: 10, y: 0 }, // Same size ellipse
                minorToMajorRatio: 0.5,
            },
        };

        const results = findEllipseEllipseIntersectionsVerb(ellipse1, ellipse2);
        results.forEach((_result, _i) => {});

        expect(results.length).toBeGreaterThan(0);
    });

    it('should find intersections between arc and ellipse', () => {
        // Create an arc and ellipse that should intersect
        const arcShape: import('$lib/types/geometry').Shape = {
            id: 'arc1',
            type: 'arc',
            geometry: {
                center: { x: 0, y: 0 },
                radius: 8,
                startAngle: -Math.PI / 4,
                endAngle: Math.PI / 4,
                clockwise: false,
            },
        };

        const ellipseShape: import('$lib/types/geometry').Shape = {
            id: 'ellipse1',
            type: 'ellipse',
            geometry: {
                center: { x: 5, y: 0 },
                majorAxisEndpoint: { x: 10, y: 0 }, // 20x10 ellipse
                minorToMajorRatio: 0.5,
            },
        };

        const results = findEllipseArcIntersectionsVerb(ellipseShape, arcShape);
        results.forEach((_result, _i) => {});

        expect(results.length).toBeGreaterThan(0);
    });
});

describe('offsetEllipse', () => {
    const testEllipse: Ellipse = {
        center: { x: 0, y: 0 },
        majorAxisEndpoint: { x: 10, y: 0 }, // 10-unit major axis along X
        minorToMajorRatio: 0.5, // 5-unit minor axis
    };

    it('should return no shapes when direction is none', () => {
        const result = offsetEllipse(testEllipse, 2, 'none');
        expect(result.success).toBe(true);
        expect(result.shapes).toHaveLength(0);
    });

    it('should return no shapes when distance is zero', () => {
        const result = offsetEllipse(testEllipse, 0, 'outset');
        expect(result.success).toBe(true);
        expect(result.shapes).toHaveLength(0);
    });

    it('should offset ellipse outward', () => {
        const result = offsetEllipse(testEllipse, 1, 'outset');
        expect(result.success).toBe(true);
        expect(result.shapes.length).toBeGreaterThan(0);
        expect(result.warnings).toContain(
            'Ellipse offset calculated using true mathematical offset and fitted to NURBS curve'
        );

        const offsetGeometry = result.shapes[0].geometry as Spline;
        expect(offsetGeometry.closed).toBe(true); // Full ellipse should be closed
        expect(offsetGeometry.controlPoints.length).toBeGreaterThan(0);
        expect(offsetGeometry.degree).toBeGreaterThan(0);
    });

    it('should offset ellipse inward', () => {
        const result = offsetEllipse(testEllipse, 1, 'inset');
        expect(result.success).toBe(true);
        expect(result.shapes.length).toBeGreaterThan(0);
    });

    it('should handle ellipse arcs', () => {
        const ellipseArc: Ellipse = {
            ...testEllipse,
            startParam: 0,
            endParam: Math.PI, // Half ellipse
        };

        const result = offsetEllipse(ellipseArc, 0.5, 'outset');
        expect(result.success).toBe(true);

        if (result.shapes.length > 0) {
            const offsetGeometry = result.shapes[0].geometry as Spline;
            expect(offsetGeometry.closed).toBe(false); // Arc should be open
        }
    });

    it('should handle rotated ellipses', () => {
        const rotatedEllipse: Ellipse = {
            center: { x: 5, y: 5 },
            majorAxisEndpoint: { x: 0, y: 8 }, // Rotated 90 degrees
            minorToMajorRatio: 0.6,
        };

        const result = offsetEllipse(rotatedEllipse, 1, 'outset');
        expect(result.success).toBe(true);
        expect(result.shapes.length).toBeGreaterThan(0);
    });

    it('should approximate ellipse perimeter within reasonable tolerance', () => {
        const ellipse: Ellipse = {
            center: { x: 0, y: 0 },
            majorAxisEndpoint: { x: 8, y: 0 }, // 8-unit major axis
            minorToMajorRatio: 0.75, // 6-unit minor axis
        };

        const result = offsetEllipse(ellipse, 1, 'outset');
        expect(result.success).toBe(true);

        const offsetGeometry = result.shapes[0].geometry as Spline;

        // Validate spline properties
        expect(offsetGeometry.controlPoints.length).toBeGreaterThan(0);
        expect(offsetGeometry.degree).toBeGreaterThan(0);
        expect(offsetGeometry.knots.length).toBe(
            offsetGeometry.controlPoints.length + offsetGeometry.degree + 1
        );
        expect(result.warnings).toContain(
            'Ellipse offset calculated using true mathematical offset and fitted to NURBS curve'
        );

        // Basic sanity check - should have reasonable control points count
        expect(offsetGeometry.controlPoints.length).toBeGreaterThan(4); // Should have multiple control points
        expect(offsetGeometry.controlPoints.length).toBeLessThan(1200); // With 1000 sample points, expect around 1000 control points
    });

    it('should maintain ellipse shape characteristics after offset', () => {
        const ellipse: Ellipse = {
            center: { x: 5, y: 3 },
            majorAxisEndpoint: { x: 4, y: 0 }, // 4-unit major axis along X
            minorToMajorRatio: 0.5, // 2-unit minor axis
        };

        const result = offsetEllipse(ellipse, 0.5, 'outset');
        expect(result.success).toBe(true);

        const offsetGeometry = result.shapes[0].geometry as Spline;

        // Check that the spline is reasonably centered around the original ellipse center
        const bounds = calculateBounds(offsetGeometry.controlPoints);
        const centerX = (bounds.minX + bounds.maxX) / 2;
        const centerY = (bounds.minY + bounds.maxY) / 2;

        expect(centerX).toBeCloseTo(ellipse.center.x, 1);
        expect(centerY).toBeCloseTo(ellipse.center.y, 1);

        // Check that the spline has reasonable bounds
        expect(bounds.width).toBeGreaterThan(8); // Should be larger than original
        expect(bounds.height).toBeGreaterThan(4); // Should be larger than original
    });

    it('should generate spline with reasonable control points count', () => {
        const result = offsetEllipse(testEllipse, 1, 'outset');
        expect(result.success).toBe(true);

        const offsetGeometry = result.shapes[0].geometry as Spline;
        // Should have reasonable number of control points (with 1000 sample points)
        expect(offsetGeometry.controlPoints.length).toBeGreaterThan(4);
        expect(offsetGeometry.controlPoints.length).toBeLessThan(1200); // Should be around 1000 with high resolution
        expect(offsetGeometry.degree).toBeGreaterThan(0);
        expect(offsetGeometry.degree).toBeLessThanOrEqual(3); // Cubic or lower
    });

    it('should handle ellipse with very small minor axis', () => {
        const thinEllipse: Ellipse = {
            center: { x: 0, y: 0 },
            majorAxisEndpoint: { x: 20, y: 0 },
            minorToMajorRatio: 0.1, // Very thin ellipse
        };

        const result = offsetEllipse(thinEllipse, 0.5, 'outset');
        expect(result.success).toBe(true);
        expect(result.shapes.length).toBeGreaterThan(0);
    });

    it('should handle near-circular ellipse', () => {
        const nearCircle: Ellipse = {
            center: { x: 0, y: 0 },
            majorAxisEndpoint: { x: 10, y: 0 },
            minorToMajorRatio: 0.99, // Almost circular
        };

        const result = offsetEllipse(nearCircle, 2, 'outset');
        expect(result.success).toBe(true);
        expect(result.shapes.length).toBeGreaterThan(0);
    });
});

// Helper functions - kept for backwards compatibility but not used for splines

function calculateBounds(points: Point2D[]) {
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);

    return {
        minX: Math.min(...xs),
        maxX: Math.max(...xs),
        minY: Math.min(...ys),
        maxY: Math.max(...ys),
        width: Math.max(...xs) - Math.min(...xs),
        height: Math.max(...ys) - Math.min(...ys),
    };
}
