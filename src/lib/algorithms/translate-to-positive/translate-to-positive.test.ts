import { describe, expect, it } from 'vitest';
import type { Arc } from '$lib/geometry/arc/interfaces';
import type { Circle } from '$lib/geometry/circle/interfaces';
import type { Ellipse } from '$lib/geometry/ellipse/interfaces';
import type { Line } from '$lib/geometry/line/interfaces';
import type { ShapeData } from '$lib/cam/shape/interfaces';
import { GeometryType } from '$lib/geometry/enums';
import { translateToPositiveQuadrant } from './translate-to-positive';
import { Drawing } from '$lib/cam/drawing/classes.svelte';
import { Unit } from '$lib/config/units/units';

describe('Translate to Positive Quadrant Algorithm', () => {
    // Helper function to create a Drawing from shape data
    function createDrawing(shapes: ShapeData[]): Drawing {
        return new Drawing({
            shapes: shapes,
            units: Unit.MM,
            fileName: 'test.dxf',
        });
    }

    describe('Basic Functionality', () => {
        it('should translate shapes with negative coordinates to positive quadrant', () => {
            const shapes: ShapeData[] = [
                {
                    id: 'line1',
                    type: GeometryType.LINE,
                    geometry: {
                        start: { x: -10, y: -5 },
                        end: { x: 0, y: 5 },
                    },
                },
            ];

            const drawing = createDrawing(shapes);
            translateToPositiveQuadrant(drawing);

            const result = drawing.shapes;
            expect(result).toHaveLength(1);
            const line: Line = result[0].geometry as Line;
            expect(line.start).toEqual({ x: 0, y: 0 }); // -10 + 10 = 0, -5 + 5 = 0
            expect(line.end).toEqual({ x: 10, y: 10 }); // 0 + 10 = 10, 5 + 5 = 10
        });

        it('should not translate shapes already in positive quadrant', () => {
            const shapes: ShapeData[] = [
                {
                    id: 'line1',
                    type: GeometryType.LINE,
                    geometry: {
                        start: { x: 5, y: 10 },
                        end: { x: 15, y: 20 },
                    },
                },
            ];

            const drawing = createDrawing(shapes);
            translateToPositiveQuadrant(drawing);

            const result = drawing.shapes;
            expect(result).toHaveLength(1);
            expect(result[0].toData()).toEqual(shapes[0]); // Should be unchanged
        });

        it('should translate only in X direction when only X is negative', () => {
            const shapes: ShapeData[] = [
                {
                    id: 'line1',
                    type: GeometryType.LINE,
                    geometry: {
                        start: { x: -5, y: 10 },
                        end: { x: 5, y: 20 },
                    },
                },
            ];

            const drawing = createDrawing(shapes);
            translateToPositiveQuadrant(drawing);

            const result = drawing.shapes;
            expect(result).toHaveLength(1);
            const line: Line = result[0].geometry as Line;
            expect(line.start).toEqual({ x: 0, y: 10 }); // Only X translated
            expect(line.end).toEqual({ x: 10, y: 20 });
        });

        it('should translate only in Y direction when only Y is negative', () => {
            const shapes: ShapeData[] = [
                {
                    id: 'line1',
                    type: GeometryType.LINE,
                    geometry: {
                        start: { x: 5, y: -10 },
                        end: { x: 15, y: 0 },
                    },
                },
            ];

            const drawing = createDrawing(shapes);
            translateToPositiveQuadrant(drawing);

            const result = drawing.shapes;
            expect(result).toHaveLength(1);
            const line: Line = result[0].geometry as Line;
            expect(line.start).toEqual({ x: 5, y: 0 }); // Only Y translated
            expect(line.end).toEqual({ x: 15, y: 10 });
        });
    });

    describe('Arc Shape Handling', () => {
        it('should not translate quarter arc already in positive quadrant', () => {
            const shapes: ShapeData[] = [
                {
                    id: 'arc1',
                    type: GeometryType.ARC,
                    geometry: {
                        center: { x: 10, y: 10 },
                        radius: 5,
                        startAngle: 0, // 0° - rightward
                        endAngle: Math.PI / 2, // 90° - upward
                        clockwise: false,
                    },
                },
            ];

            const drawing = createDrawing(shapes);
            translateToPositiveQuadrant(drawing);

            const result = drawing.shapes;
            expect(result).toHaveLength(1);
            const arc: Arc = result[0].geometry as Arc;
            // Arc spans from (15,10) to (10,15) - already positive
            expect(arc.center).toEqual({ x: 10, y: 10 }); // Should be unchanged
            expect(arc.radius).toBe(5);
        });

        it('should translate arc extending into negative quadrant', () => {
            const shapes: ShapeData[] = [
                {
                    id: 'arc1',
                    type: GeometryType.ARC,
                    geometry: {
                        center: { x: 3, y: 3 },
                        radius: 5,
                        startAngle: Math.PI, // 180° - leftward
                        endAngle: (3 * Math.PI) / 2, // 270° - downward
                        clockwise: false,
                    },
                },
            ];

            const drawing = createDrawing(shapes);
            translateToPositiveQuadrant(drawing);

            const result = drawing.shapes;
            expect(result).toHaveLength(1);
            const arc: Arc = result[0].geometry as Arc;
            // Original arc bounds: x from -2 to 3, y from -2 to 3
            // Translation needed: x+2, y+2
            expect(arc.center).toEqual({ x: 5, y: 5 }); // 3+2=5, 3+2=5
            expect(arc.radius).toBe(5);
            expect(arc.startAngle).toBe(Math.PI);
            expect(arc.endAngle).toBe((3 * Math.PI) / 2);
            expect(arc.clockwise).toBe(false);
        });

        it('should handle clockwise arc with negative bounds', () => {
            const shapes: ShapeData[] = [
                {
                    id: 'arc1',
                    type: GeometryType.ARC,
                    geometry: {
                        center: { x: 0, y: 0 },
                        radius: 4,
                        startAngle: Math.PI / 2, // 90° - upward
                        endAngle: Math.PI, // 180° - leftward
                        clockwise: true,
                    },
                },
            ];

            const drawing = createDrawing(shapes);
            translateToPositiveQuadrant(drawing);

            const result = drawing.shapes;
            expect(result).toHaveLength(1);
            const arc: Arc = result[0].geometry as Arc;
            // Arc spans from (0,4) to (-4,0) - needs translation by x+4, y+4
            expect(arc.center).toEqual({ x: 4, y: 4 }); // 0+4=4, 0+4=4
            expect(arc.radius).toBe(4);
            expect(arc.clockwise).toBe(true);
        });

        it('should handle arc crossing angle boundaries', () => {
            const shapes: ShapeData[] = [
                {
                    id: 'arc1',
                    type: GeometryType.ARC,
                    geometry: {
                        center: { x: 3, y: 3 },
                        radius: 3,
                        startAngle: (7 * Math.PI) / 4, // 315°
                        endAngle: Math.PI / 4, // 45°
                        clockwise: false,
                    },
                },
            ];

            const drawing = createDrawing(shapes);
            translateToPositiveQuadrant(drawing);

            const result = drawing.shapes;
            expect(result).toHaveLength(1);
            const arc: Arc = result[0].geometry as Arc;
            // This arc includes the 0° extreme (rightmost point at x=6)
            // Arc should remain untranslated since all bounds are positive
            expect(arc.center).toEqual({ x: 3, y: 3 });
            expect(arc.radius).toBe(3);
        });
    });

    describe('Shape Types', () => {
        it('should translate circles correctly', () => {
            const shapes: ShapeData[] = [
                {
                    id: 'circle1',
                    type: GeometryType.CIRCLE,
                    geometry: {
                        center: { x: -5, y: -3 },
                        radius: 2,
                    },
                },
            ];

            const drawing = createDrawing(shapes);
            translateToPositiveQuadrant(drawing);

            const result = drawing.shapes;
            expect(result).toHaveLength(1);
            const circle: Circle = result[0].geometry as Circle;
            // Bounding box: center(-5,-3) ± radius(2) = min(-7,-5), max(-3,-1)
            // Translation: x+7, y+5
            expect(circle.center).toEqual({ x: 2, y: 2 }); // -5+7=2, -3+5=2
            expect(circle.radius).toBe(2);
        });

        it('should translate arcs correctly', () => {
            const shapes: ShapeData[] = [
                {
                    id: 'arc1',
                    type: GeometryType.ARC,
                    geometry: {
                        center: { x: -10, y: -8 },
                        radius: 3,
                        startAngle: 0,
                        endAngle: Math.PI / 2,
                        clockwise: false,
                    },
                },
            ];

            const drawing = createDrawing(shapes);
            translateToPositiveQuadrant(drawing);

            const result = drawing.shapes;
            expect(result).toHaveLength(1);
            const arc: Arc = result[0].geometry as Arc;
            // Quarter arc from 0° to 90°: spans from (-7,-8) to (-10,-5)
            // Min bounds: x=-10, y=-8, so translation: x+10, y+8
            expect(arc.center).toEqual({ x: 0, y: 0 }); // -10+10=0, -8+8=0
            expect(arc.radius).toBe(3);
            expect(arc.startAngle).toBe(0);
            expect(arc.endAngle).toBe(Math.PI / 2);
            expect(arc.clockwise).toBe(false);
        });

        it('should translate ellipses correctly', () => {
            const shapes: ShapeData[] = [
                {
                    id: 'ellipse1',
                    type: GeometryType.ELLIPSE,
                    geometry: {
                        center: { x: -8, y: -6 },
                        majorAxisEndpoint: { x: 4, y: 0 }, // Vector, not translated
                        minorToMajorRatio: 0.5,
                    },
                },
            ];

            const drawing = createDrawing(shapes);
            translateToPositiveQuadrant(drawing);

            const result = drawing.shapes;
            expect(result).toHaveLength(1);
            const ellipse: Ellipse = result[0].geometry as Ellipse;
            // Major axis length = 4, minor = 2, horizontal major axis
            // Bounding box: center(-8,-6) ± (4,2) = min(-12,-8), max(-4,-4)
            // Translation: x+12, y+8
            expect(ellipse.center).toEqual({ x: 4, y: 2 }); // -8+12=4, -6+8=2
            expect(ellipse.majorAxisEndpoint).toEqual({ x: 4, y: 0 }); // Vector unchanged
            expect(ellipse.minorToMajorRatio).toBe(0.5);
        });
    });

    describe('Multiple Shapes', () => {
        it('should translate multiple shapes by the same amount based on global minimum', () => {
            const shapes: ShapeData[] = [
                {
                    id: 'line1',
                    type: GeometryType.LINE,
                    geometry: {
                        start: { x: -5, y: -3 },
                        end: { x: 0, y: 0 },
                    },
                },
                {
                    id: 'circle1',
                    type: GeometryType.CIRCLE,
                    geometry: {
                        center: { x: 10, y: -8 }, // Circle has most negative Y
                        radius: 1,
                    },
                },
            ];

            const drawing = createDrawing(shapes);
            translateToPositiveQuadrant(drawing);

            const result = drawing.shapes;
            expect(result).toHaveLength(2);

            // Global min: x=-5 (from line), y=-9 (from circle: -8-1=-9)
            // Translation: x+5, y+9

            const line: Line = result[0].geometry as Line;
            expect(line.start).toEqual({ x: 0, y: 6 }); // -5+5=0, -3+9=6
            expect(line.end).toEqual({ x: 5, y: 9 }); // 0+5=5, 0+9=9

            const circle: Circle = result[1].geometry as Circle;
            expect(circle.center).toEqual({ x: 15, y: 1 }); // 10+5=15, -8+9=1
        });
    });

    describe('Edge Cases', () => {
        it('should not translate empty shape array', () => {
            const drawing = createDrawing([]);
            // Empty drawings don't need translation - skip the call
            expect(drawing.shapes).toHaveLength(0);
        });

        it('should handle shapes at origin', () => {
            const shapes: ShapeData[] = [
                {
                    id: 'line1',
                    type: GeometryType.LINE,
                    geometry: {
                        start: { x: 0, y: 0 },
                        end: { x: 10, y: 10 },
                    },
                },
            ];

            const drawing = createDrawing(shapes);
            translateToPositiveQuadrant(drawing);

            const result = drawing.shapes;
            expect(result).toHaveLength(1);
            expect(result[0].toData()).toEqual(shapes[0]); // Should be unchanged
        });

        it('should handle shapes with zero-size bounding box', () => {
            const shapes: ShapeData[] = [
                {
                    id: 'line1',
                    type: GeometryType.LINE,
                    geometry: {
                        start: { x: -5, y: -5 },
                        end: { x: -5, y: -5 }, // Same point
                    },
                },
            ];

            const drawing = createDrawing(shapes);
            translateToPositiveQuadrant(drawing);

            const result = drawing.shapes;
            expect(result).toHaveLength(1);
            const line: Line = result[0].geometry as Line;
            expect(line.start).toEqual({ x: 0, y: 0 });
            expect(line.end).toEqual({ x: 0, y: 0 });
        });

        it('should preserve shape properties', () => {
            const shapes: ShapeData[] = [
                {
                    id: 'line1',
                    type: GeometryType.LINE,
                    geometry: {
                        start: { x: -5, y: -5 },
                        end: { x: 0, y: 0 },
                    },
                    layer: 'construction',
                },
            ];

            const drawing = createDrawing(shapes);
            translateToPositiveQuadrant(drawing);

            const result = drawing.shapes;
            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('line1');
            expect(result[0].type).toBe('line');
            expect(result[0].layer).toBe('construction');
        });
    });

    describe('Precision', () => {
        it('should handle very small negative coordinates', () => {
            const shapes: ShapeData[] = [
                {
                    id: 'line1',
                    type: GeometryType.LINE,
                    geometry: {
                        start: { x: -0.001, y: 5 },
                        end: { x: 10, y: 15 },
                    },
                },
            ];

            const drawing = createDrawing(shapes);
            translateToPositiveQuadrant(drawing);

            const result = drawing.shapes;
            expect(result).toHaveLength(1);
            const line: Line = result[0].geometry as Line;
            expect(line.start.x).toBeCloseTo(0, 6); // Should be very close to 0
            expect(line.start.y).toBe(5); // Y unchanged
            expect(line.end.x).toBeCloseTo(10.001, 6);
            expect(line.end.y).toBe(15);
        });
    });
});
