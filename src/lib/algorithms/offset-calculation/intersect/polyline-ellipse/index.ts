import type { Shape, Polyline, Ellipse } from '../../../../types/geometry';
import type { IntersectionResult } from '../../chain/types.ts';
import { createVerbCurveFromEllipse } from '../../../../utils/verb-integration-utils';
import verb from 'verb-nurbs';
import {
    processPolylineSegments,
    handleClosedPolylineIntersection,
} from '../../../intersection-polyline-utils';

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
