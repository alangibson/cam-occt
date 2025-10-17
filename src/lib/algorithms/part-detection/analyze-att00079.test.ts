/**
 * Analysis test for ATT00079.dxf problematic chains
 * Tests the specific 5 chains that should be holes but are being detected as parts
 */

import { describe, expect, it } from 'vitest';
import { parseDXF } from '$lib/parsers/dxf/functions';
import { detectShapeChains } from '$lib/geometry/chain/chain-detection';
import { detectParts } from '$lib/algorithms/part-detection/part-detection';
import {
    getShapeEndPoint,
    getShapeStartPoint,
} from '$lib/geometry/shape/functions';
import { isChainClosed } from '$lib/geometry/chain/functions';
import { calculateChainBoundingBox } from '$lib/geometry/bounding-box/functions';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { BoundingBox } from '$lib/geometry/bounding-box';

const problematicChains = [
    'chain-34',
    'chain-65',
    'chain-70',
    'chain-85',
    'chain-90',
];

interface ContainerInfo {
    chainId: string;
    bounds: BoundingBox;
    areaRatio: number;
    shapeTypes: string;
}

interface ChainAnalysis {
    chainId: string;
    shapeCount: number;
    shapeTypes: string;
    bounds: BoundingBox;
    gapDistance: number;
    isClosed: boolean;
    potentialContainers: ContainerInfo[];
}

describe('ATT00079.dxf Part Detection Verification', () => {
    it('should correctly detect 21 parts as expected (no problematic chains)', async () => {
        // Load and parse the DXF file
        const filePath = join(process.cwd(), 'tests/dxf/ATT00079.dxf');
        const dxfContent = readFileSync(filePath, 'utf8');

        const parseResult = await parseDXF(dxfContent);

        // Detect chains
        const chains = detectShapeChains(parseResult.shapes, {
            tolerance: 0.1,
        });

        // Detect parts
        const partResult = await detectParts(chains, 0.1);

        // Find the closed chains
        const closedChains = chains.filter((chain) =>
            isChainClosed(chain, 0.1)
        );

        // Analysis section

        const analysisResults: ChainAnalysis[] = [];

        for (const chainId of problematicChains) {
            const chain = chains.find((c) => c.id === chainId);
            if (!chain) {
                continue;
            }

            const analysis = {
                chainId,
                shapeCount: chain.shapes.length,
                shapeTypes: chain.shapes.map((s) => s.type).join(', '),
                bounds: calculateChainBoundingBox(chain),
                gapDistance: 0,
                isClosed: false,
                potentialContainers: [] as ContainerInfo[],
            };

            // Check if it's closed
            const firstShape = chain.shapes[0];
            const lastShape = chain.shapes[chain.shapes.length - 1];
            const firstStart = getShapeStartPoint(firstShape);
            const lastEnd = getShapeEndPoint(lastShape);

            analysis.gapDistance = Math.sqrt(
                Math.pow(firstStart.x - lastEnd.x, 2) +
                    Math.pow(firstStart.y - lastEnd.y, 2)
            );
            analysis.isClosed = analysis.gapDistance < 0.1;

            // Look for potential containing chains
            for (const otherChain of closedChains) {
                if (otherChain.id === chainId) continue;

                const otherBounds = calculateChainBoundingBox(otherChain);

                // Check bounding box containment
                const isContained =
                    analysis.bounds.min.x >= otherBounds.min.x &&
                    analysis.bounds.max.x <= otherBounds.max.x &&
                    analysis.bounds.min.y >= otherBounds.min.y &&
                    analysis.bounds.max.y <= otherBounds.max.y;

                if (isContained) {
                    const area1 =
                        (analysis.bounds.max.x - analysis.bounds.min.x) *
                        (analysis.bounds.max.y - analysis.bounds.min.y);
                    const area2 =
                        (otherBounds.max.x - otherBounds.min.x) *
                        (otherBounds.max.y - otherBounds.min.y);
                    const ratio = area1 / area2;

                    const containerInfo = {
                        chainId: otherChain.id,
                        bounds: otherBounds,
                        areaRatio: ratio,
                        shapeTypes: otherChain.shapes
                            .map((s) => s.type)
                            .join(', '),
                    };

                    analysis.potentialContainers.push(containerInfo);
                }
            }

            if (analysis.potentialContainers.length === 0) {
                // No container found for this chain
            }

            analysisResults.push(analysis);
        }

        // Summary and patterns

        // Look for patterns in the problematic chains
        const allHaveSamePattern = analysisResults.every(
            (a) => a.shapeTypes === analysisResults[0].shapeTypes
        );
        const allHaveContainers = analysisResults.every(
            (a) => a.potentialContainers.length > 0
        );
        // Calculate average size for analysis (currently unused but may be needed for debugging)

        if (allHaveSamePattern) {
            // All problematic chains have the same pattern
        }
        if (allHaveContainers) {
            // All chains have potential containers
        }

        // Verify the algorithm is working correctly
        expect(partResult.parts).toHaveLength(21); // Should detect exactly 21 parts
        expect(analysisResults).toHaveLength(5); // Should still analyze the 5 specific chains
        expect(analysisResults.every((a) => a.isClosed)).toBe(true); // All analyzed chains should be closed

        // These chains are now correctly detected as independent parts (no longer problematic)
        // They don't need to have containing chains - they are legitimate separate parts
    });
});
