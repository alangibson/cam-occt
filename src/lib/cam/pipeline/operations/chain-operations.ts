/**
 * Chain operations module - handles cut generation for individual chains
 */

import { Chain } from '$lib/cam/chain/classes';
import { CutDirection, OptimizeStarts } from '$lib/cam/cut/enums';
import { createCutChain } from '$lib/cam/pipeline/chains/functions';
import { OffsetDirection } from '$lib/cam/offset/types';
import type { Part } from '$lib/cam/part/classes.svelte';
import { Cut } from '$lib/cam/cut/classes.svelte';
import { calculateCutNormal } from '$lib/cam/cut/calculate-cut-normal';
import { findPartContainingChain } from '$lib/cam/part/chain-part-interactions';
import { optimizeCutStartPoint } from '$lib/cam/cut/optimize-cut-start-point';
import { getToolValue } from '$lib/cam/tool/tool-utils';
import { calculateChainOffset } from '$lib/cam/pipeline/operations/offset-calculation';
import { calculateCutLeads } from '$lib/cam/pipeline/leads/lead-orchestration';
import type { OffsetCalculation, CutGenerationResult } from './interfaces';
import type { Operation } from '$lib/cam/operation/classes.svelte';
import { KerfCompensation } from '$lib/cam/operation/enums';

/**
 * Generate a cut for a single chain with an operation
 *
 * @param operation - The operation defining cut parameters (contains tool and targets)
 * @param index - Index of this target in the operation's target list
 * @param tolerance - Tolerance for geometric operations
 * @returns Promise of cut generation result with cuts and warnings
 */
