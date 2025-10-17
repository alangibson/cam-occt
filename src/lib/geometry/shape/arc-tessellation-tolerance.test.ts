/**
 * Tests for adaptive arc tessellation with chord error tolerance
 */

import { describe, it, expect } from 'vitest';
import { tessellateShape } from './functions';
import type { Shape } from './interfaces';
import { GeometryType } from './enums';
import type { Arc } from '$lib/geometry/arc';
import type { Point2D } from '$lib/geometry/point';
import type { PartDetectionParameters } from '$lib/types/part-detection';

/**
 * Calculate the maximum chord error (sagitta) for a tessellated arc
 * This is the maximum perpendicular distance from any chord to the true arc
 */
function calculateMaxChordError(
    arc: Arc,
    tessellatedPoints: Point2D[]
): number {
    if (tessellatedPoints.length < 2) {
        return 0;
    }

    let maxError = 0;

    // Check each chord segment
    for (let i = 0; i < tessellatedPoints.length - 1; i++) {
        const p1 = tessellatedPoints[i];
        const p2 = tessellatedPoints[i + 1];

        // Calculate the midpoint of the chord
        const chordMidX = (p1.x + p2.x) / 2;
        const chordMidY = (p1.y + p2.y) / 2;

        // Distance from center to chord midpoint
        const distToChordMid = Math.sqrt(
            (chordMidX - arc.center.x) ** 2 + (chordMidY - arc.center.y) ** 2
        );

        // The sagitta (chord error) is the difference between radius and distance to chord midpoint
        const sagitta = arc.radius - distToChordMid;

        maxError = Math.max(maxError, sagitta);
    }

    return maxError;
}

