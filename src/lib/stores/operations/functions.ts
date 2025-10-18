import type { Chain } from '$lib/geometry/chain/interfaces';
import { CutDirection, OptimizeStarts } from '$lib/cam/cut/enums';
import { reverseChain } from '$lib/geometry/chain/functions';
import {
    DIRECTION_CLOCKWISE,
    DIRECTION_COUNTERCLOCKWISE,
} from '$lib/geometry/constants';
import { OffsetDirection } from '$lib/algorithms/offset-calculation/offset/types';
import { offsetChainAdapter } from '$lib/algorithms/offset-calculation/offset-adapter';
import type { GapFillingResult } from '$lib/algorithms/offset-calculation/chain/types';
import type { Shape } from '$lib/geometry/shape/interfaces';
import type { DetectedPart, PartHole } from '$lib/cam/part/part-detection';
import type { Tool } from '$lib/cam/tool/interfaces';
import type {
    ChainOffsetResult,
    OffsetCalculation,
    Operation,
    CutGenerationResult,
    CutLeadResult,
} from './interfaces';
import { KerfCompensation } from '$lib/stores/operations/enums';
import type { Cut } from '$lib/cam/cut/interfaces';
import { calculateLeads } from '$lib/cam/lead/lead-calculation';
import {
    createLeadInConfig,
    createLeadOutConfig,
} from '$lib/cam/lead/functions';
import { calculateCutNormal } from '$lib/cam/cut/calculate-cut-normal';
import { findPartContainingChain } from '$lib/cam/part/chain-part-interactions';
import { settingsStore } from '$lib/stores/settings/store';
import { get } from 'svelte/store';
import { MeasurementSystem } from '$lib/stores/settings/interfaces';
import { optimizeCutStartPoint } from '$lib/cam/cut/optimize-cut-start-point';

/**
 * Get the appropriate tool value based on the current measurement system
 */
function getToolValue(
    tool: Tool,
    field:
        | 'feedRate'
        | 'pierceHeight'
        | 'cutHeight'
        | 'kerfWidth'
        | 'puddleJumpHeight'
        | 'plungeRate'
): number {
    const settings = get(settingsStore).settings;
    const isMetric = settings.measurementSystem === MeasurementSystem.Metric;

    // Check for unit-specific fields
    const metricField = `${field}Metric` as keyof Tool;
    const imperialField = `${field}Imperial` as keyof Tool;

    if (isMetric && tool[metricField] !== undefined) {
        return tool[metricField] as number;
    } else if (!isMetric && tool[imperialField] !== undefined) {
        return tool[imperialField] as number;
    }

    // Fall back to the base field
    return tool[field];
}

/**
 * Get CutDirection from chain's stored clockwise property.
 * This replaces the unreliable detectCutDirection() calls.
 */
export function getChainCutDirection(chain: Chain | undefined): CutDirection {
    if (!chain) return CutDirection.NONE;

    return chain.clockwise === true
        ? CutDirection.CLOCKWISE
        : chain.clockwise === false
          ? CutDirection.COUNTERCLOCKWISE
          : CutDirection.NONE;
}

/**
 * Calculate chain offset for kerf compensation.
 * Returns offset result with warnings instead of directly updating stores.
 */
