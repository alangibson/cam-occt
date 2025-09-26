/**
 * Part Detection Algorithm
 *
 * This algorithm analyzes chains to detect hierarchical part structures:
 * - Closed chains that are not enclosed by others are part shells (outer boundaries)
 * - Closed chains enclosed within shells are holes
 * - Open chains that cross boundaries generate warnings
 * - Supports recursive nesting (parts within holes within parts)
 *
 * Uses JSTS for robust geometric containment detection based on MetalHeadCAM reference
 */

import type { Chain } from '$lib/geometry/chain/interfaces';
import type { Point2D } from '$lib/types';
import {
    buildContainmentHierarchy,
    calculateNestingLevel,
} from '$lib/algorithms/part-detection/geometric-containment';
import type { PartDetectionParameters } from '$lib/types/part-detection';
import { DEFAULT_PART_DETECTION_PARAMETERS } from '$lib/types/part-detection';
import { normalizeChain } from '$lib/algorithms/chain-normalization/chain-normalization';
import {
    getShapeEndPoint,
    getShapeStartPoint,
} from '$lib/geometry/shape/functions';
import { isChainClosed, CHAIN_CLOSURE_TOLERANCE } from '$lib/geometry/chain';
import type { BoundingBox } from '$lib/geometry/bounding-box';
import { calculateChainBoundingBox } from '$lib/geometry/bounding-box/functions';

/**
 * Part type enumeration
 */
export enum PartType {
    SHELL = 'shell',
    HOLE = 'hole',
}

export interface PartHole {
    id: string;
    chain: Chain;
    type: PartType.HOLE;
    boundingBox: BoundingBox;
    holes: PartHole[]; // Nested holes within this hole (parts)
}

export interface PartShell {
    id: string;
    chain: Chain;
    type: PartType.SHELL;
    boundingBox: BoundingBox;
    holes: PartHole[];
}

export interface DetectedPart {
    id: string;
    shell: PartShell;
    holes: PartHole[];
}

export interface PartDetectionWarning {
    type: 'overlapping_boundary';
    chainId: string;
    message: string;
}

export interface PartDetectionResult {
    parts: DetectedPart[];
    warnings: PartDetectionWarning[];
}

/**
 * Detects parts from a collection of chains using geometric containment
 */
export async function detectParts(
    chains: Chain[],
    tolerance: number = CHAIN_CLOSURE_TOLERANCE,
    params: PartDetectionParameters = DEFAULT_PART_DETECTION_PARAMETERS
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
    const chainBounds: Map<string, BoundingBox> = new Map<
        string,
        BoundingBox
    >();
    for (const chain of closedChains) {
        chainBounds.set(chain.id, calculateChainBoundingBox(chain));
    }

    // Check for open chains that cross boundaries
    for (const openChain of openChains) {
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

    // Build containment hierarchy using JSTS geometric containment
    const containmentMap: Map<string, string> = buildContainmentHierarchy(
        closedChains,
        tolerance,
        params
    );

    // HIERARCHICAL APPROACH: Support true nesting where parts can exist inside holes
    // Level 0: Root shells (no parent) = parts
    // Level 1: Chains inside parts = holes
    // Level 2: Chains inside holes = parts (nested parts)
    // Level 3: Chains inside nested parts = holes
    // And so on...

    const allPartChains: Chain[] = identifyPartChains(
        closedChains,
        containmentMap
    );

    // Build part structures - each part chain becomes a part
    const parts: DetectedPart[] = [];
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

        // Create part structure with shell and holes
        const part: DetectedPart = {
            id: `part-${partCounter}`,
            shell: {
                id: `shell-${partCounter}`,
                chain: partChain,
                type: PartType.SHELL,
                boundingBox: chainBounds.get(partChain.id)!,
                holes: [],
            },
            holes: directHoles.map((hole, idx) => ({
                id: `hole-${partCounter}-${idx + 1}`,
                chain: hole,
                type: PartType.HOLE,
                boundingBox: chainBounds.get(hole.id)!,
                holes: [], // No nested holes in simple part structure
            })),
        };

        // Also set the holes on the shell for backward compatibility
        part.shell.holes = part.holes;

        parts.push(part);
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
    chainBounds: Map<string, BoundingBox>
): string | null {
    for (const closedChain of closedChains) {
        const closedBounds: BoundingBox | undefined = chainBounds.get(
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
    bbox: BoundingBox
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
 * Type guard for checking if a value is a valid PartType
 */
export function isPartType(value: unknown): value is PartType {
    return Object.values(PartType).includes(value as PartType);
}
