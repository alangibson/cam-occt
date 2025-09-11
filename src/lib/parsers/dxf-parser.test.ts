import { describe, it, expect } from 'vitest';
import { parseDXF } from './dxf-parser';
import { readFileSync } from 'fs';
import { parseString } from 'dxf';
import type { DXFEntity } from 'dxf';

describe('DXF Parser', () => {
    it('should be able to import the DXF parser module without errors', async () => {
        expect(typeof parseDXF).toBe('function');
    });

    it('should handle empty DXF content gracefully', async () => {
        // Test with minimal DXF that won't have entities
        const emptyDXF = `0
SECTION
2
ENTITIES
0
ENDSEC
0
EOF`;

        // This should parse successfully and return empty shapes array
        const result = await parseDXF(emptyDXF);
        expect(result).toBeDefined();
        expect(result.shapes).toBeDefined();
        expect(Array.isArray(result.shapes)).toBe(true);
        expect(result.shapes).toHaveLength(0);
    });

    it('should parse ARC entities from real DXF file', async () => {
        const dxfContent = readFileSync('tests/dxf/2.dxf', 'utf-8');

        const drawing = await parseDXF(dxfContent);

        // Should have parsed some shapes
        expect(drawing.shapes.length).toBeGreaterThan(0);

        // Should contain ARC entities
        const arcShapes = drawing.shapes.filter((s) => s.type === 'arc');

        expect(arcShapes.length).toBeGreaterThan(0);
    });

    it('should debug DXF parsing with raw library output', async () => {
        const dxfContent = readFileSync('tests/dxf/2.dxf', 'utf-8');

        // Test the raw DXF parsing library directly
        const parsed = parseString(dxfContent);

        expect(parsed.entities).toBeDefined();
        expect(parsed.entities!.length).toBeGreaterThan(0);
    });

    it('should debug SPLINE parsing with raw library output', async () => {
        const dxfContent = readFileSync(
            'tests/dxf/polygons/nested-splines.dxf',
            'utf-8'
        );

        // Test the raw DXF parsing library directly
        const parsed = parseString(dxfContent);

        const splineEntity = parsed.entities?.find(
            (e: DXFEntity) => e.type === 'SPLINE'
        );
        if (splineEntity) {
            // Spline entity found - could add validation here
        }

        expect(parsed.entities).toBeDefined();
        expect(parsed.entities!.length).toBeGreaterThan(0);
    });

    it('should parse CIRCLE entities from real DXF file', async () => {
        const dxfContent = readFileSync('tests/dxf/2.dxf', 'utf-8');

        // Test the raw DXF parsing library directly
        const parsed = parseString(dxfContent);

        const drawing = await parseDXF(dxfContent);

        // Should contain CIRCLE entities
        const circleShapes = drawing.shapes.filter((s) => s.type === 'circle');

        if (parsed.entities?.some((e: DXFEntity) => e.type === 'CIRCLE')) {
            expect(circleShapes.length).toBeGreaterThan(0);
        }
    });

    it('should parse SPLINE entities from real DXF file', async () => {
        const dxfContent = readFileSync(
            'tests/dxf/polygons/nested-splines.dxf',
            'utf-8'
        );

        const drawing = await parseDXF(dxfContent);

        // Should have parsed some shapes
        expect(drawing.shapes.length).toBeGreaterThan(0);

        // Should contain SPLINE entities (might be converted to other shapes)
        const splineShapes = drawing.shapes.filter((s) => s.type === 'spline');
        const polylineShapes = drawing.shapes.filter(
            (s) => s.type === 'polyline'
        );

        // Either should have splines or converted polylines
        expect(splineShapes.length + polylineShapes.length).toBeGreaterThan(0);
    });
});
