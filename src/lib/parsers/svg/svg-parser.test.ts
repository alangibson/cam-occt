import { describe, expect, it } from 'vitest';
import { parseSVG } from './functions';
import { readFileSync } from 'fs';
import { GeometryType } from '$lib/geometry/enums';
import { Unit } from '$lib/config/units/units';
import type { Ellipse } from '$lib/geometry/ellipse/interfaces';
import type { DxfPolyline } from '$lib/geometry/dxf-polyline/interfaces';

describe('SVG Parser', () => {
    it('should export parseSVG function', () => {
        expect(typeof parseSVG).toBe('function');
    });

    it('should handle empty SVG content gracefully', async () => {
        const emptySVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
</svg>`;

        const result = await parseSVG(emptySVG);
        expect(result).toBeDefined();
        expect(result.shapes).toBeDefined();
        expect(Array.isArray(result.shapes)).toBe(true);
        expect(result.shapes).toHaveLength(0);
    });

    it('should parse line elements', async () => {
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <line x1="10" y1="20" x2="30" y2="40" />
</svg>`;

        const result = await parseSVG(svg);
        expect(result.shapes).toHaveLength(1);
        expect(result.shapes[0].type).toBe(GeometryType.LINE);
        // Y flipped: y=20->180, y=40->160
        expect(result.shapes[0].geometry).toEqual({
            start: { x: 10, y: 180 },
            end: { x: 30, y: 160 },
        });
    });

    it('should parse circle elements', async () => {
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <circle cx="50" cy="60" r="25" />
</svg>`;

        const result = await parseSVG(svg);
        expect(result.shapes).toHaveLength(1);
        expect(result.shapes[0].type).toBe(GeometryType.CIRCLE);
        // Y flipped: y=60->140
        expect(result.shapes[0].geometry).toEqual({
            center: { x: 50, y: 140 },
            radius: 25,
        });
    });

    it('should parse ellipse elements', async () => {
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <ellipse cx="100" cy="100" rx="40" ry="20" />
</svg>`;

        const result = await parseSVG(svg);
        expect(result.shapes).toHaveLength(1);
        expect(result.shapes[0].type).toBe(GeometryType.ELLIPSE);
        const ellipse = result.shapes[0].geometry as Ellipse;
        // Y flipped: y=100->100 (center of viewBox)
        expect(ellipse.center).toEqual({ x: 100, y: 100 });
        expect(ellipse.majorAxisEndpoint).toEqual({
            x: 40,
            y: 0,
        });
        expect(ellipse.minorToMajorRatio).toBe(0.5);
    });

    it('should parse rect elements as closed polylines', async () => {
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
    });

    it('should parse polyline elements', async () => {
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <polyline points="10,10 50,10 50,50" />
</svg>`;

        const result = await parseSVG(svg);
        expect(result.shapes).toHaveLength(1);
        expect(result.shapes[0].type).toBe(GeometryType.POLYLINE);
        const polyline = result.shapes[0].geometry as DxfPolyline;
        expect(polyline.closed).toBe(false);
        expect(polyline.shapes).toHaveLength(2);
    });

    it('should parse polygon elements as closed polylines', async () => {
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <polygon points="10,10 50,10 50,50" />
</svg>`;

        const result = await parseSVG(svg);
        expect(result.shapes).toHaveLength(1);
        expect(result.shapes[0].type).toBe(GeometryType.POLYLINE);
        const polyline = result.shapes[0].geometry as DxfPolyline;
        expect(polyline.closed).toBe(true);
        expect(polyline.shapes).toHaveLength(3);
    });

    it('should parse simple path with line commands', async () => {
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <path d="M 10 10 L 50 10 L 50 50 Z" />
</svg>`;

        const result = await parseSVG(svg);
        expect(result.shapes.length).toBeGreaterThan(0);
        // Path creates individual line segments
        expect(result.shapes.every((s) => s.type === GeometryType.LINE)).toBe(
            true
        );
    });

    it('should parse real SVG file with simple shapes', async () => {
        const svgContent = readFileSync('tests/svg/simple-shapes.svg', 'utf-8');
        const result = await parseSVG(svgContent);

        expect(result.shapes.length).toBeGreaterThan(0);
        expect(result.units).toBe(Unit.NONE);
    });

    it('should parse real SVG file with simple path', async () => {
        const svgContent = readFileSync('tests/svg/simple-path.svg', 'utf-8');
        const result = await parseSVG(svgContent);

        expect(result.shapes.length).toBeGreaterThan(0);
    });

    it('should throw error for invalid SVG', async () => {
        const invalidSVG = 'not an svg';

        await expect(parseSVG(invalidSVG)).rejects.toThrow();
    });

    it('should throw error for malformed XML', async () => {
        const malformedSVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <line x1="10" y1="20"
</svg>`;

        await expect(parseSVG(malformedSVG)).rejects.toThrow();
    });
});
