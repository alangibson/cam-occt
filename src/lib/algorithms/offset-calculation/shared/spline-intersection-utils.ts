import type { Spline } from '$lib/geometry/spline';
import type { IntersectionResult } from '../chain/types';
import verb, { type VerbCurve, type CurveCurveIntersection } from 'verb-nurbs';
import { processVerbIntersectionResults } from '../intersect/verb-integration-utils';
import { createVerbCurveFromSpline } from '$lib/geometry/spline/nurbs';
import { INTERSECTION_TOLERANCE } from '../../../geometry/math/constants';
import { DEFAULT_EXTENSION_LENGTH } from '../../../geometry/constants';
import {
    DEFAULT_SPLINE_DEGREE,
    DEFAULT_RETRY_COUNT,
} from '$lib/geometry/spline';
import { createExtendedSplineVerb } from '../extend/spline';

/**
 * Validates spline geometry for intersection calculations
 * Consolidated from line-spline/index.ts validateSplineForIntersection()
 */
export function validateSplineForIntersection(spline: Spline): {
    isValid: boolean;
    error?: string;
} {
    if (
        !spline.controlPoints ||
        !Array.isArray(spline.controlPoints) ||
        spline.controlPoints.length < 2
    ) {
        return {
            isValid: false,
            error: 'Invalid or insufficient control points',
        };
    }

    const degree = spline.degree || DEFAULT_SPLINE_DEGREE;
    if (degree < 1 || degree >= spline.controlPoints.length) {
        return {
            isValid: false,
            error: 'Invalid degree for control point count',
        };
    }

    if (!spline.knots || !Array.isArray(spline.knots)) {
        return { isValid: false, error: 'Missing knot vector' };
    }

    const expectedKnotCount = spline.controlPoints.length + degree + 1;
    if (spline.knots.length !== expectedKnotCount) {
        return {
            isValid: false,
            error: `Invalid knot vector length: expected ${expectedKnotCount}, got ${spline.knots.length}`,
        };
    }

    // Check for degenerate control points (all the same)
    const firstPoint = spline.controlPoints[0];
    const allSame = spline.controlPoints.every(
        (p) =>
            Math.abs(p.x - firstPoint.x) < INTERSECTION_TOLERANCE &&
            Math.abs(p.y - firstPoint.y) < INTERSECTION_TOLERANCE
    );

    if (allSame) {
        return {
            isValid: false,
            error: 'Degenerate spline: all control points are identical',
        };
    }

    return { isValid: true };
}

/**
 * Processes spline intersections with optional extensions using retry logic
 * Consolidated from multiple spline intersection files
 */
export function processSplineIntersection(
    spline1: Spline,
    spline2: Spline,
    swapParams: boolean = false,
    allowExtensions: boolean = false,
    extensionLength: number = DEFAULT_EXTENSION_LENGTH
): IntersectionResult[] {
    try {
        // First, try intersection with original splines
        const curve1 = createVerbCurveFromSpline(spline1);
        const curve2 = createVerbCurveFromSpline(spline2);

        const originalIntersections = verb.geom.Intersect.curves(
            curve1,
            curve2,
            INTERSECTION_TOLERANCE
        );

        if (originalIntersections && originalIntersections.length > 0) {
            // Found intersections with original shapes - return them
            return processVerbIntersectionResults(
                originalIntersections,
                swapParams,
                false
            );
        }

        // If no intersections found and extensions are allowed, try with extended splines
        if (allowExtensions) {
            return processSplineIntersectionWithExtensions(
                spline1,
                spline2,
                swapParams,
                extensionLength
            );
        }

        return [];
    } catch {
        return [];
    }
}

/**
 * Handles spline intersection with extensions using multiple retry methods
 * Consolidated extension logic from spline-spline, line-spline, spline-arc patterns
 */
