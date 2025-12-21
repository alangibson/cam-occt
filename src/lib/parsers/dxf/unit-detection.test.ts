import { describe, expect, it } from 'vitest';
import { parseDXF } from './functions';
import { OriginLocation } from '$lib/cam/drawing/enums';
import { decomposePolylines } from '$lib/cam/preprocess/decompose-polylines/decompose-polylines';
import type { Circle } from '$lib/geometry/circle/interfaces';
import type { Line } from '$lib/geometry/line/interfaces';
import type { ShapeData } from '$lib/cam/shape/interfaces';
import { Shape } from '$lib/cam/shape/classes';
import { Drawing } from '$lib/cam/drawing/classes.svelte';
import { Unit } from '$lib/config/units/units';

// Helper function to create a Drawing from shapes and apply translation
function createAndTranslateDrawing(
    shapes: ShapeData[],
    units: Unit | string = Unit.MM
): Drawing {
    const drawing = new Drawing({
        shapes,
        units: units as Unit,
        fileName: 'test.dxf',
    });
    drawing.originTo(OriginLocation.BOTTOM_LEFT);
    return drawing;
}

// Helper function to calculate bounds for translated shapes

describe('DXF Unit Detection', () => {
    describe('$INSUNITS header variable parsing', () => {
        it('should detect millimeters from $INSUNITS=4', async () => {
            const dxfWithMM = `0
SECTION
2
HEADER
9
$INSUNITS
70
4
0
ENDSEC
0
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
10
21
10
0
ENDSEC
0
EOF`;

            const drawing = await parseDXF(dxfWithMM);
            expect(drawing.units).toBe('mm');
        });

        it('should detect inches from $INSUNITS=1', async () => {
            const dxfWithInches = `0
SECTION
2
HEADER
9
$INSUNITS
70
1
0
ENDSEC
0
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
1
21
1
0
ENDSEC
0
EOF`;

            const drawing = await parseDXF(dxfWithInches);
            expect(drawing.units).toBe('inch');
        });

        it('should default to mm when $INSUNITS is not specified', async () => {
            const dxfWithoutUnits = `0
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
10
21
10
0
ENDSEC
0
EOF`;

            const drawing = await parseDXF(dxfWithoutUnits);
            expect(drawing.units).toBe('none');
        });

        it('should default to mm for unsupported $INSUNITS values', async () => {
            const dxfWithUnsupportedUnits = `0
SECTION
2
HEADER
9
$INSUNITS
70
99
0
ENDSEC
0
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
10
21
10
0
ENDSEC
0
EOF`;

            const drawing = await parseDXF(dxfWithUnsupportedUnits);
            expect(drawing.units).toBe('mm');
        });

        it('should treat centimeters as mm', async () => {
            const dxfWithCM = `0
SECTION
2
HEADER
9
$INSUNITS
70
5
0
ENDSEC
0
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
10
21
10
0
ENDSEC
0
EOF`;

            const drawing = await parseDXF(dxfWithCM);
            expect(drawing.units).toBe('mm');
        });

        it('should treat meters as mm', async () => {
            const dxfWithMeters = `0
SECTION
2
HEADER
9
$INSUNITS
70
6
0
ENDSEC
0
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
10
21
10
0
ENDSEC
0
EOF`;

            const drawing = await parseDXF(dxfWithMeters);
            expect(drawing.units).toBe('mm');
        });
    });

    describe('Unit detection with geometry', () => {
        it('should preserve geometry regardless of detected units', async () => {
            const dxfTemplate = (insunits: number) => `0
SECTION
2
HEADER
9
$INSUNITS
70
${insunits}
0
ENDSEC
0
SECTION
2
ENTITIES
0
LINE
10
5.5
20
10.25
11
15.75
21
20.5
0
CIRCLE
10
25
20
30
40
12.5
0
ENDSEC
0
EOF`;

            const mmDrawing = await parseDXF(dxfTemplate(4)); // mm
            const inchDrawing = await parseDXF(dxfTemplate(1)); // inch

            // Units should be different
            expect(mmDrawing.units).toBe('mm');
            expect(inchDrawing.units).toBe('inch');

            // But geometry should be identical
            expect(mmDrawing.shapes.length).toBe(inchDrawing.shapes.length);

            const mmLine = mmDrawing.shapes.find(
                (s: ShapeData) => s.type === 'line'
            )?.geometry as Line;
            const inchLine = inchDrawing.shapes.find(
                (s: ShapeData) => s.type === 'line'
            )?.geometry as Line;

            expect(mmLine.start.x).toBe(inchLine.start.x);
            expect(mmLine.start.y).toBe(inchLine.start.y);
            expect(mmLine.end.x).toBe(inchLine.end.x);
            expect(mmLine.end.y).toBe(inchLine.end.y);

            const mmCircle = mmDrawing.shapes.find(
                (s: ShapeData) => s.type === 'circle'
            )?.geometry as Circle;
            const inchCircle = inchDrawing.shapes.find(
                (s: ShapeData) => s.type === 'circle'
            )?.geometry as Circle;

            expect(mmCircle.center.x).toBe(inchCircle.center.x);
            expect(mmCircle.center.y).toBe(inchCircle.center.y);
            expect(mmCircle.radius).toBe(inchCircle.radius);
        });
    });

    describe('Integration with translation feature', () => {
        it('should detect units correctly when translation is enabled', async () => {
            const dxfWithNegativeCoords = `0
SECTION
2
HEADER
9
$INSUNITS
70
1
0
ENDSEC
0
SECTION
2
ENTITIES
0
LINE
10
-10
20
-5
11
5
21
10
0
ENDSEC
0
EOF`;

            // Parse DXF (no translation in parser)
            const parsed = await parseDXF(dxfWithNegativeCoords);

            // Apply translation separately
            const drawing = createAndTranslateDrawing(
                parsed.shapes,
                parsed.units
            );

            expect(drawing.units).toBe('inch');
            expect(drawing.bounds.min.x).toBe(0);
            expect(drawing.bounds.min.y).toBe(0);
        });

        it('should detect units correctly when polyline decomposition is enabled', async () => {
            const dxfWithPolyline = `0
SECTION
2
HEADER
9
$INSUNITS
70
4
0
ENDSEC
0
SECTION
2
ENTITIES
0
LWPOLYLINE
90
3
10
0
20
0
42
0.5
10
10
20
0
42
0
10
10
21
10
0
ENDSEC
0
EOF`;

            // Parse DXF (no decomposition in parser)
            const parsed = await parseDXF(dxfWithPolyline);

            // Apply decomposition separately
            const decomposed = decomposePolylines(
                parsed.shapes.map((s) => new Shape(s))
            );

            // Create decomposed drawing
            const drawing = {
                ...parsed,
                shapes: decomposed,
            };

            expect(drawing.units).toBe('mm');
            expect(drawing.shapes.length).toBeGreaterThan(1); // Should be decomposed
        });
    });
});
