/**
 * Kerf generation and adjustment orchestration
 */

import type { Cut } from '$lib/cam/cut/interfaces';
import type { Tool } from '$lib/cam/tool/interfaces';
import type { Chain } from '$lib/geometry/chain/interfaces';
import type { Part } from '$lib/cam/part/classes.svelte';
import {
    cutToKerf,
    adjustCutStartPointForLeadKerfOverlap,
} from '$lib/cam/kerf/functions';
import { kerfStore } from '$lib/stores/kerfs/store';
import type { KerfGenerationResult } from './interfaces';

/**
 * Generate kerf for a cut and automatically adjust start point if lead kerf overlaps
 *
 * This function:
 * 1. Generates initial kerf
 * 2. Checks for lead kerf overlap with original chain
 * 3. Attempts to adjust start point if overlap detected
 * 4. Adds final kerf to store
 *
 * @param cut - The cut to generate kerf for (may be modified if adjustment succeeds)
 * @param tool - The tool providing kerf width
 * @param originalChain - The original chain before any offset
 * @param tolerance - Tolerance for chain closure detection
 * @param parts - Array of parts for determining part context (needed for correct normal calculation)
 * @returns Result indicating success and whether adjustment was performed
 */
export async function generateAndAdjustKerf(
    cut: Cut,
    tool: Tool,
    originalChain: Chain,
    tolerance: number,
    parts: Part[]
): Promise<KerfGenerationResult> {
    console.log(`[Operation] Generating kerf for cut "${cut.name}"`);

    try {
        const kerf = await cutToKerf(cut, tool);

        // Check if lead kerf overlaps the original chain
        const hasOverlap =
            kerf.leadInKerfOverlapsChain || kerf.leadOutKerfOverlapsChain;

        console.log(
            `[Operation] Lead kerf overlap detected for "${cut.name}": ${hasOverlap} (leadIn=${kerf.leadInKerfOverlapsChain}, leadOut=${kerf.leadOutKerfOverlapsChain})`
        );

        if (hasOverlap) {
            // Try to adjust start point to avoid overlap
            console.log(
                `[Operation] Attempting to adjust start point for cut "${cut.name}"`
            );

            const adjustedCut = await adjustCutStartPointForLeadKerfOverlap(
                cut,
                tool,
                originalChain,
                tolerance,
                parts
            );

            if (adjustedCut) {
                // Use the adjusted cut - update the original cut object
                console.log(
                    `[Operation] ✓ Start point adjustment SUCCEEDED for "${cut.name}"`
                );
                Object.assign(cut, adjustedCut);

                // Regenerate kerf with the adjusted cut
                console.log(`[Operation] Regenerating kerf with adjusted cut`);
                const adjustedKerf = await cutToKerf(cut, tool);
                kerfStore.addKerf(adjustedKerf);

                return {
                    success: true,
                    adjustmentAttempted: true,
                    adjustmentSucceeded: true,
                };
            } else {
                // No solution found, use original cut but still add kerf for visualization
                console.warn(
                    `[Operation] ✗ Start point adjustment FAILED for "${cut.name}" - using original cut with overlap`
                );
                kerfStore.addKerf(kerf);

                return {
                    success: true,
                    adjustmentAttempted: true,
                    adjustmentSucceeded: false,
                };
            }
        } else {
            // No overlap, add kerf as-is
            console.log(
                `[Operation] No overlap detected - adding kerf as-is for "${cut.name}"`
            );
            kerfStore.addKerf(kerf);

            return {
                success: true,
                adjustmentAttempted: false,
            };
        }
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
