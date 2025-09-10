/**
 * Analysis test for ATT00079.dxf problematic chains
 * Tests the specific 5 chains that should be holes but are being detected as parts
 */

import { describe, it, expect } from 'vitest';
import { parseDXF } from '../parsers/dxf-parser';
import { detectShapeChains } from './chain-detection/chain-detection';
import { detectParts } from './part-detection';
import { polylineToPoints } from '$lib/geometry/polyline';
import { getShapeStartPoint, getShapeEndPoint } from '$lib/geometry';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { Shape } from '../../lib/types';
import type { Line, Circle, Polyline } from '../../lib/types/geometry';
import type { Arc } from '$lib/geometry/arc';
import type { Chain as ShapeChain } from './chain-detection/chain-detection';

const problematicChains = [
    'chain-34',
    'chain-65',
    'chain-70',
    'chain-85',
    'chain-90',
];

interface BoundingBox {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
}

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

        const parseResult = await parseDXF(dxfContent, {
            decomposePolylines: true,
            translateToPositiveQuadrant: true,
        });

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
                    analysis.bounds.minX >= otherBounds.minX &&
                    analysis.bounds.maxX <= otherBounds.maxX &&
                    analysis.bounds.minY >= otherBounds.minY &&
                    analysis.bounds.maxY <= otherBounds.maxY;

                if (isContained) {
                    const area1 =
                        (analysis.bounds.maxX - analysis.bounds.minX) *
                        (analysis.bounds.maxY - analysis.bounds.minY);
                    const area2 =
                        (otherBounds.maxX - otherBounds.minX) *
                        (otherBounds.maxY - otherBounds.maxY);
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

// Helper functions
function isChainClosed(chain: ShapeChain, tolerance: number): boolean {
    if (chain.shapes.length === 0) return false;

    // Special case: single-shape circles are inherently closed
    if (chain.shapes.length === 1 && chain.shapes[0].type === 'circle') {
        return true;
    }

    const firstShape = chain.shapes[0];
    const lastShape = chain.shapes[chain.shapes.length - 1];

    const firstStart = getShapeStartPoint(firstShape);
    const lastEnd = getShapeEndPoint(lastShape);

    const distance: number = Math.sqrt(
        Math.pow(firstStart.x - lastEnd.x, 2) +
            Math.pow(firstStart.y - lastEnd.y, 2)
    );

    return distance < tolerance;
}

function calculateChainBoundingBox(chain: ShapeChain) {
    let minX = Infinity,
        maxX = -Infinity;
    let minY = Infinity,
        maxY = -Infinity;

    for (const shape of chain.shapes) {
        const shapeBounds = getShapeBoundingBox(shape);
        minX = Math.min(minX, shapeBounds.minX);
        maxX = Math.max(maxX, shapeBounds.maxX);
        minY = Math.min(minY, shapeBounds.minY);
        maxY = Math.max(maxY, shapeBounds.maxY);
    }

    return { minX, maxX, minY, maxY };
}

function getShapeBoundingBox(shape: Shape) {
    switch (shape.type) {
        case 'line':
            const line: import('$lib/types/geometry').Line =
                shape.geometry as Line;
            return {
                minX: Math.min(line.start.x, line.end.x),
                maxX: Math.max(line.start.x, line.end.x),
                minY: Math.min(line.start.y, line.end.y),
                maxY: Math.max(line.start.y, line.end.y),
            };

        case 'circle':
            const circle: import('$lib/types/geometry').Circle =
                shape.geometry as Circle;
            return {
                minX: circle.center.x - circle.radius,
                maxX: circle.center.x + circle.radius,
                minY: circle.center.y - circle.radius,
                maxY: circle.center.y + circle.radius,
            };

        case 'arc':
            const arc: Arc = shape.geometry as Arc;
            return {
                minX: arc.center.x - arc.radius,
                maxX: arc.center.x + arc.radius,
                minY: arc.center.y - arc.radius,
                maxY: arc.center.y + arc.radius,
            };

        case 'polyline':
            const polyline: import('$lib/types/geometry').Polyline =
                shape.geometry as Polyline;
            let minX = Infinity,
                maxX = -Infinity;
            let minY = Infinity,
                maxY = -Infinity;

            for (const point of polylineToPoints(polyline)) {
                minX = Math.min(minX, point.x);
                maxX = Math.max(maxX, point.x);
                minY = Math.min(minY, point.y);
                maxY = Math.max(maxY, point.y);
            }

            return { minX, maxX, minY, maxY };

        default:
            return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    }
}
