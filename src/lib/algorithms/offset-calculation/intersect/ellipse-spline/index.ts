import type { Shape } from '$lib/geometry/shape';
import type { Spline } from '$lib/geometry/spline';
import type { Ellipse } from '$lib/geometry/ellipse';
import type { IntersectionResult } from '$lib/algorithms/offset-calculation/chain/types';
import { createVerbCurveFromEllipse } from '$lib/geometry/ellipse/nurbs';
import { processSplineWithCurveIntersection } from '$lib/algorithms/offset-calculation/shared/spline-intersection-utils';

/**
 * Find intersections between an ellipse and a spline using verb-nurbs
 * Implements INTERSECTION.md recommendation #147: "Convert ellipse to NURBs and use NURBs-NURBs routine"
 */
export function findEllipseSplineIntersectionsVerb(
    ellipseShape: Shape,
    splineShape: Shape,
    swapParams: boolean = false
): IntersectionResult[] {
    const ellipse: Ellipse = ellipseShape.geometry as Ellipse;
    const spline: Spline = splineShape.geometry as Spline;

    // Use shared utility for spline-curve intersection
    const ellipseCurve = createVerbCurveFromEllipse(ellipse);
    return processSplineWithCurveIntersection(
        spline,
        ellipseCurve,
        swapParams,
        false
    );
}
