/**
 * Chain Preparation Module
 *
 * Pure functions for preparing chains for cut execution.
 * Handles chain direction analysis and cut chain creation with proper ordering.
 */

import type { Chain } from '$lib/geometry/chain/interfaces';
import type { Shape } from '$lib/geometry/shape/interfaces';
import { CutDirection } from '$lib/cam/cut/enums';
import {
    getChainCutDirection,
    reverseChain,
} from '$lib/geometry/chain/functions';
import type { CutChainResult } from './interfaces';

/**
 * Helper function to create cut chain with deep cloned shapes ordered for execution.
 *
 * This function:
 * 1. Deep clones shapes to ensure Cut owns its execution order
 * 2. Determines natural direction from original chain
 * 3. Applies user's requested direction preference
 * 4. Reverses chain if needed to match requested direction
 *
 * @param originalChain - The original chain before any offset
 * @param userCutDirection - User's preferred cut direction
 * @param offsetShapes - Optional offset shapes (takes priority over original shapes)
 * @returns Object containing the cut chain and execution clockwise direction
 */
export function createCutChain(
    originalChain: Chain,
    userCutDirection: CutDirection,
    offsetShapes?: Shape[]
): CutChainResult {
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
