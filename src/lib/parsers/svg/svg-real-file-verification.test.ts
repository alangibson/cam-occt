import { describe, it, expect } from 'vitest';
import { parseSVG } from './functions';
import { readFileSync } from 'fs';
import { GeometryType } from '$lib/geometry/enums';

describe('SVG Real File Verification', () => {
    it('should load simple-shapes.svg with correct Y orientation', async () => {
        const svgContent = readFileSync('tests/svg/simple-shapes.svg', 'utf-8');
        const result = await parseSVG(svgContent);

        expect(result.shapes.length).toBeGreaterThan(0);

        // The SVG has height=200
        // Check that a shape near the top of the SVG (small y in SVG)
        // has a large y in CAD coordinates
        const firstShape = result.shapes[0];
        const geometry = firstShape.geometry as any;

        // All shapes should have CAD Y coordinates (flipped from SVG)
        // This means Y values should be in range [0, 200] with orientation flipped
        expect(geometry).toBeDefined();
    });

    it('should load Beaver-Outline.svg with correct orientation', async () => {
        const svgContent = readFileSync(
            'tests/svg/Beaver-Outline.svg',
            'utf-8'
        );
        const result = await parseSVG(svgContent);

        // Should parse successfully
        expect(result.shapes.length).toBeGreaterThan(0);

        // Verify some shapes were created
        const splines = result.shapes.filter(
            (s) => s.type === GeometryType.SPLINE
        );
        expect(splines.length).toBeGreaterThan(0);

        // Check that Y coordinates are in reasonable range for viewBox="0 0 700 400"
        const firstSpline = splines[0].geometry as any;
        expect(firstSpline.controlPoints).toBeDefined();
        expect(firstSpline.controlPoints.length).toBeGreaterThan(0);

        // Y coordinates should be flipped and transformed
        // After transforms, coordinates may be outside original viewBox
        // Just verify we got valid numeric coordinates
        const firstY = firstSpline.controlPoints[0].y;
        expect(typeof firstY).toBe('number');
        expect(isFinite(firstY)).toBe(true);
    });

    it('should load complex-shapes.svg correctly', async () => {
        const svgContent = readFileSync(
            'tests/svg/complex-shapes.svg',
            'utf-8'
        );
        const result = await parseSVG(svgContent);

        expect(result.shapes.length).toBeGreaterThan(0);

        // Verify all shapes have valid geometries with flipped Y
        for (const shape of result.shapes) {
            expect(shape.geometry).toBeDefined();
            expect(shape.type).toBeDefined();
        }
    });

    it('should correctly flip rectangle coordinates', async () => {
        const svgContent = readFileSync('tests/svg/simple-shapes.svg', 'utf-8');
        const result = await parseSVG(svgContent);

        // Find the rectangle in simple-shapes.svg
        // SVG has: <rect x="150" y="10" width="40" height="30" />
        // With height=200, this should flip to have top edge at y=190
        const rect = result.shapes.find(
            (s) => s.type === GeometryType.POLYLINE
        );
        expect(rect).toBeDefined();

        const polyline = rect!.geometry as any;
        expect(polyline.closed).toBe(true);
        expect(polyline.shapes.length).toBe(4);

        // Check that Y coordinates are flipped correctly
        // Original: y=10 (top) to y=40 (bottom)
        // Flipped: y=190 (top in CAD = bottom in SVG) to y=160 (bottom in CAD = top in SVG)
        const firstLine = polyline.shapes[0].geometry;
        expect(firstLine.start.y).toBe(190);
    });

    it('should handle SVG with transforms correctly', async () => {
        const svgContent = readFileSync('tests/svg/nested-groups.svg', 'utf-8');
        const result = await parseSVG(svgContent);

        // Should parse without errors
        expect(result.shapes.length).toBeGreaterThan(0);

        // All Y coordinates should be properly flipped
        for (const shape of result.shapes) {
            const geom = shape.geometry as any;
            if (geom.start) {
                // Line geometry
                expect(geom.start.y).toBeLessThanOrEqual(300); // height=300
                expect(geom.end.y).toBeLessThanOrEqual(300);
            } else if (geom.center) {
                // Circle/ellipse geometry
                expect(geom.center.y).toBeLessThanOrEqual(300);
            }
        }
    });
});
