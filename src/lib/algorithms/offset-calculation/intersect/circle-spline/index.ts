import { createVerbCurveFromCircle } from '$lib/geometry/circle/nurbs';
import type { Circle } from '$lib/geometry/circle/interfaces';
import type { Shape } from '$lib/geometry/shape/interfaces';
import type { Spline } from '$lib/geometry/spline/interfaces';
import type { IntersectionResult } from '$lib/algorithms/offset-calculation/chain/types';
import { processSplineWithCurveIntersection } from '$lib/algorithms/offset-calculation/shared/spline-intersection-utils';
import { DEFAULT_EXTENSION_LENGTH_MM } from '$lib/geometry/constants';

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
    extensionLength: number = DEFAULT_EXTENSION_LENGTH_MM
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
