/**
 * Type Conversion Module
 *
 * Converts between MetalHead Point2D format and Clipper2 Path64/Paths64 format.
 * Handles coordinate scaling to preserve precision when using Clipper2's integer-based geometry.
 */

import type { Point2D } from '$lib/geometry/point/interfaces';
import type { MainModule, Path64, Paths64 } from '$lib/wasm/clipper2z';

/**
 * Scale factor for coordinate conversion
 *
 * Clipper2 uses integer coordinates internally. We scale floating-point coordinates
 * by this factor before sending to Clipper2, then scale back after receiving results.
 * A factor of 1000 provides precision of 0.001 units.
 */
const SCALE_FACTOR = 1000;

/**
 * Convert MetalHead Point2D array to Clipper2 Path64
 *
 * @param points - Array of Point2D coordinates
 * @param clipper - Clipper2 MainModule instance
 * @returns Clipper2 Path64 object
 */
function toClipper2Path(points: Point2D[], clipper: MainModule): Path64 {
    const { MakePath64 } = clipper;
    const coords: bigint[] = [];

    for (const pt of points) {
        // Scale coordinates and convert to bigint for Clipper2
        coords.push(BigInt(Math.round(pt.x * SCALE_FACTOR)));
        coords.push(BigInt(Math.round(pt.y * SCALE_FACTOR)));
    }

    return MakePath64(coords);
}

/**
 * Convert MetalHead Point2D array array to Clipper2 Paths64
 *
 * @param pointArrays - Array of Point2D arrays (one per shape)
 * @param clipper - Clipper2 MainModule instance
 * @returns Clipper2 Paths64 object
 */
export function toClipper2Paths(
    pointArrays: Point2D[][],
    clipper: MainModule
): Paths64 {
    const { Paths64 } = clipper;
    const paths = new Paths64();

    for (const points of pointArrays) {
        const path = toClipper2Path(points, clipper);
        paths.push_back(path);
    }

    return paths;
}

/**
 * Convert Clipper2 Paths64 back to MetalHead Point2D arrays
 *
 * @param paths - Clipper2 Paths64 object
 * @returns Array of Point2D arrays
 */
export function fromClipper2Paths(paths: Paths64): Point2D[][] {
    const result: Point2D[][] = [];
    const pathCount = paths.size();

    for (let i = 0; i < pathCount; i++) {
        const path = paths.get(i);
        const pointCount = path.size();
        const points: Point2D[] = [];

        for (let j = 0; j < pointCount; j++) {
            const pt = path.get(j);
            // Scale back to original units
            points.push({
                x: Number(pt.x) / SCALE_FACTOR,
                y: Number(pt.y) / SCALE_FACTOR,
            });
        }

        result.push(points);
    }

    return result;
}
