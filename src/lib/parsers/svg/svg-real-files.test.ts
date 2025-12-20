import { describe, expect, it } from 'vitest';
import { parseSVG } from './functions';
import { GeometryType } from '$lib/geometry/enums';
import { readFileSync } from 'fs';

describe('SVG Parser - Real Files', () => {
    it('should parse Salt Lake Temple silhouette (complex paths)', async () => {
        const svgContent = readFileSync(
            'tests/svg/Salt-Lake-Temple-Silhouette.svg',
            'utf-8'
        );
        const result = await parseSVG(svgContent);

        expect(result.shapes.length).toBeGreaterThan(0);
        console.log(`Salt Lake Temple: ${result.shapes.length} shapes parsed`);

        // Should contain various geometry types
        const types = new Set(result.shapes.map((s) => s.type));
        console.log(`Geometry types found: ${Array.from(types).join(', ')}`);
    });

    it('should parse Australia outline (curves and lines)', async () => {
        const svgContent = readFileSync(
            'tests/svg/MrTim_Australia_Outline.svg',
            'utf-8'
        );
        const result = await parseSVG(svgContent);

        expect(result.shapes.length).toBeGreaterThan(0);
        console.log(`Australia: ${result.shapes.length} shapes parsed`);

        // Should contain various geometry types
        const types = new Set(result.shapes.map((s) => s.type));
        console.log(`Geometry types found: ${Array.from(types).join(', ')}`);
    });

    it('should parse cat outline', async () => {
        const svgContent = readFileSync(
            'tests/svg/themanwithoutsex-sitting-cat-outline.svg',
            'utf-8'
        );
        const result = await parseSVG(svgContent);

        expect(result.shapes.length).toBeGreaterThan(0);
        console.log(`Cat outline: ${result.shapes.length} shapes parsed`);

        // Should contain various geometry types
        const types = new Set(result.shapes.map((s) => s.type));
        console.log(`Geometry types found: ${Array.from(types).join(', ')}`);
    });

    it('should parse beaver outline', async () => {
        const svgContent = readFileSync(
            'tests/svg/Beaver-Outline.svg',
            'utf-8'
        );
        const result = await parseSVG(svgContent);

        expect(result.shapes.length).toBeGreaterThan(0);
        console.log(`Beaver: ${result.shapes.length} shapes parsed`);

        // Count geometry types
        const typeCount = result.shapes.reduce(
            (acc, s) => {
                acc[s.type] = (acc[s.type] || 0) + 1;
                return acc;
            },
            {} as Record<string, number>
        );
        console.log(`Geometry type breakdown:`, typeCount);

        // Should have splines (curves) not just lines
        const hasSplines = result.shapes.some(
            (s) => s.type === GeometryType.SPLINE
        );
        console.log(`Contains splines: ${hasSplines}`);
    });

    it('should preserve curve accuracy', async () => {
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <path d="M 10 80 C 40 10, 65 10, 95 80 S 150 150, 180 80" />
</svg>`;

        const result = await parseSVG(svg);

        // Should parse as 2 cubic Bézier splines
        expect(result.shapes).toHaveLength(2);
        expect(result.shapes.every((s) => s.type === GeometryType.SPLINE)).toBe(
            true
        );

        // Verify control points are preserved with Y-flip
        // ViewBox height=200, so: y_cad = 200 - y_svg
        const spline1 = result.shapes[0].geometry as any;
        expect(spline1.controlPoints).toHaveLength(4);
        expect(spline1.controlPoints[0]).toEqual({ x: 10, y: 120 }); // 200-80
        expect(spline1.controlPoints[1]).toEqual({ x: 40, y: 190 }); // 200-10
        expect(spline1.controlPoints[2]).toEqual({ x: 65, y: 190 }); // 200-10
        expect(spline1.controlPoints[3]).toEqual({ x: 95, y: 120 }); // 200-80
    });
});
