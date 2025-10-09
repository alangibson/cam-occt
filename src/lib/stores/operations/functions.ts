import type { Chain } from '$lib/geometry/chain/interfaces';
import { CutDirection } from '$lib/types/direction';
import { reverseChain } from '$lib/geometry/chain';
import {
    DIRECTION_CLOCKWISE,
    DIRECTION_COUNTERCLOCKWISE,
} from '$lib/geometry/constants';
import { OffsetDirection } from '$lib/algorithms/offset-calculation/offset/types';
import { offsetChain } from '$lib/algorithms/offset-calculation/chain/offset';
import type { GapFillingResult } from '$lib/algorithms/offset-calculation/chain/types';
import type { DetectedPart, PartHole, Shape } from '$lib/types';
import type { Tool } from '$lib/stores/tools/interfaces';
import type {
    ChainOffsetResult,
    OffsetCalculation,
    Operation,
    CutGenerationResult,
    CutLeadResult,
} from './interfaces';
import { KerfCompensation } from '$lib/types/kerf-compensation';
import type { Cut } from '$lib/stores/cuts/interfaces';
import { calculateLeads } from '$lib/algorithms/leads/lead-calculation';
import {
    createLeadInConfig,
    createLeadOutConfig,
} from '$lib/algorithms/leads/functions';

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
export function calculateChainOffset(
    chain: Chain,
    kerfCompensation: OffsetDirection,
    toolId: string | null,
    tools: Tool[]
): ChainOffsetResult | null {
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
    if (!tool.kerfWidth || tool.kerfWidth <= 0) {
        console.warn(`Tool "${tool.toolName}" has no kerf width set`);
        return null;
    }

    // Calculate offset distance (kerf/2)
    const offsetDistance: number = tool.kerfWidth / 2;

    try {
        // Call offset calculation
        // For inset, use negative distance; for outset, use positive
        const direction: number =
            kerfCompensation === OffsetDirection.INSET
                ? DIRECTION_CLOCKWISE
                : DIRECTION_COUNTERCLOCKWISE;
        const offsetResult = offsetChain(chain, offsetDistance * direction, {
            tolerance: 0.1,
            maxExtension: 50,
            snapThreshold: 0.5,
        });

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
            kerfWidth: tool.kerfWidth,
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
    };

    return { cutChain, executionClockwise };
}

export async function generateCutsForChainWithOperation(
    operation: Operation,
    targetId: string,
    index: number,
    chains: Chain[],
    tools: Tool[],
    parts: DetectedPart[]
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
        const offsetResult = calculateChainOffset(
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
        offset: calculatedOffset,
        cutChain: cutChain,
        isHole: false,
        holeUnderspeedPercent: undefined,
    };

    // Calculate leads for the cut
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
    tools: Tool[]
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
        const offsetResult = calculateChainOffset(
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
        offset: shellCalculatedOffset,
        cutChain: shellExecutionChain,
        isHole: false,
        holeUnderspeedPercent: operation.holeUnderspeedEnabled
            ? operation.holeUnderspeedPercent
            : undefined,
    };

    // Calculate leads for shell cut
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
                const offsetResult = calculateChainOffset(
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
                offset: holeCalculatedOffset,
                cutChain: holeExecutionChain,
                isHole: true,
                holeUnderspeedPercent: operation.holeUnderspeedEnabled
                    ? operation.holeUnderspeedPercent
                    : undefined,
            };

            // Calculate leads for hole cut
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

        // Use offset geometry for lead calculation if available
        let leadCalculationChain: Chain = chain;
        if (cut.offset && cut.offset.offsetShapes.length > 0) {
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
        }

        // Calculate leads using the appropriate chain (original or offset)
        const leadResult: ReturnType<typeof calculateLeads> = calculateLeads(
            leadCalculationChain,
            leadInConfig,
            leadOutConfig,
            cut.cutDirection,
            part
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
    tools: Tool[]
): Promise<CutGenerationResult> {
    // If operation is disabled or has no targets, don't generate cuts
    if (!operation.enabled || operation.targetIds.length === 0) {
        return { cuts: [], warnings: [] };
    }

    const allCuts: Cut[] = [];
    const allWarnings: CutGenerationResult['warnings'] = [];

    // Generate cuts for each target
    for (let index = 0; index < operation.targetIds.length; index++) {
        const targetId = operation.targetIds[index];
        if (operation.targetType === 'chains') {
            const result: CutGenerationResult =
                await generateCutsForChainWithOperation(
                    operation,
                    targetId,
                    index,
                    chains,
                    tools,
                    parts
                );
            allCuts.push(...result.cuts);
            allWarnings.push(...result.warnings);
        } else if (operation.targetType === 'parts') {
            const result: CutGenerationResult =
                await generateCutsForPartTargetWithOperation(
                    operation,
                    targetId,
                    index,
                    chains,
                    parts,
                    tools
                );
            allCuts.push(...result.cuts);
            allWarnings.push(...result.warnings);
        }
    }

    return {
        cuts: allCuts,
        warnings: allWarnings,
    };
}
