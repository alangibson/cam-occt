/**
 * Lead orchestration - manages lead calculation for cuts and operations
 */

import type { CutData } from '$lib/cam/cut/interfaces';
import { Cut } from '$lib/cam/cut/classes.svelte';
import type { OperationData } from '$lib/cam/operation/interface';
import type { ChainData } from '$lib/geometry/chain/interfaces';
import { Chain } from '$lib/geometry/chain/classes';
import type { Part, PartData, PartVoid } from '$lib/cam/part/interfaces';
import { calculateLeads } from '$lib/cam/lead/lead-calculation';
import { prepareChainsAndLeadConfigs } from '$lib/cam/cut/cut-optimization-utils';
import type { CutLeadResult } from './interfaces';

/**
 * Calculate lead geometry for a cut
 */
export async function calculateCutLeads(
    cut: CutData,
    operation: OperationData,
    chain: ChainData,
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
        let part: PartData | undefined;
        if (operation.targetType === 'parts') {
            part = parts?.find(
                (p) =>
                    p.shell.id === cut.chainId ||
                    p.voids.some((h: PartVoid) => h.chain.id === cut.chainId)
            );
        }

        // Prepare lead calculation chain and configs using shared utility
        const { leadCalculationChain, leadInConfig, leadOutConfig } =
            prepareChainsAndLeadConfigs(new Cut(cut), new Chain(chain));

        // Calculate leads using the appropriate chain (original or offset)
        // Pass the cut's pre-calculated normal for consistency
        const leadResult: ReturnType<typeof calculateLeads> = calculateLeads(
            leadCalculationChain,
            leadInConfig,
            leadOutConfig,
            cut.cutDirection,
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
        console.error(`Failed to calculate leads for cut ${cut.name}:`, error);

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
    operation: OperationData,
    cuts: CutData[],
    chains: ChainData[],
    parts: Part[]
): Promise<Map<string, CutLeadResult>> {
    const leadResults = new Map<string, CutLeadResult>();

    try {
        // Find all cuts for this operation
        const operationCuts: CutData[] = cuts.filter(
            (c) => c.operationId === operation.id
        );

        // Calculate leads for each cut
        const calculations: Promise<void>[] = operationCuts.map(async (cut) => {
            const chain: ChainData | undefined = chains.find(
                (c: ChainData) => c.id === cut.chainId
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
    } catch (error) {
        console.error(
            `Failed to calculate leads for operation ${operation.name}:`,
            error
        );
    }

    return leadResults;
}
