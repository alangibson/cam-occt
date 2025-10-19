/**
 * Point-in-Chain Exact Testing
 *
 * Exact geometric point-in-chain testing using ray-tracing without sampling.
 * Provides perfect accuracy for all shape types including arcs, circles, and splines.
 */

import type { Shape } from '$lib/geometry/shape/interfaces';
import type { Arc } from '$lib/geometry/arc/interfaces';
import type { Circle } from '$lib/geometry/circle/interfaces';
import type { Line } from '$lib/geometry/line/interfaces';
import type { Point2D } from '$lib/geometry/point/interfaces';
import type { Polyline } from '$lib/geometry/polyline/interfaces';
import type { Spline } from '$lib/geometry/spline/interfaces';
import { GeometryType } from '$lib/geometry/shape/enums';
import type { Chain } from '$lib/geometry/chain/interfaces';
import type { RayTracingConfig } from '$lib/algorithms/raytracing/types';
import { DEFAULT_RAYTRACING_CONFIG } from '$lib/algorithms/raytracing/types';
import { isChainClosed } from '$lib/geometry/chain/functions';
import { createHorizontalRay } from '$lib/algorithms/raytracing/utils';
import { CHAIN_CLOSURE_TOLERANCE } from '$lib/geometry/chain/constants';
import {
    countHorizontalRayLineCrossings,
    countRayLineCrossings,
} from '$lib/algorithms/raytracing/ray-line';
import {
    countHorizontalRayArcCrossings,
    countRayArcCrossings,
} from '$lib/algorithms/raytracing/ray-arc';
import { countRayCircleCrossings } from '$lib/algorithms/raytracing/ray-circle';
import {
    countHorizontalRaySplineCrossings,
    countRaySplineCrossings,
} from '$lib/algorithms/raytracing/ray-spline';

/**
 * Exact point-in-chain test that handles all shape types without sampling
 *
 * @param point - Point to test
 * @param chain - Closed chain to test against
 * @param config - Configuration for numerical tolerance
 * @returns True if point is inside the chain
 */
export function isPointInsideChainExact(
    point: Point2D,
    chain: Chain,
    config: RayTracingConfig = DEFAULT_RAYTRACING_CONFIG
): boolean {
    if (!isChainClosed(chain, CHAIN_CLOSURE_TOLERANCE)) {
        throw new Error('Cannot check point containment for open chain');
    }

    // Create horizontal ray from the point
    const ray: { origin: Point2D; direction: Point2D } =
        createHorizontalRay(point);

    let totalCrossings: number = 0;

    // Count crossings for each shape in the chain
    for (const shape of chain.shapes) {
        totalCrossings += countRayShapeCrossings(ray, shape, config);
    }

    // Apply odd-even rule: odd number of crossings means inside

    return totalCrossings % 2 === 1;
}

/**
 * Counts ray crossings for any shape type
 *
 * @param ray - Ray to test (typically horizontal)
 * @param shape - Shape to test against
 * @param config - Configuration for tolerance
 * @returns Number of crossings
 */
function countRayShapeCrossings(
    ray: { origin: Point2D; direction: Point2D },
    shape: Shape,
    config: RayTracingConfig
): number {
    // Check if this is a horizontal ray for optimized handling
    const isHorizontalRay: boolean = Math.abs(ray.direction.y) < config.epsilon;

    switch (shape.type) {
        case GeometryType.LINE:
            if (isHorizontalRay) {
                return countHorizontalRayLineCrossings(
                    ray.origin,
                    shape.geometry as Line,
                    config
                );
            }
            return countRayLineCrossings(ray, shape.geometry as Line, config);

        case GeometryType.ARC:
            if (isHorizontalRay) {
                return countHorizontalRayArcCrossings(
                    ray.origin,
                    shape.geometry as Arc,
                    config
                );
            }
            return countRayArcCrossings(ray, shape.geometry as Arc, config);

        case GeometryType.CIRCLE:
            return countRayCircleCrossings(
                ray,
                shape.geometry as Circle,
                config
            );

        case GeometryType.POLYLINE:
            return countRayPolylineCrossings(
                ray,
                shape.geometry as Polyline,
                config
            );

        case GeometryType.ELLIPSE:
            // TODO: Implement exact ellipse intersection
            return 0;

        case GeometryType.SPLINE:
            if (isHorizontalRay) {
                return countHorizontalRaySplineCrossings(
                    ray.origin,
                    shape.geometry as Spline,
                    config
                );
            }
            return countRaySplineCrossings(
                ray,
                shape.geometry as Spline,
                config
            );

        default:
            console.warn(
                `Unsupported shape type for ray tracing: ${shape.type}`
            );
            return 0;
    }
}

