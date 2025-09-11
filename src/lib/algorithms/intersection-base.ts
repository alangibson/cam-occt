import type { Point2D, Line } from '../types/geometry';
import type { IntersectionResult } from './offset-calculation/chain/types';
import type { CurveCurveIntersection } from 'verb-nurbs';
import { EPSILON } from '$lib/geometry/math';
import { TOLERANCE_RELAXATION_MULTIPLIER } from '../geometry/constants';
import { processVerbIntersectionResults } from '../utils/verb-integration-utils';
import { handleClosedPolylineIntersection } from './intersection-polyline-utils';

/**
 * Intersection Base Library
 *
 * Consolidates common intersection functions used across multiple intersection modules.
 * This library extracts shared functionality to eliminate code duplication in the
 * offset-calculation/intersect/ directory.
 *
 * Consolidates duplicates from:
 * - All modules in src/lib/algorithms/offset-calculation/intersect/
 *
 * Based on DECOPY.md section 2.3 Intersection Base Library
 */

/**
 * Creates a line segment from two points
 * Used across multiple intersection algorithms for segment creation
 */
export function createSegmentLine(start: Point2D, end: Point2D): Line {
    return {
        start: { x: start.x, y: start.y },
        end: { x: end.x, y: end.y },
    };
}

/**
 * Process verb-nurbs intersection results into our IntersectionResult format
 * This is the base processing function that handles various verb-nurbs result structures
 *
 * @param results Raw intersection results from verb-nurbs
 * @param swapParams Whether to swap param1 and param2 in results
 * @returns Array of processed intersection results
 */
export function processIntersectionResults(
    results: CurveCurveIntersection[],
    swapParams: boolean
): IntersectionResult[] {
    return processVerbIntersectionResults(results, swapParams, false);
}

/**
 * Validates intersection parameters against tolerance
 * Used for basic parameter range checking in intersection algorithms
 *
 * @param param Parameter value to validate
 * @param tolerance Tolerance for parameter validation
 * @returns True if parameter is valid
 */
export function validateIntersectionParameter(param: number): boolean {
    // Check if parameter is within reasonable bounds
    // For most intersection algorithms, parameters should be in [0, 1] range for segments
    // but we allow some tolerance for numerical precision
    return !isNaN(param) && isFinite(param);
}

/**
 * Converts verb-nurbs intersection results to our IntersectionResult format
 * This is an alias for processVerbIntersectionResults with extension support
 *
 * @param results Raw intersection results from verb-nurbs
 * @param swap Whether to swap parameters
 * @param isExtended Whether the intersection is on an extended shape
 * @returns Array of converted intersection results
 */
export function convertVerbIntersectionResults(
    results: CurveCurveIntersection[],
    swap: boolean,
    isExtended: boolean
): IntersectionResult[] {
    return processVerbIntersectionResults(results, swap, isExtended);
}

/**
 * Handles intersection processing for closed polylines
 * Re-exported from intersection-polyline-utils for backward compatibility
 */
export const handleClosedPolylineIntersections: typeof handleClosedPolylineIntersection =
    handleClosedPolylineIntersection;

/**
 * Removes duplicate intersection points that are very close to each other
 * Used to clean up intersection results from multiple algorithms
 *
 * @param intersections Array of intersection results
 * @param tolerance Distance tolerance for considering points duplicates
 * @returns Array with duplicates removed
 */
export function removeDuplicateIntersections(
    intersections: IntersectionResult[],
    tolerance: number = EPSILON * TOLERANCE_RELAXATION_MULTIPLIER
): IntersectionResult[] {
    if (intersections.length <= 1) return intersections;

    const result: IntersectionResult[] = [];

    for (const current of intersections) {
        let isDuplicate: boolean = false;

        for (const existing of result) {
            const dx: number = current.point.x - existing.point.x;
            const dy: number = current.point.y - existing.point.y;
            const distance: number = Math.sqrt(dx * dx + dy * dy);

            if (distance < tolerance) {
                isDuplicate = true;
                break;
            }
        }

        if (!isDuplicate) {
            result.push(current);
        }
    }

    return result;
}
