import { describe, it, expect } from 'vitest';
import { detectShapeChains, isShapeClosed } from './chain-detection';
import { parseDXF } from '../../parsers/dxf-parser';
import { readFileSync } from 'fs';
import { join } from 'path';
import { polylineToPoints, polylineToVertices } from '../../geometry/polyline';
import type { Polyline } from '../../types/geometry';

describe('Comprehensive Closed Polyline with Bulges Test', () => {
    it('should correctly handle closed polylines with bulges end-to-end', async () => {
        // Load the polylines_with_bulge.dxf test file
        const dxfPath = join(
            process.cwd(),
            'tests/dxf/polylines_with_bulge.dxf'
        );
        const dxfContent = readFileSync(dxfPath, 'utf-8');

        // Parse the DXF file
        const drawing = await parseDXF(dxfContent);
        expect(drawing.shapes).toHaveLength(2); // Should have 2 polylines

        // Both shapes should be polylines
        expect(drawing.shapes[0].type).toBe('polyline');
        expect(drawing.shapes[1].type).toBe('polyline');

        // Extract the polylines for detailed inspection
        const polyline1 = drawing.shapes[0].geometry as Polyline;
        const polyline2 = drawing.shapes[1].geometry as Polyline;

        // 1. Check that polylines are marked as closed in the geometry
        expect(polyline1.closed).toBe(true);
        expect(polyline2.closed).toBe(true);

        // 2. Check that points array has been modified to have coincident start/end points
        const poly1Points = polylineToPoints(polyline1);
        const poly2Points = polylineToPoints(polyline2);

        // For closed polylines, the first and last points should now be coincident
        if (poly1Points.length > 0) {
            const firstPoint = poly1Points[0];
            const lastPoint = poly1Points[poly1Points.length - 1];

            const distance: number = Math.sqrt(
                Math.pow(firstPoint.x - lastPoint.x, 2) +
                    Math.pow(firstPoint.y - lastPoint.y, 2)
            );

            // Should be exactly coincident (distance = 0)
            expect(distance).toBe(0);
        }

        if (poly2Points.length > 0) {
            const firstPoint = poly2Points[0];
            const lastPoint = poly2Points[poly2Points.length - 1];

            const distance: number = Math.sqrt(
                Math.pow(firstPoint.x - lastPoint.x, 2) +
                    Math.pow(firstPoint.y - lastPoint.y, 2)
            );

            // Should be exactly coincident (distance = 0)
            expect(distance).toBe(0);
        }

        // 3. Check that isShapeClosed function correctly identifies them as closed
        expect(isShapeClosed(drawing.shapes[0], 0.1)).toBe(true);
        expect(isShapeClosed(drawing.shapes[1], 0.1)).toBe(true);

        // 4. Check that chain detection creates chains from the polylines
        const chains = detectShapeChains(drawing.shapes, { tolerance: 0.1 });

        // Should have 2 separate chains (one for each polyline)
        expect(chains).toHaveLength(2);

        // Each chain should contain exactly one polyline
        expect(chains[0].shapes).toHaveLength(1);
        expect(chains[1].shapes).toHaveLength(1);

        // 5. Simulate the PrepareStage isChainClosed check
        // This mimics what the UI will show
        for (const chain of chains) {
            const shape = chain.shapes[0];

            // Single shape chain - should check the shape's closed flag
            if (shape.type === 'polyline') {
                const polyline: import('$lib/types/geometry').Polyline =
                    shape.geometry as Polyline;
                expect(polyline.closed).toBe(true);
            }
        }

        // 6. Verify vertices are preserved correctly (for bulge rendering)
        const poly1Vertices = polylineToVertices(polyline1);
        const poly2Vertices = polylineToVertices(polyline2);
        expect(poly1Vertices.length).toBe(4); // Original vertices without duplication
        expect(poly2Vertices.length).toBe(4);

        // Points array should have one more point than vertices for closed polylines
        expect(poly1Points.length).toBe(poly1Vertices.length + 1);
        expect(poly2Points.length).toBe(poly2Vertices.length + 1);
    });
});
