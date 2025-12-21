import { describe, it, expect } from 'vitest';
import { File, FileType } from './classes';
import { Unit } from '$lib/config/units/units';
import { ImportUnitSetting } from '$lib/config/settings/enums';

describe('File class', () => {
    describe('constructor', () => {
        it('should create a File instance with correct properties', () => {
            const file = new File('test.dxf', FileType.DXF, 'file contents');
            expect(file.name).toBe('test.dxf');
            expect(file.type).toBe(FileType.DXF);
            expect(file.contents).toBe('file contents');
        });
    });

    describe('getFileTypeFromName', () => {
        it('should detect DXF files', () => {
            expect(File.getFileTypeFromName('test.dxf')).toBe(FileType.DXF);
            expect(File.getFileTypeFromName('TEST.DXF')).toBe(FileType.DXF);
            expect(File.getFileTypeFromName('file.with.dots.dxf')).toBe(
                FileType.DXF
            );
        });

        it('should detect SVG files', () => {
            expect(File.getFileTypeFromName('test.svg')).toBe(FileType.SVG);
            expect(File.getFileTypeFromName('TEST.SVG')).toBe(FileType.SVG);
            expect(File.getFileTypeFromName('file.with.dots.svg')).toBe(
                FileType.SVG
            );
        });

        it('should return null for unsupported file types', () => {
            expect(File.getFileTypeFromName('test.txt')).toBe(null);
            expect(File.getFileTypeFromName('test.pdf')).toBe(null);
            expect(File.getFileTypeFromName('nodxf')).toBe(null);
        });
    });

    describe('getUnit', () => {
        it('should detect units from DXF file with mm units', async () => {
            // Minimal DXF with mm units ($INSUNITS = 4)
            const dxfContent = `0
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
ENDSEC
0
EOF`;

            const file = new File('test.dxf', FileType.DXF, dxfContent);
            const unit = await file.getUnit();
            expect(unit).toBe(Unit.MM);
        });

        it('should detect units from DXF file with inch units', async () => {
            // Minimal DXF with inch units ($INSUNITS = 1)
            const dxfContent = `0
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
ENDSEC
0
EOF`;

            const file = new File('test.dxf', FileType.DXF, dxfContent);
            const unit = await file.getUnit();
            expect(unit).toBe(Unit.INCH);
        });

        it('should return NONE for SVG files', async () => {
            const svgContent =
                '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"></svg>';
            const file = new File('test.svg', FileType.SVG, svgContent);
            const unit = await file.getUnit();
            expect(unit).toBe(Unit.NONE);
        });

        it('should cache parsed result on subsequent calls', async () => {
            const dxfContent = `0
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
ENDSEC
0
EOF`;

            const file = new File('test.dxf', FileType.DXF, dxfContent);
            const unit1 = await file.getUnit();
            const unit2 = await file.getUnit();
            expect(unit1).toBe(Unit.MM);
            expect(unit2).toBe(Unit.MM);
        });
    });

    describe('toDrawing', () => {
        it('should convert DXF with inch to mm using Automatic setting', async () => {
            // DXF with a 1-inch line (from 0,0 to 1,0) in inches
            const dxfContent = `0
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
8
0
10
0.0
20
0.0
11
1.0
21
0.0
0
ENDSEC
0
EOF`;

            const file = new File('test.dxf', FileType.DXF, dxfContent);
            const drawing = await file.toDrawing(
                Unit.MM,
                ImportUnitSetting.Automatic
            );

            expect(drawing.units).toBe(Unit.MM);
            expect(drawing.shapes.length).toBe(1);

            const line = drawing.shapes[0];
            expect(line.type).toBe('line');
            // 1 inch = 25.4 mm
            expect((line.geometry as any).end.x).toBeCloseTo(25.4, 1);
        });

        it('should convert DXF with mm to inch using Automatic setting', async () => {
            // DXF with a 25.4mm line (from 0,0 to 25.4,0) in mm
            const dxfContent = `0
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
8
0
10
0.0
20
0.0
11
25.4
21
0.0
0
ENDSEC
0
EOF`;

            const file = new File('test.dxf', FileType.DXF, dxfContent);
            const drawing = await file.toDrawing(
                Unit.INCH,
                ImportUnitSetting.Automatic
            );

            expect(drawing.units).toBe(Unit.INCH);
            expect(drawing.shapes.length).toBe(1);

            const line = drawing.shapes[0];
            expect(line.type).toBe('line');
            // 25.4 mm = 1 inch
            expect((line.geometry as any).end.x).toBeCloseTo(1.0, 3);
        });

        it('should not convert when units match using Application setting', async () => {
            // DXF with a 100mm line in mm
            const dxfContent = `0
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
8
0
10
0.0
20
0.0
11
100.0
21
0.0
0
ENDSEC
0
EOF`;

            const file = new File('test.dxf', FileType.DXF, dxfContent);
            const drawing = await file.toDrawing(
                Unit.MM,
                ImportUnitSetting.Application
            );

            expect(drawing.units).toBe(Unit.MM);
            expect(drawing.shapes.length).toBe(1);

            const line = drawing.shapes[0];
            expect((line.geometry as any).end.x).toBe(100.0);
        });

        it('should assume application units when file has NONE and using Automatic setting', async () => {
            const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
				<line x1="0" y1="0" x2="100" y2="100" />
			</svg>`;

            const file = new File('test.svg', FileType.SVG, svgContent);
            // File has NONE units, Automatic mode assumes application unit
            const drawing = await file.toDrawing(
                Unit.MM,
                ImportUnitSetting.Automatic
            );

            expect(drawing.units).toBe(Unit.MM);
            expect(drawing.shapes.length).toBeGreaterThan(0);
            // No conversion should happen since source and target are both MM
        });

        it('should force metric conversion using Metric setting', async () => {
            // DXF with inch units but we force it to be treated as mm
            const dxfContent = `0
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
8
0
10
0.0
20
0.0
11
25.4
21
0.0
0
ENDSEC
0
EOF`;

            const file = new File('test.dxf', FileType.DXF, dxfContent);
            // Force treat as metric, convert to inch
            const drawing = await file.toDrawing(
                Unit.INCH,
                ImportUnitSetting.Metric
            );

            expect(drawing.units).toBe(Unit.INCH);
            // 25.4mm = 1 inch
            const line = drawing.shapes[0];
            expect((line.geometry as any).end.x).toBeCloseTo(1.0, 3);
        });

        it('should force imperial conversion using Imperial setting', async () => {
            // DXF with mm units but we force it to be treated as inches
            const dxfContent = `0
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
8
0
10
0.0
20
0.0
11
1.0
21
0.0
0
ENDSEC
0
EOF`;

            const file = new File('test.dxf', FileType.DXF, dxfContent);
            // Force treat as imperial, convert to mm
            const drawing = await file.toDrawing(
                Unit.MM,
                ImportUnitSetting.Imperial
            );

            expect(drawing.units).toBe(Unit.MM);
            // 1 inch = 25.4mm
            const line = drawing.shapes[0];
            expect((line.geometry as any).end.x).toBeCloseTo(25.4, 1);
        });

        it('should set fileName on drawing', async () => {
            const dxfContent = `0
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
ENDSEC
0
EOF`;

            const file = new File('myfile.dxf', FileType.DXF, dxfContent);
            const drawing = await file.toDrawing(
                Unit.MM,
                ImportUnitSetting.Automatic
            );

            expect(drawing.fileName).toBe('myfile.dxf');
        });
    });
});
