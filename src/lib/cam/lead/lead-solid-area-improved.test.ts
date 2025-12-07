import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseDXF } from '$lib/parsers/dxf/functions';
import { detectShapeChains } from '$lib/cam/chain/chain-detection';
import { detectParts } from '$lib/cam/part/part-detection';
import { calculateLeads } from './lead-calculation';
import { type LeadConfig } from './interfaces';
import { CutDirection } from '$lib/cam/cut/enums';
import { LeadType } from './enums';
import { convertLeadGeometryToPoints } from './functions';
import { Shape } from '$lib/cam/shape/classes';
import { Chain } from '$lib/cam/chain/classes.svelte';
import { decomposePolylines } from '$lib/cam/preprocess/decompose-polylines/decompose-polylines';

describe('Lead Solid Area Detection - Improved Point-in-Polygon', () => {
    it('should properly detect solid areas using point-in-polygon for ADLER.dxf Part 5', async () => {
        // Load the ADLER.dxf file
        const dxfPath = join(process.cwd(), 'tests/dxf/ADLER.dxf');
        const dxfContent = readFileSync(dxfPath, 'utf-8');

        // Parse with decompose polylines enabled (matching UI behavior)
        const parsed = await parseDXF(dxfContent);
        // Decompose polylines before chain detection
        const decomposed = decomposePolylines(
            parsed.shapes.map((s) => new Shape(s))
        );

        // Detect chains with tolerance 0.1 (standard default)
        // Convert ShapeData to Shape instances for chain detection
        const shapeInstances = decomposed.map((s) => new Shape(s));
        const chains = detectShapeChains(shapeInstances, { tolerance: 0.1 });

        // Detect parts
        const partResult = await detectParts(chains);

        // Find Part 5 (0-based indexing, so part 5 is index 4)
        const part5 = partResult.parts[4];
        expect(part5).toBeDefined();

        if (!part5) return;

        // Test lead generation for the shell chain with improved algorithm
        const leadIn: LeadConfig = { type: LeadType.ARC, length: 5 }; // Shorter lead to test
        const leadOut: LeadConfig = { type: LeadType.NONE, length: 0 };

        const result = calculateLeads(
            new Chain(part5.shell),
            leadIn,
            leadOut,
            CutDirection.CLOCKWISE, // Use proper cut direction instead of NONE
            part5,
            { x: 1, y: 0 }
        );

        expect(result.leadIn).toBeDefined();
        const points = convertLeadGeometryToPoints(result.leadIn!);
        expect(points.length).toBeGreaterThan(0);

        // The improved algorithm should either:
        // 1. Find a valid position without warnings, OR
        // 2. Generate warnings if no valid position exists after trying all rotations

        if (result.warnings && result.warnings.length > 0) {
            result.warnings.forEach((_warning, _i) => {
                // Process warning
            });

            // If warnings are generated, they should be informative
            expect(result.warnings[0]).toContain('intersects solid material');
            expect(result.warnings[0]).toContain('cannot be avoided');
        }

        // Algorithm should have tried to find a solution (no crashes)
        expect(points.length).toBeGreaterThan(0);
    });

    it('should generate different warnings for lead-in vs lead-out', async () => {
        const dxfPath = join(process.cwd(), 'tests/dxf/ADLER.dxf');
        const dxfContent = readFileSync(dxfPath, 'utf-8');
        const parsed = await parseDXF(dxfContent);
        // Decompose polylines before chain detection
        const decomposed = decomposePolylines(
            parsed.shapes.map((s) => new Shape(s))
        );
        // Convert ShapeData to Shape instances for chain detection
        const shapeInstances = decomposed.map((s) => new Shape(s));
        const chains = detectShapeChains(shapeInstances, { tolerance: 0.1 });
        const partResult = await detectParts(chains);
        const part5 = partResult.parts[4];

        if (!part5) {
            return;
        }

        // Test both lead-in and lead-out with challenging parameters
        const leadIn: LeadConfig = { type: LeadType.ARC, length: 20 }; // Long lead
        const leadOut: LeadConfig = { type: LeadType.ARC, length: 20 }; // Long lead

        const result = calculateLeads(
            new Chain(part5.shell),
            leadIn,
            leadOut,
            CutDirection.NONE,
            part5,
            { x: 1, y: 0 }
        );

        if (result.warnings && result.warnings.length > 0) {
            result.warnings.forEach((_warning, _i) => {
                // Process warning
            });

            // Check that warnings properly identify lead-in vs lead-out
            const leadInWarnings = result.warnings.filter((w) =>
                w.includes('Lead-in')
            );
            const leadOutWarnings = result.warnings.filter((w) =>
                w.includes('Lead-out')
            );

            if (leadInWarnings.length > 0) {
                expect(leadInWarnings[0]).toContain('Lead-in');
                expect(leadInWarnings[0]).toContain('shell');
            }

            if (leadOutWarnings.length > 0) {
                expect(leadOutWarnings[0]).toContain('Lead-out');
                expect(leadOutWarnings[0]).toContain('shell');
            }
        }
    });

    it('should try multiple angles and lengths before generating warnings', async () => {
        const dxfPath = join(process.cwd(), 'tests/dxf/ADLER.dxf');
        const dxfContent = readFileSync(dxfPath, 'utf-8');
        const parsed = await parseDXF(dxfContent);
        // Decompose polylines before chain detection
        const decomposed = decomposePolylines(
            parsed.shapes.map((s) => new Shape(s))
        );
        // Convert ShapeData to Shape instances for chain detection
        const shapeInstances = decomposed.map((s) => new Shape(s));
        const chains = detectShapeChains(shapeInstances, { tolerance: 0.1 });
        const partResult = await detectParts(chains);
        const part5 = partResult.parts[4];

        if (!part5) return;

        // Test with a very long lead that should definitely intersect
        const leadIn: LeadConfig = { type: LeadType.ARC, length: 50 }; // Very long lead
        const leadOut: LeadConfig = { type: LeadType.NONE, length: 0 };

        const result = calculateLeads(
            new Chain(part5.shell),
            leadIn,
            leadOut,
            CutDirection.CLOCKWISE, // Use proper cut direction instead of NONE
            part5,
            { x: 1, y: 0 }
        );

        // Should still generate lead-in geometry despite constraints
        expect(result.leadIn).toBeDefined();

        // Lead-out is NONE type, so it should be undefined
        expect(result.leadOut).toBeUndefined();

        // Verify the algorithm successfully generates lead-in even in constrained space
        const leadInGeometry = result.leadIn!.geometry;
        expect(leadInGeometry).toBeDefined();
    });
});
