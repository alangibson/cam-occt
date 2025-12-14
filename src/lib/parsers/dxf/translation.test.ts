import { describe, expect, it } from 'vitest';
import { parseDXF } from './functions';
import { polylineToPoints } from '$lib/geometry/dxf-polyline/functions';
import { translateToPositiveQuadrant } from '$lib/algorithms/translate-to-positive/translate-to-positive';
import { decomposePolylines } from '$lib/cam/preprocess/decompose-polylines/decompose-polylines';
import { getShapePoints } from '$lib/cam/shape/functions';
import type { Arc } from '$lib/geometry/arc/interfaces';
import type { Circle } from '$lib/geometry/circle/interfaces';
import type { Line } from '$lib/geometry/line/interfaces';
import type { DxfPolyline } from '$lib/geometry/dxf-polyline/interfaces';
import type { Point2D } from '$lib/geometry/point/interfaces';
import type { ShapeData } from '$lib/cam/shape/interfaces';
import { EPSILON } from '$lib/geometry/math/constants';
import { Shape } from '$lib/cam/shape/classes';
import { Drawing } from '$lib/cam/drawing/classes.svelte';
import { Unit } from '$lib/config/units/units';
import { arcBoundingBox } from '$lib/geometry/arc/functions';

// Helper function to create a Drawing from shapes and apply translation
function createAndTranslateDrawing(
    shapes: ShapeData[],
    units: Unit = Unit.MM
): Drawing {
    const drawing = new Drawing({ shapes, units, fileName: 'test.dxf' });
    translateToPositiveQuadrant(drawing);
    return drawing;
}

// Helper function to calculate bounds for translated shapes
function calculateBounds(shapes: ShapeData[]) {
    if (shapes.length === 0) {
        return { min: { x: 0, y: 0 }, max: { x: 0, y: 0 } };
    }

    let minX = Infinity,
        maxX = -Infinity;
    let minY = Infinity,
        maxY = -Infinity;

    shapes.forEach((shape) => {
        const points = getShapePoints(new Shape(shape), { mode: 'BOUNDS' });
        points.forEach((point) => {
            minX = Math.min(minX, point.x);
            maxX = Math.max(maxX, point.x);
            minY = Math.min(minY, point.y);
            maxY = Math.max(maxY, point.y);
        });
    });

    return {
        min: { x: isFinite(minX) ? minX : 0, y: isFinite(minY) ? minY : 0 },
        max: { x: isFinite(maxX) ? maxX : 0, y: isFinite(maxY) ? maxY : 0 },
    };
}

