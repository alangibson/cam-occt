import type { Shape } from '$lib/types/geometry';
import type { Polyline } from '$lib/geometry/polyline';
import type { Ellipse } from '$lib/geometry/ellipse';
import type { IntersectionResult } from '$lib/algorithms/offset-calculation/chain/types';
import { createVerbCurveFromEllipse } from '$lib/geometry/ellipse/nurbs.js';
import verb from 'verb-nurbs';
import {
    handleClosedPolylineIntersection,
    processPolylineSegments,
} from '$lib/algorithms/offset-calculation/intersect/intersection-polyline-utils';

/**
 * Find intersections between an ellipse and a polyline using verb-nurbs
 * Implements INTERSECTION.md recommendation #75: "Iterate through polyline segments calling verb.intersect.curves()"
 */
export function findEllipsePolylineIntersectionsVerb(
    ellipseShape: Shape,
    polylineShape: Shape,
    swapParams: boolean = false
): IntersectionResult[] {
    const ellipse: import('$lib/types/geometry').Ellipse =
        ellipseShape.geometry as Ellipse;
    const polyline: import('$lib/types/geometry').Polyline =
        polylineShape.geometry as Polyline;
    const results: IntersectionResult[] = [];

    const ellipseCurve: verb.geom.NurbsCurve =
        createVerbCurveFromEllipse(ellipse);

    // Process polyline segments using shared utility
    const segmentResults = processPolylineSegments(
        polyline,
        ellipseCurve,
        swapParams,
        false
    );
    results.push(...segmentResults);

    // Handle closed polylines using shared utility
    const closingResults = handleClosedPolylineIntersection(
        polyline,
        ellipseCurve,
        swapParams,
        false
    );
    results.push(...closingResults);

    return results;
}
