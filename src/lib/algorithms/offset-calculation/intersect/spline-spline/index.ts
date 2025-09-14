import type { Shape } from '$lib/types/geometry';
import type { Spline } from '$lib/geometry/spline';
import type { IntersectionResult } from '$lib/algorithms/offset-calculation/chain/types';
import { processSplineIntersection } from '$lib/algorithms/offset-calculation/shared/spline-intersection-utils';
import { DEFAULT_EXTENSION_LENGTH } from '$lib/geometry/constants';

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
    extensionLength: number = DEFAULT_EXTENSION_LENGTH
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
