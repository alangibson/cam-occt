import type { Shape, Line, Point2D } from '../../../../../lib/types/geometry';
import type { Spline } from '$lib/geometry/spline';
import type { IntersectionResult } from '../../chain/types.ts';
import verb, { type CurveCurveIntersection } from 'verb-nurbs';
import {
    createVerbCurveFromLine,
    createVerbCurveFromSpline,
    processVerbIntersectionResults,
} from '../../../../utils/verb-integration-utils';
import { INTERSECTION_TOLERANCE } from '../../../../constants';
import { DEFAULT_EXTENSION_LENGTH } from '../../../../geometry/constants';
import { DEFAULT_RETRY_COUNT } from '$lib/geometry/spline';
import {
    validateSplineForIntersection,
    selectBestIntersectionResult,
} from '../../shared/spline-intersection-utils';
import { createExtendedSplineVerb } from '../../extend/spline';

/**
 * Find intersections between a spline and a line using verb-nurbs
 * Implements INTERSECTION.md recommendation #39: "Convert line to NURBs and use NURBs-NURBs routine"
 */

export function findSplineLineIntersectionsVerb(
    splineShape: Shape,
    lineShape: Shape,
    swapParams: boolean = false,
    allowExtensions: boolean = false,
    extensionLength: number = DEFAULT_EXTENSION_LENGTH
): IntersectionResult[] {
    const spline: Spline = splineShape.geometry as Spline;
    const line: Line = lineShape.geometry as Line;

    // Validate spline geometry before attempting intersection (lenient check)
    const splineValidation: { isValid: boolean; error?: string } =
        validateSplineForIntersection(spline);
    if (!splineValidation.isValid) {
        // For most validation failures, try to proceed anyway
        // Only reject completely malformed splines
        if (!spline.controlPoints || spline.controlPoints.length < 2) {
            return [];
        }
    }

    // Validate line geometry
    const lineLength: number = Math.sqrt(
        Math.pow(line.end.x - line.start.x, 2) +
            Math.pow(line.end.y - line.start.y, 2)
    );
    if (lineLength < INTERSECTION_TOLERANCE) {
        return [];
    }

    try {
        // First, try intersection with original shapes
        const splineCurve: verb.geom.ICurve = createVerbCurveFromSpline(spline);
        const lineCurve: verb.geom.ICurve = createVerbCurveFromLine(line);

        const originalIntersections: CurveCurveIntersection[] =
            verb.geom.Intersect.curves(
                splineCurve,
                lineCurve,
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

        // If no intersections found and extensions are allowed, try with extended shapes
        // Use retry logic with enhanced numerical stability for deterministic behavior
        if (allowExtensions) {
            // Prepare line extension data
            const lineDir: Point2D = {
                x: line.end.x - line.start.x,
                y: line.end.y - line.start.y,
            };
            const lineLength: number = Math.sqrt(
                lineDir.x * lineDir.x + lineDir.y * lineDir.y
            );

            // Validate line geometry
            if (lineLength < INTERSECTION_TOLERANCE) {
                return [];
            }

            const lineUnitDir: Point2D = {
                x: lineDir.x / lineLength,
                y: lineDir.y / lineLength,
            };

            // Extend line in both directions by the specified amount
            const extendedLine: Line = {
                start: {
                    x: line.start.x - lineUnitDir.x * extensionLength,
                    y: line.start.y - lineUnitDir.y * extensionLength,
                },
                end: {
                    x: line.end.x + lineUnitDir.x * extensionLength,
                    y: line.end.y + lineUnitDir.y * extensionLength,
                },
            };

            // Try each extension method multiple times for robustness
            const extensionMethods: (() => CurveCurveIntersection[])[] = [
                () => {
                    // Method 1: Extended line vs original spline
                    const extendedLineCurve: verb.geom.ICurve =
                        createVerbCurveFromLine(extendedLine);
                    return verb.geom.Intersect.curves(
                        splineCurve,
                        extendedLineCurve,
                        INTERSECTION_TOLERANCE
                    );
                },
                () => {
                    // Method 2: Original line vs extended spline
                    const extendedSplineCurve: verb.geom.ICurve =
                        createExtendedSplineVerb(
                            spline,
                            true,
                            true,
                            extensionLength
                        );
                    return verb.geom.Intersect.curves(
                        extendedSplineCurve,
                        lineCurve,
                        INTERSECTION_TOLERANCE
                    );
                },
                () => {
                    // Method 3: Extended line vs extended spline
                    const extendedSplineCurve: verb.geom.ICurve =
                        createExtendedSplineVerb(
                            spline,
                            true,
                            true,
                            extensionLength
                        );
                    const extendedLineCurve: verb.geom.ICurve =
                        createVerbCurveFromLine(extendedLine);
                    return verb.geom.Intersect.curves(
                        extendedSplineCurve,
                        extendedLineCurve,
                        INTERSECTION_TOLERANCE
                    );
                },
            ];

            // Try each method with retry logic for numerical stability
            for (const method of extensionMethods) {
                let bestResult: CurveCurveIntersection[] = [];

                // Retry each method multiple times and use the most common result
                const results: CurveCurveIntersection[][] = [];
                for (
                    let retry: number = 0;
                    retry < DEFAULT_RETRY_COUNT;
                    retry++
                ) {
                    try {
                        const intersections: CurveCurveIntersection[] =
                            method();
                        if (intersections && intersections.length > 0) {
                            results.push(intersections);
                        }
                    } catch {
                        // Method failed, continue to next retry
                    }
                }

                // If we got consistent results, use them
                const selectedResult = selectBestIntersectionResult(results);
                if (selectedResult && selectedResult.length > 0) {
                    bestResult = selectedResult;
                    return processVerbIntersectionResults(
                        bestResult,
                        swapParams,
                        true
                    );
                }
            }
        }

        return [];
    } catch {
        return [];
    }
}
