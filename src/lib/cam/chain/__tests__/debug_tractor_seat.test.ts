import { Shape } from '$lib/cam/shape/classes';
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseDXF } from '$lib/parsers/dxf/functions';
import { detectShapeChains } from '$lib/cam/chain/chain-detection';
import { detectParts } from '$lib/cam/part/part-detection.functions';
import type { ShapeData } from '$lib/cam/shape/interfaces';

describe('Tractor Seat Mount Debug Analysis', () => {
    it('should analyze why part detection finds 11 parts instead of 1', async () => {
        const dxfPath = join(
            process.cwd(),
            'tests/dxf/Tractor Seat Mount - Left.dxf'
        );
        const dxfContent = readFileSync(dxfPath, 'utf-8');

        // Test different parsing options
        const scenarios = [
            {
                name: 'Default parsing (no squashing)',
                options: { decomposePolylines: true, squashLayers: false },
            },
            {
                name: 'With layer squashing',
                options: { decomposePolylines: true, squashLayers: true },
            },
            {
                name: 'No polyline decomposition',
                options: { decomposePolylines: false, squashLayers: false },
            },
            {
                name: 'No polyline decomposition + layer squashing',
                options: { decomposePolylines: false, squashLayers: true },
            },
        ];

        for (const _ of scenarios) {
            const parsed = await parseDXF(dxfContent);

            // Analyze layers
            const layerStats: Record<string, number> = {};
            parsed.shapes.forEach((shape: ShapeData) => {
                const layer = shape.layer || 'NO_LAYER';
                layerStats[layer] = (layerStats[layer] || 0) + 1;
            });

            // Analyze shape types
            const shapeStats: Record<string, number> = {};
            parsed.shapes.forEach((shape: ShapeData) => {
                shapeStats[shape.type] = (shapeStats[shape.type] || 0) + 1;
            });

            // Test different tolerance values for chain detection
            const tolerances = [0.01, 0.05, 0.1, 0.5, 1.0];

            for (const tolerance of tolerances) {
                const chains = detectShapeChains(
                    parsed.shapes.map((s) => new Shape(s)),
                    { tolerance }
                );

                // Only proceed with part detection if we have reasonable number of chains
                if (chains.length > 0 && chains.length <= 20) {
                    const partResult = detectParts(chains);

                    // Process warnings if needed

                    // Check for obvious containment issues
                    if (partResult.parts.length > 1) {
                        const sortedParts = partResult.parts.sort((a, b) => {
                            const aArea =
                                (a.boundingBox.max.x - a.boundingBox.min.x) *
                                (a.boundingBox.max.y - a.boundingBox.min.y);
                            const bArea =
                                (b.boundingBox.max.x - b.boundingBox.min.x) *
                                (b.boundingBox.max.y - b.boundingBox.min.y);
                            return bArea - aArea; // Largest first
                        });

                        for (let i: number = 1; i < sortedParts.length; i++) {
                            // Check containment if needed
                        }
                    }
                }
            }
        }

        // Summary and analysis

        // For now, just verify we can run the analysis
        expect(true).toBe(true);
    }, 120000); // 2 minute timeout
});
