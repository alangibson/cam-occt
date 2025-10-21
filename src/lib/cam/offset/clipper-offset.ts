/**
 * Clipper2 Offset Wrapper Module
 *
 * Wraps Clipper2's InflatePaths64 function to perform shape offsetting.
 * Handles both inward and outward offsetting in a single operation.
 */

import type { Point2D } from '$lib/geometry/point/interfaces';
import { getClipper2 } from './clipper-init';
import { toClipper2Paths, fromClipper2Paths } from './convert';
import type { JoinType, EndType } from '$lib/wasm/clipper2z';

/**
 * Scale factor matching convert.ts
 */
const SCALE_FACTOR = 1000;

/**
 * Default miter limit for preserving sharp corners
 */
const DEFAULT_MITER_LIMIT = 10.0;

/**
 * Default arc tolerance for round joins (smaller = more precise)
 */
const DEFAULT_ARC_TOLERANCE = 0.25;

/**
 * Options for configuring Clipper2 offset behavior
 */
export interface OffsetOptions {
    /** Join type for corners (Miter, Round, Square) */
    joinType?: JoinType;
    /** End type for open paths (Polygon, Butt, Round, Square) */
    endType?: EndType;
    /** Miter limit ratio (for Miter join type) */
    miterLimit?: number;
    /** Arc tolerance for round joins (smaller = more precise) */
    arcTolerance?: number;
}

/**
 * Offset paths using Clipper2
 *
 * This function offsets the input paths in both directions (inward and outward)
 * using Clipper2's robust offsetting algorithm. Clipper2 automatically handles
 * trimming overlaps and filling gaps.
 *
 * @param pointArrays - Array of point arrays to offset (tessellated shapes)
 * @param distance - Offset distance in original units (positive value)
 * @param isClosed - Whether the chain is closed (affects end treatment)
 * @param options - Optional configuration for join/end types
 * @returns Object containing inner and outer offset results as point arrays
 */
export async function offsetPaths(
    pointArrays: Point2D[][],
    distance: number,
    isClosed: boolean,
    options?: OffsetOptions
): Promise<{ inner: Point2D[][]; outer: Point2D[][] }> {
    const clipper = await getClipper2();
    const { InflatePaths64, JoinType, EndType } = clipper;

    // Convert to Clipper2 format
    const paths = toClipper2Paths(pointArrays, clipper);

    // Ensure correct winding order for closed paths
    // Clipper2 expects counter-clockwise (positive) orientation for outer boundaries
    if (isClosed) {
        const { IsPositive64, ReversePath64 } = clipper;
        for (let i = 0; i < paths.size(); i++) {
            const path = paths.get(i);
            // IsPositive returns true for counter-clockwise paths
            if (!IsPositive64(path)) {
                // Path is clockwise, reverse it to counter-clockwise
                ReversePath64(path);
            }
        }
    }

    // Clipper2 parameters with optional overrides
    const joinType = options?.joinType ?? JoinType.Miter; // Sharp corners (default)
    const endType =
        options?.endType ?? (isClosed ? EndType.Polygon : EndType.Butt);
    const miterLimit = options?.miterLimit ?? DEFAULT_MITER_LIMIT; // High miter limit to preserve sharp corners
    const arcTolerance = options?.arcTolerance ?? DEFAULT_ARC_TOLERANCE; // Precision for round joins

    // Scale distance to match coordinate scaling
    const scaledDistance = distance * SCALE_FACTOR;

    // Offset outward (positive distance)
    const outerPaths = InflatePaths64(
        paths,
        scaledDistance,
        joinType,
        endType,
        miterLimit,
        arcTolerance
    );

    // Offset inward (negative distance)
    const innerPaths = InflatePaths64(
        paths,
        -scaledDistance,
        joinType,
        endType,
        miterLimit,
        arcTolerance
    );

    // Convert back to Point2D arrays
    return {
        inner: fromClipper2Paths(innerPaths),
        outer: fromClipper2Paths(outerPaths),
    };
}
