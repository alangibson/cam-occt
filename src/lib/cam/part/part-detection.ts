/**
 * Part Detection Algorithm
 *
 * This algorithm analyzes chains to detect hierarchical part structures:
 * - Closed chains that are not enclosed by others are part shells (outer boundaries)
 * - Closed chains enclosed within shells are holes
 * - Open chains that cross boundaries generate warnings
 * - Supports recursive nesting (parts within holes within parts)
 *
 */

import { Chain } from '$lib/cam/chain/classes';
import type { Point2D } from '$lib/geometry/point/interfaces';
import {
    buildContainmentHierarchy,
    calculateNestingLevel,
} from '$lib/cam/part/geometric-containment';
import { normalizeChain } from '$lib/cam/chain/chain-normalization';
import { getShapeEndPoint, getShapeStartPoint } from '$lib/cam/shape/functions';
import { CHAIN_CLOSURE_TOLERANCE } from '$lib/cam/chain/constants';
import { isChainClosed } from '$lib/cam/chain/functions';
import type { BoundingBoxData } from '$lib/geometry/bounding-box/interfaces';
import { calculateChainBoundingBox } from '$lib/geometry/bounding-box/functions';
import type {
    PartData,
    PartDetectionParameters,
    PartDetectionResult,
    PartDetectionWarning,
} from './interfaces';
import { DEFAULT_PART_DETECTION_PARAMETERS } from './defaults';
import { PartType } from './enums';
import { isPointInsideChainExact } from '$lib/cam/chain/point-in-chain';
import { Part } from './classes.svelte';

/**
 * Detects parts from a collection of chains using geometric containment
 */
export async function detectParts(
    chains: Chain[],
    tolerance: number = CHAIN_CLOSURE_TOLERANCE,
    params: PartDetectionParameters = DEFAULT_PART_DETECTION_PARAMETERS,
    layerName: string = '0'
): Promise<PartDetectionResult> {
    const warnings: PartDetectionWarning[] = [];

    // CRITICAL: Normalize all chains BEFORE any analysis
    const normalizedChains: Chain[] = chains.map((chain) =>
        normalizeChain(chain)
    );

    // Separate closed and open chains (using normalized chains)
    const closedChains: Chain[] = normalizedChains.filter((chain) =>
        isChainClosed(chain, tolerance)
    );
    const openChains: Chain[] = normalizedChains.filter(
        (chain) => !isChainClosed(chain, tolerance)
    );

    // Calculate bounding boxes for all closed chains
    const chainBounds: Map<string, BoundingBoxData> = new Map<
        string,
        BoundingBoxData
    >();
    for (const chain of closedChains) {
        chainBounds.set(chain.id, calculateChainBoundingBox(chain));
    }

    // Build containment hierarchy first to identify part chains
    // (needed for slot detection)
    const containmentMap: Map<string, string> = await buildContainmentHierarchy(
        closedChains,
        tolerance,
        params
    );

    const allPartChains: Chain[] = identifyPartChains(
        closedChains,
        containmentMap
    );

    // Detect slots from open chains
    // A slot is an open chain where both endpoints are inside the same part
    const slotsByPart: Map<string, Chain[]> = new Map<string, Chain[]>();
    let slotCounter: number = 1;
    const nonSlotOpenChains: Chain[] = [];

    for (const openChain of openChains) {
        const containingPartId: string | null = detectSlotContainer(
            openChain,
            allPartChains
        );

        if (containingPartId) {
            // This is a slot - add it to the part's slot list
            if (!slotsByPart.has(containingPartId)) {
                slotsByPart.set(containingPartId, []);
            }
            slotsByPart.get(containingPartId)!.push(openChain);
        } else {
            // Not a slot - check for boundary crossing issues
            nonSlotOpenChains.push(openChain);
        }
    }

    // Check non-slot open chains for boundary crossing warnings
    for (const openChain of nonSlotOpenChains) {
        const crossingIssue: string | null = checkOpenChainBoundaryCrossing(
            openChain,
            closedChains,
            chainBounds
        );
        if (crossingIssue) {
            warnings.push({
                type: 'overlapping_boundary',
                chainId: openChain.id,
                message: crossingIssue,
            });
        }
    }

    // HIERARCHICAL APPROACH: Support true nesting where parts can exist inside holes
    // Level 0: Root shells (no parent) = parts
    // Level 1: Chains inside parts = holes
    // Level 2: Chains inside holes = parts (nested parts)
    // Level 3: Chains inside nested parts = holes
    // And so on...

    // Build part structures - each part chain becomes a part
    const parts: Part[] = [];
    let partCounter: number = 1;

    for (const partChain of allPartChains) {
        // Find all chains directly contained within this part chain (these become holes)
        const directHoles: Chain[] = [];
        for (const [childId, parentId] of containmentMap.entries()) {
            if (parentId === partChain.id) {
                const holeChain: Chain | undefined = closedChains.find(
                    (c) => c.id === childId
                );
                // Only add as hole if the child is not itself a part
                if (holeChain && !allPartChains.some((p) => p.id === childId)) {
                    directHoles.push(holeChain);
                }
            }
        }

        // Get slots for this part
        const slotChains: Chain[] = slotsByPart.get(partChain.id) || [];
        const partSlots = slotChains.map((slotChain) => ({
            id: `${layerName}-slot-${slotCounter++}`,
            chain: slotChain.toData(),
            type: PartType.SLOT as const,
            boundingBox: chainBounds.get(slotChain.id)!,
        }));

        // Create part structure
        const partData: PartData = {
            id: `${layerName}-part-${partCounter}`,
            shell: partChain.toData(),
            type: PartType.SHELL,
            boundingBox: chainBounds.get(partChain.id)!,
            voids: directHoles.map((hole, idx) => ({
                id: `${layerName}-hole-${partCounter}-${idx + 1}`,
                chain: hole.toData(),
                type: PartType.HOLE,
                boundingBox: chainBounds.get(hole.id)!,
            })),
            slots: partSlots,
            layerName: layerName,
        };

        // Wrap PartData in Part class
        parts.push(new Part(partData));
        partCounter++;
    }

    // If no parts were detected and there are open chains, warn about potential unclosed geometry
    if (parts.length === 0 && openChains.length > 0) {
        warnings.push({
            type: 'overlapping_boundary',
            chainId: 'all-open-chains',
            message: `No parts detected. Found ${openChains.length} unclosed chain${openChains.length === 1 ? '' : 's'}. Check for gaps in your drawing geometry - chains may not be properly connected to form closed shapes.`,
        });
    }

    // Also warn if we have closed chains but still no parts (shouldn't happen with geometric containment)
    if (parts.length === 0 && closedChains.length > 0) {
        warnings.push({
            type: 'overlapping_boundary',
            chainId: 'all-closed-chains',
            message: `No parts detected despite having ${closedChains.length} closed chain${closedChains.length === 1 ? '' : 's'}. This may indicate a problem with geometric containment analysis.`,
        });
    }

    return { parts, warnings };
}

