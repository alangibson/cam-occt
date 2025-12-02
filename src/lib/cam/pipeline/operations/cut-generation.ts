import type { Part } from '$lib/cam/part/classes.svelte';
import type { Cut } from '$lib/cam/cut/classes.svelte';
import type { CutGenerationResult } from './interfaces';
import type { Operation } from '$lib/cam/operation/classes.svelte';
import { Chain } from '$lib/cam/chain/classes';
import { generateCutsForChainsWithOperation } from './chain-operations';
import { generateCutsForPartsWithOperation } from './part-operations';
import { generateSpotsForChainsWithOperation } from './spot-operations';
import { generateAndAdjustKerf } from '$lib/cam/pipeline/kerfs/kerf-generation';
import { OperationAction } from '$lib/cam/operation/enums';

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
 * @param avoidLeadKerfOverlap - Whether to attempt adjusting start point if lead kerf overlaps
 * @returns Generated cuts and any warnings
 */
export async function createCutsFromOperation(
    operation: Operation,
    tolerance: number,
    avoidLeadKerfOverlap: boolean = false
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
        // Route based on operation action
        if (operation.action === OperationAction.SPOT) {
            // Spot operations only work with chains
            if (operation.targetType === 'chains') {
                return generateSpotsForChainsWithOperation(operation, index);
            } else {
                // Parts are disabled for spot operations in UI
                return Promise.resolve({ cuts: [], warnings: [] });
            }
        } else if (operation.action === OperationAction.CUT) {
            // Regular cut operations
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
        } else {
            // Return empty result for unknown action types
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
    // Skip kerf generation for spot operations
    if (
        tool &&
        tool.kerfWidth > 0 &&
        operation.action === OperationAction.CUT
    ) {
        // Get all chains from targets
        const allChains: Chain[] = [];
        const allParts: Part[] = [];

        for (const target of operation.targets) {
            if ('shapes' in target) {
                // It's a Chain
                allChains.push(target as Chain);
            } else {
                // It's a Part
                const part = target as Part;
                allParts.push(part);
                allChains.push(new Chain(part.shell));
                allChains.push(...part.voids.map((v) => new Chain(v.chain)));
                allChains.push(...part.slots.map((s) => new Chain(s.chain)));
            }
        }

        // Collect kerf generation promises for parallel execution
        const kerfPromises = allCuts.map((cut) => {
            // Get original chain for this cut
            const chain = allChains.find((c) => c.id === cut.chainId);
            if (!chain) {
                console.warn(
                    `Cannot find chain ${cut.chainId} for cut ${cut.name} - skipping kerf generation`
                );
                return Promise.resolve();
            }

            const originalShapes = cut.offset?.originalShapes || chain.shapes;
            const originalChainForKerf = new Chain({
                id: chain.id,
                name: chain.name || chain.id,
                shapes: originalShapes,
            });

            return generateAndAdjustKerf(
                cut,
                tool,
                originalChainForKerf,
                tolerance,
                allParts,
                avoidLeadKerfOverlap
            ).catch((error) => {
                console.warn('Failed to generate kerf for cut:', error);
            });
        });

        // Execute all kerf generation in parallel
        await Promise.all(kerfPromises);
    }

    return {
        cuts: allCuts,
        warnings: allWarnings,
    };
}
