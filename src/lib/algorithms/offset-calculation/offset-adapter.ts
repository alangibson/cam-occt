/**
 * Offset Calculation Adapter
 *
 * Provides a unified interface to switch between offset calculation implementations:
 * - Exact: Existing TypeScript implementation that preserves curves
 * - Polyline: Clipper2 WASM implementation that tessellates to polylines
 */

import type { Chain } from '$lib/geometry/chain/interfaces';
import type { ChainOffsetResult, ChainOffsetParameters } from './chain/types';
import { offsetChain as exactOffset } from './chain/offset';
import { OffsetImplementation } from '$lib/config/settings/enums';

/**
 * Calculate chain offset using the specified implementation
 *
 * @param chain - The chain to offset
 * @param distance - Offset distance (positive for outward, negative for inward)
 * @param params - Offset parameters (tolerance, etc.)
 * @param implementation - Which implementation to use (Exact or Polyline)
 * @returns Promise resolving to offset result
 */
export async function offsetChainAdapter(
    chain: Chain,
    distance: number,
    params: ChainOffsetParameters,
    implementation: OffsetImplementation
): Promise<ChainOffsetResult> {
    if (implementation === OffsetImplementation.Polyline) {
        // Dynamic import to avoid loading WASM unless needed
        const { offsetChain: polylineOffset } = await import('$lib/cam/offset');
        return await polylineOffset(chain, distance, params);
    } else {
        // Use existing Exact implementation (synchronous, but wrapped in Promise for consistency)
        return exactOffset(chain, distance, params);
    }
}
