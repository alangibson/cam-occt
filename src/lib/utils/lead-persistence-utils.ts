/**
 * Lead Persistence Utilities
 *
 * Helper functions to calculate and store lead geometry in paths for persistence.
 * When kerf compensation is enabled and offset geometry exists, leads are calculated
 * using the offset shapes instead of the original chain geometry.
 */

import type { Path, PathsState } from '../stores/paths';
import type { Operation } from '../stores/operations';
import type {
    DetectedPart,
    PartHole,
} from '$lib/algorithms/part-detection/part-detection';
import type { Chain } from '../algorithms/chain-detection/chain-detection';
import type { Point2D } from '../types';
import {
    calculateLeads,
    type LeadInConfig,
    type LeadOutConfig,
} from '../algorithms/lead-calculation';
import { LeadType } from '../types/direction';
import { createLeadInConfig, createLeadOutConfig } from './lead-config-utils';
import { pathStore } from '../stores/paths';
import { get } from 'svelte/store';
import { chainStore, type ChainStore } from '../stores/chains';
import { partStore, type PartStore } from '$lib/stores/parts';

/**
 * Calculate and store lead geometry for a path
 */
export async function calculateAndStorePathLeads(
    path: Path,
    operation: Operation,
    chain: Chain,
    parts: DetectedPart[]
): Promise<void> {
    try {
        // Skip if both leads are disabled
        if (path.leadInType === 'none' && path.leadOutType === 'none') {
            return;
        }

        // Get the part if the path is part of a part
        let part: DetectedPart | undefined;
        if (operation.targetType === 'parts') {
            part = parts?.find(
                (p) =>
                    p.shell.chain.id === path.chainId ||
                    p.holes.some((h: PartHole) => h.chain.id === path.chainId)
            );
        }

        // Get lead configurations with proper defaults
        const leadInConfig = createLeadInConfig(path);
        const leadOutConfig = createLeadOutConfig(path);

        // Use offset geometry for lead calculation if available
        let leadCalculationChain: Chain = chain;
        let isUsingOffsetGeometry: boolean = false;
        if (
            path.calculatedOffset &&
            path.calculatedOffset.offsetShapes.length > 0
        ) {
            // Create a temporary chain from offset shapes
            leadCalculationChain = {
                id: chain.id + '_offset_temp',
                shapes: path.calculatedOffset.offsetShapes,
            };
            isUsingOffsetGeometry = true;
        }

        // Calculate leads using the appropriate chain (original or offset)
        const leadResult: ReturnType<typeof calculateLeads> = calculateLeads(
            leadCalculationChain,
            leadInConfig,
            leadOutConfig,
            path.cutDirection,
            part
        );

        // Store calculated geometry in the path
        const leadGeometry: Parameters<
            typeof pathStore.updatePathLeadGeometry
        >[1] = {};

        if (leadResult.leadIn) {
            leadGeometry.leadIn = {
                points: leadResult.leadIn.points,
                type: leadResult.leadIn.type,
            };
        }

        if (leadResult.leadOut) {
            leadGeometry.leadOut = {
                points: leadResult.leadOut.points,
                type: leadResult.leadOut.type,
            };
        }

        // Store validation results
        if (leadResult.warnings && leadResult.warnings.length > 0) {
            leadGeometry.validation = {
                isValid: true, // Has warnings but still valid
                warnings: leadResult.warnings,
                errors: [],
                severity: 'warning' as const,
            };
        } else {
            leadGeometry.validation = {
                isValid: true,
                warnings: [],
                errors: [],
                severity: 'info' as const,
            };
        }

        // Update the path with calculated lead geometry
        pathStore.updatePathLeadGeometry(path.id, leadGeometry);

        console.log(`Calculated and stored leads for path ${path.name}:`, {
            leadInPoints: leadResult.leadIn?.points?.length || 0,
            leadOutPoints: leadResult.leadOut?.points?.length || 0,
            warnings: leadResult.warnings?.length || 0,
            usedOffsetGeometry: isUsingOffsetGeometry,
            offsetShapeCount: path.calculatedOffset?.offsetShapes.length || 0,
        });
    } catch (error) {
        console.log(`Failed to calculate leads for path ${path.name}:`, error);

        // Store error information
        pathStore.updatePathLeadGeometry(path.id, {
            validation: {
                isValid: false,
                warnings: [],
                errors: [
                    error instanceof Error
                        ? (error as Error).message
                        : 'Unknown error',
                ],
                severity: 'error',
            },
        });
    }
}

