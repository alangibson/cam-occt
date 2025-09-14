import type { Line } from '$lib/geometry/line';
import type { Polyline } from '$lib/geometry/polyline';
import type { IntersectionResult } from '$lib/algorithms/offset-calculation/chain/types';
import { polylineToPoints } from '$lib/geometry/polyline';
import { processVerbIntersectionResults } from './verb-integration-utils';
import { createVerbCurveFromLine } from '$lib/geometry/line/nurbs';
import { INTERSECTION_TOLERANCE } from '$lib/geometry/math';
import { createSegmentLine } from '$lib/geometry/line/functions';
import verb from 'verb-nurbs';

/**
 * Processes intersections between polyline segments and a curve
 * Converts segment parameters to polyline parameters and handles parameter swapping
 */
export function processPolylineSegments(
    polyline: Polyline,
    curve: verb.geom.ICurve,
    swapParams: boolean = false,
    onExtension: boolean = false
): IntersectionResult[] {
    const points = polylineToPoints(polyline);
    const results: IntersectionResult[] = [];

    // Process regular segments
    for (let i = 0; i < points.length - 1; i++) {
        const segmentLine: Line = {
            start: { x: points[i].x, y: points[i].y },
            end: { x: points[i + 1].x, y: points[i + 1].y },
        };

        const segmentCurve = createVerbCurveFromLine(segmentLine);
        const segmentIntersections = verb.geom.Intersect.curves(
            curve,
            segmentCurve,
            INTERSECTION_TOLERANCE
        );

        if (segmentIntersections && segmentIntersections.length > 0) {
            const convertedIntersections = processVerbIntersectionResults(
                segmentIntersections,
                false,
                onExtension
            );

            // Adjust parameters for polyline context
            convertedIntersections.forEach((intersection) => {
                const segmentParam = intersection.param2;
                const polylineParam = (i + segmentParam) / (points.length - 1);

                results.push({
                    ...intersection,
                    param1: swapParams ? polylineParam : intersection.param1,
                    param2: swapParams ? intersection.param1 : polylineParam,
                });
            });
        }
    }

    return results;
}

/**
 * Handles intersection calculation for closed polylines
 * Processes the closing segment that connects the last point to the first
 */
export function handleClosedPolylineIntersection(
    polyline: Polyline,
    curve: verb.geom.ICurve,
    swapParams: boolean = false,
    onExtension: boolean = false
): IntersectionResult[] {
    if (!polyline.closed) {
        return [];
    }

    const points = polylineToPoints(polyline);
    if (points.length <= 2) {
        return [];
    }

    const results: IntersectionResult[] = [];

    const closingLine: Line = createSegmentLine(
        points[points.length - 1],
        points[0]
    );

    const closingCurve = createVerbCurveFromLine(closingLine);
    const closingIntersections = verb.geom.Intersect.curves(
        curve,
        closingCurve,
        INTERSECTION_TOLERANCE
    );

    if (closingIntersections && closingIntersections.length > 0) {
        const convertedIntersections = processVerbIntersectionResults(
            closingIntersections,
            false,
            onExtension
        );

        convertedIntersections.forEach((intersection) => {
            const segmentParam = intersection.param2;
            // Calculate parameter for the closing segment
            const polylineParam =
                (points.length - 1 + segmentParam) /
                (polyline.closed ? points.length : points.length - 1);

            results.push({
                ...intersection,
                param1: swapParams ? polylineParam : intersection.param1,
                param2: swapParams ? intersection.param1 : polylineParam,
            });
        });
    }

    return results;
}