export async function calculateChainOffset(
    chain: Chain,
    kerfCompensation: OffsetDirection,
    toolId: string | null,
    tools: Tool[]
): Promise<ChainOffsetResult | null> {
    if (
        !kerfCompensation ||
        kerfCompensation === OffsetDirection.NONE ||
        !toolId
    ) {
        return null;
    }

    // Find tool by ID
    const tool = tools.find((t) => t.id === toolId);
    if (!tool) {
        console.warn('Tool not found for kerf compensation');
        return null;
    }
    const kerfWidth = getToolValue(tool, 'kerfWidth');
    if (!kerfWidth || kerfWidth <= 0) {
        console.warn(`Tool "${tool.toolName}" has no kerf width set`);
        return null;
    }

    // Calculate offset distance (kerf/2)
    const offsetDistance: number = kerfWidth / 2;

    try {
        // Get offset implementation setting
        const settings = get(settingsStore).settings;

        // Call offset calculation via adapter
        // For inset, use negative distance; for outset, use positive
        const direction: number =
            kerfCompensation === OffsetDirection.INSET
                ? DIRECTION_CLOCKWISE
                : DIRECTION_COUNTERCLOCKWISE;
        const offsetResult = await offsetChainAdapter(
            chain,
            offsetDistance * direction,
            {
                tolerance: 0.1,
                maxExtension: 50,
                snapThreshold: 0.5,
            },
            settings.offsetImplementation
        );

        if (!offsetResult.success) {
            console.warn('Offset calculation failed', offsetResult.errors);
            return null;
        }

        // Use the appropriate offset chain based on direction
        let selectedChain: Shape[];
        let selectedGapFills: GapFillingResult[] | undefined;

        if (kerfCompensation === OffsetDirection.INSET) {
            selectedChain = offsetResult.innerChain?.shapes || [];
            selectedGapFills = offsetResult.innerChain?.gapFills;
        } else {
            selectedChain = offsetResult.outerChain?.shapes || [];
            selectedGapFills = offsetResult.outerChain?.gapFills;
        }

        if (!selectedChain || selectedChain.length === 0) {
            console.warn(
                'No appropriate offset chain found for direction:',
                kerfCompensation
            );
            return null;
        }

        // offsetChain already returns polylines correctly for single polyline inputs
        // No additional wrapping needed
        const finalOffsetShapes: Shape[] = selectedChain;

        return {
            offsetShapes: finalOffsetShapes,
            originalShapes: chain.shapes,
            kerfWidth: kerfWidth,
            gapFills: selectedGapFills,
            warnings: offsetResult.warnings || [],
        };
    } catch (error) {
        console.error('Error calculating offset:', error);
        return null;
    }
}

/**
 * Helper function to create cut chain with deep cloned shapes ordered for execution.
 */
export function createCutChain(
    originalChain: Chain,
    userCutDirection: CutDirection,
    offsetShapes?: Shape[]
): { cutChain: Chain; executionClockwise: boolean | null } {
    // Determine which shapes to clone (offset shapes take priority)
    const shapesToClone = offsetShapes || originalChain.shapes;

    // Deep clone the shapes array to ensure Cut owns its execution order
    const clonedShapes: Shape[] = shapesToClone.map((shape) => ({
        ...shape,
        geometry: { ...shape.geometry },
    }));

    // Get the natural direction of the ORIGINAL chain (geometric property)
    const naturalDirection = getChainCutDirection(originalChain);

    // Handle case where user specifies NONE (no direction preference)
    if (userCutDirection === CutDirection.NONE) {
        return {
            cutChain: {
                id: `${originalChain.id}-cut`,
                shapes: clonedShapes,
            },
            executionClockwise: null,
        };
    }

    // Determine final execution order based on user preference vs natural direction
    let executionShapes: Shape[];
    let executionClockwise: boolean;

    // For open chains (naturalDirection is NONE), apply user's requested direction
    if (naturalDirection === CutDirection.NONE) {
        // Open chain - user wants specific direction
        // For open chains, we can interpret direction as traversal order:
        // CLOCKWISE = original order, COUNTERCLOCKWISE = reversed order
        if (userCutDirection === CutDirection.COUNTERCLOCKWISE) {
            const reversedChain = reverseChain({
                id: originalChain.id,
                shapes: clonedShapes,
            });
            executionShapes = reversedChain.shapes;
        } else {
            executionShapes = clonedShapes;
        }
        executionClockwise = userCutDirection === CutDirection.CLOCKWISE;
    } else if (naturalDirection !== userCutDirection) {
        // Closed chain - user wants opposite of natural direction
        const reversedChain = reverseChain({
            id: originalChain.id,
            shapes: clonedShapes,
        });
        executionShapes = reversedChain.shapes;
        executionClockwise = userCutDirection === CutDirection.CLOCKWISE;
    } else {
        // Closed chain - user wants same as natural direction
        executionShapes = clonedShapes;
        executionClockwise = userCutDirection === CutDirection.CLOCKWISE;
    }

    // Create cut chain with execution-ordered shapes
    const cutChain: Chain = {
        id: `${originalChain.id}-cut`,
        shapes: executionShapes,
        originalChainId: originalChain.id, // Preserve reference to original chain for part lookup
        clockwise: executionClockwise, // Use execution winding direction (accounts for shape reversal)
    };

    return { cutChain, executionClockwise };
}

