import { describe, expect, it } from 'vitest';
import { parseSVG } from './functions';
import { readFileSync } from 'fs';
import { GeometryType } from '$lib/geometry/enums';
import { Unit } from '$lib/config/units/units';
import type { Line } from '$lib/geometry/line/interfaces';
import type { Circle } from '$lib/geometry/circle/interfaces';
import type { DxfPolyline } from '$lib/geometry/dxf-polyline/interfaces';

describe('SVG Parser Integration Tests', () => {
    it('should parse simple-shapes.svg correctly', async () => {
        const svgContent = readFileSync('tests/svg/simple-shapes.svg', 'utf-8');
        const result = await parseSVG(svgContent);

        expect(result).toBeDefined();
        expect(result.units).toBe(Unit.NONE);
        expect(result.fileName).toBeDefined();
        expect(result.shapes.length).toBe(3);

        // Should contain line, circle, and rect (as polyline)
        const lineShapes = result.shapes.filter(
            (s) => s.type === GeometryType.LINE
        );
        const circleShapes = result.shapes.filter(
            (s) => s.type === GeometryType.CIRCLE
        );
        const polylineShapes = result.shapes.filter(
            (s) => s.type === GeometryType.POLYLINE
        );

        expect(lineShapes.length).toBe(1);
        expect(circleShapes.length).toBe(1);
        expect(polylineShapes.length).toBe(1);
    });

    it('should parse with-layers.svg and preserve layer information', async () => {
        const svgContent = readFileSync('tests/svg/with-layers.svg', 'utf-8');
        const result = await parseSVG(svgContent);

        expect(result.shapes.length).toBeGreaterThan(0);

        // Check layer1 shapes
        const layer1Shapes = result.shapes.filter((s) => s.layer === 'layer1');
        expect(layer1Shapes.length).toBe(2); // line and circle

        // Check layer2 shapes
        const layer2Shapes = result.shapes.filter((s) => s.layer === 'layer2');
        expect(layer2Shapes.length).toBe(1); // rect (as polyline)
    });

    it('should parse no-layers.svg and assign default layer', async () => {
        const svgContent = readFileSync('tests/svg/no-layers.svg', 'utf-8');
        const result = await parseSVG(svgContent);

        expect(result.shapes.length).toBe(2);
        expect(result.shapes.every((s) => s.layer === '0')).toBe(true);
    });

    it('should parse simple-path.svg', async () => {
        const svgContent = readFileSync('tests/svg/simple-path.svg', 'utf-8');
        const result = await parseSVG(svgContent);

        expect(result.shapes.length).toBeGreaterThan(0);
        // Path should be decomposed into line segments
        expect(result.shapes.every((s) => s.type === GeometryType.LINE)).toBe(
            true
        );
    });

    it('should preserve exact coordinates from SVG', async () => {
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <line x1="10" y1="20" x2="30" y2="40" />
</svg>`;

        const result = await parseSVG(svg);
        expect(result.shapes).toHaveLength(1);

        const line = result.shapes[0].geometry as Line;
        // Y flipped: y=20->180, y=40->160
        expect(line.start).toEqual({ x: 10, y: 180 });
        expect(line.end).toEqual({ x: 30, y: 160 });
    });

    it('should handle floating point coordinates', async () => {
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <circle cx="50.5" cy="60.25" r="25.75" />
</svg>`;

        const result = await parseSVG(svg);
        expect(result.shapes).toHaveLength(1);

        const circle = result.shapes[0].geometry as Circle;
        // Y flipped: y=60.25->139.75
        expect(circle.center).toEqual({ x: 50.5, y: 139.75 });
        expect(circle.radius).toBe(25.75);
    });

    it('should handle multiple shapes on same layer', async () => {
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <g id="shapes">
    <line x1="0" y1="0" x2="10" y2="10" />
    <line x1="10" y1="10" x2="20" y2="20" />
    <circle cx="50" cy="50" r="20" />
    <rect x="100" y="100" width="30" height="40" />
  </g>
</svg>`;

        const result = await parseSVG(svg);
        expect(result.shapes.length).toBe(4);
        expect(result.shapes.every((s) => s.layer === 'shapes')).toBe(true);
    });

    it('should generate unique IDs for all shapes', async () => {
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <circle cx="10" cy="10" r="5" />
  <circle cx="20" cy="20" r="5" />
  <circle cx="30" cy="30" r="5" />
</svg>`;

        const result = await parseSVG(svg);
        expect(result.shapes).toHaveLength(3);

        const ids = result.shapes.map((s) => s.id);
        const uniqueIds = new Set(ids);
        expect(uniqueIds.size).toBe(3); // All IDs should be unique
    });

    it('should handle deeply nested groups', async () => {
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <g id="level1">
    <line x1="0" y1="0" x2="10" y2="10" />
    <g id="level2">
      <circle cx="20" cy="20" r="10" />
      <g id="level3">
        <rect x="50" y="50" width="20" height="20" />
      </g>
    </g>
  </g>
</svg>`;

        const result = await parseSVG(svg);
        expect(result.shapes.length).toBe(3);

        const level1Shapes = result.shapes.filter((s) => s.layer === 'level1');
        const level2Shapes = result.shapes.filter((s) => s.layer === 'level2');
        const level3Shapes = result.shapes.filter((s) => s.layer === 'level3');

        expect(level1Shapes.length).toBe(1);
        expect(level2Shapes.length).toBe(1);
        expect(level3Shapes.length).toBe(1);
    });

    it('should handle all basic shape types together', async () => {
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400">
  <line x1="0" y1="0" x2="100" y2="0" />
  <circle cx="50" cy="50" r="20" />
  <ellipse cx="150" cy="150" rx="30" ry="15" />
  <rect x="200" y="200" width="50" height="30" />
  <polyline points="300,300 320,300 320,320" />
  <polygon points="0,100 50,100 25,150" />
</svg>`;

        const result = await parseSVG(svg);
        expect(result.shapes.length).toBe(6);

        const types = result.shapes.map((s) => s.type);
        expect(types).toContain(GeometryType.LINE);
        expect(types).toContain(GeometryType.CIRCLE);
        expect(types).toContain(GeometryType.ELLIPSE);
        expect(types).toContain(GeometryType.POLYLINE);
    });

    it('should handle rect as closed polyline with correct points', async () => {
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <rect x="10" y="20" width="50" height="30" />
</svg>`;

        const result = await parseSVG(svg);
        expect(result.shapes).toHaveLength(1);
        expect(result.shapes[0].type).toBe(GeometryType.POLYLINE);

        const polyline = result.shapes[0].geometry as DxfPolyline;
        expect(polyline.closed).toBe(true);
        expect(polyline.shapes).toHaveLength(4);

        // Verify rectangle corners
        // Y flipped: y=20->180, y=50->150
        const lines = polyline.shapes.map((s) => s.geometry as Line);
        expect(lines[0].start).toEqual({ x: 10, y: 180 });
        expect(lines[0].end).toEqual({ x: 60, y: 180 });
        expect(lines[1].start).toEqual({ x: 60, y: 180 });
        expect(lines[1].end).toEqual({ x: 60, y: 150 });
        expect(lines[2].start).toEqual({ x: 60, y: 150 });
        expect(lines[2].end).toEqual({ x: 10, y: 150 });
        expect(lines[3].start).toEqual({ x: 10, y: 150 });
        expect(lines[3].end).toEqual({ x: 10, y: 180 });
    });

    it('should handle polyline vs polygon (open vs closed)', async () => {
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <polyline points="0,0 50,0 50,50" />
  <polygon points="100,100 150,100 150,150" />
</svg>`;

        const result = await parseSVG(svg);
        expect(result.shapes).toHaveLength(2);

        // First is polyline (open)
        const polyline = result.shapes[0].geometry as DxfPolyline;
        expect(polyline.closed).toBe(false);
        expect(polyline.shapes).toHaveLength(2);

        // Second is polygon (closed)
        const polygon = result.shapes[1].geometry as DxfPolyline;
        expect(polygon.closed).toBe(true);
        expect(polygon.shapes).toHaveLength(3); // 3 sides including closing segment
    });

    it('should return DrawingData with correct structure', async () => {
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <circle cx="50" cy="50" r="25" />
</svg>`;

        const result = await parseSVG(svg);

        // Verify DrawingData structure
        expect(result).toHaveProperty('shapes');
        expect(result).toHaveProperty('units');
        expect(result).toHaveProperty('fileName');

        expect(Array.isArray(result.shapes)).toBe(true);
        expect(result.units).toBe(Unit.NONE);
        expect(typeof result.fileName).toBe('string');
    });

    it('should handle ellipse with rx > ry (horizontal major axis)', async () => {
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <ellipse cx="100" cy="100" rx="40" ry="20" />
</svg>`;

        const result = await parseSVG(svg);
        expect(result.shapes).toHaveLength(1);
        expect(result.shapes[0].type).toBe(GeometryType.ELLIPSE);
    });

    it('should handle ellipse with ry > rx (vertical major axis)', async () => {
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <ellipse cx="100" cy="100" rx="20" ry="40" />
</svg>`;

        const result = await parseSVG(svg);
        expect(result.shapes).toHaveLength(1);
        expect(result.shapes[0].type).toBe(GeometryType.ELLIPSE);
    });
});