describe('Adaptive Arc Tessellation with Tolerance', () => {
    it('should respect 0.1mm tolerance for a 50mm radius arc', () => {
        const arc: Arc = {
            center: { x: 0, y: 0 },
            radius: 50,
            startAngle: 0,
            endAngle: Math.PI / 2, // 90 degree arc
            clockwise: false,
        };

        const shape: Shape = {
            id: 'test-arc',
            type: GeometryType.ARC,
            geometry: arc,
            layer: 'test',
        };

        const params: PartDetectionParameters = {
            circleTessellationPoints: 64,
            arcTessellationTolerance: 0.1,
            decimalPrecision: 3,
            enableTessellation: false,
        };

        const points = tessellateShape(shape, params);
        const maxError = calculateMaxChordError(arc, points);

        // The maximum error should not exceed the tolerance
        expect(maxError).toBeLessThanOrEqual(0.1);
        // But it should be reasonably close (within 2x tolerance due to discrete segments)
        expect(maxError).toBeGreaterThan(0.05);
    });

    it('should respect 0.01mm tolerance for a 100mm radius arc', () => {
        const arc: Arc = {
            center: { x: 100, y: 100 },
            radius: 100,
            startAngle: 0,
            endAngle: Math.PI, // 180 degree arc
            clockwise: false,
        };

        const shape: Shape = {
            id: 'test-arc',
            type: GeometryType.ARC,
            geometry: arc,
            layer: 'test',
        };

        const params: PartDetectionParameters = {
            circleTessellationPoints: 64,
            arcTessellationTolerance: 0.01,
            decimalPrecision: 3,
            enableTessellation: false,
        };

        const points = tessellateShape(shape, params);
        const maxError = calculateMaxChordError(arc, points);

        expect(maxError).toBeLessThanOrEqual(0.01);
        expect(maxError).toBeGreaterThan(0.005);
    });

    it('should use fewer points for larger tolerance', () => {
        const arc: Arc = {
            center: { x: 0, y: 0 },
            radius: 50,
            startAngle: 0,
            endAngle: Math.PI, // 180 degree arc
            clockwise: false,
        };

        const shape: Shape = {
            id: 'test-arc',
            type: GeometryType.ARC,
            geometry: arc,
            layer: 'test',
        };

        const paramsCoarse: PartDetectionParameters = {
            circleTessellationPoints: 64,
            arcTessellationTolerance: 1.0,
            decimalPrecision: 3,
            enableTessellation: false,
        };

        const paramsFine: PartDetectionParameters = {
            circleTessellationPoints: 64,
            arcTessellationTolerance: 0.01,
            decimalPrecision: 3,
            enableTessellation: false,
        };

        const pointsCoarse = tessellateShape(shape, paramsCoarse);
        const pointsFine = tessellateShape(shape, paramsFine);

        // Finer tolerance should produce more points
        expect(pointsFine.length).toBeGreaterThan(pointsCoarse.length);
    });

    it('should handle small radius arcs appropriately', () => {
        const arc: Arc = {
            center: { x: 0, y: 0 },
            radius: 5, // Small 5mm radius
            startAngle: 0,
            endAngle: 2 * Math.PI, // Full circle
            clockwise: false,
        };

        const shape: Shape = {
            id: 'test-arc',
            type: GeometryType.ARC,
            geometry: arc,
            layer: 'test',
        };

        const params: PartDetectionParameters = {
            circleTessellationPoints: 64,
            arcTessellationTolerance: 0.1,
            decimalPrecision: 3,
            enableTessellation: false,
        };

        const points = tessellateShape(shape, params);
        const maxError = calculateMaxChordError(arc, points);

        // Should still respect tolerance
        expect(maxError).toBeLessThanOrEqual(0.1);
        // Should use fewer points than a larger arc
        expect(points.length).toBeLessThan(50);
    });

    it('should handle large radius arcs appropriately', () => {
        const arc: Arc = {
            center: { x: 0, y: 0 },
            radius: 500, // Large 500mm radius
            startAngle: 0,
            endAngle: Math.PI / 2, // 90 degrees
            clockwise: false,
        };

        const shape: Shape = {
            id: 'test-arc',
            type: GeometryType.ARC,
            geometry: arc,
            layer: 'test',
        };

        const params: PartDetectionParameters = {
            circleTessellationPoints: 64,
            arcTessellationTolerance: 0.1,
            decimalPrecision: 3,
            enableTessellation: false,
        };

        const points = tessellateShape(shape, params);
        const maxError = calculateMaxChordError(arc, points);

        // Should still respect tolerance
        expect(maxError).toBeLessThanOrEqual(0.1);
        // Large radius should require more points for same tolerance
        expect(points.length).toBeGreaterThan(20);
    });

    it('should handle clockwise arcs correctly', () => {
        const arc: Arc = {
            center: { x: 0, y: 0 },
            radius: 50,
            startAngle: 0,
            endAngle: Math.PI / 2,
            clockwise: true, // Clockwise arc
        };

        const shape: Shape = {
            id: 'test-arc',
            type: GeometryType.ARC,
            geometry: arc,
            layer: 'test',
        };

        const params: PartDetectionParameters = {
            circleTessellationPoints: 64,
            arcTessellationTolerance: 0.1,
            decimalPrecision: 3,
            enableTessellation: false,
        };

        const points = tessellateShape(shape, params);
        const maxError = calculateMaxChordError(arc, points);

        // Should respect tolerance regardless of direction
        expect(maxError).toBeLessThanOrEqual(0.1);
    });

    it('should produce start and end points on the arc', () => {
        const arc: Arc = {
            center: { x: 100, y: 100 },
            radius: 50,
            startAngle: Math.PI / 4,
            endAngle: (3 * Math.PI) / 4,
            clockwise: false,
        };

        const shape: Shape = {
            id: 'test-arc',
            type: GeometryType.ARC,
            geometry: arc,
            layer: 'test',
        };

        const params: PartDetectionParameters = {
            circleTessellationPoints: 64,
            arcTessellationTolerance: 0.1,
            decimalPrecision: 3,
            enableTessellation: false,
        };

        const points = tessellateShape(shape, params);

        // First point should be at start angle
        const startPoint = points[0];
        const expectedStartX =
            arc.center.x + arc.radius * Math.cos(arc.startAngle);
        const expectedStartY =
            arc.center.y + arc.radius * Math.sin(arc.startAngle);
        expect(startPoint.x).toBeCloseTo(expectedStartX, 5);
        expect(startPoint.y).toBeCloseTo(expectedStartY, 5);

        // Last point should be at end angle
        const endPoint = points[points.length - 1];
        const expectedEndX = arc.center.x + arc.radius * Math.cos(arc.endAngle);
        const expectedEndY = arc.center.y + arc.radius * Math.sin(arc.endAngle);
        expect(endPoint.x).toBeCloseTo(expectedEndX, 5);
        expect(endPoint.y).toBeCloseTo(expectedEndY, 5);
    });

    it('should clamp to maximum 1000 segments for extreme cases', () => {
        const arc: Arc = {
            center: { x: 0, y: 0 },
            radius: 10000, // Very large radius
            startAngle: 0,
            endAngle: 2 * Math.PI, // Full circle
            clockwise: false,
        };

        const shape: Shape = {
            id: 'test-arc',
            type: GeometryType.ARC,
            geometry: arc,
            layer: 'test',
        };

        const params: PartDetectionParameters = {
            circleTessellationPoints: 64,
            arcTessellationTolerance: 0.001, // Very tight tolerance
            decimalPrecision: 3,
            enableTessellation: false,
        };

        const points = tessellateShape(shape, params);

        // Should be clamped to maximum
        expect(points.length).toBeLessThanOrEqual(1001); // 1000 segments = 1001 points
    });
});
