/**
 * Part operations module - handles cut generation for parts (shells, holes, and slots)
 */

import { Chain } from '$lib/cam/chain/classes.svelte';
import { CutDirection, OptimizeStarts } from '$lib/cam/cut/enums';
import { OffsetDirection } from '$lib/cam/offset/types';
import type { Part } from '$lib/cam/part/classes.svelte';
import { Cut } from '$lib/cam/cut/classes.svelte';
import { LeadType } from '$lib/cam/lead/enums';
import { calculateCutNormal } from '$lib/cam/cut/calculate-cut-normal';
import { optimizeCutStartPoint } from '$lib/cam/cut/optimize-cut-start-point';
import { getToolValue } from '$lib/cam/tool/tool-utils';
import { calculateChainOffset } from '$lib/cam/pipeline/operations/offset-calculation';
import { calculateCutLeads } from '$lib/cam/pipeline/leads/lead-orchestration';
import type {
    OffsetCalculation,
    CutGenerationResult,
    ChainOffsetResult,
} from './interfaces';
import type { Operation } from '$lib/cam/operation/classes.svelte';
import { KerfCompensation } from '$lib/cam/operation/enums';
import type { Lead } from '$lib/cam/lead/interfaces';
import type { CutChainResult } from '$lib/cam/chain/interfaces';
import { createCutChain } from '$lib/cam/chain/functions';

/**
 * Helper function to determine kerf compensation direction based on operation settings and chain type
 */
function determineKerfCompensation(
    kerfCompensation: KerfCompensation | undefined,
    chainType: 'shell' | 'hole' | 'slot'
): OffsetDirection {
    if (!kerfCompensation) {
        return OffsetDirection.NONE;
    }

    switch (kerfCompensation) {
        case KerfCompensation.INNER:
            return OffsetDirection.INSET;
        case KerfCompensation.OUTER:
            return OffsetDirection.OUTSET;
        case KerfCompensation.PART:
            if (chainType === 'shell') {
                return OffsetDirection.OUTSET;
            } else if (chainType === 'hole') {
                return OffsetDirection.INSET;
            } else {
                // slot
                return OffsetDirection.NONE;
            }
        case KerfCompensation.NONE:
        default:
            return OffsetDirection.NONE;
    }
}

/**
 * Helper function to assign leads to a cut
 */
export function assignLeadsToCut(
    cut: Cut,
    leadIn: Lead | undefined,
    leadOut: Lead | undefined
): void {
    if (leadIn) {
        cut.leadIn = {
            ...leadIn,
            generatedAt: new Date().toISOString(),
            version: '1.0.0',
        };
    }
    if (leadOut) {
        cut.leadOut = {
            ...leadOut,
            generatedAt: new Date().toISOString(),
            version: '1.0.0',
        };
    }
}

/**
 * Generate cuts for a part target with an operation
 * Creates cuts for shell, holes, and slots
 * @param operation - The operation defining cut parameters (contains tool and targets)
 * @param index - Index of this target in the operation's target list
 * @param tolerance - Tolerance for geometric operations
 * @returns Promise of cut generation result with cuts and warnings
 */
