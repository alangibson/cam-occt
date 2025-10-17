import { describe, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseDXF } from '$lib/parsers/dxf/functions';
import { detectShapeChains } from '$lib/geometry/chain/chain-detection';
import { detectParts } from '$lib/cam/part/part-detection';
import { polylineToPoints } from '$lib/geometry/polyline';
import type { Polyline } from '$lib/geometry/polyline';
import type { Shape } from '$lib/geometry/shape';

describe('Lead Solid Area Verification - Catch the Error', () => {
    it('Debug: Verify part 5 geometry and chain association', async () => {
        const dxfPath = join(process.cwd(), 'tests/dxf/ADLER.dxf');
        const dxfContent = readFileSync(dxfPath, 'utf-8');
        const parsed = await parseDXF(dxfContent);
        const chains = detectShapeChains(parsed.shapes, { tolerance: 0.1 });
        const partResult = await detectParts(chains);
        const part5 = partResult.parts[4];

        if (!part5) return;

        // Get shell geometry details
        const shellShape = part5.shell.chain.shapes[0];

        if (shellShape.type === 'polyline') {
            const polylineGeom = shellShape.geometry as Polyline;

            // Calculate bounding box
            let minX = Infinity,
                maxX = -Infinity,
                minY = Infinity,
                maxY = -Infinity;
            const points = polylineToPoints(polylineGeom);
            points.forEach((p: { x: number; y: number }) => {
                minX = Math.min(minX, p.x);
                maxX = Math.max(maxX, p.x);
                minY = Math.min(minY, p.y);
                maxY = Math.max(maxY, p.y);
            });
        }

        // Check holes
        part5.holes.forEach((hole: { chain: { shapes: Shape[] } }) => {
            // Process hole
            void hole;
        });
    });
});
