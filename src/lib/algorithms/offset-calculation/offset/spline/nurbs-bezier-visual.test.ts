import { describe, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { offsetSpline, splitVerbCurve, tessellateVerbCurve } from './spline';
import { OffsetDirection } from '$lib/algorithms/offset-calculation/offset/types';
import type { Point2D } from '$lib/types/geometry';
import verb from 'verb-nurbs';
import type { Spline } from '$lib/geometry/spline';

describe('NURBS Bezier Visual Tests', () => {
    it('should create visual test showing NURBS offset and Bezier splitting', () => {
        // Create a complex NURBS curve with multiple segments
        const complexNurbs: Spline = createComplexNurbs();

        // Offset the curve in both directions
        const outsetResult = offsetSpline(
            complexNurbs,
            15,
            OffsetDirection.OUTSET,
            0.1,
            5
        );
        const insetResult = offsetSpline(
            complexNurbs,
            15,
            OffsetDirection.INSET,
            0.1,
            5
        );

        if (!outsetResult.success || !insetResult.success) {
            throw new Error(
                `Failed to offset NURBS curve. Outset: ${outsetResult.success}, Inset: ${insetResult.success}`
            );
        }

        // Get the offset curves
        const outsetCurve = outsetResult.shapes[0].geometry as Spline;
        const insetCurve = insetResult.shapes[0].geometry as Spline;

        // Create verb curves and split into Bezier segments
        const originalVerbCurve = createVerbCurve(complexNurbs);
        const outsetVerbCurve = createVerbCurve(outsetCurve);
        const insetVerbCurve = createVerbCurve(insetCurve);

        const originalBeziers = splitVerbCurve(originalVerbCurve);
        const outsetBeziers = splitVerbCurve(outsetVerbCurve);
        const insetBeziers = splitVerbCurve(insetVerbCurve);

        // Generate SVG
        const svg = generateBezierSVG({
            original: {
                curve: complexNurbs,
                beziers: originalBeziers,
                color: '#0066cc',
                label: 'Original NURBS',
                shapeType: 'nurbs',
                controlPointCount: complexNurbs.controlPoints.length,
            },
            outset: {
                curve: outsetCurve,
                beziers: outsetBeziers,
                color: '#00aa00',
                label: 'Outset (+15)',
                shapeType: outsetResult.shapes[0].type,
            },
            inset: {
                curve: insetCurve,
                beziers: insetBeziers,
                color: '#cc0000',
                label: 'Inset (-15)',
                shapeType: insetResult.shapes[0].type,
            },
        });

        // Ensure output directory exists
        const outputDir = join(process.cwd(), 'tests', 'output', 'visual');
        mkdirSync(outputDir, { recursive: true });

        // Write SVG file
        const outputPath = join(outputDir, 'nurbs-bezier-splitting.svg');
        writeFileSync(outputPath, svg);
    });
});

/**
 * Creates a complex NURBS curve with multiple segments and varying curvature
 */
function createComplexNurbs(): Spline {
    return {
        controlPoints: [
            { x: 50, y: 200 }, // Start point
            { x: 100, y: 50 }, // Pull up
            { x: 200, y: 100 }, // Curve right
            { x: 250, y: 250 }, // Pull down
            { x: 350, y: 180 }, // Curve right again
            { x: 400, y: 80 }, // Pull up
            { x: 550, y: 220 }, // End with curve down
            { x: 600, y: 200 }, // End point (8 points total)
        ],
        // For 8 control points, degree 3: need 8+3+1=12 knots
        // Format: [0,0,0,0] + [internal knots] + [1,1,1,1] = 4+4+4=12
        knots: [0, 0, 0, 0, 0.2, 0.4, 0.6, 0.8, 1, 1, 1, 1], // 4 zeros + 4 internal + 4 ones = 12 total
        weights: [1, 1, 1, 1, 1, 1, 1, 1], // 8 weights
        degree: 3,
        fitPoints: [],
        closed: false,
    };
}

/**
 * Creates a verb NURBS curve from our Spline format
 */
function createVerbCurve(spline: Spline) {
    const controlPoints3D = spline.controlPoints.map(
        (p) => [p.x, p.y, 0] as [number, number, number]
    );

    return verb.geom.NurbsCurve.byKnotsControlPointsWeights(
        spline.degree,
        spline.knots,
        controlPoints3D,
        spline.weights
    );
}

interface CurveData {
    curve: Spline;
    beziers: Spline[];
    color: string;
    label: string;
    shapeType?: string;
    controlPointCount?: number;
}

interface SVGData {
    original: CurveData;
    outset: CurveData;
    inset: CurveData;
}

/**
 * Generates SVG showing NURBS curves and their Bezier decomposition
 */
function generateBezierSVG(data: SVGData): string {
    const width = 800;
    const height = 400;

    let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <!-- Background -->
  <rect width="${width}" height="${height}" fill="white" />
  
`;

    // Generate paths for each curve set
    [data.original, data.outset, data.inset].forEach((curveData) => {
        const { curve, beziers, color, label } = curveData;

        // Main curve path using tessellation for smooth rendering
        const verbCurve = createVerbCurve(curve);
        const tessellatedPoints = tessellateVerbCurve(verbCurve);
        const mainPath = generateSmoothPath(tessellatedPoints);

        svg += `  <!-- ${label} -->\n`;
        svg += `  <path d="${mainPath}" stroke="${color}" stroke-width="2" fill="none"/>\n`;

        // Individual Bezier segments using proper C and Q commands
        beziers.forEach((bezier) => {
            const bezierPath = generateBezierPath(bezier);
            const segmentColor = adjustColorBrightness(color);

            svg += `  <path d="${bezierPath}" stroke="${segmentColor}" stroke-width="1" stroke-dasharray="3,2" fill="none"/>\n`;
        });

        svg += `\n`;
    });

    // Legend
    const legendY = height - 140;
    svg += `  <!-- Legend -->
  <g font-family="Arial" font-size="12">
    <rect x="20" y="${legendY}" width="400" height="130" fill="white" stroke="black" />
    
    <text x="30" y="${legendY + 20}" font-weight="bold">NURBS Offset &amp; Bezier Split</text>
    
    <line x1="30" y1="${legendY + 35}" x2="60" y2="${legendY + 35}" stroke="${data.original.color}" stroke-width="2" />
    <text x="65" y="${legendY + 39}">${data.original.label} (${data.original.controlPointCount || 0} control points, ${data.original.beziers.length} Bezier segments)</text>
    
    <line x1="30" y1="${legendY + 55}" x2="60" y2="${legendY + 55}" stroke="${data.outset.color}" stroke-width="2" />
    <text x="65" y="${legendY + 59}">${data.outset.label} (${data.outset.shapeType || 'unknown'}, ${data.outset.beziers.length} Bezier segments)</text>
    
    <line x1="30" y1="${legendY + 75}" x2="60" y2="${legendY + 75}" stroke="${data.inset.color}" stroke-width="2" />
    <text x="65" y="${legendY + 79}">${data.inset.label} (${data.inset.shapeType || 'unknown'}, ${data.inset.beziers.length} Bezier segments)</text>
    
    <line x1="30" y1="${legendY + 95}" x2="60" y2="${legendY + 95}" stroke="#666" stroke-width="1" stroke-dasharray="3,2" />
    <text x="65" y="${legendY + 99}">Bezier segments (dashed lines)</text>
    
    <text x="30" y="${legendY + 115}" font-size="10" fill="#666">Total Bezier segments: ${data.original.beziers.length + data.outset.beziers.length + data.inset.beziers.length}</text>
  </g>
  
</svg>`;

    return svg;
}

/**
 * Generates SVG path for smooth curve using tessellated points
 */
function generateSmoothPath(points: Point2D[]): string {
    if (points.length === 0) return '';

    let path = `M ${points[0].x} ${points[0].y}`;

    for (let i: number = 1; i < points.length; i++) {
        path += ` L ${points[i].x} ${points[i].y}`;
    }

    return path;
}

/**
 * Generates proper SVG path for Bezier curve using C (cubic) or Q (quadratic) commands
 */
function generateBezierPath(bezier: Spline): string {
    const points = bezier.controlPoints;

    if (points.length === 0) return '';

    let path = `M ${points[0].x} ${points[0].y}`;

    if (bezier.degree === 3 && points.length === 4) {
        // Cubic Bezier: C x1 y1, x2 y2, x y
        path += ` C ${points[1].x} ${points[1].y}, ${points[2].x} ${points[2].y}, ${points[3].x} ${points[3].y}`;
    } else if (bezier.degree === 2 && points.length === 3) {
        // Quadratic Bezier: Q x1 y1, x y
        path += ` Q ${points[1].x} ${points[1].y}, ${points[2].x} ${points[2].y}`;
    } else if (bezier.degree === 1 && points.length === 2) {
        // Linear: L x y
        path += ` L ${points[1].x} ${points[1].y}`;
    } else {
        // Fallback: connect all points with lines
        for (let i: number = 1; i < points.length; i++) {
            path += ` L ${points[i].x} ${points[i].y}`;
        }
    }

    return path;
}

/**
 * Adjusts color brightness for segment visualization
 */
function adjustColorBrightness(color: string): string {
    // Simple color adjustment - make it lighter/darker
    if (color === '#0066cc') return '#4d9fdb';
    if (color === '#00aa00') return '#4dbf4d';
    if (color === '#cc0000') return '#db4d4d';
    return color;
}
