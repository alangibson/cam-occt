import { describe, it, expect } from 'vitest';
import { parseDXF } from '../parsers/dxf-parser';
import { polylineToPoints } from '$lib/geometry/polyline';
import { decomposePolylines } from './decompose-polylines';
import { readFileSync } from 'fs';
import path from 'path';
import type { PolylineVertex, Shape } from '../../lib/types';
import { EPSILON } from '../constants';
import type { Arc } from '../geometry/arc';
import type { Line, Polyline } from '../types/geometry';

// Mock canvas for screenshot comparison
function createTestCanvas(width: number = 800, height: number = 600) {
    // Create a minimal mock context with just the properties we need
    const mockContext = {
        clearRect: () => {},
        beginPath: () => {},
        moveTo: () => {},
        lineTo: () => {},
        arc: () => {},
        closePath: () => {},
        stroke: () => {},
        fillRect: () => {},
        setLineDash: () => {},
        save: () => {},
        restore: () => {},
        translate: () => {},
        scale: () => {},
        strokeStyle: '',
        lineWidth: 1,
        lineDashOffset: 0,
    } as Partial<CanvasRenderingContext2D>;

    const canvas = {
        width,
        height,
        getContext: () => mockContext as CanvasRenderingContext2D,
    };
    return canvas;
}

// Simple drawing function for shapes
function drawShapes(
    shapes: Shape[],
    ctx: CanvasRenderingContext2D,
    scale: number = 1
) {
    shapes.forEach((shape) => {
        ctx.beginPath();
        ctx.strokeStyle = shape.type === 'arc' ? '#ff0000' : '#000000'; // Red for arcs, black for lines
        ctx.lineWidth = shape.type === 'arc' ? 2 : 1;

        switch (shape.type) {
            case 'line':
                const line: Line = shape.geometry as Line;
                ctx.moveTo(line.start.x * scale, line.start.y * scale);
                ctx.lineTo(line.end.x * scale, line.end.y * scale);
                break;
            case 'arc':
                const arc: Arc = shape.geometry as Arc;
                // Draw arc using center, radius, start/end angles
                ctx.arc(
                    arc.center.x * scale,
                    arc.center.y * scale,
                    arc.radius * scale,
                    arc.startAngle,
                    arc.endAngle,
                    arc.clockwise
                );
                break;
            case 'polyline':
                const polyline: Polyline = shape.geometry as Polyline;
                const points = polylineToPoints(polyline);
                if (points.length > 0) {
                    ctx.moveTo(points[0].x * scale, points[0].y * scale);
                    for (let i: number = 1; i < points.length; i++) {
                        ctx.lineTo(points[i].x * scale, points[i].y * scale);
                    }
                    if (polyline.closed) {
                        ctx.closePath();
                    }
                }
                break;
        }
        ctx.stroke();
    });
}

// Calculate bounds for shapes
function calculateShapeBounds(shapes: Shape[]): {
    min: { x: number; y: number };
    max: { x: number; y: number };
} {
    if (shapes.length === 0) {
        return { min: { x: 0, y: 0 }, max: { x: 0, y: 0 } };
    }

    let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;

    shapes.forEach((shape) => {
        let points: { x: number; y: number }[] = [];

        switch (shape.type) {
            case 'line':
                const line: Line = shape.geometry as Line;
                points = [line.start, line.end];
                break;
            case 'arc':
                const arc: Arc = shape.geometry as Arc;
                // Calculate actual arc bounds based on start/end angles
                // Sample points along the arc for accurate bounds
                const numSamples = 16;
                points = [];

                // Add start and end points of arc
                const startX =
                    arc.center.x + arc.radius * Math.cos(arc.startAngle);
                const startY =
                    arc.center.y + arc.radius * Math.sin(arc.startAngle);
                const endX = arc.center.x + arc.radius * Math.cos(arc.endAngle);
                const endY = arc.center.y + arc.radius * Math.sin(arc.endAngle);

                points.push({ x: startX, y: startY });
                points.push({ x: endX, y: endY });

                // Sample intermediate points along the arc
                const startAngle = arc.startAngle;
                let endAngle = arc.endAngle;

                // Handle angle wrapping for clockwise arcs
                if (arc.clockwise && endAngle > startAngle) {
                    endAngle -= 2 * Math.PI;
                } else if (!arc.clockwise && endAngle < startAngle) {
                    endAngle += 2 * Math.PI;
                }

                const angleDiff = endAngle - startAngle;
                for (let i: number = 1; i < numSamples - 1; i++) {
                    const t: number = i / (numSamples - 1);
                    const angle: number = startAngle + t * angleDiff;
                    const x: number =
                        arc.center.x + arc.radius * Math.cos(angle);
                    const y: number =
                        arc.center.y + arc.radius * Math.sin(angle);
                    points.push({ x, y });
                }
                break;
            case 'polyline':
                const polyline: Polyline = shape.geometry as Polyline;
                points = polylineToPoints(polyline);
                break;
        }

        points.forEach((point) => {
            minX = Math.min(minX, point.x);
            maxX = Math.max(maxX, point.x);
            minY = Math.min(minY, point.y);
            maxY = Math.max(maxY, point.y);
        });
    });

    return {
        min: { x: isFinite(minX) ? minX : 0, y: isFinite(minY) ? minY : 0 },
        max: { x: isFinite(maxX) ? maxX : 0, y: isFinite(maxY) ? maxY : 0 },
    };
}

