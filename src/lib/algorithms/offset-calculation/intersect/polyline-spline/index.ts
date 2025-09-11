import type { Shape, Polyline } from '$lib/types/geometry';
import type { Spline } from '$lib/geometry/spline';
import type { IntersectionResult } from '../../chain/types';
import verb from 'verb-nurbs';
import { createVerbCurveFromSpline } from '$lib/geometry/spline/nurbs';
import { createExtendedSplineVerb } from '../../extend/spline';
import { createExtendedPolyline } from '../../extend/polyline';
import {
    processPolylineSegments,
    handleClosedPolylineIntersection,
} from '../intersection-polyline-utils';
import { DEFAULT_EXTENSION_LENGTH } from '../../../../geometry/constants';

/**
 * Find intersections between a spline and a polyline using verb-nurbs
 * Implements INTERSECTION.md recommendation #75: "Iterate through polyline segments calling verb.intersect.curves()"
 * Supports bidirectional extension following TODO.md requirement for spline-polyline gap detection
 */
export function findSplinePolylineIntersectionsVerb(
    splineShape: Shape,
    polylineShape: Shape,
    swapParams: boolean = false,
    allowExtensions: boolean = false,
    extensionLength: number = DEFAULT_EXTENSION_LENGTH
): IntersectionResult[] {
    const spline: Spline = splineShape.geometry as Spline;
    const polyline: Polyline = polylineShape.geometry as Polyline;

    try {
        // First, try intersection with original shapes
        const originalResults: IntersectionResult[] =
            findPolylineSplineIntersectionsOriginal(
                spline,
                polyline,
                swapParams
            );

        if (originalResults.length > 0) {
            // Found intersections with original shapes - return them
            return originalResults;
        }

        // If no intersections found and extensions are allowed, try with extended shapes
        if (allowExtensions) {
            const allExtensionResults: IntersectionResult[] = [];

            // Try 1: Extended polyline vs original spline
            try {
                const extendedPolyline: Polyline = createExtendedPolyline(
                    polyline,
                    true,
                    true,
                    extensionLength
                );
                const extendedPolylineResults: IntersectionResult[] =
                    findPolylineSplineIntersectionsOriginal(
                        spline,
                        extendedPolyline,
                        swapParams
                    );

                // Use the simpler approach: mark all intersections with extended shapes as extensions
                const results: IntersectionResult[] =
                    extendedPolylineResults.map((intersection) => ({
                        ...intersection,
                        onExtension: true,
                    }));
                allExtensionResults.push(...results);
            } catch {
                // Polyline extension failed, skip this method
            }

            // Try 2: Original polyline vs extended spline
            try {
                const extendedSplineCurve = createExtendedSplineVerb(
                    spline,
                    true,
                    true,
                    extensionLength
                );

                // Process polyline segments using shared utility
                const segmentResults = processPolylineSegments(
                    polyline,
                    extendedSplineCurve,
                    swapParams,
                    true
                );
                allExtensionResults.push(...segmentResults);

                // Handle closed polylines using shared utility
                const closingResults = handleClosedPolylineIntersection(
                    polyline,
                    extendedSplineCurve,
                    swapParams,
                    true
                );
                allExtensionResults.push(...closingResults);
            } catch {
                // Extended spline creation failed, skip this method
            }

            // Try 3: Extended polyline vs extended spline (for maximum gap coverage)
            try {
                const extendedPolyline: Polyline = createExtendedPolyline(
                    polyline,
                    true,
                    true,
                    extensionLength
                );
                const extendedSplineCurve: verb.geom.ICurve =
                    createExtendedSplineVerb(
                        spline,
                        true,
                        true,
                        extensionLength
                    );

                // Process extended polyline segments using shared utility
                const extendedSegmentResults = processPolylineSegments(
                    extendedPolyline,
                    extendedSplineCurve,
                    swapParams,
                    true
                );
                allExtensionResults.push(...extendedSegmentResults);
            } catch {
                // Extended shapes creation failed, skip this method
            }

            return allExtensionResults;
        }

        return [];
    } catch {
        return [];
    }
}

/**
 * Helper function to find intersections between original (non-extended) spline and polyline
 */
function findPolylineSplineIntersectionsOriginal(
    spline: Spline,
    polyline: Polyline,
    swapParams: boolean
): IntersectionResult[] {
    const results: IntersectionResult[] = [];

    try {
        const splineCurve: verb.geom.ICurve = createVerbCurveFromSpline(spline);

        // Process polyline segments using shared utility
        const segmentResults = processPolylineSegments(
            polyline,
            splineCurve,
            swapParams,
            false
        );
        results.push(...segmentResults);

        // Handle closed polylines using shared utility
        const closingResults = handleClosedPolylineIntersection(
            polyline,
            splineCurve,
            swapParams,
            false
        );
        results.push(...closingResults);

        return results;
    } catch {
        return [];
    }
}
