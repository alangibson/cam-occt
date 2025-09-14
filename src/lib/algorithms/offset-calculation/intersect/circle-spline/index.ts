import { createVerbCurveFromCircle } from '$lib/geometry/circle/nurbs';
import type { Circle, Shape } from '$lib/types/geometry';
import type { Spline } from '$lib/geometry/spline';
import type { IntersectionResult } from '$lib/algorithms/offset-calculation/chain/types';
import { processSplineWithCurveIntersection } from '$lib/algorithms/offset-calculation/shared/spline-intersection-utils';
import { MAX_ITERATIONS } from '$lib/geometry/constants';

/**
 * Find intersections between a spline and a circle using verb-nurbs
 * Implements INTERSECTION.md recommendation #106: "Convert circle to NURBs and use NURBs-NURBs routine"
 * Supports gap intersection detection by extending the spline
 */
export function findSplineCircleIntersectionsVerb(
    splineShape: Shape,
    circleShape: Shape,
    swapParams: boolean = false,
    allowExtensions: boolean = false,
    extensionLength: number = MAX_ITERATIONS
): IntersectionResult[] {
    const spline: Spline = splineShape.geometry as Spline;
    const circle: Circle = circleShape.geometry as Circle;

    // Use shared utility for spline-curve intersection
    // Note: Circles cannot be extended as they are already closed curves
    const circleCurve = createVerbCurveFromCircle(circle);
    return processSplineWithCurveIntersection(
        spline,
        circleCurve,
        swapParams,
        allowExtensions,
        extensionLength
    );
}
