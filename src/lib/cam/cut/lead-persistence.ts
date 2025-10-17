/**
 * Lead Persistence Utilities
 *
 * Helper functions to calculate and store lead geometry in cuts for persistence.
 * When kerf compensation is enabled and offset geometry exists, leads are calculated
 * using the offset shapes instead of the original chain geometry.
 */

import type { Cut } from '$lib/cam/cut/interfaces';
import type { DetectedPart } from '$lib/algorithms/part-detection/part-detection';
import type { Chain } from '$lib/geometry/chain/interfaces';
import type { Point2D } from '$lib/types';
import { calculateLeads } from '$lib/algorithms/leads/lead-calculation';
import {
    type LeadConfig,
    type LeadResult,
} from '$lib/algorithms/leads/interfaces';
import { LeadType } from '$lib/types/direction';
import {
    createLeadInConfig,
    createLeadOutConfig,
    convertLeadGeometryToPoints,
} from '$lib/algorithms/leads/functions';
import { detectParts } from '$lib/algorithms/part-detection/part-detection';

/**
 * Check if cut has valid cached lead geometry
 */
export function hasValidCachedLeads(cut: Cut): boolean {
    const currentVersion: string = '1.0.0'; // Should match the version in cuts.ts

    // Check if we have cached lead geometry
    const hasLeadIn: boolean | undefined =
        cut.leadIn &&
        cut.leadIn.version === currentVersion &&
        convertLeadGeometryToPoints(cut.leadIn).length > 0;

    const hasLeadOut: boolean | undefined =
        cut.leadOut &&
        cut.leadOut.version === currentVersion &&
        convertLeadGeometryToPoints(cut.leadOut).length > 0;

    // Get lead types from config or use defaults
    const leadInType = cut.leadInConfig?.type || LeadType.NONE;
    const leadOutType = cut.leadOutConfig?.type || LeadType.NONE;

    // For lead-in: either no lead needed OR we have valid cached geometry that matches the type
    const leadInMatches: boolean | undefined =
        leadInType === LeadType.NONE
            ? true
            : hasLeadIn && cut.leadIn?.type === leadInType;

    // For lead-out: either no lead needed OR we have valid cached geometry that matches the type
    const leadOutMatches: boolean | undefined =
        leadOutType === LeadType.NONE
            ? true
            : hasLeadOut && cut.leadOut?.type === leadOutType;

    return Boolean(leadInMatches && leadOutMatches);
}

/**
 * Get cached lead geometry for display
 */
export function getCachedLeadGeometry(cut: Cut): LeadResult {
    return {
        leadIn: cut.leadIn,
        leadOut: cut.leadOut,
        validation: cut.leadValidation,
    };
}

/**
 * Calculate lead points for a cut using the fallback approach
 * This function encapsulates the common lead calculation logic used in multiple places
 */
export async function calculateLeadPoints(
    cut: Cut,
    chainMap: Map<string, Chain> | undefined,
    partMap: Map<string, DetectedPart> | undefined,
    leadType: 'leadIn' | 'leadOut'
): Promise<Point2D[] | undefined> {
    if (!chainMap || !partMap) {
        return undefined;
    }

    try {
        const chain = chainMap.get(cut.chainId);
        if (!chain) {
            return undefined;
        }

        const part = partMap.get(cut.chainId); // Part lookup for lead fitting
        const { chainForLeads, leadInConfig, leadOutConfig, offsetPart } =
            await prepareLeadCalculation(cut, chain);

        // Use offset-based part context if available, otherwise fall back to original part context
        const effectivePart = offsetPart || part;

        const leadResult = calculateLeads(
            chainForLeads,
            leadInConfig,
            leadOutConfig,
            cut.cutDirection,
            effectivePart,
            cut.normal
        );

        const lead =
            leadType === 'leadIn' ? leadResult.leadIn : leadResult.leadOut;

        if (lead) {
            const points = convertLeadGeometryToPoints(lead);
            if (points.length > 0) {
                return points;
            }
        }

        return undefined;
    } catch (error) {
        const actionName = leadType === 'leadIn' ? 'lead-in' : 'lead-out';
        console.warn(
            `Failed to calculate ${actionName} for G-code generation:`,
            cut.name,
            error
        );
        return undefined;
    }
}

/**
 * Helper function to prepare chain and configs for lead calculation
 * Moved here to be shared across different modules
 */
async function prepareLeadCalculation(
    cut: Cut,
    chain: Chain
): Promise<{
    chainForLeads: Chain;
    leadInConfig: LeadConfig;
    leadOutConfig: LeadConfig;
    offsetPart?: DetectedPart;
}> {
    // Use offset shapes for lead calculation if available
    const chainForLeads = cut.offset
        ? {
              ...chain,
              shapes: cut.offset.offsetShapes,
              clockwise: chain.clockwise,
              originalChainId: chain.id,
          }
        : chain;

    // Create lead configurations based on cut properties
    const leadInConfig = createLeadInConfig(cut);
    const leadOutConfig = createLeadOutConfig(cut);

    // If using offset geometry, create a DetectedPart from offset geometry for proper material avoidance
    let offsetPart: DetectedPart | undefined;
    if (cut.offset) {
        try {
            // Create a single-chain array for part detection on offset geometry
            const offsetChains = [chainForLeads];
            const partDetectionResult = await detectParts(offsetChains);

            // Use the first detected part (there should only be one for a single chain)
            if (partDetectionResult.parts.length > 0) {
                offsetPart = partDetectionResult.parts[0];
            }
        } catch (error) {
            console.warn(
                'Failed to create offset-based part context for lead calculation:',
                error
            );
            // Continue without offset part context - will fall back to original part context
        }
    }

    return { chainForLeads, leadInConfig, leadOutConfig, offsetPart };
}
