/**
 * Reconstruction Module
 *
 * Converts Clipper2 offset results (Point2D arrays) back to MetalHead Shape and Chain structures.
 * Clipper2 returns point arrays which are converted to chains of Line shapes.
 */

import type { Shape } from '$lib/geometry/shape/interfaces';
import type { Point2D } from '$lib/geometry/point/interfaces';
import type { Line } from '$lib/geometry/line/interfaces';
import { GeometryType } from '$lib/geometry/shape/enums';
import { generateId } from '$lib/domain/id';
import type { OffsetChain } from '$lib/algorithms/offset-calculation/chain/types';

/**
 * Reconstruct MetalHead shapes from Clipper2 point arrays
 *
 * Each point array is converted to an array of Line shapes connecting consecutive points.
 * This follows the codebase convention: polylines are only used during DXF import,
 * internally they are represented as Chains containing arrays of Line shapes.
 *
 * IMPORTANT: For closed chains, this function expects exactly ONE polygon.
 * Multiple disconnected polygons cannot be represented as a single closed chain.
 *
 * @param pointArrays - Array of point arrays from Clipper2
 * @param closed - Whether the chains should be marked as closed
 * @returns Array of Shape arrays (each array represents one chain's Line shapes)
 * @throws Error if closed=true and multiple polygons are provided
 */
export function reconstructChain(
    pointArrays: Point2D[][],
    closed: boolean
): Shape[] {
    // Validate input for closed chains
    if (closed && pointArrays.length > 1) {
        throw new Error(
            `Cannot reconstruct closed chain from ${pointArrays.length} disconnected polygons. ` +
                `Clipper2 returned multiple polygons, but a closed chain must be continuous. ` +
                `This indicates the offset operation produced disconnected geometry.`
        );
    }

    // Handle empty input
    if (pointArrays.length === 0) {
        return [];
    }

    const allShapes: Shape[] = [];

    for (const points of pointArrays) {
        // Skip empty point arrays
        if (points.length < 2) {
            continue;
        }

        // Convert consecutive points to Line shapes
        for (let i = 0; i < points.length - 1; i++) {
            const line: Line = {
                start: { x: points[i].x, y: points[i].y },
                end: { x: points[i + 1].x, y: points[i + 1].y },
            };

            allShapes.push({
                id: generateId(),
                type: GeometryType.LINE,
                geometry: line,
            });
        }

        // For closed chains, add final line connecting last point to first
        // Clipper2 returns implicit closed polygons (last point != first point)
        // so we must add the closing segment
        if (closed && points.length > 2) {
            const firstPoint = points[0];
            const lastPoint = points[points.length - 1];

            // Check if points are already closed (defensive check)
            const dx = lastPoint.x - firstPoint.x;
            const dy = lastPoint.y - firstPoint.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            // Only add closing line if points are not already coincident
            if (distance > 1e-6) {
                const line: Line = {
                    start: { x: lastPoint.x, y: lastPoint.y },
                    end: { x: firstPoint.x, y: firstPoint.y },
                };

                allShapes.push({
                    id: generateId(),
                    type: GeometryType.LINE,
                    geometry: line,
                });
            }
        }
    }

    return allShapes;
}

/**
 * Create an OffsetChain structure from reconstructed shapes
 *
 * Wraps the shapes in an OffsetChain object compatible with the existing offset system.
 * Sets appropriate metadata and empty arrays for fields that Clipper2 handles internally.
 *
 * @param shapes - Array of reconstructed shapes
 * @param side - Which side of the original chain (inner/outer/left/right)
 * @param originalChainId - ID of the original chain that was offset
 * @param closed - Whether the chain is closed
 * @returns Complete OffsetChain object
 */
export function createOffsetChain(
    shapes: Shape[],
    side: 'inner' | 'outer' | 'left' | 'right',
    originalChainId: string,
    closed: boolean
): OffsetChain {
    return {
        id: generateId(),
        originalChainId,
        side,
        shapes,
        closed,
        continuous: true, // Clipper2 guarantees continuous offsets
        gapFills: [], // Not applicable - Clipper2 handles gap filling internally
        trimPoints: [], // Not applicable - Clipper2 handles trimming internally
        intersectionPoints: [], // Not applicable - Clipper2 handles intersections internally
    };
}
