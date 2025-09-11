import verb from 'verb-nurbs';
import type { Line } from './interfaces';

/**
 * Convert Line geometry to verb-nurbs curve (degree-1 NURBS)
 * Following INTERSECTION.md recommendation for Line-NURBS intersections
 */
export function createVerbCurveFromLine(line: Line): verb.geom.ICurve {
    const controlPoints3D = [
        [line.start.x, line.start.y, 0] as [number, number, number],
        [line.end.x, line.end.y, 0] as [number, number, number],
    ];

    return verb.geom.NurbsCurve.byKnotsControlPointsWeights(
        1, // degree 1 for line
        [0, 0, 1, 1], // knot vector for degree-1 curve with 2 control points
        controlPoints3D,
        [1, 1] // uniform weights
    );
}
