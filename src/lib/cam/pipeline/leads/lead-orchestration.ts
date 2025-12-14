/**
 * Lead orchestration - manages lead calculation for cuts and operations
 */

import { Cut } from '$lib/cam/cut/classes.svelte';
import type { Operation } from '$lib/cam/operation/classes.svelte';
import { Chain } from '$lib/cam/chain/classes.svelte';
import type { Part } from '$lib/cam/part/classes.svelte';
import type { PartVoid } from '$lib/cam/part/interfaces';
import { calculateLeads } from '$lib/cam/lead/lead-calculation';
import { prepareChainsAndLeadConfigs } from '$lib/cam/cut/cut-optimization-utils';
import type { CutLeadResult } from './interfaces';

/**
 * Calculate lead geometry for a cut
 */
export async function calculateCutLeads(
    cut: Cut,
    operation: Operation,
    chain: Chain,
    parts: Part[]
): Promise<CutLeadResult> {
    try {
        // Skip if both leads are disabled
        if (
            cut.leadInConfig?.type === 'none' &&
            cut.leadOutConfig?.type === 'none'
        ) {
            return {};
        }

        // Get the part if the cut is part of a part
        let part: Part | undefined;
        if (operation.targetType === 'parts') {
            part = parts?.find(
                (p) =>
                    p.shell.id === cut.sourceChainId ||
                    p.voids.some(
                        (h: PartVoid) => h.chain.id === cut.sourceChainId
                    )
            );
        }

        // Prepare lead calculation chain and configs using shared utility
        const { leadCalculationChain, leadInConfig, leadOutConfig } =
            prepareChainsAndLeadConfigs(cut, chain);

        // Calculate leads using the appropriate chain (original or offset)
        // Pass the cut's pre-calculated normal for consistency
        const leadResult: ReturnType<typeof calculateLeads> = calculateLeads(
            leadCalculationChain,
            leadInConfig,
            leadOutConfig,
            cut.direction,
            part,
            cut.normal
        );

        // Build the lead geometry result
        const leadGeometry: CutLeadResult = {};

        if (leadResult && leadResult.leadIn) {
            leadGeometry.leadIn = leadResult.leadIn;
        }

        if (leadResult && leadResult.leadOut) {
            leadGeometry.leadOut = leadResult.leadOut;
        }

        // Store validation results
        if (
            leadResult &&
            leadResult.warnings &&
            leadResult.warnings.length > 0
        ) {
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

        return leadGeometry;
    } catch (error) {
        // Failed to calculate leads for cut - lead calculation threw exception

        // Return error information
        return {
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
        };
    }
}

/**
 * Calculate leads for all cuts of an operation
 * Returns a map of cut IDs to lead geometry results
 */
export async function calculateOperationLeads(
    operation: Operation,
    cuts: Cut[],
    chains: Chain[],
    parts: Part[]
): Promise<Map<string, CutLeadResult>> {
    const leadResults = new Map<string, CutLeadResult>();

    try {
        // Find all cuts for this operation
        const operationCuts: Cut[] = cuts.filter(
            (c) => c.sourceOperationId === operation.id
        );

        // Calculate leads for each cut
        const calculations: Promise<void>[] = operationCuts.map(async (cut) => {
            const chain: Chain | undefined = chains.find(
                (c: Chain) => c.id === cut.sourceChainId
            );
            if (chain) {
                const leadGeometry = await calculateCutLeads(
                    cut,
                    operation,
                    chain,
                    parts
                );
                leadResults.set(cut.id, leadGeometry);
            }
        });

        // Wait for all calculations to complete
        await Promise.all(calculations);
    } catch {
        // Failed to calculate leads for operation - lead orchestration threw exception
    }

    return leadResults;
}
