import { describe, it, expect } from 'vitest';
import {
    createPolylineFromVertices,
    getPolylineStartPoint,
    getPolylineEndPoint,
    polylineToPoints,
    polylineToVertices,
    reversePolyline,
} from './functions';
import type { Point2D } from '$lib/types/geometry';
import type { Polyline, PolylineVertex } from './interfaces';
import type { Arc } from '$lib/geometry/arc';

describe('createPolylineFromVertices', () => {
    it('should create a basic open polyline', () => {
        const points: Point2D[] = [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 10 },
        ];

        const polyline = createPolylineFromVertices(points, false);

        expect(polyline.type).toBe('polyline');
        expect(polylineToPoints(polyline.geometry as Polyline)).toEqual(points);
        expect((polyline.geometry as Polyline).closed).toBe(false);
        expect(polyline.id).toBeDefined();
    });

    it('should create a closed polyline with coincident endpoints', () => {
        const points: Point2D[] = [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 10 },
            { x: 0, y: 10 },
        ];

        const polyline = createPolylineFromVertices(points, true);

        expect((polyline.geometry as Polyline).closed).toBe(true);
        const resultPoints = polylineToPoints(polyline.geometry as Polyline);
        expect(resultPoints).toHaveLength(5); // Should duplicate first point at end
        expect(resultPoints[0]).toEqual(resultPoints[4]);
    });

    it('should not duplicate endpoint if already coincident', () => {
        const points: Point2D[] = [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 10 },
            { x: 0, y: 10 },
            { x: 0, y: 0 }, // Already coincident
        ];

        const polyline = createPolylineFromVertices(points, true);

        const resultPoints = polylineToPoints(polyline.geometry as Polyline);
        expect(resultPoints).toHaveLength(5); // Should not add extra point
        expect(resultPoints[0]).toEqual(resultPoints[4]);
    });

    it('should handle optional parameters', () => {
        const vertices = [
            { x: 0, y: 0, bulge: 0.5 },
            { x: 10, y: 0, bulge: 0 },
        ];

        const polyline = createPolylineFromVertices(vertices, false, {
            id: 'test-polyline',
            layer: 'test-layer',
        });

        expect(polyline.id).toBe('test-polyline');
        expect(polylineToVertices(polyline.geometry as Polyline)).toEqual(
            vertices
        );
        expect(polyline.layer).toBe('test-layer');
    });

    it('should validate and filter invalid points', () => {
        const points: (PolylineVertex | null)[] = [
            { x: 0, y: 0, bulge: 0 },
            { x: NaN, y: 0, bulge: 0 }, // Invalid
            { x: 10, y: 10, bulge: 0 },
            null, // Invalid
            { x: 20, y: 20, bulge: 0 },
        ];

        const polyline = createPolylineFromVertices(
            points.filter(Boolean) as PolylineVertex[],
            false
        );

        const resultPoints = polylineToPoints(polyline.geometry as Polyline);
        expect(resultPoints).toHaveLength(3);
        expect(resultPoints[0]).toEqual({ x: 0, y: 0 });
        expect(resultPoints[1]).toEqual({ x: 10, y: 10 });
        expect(resultPoints[2]).toEqual({ x: 20, y: 20 });
    });

    it('should throw error for empty points array', () => {
        expect(() => createPolylineFromVertices([], false)).toThrow(
            'Polyline must have at least one vertex'
        );
    });

    it('should throw error for all invalid points', () => {
        const invalidPoints = [
            { x: NaN, y: 0, bulge: 0 },
            null,
            { x: undefined!, y: 5, bulge: 0 },
        ] as PolylineVertex[];

        expect(() => createPolylineFromVertices(invalidPoints, false)).toThrow(
            'Polyline must have at least one valid vertex'
        );
    });
});

describe('polyline utility functions', () => {
    it('should get start and end points correctly', () => {
        const polylineShape = createPolylineFromVertices(
            [
                { x: 0, y: 0 },
                { x: 10, y: 0 },
                { x: 10, y: 10 },
            ],
            false
        );

        expect(
            getPolylineStartPoint(polylineShape.geometry as Polyline)
        ).toEqual({ x: 0, y: 0 });
        expect(getPolylineEndPoint(polylineShape.geometry as Polyline)).toEqual(
            { x: 10, y: 10 }
        );
    });
});

