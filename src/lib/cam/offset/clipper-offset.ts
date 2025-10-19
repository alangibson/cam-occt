/**
 * Clipper2 Offset Wrapper Module
 *
 * Wraps Clipper2's InflatePaths64 function to perform shape offsetting.
 * Handles both inward and outward offsetting in a single operation.
 */

import type { Point2D } from '$lib/geometry/point/interfaces';
import { getClipper2 } from './clipper-init';
import { toClipper2Paths, fromClipper2Paths } from './convert';

/**
 * Scale factor matching convert.ts
 */
const SCALE_FACTOR = 1000;

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
 * @returns Object containing inner and outer offset results as point arrays
 */
export async function offsetPaths(
    pointArrays: Point2D[][],
    distance: number,
    isClosed: boolean
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

    // Clipper2 parameters
    const joinType = JoinType.Miter; // Sharp corners (closest to existing system)
    const endType = isClosed ? EndType.Polygon : EndType.Butt;
    const miterLimit = 10.0; // High miter limit to preserve sharp corners even at acute angles
    const arcTolerance = 0.25; // Precision for round joins (not used with Miter)

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
