import type { Path } from '$lib/stores/paths/interfaces';
import type { Chain } from '$lib/geometry/chain/interfaces';
import {
    type Arc,
    GeometryType,
    type Line,
    type Point2D,
    type Shape,
} from '$lib/types/geometry';
import type { DetectedPart } from '$lib/algorithms/part-detection/part-detection';
import { calculateLeads } from '$lib/algorithms/leads/lead-calculation';
import { type LeadConfig } from '$lib/algorithms/leads/interfaces';
import {
    convertLeadGeometryToPoints,
    createLeadInConfig,
    createLeadOutConfig,
} from '$lib/algorithms/leads/functions';
import { calculateSquaredDistance } from '$lib/geometry/math';
import {
    getChainEndPoint,
    getChainStartPoint,
} from '$lib/geometry/chain/functions';
import { calculateMidpoint } from '$lib/geometry/point/functions';
import { calculateArcMidpointAngle } from '$lib/geometry/arc/functions';

/**
 * Find the nearest path from a current point
 * Extracted from optimize-cut-order.ts to eliminate duplication
 */
export function findNearestPath(
    currentPoint: Point2D,
    pathsToSearch: Path[],
    chains: Map<string, Chain>,
    unvisited: Set<Path>,
    findPartForChain: (chainId: string) => DetectedPart | undefined
): { path: Path | null; distance: number } {
    let nearestPath: Path | null = null;
    let nearestDistance = Infinity;

    for (const path of pathsToSearch) {
        if (!unvisited.has(path)) continue;

        const chain = chains.get(path.chainId);
        if (!chain) continue;

        const part = findPartForChain(path.chainId);
        const startPoint = getPathStartPoint(path, chain, part);
        const dist = calculateDistance(currentPoint, startPoint);

        if (dist < nearestDistance) {
            nearestDistance = dist;
            nearestPath = path;
        }
    }

    return { path: nearestPath, distance: nearestDistance };
}

/**
 * Calculate Euclidean distance between two points
 * Extracted from optimize-cut-order.ts to eliminate duplication
 */
export function calculateDistance(p1: Point2D, p2: Point2D): number {
    return Math.sqrt(calculateSquaredDistance(p1, p2));
}

/**
 * Helper function to prepare lead calculation chain and configs
 */
export function prepareChainsAndLeadConfigs(
    path: Path,
    chain: Chain
): {
    leadCalculationChain: Chain;
    leadInConfig: LeadConfig;
    leadOutConfig: LeadConfig;
} {
    // Use offset geometry for lead calculation if available
    let leadCalculationChain: Chain = chain;
    if (path.offset && path.offset.offsetShapes.length > 0) {
        // Create a temporary chain from offset shapes
        // IMPORTANT: Preserve the clockwise property from the original chain
        // to maintain consistent normal direction calculation
        // Also preserve originalChainId for part context lookup
        leadCalculationChain = {
            id: chain.id + '_offset_temp',
            shapes: path.offset.offsetShapes,
            clockwise: chain.clockwise,
            originalChainId: chain.id,
        };
    }

    const leadInConfig = createLeadInConfig(path);
    const leadOutConfig = createLeadOutConfig(path);

    return { leadCalculationChain, leadInConfig, leadOutConfig };
}

/**
 * Get the effective start point of a path, accounting for lead-in geometry and offset
 * Extracted from optimize-cut-order.ts to eliminate duplication
 */
export function getPathStartPoint(
    path: Path,
    chain: Chain,
    part?: DetectedPart
): Point2D {
    // Check if path has lead-in
    if (
        path.leadInConfig &&
        path.leadInConfig.type !== 'none' &&
        path.leadInConfig.length > 0
    ) {
        try {
            const { leadCalculationChain, leadInConfig, leadOutConfig } =
                prepareChainsAndLeadConfigs(path, chain);

            const leadResult = calculateLeads(
                leadCalculationChain,
                leadInConfig,
                leadOutConfig,
                path.cutDirection,
                part
            );

            if (leadResult.leadIn) {
                // Convert geometry to points and return the first point (start of lead-in)
                const points = convertLeadGeometryToPoints(leadResult.leadIn);
                if (points.length > 0) {
                    return points[0];
                }
            }
        } catch (error) {
            console.warn(
                'Failed to calculate lead-in for path:',
                path.name,
                error
            );
        }
    }

    // Fallback to chain start point (use offset if available)
    if (path.offset && path.offset.offsetShapes.length > 0) {
        const offsetChain: Chain = {
            id: chain.id + '_offset_temp',
            shapes: path.offset.offsetShapes,
            clockwise: chain.clockwise,
            originalChainId: chain.id,
        };
        return getChainStartPoint(offsetChain);
    }

    return getChainStartPoint(chain);
}

