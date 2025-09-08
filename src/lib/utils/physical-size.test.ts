import { describe, it, expect } from 'vitest';
import { parseDXF } from '../parsers/dxf-parser';
import { getPhysicalScaleFactor, Unit } from './units';

describe('Physical Size Display', () => {
    describe('Real-world DXF physical sizing', () => {
        it('should display ADLER.DXF at correct physical size', async () => {
            // Test with a mock DXF that simulates ADLER.DXF dimensions
            // ADLER.DXF is reportedly 186.2mm wide
            const mockADLERDxf = `0
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
186.2
21
0
0
ENDSEC
0
EOF`;

            const drawing = await parseDXF(mockADLERDxf);

            // Verify units are detected as mm
            expect(drawing.units).toBe(Unit.MM);

            // Test with display units set to mm
            const physicalScaleMm = getPhysicalScaleFactor(
                drawing.units,
                Unit.MM
            );
            const zoomScale = 1.0; // 100% zoom
            const totalScaleMm = zoomScale * physicalScaleMm;

            // Drawing width in geometry units
            const drawingWidthMm = 186.2;

            // Physical pixels on screen when displayed as mm
            const physicalPixelsMm = drawingWidthMm * totalScaleMm;
            const physicalMmOnScreen = physicalPixelsMm / (96 / 25.4);

            // Should be exactly 186.2mm on screen when displayed as mm
            expect(physicalMmOnScreen).toBeCloseTo(186.2, 1);

            // Test with display units set to inches
            const physicalScaleInch = getPhysicalScaleFactor(
                drawing.units,
                Unit.INCH
            );
            const totalScaleInch = zoomScale * physicalScaleInch;

            const physicalPixelsInch = drawingWidthMm * totalScaleInch;
            const physicalInchesOnScreen = physicalPixelsInch / 96;

            // Should be exactly 186.2 inches on screen when displayed as inches
            expect(physicalInchesOnScreen).toBeCloseTo(186.2, 1);
        });

        it('should scale drawing size based on display unit setting', async () => {
            // Test that switching display units changes physical size appropriately
            const mockDxf = `0
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
CIRCLE
10
50
20
50
40
10
0
ENDSEC
0
EOF`;

            const drawing = await parseDXF(mockDxf);
            expect(drawing.units).toBe(Unit.MM);

            const circleDiameterMm = 20;
            const zoomScale = 1.0;

            // When displayed as mm: 20 units → 20mm on screen
            const physicalScaleMm = getPhysicalScaleFactor(
                drawing.units,
                Unit.MM
            );
            const totalScaleMm = zoomScale * physicalScaleMm;
            const mmPixels = circleDiameterMm * totalScaleMm;
            const mmOnScreen = mmPixels / (96 / 25.4);
            expect(mmOnScreen).toBeCloseTo(20, 1);

            // When displayed as inches: 20 units → 20" on screen
            const physicalScaleInch = getPhysicalScaleFactor(
                drawing.units,
                Unit.INCH
            );
            const totalScaleInch = zoomScale * physicalScaleInch;
            const inchPixels = circleDiameterMm * totalScaleInch;
            const inchesOnScreen = inchPixels / 96;
            expect(inchesOnScreen).toBeCloseTo(20, 1);

            // Inch display should be much larger than mm display
            expect(inchPixels).toBeGreaterThan(mmPixels);
        });

        it('should handle inch-based DXF files correctly', async () => {
            // Test with inch-based geometry
            const mockInchDxf = `0
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
2.5
21
0
0
ENDSEC
0
EOF`;

            const drawing = await parseDXF(mockInchDxf);
            expect(drawing.units).toBe(Unit.INCH);

            const drawingWidthInches = 2.5;
            const zoomScale = 1.0;

            // When displayed as inches: 2.5 units → 2.5" on screen
            const physicalScaleInch = getPhysicalScaleFactor(
                drawing.units,
                Unit.INCH
            );
            const totalScaleInch = zoomScale * physicalScaleInch;
            const inchPixels = drawingWidthInches * totalScaleInch;
            const inchesOnScreen = inchPixels / 96;
            expect(inchesOnScreen).toBeCloseTo(2.5, 2);

            // When displayed as mm: 2.5 units → 2.5mm on screen
            const physicalScaleMm = getPhysicalScaleFactor(
                drawing.units,
                Unit.MM
            );
            const totalScaleMm = zoomScale * physicalScaleMm;
            const mmPixels = drawingWidthInches * totalScaleMm;
            const mmOnScreen = mmPixels / (96 / 25.4);
            expect(mmOnScreen).toBeCloseTo(2.5, 2);
        });
    });

    describe('Zoom factor testing', () => {
        it('should scale physical size proportionally with zoom', async () => {
            const mockDxf = `0
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
100
21
0
0
ENDSEC
0
EOF`;

            const drawing = await parseDXF(mockDxf);
            const drawingWidthMm = 100;

            // Test different zoom levels with mm display
            const zoomLevels = [0.5, 1.0, 1.5, 2.0];

            zoomLevels.forEach((zoom) => {
                const physicalScale = getPhysicalScaleFactor(
                    drawing.units,
                    Unit.MM
                );
                const totalScale = zoom * physicalScale;
                const pixelsOnScreen = drawingWidthMm * totalScale;
                const mmOnScreen = pixelsOnScreen / (96 / 25.4);
                const expectedMmOnScreen = drawingWidthMm * zoom;

                expect(mmOnScreen).toBeCloseTo(expectedMmOnScreen, 1);
            });

            // Test with inch display - should be much larger at same zoom
            const zoom100 = 1.0;
            const physicalScaleInch = getPhysicalScaleFactor(
                drawing.units,
                Unit.INCH
            );
            const totalScaleInch = zoom100 * physicalScaleInch;
            const pixelsOnScreenInch = drawingWidthMm * totalScaleInch;
            const inchesOnScreen = pixelsOnScreenInch / 96;

            // Should be 100 inches on screen (geometry values interpreted as inches)
            expect(inchesOnScreen).toBeCloseTo(100, 1);
        });
    });

    describe('Drawing bounds physical size', () => {
        it('should calculate correct physical dimensions from drawing bounds', async () => {
            const mockDxf = `0
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
10
20
20
11
110
21
70
0
ENDSEC
0
EOF`;

            const drawing = await parseDXF(mockDxf);

            // Drawing bounds should be from (10,20) to (110,70)
            const drawingWidth = drawing.bounds.max.x - drawing.bounds.min.x; // 100 units
            const drawingHeight = drawing.bounds.max.y - drawing.bounds.min.y; // 50 units

            expect(drawingWidth).toBeCloseTo(100, 1);
            expect(drawingHeight).toBeCloseTo(50, 1);

            // Test with mm display: 100 units → 100mm on screen at 100% zoom
            const physicalScaleMm = getPhysicalScaleFactor(
                drawing.units,
                Unit.MM
            );
            const zoomScale = 1.0;
            const totalScaleMm = zoomScale * physicalScaleMm;

            const widthPixelsMm = drawingWidth * totalScaleMm;
            const heightPixelsMm = drawingHeight * totalScaleMm;

            const widthMmOnScreen = widthPixelsMm / (96 / 25.4);
            const heightMmOnScreen = heightPixelsMm / (96 / 25.4);

            expect(widthMmOnScreen).toBeCloseTo(100, 1);
            expect(heightMmOnScreen).toBeCloseTo(50, 1);

            // Test with inch display: 100 units → 100" on screen at 100% zoom
            const physicalScaleInch = getPhysicalScaleFactor(
                drawing.units,
                Unit.INCH
            );
            const totalScaleInch = zoomScale * physicalScaleInch;

            const widthPixelsInch = drawingWidth * totalScaleInch;
            const heightPixelsInch = drawingHeight * totalScaleInch;

            const widthInchesOnScreen = widthPixelsInch / 96;
            const heightInchesOnScreen = heightPixelsInch / 96;

            expect(widthInchesOnScreen).toBeCloseTo(100, 1);
            expect(heightInchesOnScreen).toBeCloseTo(50, 1);

            // Inch display should be much larger than mm display
            expect(widthPixelsInch).toBeGreaterThan(widthPixelsMm);
            expect(heightPixelsInch).toBeGreaterThan(heightPixelsMm);
        });
    });
});