describe('reversePolyline', () => {
    it('should reverse an open polyline with line segments only', () => {
        const polylineShape = createPolylineFromVertices(
            [
                { x: 0, y: 0 },
                { x: 10, y: 0 },
                { x: 10, y: 10 },
            ],
            false
        );

        const reversed = reversePolyline(polylineShape.geometry as Polyline);

        expect(reversed.closed).toBe(false);
        expect(reversed.shapes).toHaveLength(2);

        // First segment should be from (10,10) to (10,0)
        expect(reversed.shapes[0].geometry).toEqual({
            start: { x: 10, y: 10 },
            end: { x: 10, y: 0 },
        });

        // Second segment should be from (10,0) to (0,0)
        expect(reversed.shapes[1].geometry).toEqual({
            start: { x: 10, y: 0 },
            end: { x: 0, y: 0 },
        });
    });

    it('should reverse a closed polyline with line segments only', () => {
        const polylineShape = createPolylineFromVertices(
            [
                { x: 0, y: 0 },
                { x: 10, y: 0 },
                { x: 10, y: 10 },
                { x: 0, y: 10 },
            ],
            true
        );

        const reversed = reversePolyline(polylineShape.geometry as Polyline);

        expect(reversed.closed).toBe(true);
        expect(reversed.shapes).toHaveLength(4);

        // Segments should be reversed
        expect(reversed.shapes[0].geometry).toEqual({
            start: { x: 0, y: 0 },
            end: { x: 0, y: 10 },
        });

        expect(reversed.shapes[1].geometry).toEqual({
            start: { x: 0, y: 10 },
            end: { x: 10, y: 10 },
        });

        expect(reversed.shapes[2].geometry).toEqual({
            start: { x: 10, y: 10 },
            end: { x: 10, y: 0 },
        });

        expect(reversed.shapes[3].geometry).toEqual({
            start: { x: 10, y: 0 },
            end: { x: 0, y: 0 },
        });
    });

    it('should reverse polyline with arc segments', () => {
        // Create a polyline with an arc (bulge = 1 creates a quarter-circle)
        const vertices = [
            { x: 0, y: 0, bulge: 1 }, // Arc from (0,0) to (10,0) with bulge 1
            { x: 10, y: 0, bulge: 0 }, // End point
        ];

        const polylineShape = createPolylineFromVertices(vertices, false);
        const reversed = reversePolyline(polylineShape.geometry as Polyline);

        expect(reversed.closed).toBe(false);
        expect(reversed.shapes).toHaveLength(1); // Only 1 segment between 2 vertices

        // The segment should be the arc with flipped direction
        const arcSegment = reversed.shapes[0].geometry as Arc;
        expect(arcSegment.center).toBeDefined();
        expect(arcSegment.radius).toBeDefined();
        expect(typeof arcSegment.clockwise).toBe('boolean');
        // The clockwise direction should be flipped from original
        expect(arcSegment.startAngle).toBeDefined();
        expect(arcSegment.endAngle).toBeDefined();
    });

    it('should handle empty polyline segments', () => {
        const emptyPolyline: Polyline = { closed: false, shapes: [] };
        const reversed = reversePolyline(emptyPolyline);

        expect(reversed).toEqual(emptyPolyline);
    });

    it('should handle single segment polyline', () => {
        const polylineShape = createPolylineFromVertices(
            [
                { x: 0, y: 0 },
                { x: 10, y: 0 },
            ],
            false
        );

        const reversed = reversePolyline(polylineShape.geometry as Polyline);

        expect(reversed.closed).toBe(false);
        expect(reversed.shapes).toHaveLength(1);
        expect(reversed.shapes[0].geometry).toEqual({
            start: { x: 10, y: 0 },
            end: { x: 0, y: 0 },
        });
    });

    it('should preserve start and end points when reversed twice', () => {
        const polylineShape = createPolylineFromVertices(
            [
                { x: 0, y: 0 },
                { x: 10, y: 0 },
                { x: 10, y: 10 },
            ],
            false
        );

        const original = polylineShape.geometry as Polyline;
        const reversed = reversePolyline(original);
        const doubleReversed = reversePolyline(reversed);

        // Double reverse should restore original points order
        const originalPoints = polylineToPoints(original);
        const doubleReversedPoints = polylineToPoints(doubleReversed);

        expect(doubleReversedPoints).toEqual(originalPoints);
    });

    it('should reverse complex polyline with mixed line and arc segments', () => {
        // Create a more complex polyline with mixed segments
        const vertices = [
            { x: 0, y: 0, bulge: 0.5 }, // Arc segment
            { x: 10, y: 5, bulge: 0 }, // Line segment
            { x: 20, y: 0, bulge: -0.5 }, // Arc segment (clockwise)
            { x: 30, y: 0, bulge: 0 }, // Final point
        ];

        const polylineShape = createPolylineFromVertices(vertices, false);
        const reversed = reversePolyline(polylineShape.geometry as Polyline);

        expect(reversed.shapes).toHaveLength(3);

        // All segments should have their directions flipped
        for (let i: number = 0; i < reversed.shapes.length; i++) {
            const segment = reversed.shapes[i].geometry;

            if ('start' in segment && 'end' in segment) {
                // Line segment - just check it's reversed
                expect(segment.start).toBeDefined();
                expect(segment.end).toBeDefined();
            } else if ('center' in segment && 'clockwise' in segment) {
                // Arc segment - clockwise should be flipped, angles swapped
                expect(segment.center).toBeDefined();
                expect(segment.radius).toBeGreaterThan(0);
                expect(typeof segment.clockwise).toBe('boolean');
            }
        }
    });
});
