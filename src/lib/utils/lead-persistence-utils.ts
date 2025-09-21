/**
 * Lead Persistence Utilities
 *
 * Helper functions to calculate and store lead geometry in paths for persistence.
 * When kerf compensation is enabled and offset geometry exists, leads are calculated
 * using the offset shapes instead of the original chain geometry.
 */

import type { Path } from '$lib/stores/paths/interfaces';
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

/**
 * Check if path has valid cached lead geometry
 */
export function hasValidCachedLeads(path: Path): boolean {
    const currentVersion: string = '1.0.0'; // Should match the version in paths.ts

    // Check if we have cached lead geometry
    const hasLeadIn: boolean | undefined =
        path.leadIn &&
        path.leadIn.version === currentVersion &&
        convertLeadGeometryToPoints(path.leadIn).length > 0;

    const hasLeadOut: boolean | undefined =
        path.leadOut &&
        path.leadOut.version === currentVersion &&
        convertLeadGeometryToPoints(path.leadOut).length > 0;

    // Get lead types from config or use defaults
    const leadInType = path.leadInConfig?.type || LeadType.NONE;
    const leadOutType = path.leadOutConfig?.type || LeadType.NONE;

    // For lead-in: either no lead needed OR we have valid cached geometry that matches the type
    const leadInMatches: boolean | undefined =
        leadInType === LeadType.NONE
            ? true
            : hasLeadIn && path.leadIn?.type === leadInType;

    // For lead-out: either no lead needed OR we have valid cached geometry that matches the type
    const leadOutMatches: boolean | undefined =
        leadOutType === LeadType.NONE
            ? true
            : hasLeadOut && path.leadOut?.type === leadOutType;

    return Boolean(leadInMatches && leadOutMatches);
}

/**
 * Get cached lead geometry for display
 */
export function getCachedLeadGeometry(path: Path): LeadResult {
    return {
        leadIn: path.leadIn,
        leadOut: path.leadOut,
        validation: path.leadValidation,
    };
}

/**
 * Calculate lead points for a path using the fallback approach
 * This function encapsulates the common lead calculation logic used in multiple places
 */
export function calculateLeadPoints(
    path: Path,
    chainMap: Map<string, Chain> | undefined,
    partMap: Map<string, DetectedPart> | undefined,
    leadType: 'leadIn' | 'leadOut'
): Point2D[] | undefined {
    if (!chainMap || !partMap) {
        return undefined;
    }

    try {
        const chain = chainMap.get(path.chainId);
        if (!chain) {
            return undefined;
        }

        const part = partMap.get(path.chainId); // Part lookup for lead fitting
        const { chainForLeads, leadInConfig, leadOutConfig } =
            prepareLeadCalculation(path, chain);

        const leadResult = calculateLeads(
            chainForLeads,
            leadInConfig,
            leadOutConfig,
            path.cutDirection,
            part
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
            path.name,
            error
        );
        return undefined;
    }
}

/**
 * Helper function to prepare chain and configs for lead calculation
 * Moved here to be shared across different modules
 */
function prepareLeadCalculation(
    path: Path,
    chain: Chain
): {
    chainForLeads: Chain;
    leadInConfig: LeadConfig;
    leadOutConfig: LeadConfig;
} {
    // Use offset shapes for lead calculation if available
    const chainForLeads = path.offset
        ? { ...chain, shapes: path.offset.offsetShapes }
        : chain;

    // Create lead configurations based on path properties
    const leadInConfig = createLeadInConfig(path);
    const leadOutConfig = createLeadOutConfig(path);

    return { chainForLeads, leadInConfig, leadOutConfig };
}
