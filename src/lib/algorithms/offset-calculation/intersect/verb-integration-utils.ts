import type { Point2D } from '$lib/types/geometry';
import type { IntersectionResult } from '$lib/algorithms/offset-calculation/chain/types';
import type { CurveCurveIntersection } from 'verb-nurbs';

const EXPECTED_ARRAY_LENGTH = 3;
const EXPECTED_POINT_LENGTH = 3;

/**
 * Verb-NURBS Integration Utilities
 *
 * Centralizes verb-nurbs curve creation and intersection processing to eliminate
 * code duplication across intersection algorithms. Provides consistent conversion
 * from MetalHead CAM geometry types to verb-nurbs curves and standardized processing
 * of intersection results.
 *
 * This library consolidates duplicate code from:
 * - src/lib/algorithms/offset-calculation/intersect/arc-ellipse/index.ts
 * - src/lib/algorithms/offset-calculation/intersect/spline-arc/index.ts
 * - src/lib/algorithms/offset-calculation/extend/common.ts
 * - src/lib/algorithms/offset-calculation/intersect/spline.ts
 * - Various other intersection modules
 */

// INTERSECTION_TOLERANCE is now imported from constants

// Type definitions for alternative intersection structures used in tests
type AlternativeIntersectionWithPoints = {
    point0: [number, number, number];
    point1: [number, number, number];
    u0: number;
    u1: number;
};

type AlternativeIntersectionWithPoint = {
    point: [number, number, number];
    u?: number;
    v?: number;
    u0?: number;
    u1?: number;
};

type ArrayIntersection = [[number, number, number], number, number];

/**
 * Process verb-nurbs intersection results into our IntersectionResult format
 * CRITICAL: Returns only the single best intersection to ensure mathematical correctness
 * for consecutive offset shapes in chain operations
 */
export function processVerbIntersectionResults(
    intersections: CurveCurveIntersection[],
    swapParams: boolean = false,
    onExtension: boolean = false
): IntersectionResult[] {
    const results: IntersectionResult[] = [];

    if (!intersections || !Array.isArray(intersections)) {
        return results;
    }

    // Convert all intersections to our format first
    const candidates: IntersectionResult[] = [];

    for (const intersection of intersections) {
        // Try different possible structures from verb-nurbs
        let point: Point2D;
        let param1: number;
        let param2: number;

        // Primary structure: CurveCurveIntersection has u0, u1, and pt properties
        if (intersection.pt && Array.isArray(intersection.pt)) {
            // Standard structure: { u0: number, u1: number, pt: [x, y, z] }
            point = {
                x: intersection.pt[0],
                y: intersection.pt[1],
            };
            param1 = swapParams ? intersection.u1 : intersection.u0;
            param2 = swapParams ? intersection.u0 : intersection.u1;
        } else if (
            'point0' in intersection &&
            'point1' in intersection &&
            'u0' in intersection &&
            'u1' in intersection &&
            Array.isArray(
                (intersection as AlternativeIntersectionWithPoints).point0
            )
        ) {
            // TODO this is only used by tests. remove it

            // Alternative structure: { point0: [x, y, z], point1: [x, y, z], u0: param, u1: param }
            const altIntersection =
                intersection as AlternativeIntersectionWithPoints;
            point = {
                x: altIntersection.point0[0],
                y: altIntersection.point0[1],
            };
            param1 = swapParams ? altIntersection.u1 : altIntersection.u0;
            param2 = swapParams ? altIntersection.u0 : altIntersection.u1;
        } else if (
            'point' in intersection &&
            Array.isArray(
                (intersection as AlternativeIntersectionWithPoint).point
            )
        ) {
            // TODO this is only used by tests. remove it

            // Another structure: { point: [x, y, z], u: number, v: number }
            const altIntersection =
                intersection as AlternativeIntersectionWithPoint;
            point = {
                x: altIntersection.point[0],
                y: altIntersection.point[1],
            };
            param1 = swapParams
                ? (altIntersection.v ?? altIntersection.u1 ?? 0)
                : (altIntersection.u ?? altIntersection.u0 ?? 0);
            param2 = swapParams
                ? (altIntersection.u ?? altIntersection.u0 ?? 0)
                : (altIntersection.v ?? altIntersection.u1 ?? 0);
        } else if (
            Array.isArray(intersection) &&
            intersection.length >= EXPECTED_ARRAY_LENGTH &&
            Array.isArray(intersection[0]) &&
            intersection[0].length >= EXPECTED_POINT_LENGTH &&
            typeof intersection[1] === 'number' &&
            typeof intersection[2] === 'number'
        ) {
            // TODO this is only used by tests. remove it

            // Array structure: [[x, y, z], u, v] or similar array format
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const arrIntersection = intersection as any as ArrayIntersection;
            point = {
                x: arrIntersection[0][0],
                y: arrIntersection[0][1],
            };
            param1 = swapParams ? arrIntersection[2] : arrIntersection[1];
            param2 = swapParams ? arrIntersection[1] : arrIntersection[2];
        } else {
            continue;
        }

        candidates.push({
            point,
            param1: param1 || 0,
            param2: param2 || 0,
            distance: 0,
            type: 'exact',
            confidence: 1.0,
            onExtension: onExtension,
        });
    }

    if (candidates.length === 0) {
        return results;
    }

    // If only one intersection, return it
    if (candidates.length === 1) {
        return candidates;
    }

    // Multiple intersections detected - select the one closest to shape endpoints
    // For consecutive offset shapes in chains, the best intersection should be near
    // the connection points between shapes

    // NOTE: This function now requires shape endpoint information to work properly
    // For now, return the first intersection as a fallback
    // TODO: Update callers to provide shape endpoint information
    const bestIntersection = candidates[0];

    // Return only the single best intersection
    return [bestIntersection];
}
