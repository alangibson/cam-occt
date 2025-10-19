import type { Arc } from '$lib/geometry/arc/interfaces';
import type { Circle } from '$lib/geometry/circle/interfaces';
import type { IntersectionResult } from '$lib/algorithms/offset-calculation/chain/types';
import { findArcArcIntersections } from '$lib/algorithms/offset-calculation/intersect/arc-arc';

/**
 * Find intersections between two circles
 */
export function findCircleCircleIntersections(
    circle1: Circle,
    circle2: Circle
): IntersectionResult[] {
    // Convert both circles to full arcs and use arc-arc intersection
    const arc1: Arc = {
        center: circle1.center,
        radius: circle1.radius,
        startAngle: 0,
        endAngle: 2 * Math.PI,
        clockwise: false,
    };

    const arc2: Arc = {
        center: circle2.center,
        radius: circle2.radius,
        startAngle: 0,
        endAngle: 2 * Math.PI,
        clockwise: false,
    };

    return findArcArcIntersections(arc1, arc2);
}
