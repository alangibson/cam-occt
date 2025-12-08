import type { CutGenerationResult } from './interfaces';
import type { Operation } from '$lib/cam/operation/classes.svelte';
import type { Cut } from '$lib/cam/cut/classes.svelte';
import { generateCutsForChainsWithOperation } from './chain-operations';
import { generateCutsForPartsWithOperation } from './part-operations';
import { generateSpotsForChainsWithOperation } from './spot-operations';
import { OperationAction } from '$lib/cam/operation/enums';

/**
 * Generate cuts from an operation (pure function)
 *
 * This is the top-level cut generation function that:
 * 1. Validates operation is enabled and has targets
 * 2. Generates cuts for each target (chain or part)
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

    return {
        cuts: allCuts,
        warnings: allWarnings,
    };
}
