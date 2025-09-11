import { createVerbCurveFromCircle } from '$lib/utils/verb-integration-utils';
import type { Shape } from '$lib/types/geometry';
import type { Spline } from '$lib/geometry/spline';
import type { Circle } from '$lib/geometry/circle';
import type { IntersectionResult } from '../../chain/types';
import { processSplineWithCurveIntersection } from '../../shared/spline-intersection-utils';
import { MAX_ITERATIONS } from '../../../../geometry/constants';

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
    const circle: import('$lib/types/geometry').Circle =
        circleShape.geometry as Circle;

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
