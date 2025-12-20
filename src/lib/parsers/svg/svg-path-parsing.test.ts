import { describe, expect, it } from 'vitest';
import { parseSVG } from './functions';
import { GeometryType } from '$lib/geometry/enums';
import type { Line } from '$lib/geometry/line/interfaces';
import { readFileSync } from 'fs';

describe('SVG Path Parsing', () => {
    it('should parse path with absolute moveto and lineto', async () => {
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <path d="M 10 10 L 50 50" />
</svg>`;

        const result = await parseSVG(svg);
        expect(result.shapes.length).toBeGreaterThan(0);
        expect(result.shapes.every((s) => s.type === GeometryType.LINE)).toBe(
            true
        );

        const line = result.shapes[0].geometry as Line;
        // Y-axis flip: SVG y=10 → CAD y=190, SVG y=50 → CAD y=150 (height=200)
        expect(line.start).toEqual({ x: 10, y: 190 });
        expect(line.end).toEqual({ x: 50, y: 150 });
    });

    it('should parse path with multiple lineto commands', async () => {
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <path d="M 0 0 L 10 0 L 10 10 L 0 10" />
</svg>`;

        const result = await parseSVG(svg);
        expect(result.shapes.length).toBe(3);
        expect(result.shapes.every((s) => s.type === GeometryType.LINE)).toBe(
            true
        );
    });

    it('should parse path with closepath command', async () => {
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <path d="M 10 10 L 50 10 L 50 50 Z" />
</svg>`;

        const result = await parseSVG(svg);
        expect(result.shapes.length).toBe(3);

        // Verify closing segment
        const lastLine = result.shapes[result.shapes.length - 1]
            .geometry as Line;
        const firstLine = result.shapes[0].geometry as Line;
        expect(lastLine.end).toEqual(firstLine.start);
    });

    it('should parse path with horizontal lineto', async () => {
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <path d="M 10 20 H 50" />
</svg>`;

        const result = await parseSVG(svg);
        expect(result.shapes).toHaveLength(1);

        const line = result.shapes[0].geometry as Line;
        // Y-axis flip: SVG y=20 → CAD y=180 (height=200)
        expect(line.start).toEqual({ x: 10, y: 180 });
        expect(line.end).toEqual({ x: 50, y: 180 });
    });

    it('should parse path with vertical lineto', async () => {
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <path d="M 10 20 V 60" />
</svg>`;

        const result = await parseSVG(svg);
        expect(result.shapes).toHaveLength(1);

        const line = result.shapes[0].geometry as Line;
        // Y-axis flip: SVG y=20 → CAD y=180, SVG y=60 → CAD y=140 (height=200)
        expect(line.start).toEqual({ x: 10, y: 180 });
        expect(line.end).toEqual({ x: 10, y: 140 });
    });

    it('should parse path with mixed H and V commands', async () => {
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <path d="M 0 0 H 50 V 50 H 0 V 0" />
</svg>`;

        const result = await parseSVG(svg);
        expect(result.shapes).toHaveLength(4);
        expect(result.shapes.every((s) => s.type === GeometryType.LINE)).toBe(
            true
        );
    });

    it('should parse square path', async () => {
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <path d="M 10 10 L 60 10 L 60 60 L 10 60 Z" />
</svg>`;

        const result = await parseSVG(svg);
        expect(result.shapes).toHaveLength(4);

        // Verify square corners - Y-axis flip: SVG y=10 → CAD y=190, SVG y=60 → CAD y=140 (height=200)
        const lines = result.shapes.map((s) => s.geometry as Line);
        expect(lines[0].start).toEqual({ x: 10, y: 190 });
        expect(lines[0].end).toEqual({ x: 60, y: 190 });
        expect(lines[1].start).toEqual({ x: 60, y: 190 });
        expect(lines[1].end).toEqual({ x: 60, y: 140 });
        expect(lines[2].start).toEqual({ x: 60, y: 140 });
        expect(lines[2].end).toEqual({ x: 10, y: 140 });
        expect(lines[3].start).toEqual({ x: 10, y: 140 });
        expect(lines[3].end).toEqual({ x: 10, y: 190 });
    });

    it('should parse triangle path', async () => {
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <path d="M 50 10 L 90 90 L 10 90 Z" />
</svg>`;

        const result = await parseSVG(svg);
        expect(result.shapes).toHaveLength(3);

        // Y-axis flip: SVG y=10 → CAD y=190, SVG y=90 → CAD y=110 (height=200)
        const lines = result.shapes.map((s) => s.geometry as Line);
        expect(lines[0].start).toEqual({ x: 50, y: 190 });
        expect(lines[0].end).toEqual({ x: 90, y: 110 });
        expect(lines[1].start).toEqual({ x: 90, y: 110 });
        expect(lines[1].end).toEqual({ x: 10, y: 110 });
        expect(lines[2].start).toEqual({ x: 10, y: 110 });
        expect(lines[2].end).toEqual({ x: 50, y: 190 });
    });

    it('should handle path with multiple move commands', async () => {
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <path d="M 0 0 L 10 10 M 20 20 L 30 30" />
</svg>`;

        const result = await parseSVG(svg);
        expect(result.shapes).toHaveLength(2);

        const line1 = result.shapes[0].geometry as Line;
        const line2 = result.shapes[1].geometry as Line;

        // Y-axis flip: SVG y=0 → CAD y=200, SVG y=10 → CAD y=190, etc. (height=200)
        expect(line1.start).toEqual({ x: 0, y: 200 });
        expect(line1.end).toEqual({ x: 10, y: 190 });
        expect(line2.start).toEqual({ x: 20, y: 180 });
        expect(line2.end).toEqual({ x: 30, y: 170 });
    });

    it('should handle path with no moveto (only lineto)', async () => {
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <path d="L 50 50" />
</svg>`;

        const result = await parseSVG(svg);
        // Should start from (0,0) by default
        expect(result.shapes.length).toBeGreaterThan(0);
    });

    it('should handle closepath when current point equals start point', async () => {
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <path d="M 10 10 L 50 10 L 50 50 L 10 50 L 10 10 Z" />
</svg>`;

        const result = await parseSVG(svg);
        // Z command should not add redundant closing line
        expect(result.shapes).toHaveLength(4);
    });

    it('should handle path with floating point coordinates', async () => {
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <path d="M 10.5 20.25 L 30.75 40.125" />
</svg>`;

        const result = await parseSVG(svg);
        expect(result.shapes).toHaveLength(1);

        const line = result.shapes[0].geometry as Line;
        // Y-axis flip: SVG y=20.25 → CAD y=179.75, SVG y=40.125 → CAD y=159.875 (height=200)
        expect(line.start).toEqual({ x: 10.5, y: 179.75 });
        expect(line.end).toEqual({ x: 30.75, y: 159.875 });
    });

    it('should handle path with negative coordinates', async () => {
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <path d="M -10 -20 L 10 20" />
</svg>`;

        const result = await parseSVG(svg);
        expect(result.shapes).toHaveLength(1);

        const line = result.shapes[0].geometry as Line;
        // Y-axis flip: SVG y=-20 → CAD y=220, SVG y=20 → CAD y=180 (height=200)
        expect(line.start).toEqual({ x: -10, y: 220 });
        expect(line.end).toEqual({ x: 10, y: 180 });
    });

    it('should handle complex multi-segment path', async () => {
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <path d="M 0 0 H 100 V 100 H 0 V 0 M 20 20 L 80 20 L 80 80 L 20 80 Z" />
</svg>`;

        const result = await parseSVG(svg);
        expect(result.shapes.length).toBeGreaterThan(4);
        expect(result.shapes.every((s) => s.type === GeometryType.LINE)).toBe(
            true
        );
    });

    it('should parse path from test fixture', async () => {
        const svgContent = readFileSync('tests/svg/simple-path.svg', 'utf-8');
        const result = await parseSVG(svgContent);

        expect(result.shapes.length).toBeGreaterThan(0);
        expect(result.shapes.every((s) => s.type === GeometryType.LINE)).toBe(
            true
        );
    });

    it('should handle empty path with only moveto', async () => {
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <path d="M 10 10" />
</svg>`;

        const result = await parseSVG(svg);
        // No drawing commands, should result in no shapes
        expect(result.shapes).toHaveLength(0);
    });

    it('should preserve layer assignment for path elements', async () => {
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <g id="paths">
    <path d="M 0 0 L 10 10" />
    <path d="M 20 20 L 30 30" />
  </g>
</svg>`;

        const result = await parseSVG(svg);
        expect(result.shapes.length).toBeGreaterThan(0);
        expect(result.shapes.every((s) => s.layer === 'paths')).toBe(true);
    });

    // Test arc commands
    it('should parse circular arc command (A)', async () => {
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <path d="M 10 50 A 40 40 0 0 1 50 10" />
</svg>`;

        const result = await parseSVG(svg);
        expect(result.shapes).toHaveLength(1);
        expect(result.shapes[0].type).toBe(GeometryType.ARC);
    });

    it('should parse elliptical arc as tessellated lines', async () => {
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <path d="M 10 50 A 40 30 0 0 1 50 10" />
</svg>`;

        const result = await parseSVG(svg);
        expect(result.shapes.length).toBeGreaterThan(1);
        expect(result.shapes.every((s) => s.type === GeometryType.LINE)).toBe(
            true
        );
    });

    // Test cubic Bézier commands
    it('should parse cubic Bézier curve (C)', async () => {
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <path d="M 10 10 C 20 20, 40 20, 50 10" />
</svg>`;

        const result = await parseSVG(svg);
        expect(result.shapes).toHaveLength(1);
        expect(result.shapes[0].type).toBe(GeometryType.SPLINE);

        const spline = result.shapes[0].geometry as any;
        expect(spline.controlPoints).toHaveLength(4);
        expect(spline.degree).toBe(3);
        expect(spline.knots).toEqual([0, 0, 0, 0, 1, 1, 1, 1]);
        // Y-axis flip: SVG y=10 → CAD y=190, SVG y=20 → CAD y=180 (height=200)
        expect(spline.controlPoints[0]).toEqual({ x: 10, y: 190 });
        expect(spline.controlPoints[1]).toEqual({ x: 20, y: 180 });
        expect(spline.controlPoints[2]).toEqual({ x: 40, y: 180 });
        expect(spline.controlPoints[3]).toEqual({ x: 50, y: 190 });
    });

    it('should parse smooth cubic Bézier curve (S)', async () => {
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <path d="M 10 10 C 20 20, 40 20, 50 10 S 80 0, 90 10" />
</svg>`;

        const result = await parseSVG(svg);
        expect(result.shapes).toHaveLength(2);
        expect(result.shapes.every((s) => s.type === GeometryType.SPLINE)).toBe(
            true
        );

        const spline2 = result.shapes[1].geometry as any;
        expect(spline2.controlPoints).toHaveLength(4);
        expect(spline2.degree).toBe(3);
        // First control point should be reflection of previous curve's second control point
        // Y-axis flip: SVG y=10 → CAD y=190 (height=200)
        expect(spline2.controlPoints[0]).toEqual({ x: 50, y: 190 });
    });

    it('should parse smooth cubic Bézier without previous curve', async () => {
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <path d="M 10 10 S 40 20, 50 10" />
</svg>`;

        const result = await parseSVG(svg);
        expect(result.shapes).toHaveLength(1);
        expect(result.shapes[0].type).toBe(GeometryType.SPLINE);

        const spline = result.shapes[0].geometry as any;
        // First control point should equal start point when no previous curve
        // Y-axis flip: SVG y=10 → CAD y=190 (height=200)
        expect(spline.controlPoints[0]).toEqual({ x: 10, y: 190 });
        expect(spline.controlPoints[1]).toEqual({ x: 10, y: 190 });
    });

    // Test quadratic Bézier commands
    it('should parse quadratic Bézier curve (Q)', async () => {
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <path d="M 10 10 Q 30 30, 50 10" />
</svg>`;

        const result = await parseSVG(svg);
        expect(result.shapes).toHaveLength(1);
        expect(result.shapes[0].type).toBe(GeometryType.SPLINE);

        const spline = result.shapes[0].geometry as any;
        expect(spline.controlPoints).toHaveLength(3);
        expect(spline.degree).toBe(2);
        expect(spline.knots).toEqual([0, 0, 0, 1, 1, 1]);
        // Y-axis flip: SVG y=10 → CAD y=190, SVG y=30 → CAD y=170 (height=200)
        expect(spline.controlPoints[0]).toEqual({ x: 10, y: 190 });
        expect(spline.controlPoints[1]).toEqual({ x: 30, y: 170 });
        expect(spline.controlPoints[2]).toEqual({ x: 50, y: 190 });
    });

    it('should parse smooth quadratic Bézier curve (T)', async () => {
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <path d="M 10 10 Q 30 30, 50 10 T 90 10" />
</svg>`;

        const result = await parseSVG(svg);
        expect(result.shapes).toHaveLength(2);
        expect(result.shapes.every((s) => s.type === GeometryType.SPLINE)).toBe(
            true
        );

        const spline2 = result.shapes[1].geometry as any;
        expect(spline2.controlPoints).toHaveLength(3);
        expect(spline2.degree).toBe(2);
        // Control point should be reflection of previous curve's control point
        // Y-axis flip: SVG y=10 → CAD y=190 (height=200)
        expect(spline2.controlPoints[0]).toEqual({ x: 50, y: 190 });
    });

    it('should parse smooth quadratic Bézier without previous curve', async () => {
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <path d="M 10 10 T 50 10" />
</svg>`;

        const result = await parseSVG(svg);
        expect(result.shapes).toHaveLength(1);
        expect(result.shapes[0].type).toBe(GeometryType.SPLINE);

        const spline = result.shapes[0].geometry as any;
        // Control point should equal start point when no previous curve
        // Y-axis flip: SVG y=10 → CAD y=190 (height=200)
        expect(spline.controlPoints[0]).toEqual({ x: 10, y: 190 });
        expect(spline.controlPoints[1]).toEqual({ x: 10, y: 190 });
    });

    it('should handle mixed line and curve commands', async () => {
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <path d="M 0 0 L 10 10 C 20 20, 30 20, 40 10 Q 50 0, 60 10 L 70 10" />
</svg>`;

        const result = await parseSVG(svg);
        expect(result.shapes.length).toBe(4);
        expect(result.shapes[0].type).toBe(GeometryType.LINE);
        expect(result.shapes[1].type).toBe(GeometryType.SPLINE);
        expect(result.shapes[2].type).toBe(GeometryType.SPLINE);
        expect(result.shapes[3].type).toBe(GeometryType.LINE);
    });

    it('should reset lastControlPoint after line commands', async () => {
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <path d="M 0 0 C 10 10, 20 10, 30 0 L 40 0 S 60 10, 70 0" />
</svg>`;

        const result = await parseSVG(svg);
        expect(result.shapes.length).toBe(3);

        const spline2 = result.shapes[2].geometry as any;
        // After line command, S should use current point as reflected control point
        // Y-axis flip: SVG y=0 → CAD y=200 (height=200)
        expect(spline2.controlPoints[0]).toEqual({ x: 40, y: 200 });
        expect(spline2.controlPoints[1]).toEqual({ x: 40, y: 200 });
    });
});
