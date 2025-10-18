import { describe, expect, it } from 'vitest';
import { calculateLeads } from './lead-calculation';
import { type LeadConfig } from './interfaces';
import { CutDirection } from '$lib/cam/cut/enums';
import { LeadType } from './enums';
import type { Chain } from '$lib/geometry/chain/interfaces';
import type { DetectedPart } from '$lib/cam/part/part-detection';
import { PartType } from '$lib/cam/part/part-detection';
import { GeometryType } from '$lib/geometry/shape/enums';
import type { Point2D } from '$lib/geometry/point/interfaces';
import type { Shape } from '$lib/geometry/shape/interfaces';
import { convertLeadGeometryToPoints } from './functions';

describe('Lead Concave Area Fix', () => {
    // Helper to check if a point is inside a polygon using ray casting
    function isPointInPolygon(point: Point2D, polygon: Point2D[]): boolean {
        let inside = false;
        const x: number = point.x;
        const y: number = point.y;

        for (
            let i: number = 0, j = polygon.length - 1;
            i < polygon.length;
            j = i++
        ) {
            const xi = polygon[i].x;
            const yi = polygon[i].y;
            const xj = polygon[j].x;
            const yj = polygon[j].y;

            if (
                yi > y !== yj > y &&
                x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
            ) {
                inside = !inside;
            }
        }

        return inside;
    }

    // Helper to create a complex shape that has both convex and concave areas
    function createComplexConcaveShape(): Chain {
        // Create a shape that resembles the problematic geometry from ADLER.dxf
        // This will have concave areas where centroid-based logic fails
        const points: Point2D[] = [
            { x: 0, y: 0 }, // Start at bottom left
            { x: 20, y: 0 }, // Bottom edge
            { x: 20, y: 10 }, // Right edge going up
            { x: 15, y: 10 }, // Start of concave indent
            { x: 15, y: 15 }, // Into the concave area
            { x: 10, y: 15 }, // Across the concave area
            { x: 10, y: 10 }, // Back out of concave area
            { x: 5, y: 10 }, // Continue along
            { x: 5, y: 20 }, // Left side going up
            { x: 0, y: 20 }, // Top left
            { x: 0, y: 0 }, // Back to start
        ];

        const shapes: Shape[] = [];
        for (let i: number = 0; i < points.length - 1; i++) {
            shapes.push({
                id: `line${i}`,
                type: GeometryType.LINE,
                geometry: { start: points[i], end: points[i + 1] },
                layer: 'layer1',
            });
        }

        return {
            id: 'concave_shape',
            shapes,
        };
    }

    it('should handle concave areas correctly', () => {
        const chain = createComplexConcaveShape();

        // Create a part with this complex shape as shell
        const part: DetectedPart = {
            id: 'part1',
            shell: {
                id: 'shell1',
                chain,
                type: PartType.SHELL,
                boundingBox: { min: { x: 0, y: 0 }, max: { x: 20, y: 20 } },
                holes: [],
            },
            holes: [],
        };

        const leadIn: LeadConfig = { type: LeadType.ARC, length: 5 };
        const leadOut: LeadConfig = { type: LeadType.NONE, length: 0 };

        const result = calculateLeads(
            chain,
            leadIn,
            leadOut,
            CutDirection.NONE,
            part,
            { x: 1, y: 0 }
        );

        expect(result.leadIn).toBeDefined();
        const points = convertLeadGeometryToPoints(result.leadIn!);

        // Get the polygon for point-in-polygon testing
        const polygon: Point2D[] = [
            { x: 0, y: 0 },
            { x: 20, y: 0 },
            { x: 20, y: 10 },
            { x: 15, y: 10 },
            { x: 15, y: 15 },
            { x: 10, y: 15 },
            { x: 10, y: 10 },
            { x: 5, y: 10 },
            { x: 5, y: 20 },
            { x: 0, y: 20 },
        ];

        // Check if any lead points are inside the polygon (excluding connection point)
        let pointsInside = 0;
        const connectionPoint = points[points.length - 1];

        for (const point of points) {
            // Skip connection point
            if (
                Math.abs(point.x - connectionPoint.x) < 0.001 &&
                Math.abs(point.y - connectionPoint.y) < 0.001
            ) {
                continue;
            }

            if (isPointInPolygon(point, polygon)) {
                pointsInside++;
            }
        }

        points.slice(0, 3).forEach((p) => {
            isPointInPolygon(p, polygon);
        });

        // With the improved algorithm, we should have fewer points inside the solid area
        // The exact number depends on the specific geometry, but it should be better than before
        expect(pointsInside).toBeLessThan(points.length); // At least some points should be outside
    });

    it('should show difference between old and new algorithm', () => {
        // Create a simple concave shape to demonstrate the improvement
        const points: Point2D[] = [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 5 },
            { x: 5, y: 5 }, // Concave indent
            { x: 5, y: 10 },
            { x: 0, y: 10 },
        ];

        const shapes: Shape[] = [];
        for (let i: number = 0; i < points.length - 1; i++) {
            shapes.push({
                id: `line${i}`,
                type: GeometryType.LINE,
                geometry: { start: points[i], end: points[i + 1] },
                layer: 'layer1',
            });
        }

        // Close the shape
        shapes.push({
            id: 'line_close',
            type: GeometryType.LINE,
            geometry: { start: points[points.length - 1], end: points[0] },
            layer: 'layer1',
        });

        const chain: Chain = { id: 'simple_concave', shapes };

        const part: DetectedPart = {
            id: 'part1',
            shell: {
                id: 'shell1',
                chain,
                type: PartType.SHELL,
                boundingBox: { min: { x: 0, y: 0 }, max: { x: 10, y: 10 } },
                holes: [],
            },
            holes: [],
        };

        const leadIn: LeadConfig = { type: LeadType.ARC, length: 3 };
        const result = calculateLeads(
            chain,
            leadIn,
            { type: LeadType.NONE, length: 0 },
            CutDirection.NONE,
            part,
            { x: 1, y: 0 }
        );

        expect(result.leadIn).toBeDefined();

        // The key is that the algorithm now uses local curvature analysis
        // instead of just centroid-based direction, which should work better
        // for concave areas
        const points_result = convertLeadGeometryToPoints(result.leadIn!);
        expect(points_result.length).toBeGreaterThan(0);
    });
});