export async function generateCutsForChainWithOperation(
    operation: Operation,
    targetId: string,
    index: number,
    chains: Chain[],
    tools: Tool[],
    parts: DetectedPart[],
    tolerance: number
): Promise<CutGenerationResult> {
    // Use the operation's preferred cut direction
    // For open cuts, the stored clockwise property will be null (indicating 'none')
    const chain: Chain | undefined = chains.find((c) => c.id === targetId);

    // Return empty arrays if chain not found
    if (!chain) {
        return { cuts: [], warnings: [] };
    }
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

    if (
        kerfCompensation !== OffsetDirection.NONE &&
        chain &&
        operation.toolId
    ) {
        const offsetResult = await calculateChainOffset(
            chain,
            kerfCompensation,
            operation.toolId,
            tools
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
                gapFills: offsetResult.gapFills,
            };
        }
    }

    // Create execution chain with correct ordering
    let cutChain: Chain | undefined = undefined;
    let executionClockwise: boolean | null = null;
    if (chain) {
        const cutChainResult = createCutChain(
            chain,
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
    if (operation.toolId) {
        const tool = tools.find((t) => t.id === operation.toolId);
        if (tool) {
            const toolKerfWidth = getToolValue(tool, 'kerfWidth');
            if (toolKerfWidth) {
                kerfWidth = toolKerfWidth;
            }
        }
    }

    // Create the cut object
    const cutToReturn: Cut = {
        id: crypto.randomUUID(),
        name: `${operation.name} - Chain ${targetId.split('-')[1]}`,
        operationId: operation.id,
        chainId: targetId,
        toolId: operation.toolId,
        enabled: true,
        order: index + 1,
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
    };

    // Optimize start point if enabled
    if (
        operation.optimizeStarts &&
        operation.optimizeStarts !== OptimizeStarts.NONE
    ) {
        const optimizedCut = optimizeCutStartPoint(
            cutToReturn,
            operation.optimizeStarts,
            tolerance
        );
        if (optimizedCut) {
            // Use the optimized cut with the new start point
            Object.assign(cutToReturn, optimizedCut);

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
                cutToReturn.offset.offsetShapes = cutToReturn.cutChain.shapes;
            }
        }
    }

    // Calculate leads for the cut (uses the updated normal if optimization was applied)
    const leadResult = await calculateCutLeads(
        cutToReturn,
        operation,
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

    if (leadResult.validation) {
        cutToReturn.leadValidation = {
            ...leadResult.validation,
            validatedAt: new Date().toISOString(),
        };
    }

    return {
        cuts: [cutToReturn],
        warnings: warningsToReturn ? [warningsToReturn] : [],
    };
}

export async function generateCutsForPartTargetWithOperation(
    operation: Operation,
    targetId: string,
    index: number,
    chains: Chain[],
    parts: DetectedPart[],
    tools: Tool[],
    tolerance: number
): Promise<CutGenerationResult> {
    // For parts, create cuts for all chains that make up the part
    const part: DetectedPart | undefined = parts.find((p) => p.id === targetId);

    // Return empty arrays if part not found
    if (!part) {
        return { cuts: [], warnings: [] };
    }

    const cutsToReturn: Cut[] = [];
    const warningsToReturn: {
        chainId: string;
        operationId: string;
        offsetWarnings: string[];
        clearExistingWarnings: boolean;
    }[] = [];

    // Create a cut for the shell chain using operation's preferred direction
    const shellChain: Chain | undefined = chains.find(
        (c) => c.id === part.shell.chain.id
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
    if (
        shellKerfCompensation !== OffsetDirection.NONE &&
        shellChain &&
        operation.toolId
    ) {
        const offsetResult = await calculateChainOffset(
            shellChain,
            shellKerfCompensation,
            operation.toolId,
            tools
        );
        if (offsetResult) {
            // Collect warnings for return instead of directly updating stores
            warningsToReturn.push({
                chainId: part.shell.chain.id,
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
                gapFills: offsetResult.gapFills,
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
    if (operation.toolId) {
        const tool = tools.find((t) => t.id === operation.toolId);
        if (tool) {
            const toolKerfWidth = getToolValue(tool, 'kerfWidth');
            if (toolKerfWidth) {
                shellKerfWidth = toolKerfWidth;
            }
        }
    }

    // Create shell cut
    const shellCut: Cut = {
        id: crypto.randomUUID(),
        name: `${operation.name} - Part ${targetId.split('-')[1]} (Shell)`,
        operationId: operation.id,
        chainId: part.shell.chain.id,
        toolId: operation.toolId,
        enabled: true,
        order: index + 1,
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
    };

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
                shellCut.offset.offsetShapes = shellCut.cutChain.shapes;
            }
        }
    }

    // Calculate leads for shell cut (uses the updated normal if optimization was applied)
    if (shellChain) {
        const shellLeadResult = await calculateCutLeads(
            shellCut,
            operation,
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

        if (shellLeadResult.validation) {
            shellCut.leadValidation = {
                ...shellLeadResult.validation,
                validatedAt: new Date().toISOString(),
            };
        }
    }

    cutsToReturn.push(shellCut);

    // Create cuts for all hole chains (including nested holes)
    let cutOrder: number = index + 1;

    async function processHoles(holes: PartHole[], prefix: string = '') {
        for (let holeIndex = 0; holeIndex < holes.length; holeIndex++) {
            const hole = holes[holeIndex];
            // Use operation's preferred cut direction for the hole chain
            const holeChain: Chain | undefined = chains.find(
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
                operation.toolId
            ) {
                const offsetResult = await calculateChainOffset(
                    holeChain,
                    holeKerfCompensation,
                    operation.toolId,
                    tools
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
                        gapFills: offsetResult.gapFills,
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
            if (operation.toolId) {
                const tool = tools.find((t) => t.id === operation.toolId);
                if (tool) {
                    const toolKerfWidth = getToolValue(tool, 'kerfWidth');
                    if (toolKerfWidth) {
                        holeKerfWidth = toolKerfWidth;
                    }
                }
            }

            // Create hole cut
            const holeCut: Cut = {
                id: crypto.randomUUID(),
                name: `${operation.name} - Part ${targetId.split('-')[1]} ${prefix}(Hole ${holeIndex + 1})`,
                operationId: operation.id,
                chainId: hole.chain.id,
                toolId: operation.toolId,
                enabled: true,
                order: cutOrder++,
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
            };

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
                        holeCut.offset.offsetShapes = holeCut.cutChain.shapes;
                    }
                }
            }

            // Calculate leads for hole cut (uses the updated normal if optimization was applied)
            if (holeChain) {
                const holeLeadResult = await calculateCutLeads(
                    holeCut,
                    operation,
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

                if (holeLeadResult.validation) {
                    holeCut.leadValidation = {
                        ...holeLeadResult.validation,
                        validatedAt: new Date().toISOString(),
                    };
                }
            }

            cutsToReturn.push(holeCut);

            // Process nested holes if any
            if (hole.holes && hole.holes.length > 0) {
                await processHoles(
                    hole.holes,
                    `${prefix}(Hole ${holeIndex + 1}) `
                );
            }
        }
    }

    await processHoles(part.holes);

    return {
        cuts: cutsToReturn,
        warnings: warningsToReturn,
    };
}

/**
 * Calculate lead geometry for a cut
 */
export async function calculateCutLeads(
    cut: Cut,
    operation: Operation,
    chain: Chain,
    parts: DetectedPart[]
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
        let part: DetectedPart | undefined;
        if (operation.targetType === 'parts') {
            part = parts?.find(
                (p) =>
                    p.shell.chain.id === cut.chainId ||
                    p.holes.some((h: PartHole) => h.chain.id === cut.chainId)
            );
        }

        // Get lead configurations with proper defaults
        const leadInConfig = createLeadInConfig(cut);
        const leadOutConfig = createLeadOutConfig(cut);

        // Use the cut's cutChain if available (it may have been optimized)
        // Otherwise use offset geometry, or fall back to original chain
        let leadCalculationChain: Chain;
        if (cut.cutChain) {
            // Use the cutChain directly - it already has the correct shape order
            // and includes any optimizations (like midpoint start)
            leadCalculationChain = cut.cutChain;
        } else if (cut.offset && cut.offset.offsetShapes.length > 0) {
            // Create a temporary chain from offset shapes
            // IMPORTANT: Preserve the clockwise property from the original chain
            // to maintain consistent normal direction calculation
            // Also preserve originalChainId for part context lookup
            leadCalculationChain = {
                id: chain.id + '_offset_temp',
                shapes: cut.offset.offsetShapes,
                clockwise: chain.clockwise,
                originalChainId: chain.id,
            };
        } else {
            leadCalculationChain = chain;
        }

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
    operation: Operation,
    cuts: Cut[],
    chains: Chain[],
    parts: DetectedPart[]
): Promise<Map<string, CutLeadResult>> {
    const leadResults = new Map<string, CutLeadResult>();

    try {
        // Find all cuts for this operation
        const operationCuts: Cut[] = cuts.filter(
            (c) => c.operationId === operation.id
        );

        // Calculate leads for each cut
        const calculations: Promise<void>[] = operationCuts.map(async (cut) => {
            const chain: Chain | undefined = chains.find(
                (c: Chain) => c.id === cut.chainId
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

/**
 * Generate cuts from an operation (pure function)
 * Returns cuts and warnings, does not interact with stores
 */
export async function createCutsFromOperation(
    operation: Operation,
    chains: Chain[],
    parts: DetectedPart[],
    tools: Tool[],
    tolerance: number
): Promise<CutGenerationResult> {
    // If operation is disabled or has no targets, don't generate cuts
    if (!operation.enabled || operation.targetIds.length === 0) {
        return { cuts: [], warnings: [] };
    }

    // Generate cuts for all targets in parallel
    const cutPromises = operation.targetIds.map((targetId, index) => {
        if (operation.targetType === 'chains') {
            return generateCutsForChainWithOperation(
                operation,
                targetId,
                index,
                chains,
                tools,
                parts,
                tolerance
            );
        } else if (operation.targetType === 'parts') {
            return generateCutsForPartTargetWithOperation(
                operation,
                targetId,
                index,
                chains,
                parts,
                tools,
                tolerance
            );
        } else {
            // Return empty result for unknown target types
            return Promise.resolve({ cuts: [], warnings: [] });
        }
    });

    // Wait for all cuts to be generated
    const results = await Promise.all(cutPromises);

    // Flatten all cuts and warnings
    const allCuts: Cut[] = results.flatMap((result) => result.cuts);
    const allWarnings: CutGenerationResult['warnings'] = results.flatMap(
        (result) => result.warnings
    );

    return {
        cuts: allCuts,
        warnings: allWarnings,
    };
}