function processSplineIntersectionWithExtensions(
    spline1: Spline,
    spline2: Spline,
    swapParams: boolean,
    extensionLength: number
): IntersectionResult[] {
    const allExtensionResults: IntersectionResult[] = [];
    const originalCurve1 = createVerbCurveFromSpline(spline1);
    const originalCurve2 = createVerbCurveFromSpline(spline2);

    // Try 1: Extended spline1 vs original spline2
    try {
        const extendedCurve1 = createExtendedSplineVerb(
            spline1,
            true,
            true,
            extensionLength
        );
        const extendedSpline1Intersections = verb.geom.Intersect.curves(
            extendedCurve1,
            originalCurve2,
            INTERSECTION_TOLERANCE
        );

        if (
            extendedSpline1Intersections &&
            extendedSpline1Intersections.length > 0
        ) {
            const results = processVerbIntersectionResults(
                extendedSpline1Intersections,
                swapParams,
                true
            );
            allExtensionResults.push(...results);
        }
    } catch {
        // Extended spline1 creation failed, skip this method
    }

    // Try 2: Original spline1 vs extended spline2
    try {
        const extendedCurve2 = createExtendedSplineVerb(
            spline2,
            true,
            true,
            extensionLength
        );
        const extendedSpline2Intersections = verb.geom.Intersect.curves(
            originalCurve1,
            extendedCurve2,
            INTERSECTION_TOLERANCE
        );

        if (
            extendedSpline2Intersections &&
            extendedSpline2Intersections.length > 0
        ) {
            const results = processVerbIntersectionResults(
                extendedSpline2Intersections,
                swapParams,
                true
            );
            allExtensionResults.push(...results);
        }
    } catch {
        // Extended spline2 creation failed, skip this method
    }

    // Try 3: Extended spline1 vs extended spline2 (for maximum gap coverage)
    try {
        const extendedCurve1 = createExtendedSplineVerb(
            spline1,
            true,
            true,
            extensionLength
        );
        const extendedCurve2 = createExtendedSplineVerb(
            spline2,
            true,
            true,
            extensionLength
        );
        const extendedBothIntersections = verb.geom.Intersect.curves(
            extendedCurve1,
            extendedCurve2,
            INTERSECTION_TOLERANCE
        );

        if (extendedBothIntersections && extendedBothIntersections.length > 0) {
            const results = processVerbIntersectionResults(
                extendedBothIntersections,
                swapParams,
                true
            );
            allExtensionResults.push(...results);
        }
    } catch {
        // Extended splines creation failed, skip this method
    }

    return allExtensionResults;
}

/**
 * Generic spline intersection with any curve (verb-nurbs based)
 * Consolidated pattern for spline vs other shape intersections
 */
export function processSplineWithCurveIntersection(
    spline: Spline,
    otherCurve: VerbCurve,
    swapParams: boolean = false,
    allowExtensions: boolean = false,
    extensionLength: number = DEFAULT_EXTENSION_LENGTH
): IntersectionResult[] {
    try {
        // First, try intersection with original shapes
        const splineCurve = createVerbCurveFromSpline(spline);
        const originalIntersections = verb.geom.Intersect.curves(
            splineCurve,
            otherCurve,
            INTERSECTION_TOLERANCE
        );

        if (originalIntersections && originalIntersections.length > 0) {
            return processVerbIntersectionResults(
                originalIntersections,
                swapParams,
                false
            );
        }

        // If no intersections found and extensions are allowed, try with extended spline
        if (allowExtensions) {
            try {
                const extendedSplineCurve = createExtendedSplineVerb(
                    spline,
                    true,
                    true,
                    extensionLength
                );
                const extendedIntersections = verb.geom.Intersect.curves(
                    extendedSplineCurve,
                    otherCurve,
                    INTERSECTION_TOLERANCE
                );

                if (extendedIntersections && extendedIntersections.length > 0) {
                    return processVerbIntersectionResults(
                        extendedIntersections,
                        swapParams,
                        true
                    );
                }
            } catch {
                // Extended spline creation failed
            }
        }

        return [];
    } catch {
        return [];
    }
}

/**
 * Spline intersection with retry logic for enhanced numerical stability
 * Consolidated retry pattern from line-spline intersection logic
 */
export function processSplineIntersectionWithRetry(
    splineCurve: VerbCurve,
    otherCurve: VerbCurve,
    swapParams: boolean,
    isExtended: boolean,
    retryCount: number = DEFAULT_RETRY_COUNT
): IntersectionResult[] {
    // Try intersection multiple times and use the most consistent result
    const results: CurveCurveIntersection[][] = [];

    for (let retry = 0; retry < retryCount; retry++) {
        try {
            const intersections = verb.geom.Intersect.curves(
                splineCurve,
                otherCurve,
                INTERSECTION_TOLERANCE
            );
            if (intersections && intersections.length > 0) {
                results.push(intersections);
            }
        } catch {
            // Retry failed, continue to next attempt
        }
    }

    // If we got consistent results, use them
    const bestResult = selectBestIntersectionResult(results);
    if (bestResult) {
        return processVerbIntersectionResults(
            bestResult,
            swapParams,
            isExtended
        );
    }

    return [];
}

/**
 * Select the best intersection result from multiple retry attempts using majority vote
 * This consolidates the duplicate majority vote logic from line-spline intersection processing.
 *
 * @param results - Array of intersection results from multiple retry attempts
 * @returns The most commonly occurring non-empty result, or null if no valid results
 */
export function selectBestIntersectionResult<T>(results: T[][]): T[] | null {
    if (results.length === 0) {
        return null;
    }

    // Use the result that appeared most often (majority vote)
    const countMap: Map<number, T[]> = new Map<number, T[]>();
    results.forEach((result) => {
        const count: number = result.length;
        if (!countMap.has(count) || result.length > 0) {
            countMap.set(count, result);
        }
    });

    // Get the most common non-empty result
    for (const [count, result] of countMap.entries()) {
        if (count > 0) {
            return result;
        }
    }

    return null;
}
