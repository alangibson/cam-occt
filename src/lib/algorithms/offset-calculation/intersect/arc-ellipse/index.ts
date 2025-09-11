import type { IntersectionResult } from '../../chain/types.ts';
import type { Shape } from '$lib/types/geometry';
import type { Arc } from '$lib/geometry/arc';
import type { Ellipse } from '$lib/geometry/ellipse';
import verb, { type CurveCurveIntersection } from 'verb-nurbs';
import {
    createVerbCurveFromEllipse,
    createVerbCurveFromArc,
    processVerbIntersectionResults,
} from '../../../../utils/verb-integration-utils';
import { INTERSECTION_TOLERANCE } from '../../../../geometry/math/constants';

/**
 * Verb-NURBS Ellipse-Arc Intersection Module
 *
 * Implements ellipse-arc intersection methods using the verb-nurbs library
 * as recommended in INTERSECTION.md. This provides exact geometric
 * intersection calculations following the reference specifications.
 */

/**
 * Find intersections between an ellipse and an arc using verb-nurbs
 * Implements INTERSECTION.md recommendation #130: "Convert arc to NURBs and use NURBs-NURBs routine"
 */
export function findEllipseArcIntersectionsVerb(
    ellipseShape: Shape,
    arcShape: Shape,
    swapParams: boolean = false
): IntersectionResult[] {
    const ellipse = ellipseShape.geometry as Ellipse;
    const arc = arcShape.geometry as Arc;

    // Convert both shapes to verb-nurbs curves
    const ellipseCurve: verb.geom.ICurve = createVerbCurveFromEllipse(ellipse);
    const arcCurve: verb.geom.ICurve = createVerbCurveFromArc(arc);

    // Use verb.geom.Intersect.curves() for intersection
    const intersections: CurveCurveIntersection[] = verb.geom.Intersect.curves(
        ellipseCurve,
        arcCurve,
        INTERSECTION_TOLERANCE
    );

    return processVerbIntersectionResults(intersections, swapParams);
}

/**
 * Find intersections between an ellipse and an arc using NURBS
 */
export function findEllipseArcIntersections(
    ellipseShape: Shape,
    arcShape: Shape,
    swapParams: boolean
): IntersectionResult[] {
    // Use NURBS-based intersection as recommended in INTERSECTION.md
    return findEllipseArcIntersectionsVerb(ellipseShape, arcShape, swapParams);
}
