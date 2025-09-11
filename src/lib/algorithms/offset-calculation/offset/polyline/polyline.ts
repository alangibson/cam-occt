import type { Chain } from '$lib/geometry/chain/interfaces';
import { generateId } from '$lib/domain/id';
import { GeometryType, type Polyline, type Shape } from '$lib/types/geometry';
import { offsetChain } from '../../chain/offset';
import type {
    ChainOffsetParameters,
    ChainOffsetResult,
} from '../../chain/types';
import { OffsetDirection, type OffsetResult } from '../types';

/**
 * Offset a polyline using the chain offset system
 *
 * CRITICAL: Polylines use chain offsetting to ensure geometrically correct offsets.
 * The chain offset system has sophisticated side detection that properly determines
 * offset directions based on shape geometry, not just individual segment directions.
 *
 * @param polyline - The polyline to offset
 * @param distance - Offset distance (positive = outward, negative = inward)
 * @param direction - Offset direction (inset/outset)
 * @returns Result containing the offset polyline
 */
export function offsetPolyline(
    polyline: Polyline,
    distance: number,
    direction: OffsetDirection
): OffsetResult {
    if (direction === 'none' || distance === 0) {
        return {
            success: true,
            shapes: [],
            warnings: [],
            errors: [],
        };
    }

    try {
        // Convert polyline to chain format for proper offset processing
        const chain: Chain = {
            id: generateId(),
            shapes: polyline.shapes.map((shape) => ({
                ...shape,
                id: shape.id || generateId(),
            })),
            // closed: polyline.closed
        };

        // Apply direction-based distance for chain offset
        const offsetDistance: number =
            direction === 'outset' ? Math.abs(distance) : -Math.abs(distance);

        // Use chain offset system with parameters that enable gap filling
        const chainParams: ChainOffsetParameters = {
            tolerance: 0.1,
            maxExtension: 50,
            snapThreshold: 0.5,
        };

        const chainResult: ChainOffsetResult = offsetChain(
            chain,
            offsetDistance,
            chainParams
        );

        if (!chainResult.success) {
            return {
                success: false,
                shapes: [],
                warnings: chainResult.warnings || [],
                errors: chainResult.errors || ['Chain offset failed'],
            };
        }

        // Convert chain offset result back to polyline format
        const offsetPolylines: Shape[] = [];

        // For polylines, select the appropriate offset chain based on direction
        const targetChain: Chain | undefined =
            direction === 'outset'
                ? chainResult.outerChain || chainResult.innerChain
                : chainResult.innerChain || chainResult.outerChain;

        if (targetChain && targetChain.shapes.length > 0) {
            const offsetPolyline: Shape = {
                id: generateId(),
                type: GeometryType.POLYLINE,
                geometry: {
                    closed: polyline.closed,
                    shapes: targetChain.shapes,
                } as Polyline,
            };
            offsetPolylines.push(offsetPolyline);
        }

        return {
            success: true,
            shapes: offsetPolylines,
            warnings: chainResult.warnings || [],
            errors: [],
        };
    } catch (error) {
        return {
            success: false,
            shapes: [],
            warnings: [],
            errors: [
                `Polyline offset failed: ${error instanceof Error ? (error as Error).message : String(error)}`,
            ],
        };
    }
}

// All polyline offsetting now delegates to the chain offset algorithm
// This ensures consistent geometric analysis for all complex shapes
