import { describe, expect, it } from 'vitest';
import { parseSVG } from './functions';
import { GeometryType } from '$lib/geometry/enums';
import type { Spline } from '$lib/geometry/spline/interfaces';
import { readFileSync } from 'fs';

describe('SVG Cubic Bézier Curves', () => {
    it('should parse simple cubic Bézier curve from file', async () => {
        const svgContent = readFileSync('tests/svg/cubic-bezier.svg', 'utf-8');
        const result = await parseSVG(svgContent);

        // Find the simple-cubic path
        const simpleCubic = result.shapes.find(
            (s) => s.type === GeometryType.SPLINE
        );
        expect(simpleCubic).toBeDefined();

        if (simpleCubic) {
            const spline = simpleCubic.geometry as Spline;
            expect(spline.degree).toBe(3);
            expect(spline.controlPoints).toHaveLength(4);
            // Y coordinates flipped: SVG y=80 -> CAD y=120, SVG y=10 -> CAD y=190
            expect(spline.controlPoints[0]).toEqual({ x: 10, y: 120 });
            expect(spline.controlPoints[1]).toEqual({ x: 40, y: 190 });
            expect(spline.controlPoints[2]).toEqual({ x: 65, y: 190 });
            expect(spline.controlPoints[3]).toEqual({ x: 95, y: 120 });
        }
    });

    it('should parse multiple cubic Bézier curves in sequence', async () => {
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <path d="M 10 100 C 20 120, 40 120, 50 100 C 60 80, 80 80, 90 100" id="multi-cubic"/>
</svg>`;

        const result = await parseSVG(svg);
        const splines = result.shapes.filter(
            (s) => s.type === GeometryType.SPLINE
        );
        expect(splines).toHaveLength(2);

        // First cubic curve
        const spline1 = splines[0].geometry as Spline;
        expect(spline1.degree).toBe(3);
        expect(spline1.controlPoints).toHaveLength(4);
        // Y flipped: y=100->100, y=120->80
        expect(spline1.controlPoints[0]).toEqual({ x: 10, y: 100 });
        expect(spline1.controlPoints[1]).toEqual({ x: 20, y: 80 });
        expect(spline1.controlPoints[2]).toEqual({ x: 40, y: 80 });
        expect(spline1.controlPoints[3]).toEqual({ x: 50, y: 100 });

        // Second cubic curve
        const spline2 = splines[1].geometry as Spline;
        expect(spline2.degree).toBe(3);
        expect(spline2.controlPoints).toHaveLength(4);
        // Y flipped: y=100->100, y=80->120
        expect(spline2.controlPoints[0]).toEqual({ x: 50, y: 100 });
        expect(spline2.controlPoints[1]).toEqual({ x: 60, y: 120 });
        expect(spline2.controlPoints[2]).toEqual({ x: 80, y: 120 });
        expect(spline2.controlPoints[3]).toEqual({ x: 90, y: 100 });
    });

    it('should parse smooth cubic Bézier (S command) from file', async () => {
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <path d="M 110 80 C 140 10, 165 10, 195 80 S 220 150, 250 80" id="smooth-cubic"/>
</svg>`;

        const result = await parseSVG(svg);
        const splines = result.shapes.filter(
            (s) => s.type === GeometryType.SPLINE
        );
        expect(splines).toHaveLength(2);

        // Second spline should have reflected control point
        const spline2 = splines[1].geometry as Spline;
        expect(spline2.degree).toBe(3);
        expect(spline2.controlPoints).toHaveLength(4);
        // Y flipped: SVG y=80 -> CAD y=120
        expect(spline2.controlPoints[0]).toEqual({ x: 195, y: 120 });
        // First control point should be reflection of previous curve's second control point
        // Previous cp2 SVG (165, 10) -> CAD (165, 190), end SVG (195, 80) -> CAD (195, 120)
        // Reflection: (195, 120) + ((195, 120) - (165, 190)) = (225, 50)
        expect(spline2.controlPoints[1]).toEqual({ x: 225, y: 50 });
        // SVG y=150 -> CAD y=50
        expect(spline2.controlPoints[2]).toEqual({ x: 220, y: 50 });
        expect(spline2.controlPoints[3]).toEqual({ x: 250, y: 120 });
    });

    it('should parse closed path with cubic Bézier', async () => {
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <path d="M 10 150 C 20 130, 40 130, 50 150 C 60 170, 40 170, 30 150 Z" id="closed-cubic"/>
</svg>`;

        const result = await parseSVG(svg);
        const splines = result.shapes.filter(
            (s) => s.type === GeometryType.SPLINE
        );
        expect(splines.length).toBeGreaterThanOrEqual(2);

        // Verify closure
        const lastShape = result.shapes[result.shapes.length - 1];
        const firstSpline = splines[0].geometry as Spline;

        if (lastShape.type === GeometryType.SPLINE) {
            const lastSpline = lastShape.geometry as Spline;
            const lastPoint =
                lastSpline.controlPoints[lastSpline.controlPoints.length - 1];
            const firstPoint = firstSpline.controlPoints[0];
            expect(lastPoint).toEqual(firstPoint);
        } else if (lastShape.type === GeometryType.LINE) {
            const lastLine = lastShape.geometry as any;
            const firstPoint = firstSpline.controlPoints[0];
            expect(lastLine.end).toEqual(firstPoint);
        }
    });

    it('should parse mixed path with lines and cubic Bézier', async () => {
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <path d="M 100 150 L 120 150 C 130 130, 150 130, 160 150 L 180 150" id="mixed-cubic"/>
</svg>`;

        const result = await parseSVG(svg);
        expect(result.shapes).toHaveLength(3);

        expect(result.shapes[0].type).toBe(GeometryType.LINE);
        expect(result.shapes[1].type).toBe(GeometryType.SPLINE);
        expect(result.shapes[2].type).toBe(GeometryType.LINE);

        const spline = result.shapes[1].geometry as Spline;
        expect(spline.degree).toBe(3);
        // Y flipped: y=150->50, y=130->70
        expect(spline.controlPoints[0]).toEqual({ x: 120, y: 50 });
        expect(spline.controlPoints[1]).toEqual({ x: 130, y: 70 });
        expect(spline.controlPoints[2]).toEqual({ x: 150, y: 70 });
        expect(spline.controlPoints[3]).toEqual({ x: 160, y: 50 });
    });

    it('should have correct knot vectors for cubic Bézier curves', async () => {
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <path d="M 10 10 C 20 20, 40 20, 50 10" />
</svg>`;

        const result = await parseSVG(svg);
        const spline = result.shapes[0].geometry as Spline;

        // Cubic Bézier should have degree 3, 4 control points
        // Knot vector should be [0,0,0,0,1,1,1,1] (clamped)
        expect(spline.degree).toBe(3);
        expect(spline.controlPoints).toHaveLength(4);
        expect(spline.knots).toEqual([0, 0, 0, 0, 1, 1, 1, 1]);
    });

    it('should handle relative cubic Bézier commands (c)', async () => {
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <path d="M 10 80 c 30 -70, 55 -70, 85 0" />
</svg>`;

        const result = await parseSVG(svg);
        expect(result.shapes).toHaveLength(1);
        expect(result.shapes[0].type).toBe(GeometryType.SPLINE);

        const spline = result.shapes[0].geometry as Spline;
        expect(spline.degree).toBe(3);
        expect(spline.controlPoints).toHaveLength(4);
        // Relative: c 30 -70, 55 -70, 85 0 from M 10 80
        // Absolute SVG: cp1=(40,10), cp2=(65,10), end=(95,80)
        // Y flipped: y=80->120, y=10->190
        expect(spline.controlPoints[0]).toEqual({ x: 10, y: 120 });
        expect(spline.controlPoints[1]).toEqual({ x: 40, y: 190 });
        expect(spline.controlPoints[2]).toEqual({ x: 65, y: 190 });
        expect(spline.controlPoints[3]).toEqual({ x: 95, y: 120 });
    });

    it('should handle relative smooth cubic Bézier commands (s)', async () => {
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <path d="M 10 10 C 20 20, 40 20, 50 10 s 30 -10, 40 0" />
</svg>`;

        const result = await parseSVG(svg);
        const splines = result.shapes.filter(
            (s) => s.type === GeometryType.SPLINE
        );
        expect(splines).toHaveLength(2);

        const spline2 = splines[1].geometry as Spline;
        expect(spline2.degree).toBe(3);
        expect(spline2.controlPoints).toHaveLength(4);
        // Y flipped: y=10->190
        expect(spline2.controlPoints[0]).toEqual({ x: 50, y: 190 });
        // Relative: s 30 -10, 40 0 from end of C (50, 10)
        // Absolute SVG: cp2=(80,0), end=(90,10)
        // Y flipped: y=0->200
        expect(spline2.controlPoints[2]).toEqual({ x: 80, y: 200 });
        expect(spline2.controlPoints[3]).toEqual({ x: 90, y: 190 });
    });
});

describe('SVG Quadratic Bézier Curves', () => {
    it('should parse simple quadratic Bézier curve from file', async () => {
        const svgContent = readFileSync(
            'tests/svg/quadratic-bezier.svg',
            'utf-8'
        );
        const result = await parseSVG(svgContent);

        // Find the simple-quadratic path
        const simpleQuadratic = result.shapes.find(
            (s) => s.type === GeometryType.SPLINE
        );
        expect(simpleQuadratic).toBeDefined();

        if (simpleQuadratic) {
            const spline = simpleQuadratic.geometry as Spline;
            expect(spline.degree).toBe(2);
            expect(spline.controlPoints).toHaveLength(3);
            // Y flipped: y=80->120, y=10->190
            expect(spline.controlPoints[0]).toEqual({ x: 10, y: 120 });
            expect(spline.controlPoints[1]).toEqual({ x: 50, y: 190 });
            expect(spline.controlPoints[2]).toEqual({ x: 90, y: 120 });
        }
    });

    it('should parse multiple quadratic Bézier curves in sequence', async () => {
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <path d="M 10 100 Q 30 120, 50 100 Q 70 80, 90 100" id="multi-quadratic"/>
</svg>`;

        const result = await parseSVG(svg);
        const splines = result.shapes.filter(
            (s) => s.type === GeometryType.SPLINE
        );
        expect(splines).toHaveLength(2);

        // First quadratic curve
        const spline1 = splines[0].geometry as Spline;
        expect(spline1.degree).toBe(2);
        expect(spline1.controlPoints).toHaveLength(3);
        // Y flipped: y=100->100, y=120->80
        expect(spline1.controlPoints[0]).toEqual({ x: 10, y: 100 });
        expect(spline1.controlPoints[1]).toEqual({ x: 30, y: 80 });
        expect(spline1.controlPoints[2]).toEqual({ x: 50, y: 100 });

        // Second quadratic curve
        const spline2 = splines[1].geometry as Spline;
        expect(spline2.degree).toBe(2);
        expect(spline2.controlPoints).toHaveLength(3);
        // Y flipped: y=100->100, y=80->120
        expect(spline2.controlPoints[0]).toEqual({ x: 50, y: 100 });
        expect(spline2.controlPoints[1]).toEqual({ x: 70, y: 120 });
        expect(spline2.controlPoints[2]).toEqual({ x: 90, y: 100 });
    });

    it('should parse smooth quadratic Bézier (T command) from file', async () => {
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <path d="M 110 80 Q 140 10, 170 80 T 230 80" id="smooth-quadratic"/>
</svg>`;

        const result = await parseSVG(svg);
        const splines = result.shapes.filter(
            (s) => s.type === GeometryType.SPLINE
        );
        expect(splines).toHaveLength(2);

        // Second spline should have reflected control point
        const spline2 = splines[1].geometry as Spline;
        expect(spline2.degree).toBe(2);
        expect(spline2.controlPoints).toHaveLength(3);
        // Y flipped: y=80->120
        expect(spline2.controlPoints[0]).toEqual({ x: 170, y: 120 });
        // Control point should be reflection of previous curve's control point
        // Previous cp SVG (140, 10) -> CAD (140, 190), end SVG (170, 80) -> CAD (170, 120)
        // Reflection: (170, 120) + ((170, 120) - (140, 190)) = (200, 50)
        expect(spline2.controlPoints[1]).toEqual({ x: 200, y: 50 });
        expect(spline2.controlPoints[2]).toEqual({ x: 230, y: 120 });
    });

    it('should parse closed path with quadratic Bézier', async () => {
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <path d="M 10 150 Q 30 130, 50 150 Q 30 170, 10 150 Z" id="closed-quadratic"/>
</svg>`;

        const result = await parseSVG(svg);
        const splines = result.shapes.filter(
            (s) => s.type === GeometryType.SPLINE
        );
        expect(splines.length).toBeGreaterThanOrEqual(2);

        // Verify closure
        const lastShape = result.shapes[result.shapes.length - 1];
        const firstSpline = splines[0].geometry as Spline;

        if (lastShape.type === GeometryType.SPLINE) {
            const lastSpline = lastShape.geometry as Spline;
            const lastPoint =
                lastSpline.controlPoints[lastSpline.controlPoints.length - 1];
            const firstPoint = firstSpline.controlPoints[0];
            expect(lastPoint).toEqual(firstPoint);
        } else if (lastShape.type === GeometryType.LINE) {
            const lastLine = lastShape.geometry as any;
            const firstPoint = firstSpline.controlPoints[0];
            expect(lastLine.end).toEqual(firstPoint);
        }
    });

    it('should parse mixed path with lines and quadratic Bézier', async () => {
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <path d="M 100 150 L 120 150 Q 140 130, 160 150 L 180 150" id="mixed-quadratic"/>
</svg>`;

        const result = await parseSVG(svg);
        expect(result.shapes).toHaveLength(3);

        expect(result.shapes[0].type).toBe(GeometryType.LINE);
        expect(result.shapes[1].type).toBe(GeometryType.SPLINE);
        expect(result.shapes[2].type).toBe(GeometryType.LINE);

        const spline = result.shapes[1].geometry as Spline;
        expect(spline.degree).toBe(2);
        // Y flipped: y=150->50, y=130->70
        expect(spline.controlPoints[0]).toEqual({ x: 120, y: 50 });
        expect(spline.controlPoints[1]).toEqual({ x: 140, y: 70 });
        expect(spline.controlPoints[2]).toEqual({ x: 160, y: 50 });
    });

    it('should have correct knot vectors for quadratic Bézier curves', async () => {
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <path d="M 10 10 Q 30 30, 50 10" />
</svg>`;

        const result = await parseSVG(svg);
        const spline = result.shapes[0].geometry as Spline;

        // Quadratic Bézier should have degree 2, 3 control points
        // Knot vector should be [0,0,0,1,1,1] (clamped)
        expect(spline.degree).toBe(2);
        expect(spline.controlPoints).toHaveLength(3);
        expect(spline.knots).toEqual([0, 0, 0, 1, 1, 1]);
    });

    it('should handle relative quadratic Bézier commands (q)', async () => {
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <path d="M 10 80 q 40 -70, 80 0" />
</svg>`;

        const result = await parseSVG(svg);
        expect(result.shapes).toHaveLength(1);
        expect(result.shapes[0].type).toBe(GeometryType.SPLINE);

        const spline = result.shapes[0].geometry as Spline;
        expect(spline.degree).toBe(2);
        expect(spline.controlPoints).toHaveLength(3);
        // Relative: q 40 -70, 80 0 from M 10 80
        // Absolute SVG: cp=(50,10), end=(90,80)
        // Y flipped: y=80->120, y=10->190
        expect(spline.controlPoints[0]).toEqual({ x: 10, y: 120 });
        expect(spline.controlPoints[1]).toEqual({ x: 50, y: 190 });
        expect(spline.controlPoints[2]).toEqual({ x: 90, y: 120 });
    });

    it('should handle relative smooth quadratic Bézier commands (t)', async () => {
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <path d="M 10 10 Q 30 30, 50 10 t 40 0" />
</svg>`;

        const result = await parseSVG(svg);
        const splines = result.shapes.filter(
            (s) => s.type === GeometryType.SPLINE
        );
        expect(splines).toHaveLength(2);

        const spline2 = splines[1].geometry as Spline;
        expect(spline2.degree).toBe(2);
        expect(spline2.controlPoints).toHaveLength(3);
        // Y flipped: y=10->190
        expect(spline2.controlPoints[0]).toEqual({ x: 50, y: 190 });
        // Relative: t 40 0 from end of Q (50, 10)
        // Absolute SVG: end=(90,10)
        // Y flipped: y=10->190
        expect(spline2.controlPoints[2]).toEqual({ x: 90, y: 190 });
    });

    it('should handle T command without previous Q command', async () => {
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <path d="M 10 10 T 50 10" />
</svg>`;

        const result = await parseSVG(svg);
        expect(result.shapes).toHaveLength(1);
        expect(result.shapes[0].type).toBe(GeometryType.SPLINE);

        const spline = result.shapes[0].geometry as Spline;
        expect(spline.degree).toBe(2);
        // When no previous Q/T, control point should equal start point
        // Y flipped: y=10->190
        expect(spline.controlPoints[0]).toEqual({ x: 10, y: 190 });
        expect(spline.controlPoints[1]).toEqual({ x: 10, y: 190 });
        expect(spline.controlPoints[2]).toEqual({ x: 50, y: 190 });
    });
});

describe('SVG Bézier Curves - Edge Cases', () => {
    it('should handle alternating cubic and quadratic Bézier curves', async () => {
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <path d="M 0 0 C 10 10, 20 10, 30 0 Q 40 -10, 50 0 C 60 10, 70 10, 80 0" />
</svg>`;

        const result = await parseSVG(svg);
        expect(result.shapes).toHaveLength(3);

        expect(result.shapes[0].type).toBe(GeometryType.SPLINE);
        expect(result.shapes[1].type).toBe(GeometryType.SPLINE);
        expect(result.shapes[2].type).toBe(GeometryType.SPLINE);

        const spline1 = result.shapes[0].geometry as Spline;
        const spline2 = result.shapes[1].geometry as Spline;
        const spline3 = result.shapes[2].geometry as Spline;

        expect(spline1.degree).toBe(3);
        expect(spline2.degree).toBe(2);
        expect(spline3.degree).toBe(3);
    });

    it('should handle S command after Q command', async () => {
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <path d="M 0 0 Q 20 20, 40 0 S 80 -20, 100 0" />
</svg>`;

        const result = await parseSVG(svg);
        expect(result.shapes).toHaveLength(2);

        // First should be quadratic
        expect(result.shapes[0].type).toBe(GeometryType.SPLINE);
        const spline1 = result.shapes[0].geometry as Spline;
        expect(spline1.degree).toBe(2);

        // Second should be cubic (S command creates cubic curve)
        expect(result.shapes[1].type).toBe(GeometryType.SPLINE);
        const spline2 = result.shapes[1].geometry as Spline;
        expect(spline2.degree).toBe(3);
    });

    it('should handle T command after C command', async () => {
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <path d="M 0 0 C 10 10, 20 10, 30 0 T 60 0" />
</svg>`;

        const result = await parseSVG(svg);
        expect(result.shapes).toHaveLength(2);

        // First should be cubic
        expect(result.shapes[0].type).toBe(GeometryType.SPLINE);
        const spline1 = result.shapes[0].geometry as Spline;
        expect(spline1.degree).toBe(3);

        // Second should be quadratic (T command creates quadratic curve)
        expect(result.shapes[1].type).toBe(GeometryType.SPLINE);
        const spline2 = result.shapes[1].geometry as Spline;
        expect(spline2.degree).toBe(2);
    });

    it('should handle multiple consecutive S commands', async () => {
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <path d="M 0 0 C 10 10, 20 10, 30 0 S 50 -10, 60 0 S 80 10, 90 0" />
</svg>`;

        const result = await parseSVG(svg);
        const splines = result.shapes.filter(
            (s) => s.type === GeometryType.SPLINE
        );
        expect(splines).toHaveLength(3);

        splines.forEach((shape) => {
            const spline = shape.geometry as Spline;
            expect(spline.degree).toBe(3);
        });
    });

    it('should handle multiple consecutive T commands', async () => {
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <path d="M 0 0 Q 15 20, 30 0 T 60 0 T 90 0" />
</svg>`;

        const result = await parseSVG(svg);
        const splines = result.shapes.filter(
            (s) => s.type === GeometryType.SPLINE
        );
        expect(splines).toHaveLength(3);

        splines.forEach((shape) => {
            const spline = shape.geometry as Spline;
            expect(spline.degree).toBe(2);
        });
    });
});
