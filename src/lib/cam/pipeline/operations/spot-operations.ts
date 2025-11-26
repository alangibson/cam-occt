/**
 * Spot operations module - handles spot cut generation for cyclic chains
 */

import { Chain } from '$lib/cam/chain/classes';
import { Cut } from '$lib/cam/cut/classes.svelte';
import { CutDirection, NormalSide } from '$lib/cam/cut/enums';
import type { CutGenerationResult } from './interfaces';
import type { Operation } from '$lib/cam/operation/classes.svelte';
import { GeometryType } from '$lib/geometry/enums';
import { Shape } from '$lib/cam/shape/classes';

/**
 * Generate a spot cut for a single cyclic chain with an operation
 *
 * @param operation - The operation defining spot parameters (contains tool and targets)
 * @param index - Index of this target in the operation's target list
 * @param tolerance - Tolerance for geometric operations
 * @returns Promise of cut generation result with cuts and warnings
 */
export async function generateSpotsForChainsWithOperation(
    operation: Operation,
    index: number
): Promise<CutGenerationResult> {
    // Get chain from operation targets
    const chain = operation.targets[index] as Chain;
    const tool = operation.tool;

    // Return empty arrays if chain not found or tool missing
    if (!chain || !tool) {
        return { cuts: [], warnings: [] };
    }

    const targetId = chain.id;

    // Calculate centroid using Chain's centerPoint method
    const chainObj = new Chain(chain);
    const centroid = chainObj.centerPoint();

    // Create a single-point shape at the centroid
    const pointShape = new Shape({
        id: crypto.randomUUID(),
        type: GeometryType.POINT,
        geometry: centroid,
        layer: chain.shapes[0]?.layer,
    });

    // Create a chain containing only the point
    const spotChain = new Chain({
        id: crypto.randomUUID(),
        shapes: [pointShape],
        clockwise: null, // Points have no direction
    });

    // Extract chain number from targetId format: layername-chain-number
    const chainIdParts = targetId.split('-');
    const chainNumber = chainIdParts[chainIdParts.length - 1];

    // Create the spot cut object with minimal fields
    const spotCut = new Cut({
        id: crypto.randomUUID(),
        name: `${operation.name} - Chain ${chainNumber} (Spot)`,
        operationId: operation.id,
        chainId: targetId,
        toolId: tool.id,
        enabled: true,
        order: index + 1,
        action: operation.action,
        spotDuration: operation.spotDuration,
        cutDirection: CutDirection.NONE, // Spots have no direction
        executionClockwise: null, // Spots have no direction
        cutChain: spotChain,
        normal: { x: 0, y: 0 }, // Spots don't need normals
        normalConnectionPoint: centroid,
        normalSide: NormalSide.LEFT, // Arbitrary for spots
        isHole: false,
    });

    return {
        cuts: [spotCut],
        warnings: [],
    };
}
