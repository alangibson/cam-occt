import type { Shape, Point2D } from '$lib/types';
import type { Polyline } from '$lib/geometry/polyline';
import { GeometryType } from '$lib/geometry/shape';
import type { Chain } from '$lib/geometry/chain/interfaces';
import { isChainClosed } from '$lib/geometry/chain/functions';
import {
    MIN_VERTICES_FOR_POLYLINE,
    polylineToPoints,
} from '$lib/geometry/polyline';
import {
    createSplitShape,
    reconstructChainFromSplit,
} from './path-optimization-utils';
import { splitShapeAtMidpoint } from '$lib/geometry/shape/functions';
import type { StartPointOptimizationParameters } from '$lib/types/algorithm-parameters';
import { POLYGON_POINTS_MIN } from '$lib/geometry/chain';
import { DEFAULT_ARRAY_NOT_FOUND_INDEX } from '$lib/geometry/constants';

/**
 * Result of optimizing a single chain's start point
 */
interface OptimizeResult {
    originalChain: Chain;
    optimizedChain: Chain | null;
    modified: boolean;
    reason?: string;
}

/**
 * Splits a polyline at its midpoint, creating two polyline shapes
 * Uses the same chain-based approach to preserve arc geometry
 */
function splitPolylineAtMidpoint(polyline: Shape): [Shape, Shape] | null {
    if (polyline.type !== GeometryType.POLYLINE) return null;

    const geom: Polyline = polyline.geometry as Polyline;

    // Handle empty or single-segment polylines
    if (!geom.shapes || geom.shapes.length === 0) return null;

    if (geom.shapes.length === 1) {
        // Single segment polyline - split the individual shape
        const singleShape: Shape = geom.shapes[0];
        let splitShapes: [Shape, Shape] | null = null;

        splitShapes = splitShapeAtMidpoint(singleShape);

        if (!splitShapes) return null;

        // Create two polylines from the split shapes
        const firstGeometry = {
            closed: false,
            shapes: [splitShapes[0]],
        };

        const secondGeometry = {
            closed: false,
            shapes: [splitShapes[1]],
        };

        const firstHalf = createSplitShape(
            polyline,
            '1',
            GeometryType.POLYLINE,
            firstGeometry
        );
        const secondHalf = createSplitShape(
            polyline,
            '2',
            GeometryType.POLYLINE,
            secondGeometry
        );

        return [firstHalf, secondHalf];
    }

    // Multi-segment polyline - use chain logic
    // Create a temporary chain from the polyline's shapes
    const tempChain: Chain = {
        id: `temp-${polyline.id}`,
        shapes: geom.shapes,
    };

    // Find the best shape to split using the same logic as chains
    const shapeIndexToSplit: number = findBestShapeToSplit(tempChain.shapes);

    if (shapeIndexToSplit === DEFAULT_ARRAY_NOT_FOUND_INDEX) return null;

    const shapeToSplit: Shape = tempChain.shapes[shapeIndexToSplit];
    let splitShapes: [Shape, Shape] | null = null;

    // Split the shape based on its type
    if (shapeToSplit.type === GeometryType.POLYLINE) {
        splitShapes = splitPolylineAtMidpoint(shapeToSplit);
    } else {
        splitShapes = splitShapeAtMidpoint(shapeToSplit);
    }

    if (!splitShapes) return null;

    // Reconstruct the polyline shapes using chain logic
    const newShapes = reconstructChainFromSplit(
        tempChain.shapes,
        shapeIndexToSplit,
        splitShapes
    );

    // Find the midpoint to split the rearranged shapes into two polylines

    const halfIndex: number = Math.floor(newShapes.length / 2);

    // Create geometries for the two polylines
    const firstGeometry = {
        closed: false,

        shapes: newShapes.slice(0, halfIndex + 1),
    };

    const secondGeometry = {
        closed: false,

        shapes: newShapes.slice(halfIndex + 1),
    };

    // Create first polyline with first half of shapes
    const firstHalf = createSplitShape(
        polyline,
        '1',
        GeometryType.POLYLINE,
        firstGeometry
    );

    // Create second polyline with second half of shapes
    const secondHalf = createSplitShape(
        polyline,
        '2',
        GeometryType.POLYLINE,
        secondGeometry
    );

    return [firstHalf, secondHalf];
}

/**
 * Finds the best shape to split in a chain, preferring simple shapes like lines and arcs
 */
function findBestShapeToSplit(shapes: Shape[]): number {
    // First pass: look for lines
    for (let i: number = 0; i < shapes.length; i++) {
        if (shapes[i].type === GeometryType.LINE) {
            return i;
        }
    }

    // Second pass: look for 2-point polylines (essentially lines)
    for (let i: number = 0; i < shapes.length; i++) {
        if (shapes[i].type === GeometryType.POLYLINE) {
            const geom: Polyline = shapes[i].geometry as Polyline;
            const points: Point2D[] | null = polylineToPoints(geom);
            if (points && points.length === MIN_VERTICES_FOR_POLYLINE) {
                return i;
            }
        }
    }

    // Third pass: look for arcs
    for (let i: number = 0; i < shapes.length; i++) {
        if (shapes[i].type === GeometryType.ARC) {
            return i;
        }
    }

    // Fourth pass: if no simple shapes, look for any polyline
    for (let i: number = 0; i < shapes.length; i++) {
        if (shapes[i].type === GeometryType.POLYLINE) {
            return i;
        }
    }

    // No splittable shapes found
    return DEFAULT_ARRAY_NOT_FOUND_INDEX;
}

