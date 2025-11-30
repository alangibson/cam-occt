/**
 * Cut Start Point Optimization
 *
 * Optimizes the start point of cuts to avoid piercing in narrow corners.
 * Uses the same algorithm as chain start point optimization.
 */

import type { Cut } from '$lib/cam/cut/classes.svelte';
import { OptimizeStarts } from './enums';
import { optimizeChainStartPoint } from '$lib/algorithms/optimize-start-points/optimize-start-points';
import type { StartPointOptimizationParameters } from '$lib/cam/preprocess/algorithm-parameters';
import { Chain } from '$lib/cam/chain/classes';

/**
 * Optimizes the start point of a cut by optimizing its cutChain.
 * Mutates the cut in place if optimization is applied.
 *
 * @param cut - The cut to optimize (mutated in place if optimization succeeds)
 * @param optimizeMode - The optimization mode (NONE or MIDPOINT)
 * @param tolerance - Tolerance for determining if a chain is closed
 * @returns true if optimization was performed, false otherwise
 */
export function optimizeCutStartPoint(
    cut: Cut,
    optimizeMode: OptimizeStarts,
    tolerance: number
): boolean {
    // Skip if optimization is disabled
    if (optimizeMode === OptimizeStarts.NONE) {
        return false;
    }

    // Skip if cut has no cutChain
    if (!cut.cutChain) {
        return false;
    }

    // Only MIDPOINT mode is currently supported
    if (optimizeMode !== OptimizeStarts.MIDPOINT) {
        return false;
    }

    // Create optimization parameters
    const params: StartPointOptimizationParameters = {
        tolerance,
        splitPosition: 'midpoint',
    };

    // Optimize the cut's chain
    const result = optimizeChainStartPoint(cut.cutChain, params);

    // If no optimization was performed, return false
    if (!result.modified || !result.optimizedChain) {
        return false;
    }

    // Mutate the cut with the optimized chain
    cut.cutChain = new Chain(result.optimizedChain);
    return true;
}
