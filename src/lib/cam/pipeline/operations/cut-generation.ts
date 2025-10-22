import type { Chain } from '$lib/geometry/chain/interfaces';
import type { Part } from '$lib/cam/part/interfaces';
import type { Tool } from '$lib/cam/tool/interfaces';
import type { Cut } from '$lib/cam/cut/interfaces';
import type { CutGenerationResult } from './interfaces';
import type { Operation } from '$lib/cam/operation/interface';
import { generateCutsForChainsWithOperation } from './chain-operations';
import { generateCutsForPartsWithOperation } from './part-operations';
import { generateAndAdjustKerf } from '$lib/cam/pipeline/kerfs/kerf-generation';

/**
 * Generate cuts from an operation (pure function)
 *
 * This is the top-level cut generation function that:
 * 1. Validates operation is enabled and has targets
 * 2. Generates cuts for each target (chain or part)
 * 3. Generates kerfs for all cuts with overlap detection
 *
 * @param operation - The operation to generate cuts for
 * @param chains - All available chains
 * @param parts - All available parts
 * @param tools - All available tools
 * @param tolerance - Geometric tolerance for calculations
 * @returns Generated cuts and any warnings
 */
export async function createCutsFromOperation(
    operation: Operation,
    chains: Chain[],
    parts: Part[],
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
            return generateCutsForChainsWithOperation(
                operation,
                targetId,
                index,
                chains,
                tools,
                parts,
                tolerance
            );
        } else if (operation.targetType === 'parts') {
            return generateCutsForPartsWithOperation(
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
    const allCuts: Cut[] = results.flatMap(
        (result: CutGenerationResult) => result.cuts
    );
    const allWarnings: CutGenerationResult['warnings'] = results.flatMap(
        (result: CutGenerationResult) => result.warnings
    );

    // Generate kerfs for all cuts (shells, holes, slots) with overlap detection
    const tool = tools.find((t) => t.id === operation.toolId);
    if (tool && tool.kerfWidth > 0) {
        for (const cut of allCuts) {
            try {
                // Get original chain for this cut
                const chain = chains.find((c) => c.id === cut.chainId);
                if (chain) {
                    const originalShapes =
                        cut.offset?.originalShapes || chain.shapes;
                    const originalChainForKerf: Chain = {
                        id: chain.id,
                        shapes: originalShapes,
                    };
                    await generateAndAdjustKerf(
                        cut,
                        tool,
                        originalChainForKerf,
                        tolerance,
                        parts
                    );
                } else {
                    console.warn(
                        `Cannot find chain ${cut.chainId} for cut ${cut.name} - skipping kerf generation`
                    );
                }
            } catch (error) {
                console.warn('Failed to generate kerf for cut:', error);
            }
        }
    }

    return {
        cuts: allCuts,
        warnings: allWarnings,
    };
}
