import verb from 'verb-nurbs';
import { generateUniformKnotVector } from './functions';
import type { Spline } from './interfaces';

/**
 * Convert Spline geometry to verb-nurbs curve
 * Handles cases where knot vectors might be empty or invalid
 */

export function createVerbCurveFromSpline(spline: Spline): verb.geom.ICurve {
    const controlPoints3D = spline.controlPoints.map(
        (p) => [p.x, p.y, 0] as [number, number, number]
    );
    const weights = spline.weights || spline.controlPoints.map(() => 1);

    // Check if we need to generate a proper knot vector
    const expectedKnotLength = controlPoints3D.length + spline.degree + 1;
    let knots = spline.knots;

    if (!knots || knots.length === 0 || knots.length !== expectedKnotLength) {
        // Generate uniform knot vector for the given degree and control points
        knots = generateUniformKnotVector(
            controlPoints3D.length,
            spline.degree
        );
    }

    const curve = verb.geom.NurbsCurve.byKnotsControlPointsWeights(
        spline.degree,
        knots,
        controlPoints3D,
        weights
    );

    return curve;
}
