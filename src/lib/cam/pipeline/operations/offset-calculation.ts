/**
 * Offset calculation for chain kerf compensation
 */

import type { ChainData } from '$lib/cam/chain/interfaces';
import type { Tool } from '$lib/cam/tool/interfaces';
import type { ShapeData } from '$lib/cam/shape/interfaces';
import { Shape } from '$lib/cam/shape/classes';
import { OffsetDirection } from '$lib/cam/offset/types';
import { offsetChain as polylineOffset } from '$lib/cam/offset';
import {
    DIRECTION_CLOCKWISE,
    DIRECTION_COUNTERCLOCKWISE,
} from '$lib/geometry/constants';
import { getToolValue } from '$lib/cam/tool/tool-utils';
import type { ChainOffsetResult } from './interfaces';

/**
 * Calculate chain offset for kerf compensation.
 * Returns offset result with warnings instead of directly updating stores.
 */
export async function calculateChainOffset(
    chain: ChainData,
    kerfCompensation: OffsetDirection,
    toolId: string | null,
    tools: Tool[]
): Promise<ChainOffsetResult | null> {
    if (
        !kerfCompensation ||
        kerfCompensation === OffsetDirection.NONE ||
        !toolId
    ) {
        return null;
    }

    // Find tool by ID
    const tool = tools.find((t) => t.id === toolId);
    if (!tool) {
        console.warn('Tool not found for kerf compensation');
        return null;
    }
    const kerfWidth = getToolValue(tool, 'kerfWidth');
    if (!kerfWidth || kerfWidth <= 0) {
        console.warn(`Tool "${tool.toolName}" has no kerf width set`);
        return null;
    }

    // Calculate offset distance (kerf/2)
    const offsetDistance: number = kerfWidth / 2;

    try {
        // Call polyline offset directly
        // For inset, use negative distance; for outset, use positive
        const direction: number =
            kerfCompensation === OffsetDirection.INSET
                ? DIRECTION_CLOCKWISE
                : DIRECTION_COUNTERCLOCKWISE;
        const offsetResult = await polylineOffset(
            chain,
            offsetDistance * direction,
            {
                tolerance: 0.1,
                maxExtension: 50,
                snapThreshold: 0.5,
            }
        );

        if (!offsetResult.success) {
            console.warn('Offset calculation failed', offsetResult.errors);
            return null;
        }

        // Use the appropriate offset chain based on direction
        let selectedChain: ShapeData[];

        if (kerfCompensation === OffsetDirection.INSET) {
            selectedChain = offsetResult.innerChain?.shapes || [];
        } else {
            selectedChain = offsetResult.outerChain?.shapes || [];
        }

        if (!selectedChain || selectedChain.length === 0) {
            console.warn(
                'No appropriate offset chain found for direction:',
                kerfCompensation
            );
            return null;
        }

        // offsetChain already returns polylines correctly for single polyline inputs
        // No additional wrapping needed
        const finalOffsetShapes: Shape[] = selectedChain.map(
            (s) => new Shape(s)
        );

        return {
            offsetShapes: finalOffsetShapes,
            originalShapes: chain.shapes.map((s) => new Shape(s)),
            kerfWidth: kerfWidth,
            warnings: offsetResult.warnings || [],
        };
    } catch (error) {
        console.error('Error calculating offset:', error);
        return null;
    }
}
