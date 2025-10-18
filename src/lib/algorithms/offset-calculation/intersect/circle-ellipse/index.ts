import type { Circle } from '$lib/geometry/circle/interfaces';
import type { Ellipse } from '$lib/geometry/ellipse/interfaces';
import type { Shape } from '$lib/geometry/shape/interfaces';
import type { IntersectionResult } from '$lib/algorithms/offset-calculation/chain/types';
import { processVerbIntersectionResults } from '$lib/algorithms/offset-calculation/intersect/verb-integration-utils';
import { createVerbCurveFromCircle } from '$lib/geometry/circle/nurbs';
import { createVerbCurveFromEllipse } from '$lib/geometry/ellipse/nurbs';
import { INTERSECTION_TOLERANCE } from '$lib/geometry/math/constants';
import verb, { type CurveCurveIntersection } from 'verb-nurbs';

/**
 * Find intersections between an ellipse and a circle using verb-nurbs
 * Implements INTERSECTION.md recommendation #106: "Convert circle to NURBs and use NURBs-NURBs routine"
 */
export function findEllipseCircleIntersectionsVerb(
    ellipseShape: Shape,
    circleShape: Shape,
    swapParams: boolean = false
): IntersectionResult[] {
    const ellipse: Ellipse = ellipseShape.geometry as Ellipse;
    const circle: Circle = circleShape.geometry as Circle;

    // Convert both shapes to verb-nurbs curves
    const ellipseCurve: verb.geom.NurbsCurve =
        createVerbCurveFromEllipse(ellipse);
    const circleCurve: verb.geom.NurbsCurve = createVerbCurveFromCircle(circle);

    // Use verb.geom.Intersect.curves() for intersection
    const intersections: CurveCurveIntersection[] = verb.geom.Intersect.curves(
        ellipseCurve,
        circleCurve,
        INTERSECTION_TOLERANCE
    );

    return processVerbIntersectionResults(intersections, swapParams);
}
