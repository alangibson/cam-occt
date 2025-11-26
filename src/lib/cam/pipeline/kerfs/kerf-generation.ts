/**
 * Kerf generation and adjustment orchestration
 */

import type { Cut } from '$lib/cam/cut/classes.svelte';
import type { Tool } from '$lib/cam/tool/interfaces';
import type { Chain } from '$lib/cam/chain/classes';
import type { Part } from '$lib/cam/part/classes.svelte';
import type { Kerf } from '$lib/cam/kerf/interfaces';
import {
    cutToKerf,
    adjustCutStartPointForLeadKerfOverlap,
} from '$lib/cam/kerf/functions';
import { kerfStore } from '$lib/stores/kerfs/store';
import type { KerfGenerationResult } from './interfaces';

/**
 * Adjust kerf to avoid lead overlap with the original chain
 *
 * This function:
 * 1. Checks if initial kerf has lead overlap
 * 2. Attempts to adjust start point if overlap detected
 * 3. Regenerates kerf with adjusted cut
 *
 * @param cut - The cut to generate kerf for (may be modified if adjustment succeeds)
 * @param tool - The tool providing kerf width
 * @param originalChain - The original chain before any offset
 * @param tolerance - Tolerance for chain closure detection
 * @param parts - Array of parts for determining part context (needed for correct normal calculation)
 * @param initialKerf - The initial kerf to check for overlap
 * @returns Result indicating whether adjustment was attempted and succeeded
 */
async function adjustKerfForLeadOverlap(
    cut: Cut,
    tool: Tool,
    originalChain: Chain,
    tolerance: number,
    parts: Part[],
    initialKerf: Kerf
): Promise<{
    adjustmentAttempted: boolean;
    adjustmentSucceeded: boolean;
    kerf: Kerf;
}> {
    // Check if lead kerf overlaps the original chain
    const hasOverlap =
        initialKerf.leadInKerfOverlapsChain ||
        initialKerf.leadOutKerfOverlapsChain;

    console.log(
        `[Operation] Lead kerf overlap detected for "${cut.name}": ${hasOverlap} (leadIn=${initialKerf.leadInKerfOverlapsChain}, leadOut=${initialKerf.leadOutKerfOverlapsChain})`
    );

    if (hasOverlap) {
        // Try to adjust start point to avoid overlap
        console.log(
            `[Operation] Attempting to adjust start point for cut "${cut.name}"`
        );

        const wasAdjusted = await adjustCutStartPointForLeadKerfOverlap(
            cut,
            tool,
            tolerance,
            parts
        );

        if (wasAdjusted) {
            // Cut was adjusted in place
            console.log(
                `[Operation] ✓ Start point adjustment SUCCEEDED for "${cut.name}"`
            );

            // Regenerate kerf with the adjusted cut (with overlap checking enabled)
            console.log(`[Operation] Regenerating kerf with adjusted cut`);
            const adjustedKerf = await cutToKerf(cut, tool, true);

            return {
                adjustmentAttempted: true,
                adjustmentSucceeded: true,
                kerf: adjustedKerf,
            };
        } else {
            // No solution found, use original kerf
            console.warn(
                `[Operation] ✗ Start point adjustment FAILED for "${cut.name}" - using original cut with overlap`
            );

            return {
                adjustmentAttempted: true,
                adjustmentSucceeded: false,
                kerf: initialKerf,
            };
        }
    } else {
        // No overlap
        console.log(`[Operation] No overlap detected for "${cut.name}"`);

        return {
            adjustmentAttempted: false,
            adjustmentSucceeded: false,
            kerf: initialKerf,
        };
    }
}

/**
 * Generate kerf for a cut and optionally adjust start point if
 * lead kerf overlaps.
 *
 * This function:
 * 1. Generates initial kerf
 * 2. Optionally checks for lead kerf overlap and adjusts if enabled
 * 3. Adds final kerf to store
 *
 * @param cut - The cut to generate kerf for (may be modified if adjustment succeeds)
 * @param tool - The tool providing kerf width
 * @param originalChain - The original chain before any offset
 * @param tolerance - Tolerance for chain closure detection
 * @param parts - Array of parts for determining part context (needed for correct normal calculation)
 * @param avoidLeadKerfOverlap - Whether to attempt adjusting start point if lead kerf overlaps
 * @returns Result indicating success and whether adjustment was performed
 */
export async function generateAndAdjustKerf(
    cut: Cut,
    tool: Tool,
    originalChain: Chain,
    tolerance: number,
    parts: Part[],
    avoidLeadKerfOverlap: boolean = false
): Promise<KerfGenerationResult> {
    console.log(`[Operation] Generating kerf for cut "${cut.name}"`);

    try {
        // Pass checkOverlap flag to cutToKerf - only check when avoidLeadKerfOverlap is enabled
        const kerf = await cutToKerf(cut, tool, avoidLeadKerfOverlap);

        let finalKerf = kerf;
        let adjustmentAttempted = false;
        let adjustmentSucceeded = false;

        // Only attempt adjustment if enabled
        if (avoidLeadKerfOverlap) {
            const adjustmentResult = await adjustKerfForLeadOverlap(
                cut,
                tool,
                originalChain,
                tolerance,
                parts,
                kerf
            );

            finalKerf = adjustmentResult.kerf;
            adjustmentAttempted = adjustmentResult.adjustmentAttempted;
            adjustmentSucceeded = adjustmentResult.adjustmentSucceeded;
        } else {
            console.log(
                `[Operation] Lead kerf overlap adjustment disabled - adding kerf as-is for "${cut.name}"`
            );
        }

        // Add final kerf to store
        kerfStore.addKerf(finalKerf);

        return {
            success: true,
            adjustmentAttempted,
            adjustmentSucceeded,
        };
    } catch (error) {
        console.error(
            `[Operation] Failed to generate kerf for cut "${cut.name}":`,
            error
        );
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}
