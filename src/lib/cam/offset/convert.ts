/**
 * Type Conversion Module
 *
 * Converts between MetalHead Point2D format and Clipper2 Path64/Paths64 format.
 * Handles coordinate scaling to preserve precision when using Clipper2's integer-based geometry.
 */

import type { Point2D } from '$lib/geometry/point/interfaces';
import type { MainModule, Path64, Paths64 } from '$lib/wasm/clipper2z';
import { CURVE_TESSELLATION_TOLERANCE_MM } from '$lib/config/defaults/geometry-defaults';
import { MM_PER_INCH } from '$lib/config/units/units';

/**
 * Safety margin multiplier to handle accumulated rounding errors
 * in coordinate scaling operations
 */
const SCALE_FACTOR_SAFETY_MARGIN = 10;

/**
 * Calculate scale factor for coordinate conversion
 *
 * Clipper2 uses integer coordinates internally. The scale factor must be large enough
 * to preserve the precision of our tessellation tolerance. This ensures that points
 * separated by the tolerance distance don't collapse to the same integer coordinate
 * after rounding.
 *
 * We use the finest tolerance that could be applied (in inches, which is smaller than mm).
 * This guarantees precision for both metric and imperial units.
 */
function calculateScaleFactor(): number {
    // Convert mm tolerance to inches (smallest unit we support)
    const toleranceInches = CURVE_TESSELLATION_TOLERANCE_MM / MM_PER_INCH;

    // Scale factor must be at least 1/tolerance to preserve that precision
    // Add safety margin to handle accumulated rounding errors
    const minScaleFactor =
        Math.ceil(1 / toleranceInches) * SCALE_FACTOR_SAFETY_MARGIN;

    return minScaleFactor;
}

/**
 * Scale factor for coordinate conversion
 *
 * Dynamically calculated to preserve tessellation tolerance precision.
 * For 0.001mm tolerance: ~254,000 (preserves precision to ~0.000004")
 *
 * IMPORTANT: This must be used consistently for both coordinate conversion
 * and distance scaling in clipper-offset.ts
 */
export const SCALE_FACTOR = calculateScaleFactor();

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

/**
 * Calculate the total area of Clipper2 Paths64
 *
 * Uses the shoelace formula on each path and sums the areas.
 * Positive area = counter-clockwise winding, negative = clockwise.
 * Returns absolute value of total area.
 *
 * @param paths - Clipper2 Paths64 object
 * @returns Total absolute area (scaled back to original units²)
 */
export function calculateClipper2PathsArea(paths: Paths64): number {
    let totalArea = 0;
    const pathCount = paths.size();

    for (let i = 0; i < pathCount; i++) {
        const path = paths.get(i);
        const pointCount = path.size();
        const MIN_POLYGON_POINTS = 3;

        if (pointCount < MIN_POLYGON_POINTS) continue; // Need at least 3 points for a polygon

        // Shoelace formula for polygon area
        let pathArea = 0;
        for (let j = 0; j < pointCount; j++) {
            const p1 = path.get(j);
            const p2 = path.get((j + 1) % pointCount);

            // Cross product: x1*y2 - x2*y1
            pathArea += Number(p1.x * p2.y - p2.x * p1.y);
        }

        totalArea += Math.abs(pathArea / 2);
    }

    // Scale back to original units (area scales by SCALE_FACTOR²)
    return totalArea / (SCALE_FACTOR * SCALE_FACTOR);
}
