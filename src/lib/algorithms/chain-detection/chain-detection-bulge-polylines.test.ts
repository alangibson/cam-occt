import { describe, expect, it } from 'vitest';
import { detectShapeChains } from './chain-detection';
import { parseDXF } from '../../parsers/dxf-parser';
import { readFileSync } from 'fs';
import { join } from 'path';
import { polylineToVertices } from '$lib/geometry/polyline';
import type { Polyline, PolylineVertex } from '$lib/types';
import { isShapeClosed } from '$lib/geometry/shape/functions';

describe('Chain Detection for Polylines with Bulges', () => {
    it('should correctly detect closed polylines with bulges as closed chains', async () => {
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

        // Verify the polylines have vertices with bulges
        const vertices1 = polylineToVertices(polyline1);
        const vertices2 = polylineToVertices(polyline2);
        expect(vertices1).toBeDefined();
        expect(vertices2).toBeDefined();

        // Check that at least some vertices have non-zero bulges
        const hasNonZeroBulges1 = vertices1.some(
            (v: PolylineVertex) => v.bulge !== 0
        );
        const hasNonZeroBulges2 = vertices2.some(
            (v: PolylineVertex) => v.bulge !== 0
        );
        expect(hasNonZeroBulges1 || hasNonZeroBulges2).toBe(true);

        // Both polylines in the test file should be closed (flag = 1 in DXF)
        // First polyline: LWPOLYLINE with 70=1 (closed)
        // Second polyline: POLYLINE with 70=1 (closed)
        expect(polyline1.closed).toBe(true);
        expect(polyline2.closed).toBe(true);

        // Detect chains using a reasonable tolerance
        const chains = detectShapeChains(drawing.shapes, { tolerance: 0.1 });

        // Should have 2 separate chains (one for each polyline)
        expect(chains).toHaveLength(2);

        // Each chain should contain exactly one polyline
        expect(chains[0].shapes).toHaveLength(1);
        expect(chains[1].shapes).toHaveLength(1);

        // Verify the polylines are correctly parsed as closed
        expect(polyline1.closed).toBe(true);
        expect(polyline2.closed).toBe(true);

        // Test that the chain detection algorithm correctly identifies these as closed chains
        // Import the chain closure detection function to test it directly
        // Both polylines should be detected as closed using the fixed algorithm
        expect(isShapeClosed(drawing.shapes[0], 0.1)).toBe(true);
        expect(isShapeClosed(drawing.shapes[1], 0.1)).toBe(true);
    });

    it('should correctly report chain closure status for polylines with bulges', async () => {
        // Load the polylines_with_bulge.dxf test file
        const dxfPath = join(
            process.cwd(),
            'tests/dxf/polylines_with_bulge.dxf'
        );
        const dxfContent = readFileSync(dxfPath, 'utf-8');

        // Parse the DXF file
        const drawing = await parseDXF(dxfContent);

        // Detect chains using a reasonable tolerance
        const chains = detectShapeChains(drawing.shapes, { tolerance: 0.1 });

        // Both polylines should be detected as closed
        for (const chain of chains) {
            expect(chain.shapes).toHaveLength(1);
            const shape = chain.shapes[0];

            // This is the core bug - the function should return true for closed polylines
            // but currently returns false
            const isClosed = isShapeClosed(shape, 0.1);

            // THIS TEST SHOULD PASS but currently fails due to the bug
            expect(isClosed).toBe(true);
        }
    });
});