export async function generateCutsForChainsWithOperation(
    operation: Operation,
    index: number,
    tolerance: number
): Promise<CutGenerationResult> {
    // Get chain from operation targets
    const chain = operation.targets[index] as Chain;
    const tool = operation.tool;

    // Return empty arrays if chain not found or tool missing
    if (!chain || !tool) {
        return { cuts: [], warnings: [] };
    }

    const targetId = chain.id;

    // Get all parts from operation targets (for finding part containing chain)
    const parts: Part[] = operation.targets.filter(
        (t) => !('shapes' in t)
    ) as Part[];
    const cutDirection: CutDirection = operation.cutDirection;

    // Convert KerfCompensation to OffsetDirection for chains
    let kerfCompensation: OffsetDirection = OffsetDirection.NONE;
    if (operation.kerfCompensation) {
        switch (operation.kerfCompensation) {
            case KerfCompensation.INNER:
                kerfCompensation = OffsetDirection.INSET;
                break;
            case KerfCompensation.OUTER:
                kerfCompensation = OffsetDirection.OUTSET;
                break;
            case KerfCompensation.PART:
                // For standalone chains, part mode doesn't make sense, treat as none
                kerfCompensation = OffsetDirection.NONE;
                break;
            case KerfCompensation.NONE:
            default:
                kerfCompensation = OffsetDirection.NONE;
                break;
        }
    }

    // Calculate offset if kerf compensation is enabled
    let calculatedOffset: OffsetCalculation | undefined = undefined;
    let warningsToReturn: {
        chainId: string;
        operationId: string;
        offsetWarnings: string[];
        clearExistingWarnings: boolean;
    } | null = null;

    if (kerfCompensation !== OffsetDirection.NONE && chain && tool) {
        const offsetResult = await calculateChainOffset(
            chain,
            kerfCompensation,
            tool.id,
            [tool]
        );
        if (offsetResult) {
            // Prepare warnings for return instead of directly updating stores
            warningsToReturn = {
                chainId: targetId,
                operationId: operation.id,
                offsetWarnings: offsetResult.warnings || [],
                clearExistingWarnings: true,
            };

            calculatedOffset = {
                offsetShapes: offsetResult.offsetShapes,
                originalShapes: offsetResult.originalShapes,
                direction: kerfCompensation,
                kerfWidth: offsetResult.kerfWidth,
                generatedAt: new Date().toISOString(),
                version: '1.0.0',
            };
        }
    }

    // Create execution chain with correct ordering
    let cutChain: Chain | undefined = undefined;
    let executionClockwise: boolean | null = null;
    if (chain) {
        const cutChainResult = createCutChain(
            new Chain(chain),
            cutDirection,
            calculatedOffset?.offsetShapes
        );
        cutChain = cutChainResult.cutChain;
        executionClockwise = cutChainResult.executionClockwise;
    }

    // Calculate cut normal (must happen before creating the cut object)
    if (!cutChain) {
        throw new Error('Cannot create cut: cutChain is undefined');
    }
    const part = findPartContainingChain(targetId, parts);
    const cutNormalResult = calculateCutNormal(
        cutChain,
        cutDirection,
        part,
        kerfCompensation
    );

    // Get kerf width from tool (needed for cutter visualization even when compensation is NONE)
    let kerfWidth: number | undefined = undefined;
    if (tool) {
        const toolKerfWidth = getToolValue(tool, 'kerfWidth');
        if (toolKerfWidth) {
            kerfWidth = toolKerfWidth;
        }
    }

    // Create the cut object
    // Extract chain number from targetId format: layername-chain-number
    const chainIdParts = targetId.split('-');
    const chainNumber = chainIdParts[chainIdParts.length - 1];
    const cutToReturn = new Cut({
        id: crypto.randomUUID(),
        name: `${operation.name} - Chain ${chainNumber}`,
        operationId: operation.id,
        chainId: targetId,
        toolId: tool.id,
        enabled: true,
        order: index + 1,
        action: operation.action,
        cutDirection: cutDirection,
        executionClockwise: executionClockwise,
        leadInConfig: operation.leadInConfig,
        leadOutConfig: operation.leadOutConfig,
        kerfCompensation: kerfCompensation,
        kerfWidth: kerfWidth,
        offset: calculatedOffset,
        cutChain: cutChain,
        isHole: false,
        holeUnderspeedPercent: undefined,
        normal: cutNormalResult.normal,
        normalConnectionPoint: cutNormalResult.connectionPoint,
        normalSide: cutNormalResult.normalSide,
    });

    // Optimize start point if enabled
    if (
        operation.optimizeStarts &&
        operation.optimizeStarts !== OptimizeStarts.NONE
    ) {
        const wasOptimized = optimizeCutStartPoint(
            cutToReturn,
            operation.optimizeStarts,
            tolerance
        );
        if (wasOptimized) {
            // Recalculate normal with the new start point
            const newCutNormalResult = calculateCutNormal(
                cutToReturn.cutChain!,
                cutDirection,
                part,
                kerfCompensation
            );
            cutToReturn.normal = newCutNormalResult.normal;
            cutToReturn.normalConnectionPoint =
                newCutNormalResult.connectionPoint;
            cutToReturn.normalSide = newCutNormalResult.normalSide;

            // Update offset shapes to match optimized cutChain
            if (cutToReturn.offset && cutToReturn.cutChain) {
                cutToReturn.offset!.offsetShapes = cutToReturn.cutChain.shapes;
            }
        }
    }

    // Calculate leads for the cut (uses the updated normal if optimization was applied)
    const leadResult = await calculateCutLeads(
        cutToReturn,
        operation.toData(),
        chain,
        parts
    );

    // Add leads to the cut if they were calculated
    if (leadResult.leadIn) {
        cutToReturn.leadIn = {
            ...leadResult.leadIn,
            generatedAt: new Date().toISOString(),
            version: '1.0.0',
        };
    }

    if (leadResult.leadOut) {
        cutToReturn.leadOut = {
            ...leadResult.leadOut,
            generatedAt: new Date().toISOString(),
            version: '1.0.0',
        };
    }

    return {
        cuts: [cutToReturn],
        warnings: warningsToReturn ? [warningsToReturn] : [],
    };
}
