/**
 * Cut Start Point Optimization
 *
 * Optimizes the start point of cuts to avoid piercing in narrow corners.
 * Uses the same algorithm as chain start point optimization.
 */

import type { CutData } from '$lib/cam/cut/interfaces';
import { OptimizeStarts } from './enums';
import { optimizeChainStartPoint } from '$lib/algorithms/optimize-start-points/optimize-start-points';
import type { StartPointOptimizationParameters } from '$lib/preprocessing/algorithm-parameters';
import { Chain } from '$lib/cam/chain/classes';

/**
 * Optimizes the start point of a cut by optimizing its cutChain.
 *
 * @param cut - The cut to optimize
 * @param optimizeMode - The optimization mode (NONE or MIDPOINT)
 * @param tolerance - Tolerance for determining if a chain is closed
 * @returns A new Cut with optimized cutChain, or null if no optimization was performed
 */
export function optimizeCutStartPoint(
    cut: CutData,
    optimizeMode: OptimizeStarts,
    tolerance: number
): CutData | null {
    // Skip if optimization is disabled
    if (optimizeMode === OptimizeStarts.NONE) {
        return null;
    }

    // Skip if cut has no cutChain
    if (!cut.cutChain) {
        return null;
    }

    // Only MIDPOINT mode is currently supported
    if (optimizeMode !== OptimizeStarts.MIDPOINT) {
        return null;
    }

    // Create optimization parameters
    const params: StartPointOptimizationParameters = {
        tolerance,
        splitPosition: 'midpoint',
    };

    // Optimize the cut's chain
    const result = optimizeChainStartPoint(cut.cutChain, params);

    // If no optimization was performed, return null
    if (!result.modified || !result.optimizedChain) {
        return null;
    }

    // Return a new cut with the optimized chain
    return {
        ...cut,
        cutChain: new Chain(result.optimizedChain),
    };
}
