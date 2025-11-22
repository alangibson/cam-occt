import { describe, expect, it } from 'vitest';
import { parseDXF } from './functions';
import type { Ellipse } from '$lib/geometry/ellipse/interfaces';
import type { ShapeData } from '$lib/geometry/shape/interfaces';
import { getBoundingBoxForShapes } from '$lib/geometry/bounding-box/functions';

describe('DXF Parser - ELLIPSE entity support', () => {
    describe('Full ellipse parsing', () => {
        it('should parse a basic ellipse entity', async () => {
            const dxfContent: string = `0
SECTION
2
HEADER
9
$ACADVER
1
AC1015
0
ENDSEC
0
SECTION
2
ENTITIES
0
ELLIPSE
5
30
100
AcDbEntity
8
0
6
Continuous
100
AcDbEllipse
10
100.0
20
200.0
30
0.0
11
50.0
21
0.0
31
0.0
210
0.0
220
0.0
230
1.0
40
0.5
0
ENDSEC
0
EOF`;

            const drawing = await parseDXF(dxfContent);

            expect(drawing.shapes).toHaveLength(1);

            const ellipseShape: ShapeData = drawing.shapes[0];
            expect(ellipseShape.type).toBe('ellipse');

            const geometry = ellipseShape.geometry as Ellipse;
            expect(geometry.center).toEqual({ x: 100, y: 200 });
            expect(geometry.majorAxisEndpoint).toEqual({ x: 50, y: 0 });
            expect(geometry.minorToMajorRatio).toBe(0.5);
            expect(geometry.startParam).toBe(0);
            expect(geometry.endParam).toBe(2 * Math.PI);
        });

        it('should parse an ellipse with different orientation', async () => {
            const dxfContent = `0
SECTION
2
ENTITIES
0
ELLIPSE
10
0.0
20
0.0
30
0.0
11
0.0
21
30.0
31
0.0
40
0.8
0
ENDSEC
0
EOF`;

            const drawing = await parseDXF(dxfContent);

            expect(drawing.shapes).toHaveLength(1);

            const ellipseShape: ShapeData = drawing.shapes[0];
            expect(ellipseShape.type).toBe('ellipse');

            const geometry = ellipseShape.geometry as Ellipse;
            expect(geometry.center).toEqual({ x: 0, y: 0 });
            expect(geometry.majorAxisEndpoint).toEqual({ x: 0, y: 30 });
            expect(geometry.minorToMajorRatio).toBe(0.8);
        });
    });

    describe('Ellipse arc parsing', () => {
        it('should parse an ellipse arc with start and end parameters', async () => {
            const dxfContent = `0
SECTION
2
ENTITIES
0
ELLIPSE
10
50.0
20
75.0
30
0.0
11
25.0
21
0.0
31
0.0
40
0.6
41
0.0
42
1.570796327
0
ENDSEC
0
EOF`;

            const drawing = await parseDXF(dxfContent);

            expect(drawing.shapes).toHaveLength(1);

            const ellipseShape: ShapeData = drawing.shapes[0];
            expect(ellipseShape.type).toBe('ellipse');

            const geometry = ellipseShape.geometry as Ellipse;
            expect(geometry.center).toEqual({ x: 50, y: 75 });
            expect(geometry.majorAxisEndpoint).toEqual({ x: 25, y: 0 });
            expect(geometry.minorToMajorRatio).toBe(0.6);
            expect(geometry.startParam).toBeCloseTo(0, 5);
            expect(geometry.endParam).toBeCloseTo(Math.PI / 2, 5);
        });

        it('should parse an ellipse arc spanning more than 180 degrees', async () => {
            const dxfContent = `0
SECTION
2
ENTITIES
0
ELLIPSE
10
0.0
20
0.0
30
0.0
11
40.0
21
0.0
31
0.0
40
0.75
41
0.5235987756
42
5.759586532
0
ENDSEC
0
EOF`;

            const drawing = await parseDXF(dxfContent);

            expect(drawing.shapes).toHaveLength(1);

            const ellipseShape: ShapeData = drawing.shapes[0];
            expect(ellipseShape.type).toBe('ellipse');

            const geometry = ellipseShape.geometry as Ellipse;
            expect(geometry.center).toEqual({ x: 0, y: 0 });
            expect(geometry.majorAxisEndpoint).toEqual({ x: 40, y: 0 });
            expect(geometry.minorToMajorRatio).toBe(0.75);
            expect(geometry.startParam).toBeCloseTo(Math.PI / 6, 5); // 30 degrees
            expect(geometry.endParam).toBeCloseTo((11 * Math.PI) / 6, 5); // 330 degrees
        });
    });

    describe('Ellipse transformation in INSERT blocks', () => {
        it('should correctly transform ellipse center and major axis in INSERT block', async () => {
            const dxfContent = `0
SECTION
2
BLOCKS
0
BLOCK
2
TestBlock
10
0.0
20
0.0
30
0.0
0
ELLIPSE
10
10.0
20
20.0
30
0.0
11
15.0
21
0.0
31
0.0
40
0.5
0
ENDBLK
0
ENDSEC
0
SECTION
2
ENTITIES
0
INSERT
2
TestBlock
10
100.0
20
200.0
30
0.0
41
2.0
42
1.5
50
45.0
0
ENDSEC
0
EOF`;

            const drawing = await parseDXF(dxfContent);

            expect(drawing.shapes).toHaveLength(1);

            const ellipseShape: ShapeData = drawing.shapes[0];
            expect(ellipseShape.type).toBe('ellipse');

            const geometry = ellipseShape.geometry as Ellipse;

            // Verify center is transformed correctly
            // Original: (10, 20), scaled by (2, 1.5), rotated 45°, translated to (100, 200)
            expect(geometry.center.x).toBeCloseTo(
                100 +
                    (10 * 2 * Math.cos(Math.PI / 4) -
                        20 * 1.5 * Math.sin(Math.PI / 4)),
                3
            );
            expect(geometry.center.y).toBeCloseTo(
                200 +
                    (10 * 2 * Math.sin(Math.PI / 4) +
                        20 * 1.5 * Math.cos(Math.PI / 4)),
                3
            );

            // Major axis endpoint should also be transformed
            expect(geometry.majorAxisEndpoint.x).toBeDefined();
            expect(geometry.majorAxisEndpoint.y).toBeDefined();
            expect(geometry.minorToMajorRatio).toBe(0.5);
        });
    });

    describe('Edge cases and validation', () => {
        it('should handle ellipse with circular ratio (ratio = 1)', async () => {
            const dxfContent = `0
SECTION
2
ENTITIES
0
ELLIPSE
10
0.0
20
0.0
30
0.0
11
20.0
21
0.0
31
0.0
40
1.0
0
ENDSEC
0
EOF`;

            const drawing = await parseDXF(dxfContent);

            expect(drawing.shapes).toHaveLength(1);

            const ellipseShape: ShapeData = drawing.shapes[0];
            expect(ellipseShape.type).toBe('ellipse');

            const geometry = ellipseShape.geometry as Ellipse;
            expect(geometry.minorToMajorRatio).toBe(1.0); // Perfect circle
        });

        it('should handle ellipse with very small ratio', async () => {
            const dxfContent = `0
SECTION
2
ENTITIES
0
ELLIPSE
10
0.0
20
0.0
30
0.0
11
50.0
21
0.0
31
0.0
40
0.1
0
ENDSEC
0
EOF`;

            const drawing = await parseDXF(dxfContent);

            expect(drawing.shapes).toHaveLength(1);

            const ellipseShape: ShapeData = drawing.shapes[0];
            expect(ellipseShape.type).toBe('ellipse');

            const geometry = ellipseShape.geometry as Ellipse;
            expect(geometry.minorToMajorRatio).toBe(0.1); // Very flat ellipse
        });

        it('should reject invalid ellipse with missing required parameters', async () => {
            const dxfContent = `0
SECTION
2
ENTITIES
0
ELLIPSE
10
0.0
20
0.0
30
0.0
0
ENDSEC
0
EOF`;

            const drawing = await parseDXF(dxfContent);

            expect(drawing.shapes).toHaveLength(0);
        });
    });

    describe('Bounds calculation', () => {
        it('should calculate drawing bounds correctly for ellipses', async () => {
            const dxfContent = `0
SECTION
2
ENTITIES
0
ELLIPSE
10
100.0
20
200.0
30
0.0
11
50.0
21
0.0
31
0.0
40
0.5
0
ENDSEC
0
EOF`;

            const drawing = await parseDXF(dxfContent);
            const bounds = getBoundingBoxForShapes(drawing.shapes);

            expect(bounds).toBeDefined();
            expect(bounds.min.x).toBeLessThan(100);
            expect(bounds.max.x).toBeGreaterThan(100);
            expect(bounds.min.y).toBeLessThan(200);
            expect(bounds.max.y).toBeGreaterThan(200);
        });
    });
});