export async function generateCutsForPartsWithOperation(
    operation: Operation,
    index: number,
    tolerance: number
): Promise<CutGenerationResult> {
    // Get part from operation targets
    const part = operation.targets[index] as Part;
    const tool = operation.tool;

    // Return empty arrays if part not found or tool missing
    if (!part || !tool) {
        return { cuts: [], warnings: [] };
    }

    // Get all parts from operation targets (for lead calculations)
    const parts: Part[] = operation.targets.filter(
        (t) => !('shapes' in t)
    ) as Part[];

    // Get all chains from part
    // TODO use Chain.clone()
    const chains: Chain[] = [new Chain(part.shell)];
    chains.push(...part.voids.map((v) => new Chain(v.chain)));
    chains.push(...part.slots.map((s) => new Chain(s.chain)));

    const cutsToReturn: Cut[] = [];
    const warningsToReturn: {
        chainId: string;
        operationId: string;
        offsetWarnings: string[];
        clearExistingWarnings: boolean;
    }[] = [];

    // ========================================================================
    // PHASE 1: Determine kerf compensations and collect offset tasks
    // ========================================================================

    // Track offset calculation info for parallel execution
    type ChainOffsetInfo = {
        chain: Chain;
        chainId: string;
        kerfCompensation: OffsetDirection;
        cutDirection: CutDirection;
        type: 'shell' | 'hole' | 'slot';
        holeIndex?: number;
        slotIndex?: number;
    };
    const offsetInfos: ChainOffsetInfo[] = [];

    // Shell chain
    //
    const shellChain: Chain | undefined = chains.find(
        (c) => c.id === part.shell.id
    );
    const shellStoredDirection: CutDirection =
        shellChain?.direction ?? CutDirection.NONE;
    const shellCutDirection: CutDirection =
        shellStoredDirection === CutDirection.NONE
            ? CutDirection.NONE
            : operation.cutDirection;

    const shellKerfCompensation: OffsetDirection = determineKerfCompensation(
        operation.kerfCompensation,
        'shell'
    );

    if (shellKerfCompensation !== OffsetDirection.NONE && shellChain) {
        offsetInfos.push({
            chain: shellChain,
            chainId: part.shell.id,
            kerfCompensation: shellKerfCompensation,
            cutDirection: shellCutDirection,
            type: 'shell',
        });
    }

    // Hole chains
    //
    for (let holeIndex = 0; holeIndex < part.voids.length; holeIndex++) {
        const hole = part.voids[holeIndex];
        const holeChain = chains.find((c) => c.id === hole.chain.id);

        const holeStoredDirection: CutDirection =
            holeChain?.direction ?? CutDirection.NONE;

        const holeCutDirection: CutDirection =
            holeStoredDirection === CutDirection.NONE
                ? CutDirection.NONE
                : operation.cutDirection;

        const holeKerfCompensation: OffsetDirection = determineKerfCompensation(
            operation.kerfCompensation,
            'hole'
        );

        if (holeKerfCompensation !== OffsetDirection.NONE && holeChain) {
            offsetInfos.push({
                chain: holeChain,
                chainId: hole.chain.id,
                kerfCompensation: holeKerfCompensation,
                cutDirection: holeCutDirection,
                type: 'hole',
                holeIndex,
            });
        }
    }

    // Slot chains
    //
    for (let slotIndex = 0; slotIndex < part.slots.length; slotIndex++) {
        const slot = part.slots[slotIndex];
        const slotChain = chains.find((c) => c.id === slot.chain.id);

        const slotStoredDirection: CutDirection =
            slotChain?.direction ?? CutDirection.NONE;

        const slotCutDirection: CutDirection =
            slotStoredDirection === CutDirection.NONE
                ? CutDirection.NONE
                : operation.cutDirection;

        const slotKerfCompensation: OffsetDirection = determineKerfCompensation(
            operation.kerfCompensation,
            'slot'
        );

        if (slotKerfCompensation !== OffsetDirection.NONE && slotChain) {
            offsetInfos.push({
                chain: slotChain,
                chainId: slot.chain.id,
                kerfCompensation: slotKerfCompensation,
                cutDirection: slotCutDirection,
                type: 'slot',
                slotIndex,
            });
        }
    }

    // ========================================================================
    // PHASE 2: Calculate all offsets in parallel
    // ========================================================================

    // Calculate offset results
    const offsetPromises: Promise<ChainOffsetResult | null>[] = offsetInfos.map(
        (info) =>
            calculateChainOffset(info.chain, info.kerfCompensation, tool.id, [
                tool,
            ])
    );
    const offsetResults: (ChainOffsetResult | null)[] =
        await Promise.all(offsetPromises);

    // Build offset calculation map for easy lookup
    const offsetMap: Map<string, OffsetCalculation> = new Map<
        string,
        OffsetCalculation
    >();
    offsetResults.forEach((result, index) => {
        if (result) {
            const info = offsetInfos[index];

            // Collect warnings
            warningsToReturn.push({
                chainId: info.chainId,
                operationId: operation.id,
                offsetWarnings: result.warnings || [],
                clearExistingWarnings: true,
            });

            offsetMap.set(info.chainId, {
                offsetShapes: result.offsetShapes,
                originalShapes: result.originalShapes,
                direction: info.kerfCompensation,
                kerfWidth: result.kerfWidth,
                generatedAt: new Date().toISOString(),
                version: '1.0.0',
            });
        }
    });

    // ========================================================================
    // PHASE 3: Create all cuts (shell, holes, slots)
    // ========================================================================

    const shellCalculatedOffset = offsetMap.get(part.shell.id);

    // Create execution chain for shell
    let shellExecutionChain: Chain | undefined = undefined;
    let shellExecutionClockwise: boolean | null = null;
    if (shellChain) {
        const shellCutChainResult: CutChainResult = createCutChain(
            shellChain,
            shellCutDirection,
            shellCalculatedOffset?.offsetShapes
        );
        shellExecutionChain = shellCutChainResult.cutChain;
        shellExecutionClockwise = shellCutChainResult.executionClockwise;
    }

    // Calculate cut normal for shell
    if (!shellExecutionChain) {
        throw new Error(
            'Cannot create shell cut: shellExecutionChain is undefined'
        );
    }
    const shellCutNormalResult = calculateCutNormal(
        shellExecutionChain,
        shellCutDirection,
        part,
        shellKerfCompensation
    );

    // Get kerf width from tool (needed for cutter visualization even when compensation is NONE)
    let shellKerfWidth: number | undefined = undefined;
    if (tool) {
        const toolKerfWidth = getToolValue(tool, 'kerfWidth');
        if (toolKerfWidth) {
            shellKerfWidth = toolKerfWidth;
        }
    }

    // Create shell cut
    const shellCut = new Cut({
        id: crypto.randomUUID(),
        name: `${operation.name} - ${part.name} (Shell)`,
        sourceOperationId: operation.id,
        sourceChainId: part.shell.id,
        sourceToolId: tool.id,
        enabled: true,
        order: index + 1,
        action: operation.action,
        direction: shellCutDirection,
        executionClockwise: shellExecutionClockwise,
        leadInConfig: operation.leadInConfig,
        leadOutConfig: operation.leadOutConfig,
        kerfCompensation: shellKerfCompensation,
        kerfWidth: shellKerfWidth,
        offset: shellCalculatedOffset,
        chain: shellExecutionChain.toData(),
        isHole: false,
        holeUnderspeedPercent: operation.holeUnderspeedEnabled
            ? operation.holeUnderspeedPercent
            : undefined,
        normal: shellCutNormalResult.normal,
        normalConnectionPoint: shellCutNormalResult.connectionPoint,
        normalSide: shellCutNormalResult.normalSide,
    });

    // Optimize shell cut start point if enabled
    if (
        operation.optimizeStarts &&
        operation.optimizeStarts !== OptimizeStarts.NONE
    ) {
        const wasOptimized = optimizeCutStartPoint(
            shellCut,
            operation.optimizeStarts,
            tolerance
        );
        if (wasOptimized) {
            // Recalculate normal with the new start point
            const newShellCutNormalResult = calculateCutNormal(
                shellCut.chain!,
                shellCutDirection,
                part,
                shellKerfCompensation
            );
            shellCut.normal = newShellCutNormalResult.normal;
            shellCut.normalConnectionPoint =
                newShellCutNormalResult.connectionPoint;
            shellCut.normalSide = newShellCutNormalResult.normalSide;

            // Update offset shapes to match optimized cutChain
            if (shellCut.offset && shellCut.chain) {
                shellCut.offset!.offsetShapes = shellCut.chain.shapes;
            }
        }
    }

    // Shell cut complete (leads will be calculated in Phase 4)
    cutsToReturn.push(shellCut);

    // Create cuts for all hole chains (using pre-calculated offsets)
    let cutOrder: number = index + 1;

    for (let holeIndex = 0; holeIndex < part.voids.length; holeIndex++) {
        const hole = part.voids[holeIndex];
        const holeChain: Chain | undefined = chains.find(
            (c) => c.id === hole.chain.id
        );
        const holeStoredDirection: CutDirection =
            holeChain?.direction ?? CutDirection.NONE;
        const holeCutDirection: CutDirection =
            holeStoredDirection === CutDirection.NONE
                ? CutDirection.NONE
                : operation.cutDirection;

        const holeKerfCompensation = determineKerfCompensation(
            operation.kerfCompensation,
            'hole'
        );

        // Get pre-calculated offset from Phase 2
        const holeCalculatedOffset = offsetMap.get(hole.chain.id);

        // Create execution chain for hole
        let holeExecutionChain: Chain | undefined = undefined;
        let holeExecutionClockwise: boolean | null = null;
        if (holeChain) {
            const holeCutChainResult = createCutChain(
                holeChain,
                holeCutDirection,
                holeCalculatedOffset?.offsetShapes
            );
            holeExecutionChain = holeCutChainResult.cutChain;
            holeExecutionClockwise = holeCutChainResult.executionClockwise;
        }

        // Calculate cut normal for hole
        if (!holeExecutionChain) {
            throw new Error(
                'Cannot create hole cut: holeExecutionChain is undefined'
            );
        }
        const holeCutNormalResult = calculateCutNormal(
            holeExecutionChain,
            holeCutDirection,
            part,
            holeKerfCompensation
        );

        // Get kerf width from tool (needed for cutter visualization even when compensation is NONE)
        let holeKerfWidth: number | undefined = undefined;
        if (tool) {
            const toolKerfWidth = getToolValue(tool, 'kerfWidth');
            if (toolKerfWidth) {
                holeKerfWidth = toolKerfWidth;
            }
        }

        // Create hole cut
        const holeCut = new Cut({
            id: crypto.randomUUID(),
            name: `${operation.name} - ${part.name} (Hole ${holeIndex + 1})`,
            sourceOperationId: operation.id,
            sourceChainId: hole.chain.id,
            sourceToolId: tool?.id || null,
            enabled: true,
            order: cutOrder++,
            action: operation.action,
            direction: holeCutDirection,
            executionClockwise: holeExecutionClockwise,
            leadInConfig: operation.leadInConfig,
            leadOutConfig: operation.leadOutConfig,
            kerfCompensation: holeKerfCompensation,
            kerfWidth: holeKerfWidth,
            offset: holeCalculatedOffset,
            chain: holeExecutionChain.toData(),
            isHole: true,
            holeUnderspeedPercent: operation.holeUnderspeedEnabled
                ? operation.holeUnderspeedPercent
                : undefined,
            normal: holeCutNormalResult.normal,
            normalConnectionPoint: holeCutNormalResult.connectionPoint,
            normalSide: holeCutNormalResult.normalSide,
        });

        // Optimize hole cut start point if enabled
        if (
            operation.optimizeStarts &&
            operation.optimizeStarts !== OptimizeStarts.NONE
        ) {
            const wasOptimized = optimizeCutStartPoint(
                holeCut,
                operation.optimizeStarts,
                tolerance
            );
            if (wasOptimized) {
                // Recalculate normal with the new start point
                const newHoleCutNormalResult = calculateCutNormal(
                    holeCut.chain!,
                    holeCutDirection,
                    part,
                    holeKerfCompensation
                );
                holeCut.normal = newHoleCutNormalResult.normal;
                holeCut.normalConnectionPoint =
                    newHoleCutNormalResult.connectionPoint;
                holeCut.normalSide = newHoleCutNormalResult.normalSide;

                // Update offset shapes to match optimized cutChain
                if (holeCut.offset && holeCut.chain) {
                    holeCut.offset!.offsetShapes = holeCut.chain.shapes;
                }
            }
        }

        // Hole cut complete (leads will be calculated in Phase 4)
        cutsToReturn.push(holeCut);
    }

    // Create cuts for all slot chains (using pre-calculated offsets)
    for (let slotIndex = 0; slotIndex < part.slots.length; slotIndex++) {
        const slot = part.slots[slotIndex];
        const slotChain: Chain | undefined = chains.find(
            (c) => c.id === slot.chain.id
        );
        const slotStoredDirection: CutDirection =
            slotChain?.direction ?? CutDirection.NONE;
        const slotCutDirection: CutDirection =
            slotStoredDirection === CutDirection.NONE
                ? CutDirection.NONE
                : operation.cutDirection;

        const slotKerfCompensation = determineKerfCompensation(
            operation.kerfCompensation,
            'slot'
        );

        // Get pre-calculated offset from Phase 2
        const slotCalculatedOffset = offsetMap.get(slot.chain.id);

        // Create execution chain for slot
        let slotExecutionChain: Chain | undefined = undefined;
        let slotExecutionClockwise: boolean | null = null;
        if (slotChain) {
            const slotCutChainResult = createCutChain(
                slotChain,
                slotCutDirection,
                slotCalculatedOffset?.offsetShapes
            );
            slotExecutionChain = slotCutChainResult.cutChain;
            slotExecutionClockwise = slotCutChainResult.executionClockwise;
        }

        // Calculate cut normal for slot
        if (!slotExecutionChain) {
            throw new Error(
                'Cannot create slot cut: slotExecutionChain is undefined'
            );
        }
        const slotCutNormalResult = calculateCutNormal(
            slotExecutionChain,
            slotCutDirection,
            part,
            slotKerfCompensation
        );

        // Get kerf width from tool (needed for cutter visualization even when compensation is NONE)
        let slotKerfWidth: number | undefined = undefined;
        if (tool) {
            const toolKerfWidth = getToolValue(tool, 'kerfWidth');
            if (toolKerfWidth) {
                slotKerfWidth = toolKerfWidth;
            }
        }

        // Create slot cut
        // For slots with PART kerf compensation, disable leads
        const slotCut = new Cut({
            id: crypto.randomUUID(),
            name: `${operation.name} - ${part.name} (Slot ${slotIndex + 1})`,
            sourceOperationId: operation.id,
            sourceChainId: slot.chain.id,
            sourceToolId: tool?.id || null,
            enabled: true,
            order: cutOrder++,
            action: operation.action,
            direction: slotCutDirection,
            executionClockwise: slotExecutionClockwise,
            leadInConfig:
                operation.kerfCompensation === KerfCompensation.PART
                    ? { type: LeadType.NONE, length: 0 }
                    : operation.leadInConfig,
            leadOutConfig:
                operation.kerfCompensation === KerfCompensation.PART
                    ? { type: LeadType.NONE, length: 0 }
                    : operation.leadOutConfig,
            kerfCompensation: slotKerfCompensation,
            kerfWidth: slotKerfWidth,
            offset: slotCalculatedOffset,
            chain: slotExecutionChain.toData(),
            isHole: false,
            holeUnderspeedPercent: undefined,
            normal: slotCutNormalResult.normal,
            normalConnectionPoint: slotCutNormalResult.connectionPoint,
            normalSide: slotCutNormalResult.normalSide,
        });

        // Optimize slot cut start point if enabled
        if (
            operation.optimizeStarts &&
            operation.optimizeStarts !== OptimizeStarts.NONE
        ) {
            const wasOptimized = optimizeCutStartPoint(
                slotCut,
                operation.optimizeStarts,
                tolerance
            );
            if (wasOptimized) {
                // Recalculate normal with the new start point
                const newSlotCutNormalResult = calculateCutNormal(
                    slotCut.chain!,
                    slotCutDirection,
                    part,
                    slotKerfCompensation
                );
                slotCut.normal = newSlotCutNormalResult.normal;
                slotCut.normalConnectionPoint =
                    newSlotCutNormalResult.connectionPoint;
                slotCut.normalSide = newSlotCutNormalResult.normalSide;

                // Update offset shapes to match optimized cutChain
                if (slotCut.offset && slotCut.chain) {
                    slotCut.offset!.offsetShapes = slotCut.chain.shapes;
                }
            }
        }

        // Slot cut complete (leads will be calculated in Phase 4)
        cutsToReturn.push(slotCut);
    }

    // ========================================================================
    // PHASE 4: Calculate all leads in parallel
    // ========================================================================

    const leadPromises = cutsToReturn.map((cut) => {
        // Find the original chain for this cut
        const chain = chains.find((c) => c.id === cut.sourceChainId);
        if (!chain) {
            console.warn(
                `Cannot find chain ${cut.sourceChainId} for cut ${cut.name} - skipping lead calculation`
            );
            return Promise.resolve({ cut, leadResult: null });
        }

        return calculateCutLeads(cut, operation, chain, parts).then(
            (leadResult) => ({ cut, leadResult })
        );
    });

    const leadResults = await Promise.all(leadPromises);

    // Assign leads to cuts
    leadResults.forEach(({ cut, leadResult }) => {
        if (leadResult) {
            assignLeadsToCut(cut, leadResult.leadIn, leadResult.leadOut);
        }
    });

    return {
        cuts: cutsToReturn,
        warnings: warningsToReturn,
    };
}
