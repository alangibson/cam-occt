import type { Point2D } from '$lib/geometry/point/interfaces';
import { isPolygonContained } from '$lib/geometry/polygon/functions';
import type { Paths64 } from '$lib/wasm/clipper2z';
import { getClipper2 } from '$lib/cam/offset/clipper-init';
import { calculateClipper2PathsArea } from '$lib/cam/offset/convert';
import type { Chain } from './classes.svelte';
import {
    CONTAINMENT_AREA_RATIO_THRESHOLD,
    POLYGON_POINTS_MIN,
} from './constants';
import { extractPolygonFromChain } from './functions';
import { isPointInsideChainExact } from './point-in-chain';
import type { BoundingBox } from '$lib/geometry/bounding-box/classes';

/**
 * Sample point position along chain for containment testing (25% of chain length)
 */
const CHAIN_SAMPLE_POINT_25_PERCENT = 0.25;

/**
 * Sample point position along chain for containment testing (75% of chain length)
 */
const CHAIN_SAMPLE_POINT_75_PERCENT = 0.75;

/**
 * Check if one closed chain contains another using Clipper2 boolean operations
 *
 * Uses Clipper2's Intersect64 operation: if inner is fully contained in outer,
 * then Intersect(inner, outer) will equal inner (same area).
 *
 * This is more robust than JSTS for complex tessellated spline geometry.
 *
 * @param innerChain - The chain to test for containment
 * @param outerChain - The potential containing chain
 * @param tolerance - Distance tolerance for chain closure checks
 * @param params - Part detection parameters for tessellation
 * @returns Promise<boolean> - True if inner is contained within outer
 */
export async function isChainContainedInChain_Clipper2(
    innerChain: Chain,
    outerChain: Chain
): Promise<boolean> {
    // Only closed chains can contain other chains
    if (!outerChain.isClosed) {
        return false;
    }

    // Get Clipper2 paths from chains (cached)
    const innerPaths: Paths64 = await innerChain.paths64();
    const outerPaths: Paths64 = await outerChain.paths64();

    // Calculate inner area before intersection (cached)
    const innerArea: number = await innerChain.area();

    if (innerArea === 0) {
        return false;
    }

    // console.log(`ip=${innerPaths.get(0).size()} op=${outerPaths.get(0).size()}`);
    // Get clipper instance for intersection operation
    const clipper = await getClipper2();
    // Perform intersection: if inner is fully inside outer, intersection = inner
    const intersection: Paths64 = clipper.Intersect64(
        innerPaths,
        outerPaths,
        clipper.FillRule.NonZero
    );

    // Calculate intersection area
    const intersectionArea: number = calculateClipper2PathsArea(intersection);

    // Clean up Clipper2 memory
    intersection.delete();

    // If intersection area ≈ inner area (within 90%), inner is contained
    // Use 90% threshold to handle tessellation differences and edge precision
    // This is more lenient than 95% to handle complex spline geometries
    const areaRatio = intersectionArea / innerArea;
    return areaRatio > CONTAINMENT_AREA_RATIO_THRESHOLD;
}
/**
 * Checks if one closed chain is completely contained within another closed chain
 * using proper geometric containment (point-in-polygon testing)
 */

export function isChainContainedInChain_Geometric(
    innerChain: Chain,
    outerChain: Chain
): boolean {
    // Extract polygon points from both chains
    const innerPolygon = extractPolygonFromChain(innerChain);
    const outerPolygon = extractPolygonFromChain(outerChain);

    if (
        !innerPolygon ||
        !outerPolygon ||
        innerPolygon.points.length < POLYGON_POINTS_MIN ||
        outerPolygon.points.length < POLYGON_POINTS_MIN
    ) {
        throw new Error(
            `Failed to extract polygons for containment check: inner chain ${innerChain.id}=${!!innerPolygon}, outer chain ${outerChain.id}=${!!outerPolygon}. Chains may have gaps preventing polygon creation.`
        );
    }

    // Check if all points of inner polygon are inside outer polygon
    return isPolygonContained(innerPolygon, outerPolygon);
}
/**
 * Checks if one closed chain is contained within another using sample-based point testing.
 *
 * This approach mirrors the reference PlasmaDesk parser implementation:
 * - Generates 4 sample points from the inner chain (centroid, bbox center, 2 edge midpoints)
 * - Tests each point using exact ray-tracing containment (isPointInsideChainExact)
 * - Returns true if majority (>50%) of sample points are inside the outer chain
 *
 * Benefits:
 * - More robust than area-based methods for complex curves and tessellation issues
 * - Handles numerical precision edge cases better
 * - Fast and simple to understand
 * - Matches proven reference implementation
 *
 * @param innerChain - The chain to test for containment
 * @param outerChain - The potential containing chain
 * @returns True if inner chain is contained within outer chain (>50% of sample points inside)
 */

export function isChainContainedInChain_Sampled(
    innerChain: Chain,
    outerChain: Chain
): boolean {
    // Only closed chains can contain other chains
    if (!outerChain.isClosed) {
        return false;
    }

    // Generate 4 sample points from inner chain
    const samplePoints: Point2D[] = [];

    // 1. Centroid (geometric center)
    const centroid: Point2D = innerChain.centroid;
    samplePoints.push(centroid);

    // 2. Bounding box center
    const bbox: BoundingBox = innerChain.boundary;
    const bboxCenter: Point2D = {
        x: (bbox.min.x + bbox.max.x) / 2,
        y: (bbox.min.y + bbox.max.y) / 2,
    };
    samplePoints.push(bboxCenter);

    // 3. Point at 25% along the chain
    const point25: Point2D = innerChain.pointAt(CHAIN_SAMPLE_POINT_25_PERCENT);
    samplePoints.push(point25);

    // 4. Point at 75% along the chain
    const point75: Point2D = innerChain.pointAt(CHAIN_SAMPLE_POINT_75_PERCENT);
    samplePoints.push(point75);

    // Test each sample point using exact ray-tracing containment
    let insideCount: number = 0;
    for (const point of samplePoints) {
        if (isPointInsideChainExact(point, outerChain)) {
            insideCount++;
        }
    }

    // Return true if majority (>50%) of points are inside
    // This matches the reference parser's approach
    const majorityThreshold: number = samplePoints.length / 2;
    return insideCount > majorityThreshold;
}
