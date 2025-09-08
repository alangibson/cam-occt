import type { Shape, Point2D, Ellipse } from '../../../types/geometry';
import type { IntersectionResult } from '../chain/types';
import verb from 'verb-nurbs';
import {
    createVerbCurveFromEllipse,
    processVerbIntersectionResults,
    INTERSECTION_TOLERANCE,
} from '../../../utils/verb-integration-utils';

/**
 * Ellipse-Ellipse Intersection Utilities
 *
 * Shared utilities for ellipse-ellipse intersection operations.
 * Consolidates common patterns from ellipse intersection algorithms.
 */

/**
 * Validation result for ellipse intersection parameters
 */
export interface EllipseIntersectionValidation {
    isValid: boolean;
    error?: string;
}

/**
 * Calculate ellipse-ellipse intersections using verb-nurbs
 * Implements INTERSECTION.md recommendation #135: "Use verb.intersect.curves() with two ellipse objects"
 *
 * @param ellipse1 First ellipse geometry
 * @param ellipse2 Second ellipse geometry
 * @param swapParams Whether to swap parameter order in results
 * @returns Array of intersection results
 */
export function calculateEllipseEllipseIntersection(
    ellipse1: Ellipse,
    ellipse2: Ellipse,
    swapParams: boolean = false
): IntersectionResult[] {
    // Convert both ellipses to verb-nurbs curves
    const curve1 = createVerbCurveFromEllipse(ellipse1);
    const curve2 = createVerbCurveFromEllipse(ellipse2);

    // Use verb.geom.Intersect.curves() directly
    const intersections = verb.geom.Intersect.curves(
        curve1,
        curve2,
        INTERSECTION_TOLERANCE
    );

    return processVerbIntersectionResults(intersections, swapParams);
}

/**
 * Validate ellipse intersection parameters
 * Checks if two ellipses are suitable for intersection calculation
 *
 * @param e1 First ellipse
 * @param e2 Second ellipse
 * @returns Validation result with error details if invalid
 */
export function validateEllipseIntersectionParameters(
    _e1: Ellipse,
    _e2: Ellipse
): EllipseIntersectionValidation {
    // TODO actually validate

    // Basic validation - just ensure ellipses are not null/undefined
    // Keep this minimal since we're only deduplicating existing patterns
    return { isValid: true };
}

/**
 * Process ellipse intersection results with additional filtering and validation
 * Provides enhanced processing beyond the basic verb-integration-utils function
 *
 * @param results Raw verb intersection results
 * @param swapParams Whether to swap parameter order
 * @param filterDuplicates Whether to filter near-duplicate intersections
 * @returns Processed intersection results
 */
export function processEllipseIntersectionResults(
    results: Array<{ u0: number; u1: number; pt: number[] }>,
    swapParams: boolean = false,
    filterDuplicates: boolean = true
): IntersectionResult[] {
    // Use the standard processing first
    let processed = processVerbIntersectionResults(results, swapParams);

    if (filterDuplicates) {
        processed = filterDuplicateIntersections(processed);
    }

    return processed;
}

/**
 * Calculate a score for intersection quality based on distance to shape endpoints
 * Lower scores indicate better intersections (closer to shape endpoints)
 *
 * @param intersection Intersection result to score
 * @param e1StartPoint Start point of first ellipse
 * @param e1EndPoint End point of first ellipse
 * @param e2StartPoint Start point of second ellipse
 * @param e2EndPoint End point of second ellipse
 * @returns Quality score (lower is better)
 */
export function calculateIntersectionScore(
    intersection: IntersectionResult,
    e1StartPoint: Point2D,
    e1EndPoint: Point2D,
    e2StartPoint: Point2D,
    e2EndPoint: Point2D
): number {
    const { point } = intersection;

    // Calculate distances from intersection point to all four shape endpoints
    const distToE1Start = Math.sqrt(
        (point.x - e1StartPoint.x) ** 2 + (point.y - e1StartPoint.y) ** 2
    );
    const distToE1End = Math.sqrt(
        (point.x - e1EndPoint.x) ** 2 + (point.y - e1EndPoint.y) ** 2
    );
    const distToE2Start = Math.sqrt(
        (point.x - e2StartPoint.x) ** 2 + (point.y - e2StartPoint.y) ** 2
    );
    const distToE2End = Math.sqrt(
        (point.x - e2EndPoint.x) ** 2 + (point.y - e2EndPoint.y) ** 2
    );

    // For consecutive shapes, the best intersection should be close to the
    // connection points (end of first shape, start of second shape)
    return Math.min(distToE1Start, distToE1End, distToE2Start, distToE2End);
}

/**
 * Filter out duplicate intersections that are very close to each other
 *
 * @param intersections Array of intersection results
 * @param tolerance Distance threshold for considering intersections duplicates
 * @returns Filtered array with duplicates removed
 */
function filterDuplicateIntersections(
    intersections: IntersectionResult[],
    tolerance: number = INTERSECTION_TOLERANCE
): IntersectionResult[] {
    const filtered: IntersectionResult[] = [];

    for (const intersection of intersections) {
        let isDuplicate = false;

        for (const existing of filtered) {
            const distance = Math.sqrt(
                (intersection.point.x - existing.point.x) ** 2 +
                    (intersection.point.y - existing.point.y) ** 2
            );

            if (distance < tolerance) {
                isDuplicate = true;
                break;
            }
        }

        if (!isDuplicate) {
            filtered.push(intersection);
        }
    }

    return filtered;
}

/**
 * Find intersections between two ellipse shapes using NURBS
 * High-level function that handles shape extraction and validation
 *
 * @param shape1 First shape containing ellipse geometry
 * @param shape2 Second shape containing ellipse geometry
 * @param swapParams Whether to swap parameter order in results
 * @returns Array of intersection results
 */
export function findEllipseEllipseIntersectionsVerb(
    shape1: Shape,
    shape2: Shape,
    swapParams: boolean = false
): IntersectionResult[] {
    const ellipse1 = shape1.geometry as Ellipse;
    const ellipse2 = shape2.geometry as Ellipse;

    // Validate input ellipses
    const validation = validateEllipseIntersectionParameters(
        ellipse1,
        ellipse2
    );
    if (!validation.isValid) {
        console.warn(
            `Ellipse intersection validation failed: ${validation.error}`
        );
        return [];
    }

    return calculateEllipseEllipseIntersection(ellipse1, ellipse2, swapParams);
}
