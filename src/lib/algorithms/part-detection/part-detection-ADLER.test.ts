import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseDXF } from '$lib/parsers/dxf/functions';
import { detectShapeChains } from '$lib/geometry/chain/chain-detection';
import { detectParts } from '$lib/algorithms/part-detection/part-detection';

describe('ADLER.dxf Part Detection', () => {
    it('should detect 9 parts with 1 hole from the ADLER.dxf file', async () => {
        // Read the ADLER.dxf file
        const dxfPath = join(process.cwd(), 'tests/dxf/ADLER.dxf');
        const dxfContent = readFileSync(dxfPath, 'utf-8');

        // Parse with decompose polylines enabled (matching UI behavior)
        const parsed = await parseDXF(dxfContent);

        // Detect chains with tolerance 0.1 (matching current default)
        const chains = detectShapeChains(parsed.shapes, { tolerance: 0.1 });

        // Log details about each chain
        chains.forEach(() => {});

        // Detect parts
        const partResult = await detectParts(chains);

        // Log details about each part
        partResult.parts.forEach(() => {});

        const totalHoles = partResult.parts.reduce(
            (sum, part) => sum + part.holes.length,
            0
        );

        // Verify expected results for ADLER.dxf
        expect(partResult.parts).toHaveLength(9); // Should be 9 parts
        expect(totalHoles).toBe(1); // Should have 1 hole total
        expect(partResult.warnings).toHaveLength(0); // Should have no warnings

        // Should have 9 parts, with only one having a hole
        const partsWithHoles = partResult.parts.filter(
            (part) => part.holes.length > 0
        );
        expect(partsWithHoles).toHaveLength(1); // Only one part should have a hole
        expect(partsWithHoles[0].holes).toHaveLength(1); // That part should have exactly 1 hole
    });

    it('should process the ADLER.dxf file without errors', async () => {
        const dxfPath = join(process.cwd(), 'tests/dxf/ADLER.dxf');
        const dxfContent = readFileSync(dxfPath, 'utf-8');

        // This should not throw
        const parsed = await parseDXF(dxfContent);
        const chains = detectShapeChains(parsed.shapes, { tolerance: 0.1 });
        const partResult = await detectParts(chains);

        expect(parsed.shapes.length).toBeGreaterThan(0);
        expect(chains.length).toBeGreaterThan(0);
        expect(partResult.parts.length).toBeGreaterThan(0);
    });
});
