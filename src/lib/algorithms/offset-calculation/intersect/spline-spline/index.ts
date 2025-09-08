import type { Shape, Spline } from '../../../../types/geometry';
import type { IntersectionResult } from '../../chain/types';
import { processSplineIntersection } from '../../shared/spline-intersection-utils';

/**
 * Find intersections between two splines using verb-nurbs
 * Implements INTERSECTION.md recommendation #165: "Use verb.intersect.curves() with two NURBs curve objects"
 * Supports gap intersection detection with bidirectional extension
 */
export function findSplineSplineIntersectionsVerb(
    shape1: Shape,
    shape2: Shape,
    swapParams: boolean = false,
    allowExtensions: boolean = false,
    extensionLength: number = 1000
): IntersectionResult[] {
    const spline1: Spline = shape1.geometry as Spline;
    const spline2: Spline = shape2.geometry as Spline;

    return processSplineIntersection(
        spline1,
        spline2,
        swapParams,
        allowExtensions,
        extensionLength
    );
}