/**
 * Identifies which chains are parts based on hierarchical nesting levels
 * Rules:
 * - Level 0 (no parent): Part
 * - Level 1 (inside part): Hole
 * - Level 2 (inside hole): Part
 * - Level 3 (inside nested part): Hole
 * - And so on...
 */
function identifyPartChains(
    closedChains: Chain[],
    containmentMap: Map<string, string>
): Chain[] {
    const partChains: Chain[] = [];

    // Calculate nesting level for each chain
    const nestingLevels: Map<string, number> = new Map<string, number>();

    for (const chain of closedChains) {
        const level: number = calculateNestingLevel(chain.id, containmentMap);
        nestingLevels.set(chain.id, level);
    }

    // Chains at even nesting levels (0, 2, 4, ...) are parts
    // Chains at odd nesting levels (1, 3, 5, ...) are holes
    for (const chain of closedChains) {
        const level: number = nestingLevels.get(chain.id) || 0;
        if (level % 2 === 0) {
            partChains.push(chain);
        }
    }

    return partChains;
}

/**
 * Checks if an open chain crosses part boundaries
 */
function checkOpenChainBoundaryCrossing(
    openChain: Chain,
    closedChains: Chain[],
    chainBounds: Map<string, BoundingBoxData>
): string | null {
    for (const closedChain of closedChains) {
        const closedBounds: BoundingBoxData | undefined = chainBounds.get(
            closedChain.id
        );
        if (!closedBounds) continue;

        // Check if open chain crosses the boundary (not just intersects bounding box)
        // An open chain crosses a boundary if:
        // 1. Its start point is inside the closed region AND end point is outside, OR
        // 2. Its start point is outside the closed region AND end point is inside

        const startInside: boolean = isPointInBoundingBox(
            getOpenChainStart(openChain),
            closedBounds
        );
        const endInside: boolean = isPointInBoundingBox(
            getOpenChainEnd(openChain),
            closedBounds
        );

        if (startInside !== endInside) {
            // Chain crosses the boundary
            return `Chain may cross the boundary of a closed region (chain ${closedChain.id})`;
        }
    }

    return null;
}

/**
 * Gets the starting point of an open chain
 */
function getOpenChainStart(chain: Chain): Point2D | null {
    if (chain.shapes.length === 0) return null;
    return getShapeStartPoint(chain.shapes[0]);
}

/**
 * Gets the ending point of an open chain
 */
function getOpenChainEnd(chain: Chain): Point2D | null {
    if (chain.shapes.length === 0) return null;
    return getShapeEndPoint(chain.shapes[chain.shapes.length - 1]);
}

/**
 * Checks if a point is inside a bounding box
 */
function isPointInBoundingBox(
    point: Point2D | null,
    bbox: BoundingBoxData
): boolean {
    if (!point) return false;
    return (
        point.x >= bbox.min.x &&
        point.x <= bbox.max.x &&
        point.y >= bbox.min.y &&
        point.y <= bbox.max.y
    );
}

/**
 * Detects which part (if any) contains an open chain as a slot
 * A slot is an open chain where both endpoints are inside the same part shell
 *
 * @param openChain - The open chain to test
 * @param partChains - Array of closed chains that are parts
 * @returns The chain ID of the containing part, or null if not a slot
 */
function detectSlotContainer(
    openChain: Chain,
    partChains: Chain[]
): string | null {
    const startPoint: Point2D | null = getOpenChainStart(openChain);
    const endPoint: Point2D | null = getOpenChainEnd(openChain);

    if (!startPoint || !endPoint) return null;

    // Check each part to see if both endpoints are inside
    for (const partChain of partChains) {
        const startInside: boolean = isPointInsideChainExact(
            startPoint,
            partChain
        );
        const endInside: boolean = isPointInsideChainExact(endPoint, partChain);

        // Both endpoints must be inside the same part for it to be a slot
        if (startInside && endInside) {
            return partChain.id;
        }
    }

    return null;
}
