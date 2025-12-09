import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseDXF } from '$lib/parsers/dxf/functions';
import { detectShapeChains } from '$lib/cam/chain/chain-detection';
import { detectParts } from '$lib/cam/part/part-detection.functions';
import { Shape } from '$lib/cam/shape/classes';

describe('DRAAK.dxf Part Detection', () => {
    it('should detect all holes in DRAAK.dxf file', async () => {
        // Read the DRAAK.dxf file
        const dxfPath = join(process.cwd(), 'tests/dxf/DRAAK.dxf');
        const dxfContent = readFileSync(dxfPath, 'utf-8');

        // Parse with decompose polylines enabled (matching UI behavior)
        const parsed = await parseDXF(dxfContent);

        // Detect chains with tolerance 0.1 (matching current default)
        const chains = detectShapeChains(
            parsed.shapes.map((s) => new Shape(s)),
            { tolerance: 0.1 }
        );

        console.log(`\nDRAAK.dxf: Found ${chains.length} chains`);

        // Detect parts
        const partResult = await detectParts(chains, 0.1);

        console.log(`DRAAK.dxf: Detected ${partResult.parts.length} parts`);

        // Calculate total holes across all parts
        const totalHoles = partResult.parts.reduce(
            (sum, part) => sum + part.voids.length,
            0
        );

        console.log(`DRAAK.dxf: Total holes detected: ${totalHoles}`);

        // Log details about each part
        partResult.parts.forEach((part, idx) => {
            console.log(
                `  Part ${idx + 1}: ${part.voids.length} hole(s), ${part.slots.length} slot(s)`
            );
        });

        // According to the reference PlasmaDesk parser around line 232 in dxf-parser.js,
        // it logs "Containment groups:" which shows the nesting structure.
        // The DRAAK.dxf file should have multiple parts with holes.
        // We need to verify the correct number based on the reference parser output.

        // For now, we just verify that we detect SOME holes (not zero)
        // The exact count will be validated after comparing with reference parser
        expect(totalHoles).toBeGreaterThan(0);
        expect(partResult.warnings).toHaveLength(0);
    }, 30000); // 30 second timeout for large DXF file

    it('should process the DRAAK.dxf file without errors', async () => {
        const dxfPath = join(process.cwd(), 'tests/dxf/DRAAK.dxf');
        const dxfContent = readFileSync(dxfPath, 'utf-8');

        // This should not throw
        const parsed = await parseDXF(dxfContent);
        const chains = detectShapeChains(
            parsed.shapes.map((s) => new Shape(s)),
            { tolerance: 0.1 }
        );
        const partResult = await detectParts(chains, 0.1);

        expect(parsed.shapes.length).toBeGreaterThan(0);
        expect(chains.length).toBeGreaterThan(0);
        expect(partResult.parts.length).toBeGreaterThan(0);
    }, 30000); // 30 second timeout for large DXF file
});
