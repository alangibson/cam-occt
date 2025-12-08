/**
 * Geometric Containment Library
 *
 * Consolidates geometric containment detection functions from:
 * - part-detection.ts
 * - geometric-containment-jsts.ts
 *
 * Provides unified containment detection for points in polygons,
 * shapes within shapes, and polygon containment hierarchies.
 */

import { Chain } from '$lib/cam/chain/classes.svelte';
import type { Point2D } from '$lib/geometry/point/interfaces';
import {
    calculatePolygonArea,
    isPointInPolygon,
} from '$lib/geometry/polygon/functions';
import { DEFAULT_ARRAY_NOT_FOUND_INDEX } from '$lib/geometry/constants';
import { MAX_CONTAINMENT_NESTING_LEVEL } from './constants';
import { isChainContainedInChainClipper2 } from '$lib/cam/chain/functions';

/**
 * Detect containment relationships between multiple polygons
 * Returns a map of polygon indices to their containing polygon index
 * @param polygons Array of polygon vertex arrays
 * @param tolerance Distance tolerance for closure detection
 * @returns Map of containment relationships (contained polygon index -> containing polygon index)
 */
export function detectPolygonContainment(
    polygons: Point2D[][]
): Map<number, number> {
    const containmentMap = new Map<number, number>();

    // Calculate areas for all polygons
    const polygonsWithArea = polygons
        .map((polygon, index) => ({
            polygon,
            index,
            area: calculatePolygonArea({ points: polygon }),
        }))
        .sort((a, b) => b.area - a.area); // Sort by area (largest first)

    // For each polygon, find its smallest containing parent
    for (let i = 1; i < polygonsWithArea.length; i++) {
        const current = polygonsWithArea[i];
        let bestParentIndex = DEFAULT_ARRAY_NOT_FOUND_INDEX;
        let smallestArea = Infinity;

        // Only check larger polygons as potential parents
        for (let j = 0; j < i; j++) {
            const potential = polygonsWithArea[j];

            // Skip if potential parent has same or smaller area
            if (potential.area <= current.area) continue;

            // Check if all points of current polygon are inside potential parent
            let allPointsInside = true;
            for (const point of current.polygon) {
                if (!isPointInPolygon(point, { points: potential.polygon })) {
                    allPointsInside = false;
                    break;
                }
            }

            if (allPointsInside) {
                if (potential.area < smallestArea) {
                    smallestArea = potential.area;
                    bestParentIndex = potential.index;
                }
            }
        }

        // If we found a parent, record the relationship
        if (bestParentIndex >= 0) {
            containmentMap.set(current.index, bestParentIndex);
        }
    }

    return containmentMap;
}

/**
 * Build containment hierarchy using area-based sorting and smallest-container selection
 * Based on MetalHeadCAM cut nesting algorithm
 *
 * Now uses Clipper2 for robust containment detection of complex tessellated geometry
 */
export async function buildContainmentHierarchy(
    chains: Chain[]
): Promise<Map<string, string>> {
    const containmentMap: Map<string, string> = new Map<string, string>(); // child -> parent

    // Only work with closed chains (only they can contain others)
    const closedChains = chains.filter((chain) => chain.isClosed);

    if (closedChains.length < 2) return containmentMap;

    // Sort by area (largest first)
    const chainsSortedByArea = [...closedChains].sort(
        (a, b) => b.area - a.area
    );

    // For each chain, find its smallest containing parent
    for (let i = 1; i < chainsSortedByArea.length; i++) {
        const current = chainsSortedByArea[i];
        let bestParent: Chain | null = null;
        let smallestArea = Infinity;

        // Only check larger chains (earlier in sorted array) as potential parents
        for (let j = 0; j < i; j++) {
            const potential = chainsSortedByArea[j];

            // PERFORMANCE: Skip if potential parent has same or smaller area
            // A chain cannot be contained by a chain with less or equal area
            if (potential.area <= current.area) continue;

            // PERFORMANCE: Early exit if we found a parent and remaining candidates
            // are much larger. If bestParent exists and potential is significantly
            // larger than bestParent, skip it (we want the smallest containing parent)
            if (bestParent !== null && potential.area > smallestArea * 2) {
                continue;
            }

            // Do full geometric containment check using Clipper2
            const isContained = await isChainContainedInChainClipper2(
                current,
                potential
            );

            if (isContained) {
                if (potential.area < smallestArea) {
                    smallestArea = potential.area;
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
