/**
 * Tests for ellipse point calculations
 * Testing the mathematical correctness of ellipse parametric equations
 */

import { describe, it, expect } from 'vitest';
import type { Point2D } from '../../lib/types';

interface Ellipse {
    center: Point2D;
    majorAxisEndpoint: Point2D;
    minorToMajorRatio: number;
    startParam?: number;
    endParam?: number;
}

// Helper function to calculate a point on an ellipse at a given parameter
// Uses the ezdxf approach: calculating minor axis using cross product equivalent
function getEllipsePointAtParameter(
    ellipse: Ellipse,
    parameter: number
): Point2D {
    // Calculate major axis vector (from center to major axis endpoint)
    const majorAxis = {
        x: ellipse.majorAxisEndpoint.x - ellipse.center.x,
        y: ellipse.majorAxisEndpoint.y - ellipse.center.y,
    };

    // Calculate major axis length (this is the semi-major axis length)
    const majorAxisLength = Math.sqrt(
        majorAxis.x * majorAxis.x + majorAxis.y * majorAxis.y
    );

    // Calculate minor axis length (this is the semi-minor axis length)
    const minorAxisLength = majorAxisLength * ellipse.minorToMajorRatio;

    // Calculate unit vectors
    const majorAxisUnit = {
        x: majorAxis.x / majorAxisLength,
        y: majorAxis.y / majorAxisLength,
    };

    // Minor axis is perpendicular to major axis (counterclockwise rotation)
    // This is equivalent to the 2D cross product: z_axis × major_axis (right-hand rule)
    const minorAxisUnit = {
        x: -majorAxisUnit.y, // counterclockwise perpendicular
        y: majorAxisUnit.x,
    };

    // Calculate point using parametric ellipse equation from ezdxf
    const cosParam = Math.cos(parameter);
    const sinParam = Math.sin(parameter);

    const x: number =
        cosParam * majorAxisLength * majorAxisUnit.x +
        sinParam * minorAxisLength * minorAxisUnit.x;
    const y: number =
        cosParam * majorAxisLength * majorAxisUnit.y +
        sinParam * minorAxisLength * minorAxisUnit.y;

    // Translate to ellipse center
    return {
        x: ellipse.center.x + x,
        y: ellipse.center.y + y,
    };
}

describe('Ellipse Point Calculations', () => {
    it('should calculate correct points for a horizontal ellipse', () => {
        // Test ellipse: center at origin, major axis horizontal (length 4), minor axis vertical (length 2)
        const ellipse: Ellipse = {
            center: { x: 0, y: 0 },
            majorAxisEndpoint: { x: 2, y: 0 }, // Major radius = 2
            minorToMajorRatio: 0.5, // Minor radius = 1
        };

        // At parameter 0, should be at rightmost point (major axis endpoint)
        const point0 = getEllipsePointAtParameter(ellipse, 0);
        expect(point0.x).toBeCloseTo(2, 5); // Should be at major axis endpoint
        expect(point0.y).toBeCloseTo(0, 5);

        // At parameter π/2, should be at topmost point
        const pointPI2 = getEllipsePointAtParameter(ellipse, Math.PI / 2);
        expect(pointPI2.x).toBeCloseTo(0, 5); // Should be at center x
        expect(pointPI2.y).toBeCloseTo(1, 5); // Should be at minor radius

        // At parameter π, should be at leftmost point
        const pointPI = getEllipsePointAtParameter(ellipse, Math.PI);
        expect(pointPI.x).toBeCloseTo(-2, 5); // Should be at negative major radius
        expect(pointPI.y).toBeCloseTo(0, 5);

        // At parameter 3π/2, should be at bottommost point
        const point3PI2 = getEllipsePointAtParameter(
            ellipse,
            (3 * Math.PI) / 2
        );
        expect(point3PI2.x).toBeCloseTo(0, 5); // Should be at center x
        expect(point3PI2.y).toBeCloseTo(-1, 5); // Should be at negative minor radius
    });

    it('should calculate correct points for a vertical ellipse', () => {
        // Test ellipse: center at origin, major axis vertical (length 4), minor axis horizontal (length 2)
        const ellipse: Ellipse = {
            center: { x: 0, y: 0 },
            majorAxisEndpoint: { x: 0, y: 2 }, // Major radius = 2, vertical
            minorToMajorRatio: 0.5, // Minor radius = 1
        };

        // At parameter 0, should be at major axis endpoint (top)
        const point0 = getEllipsePointAtParameter(ellipse, 0);
        expect(point0.x).toBeCloseTo(0, 5);
        expect(point0.y).toBeCloseTo(2, 5); // Should be at major axis endpoint

        // At parameter π/2, should be along the minor axis
        // For a vertical major axis (0, 2), the minor axis should be perpendicular
        // Using counterclockwise rotation: (-2, 0) normalized to (-1, 0)
        // So at parameter π/2, we should be at (-1, 0)
        const pointPI2 = getEllipsePointAtParameter(ellipse, Math.PI / 2);
        expect(pointPI2.x).toBeCloseTo(-1, 5); // Should be at negative minor radius
        expect(pointPI2.y).toBeCloseTo(0, 5); // Should be at center y
    });

    it('should calculate correct points for an offset ellipse', () => {
        // Test ellipse: center at (5, 3), major axis horizontal
        const ellipse: Ellipse = {
            center: { x: 5, y: 3 },
            majorAxisEndpoint: { x: 8, y: 3 }, // Major radius = 3
            minorToMajorRatio: 2 / 3, // Minor radius = 2
        };

        // At parameter 0, should be at rightmost point
        const point0 = getEllipsePointAtParameter(ellipse, 0);
        expect(point0.x).toBeCloseTo(8, 5); // center.x + major radius
        expect(point0.y).toBeCloseTo(3, 5); // center.y

        // At parameter π/2, should be at topmost point
        const pointPI2 = getEllipsePointAtParameter(ellipse, Math.PI / 2);
        expect(pointPI2.x).toBeCloseTo(5, 5); // center.x
        expect(pointPI2.y).toBeCloseTo(5, 5); // center.y + minor radius
    });

    it('should handle rotated ellipse', () => {
        // Test ellipse: center at origin, major axis at 45 degrees
        const ellipse: Ellipse = {
            center: { x: 0, y: 0 },
            majorAxisEndpoint: { x: Math.sqrt(2), y: Math.sqrt(2) }, // 45 degree rotation, radius √2
            minorToMajorRatio: 0.5, // Minor radius = √2/2
        };

        // At parameter 0, should be at major axis endpoint
        const point0 = getEllipsePointAtParameter(ellipse, 0);
        expect(point0.x).toBeCloseTo(Math.sqrt(2), 5);
        expect(point0.y).toBeCloseTo(Math.sqrt(2), 5);
    });

    it('should handle ellipse arcs with start and end parameters', () => {
        const ellipse: Ellipse = {
            center: { x: 0, y: 0 },
            majorAxisEndpoint: { x: 2, y: 0 },
            minorToMajorRatio: 0.5,
            startParam: 0,
            endParam: Math.PI / 2,
        };

        // Start point should be at parameter 0
        const startPoint = getEllipsePointAtParameter(
            ellipse,
            ellipse.startParam!
        );
        expect(startPoint.x).toBeCloseTo(2, 5);
        expect(startPoint.y).toBeCloseTo(0, 5);

        // End point should be at parameter π/2
        const endPoint = getEllipsePointAtParameter(ellipse, ellipse.endParam!);
        expect(endPoint.x).toBeCloseTo(0, 5);
        expect(endPoint.y).toBeCloseTo(1, 5);
    });
});
