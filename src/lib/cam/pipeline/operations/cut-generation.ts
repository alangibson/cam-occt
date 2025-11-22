import type { ChainData } from '$lib/geometry/chain/interfaces';
import type { Part } from '$lib/cam/part/classes.svelte';
import type { Cut } from '$lib/cam/cut/classes.svelte';
import type { CutGenerationResult } from './interfaces';
import type { Operation } from '$lib/cam/operation/classes.svelte';
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
 * @param operation - The operation to generate cuts for (contains tool and targets)
 * @param tolerance - Geometric tolerance for calculations
 * @returns Generated cuts and any warnings
 */
export async function createCutsFromOperation(
    operation: Operation,
    tolerance: number
): Promise<CutGenerationResult> {
    // If operation is disabled or has no targets, don't generate cuts
    if (!operation.enabled || operation.targets.length === 0) {
        return { cuts: [], warnings: [] };
    }

    // Get tool from operation
    const tool = operation.tool;
    if (!tool) {
        return { cuts: [], warnings: [] };
    }

    // Generate cuts for all targets in parallel
    const cutPromises = operation.targets.map((target, index) => {
        if (operation.targetType === 'chains') {
            return generateCutsForChainsWithOperation(
                operation,
                index,
                tolerance
            );
        } else if (operation.targetType === 'parts') {
            return generateCutsForPartsWithOperation(
                operation,
                index,
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
    if (tool && tool.kerfWidth > 0) {
        // Get all chains from targets
        const allChains: ChainData[] = [];
        const allParts: Part[] = [];

        for (const target of operation.targets) {
            if ('shapes' in target) {
                // It's a Chain
                allChains.push(target as ChainData);
            } else {
                // It's a Part
                const part = target as Part;
                allParts.push(part);
                allChains.push(part.shell);
                allChains.push(...part.voids.map((v) => v.chain));
                allChains.push(...part.slots.map((s) => s.chain));
            }
        }

        for (const cut of allCuts) {
            try {
                // Get original chain for this cut
                const chain = allChains.find((c) => c.id === cut.chainId);
                if (chain) {
                    const originalShapes =
                        cut.offset?.originalShapes || chain.shapes;
                    const originalChainForKerf: ChainData = {
                        id: chain.id,
                        shapes: originalShapes,
                    };
                    await generateAndAdjustKerf(
                        cut,
                        tool,
                        originalChainForKerf,
                        tolerance,
                        allParts
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
