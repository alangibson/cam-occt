import { Shape } from '$lib/cam/shape/classes';
import { GeometryType } from '$lib/geometry/enums';
import { Chain } from '$lib/cam/chain/classes.svelte';
import { isChainClosed } from '$lib/cam/chain/functions';
import { reconstructChainFromSplit } from '$lib/cam/cut/cut-optimization-utils';
import { splitShapeAtMidpoint } from '$lib/cam/shape/functions';
import type { StartPointOptimizationParameters } from '$lib/cam/preprocess/algorithm-parameters';
import { DEFAULT_ARRAY_NOT_FOUND_INDEX } from '$lib/geometry/constants';

/**
 * Result of optimizing a single chain's start point
 */
interface OptimizeResult {
    originalChain: Chain;
    optimizedChain: Chain | null;
    modified: boolean;
    reason?: string;
}

/**
 * Finds the best shape to split in a chain, preferring simple shapes like lines and arcs
 */
function findBestShapeToSplit(shapes: Shape[]): number {
    // First pass: look for lines
    for (let i: number = 0; i < shapes.length; i++) {
        if (shapes[i].type === GeometryType.LINE) {
            return i;
        }
    }

    // Second pass: look for arcs
    for (let i: number = 0; i < shapes.length; i++) {
        if (shapes[i].type === GeometryType.ARC) {
            return i;
        }
    }

    // No splittable shapes found
    return DEFAULT_ARRAY_NOT_FOUND_INDEX;
}

/**
 * Optimizes the start point of a single chain
 */
export function optimizeChainStartPoint(
    chain: Chain,
    params: StartPointOptimizationParameters
): OptimizeResult {
    // Only process closed chains with multiple shapes
    if (!isChainClosed(chain, params.tolerance)) {
        return {
            originalChain: chain,
            optimizedChain: null,
            modified: false,
            reason: 'Chain is not closed',
        };
    }

    // Special handling for single-shape chains
    if (chain.shapes.length === 1) {
        return {
            originalChain: chain,
            optimizedChain: null,
            modified: false,
            reason: 'Single-shape chain cannot be optimized',
        };
    }

    // Find the best shape to split (prefer lines and arcs over complex shapes)
    const shapeIndexToSplit: number = findBestShapeToSplit(chain.shapes);

    if (shapeIndexToSplit === DEFAULT_ARRAY_NOT_FOUND_INDEX) {
        return {
            originalChain: chain,
            optimizedChain: null,
            modified: false,
            reason: 'No splittable shapes found',
        };
    }

    const shapeToSplit: Shape = chain.shapes[shapeIndexToSplit];
    const splitShapes: [Shape, Shape] | null =
        splitShapeAtMidpoint(shapeToSplit);

    if (!splitShapes) {
        return {
            originalChain: chain,
            optimizedChain: null,
            modified: false,
            reason: `Failed to split ${shapeToSplit.type} shape`,
        };
    }

    // Reconstruct the chain with the split shape
    const newShapes = reconstructChainFromSplit(
        chain.shapes,
        shapeIndexToSplit,
        splitShapes
    );

    // Create the optimized chain
    const optimizedChain = new Chain({
        id: chain.id,
        name: chain.name,
        originalChainId: chain.originalChainId,
        clockwise: chain.clockwise,
        shapes: newShapes.map((s) => s.toData()),
    });

    return {
        originalChain: chain,
        optimizedChain: optimizedChain,
        modified: true,
        reason: `Split ${shapeToSplit.type} at index ${shapeIndexToSplit}`,
    };
}

/**
 * Optimizes start points for all chains in the drawing
 * For plasma cutting, it's desirable to start at the midpoint of the first shape
 * in multi-shape closed chains to avoid piercing in narrow corners.
 *
 * @param chains - Array of shape chains to optimize
 * @param params - Optimization parameters including tolerance and split position
 * @returns Array of all shapes with optimized chains replacing original ones
 */
export function optimizeStartPoints(
    chains: Chain[],
    params: StartPointOptimizationParameters
): Shape[] {
    const results: OptimizeResult[] = [];
    const allShapes: Shape[] = [];

    // Process each chain
    for (const chain of chains) {
        const result: OptimizeResult = optimizeChainStartPoint(chain, params);
        results.push(result);

        // Use optimized chain if available, otherwise use original
        const chainToUse: Chain = result.optimizedChain || result.originalChain;
        allShapes.push(...chainToUse.shapes);
    }

    return allShapes;
}
