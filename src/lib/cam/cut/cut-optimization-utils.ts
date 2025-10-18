import type { Cut } from '$lib/cam/cut/interfaces';
import type { Chain } from '$lib/geometry/chain/interfaces';
import { GeometryType } from '$lib/geometry/shape/enums';
import type { Shape } from '$lib/geometry/shape/interfaces';
import type { Arc } from '$lib/geometry/arc/interfaces';
import type { Line } from '$lib/geometry/line/interfaces';
import type { Point2D } from '$lib/geometry/point/interfaces';
import type { DetectedPart } from '$lib/cam/part/interfaces';
import { calculateLeads } from '$lib/cam/lead/lead-calculation';
import { type LeadConfig } from '$lib/cam/lead/interfaces';
import {
    convertLeadGeometryToPoints,
    createLeadInConfig,
    createLeadOutConfig,
} from '$lib/cam/lead/functions';
import { calculateSquaredDistance } from '$lib/geometry/math/functions';
import {
    getChainEndPoint,
    getChainStartPoint,
} from '$lib/geometry/chain/functions';
import { calculateMidpoint } from '$lib/geometry/point/functions';
import { calculateArcMidpointAngle } from '$lib/geometry/arc/functions';

/**
 * Find the nearest cut from a current point
 * Extracted from optimize-cut-order.ts to eliminate duplication
 * @param cutStartPointsCache - Optional cache of pre-calculated cut start points for performance
 */
export function findNearestCut(
    currentPoint: Point2D,
    cutsToSearch: Cut[],
    chains: Map<string, Chain>,
    unvisited: Set<Cut>,
    findPartForChain: (chainId: string) => DetectedPart | undefined,
    cutStartPointsCache?: Map<string, Point2D>
): { cut: Cut | null; distance: number } {
    let nearestCut: Cut | null = null;
    let nearestDistance = Infinity;

    for (const cut of cutsToSearch) {
        if (!unvisited.has(cut)) continue;

        let startPoint: Point2D;

        // Use cache if provided, otherwise calculate
        if (cutStartPointsCache && cutStartPointsCache.has(cut.id)) {
            startPoint = cutStartPointsCache.get(cut.id)!;
        } else {
            const chain = chains.get(cut.chainId);
            if (!chain) continue;

            const part = findPartForChain(cut.chainId);
            startPoint = getCutStartPoint(cut, chain, part);
        }

        const dist = calculateDistance(currentPoint, startPoint);

        if (dist < nearestDistance) {
            nearestDistance = dist;
            nearestCut = cut;
        }
    }

    return { cut: nearestCut, distance: nearestDistance };
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
    cut: Cut,
    chain: Chain
): {
    leadCalculationChain: Chain;
    leadInConfig: LeadConfig;
    leadOutConfig: LeadConfig;
} {
    // Use the cut's cutChain if available (it may have been optimized)
    let leadCalculationChain: Chain;
    if (cut.cutChain) {
        // Use the cutChain directly - it already has the correct shape order
        leadCalculationChain = cut.cutChain;
    } else if (cut.offset && cut.offset.offsetShapes.length > 0) {
        // Create a temporary chain from offset shapes
        // IMPORTANT: Preserve the clockwise property from the original chain
        // to maintain consistent normal direction calculation
        // Also preserve originalChainId for part context lookup
        leadCalculationChain = {
            id: chain.id + '_offset_temp',
            shapes: cut.offset.offsetShapes,
            clockwise: chain.clockwise,
            originalChainId: chain.id,
        };
    } else {
        leadCalculationChain = chain;
    }

    const leadInConfig = createLeadInConfig(cut);
    const leadOutConfig = createLeadOutConfig(cut);

    return { leadCalculationChain, leadInConfig, leadOutConfig };
}

/**
 * Get the effective start point of a cut, accounting for lead-in geometry and offset
 * Extracted from optimize-cut-order.ts to eliminate duplication
 */
export function getCutStartPoint(
    cut: Cut,
    chain: Chain,
    part?: DetectedPart
): Point2D {
    // Check if cut has lead-in
    if (
        cut.leadInConfig &&
        cut.leadInConfig.type !== 'none' &&
        cut.leadInConfig.length > 0
    ) {
        try {
            const { leadCalculationChain, leadInConfig, leadOutConfig } =
                prepareChainsAndLeadConfigs(cut, chain);

            const leadResult = calculateLeads(
                leadCalculationChain,
                leadInConfig,
                leadOutConfig,
                cut.cutDirection,
                part,
                cut.normal
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
                'Failed to calculate lead-in for cut:',
                cut.name,
                error
            );
        }
    }

    // Fallback to chain start point (use cutChain if available, then offset if available)
    // Use cut.cutChain if it exists (it may have been reversed for open chains)
    const chainToUse = cut.cutChain || chain;

    if (cut.offset && cut.offset.offsetShapes.length > 0) {
        const offsetChain: Chain = {
            id: chainToUse.id + '_offset_temp',
            shapes: cut.offset.offsetShapes,
            clockwise: chainToUse.clockwise,
            originalChainId: chainToUse.originalChainId || chainToUse.id,
        };
        return getChainStartPoint(offsetChain);
    }

    return getChainStartPoint(chainToUse);
}

/**
 * Helper function to get chain point (start or end) with offset geometry support
 */
function getCutChainPoint(
    cut: Cut,
    chain: Chain,
    getPointFn: (chain: Chain) => Point2D
): Point2D {
    // Use cut.cutChain if it exists (it may have been reversed for open chains)
    const chainToUse = cut.cutChain || chain;

    if (cut.offset && cut.offset.offsetShapes.length > 0) {
        const offsetChain: Chain = {
            id: chainToUse.id + '_offset_temp',
            shapes: cut.offset.offsetShapes,
            clockwise: chainToUse.clockwise,
            originalChainId: chainToUse.originalChainId || chainToUse.id,
        };
        return getPointFn(offsetChain);
    }

    return getPointFn(chainToUse);
}

/**
 * Get the effective start point of a cut's chain, using offset geometry if available
 */
export function getCutChainStartPoint(cut: Cut, chain: Chain): Point2D {
    return getCutChainPoint(cut, chain, getChainStartPoint);
}

/**
 * Get the effective end point of a cut's chain, using offset geometry if available
 */
export function getCutChainEndPoint(cut: Cut, chain: Chain): Point2D {
    return getCutChainPoint(cut, chain, getChainEndPoint);
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
