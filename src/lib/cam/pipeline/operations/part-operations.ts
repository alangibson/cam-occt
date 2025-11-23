/**
 * Part operations module - handles cut generation for parts (shells, holes, and slots)
 */

import type { ChainData } from '$lib/geometry/chain/interfaces';
import { Chain } from '$lib/geometry/chain/classes';
import { CutDirection, OptimizeStarts } from '$lib/cam/cut/enums';
import { createCutChain } from '$lib/cam/pipeline/chains/functions';
import { getChainCutDirection } from '$lib/geometry/chain/functions';
import { OffsetDirection } from '$lib/cam/offset/types';
import type { Part } from '$lib/cam/part/classes.svelte';
import type { PartVoid, PartSlot } from '$lib/cam/part/interfaces';
import { Cut } from '$lib/cam/cut/classes.svelte';
import { LeadType } from '$lib/cam/lead/enums';
import { calculateCutNormal } from '$lib/cam/cut/calculate-cut-normal';
import { optimizeCutStartPoint } from '$lib/cam/cut/optimize-cut-start-point';
import { getToolValue } from '$lib/cam/tool/tool-utils';
import { calculateChainOffset } from '$lib/cam/pipeline/operations/offset-calculation';
import { calculateCutLeads } from '$lib/cam/pipeline/leads/lead-orchestration';
import type { OffsetCalculation, CutGenerationResult } from './interfaces';
import type { Operation } from '$lib/cam/operation/classes.svelte';
import { KerfCompensation } from '$lib/cam/operation/enums';

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

    const targetId = part.id;

    // Get all parts from operation targets (for lead calculations)
    const parts: Part[] = operation.targets.filter(
        (t) => !('shapes' in t)
    ) as Part[];

    // Get all chains from part
    const chains: ChainData[] = [part.shell];
    chains.push(...part.voids.map((v) => v.chain));
    chains.push(...part.slots.map((s) => s.chain));

    const cutsToReturn: Cut[] = [];
    const warningsToReturn: {
        chainId: string;
        operationId: string;
        offsetWarnings: string[];
        clearExistingWarnings: boolean;
    }[] = [];

    // Create a cut for the shell chain using operation's preferred direction
    const shellChain: ChainData | undefined = chains.find(
        (c) => c.id === part.shell.id
    );
    const shellStoredDirection: CutDirection = getChainCutDirection(shellChain);
    const shellCutDirection: CutDirection =
        shellStoredDirection === CutDirection.NONE
            ? CutDirection.NONE
            : operation.cutDirection;

    // Convert KerfCompensation to OffsetDirection for shell
    let shellKerfCompensation: OffsetDirection = OffsetDirection.NONE;
    if (operation.kerfCompensation) {
        switch (operation.kerfCompensation) {
            case KerfCompensation.INNER:
                shellKerfCompensation = OffsetDirection.INSET;
                break;
            case KerfCompensation.OUTER:
                shellKerfCompensation = OffsetDirection.OUTSET;
                break;
            case KerfCompensation.PART:
                // For shells (outer boundaries) in part mode, use outset
                shellKerfCompensation = OffsetDirection.OUTSET;
                break;
            case KerfCompensation.NONE:
            default:
                shellKerfCompensation = OffsetDirection.NONE;
                break;
        }
    }

    // Calculate offset for shell if kerf compensation is enabled
    let shellCalculatedOffset: OffsetCalculation | undefined = undefined;
    if (shellKerfCompensation !== OffsetDirection.NONE && shellChain && tool) {
        const offsetResult = await calculateChainOffset(
            shellChain,
            shellKerfCompensation,
            tool.id,
            [tool]
        );
        if (offsetResult) {
            // Collect warnings for return instead of directly updating stores
            warningsToReturn.push({
                chainId: part.shell.id,
                operationId: operation.id,
                offsetWarnings: offsetResult.warnings || [],
                clearExistingWarnings: true,
            });

            shellCalculatedOffset = {
                offsetShapes: offsetResult.offsetShapes,
                originalShapes: offsetResult.originalShapes,
                direction: shellKerfCompensation,
                kerfWidth: offsetResult.kerfWidth,
                generatedAt: new Date().toISOString(),
                version: '1.0.0',
            };
        }
    }

    // Create execution chain for shell
    let shellExecutionChain: Chain | undefined = undefined;
    let shellExecutionClockwise: boolean | null = null;
    if (shellChain) {
        const shellCutChainResult = createCutChain(
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
        name: `${operation.name} - Part ${targetId.split('-')[1]} (Shell)`,
        operationId: operation.id,
        chainId: part.shell.id,
        toolId: tool.id,
        enabled: true,
        order: index + 1,
        action: operation.action,
        cutDirection: shellCutDirection,
        executionClockwise: shellExecutionClockwise,
        leadInConfig: operation.leadInConfig,
        leadOutConfig: operation.leadOutConfig,
        kerfCompensation: shellKerfCompensation,
        kerfWidth: shellKerfWidth,
        offset: shellCalculatedOffset,
        cutChain: shellExecutionChain,
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
        const optimizedCut = optimizeCutStartPoint(
            shellCut,
            operation.optimizeStarts,
            tolerance
        );
        if (optimizedCut) {
            // Use the optimized cut with the new start point
            Object.assign(shellCut, optimizedCut);

            // Recalculate normal with the new start point
            const newShellCutNormalResult = calculateCutNormal(
                shellCut.cutChain!,
                shellCutDirection,
                part,
                shellKerfCompensation
            );
            shellCut.normal = newShellCutNormalResult.normal;
            shellCut.normalConnectionPoint =
                newShellCutNormalResult.connectionPoint;
            shellCut.normalSide = newShellCutNormalResult.normalSide;

            // Update offset shapes to match optimized cutChain
            if (shellCut.offset && shellCut.cutChain) {
                shellCut.offset!.offsetShapes = shellCut.cutChain.shapes;
            }
        }
    }

    // Calculate leads for shell cut (uses the updated normal if optimization was applied)
    if (shellChain) {
        const shellLeadResult = await calculateCutLeads(
            shellCut,
            operation.toData(),
            shellChain,
            parts
        );

        // Add leads to the shell cut if they were calculated
        if (shellLeadResult.leadIn) {
            shellCut.leadIn = {
                ...shellLeadResult.leadIn,
                generatedAt: new Date().toISOString(),
                version: '1.0.0',
            };
        }

        if (shellLeadResult.leadOut) {
            shellCut.leadOut = {
                ...shellLeadResult.leadOut,
                generatedAt: new Date().toISOString(),
                version: '1.0.0',
            };
        }
    }

    cutsToReturn.push(shellCut);

    // Create cuts for all hole chains (including nested holes)
    let cutOrder: number = index + 1;

    async function processHoles(holes: PartVoid[], prefix: string = '') {
        for (let holeIndex = 0; holeIndex < holes.length; holeIndex++) {
            const hole = holes[holeIndex];
            // Use operation's preferred cut direction for the hole chain
            const holeChain: ChainData | undefined = chains.find(
                (c) => c.id === hole.chain.id
            );
            const holeStoredDirection: CutDirection =
                getChainCutDirection(holeChain);
            const holeCutDirection: CutDirection =
                holeStoredDirection === CutDirection.NONE
                    ? CutDirection.NONE
                    : operation.cutDirection;

            // Convert KerfCompensation to OffsetDirection for hole
            let holeKerfCompensation: OffsetDirection = OffsetDirection.NONE;
            if (operation.kerfCompensation) {
                switch (operation.kerfCompensation) {
                    case KerfCompensation.INNER:
                        holeKerfCompensation = OffsetDirection.INSET;
                        break;
                    case KerfCompensation.OUTER:
                        holeKerfCompensation = OffsetDirection.OUTSET;
                        break;
                    case KerfCompensation.PART:
                        // For holes (inner boundaries) in part mode, use inset
                        holeKerfCompensation = OffsetDirection.INSET;
                        break;
                    case KerfCompensation.NONE:
                    default:
                        holeKerfCompensation = OffsetDirection.NONE;
                        break;
                }
            }

            // Calculate offset for hole if kerf compensation is enabled
            let holeCalculatedOffset: OffsetCalculation | undefined = undefined;
            if (
                holeKerfCompensation !== OffsetDirection.NONE &&
                holeChain &&
                tool
            ) {
                const offsetResult = await calculateChainOffset(
                    holeChain,
                    holeKerfCompensation,
                    tool.id,
                    [tool]
                );
                if (offsetResult) {
                    // Collect warnings for return instead of directly updating stores
                    warningsToReturn.push({
                        chainId: hole.chain.id,
                        operationId: operation.id,
                        offsetWarnings: offsetResult.warnings || [],
                        clearExistingWarnings: true,
                    });

                    holeCalculatedOffset = {
                        offsetShapes: offsetResult.offsetShapes,
                        originalShapes: offsetResult.originalShapes,
                        direction: holeKerfCompensation,
                        kerfWidth: offsetResult.kerfWidth,
                        generatedAt: new Date().toISOString(),
                        version: '1.0.0',
                    };
                }
            }

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
                name: `${operation.name} - Part ${targetId.split('-')[1]} ${prefix}(Hole ${holeIndex + 1})`,
                operationId: operation.id,
                chainId: hole.chain.id,
                toolId: tool?.id || null,
                enabled: true,
                order: cutOrder++,
                action: operation.action,
                cutDirection: holeCutDirection,
                executionClockwise: holeExecutionClockwise,
                leadInConfig: operation.leadInConfig,
                leadOutConfig: operation.leadOutConfig,
                kerfCompensation: holeKerfCompensation,
                kerfWidth: holeKerfWidth,
                offset: holeCalculatedOffset,
                cutChain: holeExecutionChain,
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
                const optimizedCut = optimizeCutStartPoint(
                    holeCut,
                    operation.optimizeStarts,
                    tolerance
                );
                if (optimizedCut) {
                    // Use the optimized cut with the new start point
                    Object.assign(holeCut, optimizedCut);

                    // Recalculate normal with the new start point
                    const newHoleCutNormalResult = calculateCutNormal(
                        holeCut.cutChain!,
                        holeCutDirection,
                        part,
                        holeKerfCompensation
                    );
                    holeCut.normal = newHoleCutNormalResult.normal;
                    holeCut.normalConnectionPoint =
                        newHoleCutNormalResult.connectionPoint;
                    holeCut.normalSide = newHoleCutNormalResult.normalSide;

                    // Update offset shapes to match optimized cutChain
                    if (holeCut.offset && holeCut.cutChain) {
                        holeCut.offset!.offsetShapes = holeCut.cutChain.shapes;
                    }
                }
            }

            // Calculate leads for hole cut (uses the updated normal if optimization was applied)
            if (holeChain) {
                const holeLeadResult = await calculateCutLeads(
                    holeCut,
                    operation.toData(),
                    holeChain,
                    parts
                );

                // Add leads to the hole cut if they were calculated
                if (holeLeadResult.leadIn) {
                    holeCut.leadIn = {
                        ...holeLeadResult.leadIn,
                        generatedAt: new Date().toISOString(),
                        version: '1.0.0',
                    };
                }

                if (holeLeadResult.leadOut) {
                    holeCut.leadOut = {
                        ...holeLeadResult.leadOut,
                        generatedAt: new Date().toISOString(),
                        version: '1.0.0',
                    };
                }
            }

            cutsToReturn.push(holeCut);
        }
    }

    await processHoles(part.voids);

    // Create cuts for all slot chains
    async function processSlots(slots: PartSlot[]) {
        for (let slotIndex = 0; slotIndex < slots.length; slotIndex++) {
            const slot = slots[slotIndex];
            // Use operation's preferred cut direction for the slot chain
            const slotChain: ChainData | undefined = chains.find(
                (c) => c.id === slot.chain.id
            );
            const slotStoredDirection: CutDirection =
                getChainCutDirection(slotChain);
            const slotCutDirection: CutDirection =
                slotStoredDirection === CutDirection.NONE
                    ? CutDirection.NONE
                    : operation.cutDirection;

            // Convert KerfCompensation to OffsetDirection for slot
            // Slots should NOT be offset when kerf compensation is PART or NONE
            let slotKerfCompensation: OffsetDirection = OffsetDirection.NONE;
            if (operation.kerfCompensation) {
                switch (operation.kerfCompensation) {
                    case KerfCompensation.INNER:
                        slotKerfCompensation = OffsetDirection.INSET;
                        break;
                    case KerfCompensation.OUTER:
                        slotKerfCompensation = OffsetDirection.OUTSET;
                        break;
                    case KerfCompensation.PART:
                        // For slots in part mode, do not offset
                        slotKerfCompensation = OffsetDirection.NONE;
                        break;
                    case KerfCompensation.NONE:
                    default:
                        slotKerfCompensation = OffsetDirection.NONE;
                        break;
                }
            }

            // Calculate offset for slot if kerf compensation is enabled
            let slotCalculatedOffset: OffsetCalculation | undefined = undefined;
            if (
                slotKerfCompensation !== OffsetDirection.NONE &&
                slotChain &&
                tool
            ) {
                const offsetResult = await calculateChainOffset(
                    slotChain,
                    slotKerfCompensation,
                    tool.id,
                    [tool]
                );
                if (offsetResult) {
                    // Collect warnings for return instead of directly updating stores
                    warningsToReturn.push({
                        chainId: slot.chain.id,
                        operationId: operation.id,
                        offsetWarnings: offsetResult.warnings || [],
                        clearExistingWarnings: true,
                    });

                    slotCalculatedOffset = {
                        offsetShapes: offsetResult.offsetShapes,
                        originalShapes: offsetResult.originalShapes,
                        direction: slotKerfCompensation,
                        kerfWidth: offsetResult.kerfWidth,
                        generatedAt: new Date().toISOString(),
                        version: '1.0.0',
                    };
                }
            }

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
                name: `${operation.name} - Part ${targetId.split('-')[1]} (Slot ${slotIndex + 1})`,
                operationId: operation.id,
                chainId: slot.chain.id,
                toolId: tool?.id || null,
                enabled: true,
                order: cutOrder++,
                action: operation.action,
                cutDirection: slotCutDirection,
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
                cutChain: slotExecutionChain,
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
                const optimizedCut = optimizeCutStartPoint(
                    slotCut,
                    operation.optimizeStarts,
                    tolerance
                );
                if (optimizedCut) {
                    // Use the optimized cut with the new start point
                    Object.assign(slotCut, optimizedCut);

                    // Recalculate normal with the new start point
                    const newSlotCutNormalResult = calculateCutNormal(
                        slotCut.cutChain!,
                        slotCutDirection,
                        part,
                        slotKerfCompensation
                    );
                    slotCut.normal = newSlotCutNormalResult.normal;
                    slotCut.normalConnectionPoint =
                        newSlotCutNormalResult.connectionPoint;
                    slotCut.normalSide = newSlotCutNormalResult.normalSide;

                    // Update offset shapes to match optimized cutChain
                    if (slotCut.offset && slotCut.cutChain) {
                        slotCut.offset!.offsetShapes = slotCut.cutChain.shapes;
                    }
                }
            }

            // Calculate leads for slot cut (uses the updated normal if optimization was applied)
            // Skip leads when kerf compensation is PART
            if (
                slotChain &&
                operation.kerfCompensation !== KerfCompensation.PART
            ) {
                const slotLeadResult = await calculateCutLeads(
                    slotCut,
                    operation.toData(),
                    slotChain,
                    parts
                );

                // Add leads to the slot cut if they were calculated
                if (slotLeadResult.leadIn) {
                    slotCut.leadIn = {
                        ...slotLeadResult.leadIn,
                        generatedAt: new Date().toISOString(),
                        version: '1.0.0',
                    };
                }

                if (slotLeadResult.leadOut) {
                    slotCut.leadOut = {
                        ...slotLeadResult.leadOut,
                        generatedAt: new Date().toISOString(),
                        version: '1.0.0',
                    };
                }
            }

            cutsToReturn.push(slotCut);
        }
    }

    await processSlots(part.slots);

    return {
        cuts: cutsToReturn,
        warnings: warningsToReturn,
    };
}
