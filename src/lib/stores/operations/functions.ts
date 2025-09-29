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
    PathGenerationResult,
    PathLeadResult,
} from './interfaces';
import { KerfCompensation } from '$lib/types/kerf-compensation';
import type { Path } from '$lib/stores/paths/interfaces';
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

    // Deep clone the shapes array to ensure Path owns its execution order
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

export async function generatePathsForChainWithOperation(
    operation: Operation,
    targetId: string,
    index: number,
    chains: Chain[],
    tools: Tool[],
    parts: DetectedPart[]
): Promise<PathGenerationResult> {
    // Use the operation's preferred cut direction
    // For open paths, the stored clockwise property will be null (indicating 'none')
    const chain: Chain | undefined = chains.find((c) => c.id === targetId);

    // Return empty arrays if chain not found
    if (!chain) {
        return { paths: [], warnings: [] };
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

    // Create the path object
    const pathToReturn: Path = {
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

    // Calculate leads for the path
    const leadResult = await calculatePathLeads(
        pathToReturn,
        operation,
        chain,
        parts
    );

    // Add leads to the path if they were calculated
    if (leadResult.leadIn) {
        pathToReturn.leadIn = {
            ...leadResult.leadIn,
            generatedAt: new Date().toISOString(),
            version: '1.0.0',
        };
    }

    if (leadResult.leadOut) {
        pathToReturn.leadOut = {
            ...leadResult.leadOut,
            generatedAt: new Date().toISOString(),
            version: '1.0.0',
        };
    }

    if (leadResult.validation) {
        pathToReturn.leadValidation = {
            ...leadResult.validation,
            validatedAt: new Date().toISOString(),
        };
    }

    return {
        paths: [pathToReturn],
        warnings: warningsToReturn ? [warningsToReturn] : [],
    };
}

export async function generatePathsForPartTargetWithOperation(
    operation: Operation,
    targetId: string,
    index: number,
    chains: Chain[],
    parts: DetectedPart[],
    tools: Tool[]
): Promise<PathGenerationResult> {
    // For parts, create paths for all chains that make up the part
    const part: DetectedPart | undefined = parts.find((p) => p.id === targetId);

    // Return empty arrays if part not found
    if (!part) {
        return { paths: [], warnings: [] };
    }

    const pathsToReturn: Path[] = [];
    const warningsToReturn: {
        chainId: string;
        operationId: string;
        offsetWarnings: string[];
        clearExistingWarnings: boolean;
    }[] = [];

    // Create a path for the shell chain using operation's preferred direction
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

    // Create shell path
    const shellPath: Path = {
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

    // Calculate leads for shell path
    if (shellChain) {
        const shellLeadResult = await calculatePathLeads(
            shellPath,
            operation,
            shellChain,
            parts
        );

        // Add leads to the shell path if they were calculated
        if (shellLeadResult.leadIn) {
            shellPath.leadIn = {
                ...shellLeadResult.leadIn,
                generatedAt: new Date().toISOString(),
                version: '1.0.0',
            };
        }

        if (shellLeadResult.leadOut) {
            shellPath.leadOut = {
                ...shellLeadResult.leadOut,
                generatedAt: new Date().toISOString(),
                version: '1.0.0',
            };
        }

        if (shellLeadResult.validation) {
            shellPath.leadValidation = {
                ...shellLeadResult.validation,
                validatedAt: new Date().toISOString(),
            };
        }
    }

    pathsToReturn.push(shellPath);

    // Create paths for all hole chains (including nested holes)
    let pathOrder: number = index + 1;

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

            // Create hole path
            const holePath: Path = {
                id: crypto.randomUUID(),
                name: `${operation.name} - Part ${targetId.split('-')[1]} ${prefix}(Hole ${holeIndex + 1})`,
                operationId: operation.id,
                chainId: hole.chain.id,
                toolId: operation.toolId,
                enabled: true,
                order: pathOrder++,
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

            // Calculate leads for hole path
            if (holeChain) {
                const holeLeadResult = await calculatePathLeads(
                    holePath,
                    operation,
                    holeChain,
                    parts
                );

                // Add leads to the hole path if they were calculated
                if (holeLeadResult.leadIn) {
                    holePath.leadIn = {
                        ...holeLeadResult.leadIn,
                        generatedAt: new Date().toISOString(),
                        version: '1.0.0',
                    };
                }

                if (holeLeadResult.leadOut) {
                    holePath.leadOut = {
                        ...holeLeadResult.leadOut,
                        generatedAt: new Date().toISOString(),
                        version: '1.0.0',
                    };
                }

                if (holeLeadResult.validation) {
                    holePath.leadValidation = {
                        ...holeLeadResult.validation,
                        validatedAt: new Date().toISOString(),
                    };
                }
            }

            pathsToReturn.push(holePath);

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
        paths: pathsToReturn,
        warnings: warningsToReturn,
    };
}

/**
 * Calculate lead geometry for a path
 */
export async function calculatePathLeads(
    path: Path,
    operation: Operation,
    chain: Chain,
    parts: DetectedPart[]
): Promise<PathLeadResult> {
    try {
        // Skip if both leads are disabled
        if (
            path.leadInConfig?.type === 'none' &&
            path.leadOutConfig?.type === 'none'
        ) {
            return {};
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
        if (path.offset && path.offset.offsetShapes.length > 0) {
            // Create a temporary chain from offset shapes
            // IMPORTANT: Preserve the clockwise property from the original chain
            // to maintain consistent normal direction calculation
            // Also preserve originalChainId for part context lookup
            leadCalculationChain = {
                id: chain.id + '_offset_temp',
                shapes: path.offset.offsetShapes,
                clockwise: chain.clockwise,
                originalChainId: chain.id,
            };
        }

        // Calculate leads using the appropriate chain (original or offset)
        const leadResult: ReturnType<typeof calculateLeads> = calculateLeads(
            leadCalculationChain,
            leadInConfig,
            leadOutConfig,
            path.cutDirection,
            part
        );

        // Build the lead geometry result
        const leadGeometry: PathLeadResult = {};

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
        console.error(
            `Failed to calculate leads for path ${path.name}:`,
            error
        );

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
 * Calculate leads for all paths of an operation
 * Returns a map of path IDs to lead geometry results
 */
export async function calculateOperationLeads(
    operation: Operation,
    paths: Path[],
    chains: Chain[],
    parts: DetectedPart[]
): Promise<Map<string, PathLeadResult>> {
    const leadResults = new Map<string, PathLeadResult>();

    try {
        // Find all paths for this operation
        const operationPaths: Path[] = paths.filter(
            (p) => p.operationId === operation.id
        );

        // Calculate leads for each path
        const calculations: Promise<void>[] = operationPaths.map(
            async (path) => {
                const chain: Chain | undefined = chains.find(
                    (c: Chain) => c.id === path.chainId
                );
                if (chain) {
                    const leadGeometry = await calculatePathLeads(
                        path,
                        operation,
                        chain,
                        parts
                    );
                    leadResults.set(path.id, leadGeometry);
                }
            }
        );

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
 * Generate paths from an operation (pure function)
 * Returns paths and warnings, does not interact with stores
 */
export async function createPathsFromOperation(
    operation: Operation,
    chains: Chain[],
    parts: DetectedPart[],
    tools: Tool[]
): Promise<PathGenerationResult> {
    // If operation is disabled or has no targets, don't generate paths
    if (!operation.enabled || operation.targetIds.length === 0) {
        return { paths: [], warnings: [] };
    }

    const allPaths: Path[] = [];
    const allWarnings: PathGenerationResult['warnings'] = [];

    // Generate paths for each target
    for (let index = 0; index < operation.targetIds.length; index++) {
        const targetId = operation.targetIds[index];
        if (operation.targetType === 'chains') {
            const result: PathGenerationResult =
                await generatePathsForChainWithOperation(
                    operation,
                    targetId,
                    index,
                    chains,
                    tools,
                    parts
                );
            allPaths.push(...result.paths);
            allWarnings.push(...result.warnings);
        } else if (operation.targetType === 'parts') {
            const result: PathGenerationResult =
                await generatePathsForPartTargetWithOperation(
                    operation,
                    targetId,
                    index,
                    chains,
                    parts,
                    tools
                );
            allPaths.push(...result.paths);
            allWarnings.push(...result.warnings);
        }
    }

    return {
        paths: allPaths,
        warnings: allWarnings,
    };
}