/**
 * Get the effective start point of a path's chain, using offset geometry if available
 */
export function getPathChainStartPoint(path: Path, chain: Chain): Point2D {
    if (path.offset && path.offset.offsetShapes.length > 0) {
        const offsetChain: Chain = {
            id: chain.id + '_offset_temp',
            shapes: path.offset.offsetShapes,
            clockwise: chain.clockwise,
            originalChainId: chain.id,
        };
        return getChainStartPoint(offsetChain);
    }

    return getChainStartPoint(chain);
}

/**
 * Get the effective end point of a path's chain, using offset geometry if available
 */
export function getPathChainEndPoint(path: Path, chain: Chain): Point2D {
    if (path.offset && path.offset.offsetShapes.length > 0) {
        const offsetChain: Chain = {
            id: chain.id + '_offset_temp',
            shapes: path.offset.offsetShapes,
            clockwise: chain.clockwise,
            originalChainId: chain.id,
        };
        return getChainEndPoint(offsetChain);
    }

    return getChainEndPoint(chain);
}

/**
 * Reconstruct a chain from split shapes, reordering to start at the split point
 * Extracted from optimize-start-points.ts to eliminate duplication
 */
export function reconstructChainFromSplit(
    originalShapes: Shape[],
    splitIndex: number,
    splitShapes: [Shape, Shape]
): Shape[] {
    const newShapes: Shape[] = [];

    // Add the second half of the split shape (this becomes the new start)
    newShapes.push(splitShapes[1]);

    // Add all shapes after the split shape
    for (let i = splitIndex + 1; i < originalShapes.length; i++) {
        newShapes.push(originalShapes[i]);
    }

    // Add all shapes before the split shape
    for (let i = 0; i < splitIndex; i++) {
        newShapes.push(originalShapes[i]);
    }

    // Add the first half of the split shape (this becomes the new end)
    newShapes.push(splitShapes[0]);

    return newShapes;
}

/**
 * Create a split shape with consistent property handling
 */
export function createSplitShape(
    originalShape: Shape,
    splitIndex: string,
    type: Shape['type'],
    geometry: Shape['geometry']
): Shape {
    return {
        id: `${originalShape.id}-split-${splitIndex}`,
        type,
        geometry,
        ...(originalShape.layer && { layer: originalShape.layer }),
        ...(originalShape.originalType && {
            originalType: originalShape.originalType,
        }),
        ...(originalShape.metadata && { metadata: originalShape.metadata }),
    };
}

/**
 * Splits a line shape at its midpoint, creating two line shapes
 */
export function splitLineAtMidpoint(shape: Shape): [Shape, Shape] | null {
    if (shape.type !== 'line') return null;

    const geom = shape.geometry as Line;
    const midpoint = calculateMidpoint(geom.start, geom.end);

    // Create two line geometries
    const firstGeometry = {
        start: { ...geom.start },
        end: midpoint,
    };

    const secondGeometry = {
        start: midpoint,
        end: { ...geom.end },
    };

    return [
        createSplitShape(shape, '1', GeometryType.LINE, firstGeometry),
        createSplitShape(shape, '2', GeometryType.LINE, secondGeometry),
    ];
}

/**
 * Splits an arc shape at its midpoint angle, creating two arc shapes
 */
export function splitArcAtMidpoint(shape: Shape): [Shape, Shape] | null {
    if (shape.type !== GeometryType.ARC) return null;

    const geom = shape.geometry as Arc;
    const midAngle = calculateArcMidpointAngle(geom.startAngle, geom.endAngle);

    // Create two arc geometries
    const firstGeometry = {
        center: { ...geom.center },
        radius: geom.radius,
        startAngle: geom.startAngle,
        endAngle: midAngle,
    };

    const secondGeometry = {
        center: { ...geom.center },
        radius: geom.radius,
        startAngle: midAngle,
        endAngle: geom.endAngle,
    };

    return [
        createSplitShape(shape, '1', GeometryType.ARC, firstGeometry),
        createSplitShape(shape, '2', GeometryType.ARC, secondGeometry),
    ];
}
