import verb from 'verb-nurbs';
import type { Circle } from './interfaces';

/**
 * Convert Circle geometry to verb-nurbs curve
 * Following INTERSECTION.md recommendation for Circle-NURBS intersections
 */

export function createVerbCurveFromCircle(circle: Circle): verb.geom.ICurve {
    // Use verb-nurbs built-in circle constructor
    return new verb.geom.Circle(
        [circle.center.x, circle.center.y, 0], // center point
        [1, 0, 0], // x-axis
        [0, 1, 0], // y-axis
        circle.radius
    );
}
