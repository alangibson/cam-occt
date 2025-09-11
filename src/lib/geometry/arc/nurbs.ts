import verb from 'verb-nurbs';
import type { Arc } from './interfaces';

/**
 * Convert Arc geometry to verb-nurbs curve
 * Following INTERSECTION.md recommendation for Arc-NURBS intersections
 */
export function createVerbCurveFromArc(arc: Arc): verb.geom.ICurve {
    // Use verb-nurbs built-in arc constructor
    // verb.geom.Arc expects angles in radians and creates the arc in the XY plane
    return new verb.geom.Arc(
        [arc.center.x, arc.center.y, 0], // center point
        [1, 0, 0], // x-axis
        [0, 1, 0], // y-axis
        arc.radius,
        arc.startAngle,
        arc.endAngle
    );
}
