/**
 * Geometric Containment Library
 *
 * Provides unified containment detection for points in polygons,
 * shapes within shapes, and polygon containment hierarchies.
 */

import { Chain } from '$lib/cam/chain/classes.svelte';
import { MAX_CONTAINMENT_NESTING_LEVEL } from '$lib/cam/part/constants';

/**
 * Build Chain containment hierarchy.
 * Main entry point function for Chain containment heirarchy algorithm.
 */
export function buildContainmentHierarchy(
    chains: Chain[]
): Map<string, string> {
    // child -> parent
    const containmentMap: Map<string, string> = new Map<string, string>();

    // Only work with closed chains (only they can contain others)
    const closedChains = chains.filter((chain) => chain.isClosed);

    if (closedChains.length < 2) return containmentMap;

    // Store areas in Map for synchronous sort comparator
    const chainAreas = new Map<string, number>();
    for (const chain of closedChains) {
        const area = chain.area(); // Populates Chain.#area cache
        chainAreas.set(chain.id, area);
    }

    // Sort by area (largest first) using cached values
    const chainsSortedByArea = [...closedChains].sort(
        (a, b) => chainAreas.get(b.id)! - chainAreas.get(a.id)!
    );

    // For each chain, find its smallest containing parent
    for (let i = 1; i < chainsSortedByArea.length; i++) {
        const current = chainsSortedByArea[i];
        const currentArea = chainAreas.get(current.id)!;
        let bestParent: Chain | null = null;
        let smallestArea = Infinity;

        // Only check larger chains (earlier in sorted array) as potential parents
        for (let j = 0; j < i; j++) {
            const potential = chainsSortedByArea[j];
            const potentialArea = chainAreas.get(potential.id)!;

            // PERFORMANCE: Skip if potential parent has same or smaller area
            // A chain cannot be contained by a chain with less or equal area
            if (potentialArea <= currentArea) continue;

            // PERFORMANCE: Early exit if we found a parent and remaining candidates
            // are much larger. If bestParent exists and potential is significantly
            // larger than bestParent, skip it (we want the smallest containing parent)
            if (bestParent !== null && potentialArea > smallestArea * 2) {
                continue;
            }

            // PERFORMANCE: Bounding box filtering
            // Skip expensive geometric check if bounding boxes don't overlap
            if (!potential.boundary.overlaps(current.boundary)) {
                continue;
            }

            // Do full geometric containment check
            const isContained = potential.contains(current);

            if (isContained) {
                if (potentialArea < smallestArea) {
                    smallestArea = potentialArea;
                    bestParent = potential;
                }
            }
        }

        // If we found a parent, record the relationship
        if (bestParent) {
            containmentMap.set(current.id, bestParent.id);
        }
    }

    return containmentMap;
}

/**
 * Calculate the nesting level of a chain in the containment hierarchy
 */
export function calculateNestingLevel(
    chainId: string,
    containmentMap: Map<string, string>
): number {
    let level = 0;
    let currentId = chainId;

    while (containmentMap.has(currentId)) {
        level++;
        currentId = containmentMap.get(currentId)!;

        // Prevent infinite loops
        if (level > MAX_CONTAINMENT_NESTING_LEVEL) {
            console.warn('Potential infinite loop in containment hierarchy');
            break;
        }
    }

    return level;
}

/**
 * Identify which chains are shells (root level or even nesting depth)
 */
export function identifyShells(
    chains: Chain[],
    containmentMap: Map<string, string>
): Chain[] {
    const shells: Chain[] = [];

    // Only closed chains can be shells
    const closedChains = chains.filter((chain) => chain.isClosed);

    for (const chain of closedChains) {
        const nestingLevel = calculateNestingLevel(chain.id, containmentMap);

        // Shells are at even nesting levels (0, 2, 4, ...)
        if (nestingLevel % 2 === 0) {
            shells.push(chain);
        }
    }

    return shells;
}