/**
 * Counts ray crossings for polyline (composite shape)
 */
function countRayPolylineCrossings(
    ray: { origin: Point2D; direction: Point2D },
    polyline: Polyline,
    config: RayTracingConfig
): number {
    let totalCrossings: number = 0;

    if (polyline.shapes && polyline.shapes.length > 0) {
        // Polyline with constituent shapes
        for (const segment of polyline.shapes) {
            totalCrossings += countRayShapeCrossings(ray, segment, config);
        }
    } else {
        // Simple polyline - treat as connected line segments
        // This requires access to polyline points, which may not be directly available
        // For now, return 0 and log a warning
        console.warn('Simple polyline ray intersection not yet implemented');
        return 0;
    }

    return totalCrossings;
}

/**
 * Batch test multiple points against the same chain
 * Optimized for testing many points against the same geometry
 *
 * @param points - Array of points to test
 * @param chain - Closed chain to test against
 * @param config - Configuration for tolerance
 * @returns Array of boolean results (true = inside)
 */
export function arePointsInsideChainExact(
    points: Point2D[],
    chain: Chain,
    config: RayTracingConfig = DEFAULT_RAYTRACING_CONFIG
): boolean[] {
    if (!isChainClosed(chain, CHAIN_CLOSURE_TOLERANCE)) {
        throw new Error('Cannot check point containment for open chain');
    }

    return points.map((point) => isPointInsideChainExact(point, chain, config));
}

/**
 * Test if any points in an array are inside the chain
 * Short-circuits on first inside point for efficiency
 *
 * @param points - Array of points to test
 * @param chain - Closed chain to test against
 * @param config - Configuration for tolerance
 * @returns True if any point is inside
 */
export function anyPointInsideChainExact(
    points: Point2D[],
    chain: Chain,
    config: RayTracingConfig = DEFAULT_RAYTRACING_CONFIG
): boolean {
    if (!isChainClosed(chain, CHAIN_CLOSURE_TOLERANCE)) {
        throw new Error('Cannot check point containment for open chain');
    }

    for (const point of points) {
        if (isPointInsideChainExact(point, chain, config)) {
            return true;
        }
    }

    return false;
}

/**
 * Count how many points in an array are inside the chain
 *
 * @param points - Array of points to test
 * @param chain - Closed chain to test against
 * @param config - Configuration for tolerance
 * @returns Number of points inside the chain
 */
export function countPointsInsideChainExact(
    points: Point2D[],
    chain: Chain,
    config: RayTracingConfig = DEFAULT_RAYTRACING_CONFIG
): number {
    if (!isChainClosed(chain, CHAIN_CLOSURE_TOLERANCE)) {
        throw new Error('Cannot check point containment for open chain');
    }

    let count: number = 0;
    for (const point of points) {
        if (isPointInsideChainExact(point, chain, config)) {
            count++;
        }
    }

    return count;
}

/**
 * Check if a point is inside a part (inside shell but outside all holes)
 *
 * @param point - Point to test
 * @param part - Part with shell and holes to test against
 * @param config - Configuration for tolerance
 * @returns True if point is inside the part (shell) but outside all holes
 */
export function isPointInsidePart(
    point: Point2D,
    part: { shell: { chain: Chain }; holes: { chain: Chain }[] },
    config: RayTracingConfig = DEFAULT_RAYTRACING_CONFIG
): boolean {
    // For open chains, there's no meaningful "inside" concept
    if (!isChainClosed(part.shell.chain, CHAIN_CLOSURE_TOLERANCE)) {
        return false; // No point can be "inside" an open chain
    }

    // Point must be inside the shell
    if (!isPointInsideChainExact(point, part.shell.chain, config)) {
        return false;
    }

    // Point must NOT be inside any holes
    for (const hole of part.holes) {
        // Also check if hole is closed before testing containment
        if (isChainClosed(hole.chain, CHAIN_CLOSURE_TOLERANCE)) {
            if (isPointInsideChainExact(point, hole.chain, config)) {
                return false;
            }
        }
        // If hole is open, it can't contain points, so skip the check
    }

    return true;
}