/**
 * Optimizes the start point of a single chain
 */
function optimizeChainStartPoint(
    chain: Chain,
    params: StartPointOptimizationParameters
): OptimizeResult {
    // Only process closed chains with multiple shapes
    if (!isChainClosed(chain, params.tolerance)) {
        return {
            originalChain: chain,
            optimizedChain: null,
            modified: false,
            reason: 'Chain is not closed',
        };
    }

    // Special handling for single-shape chains
    if (chain.shapes.length === 1) {
        const singleShape: Shape = chain.shapes[0];

        // Only certain single shapes can be optimized (polylines, not circles)
        if (singleShape.type === GeometryType.CIRCLE) {
            return {
                originalChain: chain,
                optimizedChain: null,
                modified: false,
                reason: 'Single circle cannot be optimized (no meaningful start point)',
            };
        }

        // Single closed polylines CAN be optimized by splitting them
        if (singleShape.type === GeometryType.POLYLINE) {
            const polylineGeom: Polyline = singleShape.geometry as Polyline;

            // Check if polyline has enough points
            const points: Point2D[] | null = polylineToPoints(polylineGeom);
            if (points && points.length > POLYGON_POINTS_MIN) {
                // Check if it's closed (either explicit flag or geometric closure)
                const hasClosedFlag: boolean = polylineGeom.closed === true;
                const isGeometricallyClosed: boolean = isChainClosed(
                    chain,
                    params.tolerance
                );

                if (hasClosedFlag || isGeometricallyClosed) {
                    // Split the polyline and create a new chain
                    const splitShapes: [Shape, Shape] | null =
                        splitPolylineAtMidpoint(singleShape);
                    if (splitShapes) {
                        const optimizedChain: Chain = {
                            id: chain.id,
                            shapes: [splitShapes[1], splitShapes[0]], // Start with second half
                        };

                        return {
                            originalChain: chain,
                            optimizedChain: optimizedChain,
                            modified: true,
                            reason: `Split single closed polyline at midpoint`,
                        };
                    }
                }
            }
        }

        // For other single shapes or if optimization failed
        return {
            originalChain: chain,
            optimizedChain: null,
            modified: false,
            reason: 'Single-shape chain cannot be optimized',
        };
    }

    // Find the best shape to split (prefer lines and arcs over complex shapes)
    const shapeIndexToSplit: number = findBestShapeToSplit(chain.shapes);

    if (shapeIndexToSplit === DEFAULT_ARRAY_NOT_FOUND_INDEX) {
        return {
            originalChain: chain,
            optimizedChain: null,
            modified: false,
            reason: 'No splittable shapes found',
        };
    }

    const shapeToSplit: Shape = chain.shapes[shapeIndexToSplit];
    let splitShapes: [Shape, Shape] | null = null;

    // Split the shape based on its type
    if (shapeToSplit.type === GeometryType.POLYLINE) {
        splitShapes = splitPolylineAtMidpoint(shapeToSplit);
    } else {
        splitShapes = splitShapeAtMidpoint(shapeToSplit);
    }

    if (!splitShapes) {
        return {
            originalChain: chain,
            optimizedChain: null,
            modified: false,
            reason: `Failed to split ${shapeToSplit.type} shape`,
        };
    }

    // Reconstruct the chain with the split shape
    const newShapes = reconstructChainFromSplit(
        chain.shapes,
        shapeIndexToSplit,
        splitShapes
    );

    // Create the optimized chain
    const optimizedChain: Chain = {
        id: chain.id,
        shapes: newShapes,
    };

    return {
        originalChain: chain,
        optimizedChain: optimizedChain,
        modified: true,
        reason: `Split ${shapeToSplit.type} at index ${shapeIndexToSplit}`,
    };
}

/**
 * Optimizes start points for all chains in the drawing
 * For plasma cutting, it's desirable to start at the midpoint of the first shape
 * in multi-shape closed chains to avoid piercing in narrow corners.
 *
 * @param chains - Array of shape chains to optimize
 * @param params - Optimization parameters including tolerance and split position
 * @returns Array of all shapes with optimized chains replacing original ones
 */
export function optimizeStartPoints(
    chains: Chain[],
    params: StartPointOptimizationParameters
): Shape[] {
    const results: OptimizeResult[] = [];
    const allShapes: Shape[] = [];

    // Process each chain
    for (const chain of chains) {
        const result: OptimizeResult = optimizeChainStartPoint(chain, params);
        results.push(result);

        // Use optimized chain if available, otherwise use original
        const chainToUse: Chain = result.optimizedChain || result.originalChain;
        allShapes.push(...chainToUse.shapes);
    }

    return allShapes;
}
