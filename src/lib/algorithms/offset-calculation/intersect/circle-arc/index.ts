import type { Arc } from '$lib/geometry/arc/interfaces';
import type { Circle } from '$lib/geometry/circle/interfaces';
import type { IntersectionResult } from '$lib/algorithms/offset-calculation/chain/types';
import { findArcArcIntersections } from '$lib/algorithms/offset-calculation/intersect/arc-arc';

/**
 * Find intersections between an arc and a circle
 */
export function findArcCircleIntersections(
    arc: Arc,
    circle: Circle
): IntersectionResult[] {
    // Convert circle to full arc and use arc-arc intersection
    const circleAsArc: Arc = {
        center: circle.center,
        radius: circle.radius,
        startAngle: 0,
        endAngle: 2 * Math.PI,
        clockwise: false,
    };

    return findArcArcIntersections(arc, circleAsArc);
}
