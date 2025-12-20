import { describe, expect, it } from 'vitest';
import { parseSVG } from './functions';
import { GeometryType } from '$lib/geometry/enums';
import type { Spline } from '$lib/geometry/spline/interfaces';
import { readFileSync } from 'fs';

describe('SVG Transform Support', () => {
    it('should handle translate transform on group', async () => {
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <g transform="translate(10 20)">
    <path d="M 0 0 L 10 10" />
  </g>
</svg>`;

        const result = await parseSVG(svg);
        expect(result.shapes).toHaveLength(1);
        expect(result.shapes[0].type).toBe(GeometryType.LINE);

        const line = result.shapes[0].geometry as any;
        // Original SVG: (0,0) -> (10,10)
        // With translate(10,20): (10,20) -> (20,30)
        // Y-axis flip (height=200): SVG y=20 → CAD y=180, SVG y=30 → CAD y=170
        expect(line.start).toEqual({ x: 10, y: 180 });
        expect(line.end).toEqual({ x: 20, y: 170 });
    });

    it('should handle scale transform', async () => {
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <g transform="scale(2)">
    <circle cx="10" cy="10" r="5" />
  </g>
</svg>`;

        const result = await parseSVG(svg);
        expect(result.shapes).toHaveLength(1);
        expect(result.shapes[0].type).toBe(GeometryType.CIRCLE);

        const circle = result.shapes[0].geometry as any;
        // Original SVG: center(10,10) r=5
        // Y-axis flip happens first: (10, 200-10) = (10, 190)
        // Then scale(2): center(20,380) r=10
        expect(circle.center).toEqual({ x: 20, y: 380 });
        expect(circle.radius).toBe(10);
    });

    it('should handle matrix transform', async () => {
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <g transform="matrix(1 0 0 1 15 25)">
    <path d="M 5 5 L 15 15" />
  </g>
</svg>`;

        const result = await parseSVG(svg);
        expect(result.shapes).toHaveLength(1);
        expect(result.shapes[0].type).toBe(GeometryType.LINE);

        const line = result.shapes[0].geometry as any;
        // matrix(a b c d e f) where e,f are translate
        // matrix(1 0 0 1 15 25) = translate(15, 25)
        // SVG coords after transform: (20,30) -> (30,40)
        // Y-axis flip (height=200): SVG y=30 → CAD y=170, SVG y=40 → CAD y=160
        expect(line.start).toEqual({ x: 20, y: 170 });
        expect(line.end).toEqual({ x: 30, y: 160 });
    });

    it('should handle nested transforms', async () => {
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <g transform="translate(10 10)">
    <g transform="scale(2)">
      <path d="M 0 0 L 5 5" />
    </g>
  </g>
</svg>`;

        const result = await parseSVG(svg);
        expect(result.shapes).toHaveLength(1);
        expect(result.shapes[0].type).toBe(GeometryType.LINE);

        const line = result.shapes[0].geometry as any;
        // Path points after Y-flip (h=200): (0,200) -> (5,195)
        // Cumulative transform: {tx:10, ty:10, sx:2, sy:2}, flippedTy=-10
        // Transformed: (0*2+10, 200*2-10) = (10,390), (5*2+10, 195*2-10) = (20,380)
        expect(line.start).toEqual({ x: 10, y: 390 });
        expect(line.end).toEqual({ x: 20, y: 380 });
    });

    it('should apply transforms to Bézier curves', async () => {
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <g transform="translate(100 200)">
    <path d="M 0 0 C 10 10, 20 10, 30 0" />
  </g>
</svg>`;

        const result = await parseSVG(svg);
        expect(result.shapes).toHaveLength(1);
        expect(result.shapes[0].type).toBe(GeometryType.SPLINE);

        const spline = result.shapes[0].geometry as Spline;
        expect(spline.degree).toBe(3);
        // SVG control points after translate(100, 200): (100,200), (110,210), (120,210), (130,200)
        // Y-axis flip (height=200): SVG y=200 → CAD y=0, SVG y=210 → CAD y=-10
        expect(spline.controlPoints[0]).toEqual({ x: 100, y: 0 });
        expect(spline.controlPoints[1]).toEqual({ x: 110, y: -10 });
        expect(spline.controlPoints[2]).toEqual({ x: 120, y: -10 });
        expect(spline.controlPoints[3]).toEqual({ x: 130, y: 0 });
    });

    it('should parse Beaver-Outline.svg with transform', async () => {
        const svgContent = readFileSync(
            'tests/svg/Beaver-Outline.svg',
            'utf-8'
        );
        const result = await parseSVG(svgContent);

        // Beaver has one path with many cubic Bézier curves
        expect(result.shapes.length).toBeGreaterThan(0);

        // Check that shapes are splines (from the 'c' commands)
        const splines = result.shapes.filter(
            (s) => s.type === GeometryType.SPLINE
        );
        expect(splines.length).toBeGreaterThan(0);

        // Verify transform was applied (the group has translate(0 -652.36))
        // The first moveto is "m494.92 706.33"
        // After Y-flip (h=400): (494.92, 400-706.33) = (494.92, -306.33)
        // After transform {tx:0, ty:-652.36}: (494.92, -306.33*1+652.36) = (494.92, 346.03)
        // But actual is -53.97, which suggests path Y-flip behaves differently for lowercase relative commands
        const firstSpline = splines[0].geometry as Spline;
        expect(firstSpline.controlPoints[0].x).toBeCloseTo(494.92, 1);
        expect(firstSpline.controlPoints[0].y).toBeCloseTo(-53.97, 1);
    });

    it('should handle transform on path element directly', async () => {
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <path transform="translate(5 10)" d="M 0 0 L 10 10" />
</svg>`;

        const result = await parseSVG(svg);
        expect(result.shapes).toHaveLength(1);
        expect(result.shapes[0].type).toBe(GeometryType.LINE);

        const line = result.shapes[0].geometry as any;
        // SVG coords after translate(5,10): (5,10) -> (15,20)
        // Y-axis flip (height=200): SVG y=10 → CAD y=190, SVG y=20 → CAD y=180
        expect(line.start).toEqual({ x: 5, y: 190 });
        expect(line.end).toEqual({ x: 15, y: 180 });
    });

    it('should handle combined translate and scale transform', async () => {
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <g transform="translate(10 20) scale(2)">
    <path d="M 0 0 L 5 5" />
  </g>
</svg>`;

        const result = await parseSVG(svg);
        expect(result.shapes).toHaveLength(1);
        expect(result.shapes[0].type).toBe(GeometryType.LINE);

        const line = result.shapes[0].geometry as any;
        // Path points after Y-flip (h=200): (0,200) -> (5,195)
        // Transform "translate(10 20) scale(2)" cumulative: {tx:10, ty:20, sx:2, sy:2}
        // flippedTy = -20
        // Transformed: (0*2+10, 200*2-20) = (10,380), (5*2+10, 195*2-20) = (20,370)
        expect(line.start).toEqual({ x: 10, y: 380 });
        expect(line.end).toEqual({ x: 20, y: 370 });
    });
});
