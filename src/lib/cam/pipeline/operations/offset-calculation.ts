/**
 * Offset calculation for chain kerf compensation
 */

import type { Chain } from '$lib/geometry/chain/interfaces';
import type { Tool } from '$lib/cam/tool/interfaces';
import type { Shape } from '$lib/geometry/shape/interfaces';
import type { GapFillingResult } from '$lib/algorithms/offset-calculation/chain/types';
import { OffsetDirection } from '$lib/algorithms/offset-calculation/offset/types';
import { offsetChainAdapter } from '$lib/algorithms/offset-calculation/offset-adapter';
import {
    DIRECTION_CLOCKWISE,
    DIRECTION_COUNTERCLOCKWISE,
} from '$lib/geometry/constants';
import { getToolValue } from '$lib/cam/tool/tool-utils';
import { settingsStore } from '$lib/stores/settings/store';
import { get } from 'svelte/store';
import type { ChainOffsetResult } from './interfaces';

/**
 * Calculate chain offset for kerf compensation.
 * Returns offset result with warnings instead of directly updating stores.
 */
export async function calculateChainOffset(
    chain: Chain,
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
        // Get offset implementation setting
        const settings = get(settingsStore).settings;

        // Call offset calculation via adapter
        // For inset, use negative distance; for outset, use positive
        const direction: number =
            kerfCompensation === OffsetDirection.INSET
                ? DIRECTION_CLOCKWISE
                : DIRECTION_COUNTERCLOCKWISE;
        const offsetResult = await offsetChainAdapter(
            chain,
            offsetDistance * direction,
            {
                tolerance: 0.1,
                maxExtension: 50,
                snapThreshold: 0.5,
            },
            settings.offsetImplementation
        );

        if (!offsetResult.success) {
            console.warn('Offset calculation failed', offsetResult.errors);
            return null;
        }

        // Use the appropriate offset chain based on direction
        let selectedChain: Shape[];
        let selectedGapFills: GapFillingResult[] | undefined;

        if (kerfCompensation === OffsetDirection.INSET) {
            selectedChain = offsetResult.innerChain?.shapes || [];
            selectedGapFills = offsetResult.innerChain?.gapFills;
        } else {
            selectedChain = offsetResult.outerChain?.shapes || [];
            selectedGapFills = offsetResult.outerChain?.gapFills;
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
        const finalOffsetShapes: Shape[] = selectedChain;

        return {
            offsetShapes: finalOffsetShapes,
            originalShapes: chain.shapes,
            kerfWidth: kerfWidth,
            gapFills: selectedGapFills,
            warnings: offsetResult.warnings || [],
        };
    } catch (error) {
        console.error('Error calculating offset:', error);
        return null;
    }
}