/**
 * Check if path has valid cached lead geometry
 */
export function hasValidCachedLeads(path: Path): boolean {
    const currentVersion: string = '1.0.0'; // Should match the version in paths.ts

    // Check if we have cached lead geometry
    const hasLeadIn: boolean | undefined =
        path.calculatedLeadIn &&
        path.calculatedLeadIn.version === currentVersion &&
        path.calculatedLeadIn.points.length > 0;

    const hasLeadOut: boolean | undefined =
        path.calculatedLeadOut &&
        path.calculatedLeadOut.version === currentVersion &&
        path.calculatedLeadOut.points.length > 0;

    // For lead-in: either no lead needed OR we have valid cached geometry that matches the type
    const leadInMatches: boolean | undefined =
        path.leadInType === LeadType.NONE
            ? true
            : hasLeadIn && path.calculatedLeadIn?.type === path.leadInType;

    // For lead-out: either no lead needed OR we have valid cached geometry that matches the type
    const leadOutMatches: boolean | undefined =
        path.leadOutType === LeadType.NONE
            ? true
            : hasLeadOut && path.calculatedLeadOut?.type === path.leadOutType;

    return Boolean(leadInMatches && leadOutMatches);
}

/**
 * Get cached lead geometry for display
 */
export function getCachedLeadGeometry(path: Path) {
    return {
        leadIn: path.calculatedLeadIn
            ? {
                  points: path.calculatedLeadIn.points,
                  type: path.calculatedLeadIn.type,
              }
            : null,
        leadOut: path.calculatedLeadOut
            ? {
                  points: path.calculatedLeadOut.points,
                  type: path.calculatedLeadOut.type,
              }
            : null,
        validation: path.leadValidation,
    };
}

/**
 * Calculate and store leads for all paths of an operation
 */
export async function calculateAndStoreOperationLeads(
    operation: Operation
): Promise<void> {
    try {
        // Get current state
        const pathsState: PathsState = get(pathStore);
        const chainsState: ChainStore = get(chainStore);
        const partsState: PartStore = get(partStore);

        // Find all paths for this operation
        const operationPaths: Path[] = pathsState.paths.filter(
            (p) => p.operationId === operation.id
        );

        console.log(
            `Calculating leads for ${operationPaths.length} paths in operation ${operation.name}`
        );

        // Calculate leads for each path
        const calculations: Promise<void>[] = operationPaths.map(
            async (path) => {
                const chain: Chain | undefined = chainsState.chains.find(
                    (c: Chain) => c.id === path.chainId
                );
                if (chain) {
                    await calculateAndStorePathLeads(
                        path,
                        operation,
                        chain,
                        partsState.parts
                    );
                }
            }
        );

        // Wait for all calculations to complete
        await Promise.all(calculations);

        console.log(
            `Completed lead calculations for operation ${operation.name}`
        );
    } catch (error) {
        console.log(
            `Failed to calculate leads for operation ${operation.name}:`,
            error
        );
    }
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

        if (lead && lead.points.length > 0) {
            return lead.points;
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
    leadInConfig: LeadInConfig;
    leadOutConfig: LeadOutConfig;
} {
    // Use offset shapes for lead calculation if available
    const chainForLeads = path.calculatedOffset
        ? { ...chain, shapes: path.calculatedOffset.offsetShapes }
        : chain;

    // Create lead configurations based on path properties
    const leadInConfig = createLeadInConfig(path);
    const leadOutConfig = createLeadOutConfig(path);

    return { chainForLeads, leadInConfig, leadOutConfig };
}