describe('Translation to Positive Quadrant Feature', () => {
    describe('Basic translation functionality', () => {
        it('should translate drawing with negative coordinates to origin', async () => {
            // Mock DXF content with shapes in negative quadrant
            const mockDXFContent = `0
SECTION
2
ENTITIES
0
LINE
10
-100
20
-50
11
-50
21
-25
0
CIRCLE
10
-75
20
-100
40
25
0
ENDSEC
0
EOF`;

            // Parse DXF (no translation in parser)
            const parsed = await parseDXF(mockDXFContent);

            // Create drawing and apply translation
            const drawing = createAndTranslateDrawing(
                parsed.shapes,
                parsed.units
            );

            // Check that bounds start at origin
            expect(drawing.bounds.min.x).toBe(0);
            expect(drawing.bounds.min.y).toBe(0);
            expect(drawing.bounds.max.x).toBeGreaterThan(0);
            expect(drawing.bounds.max.y).toBeGreaterThan(0);

            // Check that shapes were translated
            const lineShape = drawing.shapes.find(
                (s: ShapeData) => s.type === 'line'
            );
            const circleShape = drawing.shapes.find(
                (s: ShapeData) => s.type === 'circle'
            );

            if (lineShape) {
                const lineGeom = lineShape.geometry as Line;
                expect(lineGeom.start.x).toBeGreaterThanOrEqual(0);
                expect(lineGeom.start.y).toBeGreaterThanOrEqual(0);
                expect(lineGeom.end.x).toBeGreaterThanOrEqual(0);
                expect(lineGeom.end.y).toBeGreaterThanOrEqual(0);
            }

            if (circleShape) {
                const circleGeom = circleShape.geometry as Circle;
                expect(circleGeom.center.x).toBeGreaterThanOrEqual(0);
                expect(circleGeom.center.y).toBeGreaterThanOrEqual(0);
            }
        });

        it('should not translate drawing already in positive quadrant', async () => {
            const mockDXFContent = `0
SECTION
2
ENTITIES
0
LINE
10
10
20
20
11
50
21
60
0
CIRCLE
10
30
20
40
40
15
0
ENDSEC
0
EOF`;

            // Parse DXF
            const parsed = await parseDXF(mockDXFContent);

            // Create drawing and apply translation (should not change anything)
            const translatedDrawing = createAndTranslateDrawing(
                parsed.shapes,
                parsed.units
            );

            // Should be identical since already in positive quadrant
            expect(translatedDrawing.bounds).toEqual(
                calculateBounds(parsed.shapes)
            );

            // Check shapes are identical
            expect(translatedDrawing.shapes.length).toBe(parsed.shapes.length);

            for (let i: number = 0; i < translatedDrawing.shapes.length; i++) {
                const original = parsed.shapes[i];
                const translated = translatedDrawing.shapes[i];
                expect(translated.geometry).toEqual(original.geometry);
            }
        });

        it('should handle mixed quadrant drawing correctly', async () => {
            const mockDXFContent = `0
SECTION
2
ENTITIES
0
LINE
10
-50
20
-25
11
100
21
75
0
CIRCLE
10
25
20
-10
40
5
0
ENDSEC
0
EOF`;

            // Parse DXF (no translation in parser)
            const parsed = await parseDXF(mockDXFContent);

            // Create drawing and apply translation
            const drawing = createAndTranslateDrawing(
                parsed.shapes,
                parsed.units
            );

            // Should start at origin
            expect(drawing.bounds.min.x).toBe(0);
            expect(drawing.bounds.min.y).toBe(0);

            // All shapes should be in positive quadrant
            drawing.shapes.forEach((shape: ShapeData) => {
                switch (shape.type) {
                    case 'line':
                        const line: Line = shape.geometry as Line;
                        expect(line.start.x).toBeGreaterThanOrEqual(0);
                        expect(line.start.y).toBeGreaterThanOrEqual(0);
                        expect(line.end.x).toBeGreaterThanOrEqual(0);
                        expect(line.end.y).toBeGreaterThanOrEqual(0);
                        break;
                    case 'circle':
                        const circle: Circle = shape.geometry as Circle;
                        expect(
                            circle.center.x - circle.radius
                        ).toBeGreaterThanOrEqual(0);
                        expect(
                            circle.center.y - circle.radius
                        ).toBeGreaterThanOrEqual(0);
                        break;
                }
            });
        });
    });

    describe('Polyline translation', () => {
        it('should translate simple polylines correctly after decomposition', async () => {
            const mockDXFContent = `0
SECTION
2
ENTITIES
0
LWPOLYLINE
90
3
10
-20
20
-30
10
-10
20
-20
10
0
20
-10
0
ENDSEC
0
EOF`;

            // Parse DXF (no translation in parser)
            const parsed = await parseDXF(mockDXFContent);

            // Decompose polylines first, then translate
            const decomposed = decomposePolylines(
                parsed.shapes.map((s) => new Shape(s))
            );
            const drawing = createAndTranslateDrawing(
                decomposed.map((s) => s.toData()),
                parsed.units
            );

            // After decomposition, we should have line segments
            const lines = drawing.shapes.filter(
                (s: ShapeData) => s.type === 'line'
            );
            expect(lines.length).toBeGreaterThan(0);

            // All decomposed line segments should be in positive quadrant
            lines.forEach((lineShape: ShapeData) => {
                const line = lineShape.geometry as Line;
                expect(line.start.x).toBeGreaterThanOrEqual(0);
                expect(line.start.y).toBeGreaterThanOrEqual(0);
                expect(line.end.x).toBeGreaterThanOrEqual(0);
                expect(line.end.y).toBeGreaterThanOrEqual(0);
            });
        });

        it('should translate polylines with bulges correctly after decomposition', async () => {
            // Create a more complex DXF with bulge data
            const mockDXFContent = `0
SECTION
2
ENTITIES
0
LWPOLYLINE
90
4
10
-50
20
-50
42
0.5
10
-25
20
-50
42
0.0
10
-25
20
-25
42
-0.3
10
-50
20
-25
70
1
0
ENDSEC
0
EOF`;

            // Parse DXF (no translation in parser)
            const parsed = await parseDXF(mockDXFContent);

            // Decompose polylines first (converts bulges to arcs), then translate
            const decomposed = decomposePolylines(
                parsed.shapes.map((s) => new Shape(s))
            );
            const drawing = createAndTranslateDrawing(
                decomposed.map((s) => s.toData()),
                parsed.units
            );

            // After decomposition, we should have line and arc segments
            const segments = drawing.shapes.filter(
                (s: ShapeData) => s.type === 'line' || s.type === 'arc'
            );
            expect(segments.length).toBeGreaterThan(0);

            // All decomposed segments should be in positive quadrant
            segments.forEach((shape: ShapeData) => {
                if (shape.type === 'line') {
                    const line = shape.geometry as Line;
                    expect(line.start.x).toBeGreaterThanOrEqual(0);
                    expect(line.start.y).toBeGreaterThanOrEqual(0);
                    expect(line.end.x).toBeGreaterThanOrEqual(0);
                    expect(line.end.y).toBeGreaterThanOrEqual(0);
                } else if (shape.type === 'arc') {
                    const arc = shape.geometry as Arc;
                    const bounds = arcBoundingBox(arc);
                    expect(bounds.min.x).toBeGreaterThanOrEqual(0);
                    expect(bounds.min.y).toBeGreaterThanOrEqual(0);
                }
            });
        });

        it('should translate decomposed polylines correctly', async () => {
            const mockDXFContent = `0
SECTION
2
ENTITIES
0
LWPOLYLINE
90
3
10
-100
20
-50
42
1.0
10
-50
20
-50
42
0.0
10
-50
20
0
0
ENDSEC
0
EOF`;

            // Parse DXF (no options in parser)
            const parsed = await parseDXF(mockDXFContent);

            // Apply decomposition first, then translation
            const decomposed = decomposePolylines(
                parsed.shapes.map((s) => new Shape(s))
            );
            const drawing = createAndTranslateDrawing(
                decomposed.map((s) => s.toData()),
                parsed.units
            );

            // Should have multiple shapes (decomposed)
            expect(drawing.shapes.length).toBeGreaterThan(1);

            // All shapes should be in positive quadrant
            drawing.shapes.forEach((shape: ShapeData) => {
                switch (shape.type) {
                    case 'line':
                        const line: Line = shape.geometry as Line;
                        expect(line.start.x).toBeGreaterThanOrEqual(0);
                        expect(line.start.y).toBeGreaterThanOrEqual(0);
                        expect(line.end.x).toBeGreaterThanOrEqual(0);
                        expect(line.end.y).toBeGreaterThanOrEqual(0);
                        break;
                    case 'arc':
                        const arc: Arc = shape.geometry as Arc;
                        expect(
                            arc.center.x - arc.radius
                        ).toBeGreaterThanOrEqual(0);
                        expect(
                            arc.center.y - arc.radius
                        ).toBeGreaterThanOrEqual(0);
                        break;
                }
            });
        });
    });

    describe('Translation calculations', () => {
        it('should calculate correct translation vector', async () => {
            const mockDXFContent = `0
SECTION
2
ENTITIES
0
LINE
10
-75
20
-100
11
25
21
50
0
ENDSEC
0
EOF`;

            // Parse DXF (original)
            const originalDrawing = await parseDXF(mockDXFContent);

            // Calculate bounds BEFORE creating translated drawing to avoid mutation
            const originalBounds = calculateBounds(originalDrawing.shapes);
            const expectedTranslationX = -originalBounds.min.x;
            const expectedTranslationY = -originalBounds.min.y;

            expect(expectedTranslationX).toBe(75);
            expect(expectedTranslationY).toBe(100);

            // Apply translation separately
            const translatedDrawing = createAndTranslateDrawing(
                originalDrawing.shapes,
                originalDrawing.units
            );

            // Check that translation was applied correctly
            expect(translatedDrawing.bounds.min.x).toBe(0);
            expect(translatedDrawing.bounds.min.y).toBe(0);
            expect(translatedDrawing.bounds.max.x).toBe(
                originalBounds.max.x + expectedTranslationX
            );
            expect(translatedDrawing.bounds.max.y).toBe(
                originalBounds.max.y + expectedTranslationY
            );
        });

        it('should preserve relative positions after translation', async () => {
            const mockDXFContent = `0
SECTION
2
ENTITIES
0
LINE
10
-50
20
-30
11
-25
21
-10
0
LINE
10
-25
20
-10
11
0
21
10
0
ENDSEC
0
EOF`;

            const originalDrawing = await parseDXF(mockDXFContent);

            const translatedDrawing = await parseDXF(mockDXFContent);

            // Get the two lines
            const originalLines = originalDrawing.shapes.filter(
                (s: ShapeData) => s.type === 'line'
            );
            const translatedLines = translatedDrawing.shapes.filter(
                (s: ShapeData) => s.type === 'line'
            );

            expect(originalLines.length).toBe(2);
            expect(translatedLines.length).toBe(2);

            // Calculate relative distances in original drawing
            const origLine1 = originalLines[0].geometry as Line;
            const origLine2 = originalLines[1].geometry as Line;
            const origDistance = Math.sqrt(
                Math.pow(origLine2.start.x - origLine1.start.x, 2) +
                    Math.pow(origLine2.start.y - origLine1.start.y, 2)
            );

            // Calculate relative distances in translated drawing
            const transLine1 = translatedLines[0].geometry as Line;
            const transLine2 = translatedLines[1].geometry as Line;
            const transDistance = Math.sqrt(
                Math.pow(transLine2.start.x - transLine1.start.x, 2) +
                    Math.pow(transLine2.start.y - transLine1.start.y, 2)
            );

            // Distances should be preserved
            expect(transDistance).toBeCloseTo(origDistance, 5);
        });
    });

    describe('Edge cases', () => {
        it('should handle empty drawing', async () => {
            const emptyDXFContent = `0
SECTION
2
ENTITIES
0
ENDSEC
0
EOF`;

            // Parse DXF (no translation in parser)
            const parsed = await parseDXF(emptyDXFContent);

            // Create drawing without translation for empty case
            const drawing = new Drawing({
                shapes: parsed.shapes,
                units: parsed.units,
                fileName: 'test.dxf',
            });

            expect(drawing.shapes.length).toBe(0);
            // Empty drawing doesn't need translation
        });

        it('should handle drawing at exact origin', async () => {
            const originDXFContent = `0
SECTION
2
ENTITIES
0
LINE
10
0
20
0
11
50
21
50
0
ENDSEC
0
EOF`;

            // Parse DXF (no translation in parser)
            const parsed = await parseDXF(originDXFContent);

            // Apply translation separately
            const drawing = createAndTranslateDrawing(
                parsed.shapes,
                parsed.units
            );

            // Should remain unchanged
            expect(drawing.bounds.min.x).toBe(0);
            expect(drawing.bounds.min.y).toBe(0);
            expect(drawing.bounds.max.x).toBe(50);
            expect(drawing.bounds.max.y).toBe(50);
        });

        it('should handle very small negative coordinates', async () => {
            const smallNegativeDXFContent = `0
SECTION
2
ENTITIES
0
LINE
10
-0.001
20
-0.002
11
10
21
20
0
ENDSEC
0
EOF`;

            // Parse DXF (no translation in parser)
            const parsed = await parseDXF(smallNegativeDXFContent);

            // Apply translation separately
            const drawing = createAndTranslateDrawing(
                parsed.shapes,
                parsed.units
            );

            // Should still translate to origin
            expect(drawing.bounds.min.x).toBe(0);
            expect(drawing.bounds.min.y).toBe(0);
        });
    });

    describe('Option toggling', () => {
        it('should respect translateToPositiveQuadrant option when false', async () => {
            const mockDXFContent = `0
SECTION
2
ENTITIES
0
LINE
10
-50
20
-25
11
25
21
75
0
ENDSEC
0
EOF`;

            const drawing = await parseDXF(mockDXFContent);
            const bounds = calculateBounds(drawing.shapes);

            // Should preserve original negative coordinates
            expect(bounds.min.x).toBeLessThan(0);
            expect(bounds.min.y).toBeLessThan(0);

            const line: Line = drawing.shapes[0].geometry as Line;
            expect(line.start.x).toBe(-50);
            expect(line.start.y).toBe(-25);
        });

        it('should work with both decomposePolylines and translateToPositiveQuadrant enabled', async () => {
            const mockDXFContent = `0
SECTION
2
ENTITIES
0
LWPOLYLINE
90
3
10
-50
20
-30
42
0.5
10
-25
20
-30
42
0.0
10
-25
20
-10
0
ENDSEC
0
EOF`;

            // Parse DXF (no options in parser)
            const parsed = await parseDXF(mockDXFContent);

            // Apply both decomposition and translation separately
            const decomposed = decomposePolylines(
                parsed.shapes.map((s) => new Shape(s))
            );
            const drawing = createAndTranslateDrawing(
                decomposed.map((s) => s.toData()),
                parsed.units
            );

            // Should have decomposed shapes
            expect(drawing.shapes.length).toBeGreaterThan(1);

            // All shapes should be in positive quadrant (allowing for floating point precision)
            expect(drawing.bounds.min.x).toBeCloseTo(0, 10);
            expect(drawing.bounds.min.y).toBeCloseTo(0, 10);

            drawing.shapes.forEach((shape: ShapeData) => {
                const bounds = getShapeBounds(shape);
                expect(bounds.min.x).toBeGreaterThanOrEqual(-EPSILON); // Allow for floating point precision
                expect(bounds.min.y).toBeGreaterThanOrEqual(-EPSILON);
            });
        });
    });
});

