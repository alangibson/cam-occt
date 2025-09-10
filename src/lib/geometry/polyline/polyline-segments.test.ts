import { describe, it, expect } from 'vitest';
import {
    createPolylineFromVertices,
    polylineToPoints,
    polylineToVertices,
} from './functions';
import type { PolylineVertex, Polyline } from './interfaces';

describe('Polyline Segments Functionality', () => {
    it('should create segments for simple polyline without bulges', () => {
        const points = [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 10 },
        ];

        const shape = createPolylineFromVertices(points, false);
        const polyline = shape.geometry as Polyline;

        expect(polyline.shapes).toBeDefined();
        expect(polyline.shapes).toHaveLength(2);

        // All segments should be Line segments
        polyline.shapes!.forEach((shape) => {
            expect('start' in shape.geometry && 'end' in shape.geometry).toBe(
                true
            );
        });
    });

    it('should create segments with arcs for polyline with bulges', () => {
        const vertices: PolylineVertex[] = [
            { x: 0, y: 0, bulge: 0 }, // Line segment
            { x: 10, y: 0, bulge: 1.0 }, // 90-degree arc segment
            { x: 10, y: 10, bulge: 0 }, // Final point
        ];

        const shape = createPolylineFromVertices(vertices, false);
        const polyline = shape.geometry as Polyline;

        expect(polyline.shapes).toBeDefined();
        expect(polyline.shapes).toHaveLength(2);

        // First segment should be a line
        const firstSegment = polyline.shapes![0].geometry;
        expect('start' in firstSegment && 'end' in firstSegment).toBe(true);

        // Second segment should be an arc (due to bulge = 1.0)
        const secondSegment = polyline.shapes![1].geometry;
        expect('center' in secondSegment && 'radius' in secondSegment).toBe(
            true
        );
    });

    it('should roundtrip points correctly', () => {
        const originalPoints = [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 10 },
        ];

        const shape = createPolylineFromVertices(originalPoints, false);
        const polyline = shape.geometry as Polyline;

        const extractedPoints = polylineToPoints(polyline);

        expect(extractedPoints).toEqual(originalPoints);
    });

    it('should roundtrip vertices correctly', () => {
        const originalVertices: PolylineVertex[] = [
            { x: 0, y: 0, bulge: 0 },
            { x: 10, y: 0, bulge: 0.5 },
            { x: 10, y: 10, bulge: 0 },
        ];

        const shape = createPolylineFromVertices(originalVertices, false);
        const polyline = shape.geometry as Polyline;

        const extractedVertices = polylineToVertices(polyline);

        // Should have the same structure (though bulge values might have some precision differences)
        expect(extractedVertices).toHaveLength(originalVertices.length);
        extractedVertices.forEach((vertex, i) => {
            expect(vertex.x).toBeCloseTo(originalVertices[i].x, 5);
            expect(vertex.y).toBeCloseTo(originalVertices[i].y, 5);
        });
    });
});