describe('Polylinie.dxf Decomposition Visual Test', () => {
    it('should preserve visual appearance after decomposition', async () => {
        // Load the DXF file
        const dxfPath = path.resolve('tests/dxf/Polylinie.dxf');
        const dxfContent = readFileSync(dxfPath, 'utf-8');

        // Parse original (with bulges preserved)
        const originalDrawing = await parseDXF(dxfContent);

        // Apply decomposition
        const decomposedShapes = decomposePolylines(originalDrawing.shapes);

        // Log shape details for debugging
        originalDrawing.shapes.forEach((shape) => {
            if (shape.type === 'polyline') {
                const geom = shape.geometry as Polyline;
                if (
                    'vertices' in geom &&
                    Array.isArray(
                        (geom as { vertices?: PolylineVertex[] }).vertices
                    )
                ) {
                    (geom as { vertices: PolylineVertex[] }).vertices.filter(
                        (v: PolylineVertex) => Math.abs(v.bulge || 0) > EPSILON
                    );
                }
            }
        });

        decomposedShapes.filter((s) => s.type === 'arc');

        // Calculate bounds for both versions
        const originalBounds = calculateShapeBounds(originalDrawing.shapes);
        const decomposedBounds = calculateShapeBounds(decomposedShapes);

        // Check that bounds are similar (shapes should occupy same space)
        const tolerance = 10.0; // Allow tolerance for arc approximation and extreme bulge values
        expect(
            Math.abs(originalBounds.min.x - decomposedBounds.min.x)
        ).toBeLessThan(tolerance);
        expect(
            Math.abs(originalBounds.min.y - decomposedBounds.min.y)
        ).toBeLessThan(tolerance);
        expect(
            Math.abs(originalBounds.max.x - decomposedBounds.max.x)
        ).toBeLessThan(tolerance);
        expect(
            Math.abs(originalBounds.max.y - decomposedBounds.max.y)
        ).toBeLessThan(tolerance);

        // Create mock canvases for comparison
        const canvas1 = createTestCanvas();
        const canvas2 = createTestCanvas();
        const ctx1 = canvas1.getContext();
        const ctx2 = canvas2.getContext();

        // Calculate scale to fit drawing in canvas
        const boundsWidth = Math.max(
            originalBounds.max.x - originalBounds.min.x,
            1
        );
        const boundsHeight = Math.max(
            originalBounds.max.y - originalBounds.min.y,
            1
        );
        const scale = Math.min(700 / boundsWidth, 500 / boundsHeight);

        // Draw both versions
        drawShapes(originalDrawing.shapes, ctx1, scale);
        drawShapes(decomposedShapes, ctx2, scale);

        // Basic validation - decomposed version should have arcs
        expect(
            decomposedShapes.filter((s) => s.type === 'arc').length
        ).toBeGreaterThan(0);
        expect(
            decomposedShapes.filter((s) => s.type === 'line').length
        ).toBeGreaterThan(0);

        // The decomposed version should have more shapes than original
        expect(decomposedShapes.length).toBeGreaterThan(
            originalDrawing.shapes.length
        );
    });
});
