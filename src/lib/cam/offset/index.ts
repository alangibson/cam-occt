/**
 * Clipper2-Based Offset System - Main Entry Point
 *
 * This module provides an alternative implementation of chain offsetting using the
 * Clipper2 WASM library. It offers the same API as the existing offset system but
 * uses industry-standard Clipper2 for robust offsetting.
 *
 * Key differences from existing system:
 * - Async API (required for WASM initialization)
 * - All shapes tessellated to polylines before offsetting
 * - Output is always polylines (no analytical curves)
 * - Automatic handling of trimming/gap-filling (done by Clipper2)
 */

import type { Point2D } from '$lib/geometry/point/interfaces';
import type { ChainData } from '$lib/cam/chain/interfaces';
import { Chain } from '$lib/cam/chain/classes';
import {
    isChainClosed,
    tessellateChainToShapes,
} from '$lib/cam/chain/functions';
import { offsetPaths } from './clipper-offset';
import { reconstructChain, createOffsetChain } from './reconstruct';
import type { ChainOffsetParameters, ChainOffsetResult } from './types';
import { DEFAULT_CHAIN_OFFSET_PARAMETERS } from './defaults';
import { getDefaults } from '$lib/config/defaults/defaults-manager';

/**
 * Offset a chain using Clipper2
 *
 * This function tessellates all shapes in the chain to polylines, offsets them
 * using Clipper2's robust offsetting algorithm, and reconstructs the results as
 * MetalHead shapes.
 *
 * @param chain - The chain to offset
 * @param distance - Offset distance (positive value, direction determined by chain geometry)
 * @param params - Offset parameters (tolerance, etc.)
 * @returns Promise resolving to ChainOffsetResult with inner/outer or left/right chains
 *
 * @example
 * ```typescript
 * const result = await offsetChain(myChain, 5.0);
 * if (result.success) {
 *   console.log('Inner chain:', result.innerChain);
 *   console.log('Outer chain:', result.outerChain);
 * }
 * ```
 */
export async function offsetChain(
    chain: ChainData,
    distance: number,
    params: ChainOffsetParameters = DEFAULT_CHAIN_OFFSET_PARAMETERS
): Promise<ChainOffsetResult> {
    const startTime = performance.now();
    const result: ChainOffsetResult = {
        success: false,
        warnings: [],
        errors: [],
    };

    try {
        // 1. Determine if chain is closed
        const chainObj = new Chain(chain);
        const isClosed = isChainClosed(chainObj, params.tolerance);

        // 2. Tessellate all shapes to polylines
        const CIRCLE_POINTS = 32;
        const DECIMAL_PRECISION = 3;
        const SKIP_LAST_POINT = -1;

        const shapePointArrays = tessellateChainToShapes(chainObj, {
            circleTessellationPoints: CIRCLE_POINTS,
            tessellationTolerance: getDefaults().geometry.tessellationTolerance,
            decimalPrecision: DECIMAL_PRECISION,
            enableTessellation: false,
        });

        // For closed chains, merge all shape point arrays into a single continuous path
        // For open chains, keep them separate
        let pointArrays: Point2D[][];
        if (isClosed && shapePointArrays.length > 1) {
            // Merge all points into one continuous path
            const mergedPoints: Point2D[] = [];
            for (const points of shapePointArrays) {
                // Skip the last point of each shape except the last shape (to avoid duplicates at joins)
                const pointsToAdd = points.slice(0, SKIP_LAST_POINT);
                mergedPoints.push(...pointsToAdd);
            }
            pointArrays = [mergedPoints];
        } else {
            pointArrays = shapePointArrays;
        }

        // 3. Call Clipper2 offset (async because WASM initialization)
        const { inner, outer } = await offsetPaths(
            pointArrays,
            Math.abs(distance),
            isClosed
        );

        // 4. Reconstruct shapes from Clipper2 results
        const innerShapes = reconstructChain(inner);
        const outerShapes = reconstructChain(outer);

        // 5. Build OffsetChain results
        if (isClosed) {
            // Closed chains have inner and outer offsets
            result.innerChain = createOffsetChain(
                innerShapes,
                'inner',
                chain.id,
                true
            );
            result.outerChain = createOffsetChain(
                outerShapes,
                'outer',
                chain.id,
                true
            );
        } else {
            // Open chains have left and right offsets
            result.innerChain = createOffsetChain(
                innerShapes,
                'left',
                chain.id,
                false
            );
            result.outerChain = createOffsetChain(
                outerShapes,
                'right',
                chain.id,
                false
            );
        }

        result.success = true;
        result.metrics = {
            totalShapes: chain.shapes.length,
            intersectionsFound: 0, // N/A for Clipper2
            gapsFilled: 0, // N/A for Clipper2
            processingTimeMs: performance.now() - startTime,
        };
    } catch (error) {
        result.errors.push(
            `Clipper2 offset failed: ${error instanceof Error ? error.message : String(error)}`
        );
    }

    return result;
}
