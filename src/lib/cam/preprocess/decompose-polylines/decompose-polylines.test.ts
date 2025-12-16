import { describe, expect, it } from 'vitest';
import type { ShapeData } from '$lib/cam/shape/interfaces';
import { createPolylineFromVertices } from '$lib/geometry/dxf-polyline/functions';
import type { Line } from '$lib/geometry/line/interfaces';
import { GeometryType } from '$lib/geometry/enums';
import { decomposePolylines } from './decompose-polylines';
import { Shape } from '$lib/cam/shape/classes';

describe('Decompose Polylines Algorithm', () => {
    describe('Basic Functionality', () => {
        it('should decompose a simple open polyline into line segments', () => {
            const polylineShape = createPolylineFromVertices(
                [
                    { x: 0, y: 0 },
                    { x: 10, y: 0 },
                    { x: 10, y: 10 },
                ],
                false,
                { id: 'poly1', layer: 'test' }
            );
            const shapes: ShapeData[] = [polylineShape];

            const result = decomposePolylines(shapes.map((s) => new Shape(s)));

            // Should create 2 line segments from 3 points
            expect(result).toHaveLength(2);
            expect(result[0].type).toBe('line');
            expect(result[1].type).toBe('line');

            // Check first line segment
            const line1 = result[0].geometry as Line;
            expect(line1.start).toEqual({ x: 0, y: 0 });
            expect(line1.end).toEqual({ x: 10, y: 0 });

            // Check second line segment
            const line2 = result[1].geometry as Line;
            expect(line2.start).toEqual({ x: 10, y: 0 });
            expect(line2.end).toEqual({ x: 10, y: 10 });
        });

        it('should decompose a closed polyline with closing segment', () => {
            const polylineShape = createPolylineFromVertices(
                [
                    { x: 0, y: 0 },
                    { x: 10, y: 0 },
                    { x: 10, y: 10 },
                    { x: 0, y: 10 },
                ],
                true,
                { id: 'poly1', layer: 'test' }
            );
            const shapes: ShapeData[] = [polylineShape];

            const result = decomposePolylines(shapes.map((s) => new Shape(s)));

            // Should create 4 line segments: 3 from consecutive points + 1 closing segment
            expect(result).toHaveLength(4);

            // Check closing segment (last point back to first)
            const closingLine = result[3].geometry as Line;
            expect(closingLine.start).toEqual({ x: 0, y: 10 });
            expect(closingLine.end).toEqual({ x: 0, y: 0 });
        });

        it('should preserve non-polyline shapes unchanged', () => {
            const shapes: ShapeData[] = [
                {
                    id: 'line1',
                    type: GeometryType.LINE,
                    geometry: {
                        start: { x: 0, y: 0 },
                        end: { x: 10, y: 10 },
                    },
                },
                {
                    id: 'circle1',
                    type: GeometryType.CIRCLE,
                    geometry: {
                        center: { x: 5, y: 5 },
                        radius: 3,
                    },
                },
            ];

            const result = decomposePolylines(shapes.map((s) => new Shape(s)));

            expect(result).toHaveLength(2);
            expect(result[0].toData()).toEqual(shapes[0]);
            expect(result[1].toData()).toEqual(shapes[1]);
        });

        it('should preserve layer information on decomposed segments', () => {
            const polylineShape = createPolylineFromVertices(
                [
                    { x: 0, y: 0 },
                    { x: 10, y: 0 },
                ],
                false,
                { id: 'poly1', layer: 'construction' }
            );
            const shapes: ShapeData[] = [polylineShape];

            const result = decomposePolylines(shapes.map((s) => new Shape(s)));

            expect(result).toHaveLength(1);
            expect(result[0].layer).toBe('construction');
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty shape array', () => {
            const result = decomposePolylines([]);
            expect(result).toHaveLength(0);
        });

        it('should handle polyline with only 2 points', () => {
            const polylineShape = createPolylineFromVertices(
                [
                    { x: 0, y: 0 },
                    { x: 10, y: 0 },
                ],
                false,
                { id: 'poly1' }
            );
            const shapes: ShapeData[] = [polylineShape];

            const result = decomposePolylines(shapes.map((s) => new Shape(s)));

            expect(result).toHaveLength(1);
            expect(result[0].type).toBe('line');
        });

        it('should handle polyline with single point', () => {
            const polylineShape = createPolylineFromVertices(
                [{ x: 0, y: 0 }],
                false,
                {
                    id: 'poly1',
                }
            );
            const shapes: ShapeData[] = [polylineShape];

            const result = decomposePolylines(shapes.map((s) => new Shape(s)));

            // Single point polyline produces no line segments
            expect(result).toHaveLength(0);
        });

        it('should create forward and backward segments for closed polyline with 2 points', () => {
            const polylineShape = createPolylineFromVertices(
                [
                    { x: 0, y: 0 },
                    { x: 10, y: 0 },
                ],
                true,
                { id: 'poly1' }
            );
            const shapes: ShapeData[] = [polylineShape];

            const result = decomposePolylines(shapes.map((s) => new Shape(s)));

            // Should create 2 segments: forward (0,0)→(10,0) and backward (10,0)→(0,0)
            expect(result).toHaveLength(2);

            const line1 = result[0].geometry as Line;
            const line2 = result[1].geometry as Line;

            expect(line1.start).toEqual({ x: 0, y: 0 });
            expect(line1.end).toEqual({ x: 10, y: 0 });
            expect(line2.start).toEqual({ x: 10, y: 0 });
            expect(line2.end).toEqual({ x: 0, y: 0 });
        });
    });

    describe('Mixed Shapes', () => {
        it('should process mixed shape types correctly', () => {
            const polylineShape = createPolylineFromVertices(
                [
                    { x: 10, y: 10 },
                    { x: 20, y: 10 },
                    { x: 20, y: 20 },
                ],
                false,
                { id: 'poly1' }
            );

            const shapes: ShapeData[] = [
                {
                    id: 'line1',
                    type: GeometryType.LINE,
                    geometry: { start: { x: 0, y: 0 }, end: { x: 5, y: 5 } },
                },
                polylineShape,
                {
                    id: 'circle1',
                    type: GeometryType.CIRCLE,
                    geometry: { center: { x: 30, y: 30 }, radius: 5 },
                },
            ];

            const result = decomposePolylines(shapes.map((s) => new Shape(s)));

            // Should have: 1 original line + 2 decomposed lines + 1 original circle = 4 shapes
            expect(result).toHaveLength(4);

            // First should be original line
            expect(result[0].id).toBe('line1');
            expect(result[0].type).toBe('line');

            // Middle two should be decomposed polyline segments
            expect(result[1].type).toBe('line');
            expect(result[2].type).toBe('line');

            // Last should be original circle
            expect(result[3].id).toBe('circle1');
            expect(result[3].type).toBe('circle');
        });
    });

    describe('ID Generation', () => {
        it('should generate unique IDs for decomposed segments', () => {
            const polylineShape = createPolylineFromVertices(
                [
                    { x: 0, y: 0 },
                    { x: 10, y: 0 },
                    { x: 10, y: 10 },
                ],
                false,
                { id: 'poly1' }
            );
            const shapes: ShapeData[] = [polylineShape];

            const result = decomposePolylines(shapes.map((s) => new Shape(s)));

            expect(result).toHaveLength(2);
            expect(result[0].id).toBeDefined();
            expect(result[1].id).toBeDefined();
            expect(result[0].id).not.toBe(result[1].id);
            expect(result[0].id).not.toBe('poly1');
            expect(result[1].id).not.toBe('poly1');
        });
    });

    describe('Arc Type Preservation', () => {
        it('should preserve arc types when decomposing polylines with bulges', () => {
            // Create a polyline with alternating line and arc segments
            // Bulge of 0.5 creates an arc
            const polylineShape = createPolylineFromVertices(
                [
                    { x: 0, y: 0, bulge: 0 }, // Line to next point
                    { x: 10, y: 0, bulge: 0.5 }, // Arc to next point
                    { x: 20, y: 0, bulge: 0 }, // Line to next point
                    { x: 30, y: 0, bulge: -0.3 }, // Arc to next point
                    { x: 40, y: 0, bulge: 0 }, // Line (end of open polyline)
                ],
                false,
                { id: 'poly1', layer: 'test' }
            );

            const shapes: ShapeData[] = [polylineShape];
            const result = decomposePolylines(shapes.map((s) => new Shape(s)));

            // Should have 4 segments: line, arc, line, arc
            expect(result).toHaveLength(4);

            // Verify each segment has the correct type
            expect(result[0].type).toBe(GeometryType.LINE);
            expect(result[1].type).toBe(GeometryType.ARC);
            expect(result[2].type).toBe(GeometryType.LINE);
            expect(result[3].type).toBe(GeometryType.ARC);

            // Verify arc geometries have correct properties
            const arc1 = result[1].geometry;
            expect('center' in arc1).toBe(true);
            expect('radius' in arc1).toBe(true);
            expect('startAngle' in arc1).toBe(true);
            expect('endAngle' in arc1).toBe(true);

            const arc2 = result[3].geometry;
            expect('center' in arc2).toBe(true);
            expect('radius' in arc2).toBe(true);
            expect('startAngle' in arc2).toBe(true);
            expect('endAngle' in arc2).toBe(true);

            // Verify line geometries have correct properties
            const line1 = result[0].geometry;
            expect('start' in line1).toBe(true);
            expect('end' in line1).toBe(true);

            const line3 = result[2].geometry;
            expect('start' in line3).toBe(true);
            expect('end' in line3).toBe(true);
        });
    });
});
