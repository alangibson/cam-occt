import type { Arc, Circle } from '../../../../../lib/types/geometry';
import type { IntersectionResult } from '../../chain/types';
import { findArcArcIntersections } from '../arc-arc/index';

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