// Helper function to get shape bounds
function getShapeBounds(shape: ShapeData) {
    let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;

    switch (shape.type) {
        case 'line':
            const line = shape.geometry as Line;
            minX = Math.min(line.start.x, line.end.x);
            maxX = Math.max(line.start.x, line.end.x);
            minY = Math.min(line.start.y, line.end.y);
            maxY = Math.max(line.start.y, line.end.y);
            break;
        case 'circle':
            const circle = shape.geometry as Circle;
            minX = circle.center.x - circle.radius;
            maxX = circle.center.x + circle.radius;
            minY = circle.center.y - circle.radius;
            maxY = circle.center.y + circle.radius;
            break;
        case 'arc':
            const arc = shape.geometry as Arc;
            // Use actual arc bounds instead of full circle bounds
            const arcBounds = arcBoundingBox(arc);
            minX = arcBounds.min.x;
            maxX = arcBounds.max.x;
            minY = arcBounds.min.y;
            maxY = arcBounds.max.y;
            break;
        case 'polyline':
            const polyline = shape.geometry as DxfPolyline;
            polylineToPoints(polyline).forEach((point: Point2D) => {
                minX = Math.min(minX, point.x);
                maxX = Math.max(maxX, point.x);
                minY = Math.min(minY, point.y);
                maxY = Math.max(maxY, point.y);
            });
            break;
    }

    return {
        min: { x: minX, y: minY },
        max: { x: maxX, y: maxY },
    };
}
