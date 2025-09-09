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

import type { Chain } from './chain-detection/chain-detection';
import type { Point2D, Shape, Ellipse, Polyline } from '../../lib/types';
import {
    buildContainmentHierarchy,
    calculateNestingLevel,
} from '../utils/geometric-containment';
import type { PartDetectionParameters } from '../../lib/types/part-detection';
import { DEFAULT_PART_DETECTION_PARAMETERS } from '../../lib/types/part-detection';
import { normalizeChain } from './chain-normalization/chain-normalization';
import { getShapeStartPoint, getShapeEndPoint } from '$lib/geometry';
import {
    calculateChainBoundingBox,
    type BoundingBox,
} from '../utils/shape-bounds-utils';
import { isEllipseClosed } from '../utils/ellipse-utils';
import {
    CHAIN_CLOSURE_TOLERANCE,
    CONTAINMENT_AREA_TOLERANCE,
} from '../geometry/constants';

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

    // Debug: log containment hierarchy
    console.log(
        `Part detection: ${closedChains.length} closed chains, containment map size: ${containmentMap.size}`
    );
    for (const [child, parent] of containmentMap.entries()) {
        console.log(`  ${child} is contained in ${parent}`);
    }

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
    console.log(
        `Found ${allPartChains.length} part chains: ${allPartChains.map((c) => c.id).join(', ')}`
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
 * Checks if a chain forms a closed loop
 */
export function isChainClosed(
    chain: Chain,
    tolerance: number = CHAIN_CLOSURE_TOLERANCE
): boolean {
    if (chain.shapes.length === 0) return false;

    // Special case: single-shape circles, ellipses, and closed polylines are inherently closed
    if (chain.shapes.length === 1) {
        const shape: Shape = chain.shapes[0];
        if (shape.type === 'circle') {
            return true;
        }
        if (shape.type === 'ellipse') {
            const ellipse: Ellipse = shape.geometry as Ellipse;
            // Use the centralized ellipse closed detection logic
            return isEllipseClosed(ellipse, CONTAINMENT_AREA_TOLERANCE);
        }
        if (shape.type === 'polyline') {
            // Check the explicit closed flag from DXF parsing
            const polyline: Polyline = shape.geometry as Polyline;
            if (
                typeof polyline.closed === 'boolean' &&
                polyline.closed === true
            ) {
                return true; // Explicitly closed polylines are definitely closed
            }
            // If closed is false or undefined, fall through to geometric check
        }
    }

    // Get all endpoints from the shapes in the chain
    const endpoints: Point2D[] = [];

    for (const shape of chain.shapes) {
        const shapeEndpoints: Point2D[] = getShapeEndpoints(shape);
        endpoints.push(...shapeEndpoints);
    }

    // A closed chain should have all endpoints paired up (each point appears exactly twice)
    // For a truly closed chain, the start of the first shape should connect to the end of the last shape
    const firstShape: Shape = chain.shapes[0];
    const lastShape: Shape = chain.shapes[chain.shapes.length - 1];

    const firstStart: Point2D = getShapeStartPoint(firstShape);
    const lastEnd: Point2D = getShapeEndPoint(lastShape);

    // Check if the chain is closed (end connects to start within tolerance)
    const distance: number = Math.sqrt(
        Math.pow(firstStart.x - lastEnd.x, 2) +
            Math.pow(firstStart.y - lastEnd.y, 2)
    );

    // Use ONLY the user-set tolerance - no adaptive tolerance calculations allowed
    return distance < tolerance;
}

/**
 * Gets the start and end points of a shape
 */
function getShapeEndpoints(shape: Shape): Point2D[] {
    const start: Point2D = getShapeStartPoint(shape);
    const end: Point2D = getShapeEndPoint(shape);

    const points: Point2D[] = [];
    points.push(start);
    if (start.x !== end.x || start.y !== end.y) {
        points.push(end);
    }

    return points;
}

/**
 * Checks if an open chain crosses part boundaries
 */
function checkOpenChainBoundaryCrossing(
    openChain: Chain,
    closedChains: Chain[],
    chainBounds: Map<string, BoundingBox>
): string | null {
    const _openChainBounds: BoundingBox = calculateChainBoundingBox(openChain);

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
        point.x >= bbox.minX &&
        point.x <= bbox.maxX &&
        point.y >= bbox.minY &&
        point.y <= bbox.maxY
    );
}

/**
 * Type guard for checking if a value is a valid PartType
 */
export function isPartType(value: unknown): value is PartType {
    return Object.values(PartType).includes(value as PartType);
}
